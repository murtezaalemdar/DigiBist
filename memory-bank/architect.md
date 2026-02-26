# Architect — DigiBist

## Overview

BIST AI Trading Platform. Ubuntu 24.04 native deployment (systemd + Nginx + PostgreSQL).
ML ensemble modeller ile teknik analiz, Risk Engine ile sinyal filtreleme,
WebSocket ile gerçek zamanlı veri akışı, TradingView Scanner ile canlı fiyat.

## Deployment Architecture

```
┌─────────────────────────────────────────────────────┐
│  Ubuntu 24.04 — 192.168.0.28 (i5-650, 7.7GB RAM)   │
│                                                      │
│  ┌──────────────────────┐  ┌───────────────────────┐ │
│  │  Nginx (port 80)     │  │  Filament (port 8001) │ │
│  │  └─ React build/     │  │  └─ Laravel PHP       │ │
│  └──────────┬───────────┘  └───────────┬───────────┘ │
│             │ proxy /api, /ws           │             │
│  ┌──────────▼───────────┐  ┌───────────▼───────────┐ │
│  │  digibist-backend    │  │  PostgreSQL 16         │ │
│  │  (systemd service)   │◄─┤  localhost:5432        │ │
│  │  uvicorn :8000 x4    │  │  bist_trading DB       │ │
│  │  └─ FastAPI + ML     │  └───────────────────────┘ │
│  │  └─ WebSocket /ws    │                             │
│  │  └─ TradingView API  │                             │
│  └──────────────────────┘                             │
└─────────────────────────────────────────────────────┘
```

## Architectural Decisions

1. **PostgreSQL 16 (native)** — Hem ML backend hem Filament admin aynı DB'yi paylaşır. Tüm tablolar aynı `public` schema'da. asyncpg ile asenkron bağlantı.
2. **FastAPI + asyncpg** — Asenkron DB bağlantısı ile yüksek throughput. Fiyat çekme her 60sn'de 89 sembol paralel.
3. **React SPA + Tailwind CSS (CDN)** — Tek sayfa uygulama, Nginx serve. Mobile-first responsive. Recharts grafik kütüphanesi.
4. **Laravel Filament** — Admin panel için ayrı PHP servisi. Kullanıcı/rol/izin CRUD, hisse yönetimi.
5. **Ensemble ML (LightGBM + RF + XGB)** — Cross-validation R² bazlı ağırlıklandırma. Walk-Forward validation. Negatif R² durumunda eşit ağırlık.
6. **Risk Engine v2** — Multi-filtre: güven eşiği, CV R², yönsel doğruluk, ATR bazlı SL/TP. Kelly Criterion ile pozisyon boyutlandırma.
7. **Prediction Verification System** — stock_forecasts tablosuna 7 doğrulama kolonu. TradingView Scanner API (birincil) + Yahoo Spark (yedek) ile gerçek fiyat karşılaştırması. Yön doğruluğu + fiyat hatası + 0-100 skor. Haftalık trend + sembol sıralaması.
8. **Dual Signal Display** — AI orijinal sinyal (signal) ve Risk Engine sonucu (risk_signal) ayrı gösterilir. Risk Engine düşük güvenli sinyalleri HOLD'a çevirir (threshold ~%75).
9. **TradingView Scanner API → Yahoo Spark fallback** — yfinance yerine direkt HTTP API. Batch request ile tüm BIST100 fiyatları tek seferde. SSL verify disabled (sunucu kısıtlaması).
10. **systemd service (digibist-backend)** — nohup/screen yerine systemd ile managed. Auto-restart, journalctl log, `systemctl restart` ile kontrol. fuser/pkill kullanmak çakışma yaratır.
11. **Opportunity Scanner** — 11 fırsat tipi (STRONG_BUY, RSI_OVERSOLD, MACD_CROSS, BIG_MOVE, VOLUME_SPIKE, BOLLINGER vb.), 4 öncelik seviyesi, 30dk cooldown, max 200 in-memory. Telegram + WS broadcast.
12. **RSI Divergence Detection** — Swing low/high (lookback=5), dedup (3 bar), bullish/bearish karşılaştırma. API response'a divergence array eklenir.
13. **DrillDown Modal pattern** — Her metrik (directional, cv_r2, rsi, features, training, kelly) için ayrı detail component. Modüler yapı.
14. **JWT + bcrypt RBAC** — HS256 token (24h expire), bcrypt hashing, PostgreSQL users/user_permissions tabloları, FastAPI Depends() injection.
15. **3 Katmanlı Dokümantasyon** — Module docstring (mimari/akış), section header (dosya navigasyonu), inline yorum (karmaşık mantık). Tüm backend/frontend dosyalarında uygulanıyor.

