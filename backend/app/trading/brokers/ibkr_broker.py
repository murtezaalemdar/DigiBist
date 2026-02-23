"""
Interactive Brokers (IBKR) Adapter — TWS/Gateway API üzerinden gerçek emir.
Gereksinim: ib_insync paketi ve TWS veya IB Gateway çalışıyor olmalı.

Kurulum:
  1. pip install ib_insync
  2. TWS veya IB Gateway'i başlat (varsayılan port: 7497 paper, 7496 live)
  3. API Settings'te "Enable ActiveX and Socket Clients" açık olmalı
  4. Trusted IP'ye Python backend IP'sini ekle

BIST erişimi: IBKR hesabında "Borsa İstanbul" izni açık olmalı.
ABD borsaları: NYSE, NASDAQ varsayılan olarak aktif.
"""

import logging
from typing import Optional

from .base import BrokerBase, BrokerConnectionStatus, BrokerOrderResult

logger = logging.getLogger(__name__)

# ib_insync lazy import — paket yüklü değilse hata vermesin
try:
    from ib_insync import IB, Stock, MarketOrder, LimitOrder, StopOrder, Trade
    IB_AVAILABLE = True
except ImportError:
    IB_AVAILABLE = False
    logger.warning("ib_insync paketi yüklü değil. IBKR entegrasyonu devre dışı.")


# Borsa → IBKR Exchange mapping
EXCHANGE_MAP = {
    "BIST": "BIST",       # Borsa İstanbul
    "NYSE": "NYSE",
    "NASDAQ": "NASDAQ",
    "LSE": "LSE",
    "XETRA": "XETRA",
}

# Borsa → Para birimi
CURRENCY_MAP = {
    "BIST": "TRY",
    "NYSE": "USD",
    "NASDAQ": "USD",
    "LSE": "GBP",
    "XETRA": "EUR",
}


