"""
Broker Manager — Broker seçimi, yaşam döngüsü ve konfigürasyon yönetimi.
"""

import logging
from typing import Optional
from dataclasses import asdict

from .base import BrokerBase, BrokerConnectionStatus, BrokerType
from .paper_broker import PaperBroker
from .ibkr_broker import IBKRBroker
from .matriks_broker import MatriksBroker
from .is_yatirim_broker import IsYatirimBroker

logger = logging.getLogger(__name__)

# Broker sınıf haritası
BROKER_REGISTRY = {
    "paper": PaperBroker,
    "ibkr": IBKRBroker,
    "matriks": MatriksBroker,
    "is_yatirim": IsYatirimBroker,
}

# Broker bilgileri (UI için)
BROKER_INFO = {
    "paper": {
        "name": "Paper Trading (Simülasyon)",
        "description": "Gerçek para riski olmadan simülasyon modunda işlem yapın.",
        "exchanges": ["BIST", "NYSE", "NASDAQ"],
        "requires_api_key": False,
        "config_fields": [
            {"key": "initial_balance", "label": "Başlangıç Bakiyesi", "type": "number", "default": 250000},
            {"key": "currency", "label": "Para Birimi", "type": "select", "options": ["TRY", "USD"], "default": "TRY"},
        ],
    },
    "ibkr": {
        "name": "Interactive Brokers (IBKR)",
        "description": "TWS/Gateway üzerinden BIST ve ABD borsalarına erişim. Gerçek emir gönderme.",
        "exchanges": ["BIST", "NYSE", "NASDAQ"],
        "requires_api_key": False,  # IBKR TWS API bağlantısı, API key yerine host/port kullanır
        "config_fields": [
            {"key": "host", "label": "TWS/Gateway Host", "type": "text", "default": "127.0.0.1"},
            {"key": "port", "label": "TWS/Gateway Port", "type": "number", "default": 7497, "hint": "7497=Paper, 7496=Live"},
            {"key": "client_id", "label": "Client ID", "type": "number", "default": 1},
            {"key": "account", "label": "Hesap No (opsiyonel)", "type": "text", "default": ""},
        ],
    },
    "matriks": {
        "name": "Matriks IQ",
        "description": "Matriks IQ API ile BIST üzerinde gerçek zamanlı veri ve emir gönderme.",
        "exchanges": ["BIST"],
        "requires_api_key": True,
        "config_fields": [
            {"key": "api_key", "label": "API Key", "type": "password", "default": ""},
            {"key": "api_secret", "label": "API Secret", "type": "password", "default": ""},
            {"key": "base_url", "label": "API Base URL", "type": "text", "default": "https://api.matriksdata.com"},
        ],
    },
    "is_yatirim": {
        "name": "İş Yatırım",
        "description": "İş Yatırım Trader API ile BIST üzerinde emir gönderme.",
        "exchanges": ["BIST"],
        "requires_api_key": True,
        "config_fields": [
            {"key": "api_key", "label": "API Key", "type": "password", "default": ""},
            {"key": "api_secret", "label": "API Secret", "type": "password", "default": ""},
            {"key": "username", "label": "Kullanıcı Adı", "type": "text", "default": ""},
            {"key": "base_url", "label": "API Base URL", "type": "text", "default": "https://api.isyatirim.com.tr"},
        ],
    },
}


class BrokerManager:
    """
    Merkezi broker yöneticisi.
    Aktif broker'ı tutar, bağlantı/kopuş yönetir.
    """

    def __init__(self):
        self._active_broker: Optional[BrokerBase] = None
        self._active_broker_type: str = "paper"
        self._active_exchange: str = "BIST"
        self._broker_configs: dict = {}  # broker_type → config dict

    @property
    def active_broker(self) -> Optional[BrokerBase]:
        return self._active_broker

    @property
    def active_broker_type(self) -> str:
        return self._active_broker_type

    @property
    def active_exchange(self) -> str:
        return self._active_exchange

    def set_exchange(self, exchange: str):
        """Aktif borsayı değiştir."""
        self._active_exchange = exchange

    def get_broker_info(self) -> list[dict]:
        """Tüm desteklenen broker'ların bilgilerini döndür (UI için)."""
        return [
            {"broker_type": bt, **info}
            for bt, info in BROKER_INFO.items()
        ]

    def get_broker_config_fields(self, broker_type: str) -> list[dict]:
        """Belirli bir broker'ın konfigürasyon alanlarını döndür."""
        info = BROKER_INFO.get(broker_type, {})
        return info.get("config_fields", [])

    def set_broker_config(self, broker_type: str, config: dict):
        """Broker konfigürasyonunu ayarla (API key, host, vb.)."""
        self._broker_configs[broker_type] = config
        logger.info(f"Broker config güncellendi: {broker_type}")

    def get_broker_config(self, broker_type: str) -> dict:
        """Mevcut broker konfigürasyonunu döndür."""
        return self._broker_configs.get(broker_type, {})

    async def switch_broker(self, broker_type: str, exchange: str = None) -> BrokerConnectionStatus:
        """
        Aktif broker'ı değiştir.
        Mevcut bağlantıyı kes, yeni broker'a bağlan.
        """
        # Mevcut broker'ı kapat
        if self._active_broker:
            try:
                await self._active_broker.disconnect()
            except Exception as e:
                logger.warning(f"Mevcut broker kapatma hatası: {e}")

        # Yeni broker oluştur
        broker_class = BROKER_REGISTRY.get(broker_type)
        if not broker_class:
            return BrokerConnectionStatus(
                connected=False,
                broker_type=broker_type,
                message=f"Desteklenmeyen broker türü: {broker_type}",
            )

        config = self._broker_configs.get(broker_type, {})
        self._active_broker = broker_class(config)
        self._active_broker_type = broker_type

        if exchange:
            self._active_exchange = exchange

        # Bağlan
        status = await self._active_broker.connect()
        return status

    async def get_status(self) -> dict:
        """Mevcut broker durumunu JSON-serializable dict olarak döndür."""
        if self._active_broker:
            status = await self._active_broker.get_status()
        else:
            status = BrokerConnectionStatus(
                connected=False,
                broker_type="paper",
                broker_name="Broker seçilmedi",
                message="Hiçbir broker bağlı değil. Ayarlardan bir broker seçin.",
            )
        result = asdict(status)
        result["active_exchange"] = self._active_exchange
        result["available_brokers"] = list(BROKER_REGISTRY.keys())
        return result

    async def disconnect_current(self) -> bool:
        """Mevcut broker bağlantısını kes."""
        if self._active_broker:
            result = await self._active_broker.disconnect()
            self._active_broker = None
            self._active_broker_type = "paper"
            return result
        return True

    async def initialize_default(self):
        """Başlangıçta paper broker'ı varsayılan olarak aktifle."""
        if not self._active_broker:
            await self.switch_broker("paper")
            logger.info("Varsayılan Paper broker aktifleştirildi.")
