"""
DigiBist — PostgreSQL Veritabanı Katmanı (database.py)
═══════════════════════════════════════════════════════════════════════

Tüm veritabanı işlemleri bu dosyada tanımlıdır.
SQLAlchemy 2.0 async engine + ORM modelleri + raw SQL CRUD fonksiyonları.

BAĞLANTI:
  postgresql+asyncpg://bist_admin:bist_secure_2026@localhost:5432/bist_trading
  Async engine: pool_size=10, max_overflow=20, pool_pre_ping=True
  Sync engine: migration/startup yardımcısı (psycopg2)

ORM MODELLERİ:
  StockForecast    — AI tahmin sonuçları (stock_forecasts tablosu)
  OrderRecord      — Emir kayıtları (orders tablosu)
  AutoTradeLog     — Otomatik işlem logları
  ConditionalOrder — Koşullu emirler (stop-loss, take-profit)

ANA FONKSİYON GRUPLARI:
  1. DB Health & Cache       : db_health_check, get_cached_forecast, set_cached_forecast
  2. Forecast CRUD           : save_stock_forecast, get_stocks_for_trading
  3. Hisse Yönetimi          : get_active_symbols, bulk_update_stock_prices
  4. Trading                 : save_order_v2, get_recent_orders_v2, get_trade_stats
  5. Conditional Orders      : save_conditional_order, get_conditional_orders, cancel_conditional_order
  6. Auto-Trade Logs         : save_auto_trade_log, get_recent_auto_trade_logs
  7. Tahmin Doğrulama (v8.09): migrate_prediction_verification, verify_predictions,
                               get_prediction_history, get_prediction_accuracy_stats,
                               get_prediction_accuracy_timeline, get_prediction_leaderboard

TABLO YAPISAL:
  stock_forecasts  — AI tahmin sonuçları + doğrulama kolonları (7 yeni: actual_price, vb.)
  stocks           — Aktif hisse listesi
  forecast_cache   — Geçici tahmin cache (TTL bazlı)
  orders           — Paper/real emirler
  conditional_orders — Stop-loss/take-profit koşullu emirler
  auto_trade_logs  — Otomatik işlem log kayıtları

DEĞİŞİKLİK GEÇMİŞİ:
  v8.03: Oluşturuldu (temel CRUD)
  v8.06: Trading v2 + conditional orders
  v8.09: Prediction verification sistemi (7 kolon + 6 fonksiyon)
  v8.09.01: Detaylı docstring'ler eklendi
"""

import os
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Column, BigInteger, String, Numeric, Boolean, Text, DateTime, Index,
    create_engine, text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, sessionmaker

logger = logging.getLogger(__name__)

# ── Bağlantı URL'leri ──────────────────────────────
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://bist_admin:bist_secure_2026@localhost:5432/bist_trading",
)
DATABASE_URL_SYNC = os.getenv(
    "DATABASE_URL_SYNC",
    "postgresql+psycopg2://bist_admin:bist_secure_2026@localhost:5432/bist_trading",
)

# ── Async Engine ────────────────────────────────────
async_engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# ── Sync Engine (migration/startup yardımcısı) ──────
sync_engine = create_engine(DATABASE_URL_SYNC, echo=False, pool_pre_ping=True)
SyncSessionLocal = sessionmaker(bind=sync_engine)


# ── ORM Base ────────────────────────────────────────
class Base(DeclarativeBase):
    pass


def _utcnow():
    return datetime.now(timezone.utc)


# ─────────────────────────────────────────────────────
# ORM Modelleri
# ─────────────────────────────────────────────────────

class OrderRow(Base):
    __tablename__ = "orders"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    order_id = Column(String(40), unique=True, nullable=False)
    symbol = Column(String(10), nullable=False, index=True)
    side = Column(String(4), nullable=False)
    quantity = Column(Numeric(14, 4), nullable=False)
    mode = Column(String(10), nullable=False, default="paper")
    requested_price = Column(Numeric(12, 2), nullable=True)
    simulated_fill_price = Column(Numeric(12, 2), nullable=False)
    status = Column(String(20), nullable=False, default="filled")
    reason = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), default=_utcnow)


class AutoTradeLogRow(Base):
    __tablename__ = "auto_trade_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    symbol = Column(String(10), nullable=False, index=True)
    action = Column(String(30), nullable=False)
    reason = Column(Text, default="")
    mode = Column(String(10), nullable=False, default="paper")
    created_at = Column(DateTime(timezone=True), default=_utcnow)


class ForecastCacheRow(Base):
    __tablename__ = "forecast_cache"

    symbol = Column(String(10), primary_key=True)
    data = Column(JSONB, nullable=False)
    cached_at = Column(DateTime(timezone=True), default=_utcnow)


class StockForecastRow(Base):
    __tablename__ = "stock_forecasts"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    stock_id = Column(BigInteger, nullable=True)
    symbol = Column(String(10), nullable=False, index=True)
    current_price = Column(Numeric(12, 2), nullable=False)
    predicted_price = Column(Numeric(12, 2), nullable=False)
    signal = Column(String(10), nullable=False, default="HOLD")
    confidence = Column(Numeric(5, 4), nullable=False, default=0)
    change_percent = Column(Numeric(8, 2), default=0)
    risk_signal = Column(String(10), nullable=True)
    risk_reason = Column(Text, nullable=True)
    risk_adjusted = Column(Boolean, default=False)
    model_used = Column(String(100), default="RandomForestRegressor")
    raw_response = Column(JSONB, nullable=True)
    forecasted_at = Column(DateTime(timezone=True), default=_utcnow)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    # ── Doğrulama (Verification) Kolonları ──
    actual_price = Column(Numeric(12, 2), nullable=True)
    actual_change_pct = Column(Numeric(8, 2), nullable=True)
    is_direction_correct = Column(Boolean, nullable=True)
    price_error_pct = Column(Numeric(8, 2), nullable=True)
    prediction_score = Column(Numeric(5, 2), nullable=True)
    verified = Column(Boolean, default=False)
    verified_at = Column(DateTime(timezone=True), nullable=True)


