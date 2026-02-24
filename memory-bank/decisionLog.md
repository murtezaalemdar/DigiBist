# Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-23 | cross_val_score n_jobs=1 (CV serialized) | LightGBM(n_jobs=4) iç paralellik + CV(n_jobs=4) = 16 thread, 4 çekirdekte CPU thrashing. CV sıralı yapılırsa her model kendi 4 thread'ini verimli kullanır. LightGBM CV 49s→~2s |
| 2026-02-23 | LightGBM force_col_wise=True | Küçük veri setlerinde (250 satır) LightGBM column-wise partition'ı otomatik seçemiyor, force ederek uyarı kaldırıldı ve hafif hız kazanıldı |
| 2026-02-23 | Section 10 redundant refit kaldırıldı | Modeller section 7'de zaten full data üzerinde eğitiliyordu. Section 10 tekrar fit() çağrısı gereksiz ~3-5s tasarruf |
| 2026-02-23 | cross_val_predict → manual walk-forward | cross_val_predict(cv=TimeSeriesSplit) "only works for partitions" hatası verdi. TimeSeriesSplit tüm örnekleri kapsamaz. Manuel fold loop'a geri dönüldü |
| 2026-02-23 | Drill-down data backend'de hesaplanır | Frontend'de hesaplama yerine model.py içinde fold detayları, feature importance, RSI geçmişi hesaplanıp API'ye eklendi. Daha güvenilir ve tutarlı |
| 2026-02-23 | DrillDownModal 5 ayrı sub-component | Her metrik için ayrı detay paneli: DirectionalDetail, CVDetail, RSIDetail, FeaturesDetail, TrainingDetail. Tek monolitik modal yerine modüler yapı |
| 2026-02-24 | Google News RSS proxy (KAP API yerine) | KAP API sunucudan POST timeout, isyatirim 401, Yahoo Finance 0 sonuç. 10+ test script denendi. Google News RSS hızlı ve güvenilir alternatif |
| 2026-02-24 | Dual Y-axis ComposedChart pattern | RSI/MACD/Hacim grafiklerinde fiyat görünmüyordu. Her grafik ComposedChart ile sol (metrik) + sağ (fiyat ₺) eksen oldu. Kullanıcı her sekmede fiyatı görebilir |
| 2026-02-24 | Fibonacci 7 seviye retracement | 0%, 23.6%, 38.2%, 50%, 61.8%, 78.6%, 100% — standart teknik analiz seviyeleri. ReferenceLine + renk kodlu kartlar + en yakın seviye yorumu |
| 2026-02-24 | MACD Signal renk değişimi (#f59e0b→#a855f7) | Fiyat çizgisi turuncu (#f59e0b) kullandığı için Signal çizgisi mor (#a855f7), Hacim Ort. yeşil (#22c55e) yapıldı — renk çakışması önlendi |
| 2026-02-24 | MACD Histogram Cell pattern | `<rect>` yerine recharts `<Cell>` component kullanıldı — her bar'ın yeşil/kırmızı rengi doğru render ediliyor |
| 2026-02-24 | deploy.ps1 otomatik versiyon artırma | Kullanıcı her deploy'da versiyon artırmayı unutuyordu. PowerShell betiği config.js'den regex ile versiyon okuyup otomatik artırır |
| 2026-02-24 | WebSocket interval 10s→60s | Borsa verisi zaten saniyede değişmiyor, 60s yeterli. CPU/ağ yükü 6x azaldı. Frontend dinamik countdown eklendi |
| 2026-02-24 | Grafik interval backend parametresi | yfinance farklı interval'lar için farklı max period kısıtlaması var. interval_limits dict ile her interval için uygun period/fetch mantığı |
| 2026-02-24 | Fibonacci labels sağa taşındı | Sol margin dar olduğundan etiketler kesiliyor ve üşt üşte biniyordu. position:'right' + kısa format + sabit Y domain çözümü |
| 2026-02-24 | Sticky header wrapper pattern | Navbar ve LiveTicker ayrı sticky yerine tek parent div ile sarıldı. İkisi birlikte scroll'da sabit kalıyor |
| 2026-02-24 | XU100 endeks Navbar'da gösterim | BIST100 endeks değeri yatırımcı için önemli referans. WS döngüsünde yfinance XU100.IS çekilir, Navbar badge olarak gösterilir |
| 2026-02-24 | Sidebar filterText ayrı state | Navbar searchQuery global filtre (App.js filteredStocks), Sidebar filterText lokal filtre. İkisi bağımsız çalışır |
| 2026-02-24 | v8.06.02 Bug Fix Release - 14 kritik/orta hata düzeltildi. Toplam 54 bug'dan 14'ü fix'lendi, 40'ı düşük öncelikli olarak backlog'da. Production deployment başarılı (commit 63519a5). Backend port conflict sorunu yaşandı ancak çözüldü. | - |
| 2026-02-24 | v8.07.00 Fırsat Bildirim Sistemi | OpportunityScanner: STRONG_BUY/SELL, RSI_OVERSOLD/OVERBOUGHT, MACD_CROSS, BIG_MOVE, VOLUME_SPIKE, BOLLINGER. 30dk cooldown, max 200 alert in-memory. Forecast sonrası otomatik tarama |
| 2026-02-24 | Frontend NotificationBell + useNotifications | Browser Notification API + ses uyarısı + WS realtime + 30s polling fallback. Navbar'da çan ikonu + badge + dropdown panel |
| 2026-02-24 | Backend restart: pkill > fuser | `fuser -k 8000/tcp` güvenilir değil (zombie worker'lar kalabiliyor). `pkill -9 -f uvicorn` tüm process'leri öldürüyor. 3s bekleme zorunlu (kernel socket release) |
| 2026-02-24 | Frontend deploy sonrası chown zorunlu | SCP root olarak kopyalar → Nginx www-data olarak çalışır → 403 Forbidden. Her deploy'da `chown -R www-data:www-data` + `chmod -R 755` gerekli |
| 2026-02-24 | RSI Divergence: lookback=5, min_distance=5, dedup=3 | lookback=5: yeterince hassas swing detection. min_distance=5: çok yakın divergence'ları önler. dedup=3: komşu swing'leri birleştirir. Parametreler ayarlanabilir |
| 2026-02-24 | Divergence UI: Büyük etiketli daireler + Türkçe | Küçük üçgenler kullanıcı için anlaşılmaz bulundu. 3 iterasyon: üçgen → hooks fix → büyük label'lı daire + SVG text + glow + eğitici kutu + sinyal kartları |
| 2026-02-24 | React Error #310: useMemo hook pozisyonu | `useMemo` hook `if (!isOpen) return null` early return'dan sonraydı. Modal kapalıyken 8 hook, açıkken 9 hook çalışıyordu. Çözüm: tüm hooklar early return öncesine |
| 2026-02-24 | Login z-index: Navbar relative z-10 | Navbar ve LiveTicker aynı parent içinde (sticky z-50). Login dropdown (z-50) DOM sırasından dolayı LiveTicker'ın altında kalıyordu. Navbar `<nav>`'a `relative z-10` |
| 2026-02-24 | Kelly DrillDown: Investopedia → Modal rapor | Kelly kutusuna tıklayınca dış link yerine detaylı rapor gösterilmeli. formül hesaplama, strateji istatistikleri, gauge, risk limitleri + Investopedia link altta |
| 2026-02-24 | Backend: systemd servisi (digibist-backend.service) | `systemctl restart digibist-backend` kullanılmalı. fuser/pkill kullanmak systemd ile çakışma yaratır. Servis otomatik restart yapıyor |
| 2026-02-24 | Frontend deploy: eski JS bundle temizliği | Birden fazla main.*.js birikiyordu sunucuda. Deploy öncesi `rm -f ...main.*.js` ile temizlenmeli. Tarayıcı cache'den eski bundle'ı yükleyebilir |
