# Product Context — DigiBist (BIST AI Trading Platform)

## Overview

BIST 100 hisseleri için yapay zeka destekli teknik analiz, sinyal üretimi ve opsiyonel otomatik trade platformu.
Ensemble ML modelleri (LightGBM + RandomForest + XGBoost) ile Walk-Forward Validation kullanarak
güvenilir AL/SAT/TUT sinyalleri üretir. Risk Engine düşük güvenli sinyalleri otomatik filtreler.

## Core Features

- **AI Teknik Analiz**: 43+ indikatör, ensemble ML, Walk-Forward CV
- **Sinyal Üretimi**: BUY/SELL/HOLD + confidence score + risk filtresi
- **Kelly Criterion Pozisyon Boyutlandırma**: Half-Kelly, detaylı rapor paneli
- **RSI Divergence Algılama**: Bullish/bearish uyumsuzluk tespiti, görsel gösterim
- **Fırsat Tarayıcı**: 11 fırsat tipi, otomatik tarama, Telegram + browser bildirim
- **Teknik Analiz Grafikleri**: Fiyat, RSI, MACD, Hacim, Fibonacci (5 tab)
- **Canlı Fiyat Akışı**: TradingView → Yahoo fallback, WebSocket 60s
- **BIST100 Endeks Takibi**: XU100 Navbar badge
- **KAP Haberleri**: Google News RSS proxy
- **Broker Entegrasyonu**: Paper, IBKR, Matriks, İş Yatırım
- **DrillDown Detay Modalleri**: Yönsel doğruluk, CV R², RSI, features, eğitim verisi, Kelly

## Technical Stack

| Katman | Teknoloji |
|--------|----------|
| Frontend | React 18 + Tailwind CSS + Recharts (Nginx port 80) |
| ML Backend | Python FastAPI + scikit-learn + LightGBM + yfinance (uvicorn port 8000) |
| Admin Panel | Laravel Filament PHP (port 8001) |
| Veritabanı | PostgreSQL 16 |
| Gerçek Zamanlı | WebSocket (60s fiyat stream) |
| Bildirim | Telegram Bot API + Browser Notification API |
| Deploy | Ubuntu 24.04 native (systemd + Nginx) |
| VCS | GitHub (murtezaalemdar/DigiBist) |

## Kullanıcı Profili

- Bireysel yatırımcılar (BIST 100 takibi)
- Portföy yöneticileri (AI destekli karar destek)
- Teknik analiz meraklıları (divergence, Fibonacci, indikatörler)

## Versiyon Geçmişi (Son)

- v8.08.00 (aktif): RSI Divergence + Kelly DrillDown + Bug Fixler
- v8.07.00: Fırsat Bildirim Sistemi (Opportunity Scanner)
- v8.06.02: 14 Bug Fix Release
- v8.06: Interval Butonları + BIST100 Endeks + Sidebar Filtre
- v8.05: KAP Haberleri + Fibonacci + Deploy Otomasyon