class ConditionalOrderRow(Base):
    __tablename__ = "conditional_orders"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    order_ref = Column(String(40), unique=True, nullable=False)
    user_id = Column(BigInteger, nullable=True)
    symbol = Column(String(10), nullable=False, index=True)
    side = Column(String(4), nullable=False)
    quantity = Column(Numeric(14, 4), nullable=False)
    mode = Column(String(10), nullable=False, default="paper")
    order_type = Column(String(20), nullable=False)
    trigger_price = Column(Numeric(12, 2), nullable=True)
    limit_price = Column(Numeric(12, 2), nullable=True)
    stop_price = Column(Numeric(12, 2), nullable=True)
    take_profit_price = Column(Numeric(12, 2), nullable=True)
    trailing_stop_pct = Column(Numeric(5, 2), nullable=True)
    current_high = Column(Numeric(12, 2), nullable=True)
    status = Column(String(20), nullable=False, default="pending")
    strategy_type = Column(String(20), default="manual")
    notes = Column(Text, default="")
    expires_at = Column(DateTime(timezone=True), nullable=True)
    triggered_at = Column(DateTime(timezone=True), nullable=True)
    filled_order_id = Column(String(40), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow)


class TradePositionRow(Base):
    __tablename__ = "trade_positions"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, nullable=True)
    symbol = Column(String(10), nullable=False, index=True)
    side = Column(String(4), nullable=False)
    entry_price = Column(Numeric(12, 2), nullable=False)
    exit_price = Column(Numeric(12, 2), nullable=True)
    quantity = Column(Numeric(14, 4), nullable=False)
    mode = Column(String(10), nullable=False, default="paper")
    strategy_type = Column(String(20), default="manual")
    status = Column(String(20), nullable=False, default="open")
    pnl = Column(Numeric(14, 2), nullable=True)
    pnl_pct = Column(Numeric(8, 4), nullable=True)
    entry_order_id = Column(String(40), nullable=True)
    exit_order_id = Column(String(40), nullable=True)
    stop_loss = Column(Numeric(12, 2), nullable=True)
    take_profit = Column(Numeric(12, 2), nullable=True)
    notes = Column(Text, default="")
    opened_at = Column(DateTime(timezone=True), default=_utcnow)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow)


# ─────────────────────────────────────────────────────
# CRUD Yardımcıları
# ─────────────────────────────────────────────────────

async def db_health_check() -> bool:
    """PostgreSQL bağlantı kontrolü."""
    try:
        async with async_engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error(f"PostgreSQL health check başarısız: {e}")
        return False


async def save_order(order_dict: dict) -> dict:
    """Emri orders tablosuna kaydet."""
    async with AsyncSessionLocal() as session:
        row = OrderRow(
            order_id=order_dict["order_id"],
            symbol=order_dict["symbol"],
            side=order_dict["side"],
            quantity=order_dict["quantity"],
            mode=order_dict["mode"],
            requested_price=order_dict.get("requested_price"),
            simulated_fill_price=order_dict["simulated_fill_price"],
            status=order_dict["status"],
            reason=order_dict.get("reason", ""),
        )
        session.add(row)
        await session.commit()
        order_dict["db_id"] = row.id
    return order_dict


