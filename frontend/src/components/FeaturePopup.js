import React from 'react';
import { X, TrendingUp, BarChart2, Info } from 'lucide-react';

/* ─── Gösterge Bilgi Sözlüğü ─── */
const INDICATOR_INFO = {
  // Fiyat
  'Open':        { fullName: 'Açılış Fiyatı', desc: 'Günün açılış fiyatı.', cat: 'Fiyat', fmt: 'price' },
  'High':        { fullName: 'En Yüksek', desc: 'Gün içi en yüksek fiyat.', cat: 'Fiyat', fmt: 'price' },
  'Low':         { fullName: 'En Düşük', desc: 'Gün içi en düşük fiyat.', cat: 'Fiyat', fmt: 'price' },
  'Volume':      { fullName: 'İşlem Hacmi', desc: 'Günlük toplam işlem hacmi (lot).', cat: 'Hacim', fmt: 'volume' },
  // Hareketli Ortalamalar
  'SMA_5':       { fullName: '5 Günlük Basit HO', desc: 'Kısa vadeli trend yönünü gösterir. Fiyat üstünde = yükseliş.', cat: 'Trend', fmt: 'price' },
  'SMA_10':      { fullName: '10 Günlük Basit HO', desc: 'Kısa-orta vadeli trend yönü.', cat: 'Trend', fmt: 'price' },
  'SMA_20':      { fullName: '20 Günlük Basit HO', desc: 'Orta vadeli trend. Fiyatın destek/direnç seviyesi olarak çalışır.', cat: 'Trend', fmt: 'price' },
  'SMA_50':      { fullName: '50 Günlük Basit HO', desc: 'Uzun vadeli ana trendin yönünü belirler.', cat: 'Trend', fmt: 'price' },
  'EMA_5':       { fullName: '5 Günlük Üssel HO', desc: 'Son fiyatlara daha fazla ağırlık veren kısa vadeli trend.', cat: 'Trend', fmt: 'price' },
  'EMA_10':      { fullName: '10 Günlük Üssel HO', desc: 'Hızlı tepki veren ortalama, kısa vadeli momentum.', cat: 'Trend', fmt: 'price' },
  'EMA_20':      { fullName: '20 Günlük Üssel HO', desc: 'Orta vadeli üssel ortalama, trend dönüşlerini hızlı yakalar.', cat: 'Trend', fmt: 'price' },
  'EMA_50':      { fullName: '50 Günlük Üssel HO', desc: 'Ana trendin üssel ortalama ile takibi.', cat: 'Trend', fmt: 'price' },
  // Momentum
  'RSI_14':      { fullName: 'RSI (14 Gün)', desc: '0-100 arası. 30↓ aşırı satım (AL fırsatı), 70↑ aşırı alım (SAT sinyali).', cat: 'Momentum', fmt: 'num' },
  'RSI_7':       { fullName: 'RSI (7 Gün)', desc: 'Daha kısa periyotlu RSI, hızlı momentum değişimlerini yakalar.', cat: 'Momentum', fmt: 'num' },
  'Stoch_K':     { fullName: 'Stochastic %K', desc: 'Fiyatın belirli dönem içindeki konumu. 20↓ aşırı satım, 80↑ aşırı alım.', cat: 'Momentum', fmt: 'num' },
  'Stoch_D':     { fullName: 'Stochastic %D', desc: '%K\'nın 3 günlük ortalaması. %K, %D\'yi yukarı keserse AL sinyali.', cat: 'Momentum', fmt: 'num' },
  'MACD':        { fullName: 'MACD', desc: 'Hareketli ortalamaların yakınsaması/uzaklaşması. Sinyal çizgisini yukarı kesmesi AL.', cat: 'Momentum', fmt: 'num' },
  'MACD_Signal': { fullName: 'MACD Sinyal', desc: 'MACD\'nin 9 günlük ortalaması. Kesişim noktaları alım/satım sinyali verir.', cat: 'Momentum', fmt: 'num' },
  'MACD_Hist':   { fullName: 'MACD Histogram', desc: 'MACD ile Sinyal farkı. Pozitif = yükseliş momentum, negatif = düşüş.', cat: 'Momentum', fmt: 'num' },
  // Bollinger
  'BB_Upper':    { fullName: 'Bollinger Üst Bant', desc: 'Fiyat üst banda temas = aşırı alım bölgesi.', cat: 'Volatilite', fmt: 'price' },
  'BB_Lower':    { fullName: 'Bollinger Alt Bant', desc: 'Fiyat alt banda temas = aşırı satım bölgesi.', cat: 'Volatilite', fmt: 'price' },
  'BB_PctB':     { fullName: 'Bollinger %B', desc: 'Fiyatın Bollinger bantları içindeki konumu (0-1).', cat: 'Volatilite', fmt: 'pct' },
  'BB_BW':       { fullName: 'Bollinger Bant Genişliği', desc: 'Bantlar arası mesafe. Daralma = yaklaşan kırılım sinyali.', cat: 'Volatilite', fmt: 'num' },
  // Hacim
  'OBV':         { fullName: 'On-Balance Volume', desc: 'Hacim-fiyat ilişkisi. Yükselen OBV = alıcı baskısı artıyor.', cat: 'Hacim', fmt: 'volume' },
  'Volume_SMA_20': { fullName: 'Hacim 20G Ortalama', desc: 'Son 20 günlük ortalama hacim. Mevcut hacimle karşılaştırma için.', cat: 'Hacim', fmt: 'volume' },
  'Volume_Ratio': { fullName: 'Hacim Oranı', desc: 'Günlük hacim / 20G ortalama. 1↑ = ortalamanın üstünde işlem hacmi.', cat: 'Hacim', fmt: 'num' },
  // ATR / Volatilite
  'ATR_14':       { fullName: 'ATR (14 Gün)', desc: 'Ortalama gerçek aralık. Yüksek ATR = yüksek volatilite, stop-loss ayarında kullanılır.', cat: 'Volatilite', fmt: 'price' },
  'Volatility_10d': { fullName: '10G Volatilite', desc: 'Son 10 günlük fiyat dalgalanması (standart sapma).', cat: 'Volatilite', fmt: 'pct4' },
  'Volatility_20d': { fullName: '20G Volatilite', desc: 'Son 20 günlük fiyat dalgalanması. Uzun vadeli risk ölçüsü.', cat: 'Volatilite', fmt: 'pct4' },
  // Getiri
  'Return_1d':   { fullName: '1 Günlük Getiri', desc: 'Dünkü fiyat değişimi yüzdesi.', cat: 'Getiri', fmt: 'pct4' },
  'Return_5d':   { fullName: '5 Günlük Getiri', desc: 'Son 5 işlem günü fiyat değişimi.', cat: 'Getiri', fmt: 'pct4' },
  'Return_10d':  { fullName: '10 Günlük Getiri', desc: 'Son 10 işlem günü fiyat değişimi.', cat: 'Getiri', fmt: 'pct4' },
  // Fiyat Oranları
  'Price_SMA10_Ratio':  { fullName: 'Fiyat/SMA10', desc: 'Fiyatın 10G ortalamaya oranı. 1↑ = ortalama üstünde.', cat: 'Trend', fmt: 'num' },
  'Price_SMA20_Ratio':  { fullName: 'Fiyat/SMA20', desc: 'Fiyatın 20G ortalamaya oranı. 1↑ = yükseliş trendi.', cat: 'Trend', fmt: 'num' },
  'Price_SMA50_Ratio':  { fullName: 'Fiyat/SMA50', desc: 'Fiyatın 50G ortalamaya oranı. Ana trend göstergesi.', cat: 'Trend', fmt: 'num' },
  // Cross sinyalleri
  'SMA_5_10_Cross':  { fullName: 'SMA 5/10 Kesişim', desc: '1 = SMA5 > SMA10 (yükseliş), 0 = SMA5 < SMA10 (düşüş).', cat: 'Sinyal', fmt: 'int' },
  'SMA_10_20_Cross': { fullName: 'SMA 10/20 Kesişim', desc: '1 = SMA10 > SMA20 (yükseliş), 0 = düşüş trendi.', cat: 'Sinyal', fmt: 'int' },
  // Zaman
  'Day_of_Week': { fullName: 'Haftanın Günü', desc: 'Pazartesi=0, Cuma=4. Bazı günler istatistiksel olarak farklı performans gösterir.', cat: 'Zaman', fmt: 'int' },
  'Month':       { fullName: 'Ay', desc: 'Yılın ayı (1-12). Mevsimsel etkileri yakalar.', cat: 'Zaman', fmt: 'int' },
  // Lag
  'Close_Lag_1': { fullName: '1 Gün Önceki Kapanış', desc: 'Dünkü kapanış fiyatı.', cat: 'Fiyat', fmt: 'price' },
  'Close_Lag_2': { fullName: '2 Gün Önceki Kapanış', desc: '2 gün önceki kapanış.', cat: 'Fiyat', fmt: 'price' },
  'Close_Lag_3': { fullName: '3 Gün Önceki Kapanış', desc: '3 gün önceki kapanış.', cat: 'Fiyat', fmt: 'price' },
  'Close_Lag_5': { fullName: '5 Gün Önceki Kapanış', desc: 'Haftabaşı kapanışı.', cat: 'Fiyat', fmt: 'price' },
  // USD/TRY
  'USDTRY':      { fullName: 'USD/TRY Kuru', desc: 'Dolar/TL kuru. BIST hisselerini doğrudan etkiler.', cat: 'Makro', fmt: 'price' },
  'USDTRY_SMA10': { fullName: 'USD/TRY 10G HO', desc: 'Kur\'un 10 günlük ortalaması. Trend yönünü gösterir.', cat: 'Makro', fmt: 'price' },
  // Haftalık
  'Weekly_Close': { fullName: 'Haftalık Kapanış', desc: 'Haftanın son kapanış fiyatı.', cat: 'Fiyat', fmt: 'price' },
  'Weekly_Return': { fullName: 'Haftalık Getiri', desc: 'Haftalık fiyat değişimi.', cat: 'Getiri', fmt: 'pct4' },
  'Weekly_High':  { fullName: 'Haftalık En Yüksek', desc: 'Hafta içi en yüksek fiyat.', cat: 'Fiyat', fmt: 'price' },
  'Weekly_Low':   { fullName: 'Haftalık En Düşük', desc: 'Hafta içi en düşük fiyat.', cat: 'Fiyat', fmt: 'price' },
};

