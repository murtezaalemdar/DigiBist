# Architect — DigiBist

## Overview

BIST AI Trading Platform. 4 servisli Docker Compose mimarisi. ML ensemble modeller ile teknik analiz, Risk Engine ile sinyal filtreleme, WebSocket ile gerçek zamanlı veri akışı.

## Architectural Decisions

1. **PostgreSQL 16 Alpine** — Hem ML backend hem Filament admin aynı DB'yi paylaşır. Tüm tablolar aynı `public` schema'da.
2. **FastAPI + asyncpg** — Asenkron DB bağlantısı ile yüksek throughput. Fiyat çekme her 10 sn'de 89 sembol paralel.
3. **React SPA + Tailwind CSS** — Tek sayfa uygulama, Docker volume mount ile hot-reload. Mobile-first responsive.
4. **Laravel Filament** — Admin panel için ayrı PHP container. Kullanıcı/rol/izin CRUD, hisse yönetimi.
5. **Ensemble ML (RF + XGB + GB)** — Cross-validation R² bazlı ağırlıklandırma. Negatif R² durumunda eşit ağırlık.
6. **Risk Engine v2** — Multi-filtre: güven eşiği, CV R², yönsel doğruluk, ATR bazlı SL/TP.
7. **Prediction Verification System** — stock_forecasts tablosuna 7 doğrulama kolonu. TradingView Scanner API (birincil) + Yahoo Spark (yedek) ile gerçek fiyat karşılaştırması. Yön doğruluğu + fiyat hatası + 0-100 skor. Haftalık trend + sembol sıralaması.
8. **Dual Signal Display** — AI orijinal sinyal (signal) ve Risk Engine sonucu (risk_signal) ayrı gösterilir. Risk Engine düşük güvenli sinyalleri HOLD'a çevirir (threshold ~%75).