async def get_recent_orders(limit: int = 100) -> list[dict]:
    """Son emirleri getir."""
    from sqlalchemy import select
    async with AsyncSessionLocal() as session:
        stmt = (
            select(OrderRow)
            .order_by(OrderRow.created_at.desc())
            .limit(min(limit, 500))
        )
        result = await session.execute(stmt)
        rows = result.scalars().all()
        return [
            {
                "order_id": r.order_id,
                "symbol": r.symbol,
                "side": r.side,
                "quantity": float(r.quantity),
                "mode": r.mode,
                "requested_price": float(r.requested_price) if r.requested_price else None,
                "simulated_fill_price": float(r.simulated_fill_price),
                "status": r.status,
                "reason": r.reason,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]


async def save_auto_trade_log(symbol: str, action: str, reason: str, mode: str):
    """Auto-trade log kaydı."""
    async with AsyncSessionLocal() as session:
        row = AutoTradeLogRow(symbol=symbol, action=action, reason=reason, mode=mode)
        session.add(row)
        await session.commit()


async def get_recent_auto_trade_logs(limit: int = 50) -> list[dict]:
    """Son auto-trade logları."""
    from sqlalchemy import select
    async with AsyncSessionLocal() as session:
        stmt = (
            select(AutoTradeLogRow)
            .order_by(AutoTradeLogRow.created_at.desc())
            .limit(limit)
        )
        result = await session.execute(stmt)
        rows = result.scalars().all()
        return [
            {
                "symbol": r.symbol,
                "action": r.action,
                "reason": r.reason,
                "mode": r.mode,
                "ts": r.created_at.timestamp() if r.created_at else 0,
            }
            for r in rows
        ]


async def get_cached_forecast(symbol: str, ttl_seconds: int = 3600) -> Optional[dict]:
    """Cache'den forecast al (TTL kontrolüyle)."""
    from sqlalchemy import select
    async with AsyncSessionLocal() as session:
        stmt = select(ForecastCacheRow).where(ForecastCacheRow.symbol == symbol)
        result = await session.execute(stmt)
        row = result.scalar_one_or_none()
        if row is None:
            return None
        age = (datetime.now(timezone.utc) - row.cached_at.replace(tzinfo=timezone.utc)).total_seconds()
        if age > ttl_seconds:
            return None
        return row.data


async def set_cached_forecast(symbol: str, data: dict):
    """Forecast cache'e yaz (upsert)."""
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    async with AsyncSessionLocal() as session:
        stmt = pg_insert(ForecastCacheRow).values(
            symbol=symbol, data=data, cached_at=_utcnow()
        ).on_conflict_do_update(
            index_elements=["symbol"],
            set_={"data": data, "cached_at": _utcnow()},
        )
        await session.execute(stmt)
        await session.commit()


async def get_active_symbols() -> list[str]:
    """DB'den aktif hisse sembollerini çek."""
    try:
        async with async_engine.begin() as conn:
            result = await conn.execute(
                text("SELECT symbol FROM stocks WHERE is_active = true ORDER BY id")
            )
            return [row[0] for row in result.fetchall()]
    except Exception as e:
        logger.warning(f"Aktif semboller alınamadı: {e}")
        return []


async def get_active_symbols_with_price() -> list[dict]:
    """DB'den aktif hisseleri fiyatlarıyla birlikte çek."""
    try:
        async with async_engine.begin() as conn:
            result = await conn.execute(
                text("SELECT symbol, current_price FROM stocks WHERE is_active = true ORDER BY id")
            )
            return [{"symbol": row[0], "current_price": float(row[1] or 0)} for row in result.fetchall()]
    except Exception as e:
        logger.warning(f"Aktif semboller alınamadı: {e}")
        return []


async def update_stock_price(symbol: str, price: float, change_percent: float = 0):
    """Hisse fiyatını stocks tablosunda güncelle."""
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(
                text(
                    "UPDATE stocks SET current_price = :price, change_percent = :change, "
                    "last_synced_at = NOW(), updated_at = NOW() WHERE symbol = :symbol"
                ),
                {"price": price, "change": change_percent, "symbol": symbol},
            )
            await session.commit()
    except Exception as e:
        logger.warning(f"Fiyat güncelleme hatası ({symbol}): {e}")


async def bulk_update_stock_prices(price_map: dict[str, dict]):
    """Toplu fiyat güncelleme — {symbol: {price, change}} dict alır."""
    if not price_map:
        return
    try:
        async with AsyncSessionLocal() as session:
            for symbol, data in price_map.items():
                price = data.get("price", 0)
                change = data.get("change", 0)
                if price > 0:
                    await session.execute(
                        text(
                            "UPDATE stocks SET current_price = :price, change_percent = :change, "
                            "last_synced_at = NOW(), updated_at = NOW() WHERE symbol = :symbol"
                        ),
                        {"price": price, "change": change, "symbol": symbol},
                    )
            await session.commit()
    except Exception as e:
        logger.warning(f"Toplu fiyat güncelleme hatası: {e}")


async def save_stock_forecast(forecast_data: dict):
    """Tahmin sonucunu stock_forecasts tablosuna kaydet."""
    async with AsyncSessionLocal() as session:
        change_pct = 0.0
        cp = float(forecast_data.get("current_price", 0) or 0)
        pp = float(forecast_data.get("predicted_price", 0) or 0)
        if cp > 0:
            change_pct = round(((pp - cp) / cp) * 100, 2)

        row = StockForecastRow(
            symbol=forecast_data.get("symbol", "").replace(".IS", ""),
            current_price=cp,
            predicted_price=pp,
            signal=forecast_data.get("signal", "HOLD"),
            confidence=float(forecast_data.get("confidence", 0)),
            change_percent=change_pct,
            risk_signal=forecast_data.get("risk_signal"),
            risk_reason=forecast_data.get("risk_reason"),
            risk_adjusted=forecast_data.get("risk_adjusted", False),
            raw_response=forecast_data,
        )
        session.add(row)
        await session.commit()


# ─────────────────────────────────────────────────────
# Trading V2 — Gelişmiş Emir & Koşullu Emir CRUD
# ─────────────────────────────────────────────────────

async def save_order_v2(order_dict: dict) -> dict:
    """Gelişmiş emri orders tablosuna kaydet (V2 alanlarıyla)."""
    async with AsyncSessionLocal() as session:
        row = OrderRow(
            order_id=order_dict["order_id"],
            symbol=order_dict["symbol"],
            side=order_dict["side"],
            quantity=order_dict["quantity"],
            mode=order_dict["mode"],
            requested_price=order_dict.get("requested_price"),
            simulated_fill_price=order_dict["simulated_fill_price"],
            status=order_dict["status"],
            reason=order_dict.get("reason", ""),
        )
        session.add(row)
        await session.commit()

        # V2 alanlarını güncelle (ALTER TABLE ile eklenen kolonlar)
        v2_fields = {}
        _ALLOWED_V2_COLUMNS = {
            "order_type", "trigger_price", "stop_price", "take_profit_price",
            "trailing_stop_pct", "spread", "slippage", "slippage_pct",
            "strategy_type", "ai_confidence", "ai_signal",
            "indicators_snapshot", "pnl", "pnl_pct", "notes", "user_id",
        }
        for field in _ALLOWED_V2_COLUMNS:
            if field in order_dict and order_dict[field] is not None:
                v2_fields[field] = order_dict[field]

        if v2_fields:
            set_clauses = ", ".join(f"{k} = :{k}" for k in v2_fields)
            v2_fields["oid"] = order_dict["order_id"]
            try:
                await session.execute(
                    text(f"UPDATE orders SET {set_clauses} WHERE order_id = :oid"),
                    v2_fields,
                )
                await session.commit()
            except Exception as e:
                logger.warning(f"V2 alanları yazılamadı: {e}")

        order_dict["db_id"] = row.id
    return order_dict


async def get_recent_orders_v2(
    limit: int = 100,
    symbol: str = None,
    side: str = None,
    status: str = None,
    order_type: str = None,
    strategy_type: str = None,
    mode: str = None,
    date_from: str = None,
    date_to: str = None,
    offset: int = 0,
) -> tuple[list[dict], int]:
    """Gelişmiş emir geçmişi filtreleriyle getir. (data, total_count) döner."""
    async with AsyncSessionLocal() as session:
        where_clauses = []
        params = {}

        if symbol:
            where_clauses.append("symbol = :symbol")
            params["symbol"] = symbol.upper()
        if side:
            where_clauses.append("side = :side")
            params["side"] = side
        if status:
            where_clauses.append("status = :status")
            params["status"] = status
        if order_type:
            where_clauses.append("order_type = :order_type")
            params["order_type"] = order_type
        if strategy_type:
            where_clauses.append("strategy_type = :strategy_type")
            params["strategy_type"] = strategy_type
        if mode:
            where_clauses.append("mode = :mode")
            params["mode"] = mode
        if date_from:
            where_clauses.append("created_at >= :date_from")
            params["date_from"] = date_from
        if date_to:
            where_clauses.append("created_at <= :date_to")
            params["date_to"] = date_to

        where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"

        # Total count
        count_sql = f"SELECT COUNT(*) FROM orders WHERE {where_sql}"
        count_result = await session.execute(text(count_sql), params)
        total = count_result.scalar() or 0

        # Data
        data_sql = f"""
            SELECT order_id, symbol, side, quantity, mode,
                   requested_price, simulated_fill_price, status, reason, created_at,
                   order_type, trigger_price, stop_price, take_profit_price,
                   trailing_stop_pct, spread, slippage, slippage_pct,
                   strategy_type, ai_confidence, ai_signal, pnl, pnl_pct, notes
            FROM orders WHERE {where_sql}
            ORDER BY created_at DESC
            LIMIT :lim OFFSET :off
        """
        params["lim"] = min(limit, 500)
        params["off"] = offset

        result = await session.execute(text(data_sql), params)
        rows = result.fetchall()

        orders = []
        for r in rows:
            orders.append({
                "order_id": r[0],
                "symbol": r[1],
                "side": r[2],
                "quantity": float(r[3]) if r[3] else 0,
                "mode": r[4],
                "requested_price": float(r[5]) if r[5] else None,
                "simulated_fill_price": float(r[6]) if r[6] else 0,
                "status": r[7],
                "reason": r[8] or "",
                "created_at": r[9].isoformat() if r[9] else None,
                "order_type": r[10] or "market",
                "trigger_price": float(r[11]) if r[11] else None,
                "stop_price": float(r[12]) if r[12] else None,
                "take_profit_price": float(r[13]) if r[13] else None,
                "trailing_stop_pct": float(r[14]) if r[14] else None,
                "spread": float(r[15]) if r[15] else 0,
                "slippage": float(r[16]) if r[16] else 0,
                "slippage_pct": float(r[17]) if r[17] else 0,
                "strategy_type": r[18] or "manual",
                "ai_confidence": float(r[19]) if r[19] else None,
                "ai_signal": r[20],
                "pnl": float(r[21]) if r[21] else None,
                "pnl_pct": float(r[22]) if r[22] else None,
                "notes": r[23] or "",
            })

        return orders, total


async def get_trade_stats() -> dict:
    """Genel trade istatistikleri."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(text("""
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'filled') as filled,
                COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
                COUNT(*) FILTER (WHERE side = 'BUY') as buys,
                COUNT(*) FILTER (WHERE side = 'SELL') as sells,
                COALESCE(SUM(quantity * simulated_fill_price), 0) as volume,
                COALESCE(SUM(pnl), 0) as total_pnl,
                COUNT(*) FILTER (WHERE pnl > 0) as wins,
                COUNT(*) FILTER (WHERE pnl < 0) as losses,
                COALESCE(MAX(pnl), 0) as best,
                COALESCE(MIN(pnl), 0) as worst,
                COALESCE(AVG(slippage_pct), 0) as avg_slip
            FROM orders
        """))
        row = result.fetchone()

        # En çok işlem gören sembol
        sym_result = await session.execute(text("""
            SELECT symbol, COUNT(*) as cnt FROM orders
            GROUP BY symbol ORDER BY cnt DESC LIMIT 1
        """))
        sym_row = sym_result.fetchone()

        # Strateji dağılımı
        strat_result = await session.execute(text("""
            SELECT COALESCE(strategy_type, 'manual') as st, COUNT(*) as cnt
            FROM orders GROUP BY st ORDER BY cnt DESC
        """))
        strat_rows = strat_result.fetchall()

        total = row[0] or 0
        filled = row[1] or 0
        wins = row[7] or 0
        losses = row[8] or 0

        return {
            "total_trades": total,
            "filled_trades": filled,
            "rejected_trades": row[2] or 0,
            "buy_count": row[3] or 0,
            "sell_count": row[4] or 0,
            "total_volume": round(float(row[5] or 0), 2),
            "total_pnl": round(float(row[6] or 0), 2),
            "winning_trades": wins,
            "losing_trades": losses,
            "win_rate": round(wins / max(wins + losses, 1) * 100, 1),
            "avg_pnl": round(float(row[6] or 0) / max(filled, 1), 2),
            "best_trade": round(float(row[9] or 0), 2),
            "worst_trade": round(float(row[10] or 0), 2),
            "avg_slippage": round(float(row[11] or 0), 4),
            "most_traded_symbol": sym_row[0] if sym_row else "",
            "strategy_breakdown": {r[0]: r[1] for r in strat_rows},
        }


async def save_conditional_order(order_dict: dict) -> dict:
    """Koşullu emri kaydet."""
    import uuid
    async with AsyncSessionLocal() as session:
        ref = f"cond_{uuid.uuid4().hex[:10]}"
        row = ConditionalOrderRow(
            order_ref=ref,
            user_id=order_dict.get("user_id"),
            symbol=order_dict["symbol"],
            side=order_dict["side"],
            quantity=order_dict["quantity"],
            mode=order_dict.get("mode", "paper"),
            order_type=order_dict["order_type"],
            trigger_price=order_dict.get("trigger_price"),
            limit_price=order_dict.get("limit_price"),
            stop_price=order_dict.get("stop_price"),
            take_profit_price=order_dict.get("take_profit_price"),
            trailing_stop_pct=order_dict.get("trailing_stop_pct"),
            status="pending",
            strategy_type=order_dict.get("strategy_type", "manual"),
            notes=order_dict.get("notes", ""),
            expires_at=order_dict.get("expires_at"),
        )
        session.add(row)
        await session.commit()
        return {
            "order_ref": ref,
            "id": row.id,
            "symbol": row.symbol,
            "side": row.side,
            "order_type": row.order_type,
            "status": "pending",
        }


async def get_conditional_orders(status: str = None, symbol: str = None) -> list[dict]:
    """Koşullu emirleri getir."""
    async with AsyncSessionLocal() as session:
        where_clauses = []
        params = {}
        if status:
            where_clauses.append("status = :status")
            params["status"] = status
        if symbol:
            where_clauses.append("symbol = :symbol")
            params["symbol"] = symbol.upper()
        where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"

        result = await session.execute(text(f"""
            SELECT id, order_ref, symbol, side, quantity, mode, order_type,
                   trigger_price, limit_price, stop_price, take_profit_price,
                   trailing_stop_pct, status, strategy_type, notes,
                   expires_at, triggered_at, filled_order_id, created_at
            FROM conditional_orders WHERE {where_sql}
            ORDER BY created_at DESC LIMIT 200
        """), params)
        rows = result.fetchall()
        return [
            {
                "id": r[0], "order_ref": r[1], "symbol": r[2], "side": r[3],
                "quantity": float(r[4]) if r[4] else 0, "mode": r[5],
                "order_type": r[6], "trigger_price": float(r[7]) if r[7] else None,
                "limit_price": float(r[8]) if r[8] else None,
                "stop_price": float(r[9]) if r[9] else None,
                "take_profit_price": float(r[10]) if r[10] else None,
                "trailing_stop_pct": float(r[11]) if r[11] else None,
                "status": r[12], "strategy_type": r[13], "notes": r[14] or "",
                "expires_at": r[15].isoformat() if r[15] else None,
                "triggered_at": r[16].isoformat() if r[16] else None,
                "filled_order_id": r[17],
                "created_at": r[18].isoformat() if r[18] else None,
            }
            for r in rows
        ]


async def cancel_conditional_order(order_ref: str) -> bool:
    """Koşullu emri iptal et."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text("UPDATE conditional_orders SET status = 'cancelled', updated_at = NOW() WHERE order_ref = :ref AND status = 'pending'"),
            {"ref": order_ref},
        )
        await session.commit()
        return result.rowcount > 0


