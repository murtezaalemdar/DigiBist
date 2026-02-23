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

- **Microservices via Docker Compose**: Her servis ayrı container, network üzerinden iletişim
- **Event-driven realtime**: WebSocket ile gerçek zamanlı fiyat akışı
- **Ensemble ML**: Birden fazla model ağırlıklı ortalama ile birleştirilir (CV R² bazlı)
- **Risk-first signal pipeline**: ML sinyal → Risk Engine filtre → Final sinyal

## Design Patterns

- **RBAC (Role-Based Access Control)**: Kullanıcı → Roller → İzinler (permissions tablosu)
- **Mobile-first responsive**: Tailwind sm/md/lg/xl breakpoints, mobil card view + desktop tablo
- **Component-based frontend**: React sayfa bileşenleri, hook'lar, utility fonksiyonlar ayrı
- **Health check chain**: postgres healthy → backend healthy → frontend/filament başlar

## API Patterns

- `GET /api/stocks/trading-list` — Hisse listesi (100 BIST100)
- `GET /api/ai-forecast/{symbol}` — AI teknik analiz
- `POST /api/trade/manual` — Manuel emir
- `POST /api/trade/auto/{action}` — Oto trade (start/stop/runOnce)
- `WS /ws/market` — Gerçek zamanlı fiyat stream
- `GET /api/broker/status` — Aktif broker durumu
- `GET /api/broker/list` — Tüm broker bilgileri (UI config alanlarıyla)
- `POST /api/broker/switch` — Broker değiştir
- `POST /api/broker/config` — Broker yapılandırması kaydet
- `GET /admin/api/*` — Filament admin CRUD endpoints

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