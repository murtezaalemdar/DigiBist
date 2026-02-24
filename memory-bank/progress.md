# Progress (Updated: 2026-02-24)

## Done

- ✅ v8.08.00 (devam eden) — RSI Divergence + Kelly DrillDown + Bug Fix'ler
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

- Git commit & push v8.08.00 değişiklikleri
- Versiyon bump (config.js v8.07.00 → v8.08.00)

## Next

- Divergence algoritma parametreleri kullanıcı ayarlarına taşınabilir
- Portföy değeri kullanıcı bazlı yapılabilir (şu an sabit 250.000₺)
- GPU kurulum sonrası model performans testi

