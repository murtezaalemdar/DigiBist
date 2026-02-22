# Active Context — 22 Şubat 2026

## Mevcut Durum

Proje tamamen çalışır durumda. 4 Docker container aktif:
- **bist-postgres** (Healthy) — port 5432
- **bist-ml-backend** (Healthy) — port 8000
- **bist-react-frontend** (Running) — port 3000
- **bist-filament-admin** (Running) — port 8001

## Son Yapılan İşler

1. Türkçe karakter sorunu çözüldü (Navbar, UserManagementPage, migrate_permissions.sql)
2. Tüm sayfalar responsive yapıya çevrildi
3. DB şeması ve tam yedek alındı
4. GitHub'a yedekleme yapılıyor

## Bilinen Sorunlar

- yfinance bazen timeout verebilir (KLGYO.IS gibi), backend bunu graceful handle ediyor
- Filament admin paneli ayrı Laravel uygulaması, migration'lar manuel çalıştırılmalı

## Önemli Dosya Yapısı

```
backend/main.py          — FastAPI ana uygulama + ML engine
frontend/src/App.js      — React ana bileşen + routing
frontend/src/pages/      — Sayfa bileşenleri (6 adet)
frontend/src/components/ — Navbar, Sidebar, LiveTicker, vb.
database/                — SQL migration + yedek dosyaları
filament/demo-main/      — Laravel Filament admin panel
docker-compose.yml       — Tüm servislerin orchestration'ı
```