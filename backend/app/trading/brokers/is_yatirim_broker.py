"""
İş Yatırım Trader API Adapter — İş Yatırım REST API üzerinden BIST işlemleri.

İş Yatırım Trader API Entegrasyonu:
  - BIST hisse senedi alım/satım
  - Portföy sorgulama
  - Emir durumu takibi

Kurulum:
  1. İş Yatırım hesabı oluştur (https://www.isyatirim.com.tr/)
  2. Trader API erişimi için başvur
  3. API Key ve şifre al
  4. Ayarlar sayfasından API bilgilerini gir

Not: İş Yatırım API endpoint'leri ve authentication detayları
     resmi İş Yatırım Trader API dokümantasyonuna göre ayarlanmalıdır.
"""

import logging
import hashlib
import hmac
import time
import httpx
from typing import Optional

from .base import BrokerBase, BrokerConnectionStatus, BrokerOrderResult

logger = logging.getLogger(__name__)

# İş Yatırım API Base URL
IS_YATIRIM_API_BASE = "https://api.isyatirim.com.tr"


class IsYatirimBroker(BrokerBase):
    broker_type = "is_yatirim"
    broker_name = "İş Yatırım"
    supported_exchanges = ["BIST"]

    def __init__(self, config: dict = None):
        super().__init__(config)
        self._api_key = config.get("api_key", "") if config else ""
        self._api_secret = config.get("api_secret", "") if config else ""
        self._username = config.get("username", "") if config else ""
        self._base_url = config.get("base_url", IS_YATIRIM_API_BASE) if config else IS_YATIRIM_API_BASE
        self._session_token = None
        self._account_id = ""

    def _sign_request(self, payload: str) -> str:
        """HMAC-SHA256 imzalama."""
        return hmac.new(
            self._api_secret.encode("utf-8"),
            payload.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

    def _headers(self) -> dict:
        """API istekleri için header."""
        timestamp = str(int(time.time() * 1000))
        signature = self._sign_request(timestamp)
        return {
            "Authorization": f"Bearer {self._session_token}",
            "X-API-Key": self._api_key,
            "X-Timestamp": timestamp,
            "X-Signature": signature,
            "Content-Type": "application/json",
        }

    async def connect(self) -> BrokerConnectionStatus:
        if not self._api_key or not self._api_secret:
            return BrokerConnectionStatus(
                connected=False,
                broker_type=self.broker_type,
                broker_name=self.broker_name,
                message="İş Yatırım API Key/Secret girilmedi. Ayarlar sayfasından bilgilerinizi girin.",
                supported_exchanges=self.supported_exchanges,
            )

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    f"{self._base_url}/v1/auth/login",
                    json={
                        "api_key": self._api_key,
                        "api_secret": self._api_secret,
                        "username": self._username,
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    self._session_token = data.get("session_token")
                    self._account_id = data.get("account_id", "")
                    self._connected = True

                    account_info = await self.get_account_info()
                    balance = account_info.get("balance", 0)
                    buying_power = account_info.get("buying_power", 0)

                    return BrokerConnectionStatus(
                        connected=True,
                        broker_type=self.broker_type,
                        broker_name=self.broker_name,
                        exchange="BIST",
                        account_id=self._account_id,
                        balance=balance,
                        buying_power=buying_power,
                        currency="TRY",
                        message=f"İş Yatırım bağlantısı başarılı. Hesap: {self._account_id}",
                        supported_exchanges=self.supported_exchanges,
                        features={
                            "real_orders": True,
                            "live_data": True,
                            "margin": True,
                            "short_selling": False,
                            "options": False,
                        },
                    )
                else:
                    return BrokerConnectionStatus(
                        connected=False,
                        broker_type=self.broker_type,
                        broker_name=self.broker_name,
                        message=f"İş Yatırım giriş hatası: {resp.status_code} — {resp.text}",
                        supported_exchanges=self.supported_exchanges,
                    )
        except Exception as e:
            logger.error(f"İş Yatırım bağlantı hatası: {e}")
            return BrokerConnectionStatus(
                connected=False,
                broker_type=self.broker_type,
                broker_name=self.broker_name,
                message=f"İş Yatırım bağlantı hatası: {str(e)}",
                supported_exchanges=self.supported_exchanges,
            )

    async def disconnect(self) -> bool:
        self._connected = False
        self._session_token = None
        return True

    async def get_status(self) -> BrokerConnectionStatus:
        if self._connected and self._session_token:
            return BrokerConnectionStatus(
                connected=True,
                broker_type=self.broker_type,
                broker_name=self.broker_name,
                account_id=self._account_id,
                message="İş Yatırım bağlı.",
                supported_exchanges=self.supported_exchanges,
            )
        return BrokerConnectionStatus(
            connected=False,
            broker_type=self.broker_type,
            broker_name=self.broker_name,
            message="İş Yatırım bağlı değil.",
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
        if not self._connected or not self._session_token:
            return BrokerOrderResult(
                success=False,
                symbol=symbol,
                side=side,
                quantity=quantity,
                status="rejected",
                message="İş Yatırım bağlı değil. Önce bağlantı kurun.",
                exchange="BIST",
                broker_type=self.broker_type,
            )

        try:
            order_payload = {
                "symbol": symbol,
                "side": "A" if side.upper() == "BUY" else "S",  # İş Yatırım: A=Alış, S=Satış
                "quantity": int(quantity),
                "order_type": "piyasa" if order_type == "market" else "limit",
            }
            if order_type == "limit" and limit_price:
                order_payload["price"] = limit_price
            if stop_price:
                order_payload["stop_price"] = stop_price

            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    f"{self._base_url}/v1/orders",
                    headers=self._headers(),
                    json=order_payload,
                )

                if resp.status_code in (200, 201):
                    data = resp.json()
                    return BrokerOrderResult(
                        success=True,
                        order_id=data.get("order_id", ""),
                        broker_order_id=data.get("order_id", ""),
                        symbol=symbol,
                        side=side,
                        quantity=quantity,
                        fill_price=data.get("fill_price", 0),
                        commission=data.get("commission", 0),
                        commission_currency="TRY",
                        status=data.get("status", "submitted"),
                        message=f"İş Yatırım emri gönderildi: {data.get('status', 'submitted')}",
                        exchange="BIST",
                        broker_type=self.broker_type,
                        raw_response=data,
                    )
                else:
                    return BrokerOrderResult(
                        success=False,
                        symbol=symbol,
                        side=side,
                        quantity=quantity,
                        status="rejected",
                        message=f"İş Yatırım emir hatası: {resp.status_code} — {resp.text}",
                        exchange="BIST",
                        broker_type=self.broker_type,
                    )
        except Exception as e:
            logger.error(f"İş Yatırım emir exception: {e}")
            return BrokerOrderResult(
                success=False,
                symbol=symbol,
                side=side,
                quantity=quantity,
                status="error",
                message=f"İş Yatırım emir hatası: {str(e)}",
                exchange="BIST",
                broker_type=self.broker_type,
            )

    async def cancel_order(self, broker_order_id: str) -> bool:
        if not self._connected or not self._session_token:
            return False
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.delete(
                    f"{self._base_url}/v1/orders/{broker_order_id}",
                    headers=self._headers(),
                )
                return resp.status_code in (200, 204)
        except Exception as e:
            logger.error(f"İş Yatırım iptal hatası: {e}")
            return False

    async def get_positions(self) -> list[dict]:
        if not self._connected or not self._session_token:
            return []
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{self._base_url}/v1/portfolio",
                    headers=self._headers(),
                )
                if resp.status_code == 200:
                    return resp.json().get("positions", [])
        except Exception as e:
            logger.error(f"İş Yatırım pozisyon hatası: {e}")
        return []

    async def get_account_info(self) -> dict:
        if not self._connected or not self._session_token:
            return {"error": "İş Yatırım bağlı değil."}
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{self._base_url}/v1/account",
                    headers=self._headers(),
                )
                if resp.status_code == 200:
                    return resp.json()
        except Exception as e:
            logger.error(f"İş Yatırım hesap hatası: {e}")
        return {"balance": 0, "buying_power": 0}

    async def get_live_price(self, symbol: str, exchange: str = "BIST") -> Optional[float]:
        if not self._connected or not self._session_token:
            return None
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(
                    f"{self._base_url}/v1/market/quote/{symbol}",
                    headers=self._headers(),
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return float(data.get("last", 0))
        except Exception as e:
            logger.error(f"İş Yatırım fiyat hatası: {e}")
        return None
