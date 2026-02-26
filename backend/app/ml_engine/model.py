"""
DigiBist — AI Tahmin Motoru (BISTAIModel)
═══════════════════════════════════════════════════════════════════════

BIST100 hisse senetleri için makine öğrenmesi tabanlı fiyat tahmini.

MIMARI:
  Ensemble model — 3 model ağırlıklı ortalama ile çalışır:
    1. LightGBM     (histogram-based gradient boosting, ~5-10x hızlı)
    2. RandomForest  (sklearn, fallback / baseline)
    3. XGBoost       (opsiyonel, gradient boosting OpenMP)

  LightGBM ve XGBoost opsiyoneldir; sadece RandomForest garanti bulunur.
  En iyi CV R² skoruna sahip model "primary" olarak seçilir.

VERİ KAYNAKLARI:
  - yfinance: Günlük OHLCV (2 yıl, ~500 aktif gün)
  - yfinance (haftalık): Multi-timeframe trend teyidi
  - yfinance (USDTRY=X): Sentiment proxy — kur korelasyonu

ÖZELLİK SETİ (~50 feature):
  - Teknik indikatörler: RSI (7,14), MACD, Bollinger Bands, Stochastic, ATR, OBV
  - Hareketli ortalamalar: SMA (5,10,20,50), EMA (5,10,20,50)
  - Fiyat türevleri: Return (1d,5d,10d), Volatility (10d,20d)
  - Cross sinyalleri: SMA 5/10 ve 10/20 golden/death cross
  - Lag features: Close_Lag_1..5
  - Zaman: Day_of_Week, Month
  - Multi-TF: Weekly_Trend, Weekly_RSI, Weekly_Momentum
  - Sentiment: USDTRY, USDTRY_Return, USDTRY_SMA10, USDTRY_Volatility
  - Oran: Price_SMA10/20/50_Ratio

AKIŞ (fetch_and_train):
  1. yfinance → 2y günlük veri indir (thread-safe, retry logic)
  2. _build_features() → ~50 teknik indikatör hesapla
  3. _get_weekly_trend() → haftalık trend teyidi (ffill ile merge)
  4. _get_usdtry_features() → USD/TRY korelasyon verisi
  5. _detect_market_regime() → BULL/BEAR/SIDEWAYS (SMA 50/200 cross)
  6. TimeSeriesSplit(n_splits=3) cross-validation → R² skorları
  7. Model eğitimi (tüm data) + ağırlıklı ensemble tahmin
  8. Feature importance analizi (kümülatif %90)
  9. Walk-forward yönsel doğruluk + Kelly Criterion verileri
  10. ATR bazlı stop-loss / take-profit seviyeleri
  11. Güven skoru: 0.4 * R² + 0.6 * yönsel doğruluk
  12. Sinyal: BUY/SELL/HOLD (RSI extreme override)
  13. Sonuç dict (current_price, prediction, signal, confidence, drill_down...)

PERFORMANS NOTLARI:
  - Toplam ~3-8 saniye/sembol (yfinance indirme ~2-5s, eğitim ~1-2s)
  - _N_JOBS = os.cpu_count() — tüm çekirdekleri kullanır
  - CV n_jobs=1 çünkü model zaten N_JOBS ile parallel çalışır
  - _yfinance_lock → eşzamanlı indirme çakışmasını önler

DEĞİŞİKLİK GEÇMİŞİ:
  - v8.03: Oluşturuldu (tek model RandomForest)
  - v8.04: Multi-model ensemble (LightGBM + XGBoost eklendi)
  - v8.05: Kelly Criterion + walk-forward validation
  - v8.06: Multi-timeframe + sentiment proxy + market rejim
  - v8.09.01: Bu docstring eklendi (tüm proje dokümantasyonu sprint'i)
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

# LightGBM (GradientBoosting yerine ~5-10x daha hızlı)
try:
    from lightgbm import LGBMRegressor
    HAS_LIGHTGBM = True
except ImportError:
    HAS_LIGHTGBM = False
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
        """Zengin feature seti oluştur."""
        # Hareketli Ortalamalar
        for w in [5, 10, 20, 50]:
            df[f'SMA_{w}'] = df['Close'].rolling(window=w).mean()
            df[f'EMA_{w}'] = df['Close'].ewm(span=w, adjust=False).mean()

        # RSI (çoklu periyot)
        df['RSI_14'] = self.compute_rsi(df['Close'], 14)
        df['RSI_7'] = self.compute_rsi(df['Close'], 7)

        # MACD
        df['MACD'], df['MACD_Signal'], df['MACD_Hist'] = self.compute_macd(df['Close'])

        # Bollinger Bands
        df['BB_Upper'], df['BB_Lower'], df['BB_PctB'], df['BB_BW'] = self.compute_bollinger(df['Close'])

        # Stochastic
        df['Stoch_K'], df['Stoch_D'] = self.compute_stochastic(df['High'], df['Low'], df['Close'])

        # ATR (volatilite)
        df['ATR_14'] = self.compute_atr(df['High'], df['Low'], df['Close'], 14)

        # Volume bazlı
        df['Volume_SMA_20'] = df['Volume'].rolling(window=20).mean()
        df['Volume_Ratio'] = df['Volume'] / df['Volume_SMA_20']
        df['OBV'] = self.compute_obv(df['Close'], df['Volume'])

        # Fiyat türevleri
        df['Return_1d'] = df['Close'].pct_change(1)
        df['Return_5d'] = df['Close'].pct_change(5)
        df['Return_10d'] = df['Close'].pct_change(10)
        df['Volatility_10d'] = df['Return_1d'].rolling(window=10).std()
        df['Volatility_20d'] = df['Return_1d'].rolling(window=20).std()

        # Fiyat / SMA oranları (momentum)
        df['Price_SMA10_Ratio'] = df['Close'] / df['SMA_10']
        df['Price_SMA20_Ratio'] = df['Close'] / df['SMA_20']
        df['Price_SMA50_Ratio'] = df['Close'] / df['SMA_50']

        # Gün bazlı özellikler
        df['Day_of_Week'] = df.index.dayofweek
        df['Month'] = df.index.month

        # Lag (gecikmeli) kapanış fiyatları
        for lag in [1, 2, 3, 5]:
            df[f'Close_Lag_{lag}'] = df['Close'].shift(lag)

        # SMA Crossover sinyalleri (binary)
        df['SMA_5_10_Cross'] = (df['SMA_5'] > df['SMA_10']).astype(int)
        df['SMA_10_20_Cross'] = (df['SMA_10'] > df['SMA_20']).astype(int)

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

        # ─── 4) Feature Listesi ───
        feature_cols = [c for c in df.columns if c not in ['Close', 'Adj Close']]
        X = df[feature_cols].copy()
        y = df['Close'].shift(-1).dropna()
        X = X.iloc[:-1]

        # ─── 5) Ölçekleme ───
        tscv = TimeSeriesSplit(n_splits=3)  # 3 fold = %40 daha hızlı CV
        X_scaled = pd.DataFrame(
            self.scaler.fit_transform(X),
            columns=X.columns,
            index=X.index,
        )

        # ─── 6) Multi-Model Tanımlama (Ensemble) ───
        # LightGBM: GradientBoosting yerine ~5-10x hızlı histogram-bazlı öğrenme
        models = {}

        if HAS_LIGHTGBM:
            models["LightGBM"] = LGBMRegressor(
                n_estimators=150, max_depth=5, learning_rate=0.05,
                subsample=0.8, colsample_bytree=0.8,
                min_child_samples=10, num_leaves=31,
                n_jobs=_N_JOBS, random_state=42,
                verbosity=-1, force_col_wise=True,
            )

        models["RandomForest"] = RandomForestRegressor(
            n_estimators=150, max_depth=8,
            min_samples_split=10, min_samples_leaf=5,
            n_jobs=_N_JOBS, random_state=42,
        )

        if HAS_XGBOOST:
            models["XGBoost"] = XGBRegressor(
                n_estimators=150, max_depth=5, learning_rate=0.05,
                subsample=0.8, colsample_bytree=0.8,
                min_child_weight=5, random_state=42,
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

        # ─── 11) Güven Skoru ───
        confidence = max(0.40, min(0.97, 0.4 * max(0, best_cv_r2) + 0.6 * directional_acc))

        # ─── 12) Sinyal Belirleme ───
        rsi_val = float(df['RSI_14'].iloc[-1])
        macd_hist = float(df['MACD_Hist'].iloc[-1])
        stoch_k = float(df['Stoch_K'].iloc[-1]) if 'Stoch_K' in df.columns else 50.0
        bb_pctb = float(df['BB_PctB'].iloc[-1]) if 'BB_PctB' in df.columns else 0.5

        if prediction > current_price:
            base_signal = "BUY"
        else:
            base_signal = "SELL"

        # RSI aşırı alım/satım kontrolü
        if base_signal == "BUY" and rsi_val > 75:
            base_signal = "HOLD"
        elif base_signal == "SELL" and rsi_val < 25:
            base_signal = "HOLD"

        # ─── 13) Stop-Loss / Take-Profit ───
        stop_levels = self._calculate_stop_levels(df, base_signal, current_price)

        # Eğitim veri tarih aralığı
        training_start = str(df.index[0].date()) if hasattr(df.index[0], 'date') else str(df.index[0])
        training_end = str(df.index[-1].date()) if hasattr(df.index[-1], 'date') else str(df.index[-1])

        # RSI detay
        rsi_series = df['RSI_14'].dropna().tail(20)
        rsi_history = [{"date": str(idx.date()), "value": round(float(v), 2)} for idx, v in rsi_series.items()]

        # ─── 14) Sonuç ───
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