async def get_stocks_for_trading() -> list[dict]:
    """İşlem merkezi için aktif hisseleri fiyatlarıyla getir."""
    try:
        async with async_engine.begin() as conn:
            result = await conn.execute(
                text("""
                    SELECT symbol, name, sector, current_price, change_percent, is_favorite
                    FROM stocks WHERE is_active = true
                    ORDER BY is_favorite DESC, symbol ASC
                """)
            )
            return [
                {
                    "symbol": row[0],
                    "name": row[1] or "",
                    "sector": row[2] or "",
                    "current_price": float(row[3] or 0),
                    "change_percent": float(row[4] or 0),
                    "is_favorite": row[5] or False,
                }
                for row in result.fetchall()
            ]
    except Exception as e:
        logger.warning(f"Hisse listesi alınamadı: {e}")
        return []


# ────────────────────────────────────────────────────────────────────────────────────
# v8.09 — AI Tahmin Doğrulama Sistemi (Prediction Verification)
# ────────────────────────────────────────────────────────────────────────────────────
#
# Bu modül AI tahminlerinin gerçek piyasa verileriyle doğrulanmasını sağlar.
#
# Akış:
#   1. migrate_prediction_verification() — Uygulama başlangıcında çalışır,
#      stock_forecasts tablosuna 7 doğrulama kolonu ekler (idempotent).
#   2. verify_predictions() — Doğrulanmamış tahminleri TradingView Scanner API
#      (öncelikli) veya Yahoo Spark API (yedek) ile gerçek fiyata karşılaştırır.
#   3. get_prediction_history() — Filtreli + sayfalı tahmin geçmişi.
#   4. get_prediction_accuracy_stats() — Genel doğruluk istatistikleri.
#   5. get_prediction_accuracy_timeline() — Haftalık doğruluk trendi.
#   6. get_prediction_leaderboard() — Sembol bazlı başarı sıralaması.
#
# Doğrulama Koloları (stock_forecasts tablosu):
#   - actual_price       : Gerçekleşen piyasa fiyatı (TradingView/Yahoo'dan)
#   - actual_change_pct  : Gerçekleşen % değişim
#   - is_direction_correct: Yön tahmini doğru mu (UP/DOWN/FLAT)
#   - price_error_pct    : Tahmin ile gerçek fiyat arasındaki % hata
#   - prediction_score   : 0–100 puan (50 yön + 50 hassasiyet)
#   - verified           : Doğrulanmış mı
#   - verified_at        : Doğrulama zamanı
#
# Skor Hesaplama:
#   - Yön doğruysa: +50 puan
#   - Fiyat hassasiyeti: max(0, 50 - price_error_pct * 5)
#   - Toplam: min(yön + hassasiyet, 100)
#
# Not: risk_signal (Risk Engine sonucu) ve signal (AI orijinal) farklı alanlar.
#      Risk Engine düşük güvenli sinyalleri HOLD'a çevirir (threshold ~%75).
#      Frontend'de ikisi ayrı kolonlarda gösterilir.
#
# Tarih: 26 Şubat 2026
# Versiyon: v8.09.00
# ────────────────────────────────────────────────────────────────────────────────────

