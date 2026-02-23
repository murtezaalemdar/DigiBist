
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.ml_engine.model import BISTAIModel
from app.core.ws_manager import manager
from app.core.risk_engine import RiskEngine
from app.core.telegram_notifier import TelegramNotifier
from app.core.database import (
    db_health_check,
    get_cached_forecast,
    set_cached_forecast,
    save_stock_forecast,
    get_active_symbols,
    bulk_update_stock_prices,
)
from app.core.auth import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserInfo,
    authenticate_user,
    register_user,
    create_access_token,
    get_current_user,
    require_auth,
    require_permission,
    get_user_by_id,
    list_users,
    update_user,
    change_user_password,
    delete_user,
    hash_password,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    get_all_permissions,
    get_user_permissions,
    set_user_permissions,
    check_user_permission,
)
from app.trading.models import ManualOrderRequest, AutoTradeConfig, ConditionalOrderRequest, OrderType, StrategyType
from app.trading.strategy_engine import StrategyEngine, IndicatorSet
from app.trading.execution_engine import ExecutionEngine
from app.trading.auto_trader import AutoTrader
from app.trading.brokers.broker_manager import BrokerManager
from app.core.database import (
    get_stocks_for_trading,
    save_conditional_order,
    get_conditional_orders,
    cancel_conditional_order,
    get_trade_stats,
    get_recent_orders_v2,
)
import asyncio
import time
from datetime import timedelta, datetime, timezone
import yfinance as yf
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="BIST AI ML Engine", version="2.0.0")

