# BIST Workspace Teknik Referans (Detaylı Analiz)

> Tarih: 22 Şubat 2026  
> Kapsam: `c:\Users\murteza.KARAKOC\Desktop\Python\Bist` ana workspace (aktif çalışan stack + tasarım aşamasındaki alt projeler)

## 1) Hızlı Özet

Bu workspace, **3 ana servisten oluşan tek bir docker-compose stack** içeriyor:

1. **Python FastAPI backend** (`backend/`)  
   - ML tahmin endpoint’i, risk filtresi, WebSocket canlı fiyat yayını, opsiyonel Telegram bildirimi.
2. **Laravel + Filament admin panel** (`filament/demo-main/`)  
   - Hisse yönetimi, tahminleri tetikleme/kaydetme, dashboard widget’ları.
3. **React frontend** (`frontend/`)  
   - Son kullanıcı dashboard’u, canlı ticker, sembol arama/favoriler.

Ek olarak `TasarımAsamasındakiProjeler/` altında farklı sürümlere ait (V2…V7, enterprise/ultra vb.) çok sayıda proje taslağı mevcut; aktif üretim stack’i gibi değil, daha çok arşiv/prototip havuzu niteliğinde.

---

## 2) Dizin ve Sorumluluk Haritası

### 2.1 Kök
- `docker-compose.yml`: Ana orkestrasyon.
- `backend/`: FastAPI ML motoru.
- `filament/demo-main/`: Laravel Filament admin panel.
- `frontend/`: React kullanıcı arayüzü.
- `memory-bank/`: Planlama/ürün bağlamı dökümanları (şu an çoğu placeholder).
- `TasarımAsamasındakiProjeler/`: Önceki/alternatif mimari sürümleri.

### 2.2 Aktif Servisler Arası İlişki
- Frontend (React) → FastAPI: AI forecast + WebSocket market stream.
- Frontend (React) → Filament API: hisse listesi (`/api/stocks`).
- Filament → FastAPI: backend healthcheck + hisse forecast çağrıları.
- Filament ↔ SQLite: hisse ve forecast kayıtları.

---

## 3) Çalıştırma Topolojisi (Docker)

## 3.1 `docker-compose.yml`

### `backend` servisi
- Build: `./backend/Dockerfile`
- Port: `8000:8000`
- Healthcheck: `GET /`
- Network: `bist-ai-network`

### `filament` servisi
- Build: `./filament/demo-main/Dockerfile`
- Port: `8001:8001`
- Env:
  - `APP_ENV=local`
  - `APP_DEBUG=true`
  - `APP_URL=http://localhost:8001`
  - `DB_CONNECTION=sqlite`
  - `BIST_AI_URL=http://backend:8000`
  - `BIST_AI_TIMEOUT=60`
- `depends_on`: backend healthy olduktan sonra başlar.

### `frontend` servisi
- Image: `node:18-alpine`
- Mount: `./frontend:/app`
- Command: `npm install && npm start`
- Port: `3000:3000`
- Env:
  - `REACT_APP_API_URL=http://localhost:8000` (kodda şu an hard-coded URL’ler var, env aktif kullanılmıyor)
  - `HOST=0.0.0.0`
  - `WATCHPACK_POLLING=true`

### Gözlemler
- Tek network üzerinde servis isimleriyle container-içi iletişim kuruluyor.
- Frontend geliştirme modu container içinde canlı çalıştırılıyor (prod build değil).

---

## 4) Backend (FastAPI) Analizi

## 4.1 Giriş Noktası
- Dosya: `backend/main.py`
- App: `FastAPI(title="BIST AI ML Engine", version="2.0.0")`
- CORS: `allow_origins=["*"]`, methods/headers tamamen açık.

## 4.2 Endpoint’ler

### `GET /api/ai-forecast/{symbol}`
Amaç:
- Sembol bazlı ML tahmini döndürmek.

Akış:
1. In-memory cache kontrolü (`CACHE_TTL = 3600s`).
2. `symbol + .IS` ile `BISTAIModel` çalıştırma.
3. `RiskEngine.evaluate_signal(...)` ile risk düzeltmesi.
4. Sonuç cache’e yazma.
5. `notify=true` ise Telegram bildirimi gönderme.

