"""
BIST AI Trading — JWT Authentication Katmanı
PostgreSQL users tablosuyla entegre.
"""

import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, Field
from sqlalchemy import select, text

from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)

# ── JWT Konfigürasyonu ──────────────────────────
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "bist-ai-super-secret-key-change-in-production-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))  # 24 saat

# ── Şifre Hashleme ──────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── FastAPI Security Scheme ─────────────────────
bearer_scheme = HTTPBearer(auto_error=False)


# ── Pydantic Modelleri ──────────────────────────
class TokenPayload(BaseModel):
    sub: str  # username
    user_id: int
    name: str
    role: str = "user"
    exp: Optional[float] = None


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=4, max_length=255)


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field("", max_length=255)  # opsiyonel
    password: str = Field(..., min_length=6, max_length=255)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict


class UserInfo(BaseModel):
    id: int
    name: str
    username: str
    email: str = ""
    role: str = "user"


# ── Yardımcı Fonksiyonlar ──────────────────────

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Şifre doğrulama (bcrypt)."""
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    """Şifre hashleme (bcrypt)."""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """JWT token üretimi."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode["exp"] = expire.timestamp()
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> TokenPayload:
    """JWT token çözme."""
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    return TokenPayload(**payload)


# ── Veritabanı İşlemleri ────────────────────────

async def authenticate_user(username: str, password: str) -> Optional[dict]:
    """Kullanıcı adı ve şifre ile kullanıcı doğrulama."""
    async with AsyncSessionLocal() as session:
        # Önce username sütunuyla dene, yoksa email ile dene (geriye uyumluluk)
        result = await session.execute(
            text("SELECT id, name, COALESCE(username, '') as username, email, password FROM users WHERE username = :uname OR email = :uname LIMIT 1"),
            {"uname": username},
        )
        user = result.fetchone()
        if user is None:
            return None
        if not verify_password(password, user.password):
            return None
        return {
            "id": user.id,
            "name": user.name,
            "username": user.username or user.email,
            "email": user.email,
            "role": "admin",  # TODO: role sütunu eklendiğinde dinamik olacak
        }


async def register_user(name: str, username: str, email: str, password: str) -> dict:
    """Yeni kullanıcı kaydı."""
    async with AsyncSessionLocal() as session:
        # Username kontrolü
        existing = await session.execute(
            text("SELECT id FROM users WHERE username = :uname"),
            {"uname": username},
        )
        if existing.fetchone():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Bu kullanıcı adı zaten kullanılıyor.",
            )

        hashed = hash_password(password)
        now = datetime.now(timezone.utc)
        result = await session.execute(
            text("""
                INSERT INTO users (name, username, email, password, created_at, updated_at)
                VALUES (:name, :uname, :email, :password, :now, :now)
                RETURNING id
            """),
            {"name": name, "uname": username, "email": email or "", "password": hashed, "now": now},
        )
        await session.commit()
        user_id = result.scalar_one()
        return {
            "id": user_id,
            "name": name,
            "username": username,
            "email": email,
            "role": "user",
        }


async def get_user_by_id(user_id: int) -> Optional[dict]:
    """ID ile kullanıcı getir."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text("SELECT id, name, COALESCE(username, '') as username, email, role FROM users WHERE id = :uid"),
            {"uid": user_id},
        )
        user = result.fetchone()
        if user is None:
            return None
        return {"id": user.id, "name": user.name, "username": user.username or user.email, "email": user.email, "role": user.role}


# ── Kullanıcı Yönetimi (CRUD) ──────────────────

async def list_users() -> list[dict]:
    """Tüm kullanıcıları listele."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text("SELECT id, name, COALESCE(username, '') as username, email, role, created_at FROM users ORDER BY id")
        )
        rows = result.fetchall()
        return [
            {
                "id": r.id,
                "name": r.name,
                "username": r.username or r.email,
                "email": r.email or "",
                "role": r.role,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]


async def update_user(user_id: int, name: str, username: str, email: str, role: str) -> dict:
    """Kullanıcı bilgilerini güncelle."""
    async with AsyncSessionLocal() as session:
        # Username çakışma kontrolü
        existing = await session.execute(
            text("SELECT id FROM users WHERE username = :uname AND id != :uid"),
            {"uname": username, "uid": user_id},
        )
        if existing.fetchone():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Bu kullanıcı adı zaten başka biri tarafından kullanılıyor.",
            )

        now = datetime.now(timezone.utc)
        await session.execute(
            text("""
                UPDATE users
                SET name = :name, username = :uname, email = :email, role = :role, updated_at = :now
                WHERE id = :uid
            """),
            {"name": name, "uname": username, "email": email or "", "role": role, "now": now, "uid": user_id},
        )
        await session.commit()
        return {"id": user_id, "name": name, "username": username, "email": email, "role": role}


