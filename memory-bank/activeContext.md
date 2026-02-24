# Active Context — 24 Şubat 2026

## Current Goals
- v8.06 versiyona bump + git commit & push
- Sonraki özellik geliştirmeleri planlanacak

## ⚠️ VERSİYON ARTIRMA — HER DEPLOY'DA ZORUNLU!
- `deploy.ps1` kullan (otomatik artırır) veya `config.js` APP_VERSION'ı manuel artır
- Mevcut versiyon: **v8.05** → **v8.06'ya bump edilmeli**

## Mevcut Durum

Proje Ubuntu 24.04 sunucuda (192.168.0.28) native çalışıyor (Docker'sız):
- **PostgreSQL 16** — port 5432 (bist_admin/bist_secure_2026/bist_trading)
- **digibist-backend** (uvicorn nohup) — FastAPI + uvicorn 4 workers, port 8000
- **Nginx** — React build serve, port 80
- **Filament Admin** — port 8001 (ayrı Laravel)
- **Versiyon**: v8.05 (sunucuya v8.06 özellikleri deployed ama versiyon henuz bump edilmedi)

## Son Yapılan İşler

### v8.06 — Interval Butonları + BIST100 Endeks + Sidebar Filtre + Sticky Header + Fiyat Değişim (24 Şubat 2026)
1. **Grafik Interval Butonları (1DK, 5DK, 1Saat, 3S, 1Hafta)**
   - Backend `main.py`: `interval` parametresi eklendi (1m, 5m, 60m, 1h, 1wk), `interval_limits` dict
   - Frontend `AnalysisChartModal.js`: INTERVALS array, interval state, emerald butonlar, formatDate intraday
   - yfinance kısıtları: 1m→7d max, 5m→60d, 60m/1h→730d, 1d/1wk→10y
2. **Fibonacci Etiket Düzeltmesi**
   - Sol labels kesiyor/üşt üşte → sağa taşındı (`position: 'right'`)
   - Kısa format: `${fib.pct} ₺${fib.value}`, Y domain `[fibLow*0.95, fibHigh*1.05]`
3. **Tüm Grafiklerde YAxis + Margin Düzeltmeleri**
   - Price YAxis `width={65}`, RSI `width={40}`, MACD/Volume `width={55}`
   - Margin `left: 15`, `right: 55`
4. **Sticky Header (Navbar + LiveTicker)**
   - App.js: `<div className="sticky top-0 z-50 bg-[#070b14]/95 backdrop-blur-md">` wrapper
   - Navbar.js: kendi `sticky top-0 z-50` kaldırıldı
5. **Sidebar Hisse Filtre Arama Kutusu**
   - `filterText` state, Search/X ikonları, sembol + şirket adı filtre
   - useMemo ile optimize, Tümü/Favoriler ile birlikte çalışır
6. **BIST 100 (XU100) Endeks Değeri**
   - Backend: `_fetch_batch_prices()` içinde XU100.IS yfinance ile çekilir, WS data'ya eklenir
   - Navbar: Desktop — tab'ların yanında pill badge, Mobil — menüde kart
   - LiveTicker'dan XU100 filtrelendi (tekrarı önleme)
7. **Piyasa Fiyatı Günlük Değişim Gösterimi**
   - DashboardPage: Fiyatın yanına TrendingUp/TrendingDown ikon + %değişim
   - Yeşil/kırmızı renk kodu

### v8.05 — KAP Bildirileri + Fibonacci Grafik + Deploy Otomasyon (24 Şubat 2026)
1. **KAP News Entegrasyonu** (Google News RSS proxy)
2. **Teknik Analiz Grafik Geliştirmeleri** (dual Y-axis, renk düzeltmeleri)
3. **Fibonacci Sekmesi** (7 retracement seviyesi)
4. **Deploy Otomasyon** (`deploy.ps1`)
5. **WebSocket 60s + Dinamik Countdown**

### v8.04 — İşlem Sayfası Strateji Panelleri + Logo Tıklama
1. **TradePage.js** — AI Kararı/İndikatör/Hibrit strateji detay panelleri
2. **Navbar.js** — BIST AI logosu tıklanabilir → Dashboard'a yönlendirme

### v8.03 — TradingView Canlı Fiyat Entegrasyonu
1. **live_price_provider.py** — TradingView Scanner (primary) → Yahoo Spark → yfinance (fallback)
2. **main.py** — `_fetch_batch_prices()` yeniden yazıldı
3. **WebSocket** — `provider` alanı, Navbar badge

## Bilinen Sorunlar

- yfinance bazen timeout verebilir (KLGYO.IS gibi), backend bunu graceful handle ediyor
- KAP API sunucudan erişilemez (POST timeout), Google News RSS alternatif olarak kullanılıyor
- Filament admin paneli ayrı Laravel uygulaması, migration'lar manuel çalıştırılmalı
- GPU henüz takılmadı — mevcut performans CPU-only (i5-650 4 core)

## Önemli Dosya Yapısı

```
/opt/digibist/backend/main.py                    — FastAPI ana uygulama + tüm endpoints
/opt/digibist/backend/app/ml_engine/model.py     — BISTAIModel (3-model ensemble + drill_down)
/opt/digibist/backend/app/core/live_price_provider.py — TradingView/Yahoo canlı fiyat
/opt/digibist/backend/venv/                      — Python 3.12.3 virtual environment
/opt/digibist/frontend/src/pages/                — React sayfa bileşenleri
/opt/digibist/frontend/src/components/           — Navbar, Sidebar, DrillDownModal, AnalysisChartModal, vb.
/opt/digibist/frontend/src/config.js             — API/WS/Versiyon sabitleri
/opt/digibist/frontend/build/                    — Production build (Nginx serve)
```

## Deploy Komutları

```powershell
# OTOMATİK (ÖNERİLEN):
.\deploy.ps1 -All -GitPush           # Full deploy + git push
.\deploy.ps1 -All -GitPush -Major    # Major versiyon + deploy + push
.\deploy.ps1 -Backend                # Sadece backend
.\deploy.ps1 -NoBump                 # Versiyon artırmadan frontend

# MANUEL:
scp backend/main.py root@192.168.0.28:/opt/digibist/backend/main.py
ssh root@192.168.0.28 "fuser -k 8000/tcp; sleep 2; cd /opt/digibist/backend && /opt/digibist/backend/venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4 &"
cd frontend; npm run build
scp -r frontend/build/* root@192.168.0.28:/opt/digibist/frontend/build/
ssh root@192.168.0.28 "chmod -R 755 /opt/digibist/frontend/build/"
```

## Sunucu Bilgileri

- **OS**: Ubuntu 24.04 LTS
- **IP**: 192.168.0.28
- **CPU**: Intel i5-650 @ 3.20GHz (4 core)
- **RAM**: 7.7GB
- **Backend venv**: `/opt/digibist/backend/venv/bin/python`
- **Backend restart**: `fuser -k 8000/tcp; sleep 2; cd /opt/digibist/backend && venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4 &`
- **Frontend build**: `cd frontend && DISABLE_ESLINT_PLUGIN=true npm run build`