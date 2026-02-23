"""
Paper Broker — Simülasyon modu (mevcut davranış).
Gerçek emir gönderme yapmaz, spread/slippage simüle eder.
"""

import random
import uuid
from typing import Optional

from .base import BrokerBase, BrokerConnectionStatus, BrokerOrderResult


class PaperBroker(BrokerBase):
    broker_type = "paper"
    broker_name = "Paper Trading (Simülasyon)"
    supported_exchanges = ["BIST", "NYSE", "NASDAQ"]

    def __init__(self, config: dict = None):
        super().__init__(config)
        self._balance = config.get("initial_balance", 250000) if config else 250000
        self._currency = config.get("currency", "TRY") if config else "TRY"
        self._positions = {}

    async def connect(self) -> BrokerConnectionStatus:
        self._connected = True
        return BrokerConnectionStatus(
            connected=True,
            broker_type=self.broker_type,
            broker_name=self.broker_name,
            exchange="BIST",
            account_id="PAPER_SIM",
            balance=self._balance,
            buying_power=self._balance,
            currency=self._currency,
            message="Paper trading simülasyonu aktif.",
            supported_exchanges=self.supported_exchanges,
            features={
                "real_orders": False,
                "live_data": False,
                "margin": False,
                "short_selling": True,
                "options": False,
            },
        )

    async def disconnect(self) -> bool:
        self._connected = False
        return True

    async def get_status(self) -> BrokerConnectionStatus:
        return BrokerConnectionStatus(
            connected=self._connected,
            broker_type=self.broker_type,
            broker_name=self.broker_name,
            exchange="BIST",
            account_id="PAPER_SIM",
            balance=self._balance,
            buying_power=self._balance,
            currency=self._currency,
            message="Paper trading simülasyonu aktif." if self._connected else "Bağlı değil.",
            supported_exchanges=self.supported_exchanges,
        )

    async def place_order(
        self,
        symbol: str,
        side: str,
        quantity: float,
        exchange: str = "BIST",
        order_type: str = "market",
        limit_price: Optional[float] = None,
        stop_price: Optional[float] = None,
        take_profit_price: Optional[float] = None,
        trailing_stop_pct: Optional[float] = None,
    ) -> BrokerOrderResult:
        """Paper emir — simülasyon. market_price dışarıdan set edilmelidir."""
        # Paper mode'da emir her zaman başarılı (market_price execution engine tarafından sağlanır)
        order_id = f"paper_{uuid.uuid4().hex[:10]}"
        return BrokerOrderResult(
            success=True,
            order_id=order_id,
            broker_order_id=order_id,
            symbol=symbol,
            side=side,
            quantity=quantity,
            fill_price=0,  # Execution engine dolduracak
            status="filled",
            message="Paper simülasyon emri başarılı.",
            exchange=exchange,
            broker_type=self.broker_type,
        )

    async def cancel_order(self, broker_order_id: str) -> bool:
        return True

    async def get_positions(self) -> list[dict]:
        return [
            {"symbol": sym, "quantity": qty, "exchange": "BIST"}
            for sym, qty in self._positions.items()
        ]

    async def get_account_info(self) -> dict:
        return {
            "account_id": "PAPER_SIM",
            "balance": self._balance,
            "buying_power": self._balance,
            "currency": self._currency,
            "positions": len(self._positions),
        }

    async def get_live_price(self, symbol: str, exchange: str = "BIST") -> Optional[float]:
        # Paper broker canlı fiyat sağlamaz, None döner → yfinance fallback
        return None
