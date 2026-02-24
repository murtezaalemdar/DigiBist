# Progress (Updated: 2026-02-24)

## Done

### v8.06 — Grafik Interval + BIST100 Endeks + Sidebar Filtre + Sticky Header + Fiyat Değişim (24 Şubat 2026)
- ✅ Grafik interval butonları (1DK, 5DK, 1Saat, 3S, 1Hafta) — backend `interval` parametre desteği + frontend UI
- ✅ Fibonacci etiket düzeltmesi (sağa taşındı, kısaltıldı, Y domain sabitlendi)
- ✅ Tüm grafiklerde YAxis width (40-65px) + margin düzeltmeleri
- ✅ Navbar + LiveTicker sticky header (scroll'da sabit kalma)
- ✅ Sidebar hisse filtre arama kutusu (Tümü/Favoriler yanına)
- ✅ BIST 100 (XU100) endeks değeri Navbar'da gösterim (desktop + mobil)
- ✅ Piyasa Fiyatı kartında günlük değişim yüdesi ikon ile gösterim (TrendingUp/Down)
- ✅ LiveTicker'dan XU100 filtrelendi (Navbar'da zaten görünüyor)

### v8.05 — KAP Bildirileri + Fibonacci Grafik + Deploy Otomasyon
- ✅ KAP News (Google News RSS proxy)
- ✅ Teknik analiz grafik iyileştirmeleri (dual Y-axis, renk düzeltmeleri)
- ✅ Fibonacci sekmesi (7 retracement seviyesi)
- ✅ deploy.ps1 otomasyon betiği
- ✅ WebSocket 60s interval + dinamik countdown

## Doing

- Versiyon v8.06'ya bump edilmeli (config.js)
- Git commit & push yapılmalı

## Next

- GPU entegrasyonu (henüz takılmadı)
- Filament admin panel geliştirmeleri
- Gerçek broker entegrasyonu (IBKR)

