"""
Matriks IQ Broker Adapter — Matriks API üzerinden BIST işlemleri.

Matriks IQ API Entegrasyonu:
  - Gerçek zamanlı BIST veri akışı
  - Emir gönderme/iptal
  - Portföy/pozisyon sorgulama

Kurulum:
  1. Matriks IQ hesabı oluştur (https://www.matriksdata.com/)
  2. API Key ve Secret al
  3. Ayarlar sayfasından API bilgilerini gir

Not: Matriks API endpoint'leri ve authentication detayları
     Matriks IQ dokümantasyonuna göre doldurulmalıdır.
"""

import logging
import httpx
from typing import Optional

from .base import BrokerBase, BrokerConnectionStatus, BrokerOrderResult

logger = logging.getLogger(__name__)

# Matriks IQ API Base URL (resmi endpoint)
MATRIKS_API_BASE = "https://api.matriksdata.com"
MATRIKS_WS_URL = "wss://stream.matriksdata.com"


class MatriksBroker(BrokerBase):
    broker_type = "matriks"
    broker_name = "Matriks IQ"
    supported_exchanges = ["BIST"]

    def __init__(self, config: dict = None):
        super().__init__(config)
        self._api_key = config.get("api_key", "") if config else ""
        self._api_secret = config.get("api_secret", "") if config else ""
        self._base_url = config.get("base_url", MATRIKS_API_BASE) if config else MATRIKS_API_BASE
        self._access_token = None
        self._account_id = ""

    async def _authenticate(self) -> bool:
        """Matriks API authentication."""
        if not self._api_key or not self._api_secret:
            logger.error("Matriks API key/secret eksik.")
            return False
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    f"{self._base_url}/v1/auth/token",
                    json={
                        "api_key": self._api_key,
                        "api_secret": self._api_secret,
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    self._access_token = data.get("access_token")
                    self._account_id = data.get("account_id", "")
                    return True
                else:
                    logger.error(f"Matriks auth hatası: {resp.status_code} — {resp.text}")
                    return False
        except Exception as e:
            logger.error(f"Matriks auth exception: {e}")
            return False

    def _headers(self) -> dict:
        """API istekleri için header."""
        return {
            "Authorization": f"Bearer {self._access_token}",
            "Content-Type": "application/json",
            "X-API-Key": self._api_key,
        }

    async def connect(self) -> BrokerConnectionStatus:
        if not self._api_key:
            return BrokerConnectionStatus(
                connected=False,
                broker_type=self.broker_type,
                broker_name=self.broker_name,
                message="Matriks API Key girilmedi. Ayarlar sayfasından API bilgilerinizi girin.",
                supported_exchanges=self.supported_exchanges,
            )

        authenticated = await self._authenticate()
        if not authenticated:
            return BrokerConnectionStatus(
                connected=False,
                broker_type=self.broker_type,
                broker_name=self.broker_name,
                message="Matriks kimlik doğrulama başarısız. API key/secret kontrol edin.",
                supported_exchanges=self.supported_exchanges,
            )

        self._connected = True

        # Hesap bilgilerini çek
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
            message=f"Matriks IQ bağlantısı başarılı. Hesap: {self._account_id}",
            supported_exchanges=self.supported_exchanges,
            features={
                "real_orders": True,
                "live_data": True,
                "margin": False,
                "short_selling": False,  # BIST'te açığa satış kısıtlı
                "options": False,
            },
        )

    async def disconnect(self) -> bool:
        self._connected = False
        self._access_token = None
        return True

    async def get_status(self) -> BrokerConnectionStatus:
        if self._connected and self._access_token:
            return BrokerConnectionStatus(
                connected=True,
                broker_type=self.broker_type,
                broker_name=self.broker_name,
                account_id=self._account_id,
                message="Matriks IQ bağlı.",
                supported_exchanges=self.supported_exchanges,
            )
        return BrokerConnectionStatus(
            connected=False,
            broker_type=self.broker_type,
            broker_name=self.broker_name,
            message="Matriks IQ bağlı değil.",
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
        if not self._connected or not self._access_token:
            return BrokerOrderResult(
                success=False,
                symbol=symbol,
                side=side,
                quantity=quantity,
                status="rejected",
                message="Matriks bağlı değil. Önce bağlantı kurun.",
                exchange="BIST",
                broker_type=self.broker_type,
            )

        try:
            # Matriks emir payload
            order_payload = {
                "symbol": symbol,
                "side": side.upper(),
                "quantity": int(quantity),  # BIST'te lot bazlı
                "order_type": order_type,
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
                        message=f"Matriks emri gönderildi: {data.get('status', 'submitted')}",
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
                        message=f"Matriks emir hatası: {resp.status_code} — {resp.text}",
                        exchange="BIST",
                        broker_type=self.broker_type,
                    )
        except Exception as e:
            logger.error(f"Matriks emir exception: {e}")
            return BrokerOrderResult(
                success=False,
                symbol=symbol,
                side=side,
                quantity=quantity,
                status="error",
                message=f"Matriks emir hatası: {str(e)}",
                exchange="BIST",
                broker_type=self.broker_type,
            )

    async def cancel_order(self, broker_order_id: str) -> bool:
        if not self._connected or not self._access_token:
            return False
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.delete(
                    f"{self._base_url}/v1/orders/{broker_order_id}",
                    headers=self._headers(),
                )
                return resp.status_code in (200, 204)
        except Exception as e:
            logger.error(f"Matriks iptal hatası: {e}")
            return False

    async def get_positions(self) -> list[dict]:
        if not self._connected or not self._access_token:
            return []
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{self._base_url}/v1/portfolio/positions",
                    headers=self._headers(),
                )
                if resp.status_code == 200:
                    return resp.json().get("positions", [])
        except Exception as e:
            logger.error(f"Matriks pozisyon hatası: {e}")
        return []

    async def get_account_info(self) -> dict:
        if not self._connected or not self._access_token:
            return {"error": "Matriks bağlı değil."}
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{self._base_url}/v1/account",
                    headers=self._headers(),
                )
                if resp.status_code == 200:
                    return resp.json()
        except Exception as e:
            logger.error(f"Matriks hesap hatası: {e}")
        return {"balance": 0, "buying_power": 0}

    async def get_live_price(self, symbol: str, exchange: str = "BIST") -> Optional[float]:
        if not self._connected or not self._access_token:
            return None
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(
                    f"{self._base_url}/v1/market/quote/{symbol}",
                    headers=self._headers(),
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return float(data.get("last_price", 0))
        except Exception as e:
            logger.error(f"Matriks fiyat hatası: {e}")
        return None
