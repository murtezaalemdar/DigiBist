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