Dönüşte örnek alanlar:
- `symbol`
- `current_price`
- `predicted_price`
- `signal`
- `confidence`
- `risk_signal`
- `risk_reason`
- `risk_adjusted`

### `GET /api/risk/check`
Parametreler:
- `position_size`
- `portfolio_value` (default 250000)

Çıktı:
- `approved`, `reason`, `risk_level`, `allocation_pct`

### `WS /ws/market`
- İzlenen semboller: `WATCHED_SYMBOLS` listesi.
- Her 10 saniyede bir fiyat/sinyal paketini client’a gönderir.
- Cache varsa önce cache’den, yoksa Yahoo (`yf.Ticker().fast_info`) ile anlık fiyat çekmeye çalışır.

### `GET /`
- Health/status endpoint.
- Dönen status string’i: `"BIST AI Engine v2.0 Active"`.

## 4.3 ML Motoru (`backend/app/ml_engine/model.py`)
- Model: `RandomForestRegressor(n_estimators=100)`
- Veri kaynağı: `yfinance` (1 yıl, günlük)
- Özellikler:
  - `Open`, `High`, `Low`, `Close`, `S_10`, `RSI`
- Hedef:
  - Bir sonraki gün `Close` (`shift(-1)`).
- Sinyal:
  - `prediction > current_price` ise `BUY`, değilse `SELL`.

### Önemli teknik not
- `confidence`, modelden türetilmiyor; `np.random.uniform(0.75, 0.95)` ile rastgele üretiliyor.
  - Bu, UI/iş kuralları için “güven skoru”nun şu an gerçek model metriklerine dayanmadığını gösterir.

## 4.4 Risk Engine (`backend/app/core/risk_engine.py`)
Sabitler:
- `MAX_POSITION_SIZE = 50000`
- `MAX_ALLOCATION_PCT = 0.20`
- `MAX_VOLATILITY_THRESHOLD = 0.05`

Davranış:
- Pozisyon/portföy oranı denetlenir.
- Confidence <%70 ise sinyal `HOLD`’a çekilir.
- Aşırı volatilite + SELL kombinasyonunda `HOLD`’a çekilir.

## 4.5 Telegram Notifier
- Ortam değişkenleri:
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_CHAT_ID`
- Eksikse sessizce uyarı loglar, bildirim atlaması yapar.

## 4.6 WebSocket Manager
- Basit connection listesi yönetimi var.
- `broadcast()` metodu var ama ana döngüde doğrudan `websocket.send_json` kullanılıyor; merkezi broadcast mekanizması bu akışta kullanılmıyor.

---

## 5) Filament / Laravel Analizi

## 5.1 Amaç
- Yönetim paneli üzerinden hisse listesi yönetimi.
- Tek hisse veya toplu hisse için backend tahmini çalıştırma.
- Son tahminleri dashboard widget’larıyla izleme.

## 5.2 API
- `routes/api.php`:
  - `GET /api/stocks` → `Stock::active()->get(['symbol','name','sector'])`
- Frontend bu endpoint’i kullanarak sembol listesini alıyor.

## 5.3 Servis Katmanı (`app/Services/BistAIService.php`)
Fonksiyonlar:
- `getForecast(symbol)`: FastAPI çağrısı.
- `fetchAndStoreForecast(stock)`: tahmini çekip DB’ye yazar.
- `fetchAllForecasts()`: tüm aktif hisseler için toplu senkron.
- `healthCheck()`: backend root endpoint kontrolü.
- `getCachedForecast()`: Laravel cache ile kısa süreli cache.

### Kritik uyumsuzluk
- `healthCheck()` backend’den dönen `status` değerini **`"AI Model Engine Active"`** bekliyor.
- FastAPI `/` endpoint’i ise **`"BIST AI Engine v2.0 Active"`** dönüyor.
- Sonuç: backend ayakta olsa da Filament health check **false** dönebilir.

## 5.4 Veri Modeli

### `stocks` tablosu
Alanlar:
- `symbol`, `name`, `sector`
- `current_price`, `change_percent`
- `is_active`, `is_favorite`
- `last_synced_at`

### `stock_forecasts` tablosu
Alanlar:
- `stock_id` (FK)
- `current_price`, `predicted_price`
- `signal`, `confidence`, `change_percent`
- `model_used`, `raw_response`, `forecasted_at`

İlişkiler:
- `Stock hasMany StockForecast`
- `Stock hasOne latestForecast`

## 5.5 Seeder
- `StockSeeder` 20 adet BIST sembolü yükler.
- Bazıları varsayılan favori (`THYAO`, `GARAN`, `ASELS` vb.).

## 5.6 Filament Widget/Pages
- `BistStatsWidget`: aktif hisse, AL/SAT sayısı, ortalama confidence, backend durumu.
- `ForecastSignalChart`: latest tahminlerde BUY/SELL donut chart.
- `ListStocks`: toplu güncelleme (`syncAll`) ve health check aksiyonları.
- `ViewStock`: tek hisse `runForecast` aksiyonu.

### Dikkat edilmesi gereken yapı
- `app/Filament/Resources/StockResource.php` dosyası boş görünüyor.
  - `ListStocks` ve `ViewStock` sayfaları bu sınıfa referans veriyor.
  - Bu durum çalışma anında resource çözümlemede hata üretme riski taşır (projenin başka bir yerinde aynı sınıf üretilmiyorsa).

## 5.7 Container Başlangıç Script’i
`docker-entrypoint.sh` adımları:
1. `.env` üretme
2. `APP_KEY` üretme
3. `BIST_AI_URL` değerini `http://backend:8000` olarak yazma/güncelleme
4. SQLite dosyası oluşturma
5. migration + seed
6. cache temizleme
7. `php artisan serve --port=8001`