/* ─── Kategori Renkleri ─── */
const CAT_COLORS = {
  Fiyat:     'bg-slate-500/20 text-slate-300',
  Trend:     'bg-blue-500/20 text-blue-300',
  Momentum:  'bg-purple-500/20 text-purple-300',
  Volatilite:'bg-orange-500/20 text-orange-300',
  Hacim:     'bg-green-500/20 text-green-300',
  Getiri:    'bg-cyan-500/20 text-cyan-300',
  Sinyal:    'bg-yellow-500/20 text-yellow-300',
  Zaman:     'bg-pink-500/20 text-pink-300',
  Makro:     'bg-red-500/20 text-red-300',
};

/* ─── Değer Formatlama ─── */
const formatValue = (val, fmt) => {
  if (val == null || val === undefined) return '—';
  switch (fmt) {
    case 'price':
      return `₺${Number(val).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'volume':
      if (Math.abs(val) >= 1e9) return `${(val / 1e9).toFixed(2)}B`;
      if (Math.abs(val) >= 1e6) return `${(val / 1e6).toFixed(2)}M`;
      if (Math.abs(val) >= 1e3) return `${(val / 1e3).toFixed(1)}K`;
      return Number(val).toLocaleString('tr-TR');
    case 'pct':
      return `${(val * 100).toFixed(2)}%`;
    case 'pct4':
      return `${(val * 100).toFixed(4)}%`;
    case 'int':
      return Math.round(val).toString();
    default:
      return Number(val).toFixed(4);
  }
};

/* ─── Rank Badge Rengi ─── */
const rankColor = (rank) => {
  if (rank === 1) return 'bg-yellow-500 text-black';
  if (rank === 2) return 'bg-slate-300 text-black';
  if (rank === 3) return 'bg-amber-700 text-white';
  if (rank <= 5) return 'bg-blue-500/30 text-blue-300';
  return 'bg-white/10 text-slate-400';
};

const rankLabel = (rank) => {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
};

/* ─── Ana Component ─── */
const FeaturePopup = ({ isOpen, onClose, featureName, data }) => {
  if (!isOpen || !featureName || !data) return null;

  const drill = data.drill_down || {};
  const allFeatures = drill.feature_importances || [];
  const featureValues = drill.feature_values || {};

  // Bu feature'ın bilgilerini bul
  const featureIdx = allFeatures.findIndex(f => f.name === featureName);
  const featureData = allFeatures[featureIdx] || null;
  const rank = featureIdx + 1;
  const importance = featureData?.importance || 0;
  const maxImportance = allFeatures[0]?.importance || 1;
  const relPct = (importance / maxImportance) * 100;
  const totalPct = (importance * 100).toFixed(2);

  // Gösterge bilgisi
  const info = INDICATOR_INFO[featureName] || {
    fullName: featureName,
    desc: 'Bu gösterge hakkında detay bilgi mevcut değil.',
    cat: 'Diğer',
    fmt: 'num'
  };

  const catClass = CAT_COLORS[info.cat] || 'bg-white/10 text-slate-400';
  const currentVal = featureValues[featureName];

  // Komşu göstergeler (bağlam için)
  const neighbors = [];
  for (let i = Math.max(0, featureIdx - 2); i <= Math.min(allFeatures.length - 1, featureIdx + 2); i++) {
    neighbors.push({ ...allFeatures[i], rank: i + 1, isCurrent: i === featureIdx });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-[#0f1729] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className={`text-sm w-8 h-8 rounded-lg flex items-center justify-center font-bold ${rankColor(rank)}`}>
              {rankLabel(rank)}
            </span>
            <div>
              <h3 className="text-base font-bold text-white">{info.fullName}</h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${catClass}`}>{info.cat}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Açıklama */}
          <div className="flex items-start gap-2 bg-white/5 rounded-xl p-3">
            <Info size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-slate-300 leading-relaxed">{info.desc}</p>
          </div>

          {/* Değer + Importance */}
          <div className="grid grid-cols-2 gap-3">
            {/* Mevcut Değer */}
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <div className="text-[10px] text-slate-500 uppercase mb-1">Son Değer</div>
              <div className="text-lg font-bold text-white">
                {formatValue(currentVal, info.fmt)}
              </div>
            </div>
            {/* Önem */}
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <div className="text-[10px] text-slate-500 uppercase mb-1">Model Etkisi</div>
              <div className="text-lg font-bold text-blue-400">%{totalPct}</div>
            </div>
          </div>

          {/* Importance Bar */}
          <div>
            <div className="flex justify-between text-[10px] text-slate-500 mb-1">
              <span>Göreceli Etki ({allFeatures.length} gösterge içinde)</span>
              <span>{rank}. sıra</span>
            </div>
            <div className="w-full bg-white/5 h-3 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${rank <= 3 ? 'bg-blue-500' : rank <= 7 ? 'bg-blue-400/60' : 'bg-slate-500'}`}
                style={{ width: `${relPct}%` }}
              />
            </div>
          </div>

          {/* Yakın Sıradaki Göstergeler */}
          <div>
            <h4 className="text-[11px] text-slate-500 uppercase font-bold mb-2">Yakın Sıralama</h4>
            <div className="space-y-1">
              {neighbors.map((n) => (
                <div
                  key={n.rank}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs ${
                    n.isCurrent
                      ? 'bg-blue-500/15 border border-blue-500/30'
                      : 'bg-white/5'
                  }`}
                >
                  <span className="text-slate-600 font-mono w-5 text-[10px]">{n.rank}</span>
                  <span className={`flex-1 truncate font-mono ${n.isCurrent ? 'text-blue-300 font-bold' : 'text-slate-400'}`}>
                    {n.name}
                  </span>
                  <div className="w-16 bg-white/5 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${n.isCurrent ? 'bg-blue-500' : 'bg-slate-600'}`}
                      style={{ width: `${(n.importance / maxImportance) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 min-w-[40px] text-right">
                    {(n.importance * 100).toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Alt bilgi */}
          <div className="text-[10px] text-slate-600 text-center pt-1 border-t border-white/5">
            Toplam {allFeatures.length} gösterge arasında #{rank} sırada • Model: {data.best_model}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeaturePopup;
