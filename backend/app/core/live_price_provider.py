"""
DigiBist — Canlı Fiyat Sağlayıcı (Live Price Provider)
========================================================
Birincil: TradingView Scanner API (tek istekte tüm BIST hisseleri, ~0.3s)
Yedek:    Yahoo Finance Spark API (sembol bazlı, ~0.2s/3 sembol)
Son çare: yfinance kütüphanesi (mevcut eski yöntem)

Gecikme: TradingView ~1-2 dk, Yahoo ~15-20 dk
"""

import json
import ssl
import urllib.request
import logging
import time
from typing import Optional

logger = logging.getLogger(__name__)

# SSL context — bazı sunucularda sertifika sorunu olabiliyor
_ssl_ctx = ssl.create_default_context()
_ssl_ctx.check_hostname = False
_ssl_ctx.verify_mode = ssl.CERT_NONE

_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

# ─── Provider istatistikleri ───
_stats = {
    "tradingview": {"success": 0, "fail": 0, "last_ok": 0},
    "yahoo_spark": {"success": 0, "fail": 0, "last_ok": 0},
    "yfinance": {"success": 0, "fail": 0, "last_ok": 0},
}


def get_provider_stats() -> dict:
    """Provider başarı/hata istatistiklerini döndür."""
    return _stats.copy()


# ════════════════════════════════════════════
# 1) TradingView Scanner — BİRİNCİL KAYNAK
#    Tek POST ile tüm BIST hisselerinin fiyatını çeker
#    ~0.3-0.5 saniye, günlük limit yok
# ════════════════════════════════════════════

def fetch_tradingview_prices(symbols: list[str]) -> dict[str, dict]:
    """
    TradingView Scanner API ile BIST hisse fiyatlarını çeker.
    
    Returns:
        dict: {symbol: {"price": float, "change": float, "volume": int}}
    """
    t0 = time.time()
    try:
        payload = json.dumps({
            "filter": [
                {"left": "exchange", "operation": "equal", "right": "BIST"}
            ],
            "columns": ["name", "close", "change", "volume"],
            "sort": {"sortBy": "name", "sortOrder": "asc"},
            "range": [0, 700],
        }).encode("utf-8")

        req = urllib.request.Request(
            "https://scanner.tradingview.com/turkey/scan",
            data=payload,
            headers={
                "User-Agent": _UA,
                "Content-Type": "application/json",
            },
        )
        resp = urllib.request.urlopen(req, context=_ssl_ctx, timeout=15)
        raw = json.loads(resp.read())

        # Parse: her kayıt {"s": "BIST:ASELS", "d": [name, close, change, volume]}
        all_prices = {}
        for item in raw.get("data", []):
            sym = item["s"].replace("BIST:", "")
            vals = item.get("d", [])
            price = round(float(vals[1]), 2) if len(vals) > 1 and vals[1] else 0
            change = round(float(vals[2]), 2) if len(vals) > 2 and vals[2] else 0
            volume = int(vals[3]) if len(vals) > 3 and vals[3] else 0
            all_prices[sym] = {
                "price": price,
                "change": change,
                "volume": volume,
            }

        # Sadece istenen sembolleri filtrele
        result = {}
        for sym in symbols:
            if sym in all_prices and all_prices[sym]["price"] > 0:
                result[sym] = all_prices[sym]

        elapsed = time.time() - t0
        _stats["tradingview"]["success"] += 1
        _stats["tradingview"]["last_ok"] = time.time()
        logger.info(
            f"TradingView: {len(result)}/{len(symbols)} hisse, "
            f"{elapsed:.2f}s ({raw.get('totalCount', '?')} toplam BIST)"
        )
        return result

    except Exception as e:
        elapsed = time.time() - t0
        _stats["tradingview"]["fail"] += 1
        logger.warning(f"TradingView HATA ({elapsed:.2f}s): {e}")
        return {}


# ════════════════════════════════════════════
# 2) Yahoo Finance Spark API — YEDEK KAYNAK
#    Sembol başına çeker, chunk'lanması gerekir
#    Her chunk ~0.2-0.4s, günlük limit var (~2000 req)
# ════════════════════════════════════════════

