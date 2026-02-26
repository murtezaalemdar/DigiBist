# Project Brief — DigiBist (BIST AI Trading Platform)

## Purpose

BIST 100 hisseleri için yapay zeka destekli teknik analiz, sinyal üretimi ve opsiyonel otomatik trade platformu.
Ensemble ML modelleri (LightGBM + RandomForest + XGBoost) ile Walk-Forward Validation kullanarak
güvenilir AL/SAT/TUT sinyalleri üretir. Risk Engine düşük güvenli sinyalleri otomatik filtreler.

## Target Users

- Bireysel yatırımcılar (BIST 100 takibi)
- Portföy yöneticileri (AI destekli karar destek)
- Teknik analiz meraklıları (divergence, Fibonacci, indikatörler)
- Fintech geliştiriciler (API entegrasyonu)

## Tech Stack

| Katman | Teknoloji |
|--------|-----------|
| Frontend | React 18 + Tailwind CSS (CDN) + Recharts + lucide-react (Nginx port 80) |
| ML Backend | Python FastAPI + scikit-learn + LightGBM + asyncpg (uvicorn port 8000, 4 workers) |
| Admin Panel | Laravel Filament PHP (port 8001) |
| Veritabanı | PostgreSQL 16 (native, localhost:5432) |
| Gerçek Zamanlı | WebSocket (60s fiyat stream, opportunity alerts) |
| Canlı Fiyat | TradingView Scanner API (birincil) + Yahoo Spark API (yedek) |
| Bildirim | Telegram Bot API + Browser Notification API |
| Deploy | Ubuntu 24.04 native (systemd + Nginx), sunucu 192.168.0.28 |
| VCS | GitHub (murtezaalemdar/DigiBist), branch main |

## Temel Özellikler

- 89 BIST 100 hissesi gerçek zamanlı fiyat takibi (TradingView Scanner → Yahoo Spark fallback)
- AI teknik analiz (RSI, MACD, Bollinger, Stochastic, SMA, EMA vb. — ~50 özellik)
- Ensemble ML: LightGBM + RandomForest + XGBoost (CV R² bazlı ağırlıklandırma, Walk-Forward validation)
- Confidence-based sinyal üretimi (BUY/SELL/HOLD)
- Risk Engine v2 (dinamik eşik, CV R², yönsel doğruluk, ATR bazlı SL/TP, drawdown koruması)
- Kelly Criterion pozisyon boyutlandırma (Half-Kelly, detaylı DrillDown raporu)
- AI Tahmin Geçmişi & Doğruluk Analizi (TradingView ile doğrulama, yön/fiyat/skor, haftalık trend)
- RSI Divergence algılama (bullish/bearish uyumsuzluk, görsel gösterim)
- Fırsat Tarayıcı (11 tip: STRONG_BUY, RSI_OVERSOLD, MACD_CROSS, BIG_MOVE, VOLUME_SPIKE vb.)
- Teknik analiz grafikleri (Fiyat, RSI, MACD, Hacim, Fibonacci — 5 tab, 5 interval)
- KAP Haberleri (Google News RSS proxy)
- Manuel/otomatik trade (paper + real, broker adapter: IBKR, Matriks, İş Yatırım)
- Kullanıcı yönetimi + rol/izin sistemi (JWT + bcrypt RBAC)
- Canlı ticker, portföy yönetimi, favori takip, sidebar arama
- Responsive mobil-uyumlu arayüz (Tailwind responsive breakpoints)
- Otomatik deploy betiği (deploy.ps1 — versiyon artırma + SCP + systemd restart + git push)

## Versiyon

- Güncel: **v8.09.01** (27 Şubat 2026)
- Git: `github.com/murtezaalemdar/DigiBist.git` — branch `main`
