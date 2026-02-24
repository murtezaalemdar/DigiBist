# Active Context — 24 Şubat 2026

## Current Goals

- ## Aktif Çalışma - v8.08.00 Geliştirme (RSI Divergence + Kelly DrillDown)
- ### Son Durum
- - RSI Divergence algılama ve görselleştirme tamamlandı (backend + frontend)
- - Kelly Criterion tıklandığında detaylı rapor gösterimi eklendi (DrillDownModal)
- - React Error #310 düzeltildi (useMemo hooks sırası)
- - Login z-index sorunu düzeltildi (Navbar relative z-10)
- - Tüm değişiklikler production'a deploy edildi ve test edildi
- - API testi: GARAN (1 bearish div), THYAO (2 bearish div), FROTO 1y (bullish+bearish)
- ### Deployment Bilgileri
- - Server: Ubuntu 24.04, 192.168.0.28, SSH root erişimi
- - Backend: /opt/digibist/backend/ — `systemctl restart digibist-backend` ile yönetilir
- - Frontend: /opt/digibist/frontend/build/ (Nginx, port 80)
- - Database: PostgreSQL localhost:5432/bist_trading
- - Git: son commit d46274e (v8.07.00), yeni değişiklikler henüz commit edilmedi
- ### Bilinen Sorunlar (Düşük Öncelik)
- - Hardcoded DB password/JWT secret (env vars kullanılmalı)
- - SSL verification disabled in live_price_provider.py
- - Race conditions in risk_engine class variables
- - Memory leak (cache cleanup yok)
- - AbortController eksik frontend fetch'lerde
- - Worker process state isolation

## ⚠️ VERSİYON ARTIRMA — HER DEPLOY'DA ZORUNLU!
- `deploy.ps1` kullan (otomatik artırır) veya `config.js` APP_VERSION'ı manuel artır
- Mevcut versiyon: **v8.07.00** → **v8.08.00'a bump edilmeli**

## Mevcut Durum

Proje Ubuntu 24.04 sunucuda (192.168.0.28) native çalışıyor (Docker'sız):
- **PostgreSQL 16** — port 5432 (bist_admin/bist_secure_2026/bist_trading)
- **digibist-backend** — systemd servisi (`digibist-backend.service`), FastAPI + uvicorn 4 workers, port 8000
- **Nginx** — React build serve, port 80
- **Filament Admin** — port 8001 (ayrı Laravel)
- **Versiyon**: v8.07.00 (RSI Divergence + Kelly DrillDown deployed ama versiyon henüz bump edilmedi)

## ⚠️ KRİTİK: Backend Yönetimi
- Backend `digibist-backend.service` systemd servisi ile yönetilir
- **Restart**: `systemctl restart digibist-backend`
- **Status**: `systemctl status digibist-backend`
- **ASLA** `fuser -k` veya `pkill` kullanma — systemd otomatik yeniden başlatır ve çakışma yaratır

## Son Yapılan İşler

### v8.08 — RSI Divergence + Kelly DrillDown + Bug Fix'ler (24 Şubat 2026)
1. **RSI Bullish/Bearish Divergence Algılama (Backend)**
   - `backend/main.py` — `/api/ai-chart-data/{symbol}` endpoint'ine divergence algoritması eklendi
   - Swing low/high bulma (lookback=5), dedup fonksiyonu (3 bar yakınlığı birleştirir)
   - Bullish: Fiyat düşük dip + RSI yüksek dip = yükseliş sinyali
   - Bearish: Fiyat yüksek tepe + RSI düşük tepe = düşüş sinyali
   - min_distance=5 bar zorunlu mesafe
   - API response'a `bullishDiv`/`bearishDiv` flag + `divergences` array eklendi
2. **RSI Divergence Görselleştirme (Frontend — 3 iterasyon)**
   - `AnalysisChartModal.js` — useMemo ile divergence noktaları hesaplanır
   - Büyük etiketli daireler: Yeşil (yükseliş) / Kırmızı (düşüş) + glow efekt
   - SVG text label: "YÜKSELİŞ" / "DÜŞÜŞ"
   - Bağlantı dashed çizgiler (connectNulls)
   - Badge: "🟢 X Yükseliş Sinyali" / "🔴 X Düşüş Sinyali"
   - Eğitici kutu + detaylı sinyal kartları (fiyat/RSI grid, % değişim, Türkçe yorum)
3. **React Error #310 Fix**
   - `useMemo` hook `if (!isOpen) return null` early return'dan SONRA idi → hook sayısı değişiyordu
   - Çözüm: `useMemo`'yu early return ÖNCESİNE taşıdı → sabit hook sayısı
4. **Login Dropdown z-index Fix**
   - `Navbar.js` — `<nav>` elementine `relative z-10` eklendi
   - Login dropdown LiveTicker'ın üzerinde render ediliyor
5. **Kelly Criterion DrillDown Raporu**
   - `DrillDownModal.js` — Yeni `kelly` tipi eklendi (KellyDetail component)
   - DashboardPage: Kelly kutusu onClick → Investopedia yerine DrillDown modal açılır
   - İçerik: Pozisyon özeti, strateji istatistikleri, Kelly formülü hesaplama, gauge skalası, risk limitleri

### v8.07 — Fırsat Bildirim Sistemi (24 Şubat 2026)
- OpportunityScanner: STRONG_BUY/SELL, RSI_OVERSOLD/OVERBOUGHT, MACD_CROSS, BIG_MOVE, VOLUME_SPIKE, BOLLINGER
- 30dk cooldown, max 200 alert in-memory
- Frontend: NotificationBell + useNotifications hook

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
- **Backend restart**: `systemctl restart digibist-backend` (systemd servisi)\n- **Backend status**: `systemctl status digibist-backend`
- **Frontend build**: `cd frontend && DISABLE_ESLINT_PLUGIN=true npm run build`