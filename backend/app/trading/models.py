from pydantic import BaseModel, Field
from typing import Literal, Optional
from enum import Enum


# ─── Enums ───
Side = Literal["BUY", "SELL"]
Mode = Literal["paper", "real"]


class OrderType(str, Enum):
    MARKET = "market"
    LIMIT = "limit"
    STOP_LOSS = "stop_loss"
    TAKE_PROFIT = "take_profit"
    TRAILING_STOP = "trailing_stop"


class StrategyType(str, Enum):
    MANUAL = "manual"
    AI_ONLY = "ai_only"
    INDICATOR = "indicator"
    HYBRID = "hybrid"


class ConditionalOrderStatus(str, Enum):
    PENDING = "pending"
    TRIGGERED = "triggered"
    FILLED = "filled"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


# ─── Manuel Emir İsteği ───
class ManualOrderRequest(BaseModel):
    symbol: str = Field(..., min_length=2, max_length=10)
    side: Side
    quantity: float = Field(..., gt=0)
    mode: Mode = "paper"
    price: Optional[float] = Field(default=None, gt=0)
    portfolio_value: float = Field(default=250000, gt=0)
    order_type: OrderType = OrderType.MARKET
    trigger_price: Optional[float] = Field(default=None, description="Limit/Stop tetikleme fiyatı")
    stop_price: Optional[float] = Field(default=None, description="Stop-loss fiyatı")
    take_profit_price: Optional[float] = Field(default=None, description="Take-profit fiyatı")
    trailing_stop_pct: Optional[float] = Field(default=None, ge=0.1, le=50, description="Trailing stop yüzdesi")
    strategy_type: StrategyType = StrategyType.MANUAL
    notes: str = ""


# ─── Koşullu Emir İsteği ───
class ConditionalOrderRequest(BaseModel):
    symbol: str = Field(..., min_length=2, max_length=10)
    side: Side
    quantity: float = Field(..., gt=0)
    mode: Mode = "paper"
    order_type: OrderType
    trigger_price: Optional[float] = Field(default=None)
    limit_price: Optional[float] = Field(default=None)
    stop_price: Optional[float] = Field(default=None)
    take_profit_price: Optional[float] = Field(default=None)
    trailing_stop_pct: Optional[float] = Field(default=None, ge=0.1, le=50)
    strategy_type: StrategyType = StrategyType.MANUAL
    notes: str = ""
    expires_hours: Optional[int] = Field(default=None, ge=1, le=720, description="Saat olarak son kullanma")


# ─── Otomatik Trade Konfigürasyonu ───
class AutoTradeConfig(BaseModel):
    symbols: list[str] = Field(default_factory=list)
    mode: Mode = "paper"
    portfolio_value: float = Field(default=250000, gt=0)
    max_order_size: float = Field(default=20000, gt=0)
    min_confidence: float = Field(default=0.75, ge=0.5, le=0.99)
    cycle_seconds: int = Field(default=60, ge=10, le=3600)
    strategy_type: StrategyType = StrategyType.AI_ONLY
    # İndikatör bazlı strateji parametreleri
    rsi_oversold: float = Field(default=30, ge=10, le=50)
    rsi_overbought: float = Field(default=70, ge=50, le=90)
    use_macd: bool = Field(default=True)
    use_bollinger: bool = Field(default=True)
    use_volume: bool = Field(default=True)
    # Stop-loss / Take-profit otomatik
    auto_stop_loss_pct: Optional[float] = Field(default=3.0, ge=0.5, le=20)
    auto_take_profit_pct: Optional[float] = Field(default=5.0, ge=1.0, le=50)


# ─── Emir Geçmişi Filtre ───
class OrderHistoryFilter(BaseModel):
    symbol: Optional[str] = None
    side: Optional[Side] = None
    status: Optional[str] = None
    order_type: Optional[OrderType] = None
    strategy_type: Optional[StrategyType] = None
    mode: Optional[Mode] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=50, ge=10, le=200)