async def migrate_prediction_verification():
    """
    stock_forecasts tablosuna doğrulama kolonlarını ekle + predictions.view izni.
    
    Bu fonksiyon uygulama başlangıcında (startup event) çağrılır.
    Idempotent: Birden fazla kez çalıştırılabilir, mevcut verileri bozmaz.
    
    Yapılanlar:
      1. 7 yeni kolon eklenir (ADD COLUMN IF NOT EXISTS)
      2. 'predictions.view' izni permissions tablosuna eklenir
      3. Admin kullanıcıya (id=1) izin otomatik atanır
    """
    columns = [
        ("actual_price", "NUMERIC(12,2)"),
        ("actual_change_pct", "NUMERIC(8,2)"),
        ("is_direction_correct", "BOOLEAN"),
        ("price_error_pct", "NUMERIC(8,2)"),
        ("prediction_score", "NUMERIC(5,2)"),
        ("verified", "BOOLEAN DEFAULT FALSE"),
        ("verified_at", "TIMESTAMP WITH TIME ZONE"),
    ]
    try:
        async with async_engine.begin() as conn:
            for col_name, col_type in columns:
                await conn.execute(text(
                    f"ALTER TABLE stock_forecasts ADD COLUMN IF NOT EXISTS {col_name} {col_type}"
                ))
            # predictions.view iznini ekle
            await conn.execute(text("""
                INSERT INTO permissions (key, name, description, group_name)
                VALUES ('predictions.view', 'AI Tahminleri Görüntüle', 'AI tahmin geçmişi ve doğruluk analizini görüntüleme', 'Tahminler')
                ON CONFLICT (key) DO NOTHING
            """))
            # Admin kullanıcıya (id=1) otomatik ata
            await conn.execute(text("""
                INSERT INTO user_permissions (user_id, permission_key, granted, granted_at)
                VALUES (1, 'predictions.view', TRUE, NOW())
                ON CONFLICT (user_id, permission_key) DO NOTHING
            """))
        logger.info("✅ Prediction verification migration tamamlandı")
    except Exception as e:
        logger.warning(f"Prediction verification migration hatası: {e}")


