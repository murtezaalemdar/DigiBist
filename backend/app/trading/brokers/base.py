"""
Abstract Broker Base — Tüm broker adapter'lar bu sınıfı miras alır.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class Exchange(str, Enum):
    """Desteklenen borsalar."""
    BIST = "BIST"          # Borsa İstanbul
    NYSE = "NYSE"          # New York Stock Exchange
    NASDAQ = "NASDAQ"      # NASDAQ
    # Gelecekte eklenebilir
    LSE = "LSE"            # London Stock Exchange
    XETRA = "XETRA"       # Frankfurt


class BrokerType(str, Enum):
    """Desteklenen broker türleri."""
    PAPER = "paper"
    IBKR = "ibkr"
    MATRIKS = "matriks"
    IS_YATIRIM = "is_yatirim"


@dataclass
class BrokerConnectionStatus:
    """Broker bağlantı durumu."""
    connected: bool = False
    broker_type: str = "paper"
    broker_name: str = "Paper Trading"
    exchange: str = "BIST"
    account_id: str = ""
    balance: float = 0.0
    buying_power: float = 0.0
    currency: str = "TRY"
    message: str = ""
    last_connected: Optional[str] = None
    supported_exchanges: list = field(default_factory=lambda: ["BIST"])
    features: dict = field(default_factory=dict)


@dataclass
class BrokerOrderResult:
    """Broker'dan dönen emir sonucu."""
    success: bool = False
    order_id: str = ""
    broker_order_id: str = ""
    symbol: str = ""
    side: str = ""
    quantity: float = 0
    fill_price: float = 0
    spread: float = 0
    slippage: float = 0
    slippage_pct: float = 0
    commission: float = 0
    commission_currency: str = "TRY"
    status: str = "rejected"
    message: str = ""
    exchange: str = "BIST"
    broker_type: str = "paper"
    raw_response: dict = field(default_factory=dict)


class BrokerBase(ABC):
    """
    Abstract broker adapter.
    Tüm broker implementasyonları bu sınıfı miras alır.
    """

    broker_type: str = "paper"
    broker_name: str = "Base Broker"
    supported_exchanges: list = ["BIST"]

    def __init__(self, config: dict = None):
        self.config = config or {}
        self._connected = False

    @abstractmethod
    async def connect(self) -> BrokerConnectionStatus:
        """Broker'a bağlan ve durumu döndür."""
        ...

    @abstractmethod
    async def disconnect(self) -> bool:
        """Broker bağlantısını kes."""
        ...

    @abstractmethod
    async def get_status(self) -> BrokerConnectionStatus:
        """Mevcut bağlantı durumunu getir."""
        ...

    @abstractmethod
    async def place_order(
        self,
        symbol: str,
        side: str,
        quantity: float,
        exchange: str,
        order_type: str = "market",
        limit_price: Optional[float] = None,
        stop_price: Optional[float] = None,
        take_profit_price: Optional[float] = None,
        trailing_stop_pct: Optional[float] = None,
    ) -> BrokerOrderResult:
        """Emir gönder."""
        ...

    @abstractmethod
    async def cancel_order(self, broker_order_id: str) -> bool:
        """Emir iptal et."""
        ...

    @abstractmethod
    async def get_positions(self) -> list[dict]:
        """Açık pozisyonları getir."""
        ...

    @abstractmethod
    async def get_account_info(self) -> dict:
        """Hesap bilgilerini getir."""
        ...

    @abstractmethod
    async def get_live_price(self, symbol: str, exchange: str) -> Optional[float]:
        """Anlık fiyat getir (broker API üzerinden)."""
        ...

    def format_symbol(self, symbol: str, exchange: str) -> str:
        """Sembol formatını broker'a göre ayarla."""
        return symbol

    @property
    def is_connected(self) -> bool:
        return self._connected