class IBKRBroker(BrokerBase):
    broker_type = "ibkr"
    broker_name = "Interactive Brokers (IBKR)"
    supported_exchanges = ["BIST", "NYSE", "NASDAQ"]

    def __init__(self, config: dict = None):
        super().__init__(config)
        self._ib = None
        self._host = config.get("host", "127.0.0.1") if config else "127.0.0.1"
        self._port = int(config.get("port", 7497) if config else 7497)
        self._client_id = int(config.get("client_id", 1) if config else 1)
        self._account = config.get("account", "") if config else ""

    async def connect(self) -> BrokerConnectionStatus:
        if not IB_AVAILABLE:
            return BrokerConnectionStatus(
                connected=False,
                broker_type=self.broker_type,
                broker_name=self.broker_name,
                message="ib_insync paketi yüklü değil. 'pip install ib_insync' çalıştırın.",
                supported_exchanges=self.supported_exchanges,
            )

        try:
            self._ib = IB()
            # IB bağlantısı (sync — ib_insync kendi event loop'unu yönetir)
            self._ib.connect(
                host=self._host,
                port=self._port,
                clientId=self._client_id,
                timeout=10,
            )
            self._connected = True
            account_values = self._ib.accountSummary()
            balance = 0
            buying_power = 0
            currency = "USD"
            for av in account_values:
                if av.tag == "TotalCashValue" and av.currency == "BASE":
                    balance = float(av.value)
                if av.tag == "BuyingPower":
                    buying_power = float(av.value)

            self._account = self._ib.managedAccounts()[0] if self._ib.managedAccounts() else ""

            return BrokerConnectionStatus(
                connected=True,
                broker_type=self.broker_type,
                broker_name=self.broker_name,
                exchange="BIST",
                account_id=self._account,
                balance=balance,
                buying_power=buying_power,
                currency=currency,
                message=f"IBKR bağlantısı başarılı. Hesap: {self._account}",
                supported_exchanges=self.supported_exchanges,
                features={
                    "real_orders": True,
                    "live_data": True,
                    "margin": True,
                    "short_selling": True,
                    "options": True,
                },
            )
        except Exception as e:
            self._connected = False
            logger.error(f"IBKR bağlantı hatası: {e}")
            return BrokerConnectionStatus(
                connected=False,
                broker_type=self.broker_type,
                broker_name=self.broker_name,
                message=f"IBKR bağlantı hatası: {str(e)}. TWS/Gateway çalışıyor mu?",
                supported_exchanges=self.supported_exchanges,
            )

    async def disconnect(self) -> bool:
        if self._ib and self._ib.isConnected():
            self._ib.disconnect()
        self._connected = False
        return True

    async def get_status(self) -> BrokerConnectionStatus:
        if self._ib and self._ib.isConnected():
            return BrokerConnectionStatus(
                connected=True,
                broker_type=self.broker_type,
                broker_name=self.broker_name,
                account_id=self._account,
                message="IBKR bağlı.",
                supported_exchanges=self.supported_exchanges,
            )
        self._connected = False
        return BrokerConnectionStatus(
            connected=False,
            broker_type=self.broker_type,
            broker_name=self.broker_name,
            message="IBKR bağlı değil.",
            supported_exchanges=self.supported_exchanges,
        )

    def _make_contract(self, symbol: str, exchange: str):
        """IBKR contract oluştur."""
        ibkr_exchange = EXCHANGE_MAP.get(exchange, "SMART")
        currency = CURRENCY_MAP.get(exchange, "USD")
        # BIST hisseleri için özel format
        if exchange == "BIST":
            return Stock(symbol, "BIST", "TRY")
        return Stock(symbol, "SMART", currency, primaryExchange=ibkr_exchange)

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
        if not self._ib or not self._ib.isConnected():
            return BrokerOrderResult(
                success=False,
                symbol=symbol,
                side=side,
                quantity=quantity,
                status="rejected",
                message="IBKR bağlı değil. Önce bağlantı kurun.",
                exchange=exchange,
                broker_type=self.broker_type,
            )

        try:
            contract = self._make_contract(symbol, exchange)
            action = "BUY" if side.upper() == "BUY" else "SELL"

            # Emir türüne göre IB order oluştur
            if order_type == "market":
                ib_order = MarketOrder(action, quantity)
            elif order_type == "limit" and limit_price:
                ib_order = LimitOrder(action, quantity, limit_price)
            elif order_type in ("stop_loss", "stop") and stop_price:
                ib_order = StopOrder(action, quantity, stop_price)
            elif order_type == "take_profit" and take_profit_price:
                ib_order = LimitOrder(action, quantity, take_profit_price)
            else:
                ib_order = MarketOrder(action, quantity)

            trade: Trade = self._ib.placeOrder(contract, ib_order)
            self._ib.sleep(1)  # Kısa bekleme (fill onayı)

            fill_price = 0
            commission = 0
            status = "submitted"
            if trade.orderStatus.status == "Filled":
                fill_price = trade.orderStatus.avgFillPrice
                status = "filled"
            elif trade.orderStatus.status in ("PreSubmitted", "Submitted"):
                status = "pending"
            else:
                status = trade.orderStatus.status.lower()

            if trade.fills:
                commission = sum(f.commissionReport.commission for f in trade.fills if f.commissionReport)

            return BrokerOrderResult(
                success=True,
                order_id=str(trade.order.orderId),
                broker_order_id=str(trade.order.orderId),
                symbol=symbol,
                side=side,
                quantity=quantity,
                fill_price=fill_price,
                commission=commission,
                commission_currency=CURRENCY_MAP.get(exchange, "USD"),
                status=status,
                message=f"IBKR emri gönderildi. Durum: {status}",
                exchange=exchange,
                broker_type=self.broker_type,
                raw_response={"ib_status": trade.orderStatus.status},
            )
        except Exception as e:
            logger.error(f"IBKR emir hatası: {e}")
            return BrokerOrderResult(
                success=False,
                symbol=symbol,
                side=side,
                quantity=quantity,
                status="error",
                message=f"IBKR emir hatası: {str(e)}",
                exchange=exchange,
                broker_type=self.broker_type,
            )

    async def cancel_order(self, broker_order_id: str) -> bool:
        if not self._ib or not self._ib.isConnected():
            return False
        try:
            for trade in self._ib.openTrades():
                if str(trade.order.orderId) == broker_order_id:
                    self._ib.cancelOrder(trade.order)
                    return True
            return False
        except Exception as e:
            logger.error(f"IBKR iptal hatası: {e}")
            return False

    async def get_positions(self) -> list[dict]:
        if not self._ib or not self._ib.isConnected():
            return []
        try:
            positions = self._ib.positions()
            return [
                {
                    "symbol": pos.contract.symbol,
                    "quantity": float(pos.position),
                    "avg_cost": float(pos.avgCost),
                    "exchange": pos.contract.exchange or "SMART",
                    "currency": pos.contract.currency,
                }
                for pos in positions
            ]
        except Exception as e:
            logger.error(f"IBKR pozisyon hatası: {e}")
            return []

    async def get_account_info(self) -> dict:
        if not self._ib or not self._ib.isConnected():
            return {"error": "IBKR bağlı değil."}
        try:
            summary = self._ib.accountSummary()
            info = {"account_id": self._account}
            for av in summary:
                if av.tag in ("TotalCashValue", "BuyingPower", "NetLiquidation", "GrossPositionValue"):
                    info[av.tag] = float(av.value)
            return info
        except Exception as e:
            return {"error": str(e)}

    async def get_live_price(self, symbol: str, exchange: str = "BIST") -> Optional[float]:
        if not self._ib or not self._ib.isConnected():
            return None
        try:
            contract = self._make_contract(symbol, exchange)
            self._ib.qualifyContracts(contract)
            ticker = self._ib.reqMktData(contract, "", False, False)
            self._ib.sleep(2)
            price = ticker.marketPrice()
            self._ib.cancelMktData(contract)
            return float(price) if price and price > 0 else None
        except Exception as e:
            logger.error(f"IBKR fiyat hatası: {e}")
            return None
