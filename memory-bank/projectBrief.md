# Project Brief — DigiBist (BIST AI Trading Platform)

## Purpose

BIST 100 hisseleri için yapay zeka destekli teknik analiz, sinyal üretimi ve opsiyonel otomatik trade platformu. RandomForest, XGBoost ve GradientBoosting ensemble modelleri kullanılır. Risk Engine düşük güvenli sinyalleri otomatik filtreler.

## Target Users

- Bireysel yatırımcılar (BIST 100 takibi)
- Portföy yöneticileri (AI destekli karar destek)
- Fintech geliştiriciler (API entegrasyonu)

## Tech Stack

| Katman | Teknoloji |
|--------|-----------|
| Frontend | React 18 + Tailwind CSS (port 3000) |
| ML Backend | Python FastAPI + scikit-learn + yfinance (port 8000) |
| Admin Panel | Laravel Filament PHP (port 8001) |
| Veritabanı | PostgreSQL 16 Alpine |
| Gerçek Zamanlı | WebSocket (fiyat stream) |
| Bildirim | Telegram Bot API |
| Deploy | Docker Compose (4 container) |

## Temel Özellikler

- 89 BIST 100 hissesi gerçek zamanlı fiyat takibi (Yahoo Finance)
- AI teknik analiz (RSI, MACD, Bollinger, Stochastic, vb. — 43+ indikatör)
- Confidence-based sinyal üretimi (BUY/SELL/HOLD)
- Risk Engine v2 (dinamik eşik, CV R², yönsel doğruluk filtreleri)
- Kelly Criterion pozisyon boyutlandırma
- Manuel/otomatik trade (paper + dry-run)
- Kullanıcı yönetimi + rol/izin sistemi (RBAC)
- Canlı ticker, portföy yönetimi, favori takip
- Responsive mobil-uyumlu arayüz
