# Active Context — 23 Şubat 2026

## Mevcut Durum

Proje tamamen çalışır durumda. 4 Docker container aktif:
- **bist-postgres** (Healthy) — port 5432
- **bist-ml-backend** (Healthy) — port 8000
- **bist-react-frontend** (Running) — port 3000
- **bist-filament-admin** (Running) — port 8001

## Son Yapılan İşler

1. **Broker Entegrasyonu tamamlandı** — multi-broker mimarisi:
   - BrokerManager: paper / ibkr / matriks / is_yatirim
   - SettingsPage'de broker seçimi/yapılandırma UI
   - TradePage'de broker durum bandı (bağlı broker, bakiye, hesap)
   - ExecutionEngine broker yönlendirme
   - API: /api/broker/status, /api/broker/list, /api/broker/switch, /api/broker/config
2. **Full-width layout** — max-w-7xl kısıtlamaları kaldırıldı, tam ekran genişlik
   - Navbar, main, footer full-width
   - Sidebar sticky + responsive padding
3. **BIST100 tam** — DB'de 100 aktif hisse (8 inaktif→aktif + 3 yeni eklendi)

## Bilinen Sorunlar

- yfinance bazen timeout verebilir (KLGYO.IS gibi), backend bunu graceful handle ediyor
- Filament admin paneli ayrı Laravel uygulaması, migration'lar manuel çalıştırılmalı
- Yeni eklenen 3 hissenin (EGSER, MIATK, ALFAS) sektör bilgileri yaklaşık girildi

## Önemli Dosya Yapısı

```
backend/main.py                              — FastAPI ana uygulama + ML engine
backend/app/trading/brokers/                 — Broker adaptörleri (paper, ibkr, matriks, is_yatirim)
backend/app/trading/brokers/broker_manager.py — Merkezi broker yöneticisi
backend/app/trading/execution_engine.py      — Emir yürütme motoru (broker entegreli)
frontend/src/App.js                          — React ana bileşen + routing + broker state
frontend/src/pages/                          — Sayfa bileşenleri (6 adet)
frontend/src/components/                     — Navbar, Sidebar, LiveTicker, vb.
database/                                    — SQL migration + yedek dosyaları
filament/demo-main/                          — Laravel Filament admin panel
docker-compose.yml                           — Tüm servislerin orchestration'ı
```