---

## 6) React Frontend Analizi

## 6.1 Genel
- CRA tabanlı (`react-scripts`), tek ana ekran bileşeni ağırlıklı yapı.
- UI state yoğun olarak `App.js` içinde toplanmış (~700+ satır).
- Çeşitli dashboard/portfolio/models/settings sekmeleri var.

## 6.2 Veri Kaynakları
- Hisse listesi: `http://localhost:8001/api/stocks`
- Tahmin: `http://localhost:8000/api/ai-forecast/{symbol}`
- Canlı feed: `ws://localhost:8000/ws/market`

## 6.3 Canlı Veri
- WebSocket reconnect mekanizması var (5 saniye).
- Ticker’da WS bağlı/bağlı değil durumu gösteriliyor.

## 6.4 UI/State Notları
- Favoriler `localStorage` (`bist_favorites`) ile saklanıyor.
- Arama filtreleme `useMemo` ile optimize edilmiş.
- Manuel yenileme ve seçili sembol akışı mevcut.

## 6.5 Styling Yaklaşımı
- `index.css` minimal.
- Tailwind sınıfları yoğun kullanılıyor.
- `frontend/public/index.html` içinde Tailwind CDN script’i mevcut.
  - Bu yaklaşım hızlı prototipleme için pratik, ancak kurumsal prod pipeline için ideal değil (build determinism/performance açısından).

---

## 7) Konfigürasyon ve Bağımlılıklar

## 7.1 Backend bağımlılıkları
- `fastapi`, `uvicorn`
- `yfinance`, `pandas`, `numpy`, `scikit-learn`
- `httpx`, `websockets`

## 7.2 Filament/Laravel
- Laravel 12
- Filament 4
- SQLite varsayılan DB
- Guzzle/Http facade ile backend entegrasyonu

## 7.3 Frontend
- React 18
- `lucide-react`
- `react-scripts`

---

## 8) Mimari Güçlü Yanlar

1. Ayrık sorumluluklar: ML backend, admin panel, müşteri UI ayrılmış.
2. Container tabanlı çalıştırma kolaylığı.
3. Risk engine + realtime feed + admin tetikleme gibi uçtan uca akış mevcut.
4. Filament tarafında operasyonel butonlar (sync/health) ile kullanım kolaylığı.

---

## 9) Teknik Borç / Riskler / Tutarsızlıklar

## 9.1 Yüksek Öncelik
1. **Healthcheck string mismatch** (Filament yanlış offline gösterebilir).
2. **`StockResource.php` boş** (resource class eksikliği riski).
3. **Confidence rastgele** (ML güven metriği gerçeği yansıtmıyor).