ALLOWED_ORIGINS = [
    "http://localhost:3000",   # React frontend
    "http://localhost:8001",   # Filament admin panel
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Forecast cache TTL (saniye) — veriler PostgreSQL forecast_cache tablosunda
CACHE_TTL = 3600  # 1 saat

# Gerçek zamanlı fiyat akışı — DB'den dinamik çekilecek
_active_symbols_cache: list[str] = []
_active_symbols_ts: float = 0
_SYMBOLS_CACHE_TTL = 300  # 5 dakika


async def get_watched_symbols() -> list[str]:
    """Aktif hisse sembollerini DB'den al (5 dk cache)."""
    global _active_symbols_cache, _active_symbols_ts
    now = time.time()
    if _active_symbols_cache and (now - _active_symbols_ts) < _SYMBOLS_CACHE_TTL:
        return _active_symbols_cache
    try:
        symbols = await get_active_symbols()
        if symbols:
            _active_symbols_cache = symbols
            _active_symbols_ts = now
            logger.info(f"Aktif semboller güncellendi: {len(symbols)} hisse")
            return symbols
    except Exception as e:
        logger.warning(f"Sembol listesi alınamadı: {e}")
    # Fallback: cache boşsa varsayılan
    return _active_symbols_cache or ["THYAO", "AKBNK", "GARAN", "SAHOL", "KCHOL", "ASELS", "EREGL", "SISE"]

execution_engine = ExecutionEngine()
auto_trader = AutoTrader()
broker_manager = BrokerManager()

# Broker manager'ı execution engine'e bağla
execution_engine._broker_manager = broker_manager

# WS batch: bellekte tutacağımız son fiyatlar (DB'ye gitmeden WS'e hızlı cevap)
_ws_price_cache: dict[str, dict] = {}


def _normalize_symbol(symbol: str) -> str:
    clean = symbol.upper().strip()
    return clean.replace(".IS", "")


async def _run_auto_cycle(config: dict):
    symbols = config.get("symbols") or await get_watched_symbols()
    mode = config.get("mode", "paper")
    min_confidence = float(config.get("min_confidence", 0.75))
    portfolio_value = float(config.get("portfolio_value", 250000))
    max_order_size = float(config.get("max_order_size", 20000))

    for raw_symbol in symbols:
        symbol = _normalize_symbol(raw_symbol)
        forecast = await get_forecast(symbol=symbol, notify=False)

        if not forecast or forecast.get("error"):
            await auto_trader.add_log(symbol, "SKIP", "Forecast alınamadı", mode)
            continue

        signal = forecast.get("risk_signal") or forecast.get("signal")
        confidence = float(forecast.get("confidence", 0))
        market_price = float(forecast.get("current_price", 0) or 0)

        if signal not in ("BUY", "SELL"):
            await auto_trader.add_log(symbol, "HOLD", f"Sinyal={signal}", mode)
            continue

        if confidence < min_confidence:
            await auto_trader.add_log(symbol, "HOLD", f"Confidence düşük ({confidence:.2f})", mode)
            continue

        if market_price <= 0:
            await auto_trader.add_log(symbol, "SKIP", "Geçersiz fiyat", mode)
            continue

        quantity = round(max_order_size / market_price, 4)
        risk = RiskEngine.check_position(position_size=max_order_size, portfolio_value=portfolio_value)

        order_result = await execution_engine.execute(
            symbol=symbol,
            side=signal,
            quantity=quantity,
            mode=mode,
            market_price=market_price,
            requested_price=None,
            approved=bool(risk.get("approved", False)),
            reason=risk.get("reason", "Risk check sonucu yok"),
        )

        await auto_trader.add_log(
            symbol=symbol,
            action=order_result.get("status", "unknown"),
            reason=order_result.get("reason", ""),
            mode=mode,
        )


# ─────────────────────────────────────────────
# 1) AI TAHMİN ENDPOİNTİ (PostgreSQL Cache + Risk Engine)
# ─────────────────────────────────────────────
@app.get("/api/ai-forecast/{symbol}")
async def get_forecast(symbol: str, notify: bool = False):
    # PostgreSQL forecast_cache tablosundan oku
    try:
        cached_data = await get_cached_forecast(symbol, ttl_seconds=CACHE_TTL)
        if cached_data is not None:
            return cached_data
    except Exception as exc:
        logger.warning(f"Cache okunamadı ({symbol}): {exc}")

    ticker = f"{symbol}.IS"
    ai = BISTAIModel(ticker)
    try:
        result = ai.fetch_and_train()
    except Exception as exc:
        logger.error(f"fetch_and_train HATASI ({symbol}): {exc}", exc_info=True)
        return {"error": f"Model eğitim hatası: {str(exc)}"}

    if not result:
        return {"error": "Veri alınamadı veya model eğitilemedi."}

    # Sonuca symbol ekle (DB kayıt için)
    result["symbol"] = symbol

    # Risk Engine: Sinyali çoklu filtreden geçir
    risk_eval = RiskEngine.evaluate_signal(
        signal=result["signal"],
        confidence=result["confidence"],
        current_price=result["current_price"],
        predicted_price=result["predicted_price"],
        atr_pct=result.get("atr_pct", 0),
        market_regime=result.get("market_regime", "SIDEWAYS"),
        win_rate=result.get("win_rate", 0.5),
        avg_win=result.get("avg_win", 0.01),
        avg_loss=result.get("avg_loss", 0.01),
    )
    result["risk_signal"] = risk_eval["final_signal"]
    result["risk_reason"] = risk_eval["reason"]
    result["risk_adjusted"] = risk_eval["risk_adjusted"]
    result["confidence_threshold"] = risk_eval.get("confidence_threshold", 0.70)
    result["filters_applied"] = risk_eval.get("filters_applied", [])

    # Kelly Criterion pozisyon boyutlandırma
    kelly = RiskEngine.kelly_position_size(
        win_rate=result.get("win_rate", 0.5),
        avg_win=result.get("avg_win", 0.01),
        avg_loss=result.get("avg_loss", 0.01),
    )
    result["kelly_fraction"] = kelly["kelly_fraction"]
    result["kelly_position_size"] = kelly["position_size"]
    result["kelly_position_pct"] = kelly["position_pct"]
    result["kelly_reason"] = kelly["kelly_reason"]

    # PostgreSQL'e kaydet: hem cache hem kalıcı forecast kaydı
    try:
        await set_cached_forecast(symbol, result)
    except Exception as exc:
        logger.warning(f"Cache yazılamadı ({symbol}): {exc}")

    try:
        await save_stock_forecast(result)
    except Exception as exc:
        logger.warning(f"Forecast DB kayıt hatası ({symbol}): {exc}")

    # WS price cache'i güncelle
    _ws_price_cache[symbol] = {
        "price": result.get("current_price", 0),
        "signal": result.get("risk_signal", result.get("signal", "—")),
        "change": result.get("change_percent", 0),
    }

    # İsteğe bağlı Telegram bildirimi
    if notify:
        await TelegramNotifier.notify_signal(
            symbol=symbol,
            signal=risk_eval["final_signal"],
            current_price=result["current_price"],
            predicted_price=result["predicted_price"],
            confidence=result["confidence"]
        )

    return result


# ─────────────────────────────────────────────
# 1.5) AI GRAFİK VERİSİ ENDPOİNTİ (Tarihsel fiyat + indikatörler)
# ─────────────────────────────────────────────
@app.get("/api/ai-chart-data/{symbol}")
async def get_chart_data(symbol: str, period: str = "6mo"):
    """Tarihsel fiyat verisi + teknik indikatörleri JSON olarak döndür."""
    import yfinance as yf
    import pandas as pd
    import numpy as np

    ticker = f"{symbol}.IS"

    # Kısa periyotlarda yeterli indikatör verisi için ekstra geçmiş çek
    fetch_map = {"1mo": "6mo", "3mo": "1y", "6mo": "2y", "1y": "5y", "2y": "5y"}
    fetch_period = fetch_map.get(period, "2y")

    data = yf.download(ticker, period=fetch_period, interval="1d", progress=False)

    if data.empty:
        return {"error": "Veri bulunamadı."}

    df = data.copy()
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    # Teknik indikatörler (tam veri üzerinde hesapla)
    # SMA
    df['SMA_10'] = df['Close'].rolling(window=10).mean()
    df['SMA_20'] = df['Close'].rolling(window=20).mean()
    df['SMA_50'] = df['Close'].rolling(window=50).mean()

    # EMA
    df['EMA_12'] = df['Close'].ewm(span=12, adjust=False).mean()
    df['EMA_26'] = df['Close'].ewm(span=26, adjust=False).mean()

    # RSI (14)
    delta = df['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    df['RSI'] = 100 - (100 / (1 + rs))

    # MACD
    ema_fast = df['Close'].ewm(span=12, adjust=False).mean()
    ema_slow = df['Close'].ewm(span=26, adjust=False).mean()
    df['MACD'] = ema_fast - ema_slow
    df['MACD_Signal'] = df['MACD'].ewm(span=9, adjust=False).mean()
    df['MACD_Hist'] = df['MACD'] - df['MACD_Signal']

    # Bollinger Bands
    sma_20 = df['Close'].rolling(window=20).mean()
    std_20 = df['Close'].rolling(window=20).std()
    df['BB_Upper'] = sma_20 + (std_20 * 2)
    df['BB_Lower'] = sma_20 - (std_20 * 2)

    # Volume SMA
    df['Volume_SMA'] = df['Volume'].rolling(window=20).mean()

    # Tüm indikatörler hesaplandıktan sonra NaN satırları at
    df = df.dropna()

    # Şimdi istenen periyoda göre kes
    period_days = {"1mo": 30, "3mo": 90, "6mo": 180, "1y": 365, "2y": 730}
    days = period_days.get(period, 180)
    if len(df) > days:
        df = df.iloc[-days:]

    # JSON serileştir
    records = []
    for idx, row in df.iterrows():
        records.append({
            "date": idx.strftime("%Y-%m-%d"),
            "close": round(float(row['Close']), 2),
            "open": round(float(row['Open']), 2),
            "high": round(float(row['High']), 2),
            "low": round(float(row['Low']), 2),
            "volume": int(row['Volume']),
            "sma10": round(float(row['SMA_10']), 2),
            "sma20": round(float(row['SMA_20']), 2),
            "sma50": round(float(row['SMA_50']), 2),
            "rsi": round(float(row['RSI']), 2),
            "macd": round(float(row['MACD']), 4),
            "macd_signal": round(float(row['MACD_Signal']), 4),
            "macd_hist": round(float(row['MACD_Hist']), 4),
            "bb_upper": round(float(row['BB_Upper']), 2),
            "bb_lower": round(float(row['BB_Lower']), 2),
            "volume_sma": round(float(row['Volume_SMA']), 0),
        })

    return {
        "symbol": symbol,
        "period": period,
        "count": len(records),
        "data": records,
    }


# ─────────────────────────────────────────────
# 2) RISK CHECK ENDPOİNTİ
# ─────────────────────────────────────────────
@app.get("/api/risk/check")
async def check_risk(position_size: float, portfolio_value: float = 250000):
    return RiskEngine.check_position(position_size, portfolio_value)


# ─────────────────────────────────────────────
# 2.1) STRATEGY EVALUATE (DSL konsepti)
# ─────────────────────────────────────────────
@app.get("/api/strategy/evaluate")
async def evaluate_strategy(rsi: float, ai_prob: float, momentum: float):
    signal = StrategyEngine.evaluate(
        IndicatorSet(rsi=float(rsi), ai_prob=float(ai_prob), momentum=float(momentum))
    )
    return {
        "signal": signal,
        "inputs": {
            "rsi": rsi,
            "ai_prob": ai_prob,
            "momentum": momentum,
        }
    }


# ─────────────────────────────────────────────
# 2.1a) HİSSE LİSTESİ (İşlem Merkezi için)
# ─────────────────────────────────────────────
@app.get("/api/stocks/trading-list")
async def stocks_trading_list():
    """İşlem merkezi dropdown'u için aktif hisseleri fiyatlarıyla döndür."""
    stocks = await get_stocks_for_trading()
    return {"stocks": stocks, "count": len(stocks)}


# ─────────────────────────────────────────────
# 2.2) MANUEL ORDER EXECUTION (V2)
# ─────────────────────────────────────────────
@app.post("/api/order/execute")
async def execute_order(request: ManualOrderRequest):
    symbol = _normalize_symbol(request.symbol)

    forecast = await get_forecast(symbol=symbol, notify=False)
    if not forecast or forecast.get("error"):
        return {
            "status": "rejected",
            "reason": "AI forecast alınamadı",
            "symbol": symbol,
        }

    market_price = float(request.price or forecast.get("current_price") or 0)
    if market_price <= 0:
        return {
            "status": "rejected",
            "reason": "Geçersiz fiyat",
            "symbol": symbol,
        }

    order_notional = request.quantity * market_price
    risk = RiskEngine.check_position(position_size=order_notional, portfolio_value=request.portfolio_value)

    order = await execution_engine.execute(
        symbol=symbol,
        side=request.side,
        quantity=request.quantity,
        mode=request.mode,
        market_price=market_price,
        requested_price=request.price,
        approved=bool(risk.get("approved", False)),
        reason=risk.get("reason", "Risk check sonucu yok"),
        order_type=request.order_type.value if request.order_type else "market",
        trigger_price=request.trigger_price,
        stop_price=request.stop_price,
        take_profit_price=request.take_profit_price,
        trailing_stop_pct=request.trailing_stop_pct,
        strategy_type=request.strategy_type.value if request.strategy_type else "manual",
        ai_confidence=float(forecast.get("confidence", 0)),
        ai_signal=forecast.get("risk_signal") or forecast.get("signal"),
        notes=request.notes,
    )

    return {
        "order": order,
        "ai_context": {
            "signal": forecast.get("signal"),
            "risk_signal": forecast.get("risk_signal"),
            "confidence": forecast.get("confidence"),
            "current_price": forecast.get("current_price"),
            "predicted_price": forecast.get("predicted_price"),
        },
        "risk": risk,
    }


# ─────────────────────────────────────────────
# 2.3) ORDER HISTORY (V2 — filtreli & sayfalı)
# ─────────────────────────────────────────────
@app.get("/api/order/history")
async def order_history(
    limit: int = 50,
    page: int = 1,
    symbol: str = None,
    side: str = None,
    status: str = None,
    order_type: str = None,
    strategy_type: str = None,
    mode: str = None,
    date_from: str = None,
    date_to: str = None,
):
    offset = (page - 1) * limit
    orders, total = await get_recent_orders_v2(
        limit=limit,
        offset=offset,
        symbol=symbol,
        side=side,
        status=status,
        order_type=order_type,
        strategy_type=strategy_type,
        mode=mode,
        date_from=date_from,
        date_to=date_to,
    )
    return {
        "orders": orders,
        "total": total,
        "page": page,
        "per_page": limit,
        "total_pages": max(1, -(-total // limit)),
    }


# ─────────────────────────────────────────────
# 2.3b) TRADE İSTATİSTİKLERİ
# ─────────────────────────────────────────────
@app.get("/api/trade/stats")
async def trade_stats():
    return await get_trade_stats()


# ─────────────────────────────────────────────
# 2.3c) KOŞULLU EMİR (Conditional Orders)
# ─────────────────────────────────────────────
@app.post("/api/order/conditional")
async def create_conditional_order(request: ConditionalOrderRequest):
    """Koşullu emir oluştur (limit, stop-loss, take-profit, trailing-stop)."""
    symbol = _normalize_symbol(request.symbol)

    expires_at = None
    if request.expires_hours:
        expires_at = datetime.now(timezone.utc) + timedelta(hours=request.expires_hours)

    order_data = {
        "symbol": symbol,
        "side": request.side,
        "quantity": request.quantity,
        "mode": request.mode,
        "order_type": request.order_type.value,
        "trigger_price": request.trigger_price,
        "limit_price": request.limit_price,
        "stop_price": request.stop_price,
        "take_profit_price": request.take_profit_price,
        "trailing_stop_pct": request.trailing_stop_pct,
        "strategy_type": request.strategy_type.value if request.strategy_type else "manual",
        "notes": request.notes,
        "expires_at": expires_at,
    }

    result = await save_conditional_order(order_data)
    return {"status": "created", "conditional_order": result}


@app.get("/api/order/conditional")
async def list_conditional_orders(status: str = None, symbol: str = None):
    """Koşullu emirleri listele."""
    orders = await get_conditional_orders(status=status, symbol=symbol)
    return {"conditional_orders": orders, "count": len(orders)}


@app.delete("/api/order/conditional/{order_ref}")
async def delete_conditional_order(order_ref: str):
    """Koşullu emri iptal et."""
    ok = await cancel_conditional_order(order_ref)
    if not ok:
        raise HTTPException(status_code=404, detail="Emir bulunamadı veya zaten iptal edilmiş.")
    return {"status": "cancelled", "order_ref": order_ref}


# ─────────────────────────────────────────────
# 2.4) AUTO TRADE CONTROLLER
# ─────────────────────────────────────────────
@app.post("/api/auto-trade/start")
async def auto_trade_start(config: AutoTradeConfig):
    payload = config.model_dump()
    payload["symbols"] = [_normalize_symbol(x) for x in (payload.get("symbols") or [])]
    auto_trader.start(payload, _run_auto_cycle)
    return {"status": "started", "config": payload}


@app.post("/api/auto-trade/stop")
async def auto_trade_stop():
    auto_trader.stop()
    return {"status": "stopped"}


@app.get("/api/auto-trade/status")
async def auto_trade_status():
    return await auto_trader.status()


@app.post("/api/auto-trade/run-once")
async def auto_trade_run_once(config: AutoTradeConfig):
    payload = config.model_dump()
    payload["symbols"] = [_normalize_symbol(x) for x in (payload.get("symbols") or [])]
    await _run_auto_cycle(payload)
    status = await auto_trader.status()
    return {
        "status": "completed_once",
        "config": payload,
        "latest_logs": status.get("recent_logs", [])[:10],
    }


# ─────────────────────────────────────────────
# 3) WEBSOCKET - GERÇEK ZAMANLI FİYAT AKIŞI
#    Batch yfinance sorgusu ile optimize edildi
# ─────────────────────────────────────────────

async def _fetch_batch_prices() -> dict[str, dict]:
    """
    Tüm aktif hisseler için batch yfinance sorgusu yapar.
    Önce bellekteki WS cache'e, yoksa toplu download'a bakar.
    yfinance chunk limiti: ~30 sembol per batch.
    """
    watched = await get_watched_symbols()
    logger.info(f"Fiyat çekme başladı: {len(watched)} sembol")
    prices: dict[str, dict] = {}

    # Önce bellekteki forecast cache'den al (DB'ye gitmeden hızlı)
    symbols_to_fetch: list[str] = []
    for sym in watched:
        if sym in _ws_price_cache:
            prices[sym] = _ws_price_cache[sym]
        else:
            symbols_to_fetch.append(sym)

    if not symbols_to_fetch:
        return prices

    # yfinance batch sorgusu — çok fazla sembol olduğunda chunk'la
    CHUNK_SIZE = 30
    chunks = [symbols_to_fetch[i:i + CHUNK_SIZE] for i in range(0, len(symbols_to_fetch), CHUNK_SIZE)]

    for chunk in chunks:
        try:
            tickers_str = " ".join(f"{s}.IS" for s in chunk)
            loop = asyncio.get_event_loop()
            data = await loop.run_in_executor(
                None, lambda t=tickers_str: yf.download(t, period="5d", progress=False, threads=True)
            )

            if data is not None and not data.empty:
                close_col = data.get("Close")
                if close_col is not None and not close_col.empty:
                    last_row = close_col.iloc[-1]
                    # Önceki gün (change hesabı)
                    prev_row = close_col.iloc[-2] if len(close_col) > 1 else None

                    for sym in chunk:
                        yahoo_sym = f"{sym}.IS"
                        try:
                            if len(chunk) == 1:
                                # Tek sembol: MultiIndex yok
                                price = float(last_row.iloc[-1]) if not last_row.empty else 0
                                prev_price = float(prev_row.iloc[-1]) if prev_row is not None and not prev_row.empty else 0
                            else:
                                price = float(last_row[yahoo_sym]) if yahoo_sym in last_row.index else 0
                                prev_price = float(prev_row[yahoo_sym]) if prev_row is not None and yahoo_sym in prev_row.index else 0
                            price = round(price, 2) if price and price > 0 else 0
                            change = round(((price - prev_price) / prev_price) * 100, 2) if prev_price > 0 and price > 0 else 0
                        except (KeyError, TypeError, ValueError, IndexError):
                            price = 0
                            change = 0
                        entry = _ws_price_cache.get(sym, {})
                        prices[sym] = {
                            "price": price,
                            "signal": entry.get("signal", "—"),
                            "change": change,
                        }
                else:
                    for sym in chunk:
                        prices[sym] = {"price": 0, "signal": "—", "change": 0}
            else:
                for sym in chunk:
                    prices[sym] = {"price": 0, "signal": "—", "change": 0}
        except Exception as e:
            logger.warning(f"Batch fiyat çekme hatası (chunk): {e}")
            for sym in chunk:
                prices[sym] = {"price": 0, "signal": "—", "change": 0}

    valid = sum(1 for v in prices.values() if v.get("price", 0) > 0)
    logger.info(f"Fiyat çekme bitti: {valid}/{len(prices)} hissede geçerli fiyat")

    # Fiyatları DB'ye de yaz (async, arka planda)
    try:
        await bulk_update_stock_prices(prices)
        logger.info("DB fiyat sync tamamlandı")
    except Exception as e:
        logger.warning(f"DB fiyat sync hatası: {e}")

    return prices


@app.websocket("/ws/market")
async def websocket_market(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            prices = await _fetch_batch_prices()

            await websocket.send_json({
                "type": "MARKET_UPDATE",
                "timestamp": time.time(),
                "data": prices
            })
            await asyncio.sleep(10)  # Her 10 saniyede güncelle
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket hatası: {e}")
        manager.disconnect(websocket)


# ─────────────────────────────────────────────
# 5) AUTH — JWT Token Sistemi
# ─────────────────────────────────────────────
@app.post("/api/auth/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    user = await authenticate_user(request.username, request.password)
    if not user:
        from fastapi import HTTPException, status as http_status
        raise HTTPException(
            status_code=http_status.HTTP_401_UNAUTHORIZED,
            detail="Kullanıcı adı veya şifre hatalı.",
        )
    # Kullanıcının izinlerini al
    perms = await get_user_permissions(user["id"])
    if user.get("role") == "admin":
        all_perms = await get_all_permissions()
        perms = [p["key"] for p in all_perms]
    user["permissions"] = perms

    token = create_access_token(
        data={"sub": user["username"], "user_id": user["id"], "name": user["name"], "role": user.get("role", "user")},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return TokenResponse(
        access_token=token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=user,
    )


@app.post("/api/auth/register", response_model=TokenResponse)
async def register(request: RegisterRequest):
    user = await register_user(request.name, request.username, request.email, request.password)
    token = create_access_token(
        data={"sub": user["username"], "user_id": user["id"], "name": user["name"], "role": user.get("role", "user")},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return TokenResponse(
        access_token=token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=user,
    )


@app.get("/api/auth/me")
async def auth_me(user: UserInfo = Depends(require_auth)):
    # Kullanıcının izinlerini de döndür
    perms = await get_user_permissions(user.id)
    # Admin ise tüm izinleri ver
    if user.role == "admin":
        all_perms = await get_all_permissions()
        perms = [p["key"] for p in all_perms]
    return {
        "user": {
            "id": user.id,
            "name": user.name,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "permissions": perms,
        }
    }


# ─────────────────────────────────────────────
# 5b) KULLANICI YÖNETİMİ (CRUD) — Admin only
# ─────────────────────────────────────────────
@app.get("/api/users")
async def api_list_users(user: UserInfo = Depends(require_auth)):
    """Tüm kullanıcıları listele (admin only)."""
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Yetkiniz yok.")
    users = await list_users()
    return {"users": users}


@app.post("/api/users")
async def api_create_user(request: RegisterRequest, user: UserInfo = Depends(require_auth)):
    """Yeni kullanıcı ekle (admin only)."""
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Yetkiniz yok.")
    new_user = await register_user(request.name, request.username, request.email, request.password)
    return {"status": "ok", "user": new_user}


from pydantic import BaseModel as _BaseModel

class UpdateUserRequest(_BaseModel):
    name: str
    username: str
    email: str = ""
    role: str = "user"

class ChangePasswordRequest(_BaseModel):
    new_password: str


@app.put("/api/users/{user_id}")
async def api_update_user(user_id: int, request: UpdateUserRequest, user: UserInfo = Depends(require_auth)):
    """Kullanıcı bilgilerini güncelle (admin only)."""
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Yetkiniz yok.")
    updated = await update_user(user_id, request.name, request.username, request.email, request.role)
    return {"status": "ok", "user": updated}


@app.put("/api/users/{user_id}/password")
async def api_change_password(user_id: int, request: ChangePasswordRequest, user: UserInfo = Depends(require_auth)):
    """Kullanıcı şifresini değiştir (admin only)."""
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Yetkiniz yok.")
    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="Şifre en az 6 karakter olmalı.")
    ok = await change_user_password(user_id, request.new_password)
    if not ok:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")
    return {"status": "ok", "message": "Şifre başarıyla değiştirildi."}


@app.delete("/api/users/{user_id}")
async def api_delete_user(user_id: int, user: UserInfo = Depends(require_auth)):
    """Kullanıcı sil (admin only, kendini silemez)."""
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Yetkiniz yok.")
    if user.id == user_id:
        raise HTTPException(status_code=400, detail="Kendinizi silemezsiniz.")
    ok = await delete_user(user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")
    return {"status": "ok", "message": "Kullanıcı silindi."}


# ─────────────────────────────────────────────
# 5c) İZİN YÖNETİMİ (Permissions) — Admin only
# ─────────────────────────────────────────────
@app.get("/api/permissions")
async def api_get_permissions(user: UserInfo = Depends(require_auth)):
    """Tüm tanımlı izinleri listele."""
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Yetkiniz yok.")
    permissions = await get_all_permissions()
    # Grupla
    groups = {}
    for p in permissions:
        g = p["group_name"]
        if g not in groups:
            groups[g] = []
        groups[g].append(p)
    return {"permissions": permissions, "groups": groups}


@app.get("/api/users/{user_id}/permissions")
async def api_get_user_permissions(user_id: int, user: UserInfo = Depends(require_auth)):
    """Belirli kullanıcının izinlerini getir."""
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Yetkiniz yok.")
    perms = await get_user_permissions(user_id)
    return {"user_id": user_id, "permissions": perms}


class SetPermissionsRequest(_BaseModel):
    permissions: list[str] = []


@app.put("/api/users/{user_id}/permissions")
async def api_set_user_permissions(user_id: int, request: SetPermissionsRequest, user: UserInfo = Depends(require_auth)):
    """Kullanıcının izinlerini toplu güncelle."""
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Yetkiniz yok.")
    # Geçerli izin key'lerini kontrol et
    all_perms = await get_all_permissions()
    valid_keys = {p["key"] for p in all_perms}
    invalid = [k for k in request.permissions if k not in valid_keys]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Geçersiz izin anahtarları: {', '.join(invalid)}")
    updated = await set_user_permissions(user_id, request.permissions)
    return {"status": "ok", "user_id": user_id, "permissions": updated}


# ─────────────────────────────────────────────
# 6) SAĞLIK KONTROLÜ (PostgreSQL bağlantı durumu dahil)
# ─────────────────────────────────────────────
@app.get("/")
async def home():
    pg_ok = False
    try:
        pg_ok = await db_health_check()
    except Exception:
        pass

    order_count = 0
    try:
        recent = await execution_engine.recent_orders(limit=500)
        order_count = len(recent)
    except Exception:
        pass

    return {
        "status": "BIST AI Engine v2.0 Active",
        "database": "PostgreSQL connected" if pg_ok else "PostgreSQL disconnected",
        "features": [
            "AI Forecast",
            "Risk Engine",
            "WebSocket Live Prices (batch optimized)",
            "Telegram Alerts",
            "Manual Order Execution",
            "Auto Trade Controller",
            "Strategy Evaluate",
            "PostgreSQL Persistent Storage",
        ],
        "ws_connections": len(manager.active_connections),
        "auto_trade_enabled": auto_trader.enabled,
        "order_history_size": order_count,
        "broker": broker_manager.active_broker_type,
        "exchange": broker_manager.active_exchange,
    }


# ─────────────────────────────────────────────
# 7) BROKER YÖNETİMİ API
# ─────────────────────────────────────────────

@app.on_event("startup")
async def startup_initialize_broker():
    """Uygulama başlangıcında varsayılan broker'ı aktifle."""
    await broker_manager.initialize_default()
    logger.info("Broker Manager başlatıldı (Paper Trading varsayılan).")


@app.get("/api/broker/status")
async def broker_status():
    """Aktif broker durumunu getir."""
    return await broker_manager.get_status()


@app.get("/api/broker/list")
async def broker_list():
    """Desteklenen tüm broker'ların bilgilerini getir."""
    return {
        "brokers": broker_manager.get_broker_info(),
        "active_broker": broker_manager.active_broker_type,
        "active_exchange": broker_manager.active_exchange,
    }


@app.get("/api/broker/config/{broker_type}")
async def broker_config_fields(broker_type: str):
    """Belirli bir broker'ın konfigürasyon alanlarını getir."""
    fields = broker_manager.get_broker_config_fields(broker_type)
    if not fields and broker_type not in ("paper", "ibkr", "matriks", "is_yatirim"):
        return {"error": f"Desteklenmeyen broker: {broker_type}"}
    # Mevcut config'i de gönder (şifreleri maskele)
    current = broker_manager.get_broker_config(broker_type)
    masked = {}
    for k, v in current.items():
        if "secret" in k.lower() or "password" in k.lower():
            masked[k] = "••••••••" if v else ""
        else:
            masked[k] = v
    return {"broker_type": broker_type, "fields": fields, "current_config": masked}


@app.post("/api/broker/config/{broker_type}")
async def save_broker_config(broker_type: str, config: dict):
    """Broker konfigürasyonunu kaydet (API key'ler vb.)."""
    # Maskeli değerleri eski config'den koru
    old_config = broker_manager.get_broker_config(broker_type)
    merged = {}
    for k, v in config.items():
        if v == "••••••••" and k in old_config:
            merged[k] = old_config[k]
        else:
            merged[k] = v
    broker_manager.set_broker_config(broker_type, merged)
    return {"status": "ok", "broker_type": broker_type, "message": "Konfigürasyon kaydedildi."}


@app.post("/api/broker/connect")
async def broker_connect(payload: dict):
    """
    Broker'a bağlan.
    Body: { "broker_type": "ibkr", "exchange": "BIST" }
    """
    broker_type = payload.get("broker_type", "paper")
    exchange = payload.get("exchange", "BIST")
    from dataclasses import asdict
    status = await broker_manager.switch_broker(broker_type, exchange)
    return asdict(status)


@app.post("/api/broker/disconnect")
async def broker_disconnect():
    """Mevcut broker bağlantısını kes."""
    await broker_manager.disconnect_current()
    return {"status": "ok", "message": "Broker bağlantısı kesildi."}


@app.post("/api/broker/exchange")
async def set_exchange(payload: dict):
    """Aktif borsayı değiştir. Body: { "exchange": "NYSE" }"""
    exchange = payload.get("exchange", "BIST")
    broker_manager.set_exchange(exchange)
    return {"status": "ok", "active_exchange": exchange}
