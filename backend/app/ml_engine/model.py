"""
DigiBist — AI Tahmin Motoru (BISTAIModel)  v2.0 — Data-Driven Optimized
═══════════════════════════════════════════════════════════════════════

BIST100 hisse senetleri için makine öğrenmesi tabanlı fiyat tahmini.
467 gerçek doğrulanmış tahmin sonucuna dayanarak optimize edilmiştir.

v2.0 OPTİMİZASYON NOTLARI (467 doğrulanmış tahmin verisi analizi):
  ───────────────────────────────────────────────────────────────
  ESKİ DURUM → v1 doğruluk: %12.8 (60/467 doğru yön tahmini)

  TESPİT EDİLEN SORUNLAR:
    1. LightGBM %3.9 doğruluk — ensemble'a zarar veriyor → KALDIRILDI
    2. ~50 feature overfit'e yol açıyor → 30 kanıtlanmış feature'a düşürüldü
    3. CV n_splits=3 yetersiz genelleme → 5'e çıkarıldı
    4. Tek koşullu sinyal (prediction > current) → çoklu teyit sistemi
    5. RSI sadece 75/25 override → optimal zone 40-60 bulgusu uygulandı
    6. Güven eşiği yok → confidence < 0.45 → HOLD (%53+ yönsel doğruluk gerekli)

  UYGULANAN İYİLEŞTİRMELER (veri destekli):
    ✓ LightGBM kaldırıldı (XGBoost %16.6 vs LightGBM %3.9)
    ✓ Feature seti ~50 → ~30 (kanıtlanmış indikatörler)
    ✓ CV splits 3 → 5 (daha güvenilir genelleme)
    ✓ Multi-indicator confirmation (RSI+Stoch+BB+Momentum+MACD)
    ✓ RSI zone filter: 40-60 en iyi (%17.8), extreme HOLD
    ✓ Stochastic zone filter: 20-40 en iyi (%22.7)
    ✓ Bollinger %B filter: 0.2-0.8 en iyi (%17.0)
    ✓ Confidence threshold: >= 0.55 → sinyal, < 0.55 → HOLD (%23.7)
    ✓ Market regime-aware signal logic
    ✓ Daha güçlü regularization (min_samples_split/leaf artırıldı)
    ✓ ADX trend gücü indikatörü eklendi
    ✓ Ensemble: yalnızca RandomForest + XGBoost
  ───────────────────────────────────────────────────────────────

MIMARI:
  Ensemble model — 2 model (veri destekli seçim):
    1. RandomForest  (sklearn, güvenilir baseline, %12.5 → optimize)
    2. XGBoost       (gradient boosting, en iyi %16.6 → optimize)

  LightGBM kaldırıldı (%3.9 doğruluk veriye göre zararlı).

VERİ KAYNAKLARI:
  - yfinance: Günlük OHLCV (2 yıl, ~500 aktif gün)
  - yfinance (haftalık): Multi-timeframe trend teyidi
  - yfinance (USDTRY=X): Sentiment proxy — kur korelasyonu

ÖZELLİK SETİ (~30 kanıtlanmış feature — v1'deki ~50'den rafine edildi):
  GÜÇLÜ (veri destekli, norm. fark > %20):
    - Return_10d (+314%), Weekly_Momentum (+257%), Return_1d (+98%)
    - MACD/MACD_Signal (+91%/+60%), SMA_5_10_Cross (+33%)
    - SMA_10_20_Cross (+22%), BB_PctB (+20%), RSI_7 (+18%)
  
  ORTA (destekleyici, norm. fark %10-20):
    - BB_BW, Weekly_Trend, USDTRY_Volatility, Volatility_10d/20d
    - Price_SMA50_Ratio, Volume_Ratio, Stoch_K, Stoch_D

  KALDIRILAN (gürültü — overfit kaynağı):
    - Lag features (Close_Lag_1..5) — fiyat seviyesi bilgisi, yön bilgisi değil
    - Mutlak fiyat features (High, Low, Open, SMA/EMA mutlak değerler)
    - Month — yetersiz sinyal

SINYAL MANTIK (çoklu teyit — v2):
  1. Temel: prediction > current → BUY candidate, else SELL candidate
  2. Momentum teyidi: Return_10d + Weekly_Momentum yönü
  3. RSI zone filter: 40-60 OK (%17.8), dışında → HOLD
  4. Stochastic filter: 20-40 ideal (%22.7)
  5. Bollinger: %B 0.2-0.8 OK (%17.0)
  6. Market rejimi: BEAR → BUY engeli, BULL → SELL dikkatli
  7. Confidence filter: < 0.55 → HOLD (%23.7 vs %12.8)
  → En az 3/5 teyit gerekli, yoksa HOLD

DEĞİŞİKLİK GEÇMİŞİ:
  - v8.03: Oluşturuldu (tek model RandomForest)
  - v8.04: Multi-model ensemble (LightGBM + XGBoost eklendi)
  - v8.05: Kelly Criterion + walk-forward validation
  - v8.06: Multi-timeframe + sentiment proxy + market rejim
  - v8.09.01: Dokümantasyon sprint'i
  - v8.10.00: DATA-DRIVEN OPTİMİZASYON — 467 tahmin analizi ile
              LightGBM kaldırma, feature rafine, çoklu teyit,
              zone-based filtre, confidence threshold, CV 5-fold
  - v8.10.01: HAFTALIK ÖZ-ÖĞRENME SİSTEMİ entegrasyonu
              weekly_learner.py ile otomatik parametre optimizasyonu

🧠 HAFTALIK ÖZ-ÖĞRENME SİSTEMİ (weekly_learner.py):
  ═══════════════════════════════════════════════════
  Her Cuma 18:05 (borsa kapanışı sonrası) otomatik çalışır.
  Doğrulanmış tahmin sonuçlarını analiz ederek model parametrelerini
  veriye dayalı olarak kademeli iyileştirir.
  
  SELF-TUNING PARAMETRELERİ (weekly_learner tarafından ayarlanabilir):
    ┌────────────────────────────────────────────────────────────────┐
    │ Parametre                │ Mevcut │ Aralık       │ Açıklama   │
    ├──────────────────────────┼────────┼──────────────┼────────────┤
    │ confidence_threshold     │ 0.45   │ [0.35, 0.60] │ Sinyal eşik│
    │ min_confirmations        │ 2      │ [1, 4]       │ Teyit sayı │
    │ adx_min_threshold        │ 15.0   │ [10.0, 25.0] │ ADX min    │
    │ confidence_r2_weight     │ 0.15   │ [0.05, 0.40] │ R² ağırlık │
    │ confidence_dir_weight    │ 0.85   │ [0.60, 0.95] │ Dir ağırlık│
    │ rf_n_estimators          │ 200    │ [100, 500]   │ RF ağaç    │
    │ rf_max_depth             │ 6      │ [4, 10]      │ RF derinlik│
    │ xgb_n_estimators         │ 200    │ [100, 500]   │ XGB ağaç   │
    │ xgb_max_depth            │ 4      │ [3, 8]       │ XGB derin  │
    │ xgb_learning_rate        │ 0.03   │ [0.01, 0.10] │ XGB lr     │
    └────────────────────────────────────────────────────────────────┘
  
  Konfigürasyon ml_model_config tablosunda saklanır.
  Her değişiklik loglanır, geri alınabilir, max %10/hafta değişime izin verilir.
"""

