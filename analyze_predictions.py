"""
Tahmin Verileri Derin Analizi
═══════════════════════════════
DB'deki doğrulanmış tahminlerden hangi indikatörlerin
başarılı tahminleri öngördüğünü tespit eder.
"""
import asyncio
import json
import sys

sys.path.insert(0, '/opt/digibist')

from app.core.database import AsyncSessionLocal
from sqlalchemy import text


async def analyze():
    async with AsyncSessionLocal() as s:
        # 1) Genel istatistik
        r = await s.execute(text("""
            SELECT COUNT(*) as total,
                   COUNT(CASE WHEN verified THEN 1 END) as verified,
                   COUNT(CASE WHEN is_direction_correct THEN 1 END) as correct,
                   COUNT(CASE WHEN verified AND NOT is_direction_correct THEN 1 END) as wrong
            FROM stock_forecasts
        """))
        total, verified, correct, wrong = r.fetchone()
        print(f"=== GENEL İSTATİSTİK ===")
        print(f"Toplam: {total}, Doğrulanmış: {verified}, Doğru: {correct}, Yanlış: {wrong}")
        if verified > 0:
            print(f"Doğruluk: %{correct/verified*100:.1f}")
        print()

        # 2) raw_response yapısı
        r2 = await s.execute(text("""
            SELECT raw_response FROM stock_forecasts 
            WHERE verified = true AND raw_response IS NOT NULL LIMIT 1
        """))
        row = r2.fetchone()
        if row and row[0]:
            data = row[0]
            print(f"=== RAW_RESPONSE KEYS ===")
            print(list(data.keys()))
            dd = data.get('drill_down', {})
            if dd:
                print(f"\nDRILL_DOWN KEYS: {list(dd.keys())}")
                fv = dd.get('feature_values', {})
                print(f"FEATURE_VALUES ({len(fv)} toplam): {list(fv.keys())}")
            print()

        # 3) Doğrulanmış tahminlerin indikatör verilerini çek
        r3 = await s.execute(text("""
            SELECT id, symbol, signal, confidence, 
                   is_direction_correct, prediction_score,
                   current_price, predicted_price, actual_price,
                   price_error_pct, raw_response,
                   change_percent
            FROM stock_forecasts 
            WHERE verified = true AND raw_response IS NOT NULL
            ORDER BY id
        """))
        rows = r3.fetchall()
        print(f"=== ANALİZ EDİLECEK VERİ: {len(rows)} doğrulanmış tahmin ===\n")

        # İndikatör değerlerini topla
        results = []
        for row in rows:
            id_, symbol, signal, confidence, is_correct, score, \
                current_price, predicted_price, actual_price, \
                price_error_pct, raw, change_pct = row
            
            if not raw:
                continue
            
            entry = {
                'id': id_,
                'symbol': symbol,
                'signal': signal,
                'confidence': float(confidence) if confidence else 0,
                'is_correct': bool(is_correct),
                'score': float(score) if score else 0,
                'current_price': float(current_price) if current_price else 0,
                'predicted_price': float(predicted_price) if predicted_price else 0,
                'actual_price': float(actual_price) if actual_price else 0,
                'price_error_pct': float(price_error_pct) if price_error_pct else 0,
                'change_pct': float(change_pct) if change_pct else 0,
                # Ana indikatörler
                'rsi': raw.get('rsi'),
                'macd_histogram': raw.get('macd_histogram'),
                'stochastic_k': raw.get('stochastic_k'),
                'bollinger_pctb': raw.get('bollinger_pctb'),
                'directional_accuracy': raw.get('directional_accuracy'),
                'cv_r2': raw.get('cv_r2'),
                'win_rate': raw.get('win_rate'),
                'atr_pct': raw.get('atr_pct'),
                'risk_reward_ratio': raw.get('risk_reward_ratio'),
                'market_regime': raw.get('market_regime'),
                'model_name': raw.get('model_name'),
            }
            
            # Feature values (drill_down içinden)
            dd = raw.get('drill_down', {})
            fv = dd.get('feature_values', {})
            if fv:
                # Tüm feature değerlerini ekle
                for k, v in fv.items():
                    entry[f'fv_{k}'] = v
            
            # Top features
            entry['top_features'] = raw.get('top_features', [])
            
            results.append(entry)

        if not results:
            print("Analiz edilecek veri yok!")
            return

        # 4) İndikatör bazlı başarı analizi
        import statistics

        correct_entries = [r for r in results if r['is_correct']]
        wrong_entries = [r for r in results if not r['is_correct']]
        
        print(f"Doğru: {len(correct_entries)}, Yanlış: {len(wrong_entries)}")
        print()

        # Ana indikatörlerin doğru/yanlış dağılımları
        indicators = ['rsi', 'macd_histogram', 'stochastic_k', 'bollinger_pctb', 
                       'confidence', 'directional_accuracy', 'cv_r2', 'win_rate',
                       'atr_pct', 'risk_reward_ratio']
        
        print("=" * 80)
        print(f"{'İNDİKATÖR':<25} {'DOĞRU ORT':>12} {'YANLIŞ ORT':>12} {'DOĞRU MED':>12} {'YANLIŞ MED':>12} {'FARK':>8}")
        print("=" * 80)
        
        for ind in indicators:
            correct_vals = [r[ind] for r in correct_entries if r[ind] is not None]
            wrong_vals = [r[ind] for r in wrong_entries if r[ind] is not None]
            
            if correct_vals and wrong_vals:
                c_mean = statistics.mean(correct_vals)
                w_mean = statistics.mean(wrong_vals)
                c_med = statistics.median(correct_vals)
                w_med = statistics.median(wrong_vals)
                diff = c_mean - w_mean
                print(f"{ind:<25} {c_mean:>12.4f} {w_mean:>12.4f} {c_med:>12.4f} {w_med:>12.4f} {diff:>+8.4f}")

        # 5) Feature Values bazlı analiz
        print()
        print("=" * 100)
        print("FEATURE VALUES ANALİZİ — Doğru vs Yanlış tahminlerdeki feature ortalamaları")
        print("=" * 100)
        
        # Tüm fv_ prefix'li key'leri bul
        all_fv_keys = set()
        for r in results:
            all_fv_keys.update([k for k in r.keys() if k.startswith('fv_')])
        
        fv_analysis = []
        for fv_key in sorted(all_fv_keys):
            correct_vals = [r[fv_key] for r in correct_entries if fv_key in r and r[fv_key] is not None]
            wrong_vals = [r[fv_key] for r in wrong_entries if fv_key in r and r[fv_key] is not None]
            
            if len(correct_vals) > 5 and len(wrong_vals) > 5:
                c_mean = statistics.mean(correct_vals)
                w_mean = statistics.mean(wrong_vals)
                # Normalize edilmiş fark (ortalama ölçeğine göre)
                avg_all = (c_mean + w_mean) / 2
                if abs(avg_all) > 0.0001:
                    norm_diff = (c_mean - w_mean) / abs(avg_all) * 100
                else:
                    norm_diff = 0
                fv_analysis.append({
                    'key': fv_key.replace('fv_', ''),
                    'c_mean': c_mean,
                    'w_mean': w_mean,
                    'norm_diff': norm_diff,
                    'abs_diff': abs(norm_diff),
                })
        
        # En büyük farka göre sırala
        fv_analysis.sort(key=lambda x: x['abs_diff'], reverse=True)
        
        print(f"{'FEATURE':<25} {'DOĞRU ORT':>14} {'YANLIŞ ORT':>14} {'NORM. FARK %':>14}")
        print("-" * 70)
        for item in fv_analysis[:30]:
            print(f"{item['key']:<25} {item['c_mean']:>14.4f} {item['w_mean']:>14.4f} {item['norm_diff']:>+14.1f}%")

        # 6) Sinyal bazlı başarı
        print()
        print("=" * 60)
        print("SİNYAL BAZLI BAŞARI")
        print("=" * 60)
        for sig in ['BUY', 'SELL', 'HOLD']:
            sig_entries = [r for r in results if r['signal'] == sig]
            sig_correct = [r for r in sig_entries if r['is_correct']]
            if sig_entries:
                acc = len(sig_correct) / len(sig_entries) * 100
                print(f"  {sig}: {len(sig_correct)}/{len(sig_entries)} = %{acc:.1f}")

        # 7) Market regime bazlı başarı
        print()
        print("=" * 60)
        print("MARKET REJİM BAZLI BAŞARI")
        print("=" * 60)
        regimes = set(r['market_regime'] for r in results if r['market_regime'])
        for regime in sorted(regimes):
            reg_entries = [r for r in results if r['market_regime'] == regime]
            reg_correct = [r for r in reg_entries if r['is_correct']]
            if reg_entries:
                acc = len(reg_correct) / len(reg_entries) * 100
                print(f"  {regime}: {reg_correct and len(reg_correct)}/{len(reg_entries)} = %{acc:.1f}")

        # 8) Model bazlı başarı
        print()
        print("=" * 60)
        print("MODEL BAZLI BAŞARI")
        print("=" * 60)
        model_names = set(r['model_name'] for r in results if r['model_name'])
        for model in sorted(model_names):
            m_entries = [r for r in results if r['model_name'] == model]
            m_correct = [r for r in m_entries if r['is_correct']]
            if m_entries:
                acc = len(m_correct) / len(m_entries) * 100
                print(f"  {model}: {len(m_correct)}/{len(m_entries)} = %{acc:.1f}")

        # 9) Confidence eşik analizi
        print()
        print("=" * 60)
        print("CONFIDENCE EŞİK ANALİZİ")
        print("=" * 60)
        for threshold in [0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80]:
            above = [r for r in results if r['confidence'] >= threshold]
            above_correct = [r for r in above if r['is_correct']]
            if above:
                acc = len(above_correct) / len(above) * 100
                print(f"  confidence >= {threshold:.2f}: {len(above_correct)}/{len(above)} = %{acc:.1f}")

        # 10) RSI bölge analizi
        print()
        print("=" * 60)
        print("RSI BÖLGE ANALİZİ")
        print("=" * 60)
        rsi_bands = [(0, 30, 'Aşırı Satım'), (30, 40, 'Düşük'), (40, 60, 'Normal'), 
                     (60, 70, 'Yüksek'), (70, 100, 'Aşırı Alım')]
        for lo, hi, label in rsi_bands:
            band = [r for r in results if r['rsi'] is not None and lo <= r['rsi'] < hi]
            band_correct = [r for r in band if r['is_correct']]
            if band:
                acc = len(band_correct) / len(band) * 100
                print(f"  RSI {lo}-{hi} ({label}): {len(band_correct)}/{len(band)} = %{acc:.1f}")

        # 11) MACD Histogram bölge analizi
        print()
        print("=" * 60)
        print("MACD HİSTOGRAM BÖLGE ANALİZİ")
        print("=" * 60)
        macd_entries_pos = [r for r in results if r['macd_histogram'] is not None and r['macd_histogram'] > 0]
        macd_entries_neg = [r for r in results if r['macd_histogram'] is not None and r['macd_histogram'] <= 0]
        for label, entries in [('MACD > 0 (Boğa)', macd_entries_pos), ('MACD <= 0 (Ayı)', macd_entries_neg)]:
            correct = [r for r in entries if r['is_correct']]
            if entries:
                acc = len(correct) / len(entries) * 100
                print(f"  {label}: {len(correct)}/{len(entries)} = %{acc:.1f}")

        # 12) Bollinger %B bölge analizi
        print()
        print("=" * 60)
        print("BOLLINGER %B BÖLGE ANALİZİ")
        print("=" * 60)
        bb_bands = [(-999, 0, 'Alt Bant Altı'), (0, 0.2, 'Alt Bölge'), (0.2, 0.8, 'Orta'), 
                    (0.8, 1.0, 'Üst Bölge'), (1.0, 999, 'Üst Bant Üstü')]
        for lo, hi, label in bb_bands:
            band = [r for r in results if r['bollinger_pctb'] is not None and lo <= r['bollinger_pctb'] < hi]
            band_correct = [r for r in band if r['is_correct']]
            if band:
                acc = len(band_correct) / len(band) * 100
                print(f"  BB %B {lo}-{hi} ({label}): {len(band_correct)}/{len(band)} = %{acc:.1f}")

        # 13) Stochastic K bölge analizi
        print()
        print("=" * 60)
        print("STOCHASTIC K BÖLGE ANALİZİ")
        print("=" * 60)
        stoch_bands = [(0, 20, 'Aşırı Satım'), (20, 40, 'Düşük'), (40, 60, 'Normal'), 
                       (60, 80, 'Yüksek'), (80, 100, 'Aşırı Alım')]
        for lo, hi, label in stoch_bands:
            band = [r for r in results if r['stochastic_k'] is not None and lo <= r['stochastic_k'] < hi]
            band_correct = [r for r in band if r['is_correct']]
            if band:
                acc = len(band_correct) / len(band) * 100
                print(f"  Stoch K {lo}-{hi} ({label}): {len(band_correct)}/{len(band)} = %{acc:.1f}")

        # 14) En önemli feature'lar ve ne sıklıkla top_features'da göründükleri
        print()
        print("=" * 60)
        print("TOP FEATURES FREKANSI (tüm tahminler)")
        print("=" * 60)
        from collections import Counter
        tf_correct_counter = Counter()
        tf_wrong_counter = Counter()
        for r in results:
            tfs = r.get('top_features', [])
            if r['is_correct']:
                tf_correct_counter.update(tfs)
            else:
                tf_wrong_counter.update(tfs)
        
        all_tfs = set(list(tf_correct_counter.keys()) + list(tf_wrong_counter.keys()))
        tf_analysis = []
        for tf in all_tfs:
            c = tf_correct_counter.get(tf, 0)
            w = tf_wrong_counter.get(tf, 0)
            total_tf = c + w
            if total_tf > 10:
                ratio = c / total_tf * 100
                tf_analysis.append((tf, c, w, total_tf, ratio))
        
        tf_analysis.sort(key=lambda x: x[4], reverse=True)
        print(f"{'FEATURE':<25} {'DOĞRU':>8} {'YANLIŞ':>8} {'TOPLAM':>8} {'DOĞRU %':>8}")
        print("-" * 60)
        for name, c, w, t, ratio in tf_analysis[:25]:
            print(f"{name:<25} {c:>8} {w:>8} {t:>8} {ratio:>7.1f}%")

        # 15) ATR % bölge analizi  
        print()
        print("=" * 60)
        print("ATR % (VOLATİLİTE) BÖLGE ANALİZİ")
        print("=" * 60)
        atr_bands = [(0, 1, 'Çok Düşük'), (1, 2, 'Düşük'), (2, 3, 'Normal'), 
                     (3, 5, 'Yüksek'), (5, 100, 'Çok Yüksek')]
        for lo, hi, label in atr_bands:
            band = [r for r in results if r['atr_pct'] is not None and lo <= r['atr_pct'] < hi]
            band_correct = [r for r in band if r['is_correct']]
            if band:
                acc = len(band_correct) / len(band) * 100
                print(f"  ATR% {lo}-{hi} ({label}): {len(band_correct)}/{len(band)} = %{acc:.1f}")

        # 16) Fiyat değişim büyüklüğü ve başarı
        print()
        print("=" * 60)
        print("TAHMİN EDİLEN DEĞİŞİM BÜYÜKLÜĞÜ ve BAŞARI")
        print("=" * 60)
        for lo, hi, label in [(0, 1, '%0-1'), (1, 2, '%1-2'), (2, 3, '%2-3'), (3, 5, '%3-5'), (5, 100, '%5+')]:
            band = [r for r in results if abs(r['change_pct']) >= lo and abs(r['change_pct']) < hi]
            band_correct = [r for r in band if r['is_correct']]
            if band:
                acc = len(band_correct) / len(band) * 100
                print(f"  |Değişim| {label}: {len(band_correct)}/{len(band)} = %{acc:.1f}")


asyncio.run(analyze())
