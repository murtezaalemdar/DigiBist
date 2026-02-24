# Active Context — 24 Şubat 2026

## Current Goals
- deploy.ps1 test edilecek
- Frontend v8.05 build sunucuya deploy edilecek (config.js güncellenmiş ama build yapılmamış olabilir)
- Sonraki özellik geliştirmeleri planlanacak

## ⚠️ VERSİYON ARTIRMA — HER DEPLOY'DA ZORUNLU!
- `deploy.ps1` kullan (otomatik artırır) veya `config.js` APP_VERSION'ı manuel artır
- Mevcut versiyon: **v8.05**

## Mevcut Durum

Proje Ubuntu 24.04 sunucuda (192.168.0.28) native çalışıyor (Docker'sız):
- **PostgreSQL 16** — port 5432 (bist_admin/bist_secure_2026/bist_trading)
- **digibist-backend** (uvicorn nohup) — FastAPI + uvicorn 4 workers, port 8000
- **Nginx** — React build serve, port 80
- **Filament Admin** — port 8001 (ayrı Laravel)
- **Versiyon**: v8.05

## Son Yapılan İşler

### v8.05 — KAP Bildirileri + Fibonacci Grafik + Deploy Otomasyon (24 Şubat 2026)
1. **KAP News Entegrasyonu**
   - KAP API sunucudan erişilemez (POST timeout) → Google News RSS proxy çözümü
   - Backend: `/api/kap-news/{symbol}` endpoint, 35+ sembol-şirket eşleştirmesi, 10dk cache
   - Frontend: DashboardPage KAP bölümü, son haber gösterimi, tıklanabilir kategori etiketleri
2. **Teknik Analiz Grafik Geliştirmeleri**
   - RSI, MACD, Hacim grafiklerine fiyat çizgisi eklendi (dual Y-axis ComposedChart)
   - Bollinger band legend düzeltmesi (Area legendType="none", Line tutarlı renk)
   - MACD Signal renk: #f59e0b → #a855f7 (mor), Hacim Ort.: → #22c55e (yeşil)
   - MACD Histogram: `<rect>` → `<Cell>` ile doğru yeşil/kırmızı renklendirme
3. **Fibonacci Sekmesi (YENİ)**
   - 7 retracement seviyesi (0%, 23.6%, 38.2%, 50%, 61.8%, 78.6%, 100%)
   - Renk kodlu dashed ReferenceLine'lar, seviye kartları, en yakın seviye yorumu
4. **Deploy Otomasyon**
   - `deploy.ps1` PowerShell betiği: otomatik versiyon artırma + npm build + scp + chmod + git push
   - Kullanım: `.\deploy.ps1 -All -GitPush` (full), `.\deploy.ps1 -Backend` (sadece backend)
5. **WebSocket 60s + Dinamik Countdown**
   - Backend asyncio.sleep(60), useWebSocket updateInterval ölçümü, DashboardPage countdown

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