async def get_prediction_history(
    limit: int = 50,
    offset: int = 0,
    symbol: str = None,
    signal: str = None,
    verified_only: bool = False,
    date_from: str = None,
    date_to: str = None,
) -> tuple[list[dict], int]:
    """
    Tahmin geçmişini filtreli ve sayfalı getir.
    
    Frontend PredictionHistoryPage.js 'Tahmin Geçmişi' sekmesinden çağrılır.
    
    Parametreler:
      - limit: Sayfa başına kayıt (max 500)
      - offset: Sayfalama offseti
      - symbol: Sembol filtresi (ör: 'THYAO')
      - signal: Sinyal filtresi ('BUY', 'SELL', 'HOLD')
      - verified_only: Sadece doğrulanmış tahminler
      - date_from/date_to: Tarih aralığı
    
    Dönüş: (tahmin_listesi, toplam_sayı)
    
    Her tahmin kaydı şunları içerir:
      - signal: AI orijinal sinyal (BUY/SELL)
      - risk_signal: Risk Engine sonucu (genellikle HOLD, confidence düşükse)
      - actual_price: Doğrulama sonrası gerçek fiyat
      - prediction_score: 0-100 başarı skoru
    """
    async with AsyncSessionLocal() as session:
        where_clauses = []
        params = {}

        if symbol:
            where_clauses.append("symbol = :symbol")
            params["symbol"] = symbol.upper().replace(".IS", "")
        if signal:
            where_clauses.append("signal = :signal")
            params["signal"] = signal.upper()
        if verified_only:
            where_clauses.append("verified = true")
        if date_from:
            # Türkiye saat dilimine çevirip date olarak karşılaştır
            where_clauses.append(
                "CAST((forecasted_at AT TIME ZONE 'Europe/Istanbul') AS date) >= CAST(:date_from AS date)"
            )
            params["date_from"] = date_from
        if date_to:
            # Günün sonuna kadar dahil et (23:59:59)
            where_clauses.append(
                "CAST((forecasted_at AT TIME ZONE 'Europe/Istanbul') AS date) <= CAST(:date_to AS date)"
            )
            params["date_to"] = date_to

        where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"

        count_result = await session.execute(
            text(f"SELECT COUNT(*) FROM stock_forecasts WHERE {where_sql}"), params
        )
        total = count_result.scalar() or 0

        params["lim"] = min(limit, 500)
        params["off"] = offset
        result = await session.execute(text(f"""
            SELECT id, symbol, current_price, predicted_price, signal, confidence,
                   change_percent, risk_signal, risk_reason, risk_adjusted, model_used,
                   forecasted_at, actual_price, actual_change_pct,
                   is_direction_correct, price_error_pct, prediction_score, verified, verified_at
            FROM stock_forecasts
            WHERE {where_sql}
            ORDER BY forecasted_at DESC
            LIMIT :lim OFFSET :off
        """), params)
        rows = result.fetchall()

        predictions = []
        for r in rows:
            predictions.append({
                "id": r[0],
                "symbol": r[1],
                "current_price": float(r[2]) if r[2] else 0,
                "predicted_price": float(r[3]) if r[3] else 0,
                "signal": r[4],
                "confidence": float(r[5]) if r[5] else 0,
                "change_percent": float(r[6]) if r[6] else 0,
                "risk_signal": r[7],
                "risk_reason": r[8],
                "risk_adjusted": r[9] or False,
                "model_used": r[10] or "RandomForestRegressor",
                "forecasted_at": r[11].isoformat() if r[11] else None,
                "actual_price": float(r[12]) if r[12] else None,
                "actual_change_pct": float(r[13]) if r[13] else None,
                "is_direction_correct": r[14],
                "price_error_pct": float(r[15]) if r[15] else None,
                "prediction_score": float(r[16]) if r[16] else None,
                "verified": r[17] or False,
                "verified_at": r[18].isoformat() if r[18] else None,
            })

        return predictions, total


async def verify_predictions(lookback_hours: int = 24) -> dict:
    """
    Doğrulanmamış tahminleri TradingView gerçek fiyatlarıyla karşılaştır.
    Birincil: TradingView Scanner API, Yedek: Yahoo Spark API.
    lookback_hours: kaç saat öncesine kadar doğrulanacak.
    """
    from app.core.live_price_provider import fetch_tradingview_prices, fetch_yahoo_spark_prices
    from datetime import timedelta

    cutoff = datetime.now(timezone.utc) - timedelta(hours=lookback_hours)
    verified_count = 0
    errors = []

    async with AsyncSessionLocal() as session:
        result = await session.execute(text("""
            SELECT id, symbol, current_price, predicted_price, signal, change_percent, forecasted_at
            FROM stock_forecasts
            WHERE verified = false AND forecasted_at >= :cutoff
            ORDER BY forecasted_at DESC
            LIMIT 200
        """), {"cutoff": cutoff})
        rows = result.fetchall()

        if not rows:
            return {"verified": 0, "message": "Doğrulanacak tahmin yok"}

        # Sembol bazında grupla
        symbol_rows: dict[str, list] = {}
        for r in rows:
            sym = r[1]
            if sym not in symbol_rows:
                symbol_rows[sym] = []
            symbol_rows[sym].append(r)

        # TradingView'den tüm sembollerin güncel fiyatını tek seferde çek
        all_symbols = list(symbol_rows.keys())
        live_prices = fetch_tradingview_prices(all_symbols)

        # TradingView'den alınamayanlar için Yahoo Spark'ı yedek olarak kullan
        missing_symbols = [s for s in all_symbols if s not in live_prices or live_prices[s].get("price", 0) <= 0]
        if missing_symbols:
            yahoo_prices = fetch_yahoo_spark_prices(missing_symbols)
            live_prices.update(yahoo_prices)
            logger.info(f"Verification: TradingView + Yahoo tamamlama: {len(yahoo_prices)} ek hisse")

        logger.info(f"Verification: {len(live_prices)}/{len(all_symbols)} sembol için fiyat alındı (TradingView)")

        for sym, forecasts in symbol_rows.items():
            try:
                price_data = live_prices.get(sym)
                if not price_data or price_data.get("price", 0) <= 0:
                    errors.append(f"{sym}: Fiyat verisi alınamadı")
                    continue
                actual_price = float(price_data["price"])

                for r in forecasts:
                    fid, _, current_price, predicted_price, sig, change_pct, forecasted_at = r
                    cp = float(current_price)
                    pp = float(predicted_price)

                    if cp <= 0:
                        continue

                    actual_change_pct = round(((actual_price - cp) / cp) * 100, 2)
                    predicted_direction = "UP" if pp > cp else ("DOWN" if pp < cp else "FLAT")
                    actual_direction = "UP" if actual_price > cp else ("DOWN" if actual_price < cp else "FLAT")
                    is_direction_correct = predicted_direction == actual_direction
                    price_error_pct = round(abs(pp - actual_price) / actual_price * 100, 2)

                    # Skor: yön doğruysa 50 puan + fiyat hassasiyetine göre 0-50 puan
                    score = 0.0
                    if is_direction_correct:
                        score += 50.0
                    accuracy_bonus = max(0, 50.0 - price_error_pct * 5)
                    score += accuracy_bonus
                    score = round(min(score, 100.0), 2)

                    await session.execute(text("""
                        UPDATE stock_forecasts SET
                            actual_price = :actual_price,
                            actual_change_pct = :actual_change_pct,
                            is_direction_correct = :is_dir,
                            price_error_pct = :price_err,
                            prediction_score = :score,
                            verified = true,
                            verified_at = NOW()
                        WHERE id = :fid
                    """), {
                        "actual_price": actual_price,
                        "actual_change_pct": actual_change_pct,
                        "is_dir": is_direction_correct,
                        "price_err": price_error_pct,
                        "score": score,
                        "fid": fid,
                    })
                    verified_count += 1

            except Exception as e:
                errors.append(f"{sym}: {str(e)}")
                logger.warning(f"Verification hatası ({sym}): {e}")

        await session.commit()

    return {
        "verified": verified_count,
        "total_checked": len(rows),
        "errors": errors,
    }