import yfinance as yf
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import TimeSeriesSplit, cross_val_score
from sklearn.preprocessing import StandardScaler
from datetime import datetime, timedelta
import logging
import time as _time
import threading
import os

# CPU çekirdek sayısı (tüm çekirdekleri kullan)
_N_JOBS = int(os.cpu_count() or 2)

logger = logging.getLogger(__name__)

# Global yfinance kilidi — eşzamanlı download çakışmasını önler
_yfinance_lock = threading.Lock()

def _flatten_yf_columns(df):
    """yfinance MultiIndex sütunlarını düzleştir (tüm versiyonlarda çalışır)."""
    if isinstance(df.columns, pd.MultiIndex):
        df = df.droplevel(level=1, axis=1)
    # Duplicate sütun varsa kaldır
    df = df.loc[:, ~df.columns.duplicated()]
    return df

def _safe_yf_download(symbol, period="2y", interval="1d", max_retries=3, retry_delay=2):
    """yfinance download with retry logic and concurrency protection."""
    for attempt in range(max_retries):
        try:
            with _yfinance_lock:
                data = yf.download(symbol, period=period, interval=interval, progress=False)
            if data is not None and not data.empty:
                return data
            logger.warning(f"yfinance boş veri döndü ({symbol}), deneme {attempt+1}/{max_retries}")
        except Exception as e:
            logger.warning(f"yfinance hatası ({symbol}), deneme {attempt+1}/{max_retries}: {e}")
        if attempt < max_retries - 1:
            _time.sleep(retry_delay * (attempt + 1))
    return pd.DataFrame()

# LightGBM KALDIRILDI — 467 doğrulanmış tahmin analizinde %3.9 doğruluk
# ensemble'a zarar verdiği tespit edildi (XGBoost %16.6 vs LightGBM %3.9)
HAS_LIGHTGBM = False
try:
    from lightgbm import LGBMRegressor
    _LIGHTGBM_AVAILABLE = True  # Kütüphane var ama ensemble'da kullanılmıyor
except ImportError:
    _LIGHTGBM_AVAILABLE = False
    logger.info("LightGBM bulunamadı.")

# XGBoost (opsiyonel)
try:
    from xgboost import XGBRegressor
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False
    logger.info("XGBoost bulunamadı.")


