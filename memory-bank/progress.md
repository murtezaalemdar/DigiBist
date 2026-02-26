# Progress (Updated: 2026-02-26)

## Done

- ✅ v8.09.00 — AI Tahmin Geçmişi & Doğruluk Analizi Sayfası (26 Şubat 2026)
  - Backend: `database.py` — 7 yeni kolon (actual_price, actual_change_pct, is_direction_correct, price_error_pct, prediction_score, verified, verified_at)
  - Backend: `database.py` — `migrate_prediction_verification()` idempotent migration + `predictions.view` izni
  - Backend: `database.py` — `verify_predictions()` TradingView Scanner API (birincil) + Yahoo Spark API (yedek) ile doğrulama
  - Backend: `database.py` — `get_prediction_history()` filtreli + sayfalı tahmin geçmişi
  - Backend: `database.py` — `get_prediction_accuracy_stats()` genel doğruluk istatistikleri (sinyal bazlı breakdown)
  - Backend: `database.py` — `get_prediction_accuracy_timeline()` haftalık doğruluk trendi
  - Backend: `database.py` — `get_prediction_leaderboard()` sembol bazlı en iyi/en kötü sıralama
  - Backend: `main.py` — 5 yeni API endpoint (/api/predictions/*)
  - Frontend: `PredictionHistoryPage.js` (736 satır) — 3 sekmeli tam sayfa
    - Genel Bakış: SVG dairesel gauge'ler, sinyal başarı çubukları, haftalık trend grafiği
    - Tahmin Geçmişi: Filtrelenebilir + sayfalı tablo (11 kolon: AI Sinyal + Risk Sonuç ayrı)
    - Sıralama: En iyi/en kötü tahmin edilen semboller
  - Frontend: `App.js` — PredictionHistoryPage import + PAGE_PERMISSIONS entegrasyonu
  - Frontend: `Navbar.js` — Target ikonu + "AI Tahminleri" tab eklendi
  - Bug Fix: Auth token — `localStorage.getItem('token')` → `useAuth().authFetch` (401 hata düzeltildi)
  - Bug Fix: yfinance → TradingView migration — doğrulama işlevi TradingView Scanner API kullanır
  - Bug Fix: HOLD sinyal gösterimi — dual kolon (AI Sinyal + Risk Sonuç) ile risk_signal/signal ayrı gösterilir
  - Deploy: Backend + Frontend production'a deploy edildi (SCP + systemctl restart)
- ✅ v8.08.00 — RSI Divergence + Kelly DrillDown + Bug Fix'ler
  - Backend: RSI bullish/bearish divergence algılama algoritması (`/api/ai-chart-data/{symbol}`)
    - Swing low/high detection (lookback=5), dedup (3 bar mesafe), min_distance=5
    - API response: `bullishDiv`/`bearishDiv` per record + `divergences` array
  - Frontend: AnalysisChartModal RSI tab — divergence görselleştirme (3 iterasyon)
    - v1: Küçük üçgenler → v2: Hooks fix → v3: Büyük etiketli daireler + Türkçe
    - Büyük yeşil/kırmızı daire + glow efekt + "YÜKSELİŞ"/"DÜŞÜŞ" SVG text
    - Bağlantı çizgileri (dashed, connectNulls)
    - Eğitici kutu: "RSI Uyumsuzluğu Nedir?" Türkçe açıklama
    - Sinyal kartları: Fiyat/RSI grid, % değişim, Türkçe yorum
    - Badge: "🟢 X Yükseliş Sinyali" / "🔴 X Düşüş Sinyali"
  - Frontend: DrillDownModal — Kelly Criterion detay raporu (yeni `kelly` tipi)
    - Pozisyon özeti (Half-Kelly % + ₺ tutar)
    - Strateji istatistikleri (kazanma oranı, ort. kazanç/kayıp — progress bar)
    - Kelly formülü hesaplama detayı (p, q, b, Full/Half Kelly, Edge)
    - Pozisyon büyüklüğü gauge skalası (%0-20)
    - Risk limitleri tablosu
    - Eğitici açıklama + Investopedia kaynak linki
  - Bug Fix: React Error #310 — useMemo hooks sırası düzeltildi (early return öncesine taşındı)
  - Bug Fix: Login dropdown z-index — Navbar `<nav>` elementine `relative z-10` eklendi
  - Bug Fix: Divergence markers UI iyileştirmesi (kullanıcı geri bildirimi ile 3x iterasyon)
- ✅ v8.07.00 — Fırsat Bildirim Sistemi (Opportunity Scanner)
  - Backend: OpportunityScanner (11 fırsat tipi, 4 öncelik, 30dk cooldown)
  - Backend: 5 yeni API endpoint (/api/alerts/*)
  - Backend: Forecast sonrası otomatik tarama + Telegram + WS broadcast
  - Frontend: useNotifications hook (polling + WS + Browser Notification API)
  - Frontend: NotificationBell component (badge, dropdown, filtre sekmeleri)
  - Frontend: useWebSocket OPPORTUNITY_ALERT desteği
  - Deploy: v8.07.00 commit d46274e
- ✅ v8.06.02 — 14 Bug Fix Release (commit e58a483)
- ✅ Deploy sorun çözümleri: Port çakışması (pkill -9 -f uvicorn), Frontend 403 (chown www-data)

## Doing

- (Şu an aktif geliştirme yok — tüm özellikler deployed)

## Next

- Tahminleri doğrula butonu test edilmeli (borsa saatlerinde TradingView verileri)
- Risk Engine güven eşiği %75 → daha düşük ayarlanabilir (neredeyse tüm sinyaller HOLD'a dönüyor)
- Divergence algoritma parametreleri kullanıcı ayarlarına taşınabilir
- Portföy değeri kullanıcı bazlı yapılabilir (şu an sabit 250.000₺)
- GPU kurulum sonrası model performans testi