async def get_prediction_accuracy_stats() -> dict:
    """
    Genel tahmin doğruluk istatistikleri.
    
    Frontend PredictionHistoryPage.js 'Genel Bakış' sekmesindeki gauge'ler,
    özet kartlar ve sinyal bazlı başarı çubukları için veri sağlar.
    
    Dönüş:
      - total_predictions: Toplam tahmin sayısı
      - verified_count: Doğrulanmış tahmin sayısı
      - direction_accuracy: Yön doğruluk yüzdesi
      - signal_breakdown: BUY/SELL/HOLD bazlı ayrıntı
      - avg_score: Ortalama tahmin skoru
      - avg_price_error: Ortalama fiyat hatası %
    """
    async with AsyncSessionLocal() as session:
        result = await session.execute(text("""
            SELECT
                COUNT(*) as total_predictions,
                COUNT(*) FILTER (WHERE verified = true) as verified_count,
                COUNT(*) FILTER (WHERE is_direction_correct = true) as correct_direction,
                COUNT(*) FILTER (WHERE is_direction_correct = false) as wrong_direction,
                COALESCE(AVG(prediction_score) FILTER (WHERE verified = true), 0) as avg_score,
                COALESCE(AVG(price_error_pct) FILTER (WHERE verified = true), 0) as avg_price_error,
                COALESCE(AVG(confidence), 0) as avg_confidence,

                COUNT(*) FILTER (WHERE signal = 'BUY') as buy_count,
                COUNT(*) FILTER (WHERE signal = 'SELL') as sell_count,
                COUNT(*) FILTER (WHERE signal = 'HOLD') as hold_count,

                COUNT(*) FILTER (WHERE signal = 'BUY' AND is_direction_correct = true) as buy_correct,
                COUNT(*) FILTER (WHERE signal = 'SELL' AND is_direction_correct = true) as sell_correct,
                COUNT(*) FILTER (WHERE signal = 'BUY' AND verified = true) as buy_verified,
                COUNT(*) FILTER (WHERE signal = 'SELL' AND verified = true) as sell_verified,

                COALESCE(MAX(prediction_score), 0) as best_score,
                COALESCE(MIN(prediction_score) FILTER (WHERE verified = true), 0) as worst_score
            FROM stock_forecasts
        """))
        row = result.fetchone()

        total = row[0] or 0
        verified = row[1] or 0
        correct = row[2] or 0
        wrong = row[3] or 0
        buy_verified = row[12] or 0
        sell_verified = row[13] or 0

        return {
            "total_predictions": total,
            "verified_count": verified,
            "unverified_count": total - verified,
            "correct_direction": correct,
            "wrong_direction": wrong,
            "direction_accuracy": round(correct / max(verified, 1) * 100, 1),
            "avg_score": round(float(row[4] or 0), 1),
            "avg_price_error": round(float(row[5] or 0), 2),
            "avg_confidence": round(float(row[6] or 0), 4),
            "signal_breakdown": {
                "BUY": {"total": row[7] or 0, "correct": row[10] or 0, "accuracy": round((row[10] or 0) / max(buy_verified, 1) * 100, 1)},
                "SELL": {"total": row[8] or 0, "correct": row[11] or 0, "accuracy": round((row[11] or 0) / max(sell_verified, 1) * 100, 1)},
                "HOLD": {"total": row[9] or 0},
            },
            "best_score": round(float(row[14] or 0), 1),
            "worst_score": round(float(row[15] or 0), 1),
        }


async def get_prediction_accuracy_timeline(weeks: int = 12) -> list[dict]:
    """
    Haftalık tahmin doğruluk trendi.
    
    Frontend 'Genel Bakış' sekmesindeki MiniBarChart için veri sağlar.
    Son N haftanın doğruluk oranlarını döner.
    
    Dönüş: [{week, total, verified, correct, accuracy, avg_score, avg_error}, ...]
    """
    async with AsyncSessionLocal() as session:
        result = await session.execute(text("""
            SELECT
                date_trunc('week', forecasted_at) as week_start,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE verified = true) as verified,
                COUNT(*) FILTER (WHERE is_direction_correct = true) as correct,
                COALESCE(AVG(prediction_score) FILTER (WHERE verified = true), 0) as avg_score,
                COALESCE(AVG(price_error_pct) FILTER (WHERE verified = true), 0) as avg_error
            FROM stock_forecasts
            WHERE forecasted_at >= NOW() - make_interval(weeks => :weeks)
            GROUP BY week_start
            ORDER BY week_start DESC
            LIMIT :weeks
        """), {"weeks": weeks})
        rows = result.fetchall()

        return [
            {
                "week": r[0].isoformat() if r[0] else None,
                "total": r[1] or 0,
                "verified": r[2] or 0,
                "correct": r[3] or 0,
                "accuracy": round((r[3] or 0) / max(r[2] or 1, 1) * 100, 1),
                "avg_score": round(float(r[4] or 0), 1),
                "avg_error": round(float(r[5] or 0), 2),
            }
            for r in rows
        ]