async def change_user_password(user_id: int, new_password: str) -> bool:
    """Kullanıcı şifresini değiştir."""
    hashed = hash_password(new_password)
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text("UPDATE users SET password = :pwd, updated_at = :now WHERE id = :uid"),
            {"pwd": hashed, "now": now, "uid": user_id},
        )
        await session.commit()
        return result.rowcount > 0


async def delete_user(user_id: int) -> bool:
    """Kullanıcı sil."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text("DELETE FROM users WHERE id = :uid"),
            {"uid": user_id},
        )
        await session.commit()
        return result.rowcount > 0


# ── İzin (Permission) Yönetimi ──────────────────

async def get_all_permissions() -> list[dict]:
    """Tüm tanımlı izinleri gruplu şekilde döndür."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text("SELECT id, key, name, description, group_name FROM permissions ORDER BY group_name, id")
        )
        rows = result.fetchall()
        return [
            {"id": r.id, "key": r.key, "name": r.name, "description": r.description, "group_name": r.group_name}
            for r in rows
        ]


async def get_user_permissions(user_id: int) -> list[str]:
    """Kullanıcının aktif izin anahtarlarını döndür."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text("SELECT permission_key FROM user_permissions WHERE user_id = :uid AND granted = TRUE"),
            {"uid": user_id},
        )
        return [r.permission_key for r in result.fetchall()]


async def set_user_permissions(user_id: int, permission_keys: list[str]) -> list[str]:
    """Kullanıcının izinlerini toplu olarak ayarla (yalnızca verilen key'ler aktif olur)."""
    async with AsyncSessionLocal() as session:
        # Mevcut izinleri sil
        await session.execute(
            text("DELETE FROM user_permissions WHERE user_id = :uid"),
            {"uid": user_id},
        )
        # Yeni izinleri ekle
        from datetime import datetime, timezone as _tz
        now = datetime.now(_tz.utc)
        for pkey in permission_keys:
            await session.execute(
                text("""
                    INSERT INTO user_permissions (user_id, permission_key, granted, granted_at)
                    VALUES (:uid, :pkey, TRUE, :now)
                    ON CONFLICT (user_id, permission_key) DO UPDATE SET granted = TRUE, granted_at = :now
                """),
                {"uid": user_id, "pkey": pkey, "now": now},
            )
        await session.commit()
        return permission_keys


async def check_user_permission(user_id: int, permission_key: str) -> bool:
    """Kullanıcının belirli bir izni olup olmadığını kontrol et."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text("SELECT granted FROM user_permissions WHERE user_id = :uid AND permission_key = :pkey AND granted = TRUE"),
            {"uid": user_id, "pkey": permission_key},
        )
        return result.fetchone() is not None


# ── FastAPI Dependency ──────────────────────────

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Optional[UserInfo]:
    """
    JWT token'dan mevcut kullanıcıyı çıkarır.
    Token yoksa None döner (opsiyonel auth).
    """
    if credentials is None:
        return None
    try:
        payload = decode_token(credentials.credentials)
        return UserInfo(
            id=payload.user_id,
            name=payload.name,
            username=payload.sub,
            email="",
            role=payload.role,
        )
    except JWTError:
        return None


async def require_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> UserInfo:
    """
    Zorunlu auth — token yoksa veya geçersizse 401 döner.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Oturum açmanız gerekiyor.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_token(credentials.credentials)
        return UserInfo(
            id=payload.user_id,
            name=payload.name,
            username=payload.sub,
            email="",
            role=payload.role,
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token geçersiz veya süresi dolmuş.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_permission(permission_key: str):
    """
    Belirli bir izin gerektiren FastAPI dependency factory.
    Admin rolü olan kullanıcılar her zaman geçer.
    Örnek: Depends(require_permission("trade.manual"))
    """
    async def _check(
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    ) -> UserInfo:
        if credentials is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Oturum açmanız gerekiyor.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        try:
            payload = decode_token(credentials.credentials)
            user = UserInfo(
                id=payload.user_id,
                name=payload.name,
                username=payload.sub,
                email="",
                role=payload.role,
            )
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token geçersiz veya süresi dolmuş.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Admin her izne sahip
        if user.role == "admin":
            return user

        # İzin kontrolü
        has_perm = await check_user_permission(user.id, permission_key)
        if not has_perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Bu işlem için '{permission_key}' izniniz bulunmuyor.",
            )
        return user

    return _check