## 9.2 Orta Öncelik
1. Frontend API URL’leri hard-coded; env değişkenleri kullanılmıyor.
2. Backend cache in-memory; restart sonrası cache kaybı normal ama açıklanmalı.
3. WS döngüsünde sembol başına harici fiyat çağrısı performans maliyetli olabilir.

## 9.3 Düşük Öncelik
1. CORS tamamen açık (lokal için uygun, prod’da sınırlandırılmalı).
2. Frontend’de tek dosyada büyük state yönetimi (bakım zorlaşır).

---

## 10) Önerilen İyileştirme Planı (Önceliklendirilmiş)

## Faz 1 (Hemen)
1. Filament `healthCheck()` status karşılaştırmasını backend ile uyumlu hale getir.
2. `StockResource` sınıfını doğrula/geri ekle.
3. Frontend endpoint’lerini env tabanlı (`REACT_APP_API_URL`, `REACT_APP_ADMIN_URL`) yap.

## Faz 2 (Kısa Vadeli)
1. Confidence hesaplamasını gerçek model metriğine bağla (ör. out-of-sample skor).
2. WS fiyat akışını batch/cache odaklı optimize et.
3. Hata senaryolarında frontend kullanıcı mesajlarını iyileştir.

## Faz 3 (Orta Vadeli)
1. Auth/role ayrıştırması (admin ve kullanıcı arayüzlerinde).
2. Merkezi log/monitoring/alerting (örn. structured logs + metrics).
3. Model versiyonlama + tahmin audit izi.

---

## 11) memory-bank Durumu

`memory-bank/projectBrief.md` ve `memory-bank/productContext.md` dosyaları şu an büyük ölçüde şablon/placeholder düzeyinde. Bu `reference.md`, güncel kod tabanına göre çok daha gerçekçi teknik bağlam sağlar.

---

## 12) Sonuç

Workspace, **çalışabilir bir uçtan uca BIST AI demo/PoC platformu** sunuyor: 
- FastAPI ile tahmin + risk + canlı veri,
- Filament ile yönetim/operasyon,
- React ile kullanıcı dashboard’u.

Bununla birlikte, üretim kalitesine geçiş için öncelikle **entegrasyon tutarlılığı (healthcheck), eksik resource sınıfı ve ML güven skorunun doğruluğu** ele alınmalı.

---

## 13) Diğer Projelerle Karşılaştırma (TasarımAsamasındakiProjeler)

Karşılaştırma için incelenen referanslar:
- `BIST100_AI_SAAS_V2_PRODUCTION`
- `BIST100_ULTRA_ENTERPRISE_AI_TRADING_PLATFORM`
- `BIST100_ULTRA_ENTERPRISE_V2_FULL_STACK`

### 13.1 Bu projelerde görülen ileri seviye kabiliyetler
1. **Emir yönlendirme katmanı** (paper vs real).
2. **Strateji/DSL değerlendirme fikri** (indikatör bazlı karar).
3. **Ayrık servis yaklaşımı** (order/risk/strategy/paper engine).
4. **SaaS/microservice ölçekleme hedefi** (TimescaleDB, monitoring, MLflow-ready vb. deklaratif hedefler).

### 13.2 Bizim aktif projede önceki durum (bu geliştirmeden önce)
- Güçlü: AI forecast, risk filtresi, WS canlı akış, Filament yönetim paneli.
- Eksik: manuel emir API’si yok, otomatik AI trade döngüsü yok, emir geçmişi yok, strategy evaluate endpoint’i yok.

### 13.3 Bu analiz sonrası aktif backend'e eklenen yeni özellikler

Eklenen modüller (`backend/app/trading/`):
- `models.py`: manuel emir ve auto-trade config şemaları.
- `strategy_engine.py`: DSL konseptine uygun kurallı sinyal değerlendirme.
- `execution_engine.py`: paper/real modlu emir yürütme + geçmiş.
- `auto_trader.py`: periyodik otomatik trade orchestrator + loglar.

`backend/main.py` içine eklenen endpoint’ler:
- `GET /api/strategy/evaluate`
- `POST /api/order/execute`
- `GET /api/order/history`
- `POST /api/auto-trade/start`
- `POST /api/auto-trade/stop`
- `GET /api/auto-trade/status`
- `POST /api/auto-trade/run-once`