async def get_prediction_leaderboard(limit: int = 20) -> dict:
    """
    Sembol bazında tahmin başarı sıralaması.
    
    Frontend 'Sıralama' sekmesindeki 2 panel için veri sağlar:
      - best: En yüksek ortalama skora sahip semboller (yeşil panel)
      - worst: En düşük ortalama skora sahip semboller (kırmızı panel)
    
    Sadece en az 1 doğrulanmış tahmini olan semboller dahil edilir.
    
    Dönüş: {best: [...], worst: [...]}
    """
    async with AsyncSessionLocal() as session:
        result = await session.execute(text("""
            SELECT
                symbol,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE verified = true) as verified,
                COUNT(*) FILTER (WHERE is_direction_correct = true) as correct,
                COALESCE(AVG(prediction_score) FILTER (WHERE verified = true), 0) as avg_score,
                COALESCE(AVG(price_error_pct) FILTER (WHERE verified = true), 0) as avg_error,
                COALESCE(AVG(confidence), 0) as avg_confidence
            FROM stock_forecasts
            GROUP BY symbol
            HAVING COUNT(*) FILTER (WHERE verified = true) >= 1
            ORDER BY avg_score DESC
            LIMIT :lim
        """), {"lim": limit})
        best = result.fetchall()

        result2 = await session.execute(text("""
            SELECT
                symbol,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE verified = true) as verified,
                COUNT(*) FILTER (WHERE is_direction_correct = true) as correct,
                COALESCE(AVG(prediction_score) FILTER (WHERE verified = true), 0) as avg_score,
                COALESCE(AVG(price_error_pct) FILTER (WHERE verified = true), 0) as avg_error,
                COALESCE(AVG(confidence), 0) as avg_confidence
            FROM stock_forecasts
            GROUP BY symbol
            HAVING COUNT(*) FILTER (WHERE verified = true) >= 1
            ORDER BY avg_score ASC
            LIMIT :lim
        """), {"lim": limit})
        worst = result2.fetchall()

        def _row_to_dict(r):
            verified = r[2] or 0
            return {
                "symbol": r[0],
                "total_predictions": r[1] or 0,
                "verified_count": verified,
                "correct_count": r[3] or 0,
                "accuracy": round((r[3] or 0) / max(verified, 1) * 100, 1),
                "avg_score": round(float(r[4] or 0), 1),
                "avg_error": round(float(r[5] or 0), 2),
                "avg_confidence": round(float(r[6] or 0), 4),
            }

        return {
            "best": [_row_to_dict(r) for r in best],
            "worst": [_row_to_dict(r) for r in worst],
        }


# ═══════════════════════════════════════════════════════════════════════
# 8) ANALİZ ZAMANLAYICI (Analysis Scheduler) — v8.10
# ═══════════════════════════════════════════════════════════════════════

async def migrate_analysis_schedule():
    """
    analysis_schedule tablosunu oluşturur (yoksa).
    Otomatik teknik analiz zamanlama ayarlarını saklar.
    Multi-worker safe: concurrent CREATE TABLE hatalarını yakalar.
    """
    async with AsyncSessionLocal() as session:
        try:
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS analysis_schedule (
                    id              SERIAL PRIMARY KEY,
                    enabled         BOOLEAN DEFAULT false,
                    interval_minutes INTEGER DEFAULT 60,
                    stock_mode      VARCHAR(20) DEFAULT 'all',
                    custom_symbols  TEXT DEFAULT '',
                    market_hours_only BOOLEAN DEFAULT true,
                    max_concurrent  INTEGER DEFAULT 3,
                    notify_telegram BOOLEAN DEFAULT true,
                    notify_browser  BOOLEAN DEFAULT true,
                    last_run_at     TIMESTAMP WITH TIME ZONE,
                    next_run_at     TIMESTAMP WITH TIME ZONE,
                    total_runs      INTEGER DEFAULT 0,
                    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """))
            await session.commit()
        except Exception:
            await session.rollback()
            # Başka bir worker zaten oluşturmuş olabilir — devam et

        # Eğer tablo boşsa varsayılan kayıt ekle
        try:
            result = await session.execute(text("SELECT COUNT(*) FROM analysis_schedule"))
            count = result.scalar()
            if count == 0:
                await session.execute(text("""
                    INSERT INTO analysis_schedule
                        (enabled, interval_minutes, stock_mode, custom_symbols,
                         market_hours_only, max_concurrent, notify_telegram, notify_browser, total_runs)
                    VALUES
                        (false, 60, 'all', '', true, 3, true, true, 0)
                """))
                await session.commit()
        except Exception:
            await session.rollback()
            # Race condition — başka worker zaten INSERT yapmış olabilir

        logger.info("analysis_schedule tablosu hazır.")


async def get_analysis_schedule() -> dict:
    """Mevcut analiz zamanlama ayarlarını getir."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(text(
            "SELECT enabled, interval_minutes, stock_mode, custom_symbols, "
            "market_hours_only, max_concurrent, notify_telegram, notify_browser, "
            "last_run_at, next_run_at, total_runs, updated_at "
            "FROM analysis_schedule ORDER BY id LIMIT 1"
        ))
        row = result.fetchone()
        if not row:
            return {
                "enabled": False, "interval_minutes": 60, "stock_mode": "all",
                "custom_symbols": "", "market_hours_only": True, "max_concurrent": 3,
                "notify_telegram": True, "notify_browser": True,
                "last_run_at": None, "next_run_at": None, "total_runs": 0,
                "updated_at": None,
            }
        return {
            "enabled": row[0],
            "interval_minutes": row[1],
            "stock_mode": row[2] or "all",
            "custom_symbols": row[3] or "",
            "market_hours_only": row[4],
            "max_concurrent": row[5] or 3,
            "notify_telegram": row[6],
            "notify_browser": row[7],
            "last_run_at": row[8].isoformat() if row[8] else None,
            "next_run_at": row[9].isoformat() if row[9] else None,
            "total_runs": row[10] or 0,
            "updated_at": row[11].isoformat() if row[11] else None,
        }


async def save_analysis_schedule(config: dict) -> dict:
    """Analiz zamanlama ayarlarını güncelle."""
    async with AsyncSessionLocal() as session:
        await session.execute(text("""
            UPDATE analysis_schedule SET
                enabled = :enabled,
                interval_minutes = :interval_minutes,
                stock_mode = :stock_mode,
                custom_symbols = :custom_symbols,
                market_hours_only = :market_hours_only,
                max_concurrent = :max_concurrent,
                notify_telegram = :notify_telegram,
                notify_browser = :notify_browser,
                updated_at = NOW()
            WHERE id = (SELECT id FROM analysis_schedule ORDER BY id LIMIT 1)
        """), {
            "enabled": config.get("enabled", False),
            "interval_minutes": config.get("interval_minutes", 60),
            "stock_mode": config.get("stock_mode", "all"),
            "custom_symbols": config.get("custom_symbols", ""),
            "market_hours_only": config.get("market_hours_only", True),
            "max_concurrent": config.get("max_concurrent", 3),
            "notify_telegram": config.get("notify_telegram", True),
            "notify_browser": config.get("notify_browser", True),
        })
        await session.commit()
    return await get_analysis_schedule()


async def update_schedule_run_info(last_run_at: datetime, next_run_at: datetime):
    """Zamanlayıcı çalışma bilgisini güncelle."""
    async with AsyncSessionLocal() as session:
        await session.execute(text("""
            UPDATE analysis_schedule SET
                last_run_at = :last_run,
                next_run_at = :next_run,
                total_runs = total_runs + 1
            WHERE id = (SELECT id FROM analysis_schedule ORDER BY id LIMIT 1)
        """), {"last_run": last_run_at, "next_run": next_run_at})
        await session.commit()
