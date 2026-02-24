# System Patterns — DigiBist

## Mimari Yapı

```
[React Frontend :3000] ←→ [FastAPI ML Backend :8000] ←→ [PostgreSQL :5432]
                                    ↕                           ↕
                            [WebSocket Stream]         [Filament Admin :8001]
                                    ↕
                            [Telegram Bot API]
```

## Architectural Patterns

- **Native deployment on Ubuntu 24.04**: Backend uvicorn nohup, Nginx for frontend, PostgreSQL native
- **Event-driven realtime**: WebSocket ile gerçek zamanlı fiyat akışı (60s interval)
- **Ensemble ML**: 3 model (LightGBM + RandomForest + XGBoost) ağırlıklı ortalama (CV R² bazlı)
- **Risk-first signal pipeline**: ML sinyal → Risk Engine filtre → Final sinyal
- **Thread management**: CV serialized (n_jobs=1), her model kendi n_jobs=4 kullanır (oversubscription önlenir)
- **Cache**: CACHE_TTL=120s, forecast sonuçları in-memory cache
- **KAP News**: Google News RSS proxy (KAP API bloklu), 10dk cache, 35+ sembol eşleştirmesi
- **Dual Y-axis Charts**: RSI/MACD/Hacim grafiklerinde sol eksen metrik, sağ eksen fiyat (₺)

## Deploy Patterns

- **⚠️ HER DEPLOY'DA VERSİYON ARTIR!** — `deploy.ps1` kullan veya `config.js` APP_VERSION'ı manuel artır
- **deploy.ps1**: `.\deploy.ps1 -All -GitPush` (full deploy + git), `.\deploy.ps1 -Backend` (sadece backend)
- **Backend restart**: `fuser -k 8000/tcp; sleep 2; cd /opt/digibist/backend && venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4 &`
- **Frontend deploy**: npm build → scp → `chmod -R 755 /opt/digibist/frontend/build/`
- **Git**: `github.com/murtezaalemdar/DigiBist.git` branch `main`

## Design Patterns

- **RBAC (Role-Based Access Control)**: Kullanıcı → Roller → İzinler (permissions tablosu)
- **Mobile-first responsive**: Tailwind sm/md/lg/xl breakpoints, mobil card view + desktop tablo
- **Component-based frontend**: React sayfa bileşenleri, hook'lar, utility fonksiyonlar ayrı
- **Health check chain**: postgres healthy → backend healthy → frontend/filament başlar

## API Patterns

- `GET /api/stocks/trading-list` — Hisse listesi (100 BIST100)
- `GET /api/ai-forecast/{symbol}` — AI teknik analiz + drill_down detayları
- `GET /api/ai-chart-data/{symbol}` — Grafik verisi (OHLCV, SMA, RSI, MACD, Bollinger)
- `GET /api/kap-news/{symbol}` — KAP haberleri (Google News RSS proxy, 10dk cache)
- `POST /api/trade/manual` — Manuel emir
- `POST /api/trade/auto/{action}` — Oto trade (start/stop/runOnce)
- `WS /ws/market` — Gerçek zamanlı fiyat stream (60s)
- `GET /api/broker/status` — Aktif broker durumu
- `GET /api/broker/list` — Tüm broker bilgileri (UI config alanlarıyla)
- `POST /api/broker/switch` — Broker değiştir
- `POST /api/broker/config` — Broker yapılandırması kaydet
- `GET /api/price-provider/stats` — Canlı fiyat provider istatistikleri

## AI Forecast Response drill_down Object

```json
{
  "drill_down": {
    "cv_fold_details": {"LightGBM": [r2_fold1, r2_fold2, ...], ...},
    "feature_importances_full": [{"feature": "RSI_14", "importance": 0.23}, ...],
    "fold_directional": [{"fold": 1, "correct": 8, "total": 10, "accuracy": 0.8, ...}, ...],
    "training_date_range": {"start": "2025-02-24", "end": "2026-02-21"},
    "rsi_history": [{"date": "2026-02-21", "value": 45.2}, ...]
  }
}
```

## Broker Mimarisi

- **BrokerManager** → Merkezi yönetici, aktif broker tutma, switch, config
- **BrokerBase** → Abstract base class (connect, disconnect, place_order, get_status)
- **PaperBroker** → Simülasyon modu (varsayılan, 250K TRY)
- **IBKRBroker** → Interactive Brokers TWS/Gateway API
- **MatriksBroker** → Matriks IQ API (BIST odaklı)
- **IsYatirimBroker** → İş Yatırım Trader API (BIST odaklı)
- **ExecutionEngine** → broker_manager referansı ile gerçek emir yönlendirme

## Layout

- Full-width layout (max-w kısıtlaması yok)
- Responsive padding: px-3 sm:px-4 lg:px-6 xl:px-8
- Sidebar: lg:sticky lg:top-20, max-h-[60vh] xl:max-h-[70vh]

## DB Credential'lar

- User: `bist_admin`
- Password: `bist_secure_2026`
- Database: `bist_trading`