### 13.4 Yeni kabiliyetlerin iş değeri
1. **Manuel emir verebilme**: AI context + risk check ile birlikte.
2. **Otomatik AI tabanlı emir döngüsü**: sembol listesinde confidence/sinyal filtreli.
3. **Paper/real geçiş altyapısı**: gerçek broker adaptörüne hazır dry-run köprüsü.
4. **Operasyonel izlenebilirlik**: emir geçmişi + auto-trade logları.

### 13.5 Hâlâ eksik olan enterprise başlıklar
1. Multi-tenant auth/authorization ve tenant izolasyonu.
2. Gerçek broker entegrasyonu (FIX/REST adaptorleri).
3. Kalıcı order/event storage (PostgreSQL + event log).
4. Gelişmiş model governance (MLflow, model registry, drift monitor).
5. Observability stack (Prometheus/Grafana, central tracing).

Bu nedenle mevcut geliştirme, **monolith içinde enterprise feature çekirdeği** oluşturur; bir sonraki adımda servis ayrıştırması yapılabilir.

---

## 14) Yapılan ve Yapılamayan İşler (Detaylı)

### 14.1 Tamamlananlar

- **Manuel ve otomatik AI emir altyapısı**: backend’e trading modülleri eklendi, API endpoint’leri açıldı.
- **Strategy evaluate endpoint’i**: indikatör bazlı sinyal değerlendirme API’si.
- **Emir geçmişi ve auto-trade logları**: operasyonel izlenebilirlik sağlandı.
- **Filament health-check uyumsuzluğu**: referansta tespit edildi, kodda uyum için öneri verildi.
- **StockResource eksikliği**: referansta tespit edildi, örnek resource implementasyonu önerildi.
- **Frontend env tabanlı endpoint kullanımı**: referansta önerildi, kodda örnekle gösterildi.
- **Risk engine ve confidence hesaplaması**: referansta gerçekçi metrik önerisi sunuldu.
- **Python backend syntax kontrolü**: derleme hatasız geçti.

### 14.2 Yapılamayanlar / Teknik Blokajlar

- **Gerçek broker entegrasyonu (FIX/REST)**: demo/prototype seviyesinde dry-run adaptör eklendi, gerçek entegrasyon için aracı kurum API anahtarı ve sandbox gerekliliği var.
- **Multi-tenant auth/authorization**: mevcut kodda tenant izolasyonu yok, Laravel ve FastAPI tarafında ek middleware ve veri modeli gerektiriyor.
- **Kalıcı order/event storage (PostgreSQL, event log)**: şu an emir geçmişi memory’de, prod için migration ve event sourcing altyapısı kurulmalı.
- **Gelişmiş model governance (MLflow, model registry, drift monitor)**: kodda sadece RandomForest demo var, model yönetimi için ek servis ve entegrasyon gerektiriyor.
- **Observability stack (Prometheus/Grafana, central tracing)**: kodda log ve metrik yok, docker-compose ve kodda ek servis entegrasyonu gerektiriyor.
- **Frontend’e tam trade paneli entegrasyonu**: backend API hazır, UI tarafında yeni ekran ve state yönetimi eklenmesi gerekiyor.
- **Filament resource ve page uyumu**: örnek resource önerildi, tam uyum için Filament sürümüne göre kodun test edilmesi ve migration yapılması gerekiyor.
- **Risk engine ve confidence gerçek metrik**: kodda öneri sunuldu, modelin out-of-sample skorunu hesaplayacak ek logic yazılması gerekiyor.

#### Teknik Notlar
- Bazı ultra/enterprise projelerdeki dosya ve modül adları workspace’de eksik veya farklı, tam otomatik taşıma için dosya/folder mapping ve refactoring gerektiriyor.
- Demo/prototype kodlarda bazı endpoint ve veri modeli eksik, prod için ek validation ve error handling gerektiriyor.

---

Bu bölüm, yapılan işlerin ve teknik olarak yapılamayanların nedenlerini, ileride çözüm için gereksinimleri ve önerileri net şekilde ortaya koyar.