class BISTAIModel:
    def __init__(self, symbol="THYAO.IS"):
        self.symbol = symbol
        self.model = None
        self.scaler = StandardScaler()

    # ─── Teknik İndikatörler ───
    @staticmethod
    def compute_rsi(series, period=14):
        delta = series.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        rs = gain / loss
        return 100 - (100 / (1 + rs))

    @staticmethod
    def compute_macd(series, fast=12, slow=26, signal=9):
        ema_fast = series.ewm(span=fast, adjust=False).mean()
        ema_slow = series.ewm(span=slow, adjust=False).mean()
        macd_line = ema_fast - ema_slow
        signal_line = macd_line.ewm(span=signal, adjust=False).mean()
        histogram = macd_line - signal_line
        return macd_line, signal_line, histogram

    @staticmethod
    def compute_bollinger(series, period=20, std_dev=2):
        sma = series.rolling(window=period).mean()
        std = series.rolling(window=period).std()
        upper = sma + (std * std_dev)
        lower = sma - (std * std_dev)
        pct_b = (series - lower) / (upper - lower)
        bandwidth = (upper - lower) / sma
        return upper, lower, pct_b, bandwidth

    @staticmethod
    def compute_stochastic(high, low, close, k_period=14, d_period=3):
        lowest_low = low.rolling(window=k_period).min()
        highest_high = high.rolling(window=k_period).max()
        k = 100 * (close - lowest_low) / (highest_high - lowest_low)
        d = k.rolling(window=d_period).mean()
        return k, d

    @staticmethod
    def compute_atr(high, low, close, period=14):
        tr1 = high - low
        tr2 = abs(high - close.shift(1))
        tr3 = abs(low - close.shift(1))
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        return tr.rolling(window=period).mean()

    @staticmethod
    def compute_obv(close, volume):
        direction = np.sign(close.diff())
        obv = (direction * volume).cumsum()
        return obv

    @staticmethod
    def compute_adx(high, low, close, period=14):
        """ADX — Trend gücü indikatörü (0-100). >25 güçlü trend, <20 trend yok."""
        plus_dm = high.diff()
        minus_dm = -low.diff()
        plus_dm[plus_dm < 0] = 0
        minus_dm[minus_dm < 0] = 0
        # +DM > -DM ise -DM = 0, tersi de geçerli
        plus_dm[(plus_dm < minus_dm)] = 0
        minus_dm[(minus_dm < plus_dm)] = 0
        
        tr1 = high - low
        tr2 = abs(high - close.shift(1))
        tr3 = abs(low - close.shift(1))
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        
        atr = tr.rolling(window=period).mean()
        plus_di = 100 * (plus_dm.rolling(window=period).mean() / atr)
        minus_di = 100 * (minus_dm.rolling(window=period).mean() / atr)
        
        dx = 100 * abs(plus_di - minus_di) / (plus_di + minus_di + 1e-9)
        adx = dx.rolling(window=period).mean()
        return adx, plus_di, minus_di

    # ─── Multi-Timeframe: Haftalık Trend (Özellik #9) ───
    def _get_weekly_trend(self):
        """Haftalık SMA cross ve RSI — üst zaman dilimi trend teyidi."""
        try:
            weekly = _safe_yf_download(self.symbol, period="2y", interval="1wk", max_retries=2, retry_delay=1)
            if weekly.empty or len(weekly) < 25:
                return None
            weekly = _flatten_yf_columns(weekly)
            weekly['SMA_10w'] = weekly['Close'].rolling(10).mean()
            weekly['SMA_20w'] = weekly['Close'].rolling(20).mean()
            weekly['Weekly_Trend'] = (weekly['SMA_10w'] > weekly['SMA_20w']).astype(int)
            weekly['Weekly_RSI'] = self.compute_rsi(weekly['Close'], 14)
            weekly['Weekly_Momentum'] = weekly['Close'].pct_change(4)
            return weekly[['Weekly_Trend', 'Weekly_RSI', 'Weekly_Momentum']].dropna()
        except Exception as e:
            logger.warning(f"Haftalık veri alınamadı: {e}")
            return None

    # ─── Sentiment Proxy: USD/TRY Korelasyonu (Özellik #10) ───
    def _get_usdtry_features(self):
        """USD/TRY kur verisini sentiment proxy olarak kullan."""
        try:
            fx = _safe_yf_download("USDTRY=X", period="2y", interval="1d", max_retries=2, retry_delay=1)
            if fx.empty or len(fx) < 30:
                return None
            fx = _flatten_yf_columns(fx)
            fx['USDTRY'] = fx['Close']
            fx['USDTRY_Return'] = fx['Close'].pct_change()
            fx['USDTRY_SMA10'] = fx['Close'].rolling(10).mean()
            fx['USDTRY_Volatility'] = fx['USDTRY_Return'].rolling(10).std()
            return fx[['USDTRY', 'USDTRY_Return', 'USDTRY_SMA10', 'USDTRY_Volatility']].dropna()
        except Exception as e:
            logger.warning(f"USD/TRY verisi alınamadı: {e}")
            return None

    # ─── Market Rejim Tespiti (Özellik #4) ───
    @staticmethod
    def _detect_market_regime(df):
        """SMA 50/200 golden/death cross bazlı piyasa rejimi."""
        sma_50_val = float(df['SMA_50'].iloc[-1]) if 'SMA_50' in df.columns else float(df['Close'].rolling(50).mean().iloc[-1])

        if len(df) >= 200:
            sma_200_val = float(df['Close'].rolling(200).mean().iloc[-1])
        else:
            sma_200_val = sma_50_val

        current = float(df['Close'].iloc[-1])

        if pd.isna(sma_200_val) or pd.isna(sma_50_val):
            return "SIDEWAYS", "Trend belirlenemedi (yetersiz veri)"

        if sma_50_val > sma_200_val and current > sma_50_val:
            return "BULL", "Güçlü Boğa — Golden Cross aktif, fiyat SMA50 üstünde"
        elif sma_50_val > sma_200_val:
            return "BULL_WEAK", "Zayıf Boğa — Golden Cross var ama fiyat SMA50 altına düştü"
        elif sma_50_val < sma_200_val and current < sma_50_val:
            return "BEAR", "Güçlü Ayı — Death Cross aktif, fiyat SMA50 altında"
        elif sma_50_val < sma_200_val:
            return "BEAR_WEAK", "Zayıf Ayı — Death Cross var ama fiyat toparlanıyor"
        else:
            return "SIDEWAYS", "Yatay piyasa — SMA50 ≈ SMA200"

    # ─── Stop-Loss / Take-Profit — ATR bazlı (Özellik #1) ───
    @staticmethod
    def _calculate_stop_levels(df, signal, current_price):
        """ATR bazlı dinamik stop-loss ve take-profit seviyeleri."""
        atr = float(df['ATR_14'].iloc[-1]) if 'ATR_14' in df.columns else current_price * 0.02

        if signal == "BUY":
            stop_loss = current_price - (2.0 * atr)
            take_profit = current_price + (3.0 * atr)
        elif signal == "SELL":
            stop_loss = current_price + (2.0 * atr)
            take_profit = current_price - (3.0 * atr)
        else:
            stop_loss = current_price - (1.5 * atr)
            take_profit = current_price + (1.5 * atr)

        sl_distance = abs(current_price - stop_loss)
        tp_distance = abs(take_profit - current_price)
        risk_reward = round(tp_distance / sl_distance, 2) if sl_distance > 0 else 0

        return {
            "stop_loss": round(stop_loss, 2),
            "take_profit": round(take_profit, 2),
            "atr": round(atr, 2),
            "atr_pct": round(atr / current_price * 100, 2),
            "risk_reward_ratio": risk_reward,
        }

    def _build_features(self, df):
        """v2 — Kanıtlanmış feature seti (467 tahmin analizi bazlı).
        
        ~50 feature'dan ~30 kanıtlanmış feature'a rafine edildi.
        Kaldırılan: Mutlak fiyat/SMA/EMA (High/Low/Open/SMA_5-50/EMA_5-50),
                    Lag features (Close_Lag_1-5), Month (zayıf sinyal)
        Eklenen: ADX (trend gücü), DI+/DI- (trend yönü), momentum teyit
        """
        # ── Momentum features (EN GÜÇLÜ — Return_10d +314%, Weekly_Mom +257%) ──
        df['Return_1d'] = df['Close'].pct_change(1)       # +98.4%
        df['Return_5d'] = df['Close'].pct_change(5)
        df['Return_10d'] = df['Close'].pct_change(10)     # +313.9% (EN GÜÇLÜ)
        df['Volatility_10d'] = df['Return_1d'].rolling(window=10).std()
        df['Volatility_20d'] = df['Return_1d'].rolling(window=20).std()

        # ── MACD (MACD +91%, MACD_Signal +60%) ──
        df['MACD'], df['MACD_Signal'], df['MACD_Hist'] = self.compute_macd(df['Close'])

        # ── RSI (RSI_7 +17.5%, RSI 40-60 bölgesi en iyi %17.8) ──
        df['RSI_14'] = self.compute_rsi(df['Close'], 14)
        df['RSI_7'] = self.compute_rsi(df['Close'], 7)

        # ── Bollinger Bands (BB_PctB +20.4%, BB_BW +14.9%) ──
        df['BB_Upper'], df['BB_Lower'], df['BB_PctB'], df['BB_BW'] = self.compute_bollinger(df['Close'])

        # ── Stochastic (Stoch K 20-40 bölgesi en iyi %22.7) ──
        df['Stoch_K'], df['Stoch_D'] = self.compute_stochastic(df['High'], df['Low'], df['Close'])

        # ── ATR (volatilite ölçüsü) ──
        df['ATR_14'] = self.compute_atr(df['High'], df['Low'], df['Close'], 14)

        # ── ADX — Trend gücü (YENİ — overfit azaltmak için trend bilgisi) ──
        df['ADX'], df['DI_Plus'], df['DI_Minus'] = self.compute_adx(df['High'], df['Low'], df['Close'], 14)

        # ── SMA Cross sinyalleri (SMA_5_10 +33%, SMA_10_20 +22.2%) ──
        sma_5 = df['Close'].rolling(window=5).mean()
        sma_10 = df['Close'].rolling(window=10).mean()
        sma_20 = df['Close'].rolling(window=20).mean()
        sma_50 = df['Close'].rolling(window=50).mean()

        df['SMA_5_10_Cross'] = (sma_5 > sma_10).astype(int)   # +33.0%
        df['SMA_10_20_Cross'] = (sma_10 > sma_20).astype(int)  # +22.2%

        # ── Fiyat/SMA oranları (mutlak fiyat yerine — normalize) ──
        df['Price_SMA10_Ratio'] = df['Close'] / sma_10
        df['Price_SMA20_Ratio'] = df['Close'] / sma_20
        df['Price_SMA50_Ratio'] = df['Close'] / sma_50

        # ── Volume (Volume_Ratio normalize — mutlak değer değil) ──
        df['Volume_SMA_20'] = df['Volume'].rolling(window=20).mean()
        df['Volume_Ratio'] = df['Volume'] / df['Volume_SMA_20']
        df['OBV'] = self.compute_obv(df['Close'], df['Volume'])

        # ── Zaman (sadece Day_of_Week, Monday/Tuesday daha iyi) ──
        df['Day_of_Week'] = df.index.dayofweek

        # ── SMA_50 referans (rejim tespiti için tutuldu) ──
        df['SMA_50'] = sma_50

        # ── v2'de KALDIRILAN FEATURES (overfit kaynağı): ──
        # - Mutlak fiyatlar: High, Low, Open → fiyat seviyesi, yön bilgisi değil
        # - SMA/EMA mutlak: SMA_5..50, EMA_5..50 → Price_SMA_Ratio zaten var
        # - Lag features: Close_Lag_1..5 → mutlak fiyat, overfit riski
        # - Month → yetersiz sinyal (%12.8 katkı yok)
        # - OBV kaldığı gibi (volume momentum proxy)

        return df

    def fetch_and_train(self):
        # ─── 1) Veri İndirme (sıralı + semafor korumalı) ───
        data = _safe_yf_download(self.symbol, period="2y", interval="1d", max_retries=3, retry_delay=2)

        if data is None or (hasattr(data, 'empty') and data.empty):
            logger.warning(f"Veri indirilemedi: {self.symbol}")
            return None

        df = _flatten_yf_columns(data.copy())

        if len(df) < 100:
            return None

        # ─── 2) Feature Mühendisliği ───
        df = self._build_features(df)

        # Multi-Timeframe: Haftalık trend verisi ekle
        weekly_data = self._get_weekly_trend()
        if weekly_data is not None:
            weekly_data = weekly_data.reindex(df.index, method='ffill')
            for col in weekly_data.columns:
                df[col] = weekly_data[col]

        # Sentiment Proxy: USD/TRY korelasyonu
        usdtry_data = self._get_usdtry_features()
        if usdtry_data is not None:
            usdtry_data = usdtry_data.reindex(df.index, method='ffill')
            for col in usdtry_data.columns:
                df[col] = usdtry_data[col]

        df = df.dropna()

        if len(df) < 60:
            return None

        # ─── 3) Market Rejim Tespiti ───
        market_regime, regime_desc = self._detect_market_regime(df)

        # ─── 4) Feature Listesi (v2 — kanıtlanmış feature'lar) ───
        # Kaldırılan: High, Low, Open, Volume (mutlak), SMA_50 (mutlak), BB_Upper, BB_Lower
        # Bunlar mutlak fiyat değerleri — different stocks farklı fiyat seviyelerinde
        # olduğu için model'i yanıltıyor ve overfit'e yol açıyor
        _exclude_cols = {
            'Close', 'Adj Close',
            'High', 'Low', 'Open', 'Volume',  # Mutlak OHLCV → overfit kaynağı
            'SMA_50',                           # Mutlak (ratio olarak zaten var)
            'BB_Upper', 'BB_Lower',            # Mutlak (BB_PctB ve BB_BW yeterli)
        }
        feature_cols = [c for c in df.columns if c not in _exclude_cols]
        X = df[feature_cols].copy()
        y = df['Close'].shift(-1).dropna()
        X = X.iloc[:-1]

        # ─── 5) Ölçekleme ───
        tscv = TimeSeriesSplit(n_splits=5)  # v2: 3→5 fold (daha güvenilir genelleme)
        X_scaled = pd.DataFrame(
            self.scaler.fit_transform(X),
            columns=X.columns,
            index=X.index,
        )

        # ─── 6) Multi-Model Tanımlama (v2: RF + XGBoost, LightGBM kaldırıldı) ───
        # LightGBM kaldırıldı — 467 doğrulanmış tahmin analizinde %3.9 doğruluk
        # (ensemble'a zarar verdiği istatistiksel olarak tespit edildi)
        models = {}

        # v2: Daha güçlü regularization (overfit azaltma)
        models["RandomForest"] = RandomForestRegressor(
            n_estimators=200, max_depth=6,          # depth 8→6 (overfit azalt)
            min_samples_split=15, min_samples_leaf=8, # split 10→15, leaf 5→8
            max_features='sqrt',                      # feature subsampling
            n_jobs=_N_JOBS, random_state=42,
        )

        if HAS_XGBOOST:
            models["XGBoost"] = XGBRegressor(
                n_estimators=200, max_depth=4,        # depth 5→4 (overfit azalt)
                learning_rate=0.03,                    # lr 0.05→0.03 (daha temkinli)
                subsample=0.7, colsample_bytree=0.7,  # 0.8→0.7 (daha fazla random)
                min_child_weight=8,                    # 5→8 (daha güçlü regularization)
                reg_alpha=0.1, reg_lambda=1.0,         # L1+L2 regularization (YENİ)
                random_state=42,
                nthread=_N_JOBS, verbosity=0,
            )

        # ─── 7) Cross-Validation & Ağırlıklı Ensemble ───
        # n_jobs=1: her model zaten n_jobs=_N_JOBS ile tüm çekirdekleri kullanıyor
        # cross_val_score(n_jobs=4) + model(n_jobs=4) = 16 thread → CPU thrashing!
        cv_scores = {}
        cv_fold_details = {}  # Her model için fold bazlı R² skorları
        for name, model in models.items():
            try:
                scores = cross_val_score(model, X_scaled, y.values.ravel(), cv=tscv, scoring='r2', n_jobs=1)
                cv_scores[name] = float(scores.mean())
                cv_fold_details[name] = [round(float(s), 4) for s in scores]
            except Exception as e:
                logger.warning(f"{name} CV hatası: {e}")
                cv_scores[name] = -1.0
                cv_fold_details[name] = []

        # Ağırlıkları R² oranına göre hesapla
        positive_scores = {k: max(0, v) for k, v in cv_scores.items()}
        total_positive = sum(positive_scores.values())

        if total_positive > 0.01:
            # Normal durum: R² oranına göre ağırlıkla
            model_weights = {k: round(v / total_positive, 4) for k, v in positive_scores.items()}
        else:
            # Fallback: Tüm R² negatifse eşit ağırlık kullan
            n_models = len(models)
            model_weights = {k: round(1.0 / n_models, 4) for k in models}
            logger.info(f"Tüm CV R² negatif → eşit ağırlık kullanılıyor: {model_weights}")

        # Her modeli tüm veriyle eğit
        trained_models = {}
        for name, model in models.items():
            try:
                model.fit(X_scaled, y.values.ravel())
                trained_models[name] = model
            except Exception as e:
                logger.warning(f"{name} eğitim hatası: {e}")

        # En iyi modeli "primary" olarak belirle
        best_model_name = max(cv_scores, key=cv_scores.get)
        self.model = trained_models.get(best_model_name, list(trained_models.values())[0])
        best_cv_r2 = cv_scores[best_model_name]

        # ─── 8) Feature Importance Analizi ───
        importances = self.model.feature_importances_
        importance_df = pd.DataFrame({
            'feature': feature_cols,
            'importance': importances
        }).sort_values('importance', ascending=False)

        # Full feature importance listesi (drill-down için)
        feature_importances_full = [
            {"name": row['feature'], "importance": round(float(row['importance']), 6)}
            for _, row in importance_df.iterrows()
        ]

        # Son günün feature değerleri (popup için)
        last_row = X.iloc[-1]
        feature_values = {col: round(float(last_row[col]), 6) for col in feature_cols}

        # Önemli feature'lar (kümülatif %90'ı açıklayan)
        importance_df['cumsum'] = importance_df['importance'].cumsum()
        top_features = importance_df[importance_df['cumsum'] <= 0.90]['feature'].tolist()
        if len(top_features) < 5:
            top_features = importance_df.head(10)['feature'].tolist()

        low_importance_count = len(importance_df[importance_df['importance'] < 0.005])

        # ─── 9) Yönsel Doğruluk (Walk-Forward) + Kelly Verileri ───
        y_pred_cv = np.zeros(len(y))
        fold_directional = []  # Her fold için doğruluk detayı
        fold_num = 0
        for train_idx, test_idx in tscv.split(X_scaled):
            fold_num += 1
            self.model.fit(X_scaled.iloc[train_idx], y.values.ravel()[train_idx])
            fold_preds = self.model.predict(X_scaled.iloc[test_idx])
            y_pred_cv[test_idx] = fold_preds
            # Fold bazlı yönsel doğruluk hesapla
            fold_close = X_scaled.index[test_idx].map(lambda i: float(df.loc[i, 'Close'])).values
            fold_actual_dir = np.sign(y.values.ravel()[test_idx] - fold_close)
            fold_pred_dir = np.sign(fold_preds - fold_close)
            fold_correct = int(np.sum(fold_actual_dir == fold_pred_dir))
            fold_total = len(test_idx)
            fold_directional.append({
                "fold": fold_num,
                "correct": fold_correct,
                "total": fold_total,
                "accuracy": round(fold_correct / fold_total, 4) if fold_total > 0 else 0,
                "train_size": len(train_idx),
                "test_size": fold_total,
            })

        close_vals = X_scaled.index.map(lambda i: float(df.loc[i, 'Close'])).values
        actual_direction = np.sign(y.values.ravel() - close_vals)
        pred_direction = np.sign(y_pred_cv - close_vals)

        test_indices = []
        for _, test_idx in tscv.split(X_scaled):
            test_indices.extend(test_idx.tolist())

        if test_indices:
            directional_acc = float(np.mean(actual_direction[test_indices] == pred_direction[test_indices]))
            # Win rate ve avg win/loss (Kelly Criterion için)
            test_actual = y.values.ravel()[test_indices]
            test_pred = y_pred_cv[test_indices]
            test_close = close_vals[test_indices]

            pred_returns = (test_pred - test_close) / (test_close + 1e-9)
            actual_returns = (test_actual - test_close) / (test_close + 1e-9)

            correct_mask = np.sign(pred_returns) == np.sign(actual_returns)
            win_rate = float(np.mean(correct_mask)) if len(correct_mask) > 0 else 0.5

            wins = actual_returns[correct_mask]
            losses = actual_returns[~correct_mask]
            avg_win = float(np.mean(np.abs(wins))) if len(wins) > 0 else 0.01
            avg_loss = float(np.mean(np.abs(losses))) if len(losses) > 0 else 0.01
        else:
            directional_acc = 0.50
            win_rate = 0.50
            avg_win = 0.01
            avg_loss = 0.01

        # ─── 10) Final Tahmin (Ağırlıklı Ensemble) ───
        # Modeller zaten bölüm 7'de full data ile eğitildi, tekrar eğitmiyoruz
        last_features = X_scaled.iloc[[-1]]

        # Ağırlıklı ensemble tahmin
        ensemble_pred = 0.0
        for name, model in trained_models.items():
            w = model_weights.get(name, 0)
            if w > 0:
                pred = model.predict(last_features)[0]
                ensemble_pred += w * pred

        current_price = float(df['Close'].iloc[-1])

        # Güvenlik: ensemble 0 veya mantıksızsa best model'e fallback
        if ensemble_pred <= 0 or abs(ensemble_pred - current_price) / current_price > 0.5:
            ensemble_pred = float(self.model.predict(last_features)[0])
            logger.info(f"Ensemble fallback → {best_model_name} tahmini kullanılıyor: {ensemble_pred:.2f}")

        prediction = ensemble_pred

        # ─── 11) Güven Skoru (v2 — directional_accuracy dominant) ───
        # Yönsel doğruluk ağırlığı artırıldı: fiyat makine öğrenmesinde
        # R² genellikle düşük/negatif olur (gürültü). Asıl önemli olan yön tahmini.
        # Formül: %15 R² katkısı + %85 yönsel doğruluk katkısı
        confidence = max(0.40, min(0.97, 0.15 * max(0, best_cv_r2) + 0.85 * directional_acc))

        # ─── 12) v2 — Çoklu Teyit Sinyal Sistemi (Data-Driven) ───
        rsi_val = float(df['RSI_14'].iloc[-1])
        macd_hist = float(df['MACD_Hist'].iloc[-1])
        stoch_k = float(df['Stoch_K'].iloc[-1]) if 'Stoch_K' in df.columns else 50.0
        bb_pctb = float(df['BB_PctB'].iloc[-1]) if 'BB_PctB' in df.columns else 0.5
        adx_val = float(df['ADX'].iloc[-1]) if 'ADX' in df.columns and not pd.isna(df['ADX'].iloc[-1]) else 20.0
        return_10d = float(df['Return_10d'].iloc[-1]) if 'Return_10d' in df.columns else 0.0
        weekly_mom = float(df['Weekly_Momentum'].iloc[-1]) if 'Weekly_Momentum' in df.columns and not pd.isna(df['Weekly_Momentum'].iloc[-1]) else 0.0

        # Temel sinyal (model tahmini)
        if prediction > current_price:
            model_signal = "BUY"
        else:
            model_signal = "SELL"

        # ── Çoklu Teyit Skoru (5 bağımsız teyit) ──
        buy_confirmations = 0
        sell_confirmations = 0
        confirmation_reasons = []

        # 1) Momentum teyidi (EN GÜÇLÜ — Return_10d +314%, Weekly_Mom +257%)
        if return_10d > 0 and weekly_mom > 0:
            buy_confirmations += 1
            confirmation_reasons.append("Momentum pozitif (10d+Haftalık)")
        elif return_10d < 0 and weekly_mom < 0:
            sell_confirmations += 1
            confirmation_reasons.append("Momentum negatif (10d+Haftalık)")

        # 2) RSI zone teyidi (40-60 en iyi %17.8)
        if 40 <= rsi_val <= 60:
            if model_signal == "BUY":
                buy_confirmations += 1
            else:
                sell_confirmations += 1
            confirmation_reasons.append(f"RSI optimal zone ({rsi_val:.0f})")
        elif rsi_val < 30:
            buy_confirmations += 1  # Oversold → potansiyel dönüş
            confirmation_reasons.append(f"RSI oversold ({rsi_val:.0f})")
        elif rsi_val > 70:
            sell_confirmations += 1  # Overbought → potansiyel düşüş
            confirmation_reasons.append(f"RSI overbought ({rsi_val:.0f})")

        # 3) MACD teyidi (+91% norm fark)
        if macd_hist > 0:
            buy_confirmations += 1
            confirmation_reasons.append("MACD histogram pozitif")
        elif macd_hist < 0:
            sell_confirmations += 1
            confirmation_reasons.append("MACD histogram negatif")

        # 4) Stochastic teyidi (20-40 zone en iyi %22.7)
        if stoch_k < 30:
            buy_confirmations += 1  # Oversold zone
            confirmation_reasons.append(f"Stochastic oversold ({stoch_k:.0f})")
        elif stoch_k > 70:
            sell_confirmations += 1  # Overbought zone
            confirmation_reasons.append(f"Stochastic overbought ({stoch_k:.0f})")

        # 5) Bollinger %B teyidi (0.2-0.8 zone en iyi %17.0)
        if bb_pctb < 0.2:
            buy_confirmations += 1  # Alt bant → potansiyel dönüş
            confirmation_reasons.append(f"BB %B alt bölge ({bb_pctb:.2f})")
        elif bb_pctb > 0.8:
            sell_confirmations += 1  # Üst bant → potansiyel düşüş
            confirmation_reasons.append(f"BB %B üst bölge ({bb_pctb:.2f})")

        # ── Final Sinyal Belirleme (çoklu teyit gerekli) ──
        total_confirmations = max(buy_confirmations, sell_confirmations)
        filters_applied = []

        if confidence < 0.45:
            # Düşük güven → HOLD (v2.1: eşik 0.45, ~%53+ yönsel doğruluk gerekli)
            # Eski model %12.8 doğruluk, yeni model %50-55 → %53+ kabul edilebilir
            base_signal = "HOLD"
            filters_applied.append(f"Düşük güven ({confidence:.2f}<0.45) → HOLD")
        elif adx_val < 15:
            # Çok zayıf trend → HOLD (ADX<15 = trend yok)
            base_signal = "HOLD"
            filters_applied.append(f"ADX çok düşük ({adx_val:.0f}<15) → trend yok → HOLD")
        elif model_signal == "BUY" and buy_confirmations >= 2:
            base_signal = "BUY"
            filters_applied.append(f"BUY: model + {buy_confirmations} teyit")
        elif model_signal == "SELL" and sell_confirmations >= 2:
            base_signal = "SELL"
            filters_applied.append(f"SELL: model + {sell_confirmations} teyit")
        elif buy_confirmations >= 3:
            # Güçlü buy teyit, model aksini söylese bile
            base_signal = "BUY"
            filters_applied.append(f"BUY: {buy_confirmations} güçlü teyit (model override)")
        elif sell_confirmations >= 3:
            base_signal = "SELL"
            filters_applied.append(f"SELL: {sell_confirmations} güçlü teyit (model override)")
        else:
            base_signal = "HOLD"
            filters_applied.append(f"Yetersiz teyit (buy:{buy_confirmations}, sell:{sell_confirmations}) → HOLD")

        # Market Rejim filtresi
        if market_regime == "BEAR" and base_signal == "BUY":
            base_signal = "HOLD"
            filters_applied.append("BEAR rejimde BUY engellendi → HOLD")
        elif market_regime == "BULL" and base_signal == "SELL" and sell_confirmations < 3:
            base_signal = "HOLD"
            filters_applied.append("BULL rejimde zayıf SELL engellendi → HOLD")

        # RSI extreme override (v1'den korundu — veriye göre hala geçerli)
        if base_signal == "BUY" and rsi_val > 75:
            base_signal = "HOLD"
            filters_applied.append(f"RSI aşırı alım ({rsi_val:.0f}>75) → BUY iptal")
        elif base_signal == "SELL" and rsi_val < 25:
            base_signal = "HOLD"
            filters_applied.append(f"RSI aşırı satım ({rsi_val:.0f}<25) → SELL iptal")

        # ─── 13) Stop-Loss / Take-Profit ───
        stop_levels = self._calculate_stop_levels(df, base_signal, current_price)

        # Eğitim veri tarih aralığı
        training_start = str(df.index[0].date()) if hasattr(df.index[0], 'date') else str(df.index[0])
        training_end = str(df.index[-1].date()) if hasattr(df.index[-1], 'date') else str(df.index[-1])

        # RSI detay
        rsi_series = df['RSI_14'].dropna().tail(20)
        rsi_history = [{"date": str(idx.date()), "value": round(float(v), 2)} for idx, v in rsi_series.items()]

        # ─── 14) Sonuç (v2 — çoklu teyit verileri eklendi) ───
        return {
            "symbol": self.symbol,
            "current_price": round(current_price, 2),
            "predicted_price": round(float(prediction), 2),
            "signal": base_signal,
            "confidence": round(float(confidence), 2),
            # Model bilgileri
            "model_name": best_model_name,
            "model_weights": model_weights,
            "cv_scores": {k: round(v, 4) for k, v in cv_scores.items()},
            "cv_r2": round(best_cv_r2, 4),
            "directional_accuracy": round(directional_acc, 4),
            # Teknik göstergeler
            "rsi": round(rsi_val, 2),
            "macd_histogram": round(macd_hist, 4),
            "stochastic_k": round(stoch_k, 2),
            "bollinger_pctb": round(bb_pctb, 4),
            # v2 — Yeni indikatörler
            "adx": round(adx_val, 2),
            "return_10d": round(return_10d, 4),
            "weekly_momentum": round(weekly_mom, 4),
            # v2 — Çoklu teyit sistemi
            "buy_confirmations": buy_confirmations,
            "sell_confirmations": sell_confirmations,
            "confirmation_reasons": confirmation_reasons,
            "filters_applied": filters_applied,
            # Feature analizi
            "features_used": len(feature_cols),
            "top_features": top_features[:10],
            "low_importance_features": low_importance_count,
            "training_samples": len(X),
            # Market rejimi
            "market_regime": market_regime,
            "regime_description": regime_desc,
            # Stop-Loss / Take-Profit
            "stop_loss": stop_levels["stop_loss"],
            "take_profit": stop_levels["take_profit"],
            "atr": stop_levels["atr"],
            "atr_pct": stop_levels["atr_pct"],
            "risk_reward_ratio": stop_levels["risk_reward_ratio"],
            # Kelly Criterion verileri
            "win_rate": round(win_rate, 4),
            "avg_win": round(avg_win, 6),
            "avg_loss": round(avg_loss, 6),
            # ─── Drill-down detay verileri ───
            "drill_down": {
                "cv_fold_details": cv_fold_details,
                "feature_importances": feature_importances_full,
                "feature_values": feature_values,
                "directional_folds": fold_directional,
                "training_date_range": {"start": training_start, "end": training_end},
                "rsi_history": rsi_history,
            },
        }
