"""
Paper/Real emir yönlendirme motoru V2 — PostgreSQL destekli.
Her emir otomatik olarak 'orders' tablosuna kaydedilir.
Spread/slippage hesaplama, gelişmiş emir türleri.
Broker adapter entegrasyonu: gerçek broker bağlıysa emir broker üzerinden yönlendirilir.
"""

import time
import uuid
import random
import logging
from dataclasses import asdict, dataclass

from app.core.database import save_order_v2, get_recent_orders_v2, get_trade_stats

logger = logging.getLogger(__name__)


@dataclass
class OrderRecord:
    order_id: str
    symbol: str
    side: str
    quantity: float
    mode: str
    requested_price: float | None
    simulated_fill_price: float
    status: str
    reason: str
    created_at: float
    # V2 alanları
    order_type: str = "market"
    trigger_price: float | None = None
    stop_price: float | None = None
    take_profit_price: float | None = None
    trailing_stop_pct: float | None = None
    spread: float = 0.0
    slippage: float = 0.0
    slippage_pct: float = 0.0
    strategy_type: str = "manual"
    ai_confidence: float | None = None
    ai_signal: str | None = None
    indicators_snapshot: dict | None = None
    notes: str = ""


class ExecutionEngine:
    """
    Paper/Real emir yönlendirme iskeleti V2.
    Spread/slippage simülasyonu, gelişmiş emir türleri desteği.
    Tüm emirler PostgreSQL'e kalıcı olarak kaydedilir.
    Gerçek broker bağlıysa emirler broker API üzerinden iletilir.
    """

    def __init__(self, broker_manager=None):
        self._broker_manager = broker_manager

    @staticmethod
    def calculate_spread(market_price: float) -> float:
        """Bid-Ask spread simülasyonu (BIST ortalama spread)."""
        if market_price <= 0:
            return 0
        # BIST'te spread genellikle %0.05 - %0.3 arası
        spread_pct = random.uniform(0.0005, 0.003)
        return round(market_price * spread_pct, 4)

    @staticmethod
    def calculate_slippage(market_price: float, quantity: float) -> tuple[float, float]:
        """
        Slippage simülasyonu.
        Büyük emirlerde daha yüksek slippage.
        Returns: (slippage_amount, slippage_pct)
        """
        if market_price <= 0:
            return 0, 0
        # Miktar bazlı slippage: lot arttıkça slippage artar
        base_slip = random.uniform(0.0001, 0.002)
        volume_factor = min(quantity / 10000, 0.5)  # Büyük emirlerde ek slippage
        total_slip_pct = base_slip + (volume_factor * 0.001)
        slippage = round(market_price * total_slip_pct, 4)
        return slippage, round(total_slip_pct * 100, 4)

    def get_fill_price(self, side: str, market_price: float, quantity: float) -> tuple[float, float, float, float]:
        """
        Emir dolum fiyatını hesapla (spread + slippage dahil).
        Returns: (fill_price, spread, slippage, slippage_pct)
        """
        spread = self.calculate_spread(market_price)
        slippage, slippage_pct = self.calculate_slippage(market_price, quantity)

        if side == "BUY":
            # Alımda spread + slippage yukarı
            fill_price = market_price + spread / 2 + slippage
        else:
            # Satışta spread + slippage aşağı
            fill_price = market_price - spread / 2 - slippage

        return round(fill_price, 2), spread, slippage, slippage_pct

    async def execute(
        self,
        symbol: str,
        side: str,
        quantity: float,
        mode: str,
        market_price: float,
        requested_price: float | None,
        approved: bool,
        reason: str,
        # V2 parametreler
        order_type: str = "market",
        trigger_price: float | None = None,
        stop_price: float | None = None,
        take_profit_price: float | None = None,
        trailing_stop_pct: float | None = None,
        strategy_type: str = "manual",
        ai_confidence: float | None = None,
        ai_signal: str | None = None,
        indicators_snapshot: dict | None = None,
        notes: str = "",
    ) -> dict:

        # Spread/slippage hesapla
        fill_price, spread, slippage, slippage_pct = self.get_fill_price(side, market_price, quantity)

        order = OrderRecord(
            order_id=f"ord_{uuid.uuid4().hex[:10]}",
            symbol=symbol,
            side=side,
            quantity=round(float(quantity), 4),
            mode=mode,
            requested_price=requested_price,
            simulated_fill_price=fill_price if approved else round(float(market_price), 2),
            status="filled" if approved else "rejected",
            reason=reason,
            created_at=time.time(),
            order_type=order_type,
            trigger_price=trigger_price,
            stop_price=stop_price,
            take_profit_price=take_profit_price,
            trailing_stop_pct=trailing_stop_pct,
            spread=spread,
            slippage=slippage,
            slippage_pct=slippage_pct,
            strategy_type=strategy_type,
            ai_confidence=ai_confidence,
            ai_signal=ai_signal,
            indicators_snapshot=indicators_snapshot,
            notes=notes,
        )

        payload = asdict(order)

        if mode == "real" and approved:
            # Gerçek broker bağlıysa emri broker üzerinden yönlendir
            broker_result = await self._route_through_broker(
                symbol=symbol, side=side, quantity=quantity,
                order_type=order_type, fill_price=fill_price,
                trigger_price=trigger_price, stop_price=stop_price,
            )
            if broker_result:
                payload["broker_execution"] = broker_result
                if broker_result.get("success"):
                    payload["broker_order_id"] = broker_result.get("broker_order_id")
                    payload["broker_fill_price"] = broker_result.get("fill_price")
                    payload["broker_commission"] = broker_result.get("commission")
                    payload["broker_type"] = broker_result.get("broker_type")
                    payload["exchange"] = broker_result.get("exchange")
                    # Gerçek dolum fiyatını güncelle
                    if broker_result.get("fill_price"):
                        payload["simulated_fill_price"] = broker_result["fill_price"]
                else:
                    payload["note"] = f"Broker emir hatası: {broker_result.get('status', 'bilinmiyor')}"
            else:
                payload["note"] = "REAL mode — broker bağlı değil, simülasyon olarak çalıştı."

        # PostgreSQL'e kalıcı kaydet (V2)
        try:
            await save_order_v2(payload)
        except Exception as e:
            payload["db_warning"] = f"DB kayıt hatası: {e}"

        return payload

    async def _route_through_broker(
        self, symbol: str, side: str, quantity: float,
        order_type: str, fill_price: float,
        trigger_price: float | None = None,
        stop_price: float | None = None,
    ) -> dict | None:
        """
        Eğer broker_manager varsa ve gerçek broker bağlıysa,
        emri aktif broker üzerinden çalıştır.
        """
        if not self._broker_manager:
            return None

        try:
            status = await self._broker_manager.get_status()
            if not status.get("connected"):
                return None

            # Paper broker'da gerçek bağlantı yok, direkt None dön
            broker_type = status.get("broker_type", "paper")
            if broker_type == "paper":
                return None

            broker = self._broker_manager.active_broker
            if not broker:
                return None

            result = await broker.place_order(
                symbol=symbol,
                side=side,
                quantity=quantity,
                exchange=status.get("active_exchange", "BIST"),
                order_type=order_type,
                limit_price=fill_price if order_type == "limit" else None,
                stop_price=stop_price,
            )

            return {
                "success": result.success,
                "broker_order_id": result.broker_order_id,
                "fill_price": result.fill_price,
                "commission": result.commission,
                "spread": result.spread,
                "slippage": result.slippage,
                "status": result.status,
                "exchange": result.exchange,
                "broker_type": result.broker_type,
            }
        except Exception as e:
            logger.error(f"Broker emir yönlendirme hatası: {e}")
            return {"success": False, "status": f"error: {e}"}

    async def recent_orders(self, limit: int = 100, **filters) -> list[dict]:
        """PostgreSQL'den filtrelenmiş emirleri getir."""
        try:
            orders, total = await get_recent_orders_v2(limit=limit, **filters)
            return orders
        except Exception as e:
            return [{"error": f"DB okuma hatası: {e}"}]

    async def recent_orders_paged(self, limit: int = 50, offset: int = 0, **filters) -> tuple[list[dict], int]:
        """Sayfalanmış emir geçmişi."""
        try:
            return await get_recent_orders_v2(limit=limit, offset=offset, **filters)
        except Exception as e:
            return [{"error": f"DB okuma hatası: {e}"}], 0

    async def stats(self) -> dict:
        """Trade istatistikleri."""
        try:
            return await get_trade_stats()
        except Exception as e:
            return {"error": f"İstatistik hatası: {e}"}
