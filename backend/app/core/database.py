"""
BIST AI Trading — PostgreSQL Veritabanı Katmanı
SQLAlchemy 2.0 async engine + ORM modelleri
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