def fetch_yahoo_spark_prices(symbols: list[str]) -> dict[str, dict]:
    """
    Yahoo Finance Spark API ile fiyat çeker.
    Chunk boyutu: 10 sembol/istek.
    
    Returns:
        dict: {symbol: {"price": float, "change": float}}
    """
    t0 = time.time()
    result = {}
    CHUNK = 10

    try:
        chunks = [symbols[i:i + CHUNK] for i in range(0, len(symbols), CHUNK)]

        for chunk in chunks:
            yahoo_syms = [f"{s}.IS" for s in chunk]
            sym_str = ",".join(yahoo_syms)
            url = (
                f"https://query1.finance.yahoo.com/v8/finance/spark"
                f"?symbols={sym_str}&range=1d&interval=5m"
            )
            req = urllib.request.Request(url, headers={"User-Agent": _UA})
            resp = urllib.request.urlopen(req, context=_ssl_ctx, timeout=15)
            data = json.loads(resp.read())

            for yahoo_sym, spark in data.items():
                sym = yahoo_sym.replace(".IS", "")
                closes = spark.get("close", [])
                prev = spark.get("previousClose", 0)

                # Son geçerli fiyatı bul
                last_price = 0
                for c in reversed(closes):
                    if c is not None and c > 0:
                        last_price = round(float(c), 2)
                        break

                change = 0
                if prev and prev > 0 and last_price > 0:
                    change = round(((last_price - prev) / prev) * 100, 2)

                if last_price > 0:
                    result[sym] = {"price": last_price, "change": change}

        elapsed = time.time() - t0
        _stats["yahoo_spark"]["success"] += 1
        _stats["yahoo_spark"]["last_ok"] = time.time()
        logger.info(f"Yahoo Spark: {len(result)}/{len(symbols)} hisse, {elapsed:.2f}s")
        return result

    except Exception as e:
        elapsed = time.time() - t0
        _stats["yahoo_spark"]["fail"] += 1
        logger.warning(f"Yahoo Spark HATA ({elapsed:.2f}s): {e}")
        return result  # Kısmi sonuç döndürebilir


# ════════════════════════════════════════════
# 3) ANA FONKSİYON — Akıllı Fallback Zinciri
#    TradingView → Yahoo Spark → (yfinance main.py'de)
# ════════════════════════════════════════════

def fetch_live_prices(symbols: list[str]) -> tuple[dict[str, dict], str]:
    """
    Canlı fiyatları çeker. Önce TradingView, başarısızsa Yahoo Spark.
    
    Args:
        symbols: Sembol listesi (ör. ["ASELS", "GARAN", ...])
        
    Returns:
        tuple: (prices_dict, provider_name)
            prices_dict: {symbol: {"price": float, "change": float, ...}}
            provider_name: "tradingview" | "yahoo_spark" | "none"
    """
    # 1) TradingView (birincil — tek istekte hepsini çeker)
    prices = fetch_tradingview_prices(symbols)
    if len(prices) >= len(symbols) * 0.7:  # %70+ başarı
        # Eksik olanlar varsa Yahoo'dan tamamla
        missing = [s for s in symbols if s not in prices]
        if missing:
            yahoo_fill = fetch_yahoo_spark_prices(missing)
            prices.update(yahoo_fill)
            logger.info(f"TradingView + Yahoo tamamlama: {len(yahoo_fill)} ek hisse")
        return prices, "tradingview"

    # 2) Yahoo Finance Spark (yedek)
    logger.warning(f"TradingView yetersiz ({len(prices)}/{len(symbols)}), Yahoo Spark deneniyor...")
    yahoo_prices = fetch_yahoo_spark_prices(symbols)
    if yahoo_prices:
        # TradingView'den gelen kısmi sonuçları da ekle
        for sym, data in prices.items():
            if sym not in yahoo_prices:
                yahoo_prices[sym] = data
        return yahoo_prices, "yahoo_spark"

    # 3) Her iki kaynak da başarısız
    logger.error("TÜM canlı fiyat kaynakları başarısız!")
    return prices, "none"  # TradingView kısmi sonuç varsa onu döndür
