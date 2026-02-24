import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ComposedChart, Legend,
} from 'recharts';
import {
  X, TrendingUp, Activity, BarChart3, Layers, Target,
} from 'lucide-react';
import { API_BASE } from '../config';

/* ─── Zaman Aralığı (Interval) Seçenekleri ─── */
const INTERVALS = [
  { label: '1DK',    value: '1m' },
  { label: '5DK',    value: '5m' },
  { label: '1Saat',  value: '60m' },
  { label: '3S',     value: '1h' },
  { label: '1Hafta', value: '1wk' },
];

/* ─── Periyot Seçenekleri ─── */
const PERIODS = [
  { label: '1A', value: '1mo' },
  { label: '3A', value: '3mo' },
  { label: '6A', value: '6mo' },
  { label: '1Y', value: '1y' },
  { label: '2Y', value: '2y' },
];

/* ─── Tab Tanımları ─── */
const TABS = [
  { id: 'price', label: 'Fiyat & SMA', icon: TrendingUp },
  { id: 'rsi', label: 'RSI', icon: Activity },
  { id: 'macd', label: 'MACD', icon: BarChart3 },
  { id: 'volume', label: 'Hacim', icon: Layers },
  { id: 'fibonacci', label: 'Fibonacci', icon: Target },
];

/* ─── Özel Tooltip ─── */
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0d1220] border border-white/10 rounded-xl p-3 shadow-2xl text-xs">
      <p className="text-slate-400 font-bold mb-1.5">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex justify-between gap-4">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span className="font-mono font-bold text-slate-200">
            {typeof entry.value === 'number' ? entry.value.toLocaleString('tr-TR') : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

/* ─── Ana Modal Bileşeni ─── */
const AnalysisChartModal = ({ isOpen, onClose, symbol, forecastData }) => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('price');
  const [period, setPeriod] = useState('6mo');
  const [interval, setChartInterval] = useState('1d');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !symbol) return;
    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/api/ai-chart-data/${symbol}?period=${period}&interval=${interval}`)
      .then(res => res.json())
      .then(d => {
        if (d.error) {
          setError(d.error);
          setChartData([]);
        } else {
          setChartData(d.data || []);
        }
      })
      .catch(() => setError('Grafik verisi yüklenemedi.'))
      .finally(() => setLoading(false));
  }, [isOpen, symbol, period, interval]);

  if (!isOpen) return null;

  // Son veri noktasını al
  const lastPoint = chartData.length > 0 ? chartData[chartData.length - 1] : null;

  // X-axis tick formatter (intraday vs daily)
  const isIntraday = ['1m', '5m', '60m', '1h'].includes(interval);
  const formatDate = (d) => {
    if (isIntraday && d.includes(' ')) {
      // "2026-02-24 14:30" → "14:30"
      return d.split(' ')[1];
    }
    const parts = d.split('-');
    return `${parts[2]}/${parts[1]}`;
  };

  // Fibonacci seviyeleri
  const fibHigh = chartData.length > 0 ? Math.max(...chartData.map(d => d.high)) : 0;
  const fibLow = chartData.length > 0 ? Math.min(...chartData.map(d => d.low)) : 0;
  const fibDiff = fibHigh - fibLow;
  const fibLevels = fibDiff > 0 ? [
    { pct: '0%', value: +fibHigh.toFixed(2), label: '0% (Zirve)', color: '#ef4444' },
    { pct: '23.6%', value: +(fibHigh - fibDiff * 0.236).toFixed(2), label: '23.6%', color: '#f97316' },
    { pct: '38.2%', value: +(fibHigh - fibDiff * 0.382).toFixed(2), label: '38.2%', color: '#eab308' },
    { pct: '50%', value: +(fibHigh - fibDiff * 0.5).toFixed(2), label: '50%', color: '#22c55e' },
    { pct: '61.8%', value: +(fibHigh - fibDiff * 0.618).toFixed(2), label: '61.8%', color: '#3b82f6' },
    { pct: '78.6%', value: +(fibHigh - fibDiff * 0.786).toFixed(2), label: '78.6%', color: '#8b5cf6' },
    { pct: '100%', value: +fibLow.toFixed(2), label: '100% (Dip)', color: '#ec4899' },
  ] : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-6xl max-h-[90vh] bg-[#0a0f1c] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div>
            <h3 className="text-2xl font-extrabold flex items-center gap-3">
              <Activity className="text-blue-500" size={24} />
              {symbol} — Teknik Analiz Grafikleri
            </h3>
            <p className="text-slate-500 text-sm mt-1">
              Yapay zeka modelinin kullandığı indikatörler ve fiyat hareketleri
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs ve Periyot */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          {/* Tab Butonları */}
          <div className="flex gap-1 bg-white/5 p-1 rounded-2xl">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Zaman Aralığı (Interval) Seçimi */}
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-white/5 p-1 rounded-2xl">
              {INTERVALS.map(iv => (
                <button
                  key={iv.value}
                  onClick={() => { setChartInterval(iv.value); }}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    interval === iv.value
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {iv.label}
                </button>
              ))}
            </div>

            {/* Periyot Seçimi */}
            <div className="flex gap-1 bg-white/5 p-1 rounded-2xl">
              {PERIODS.map(p => (
                <button
                  key={p.value}
                  onClick={() => { setChartInterval('1d'); setPeriod(p.value); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    interval === '1d' && period === p.value
                      ? 'bg-white/10 text-white'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Grafik İçeriği */}
        <div className="flex-1 p-6 overflow-auto">
          {loading ? (
            <div className="h-[400px] flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                <p className="text-slate-400 animate-pulse text-sm">Grafik verisi yükleniyor...</p>
              </div>
            </div>
          ) : error ? (
            <div className="h-[400px] flex items-center justify-center text-red-400">
              {error}
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-[400px] flex items-center justify-center text-slate-500">
              Veri bulunamadı.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Özet Kartları */}
              {lastPoint && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <MiniStat label="Kapanış" value={`₺${lastPoint.close}`} color="text-white" />
                  <MiniStat label="RSI (14)" value={lastPoint.rsi} color={lastPoint.rsi > 70 ? 'text-red-400' : lastPoint.rsi < 30 ? 'text-green-400' : 'text-blue-400'} />
                  <MiniStat label="MACD" value={lastPoint.macd_hist > 0 ? 'Pozitif' : 'Negatif'} color={lastPoint.macd_hist > 0 ? 'text-green-400' : 'text-red-400'} />
                  <MiniStat label="SMA 20" value={`₺${lastPoint.sma20}`} color="text-yellow-400" />
                  {forecastData?.predicted_price && (
                    <MiniStat label="AI Tahmini" value={`₺${forecastData.predicted_price}`} color="text-purple-400" />
                  )}
                </div>
              )}

              {/* Fiyat & SMA */}
              {activeTab === 'price' && (
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                  <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                    <TrendingUp size={14} className="text-blue-500" />
                    Fiyat Grafiği — Bollinger Bantları &amp; Hareketli Ortalamalar
                  </h4>
                  <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 15, bottom: 5 }}>
                      <defs>
                        <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.15} />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="bbGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.08} />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₺${v}`} width={65} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />

                      {/* Bollinger Bantları */}
                      <Area type="monotone" dataKey="bb_upper" stroke="none" fill="url(#bbGrad)" legendType="none" />
                      <Area type="monotone" dataKey="bb_lower" stroke="none" fill="transparent" legendType="none" />
                      <Line type="monotone" dataKey="bb_upper" stroke="#818cf8" strokeWidth={1} dot={false} strokeDasharray="4 4" name="Bollinger Üst" />
                      <Line type="monotone" dataKey="bb_lower" stroke="#818cf8" strokeWidth={1} dot={false} strokeDasharray="4 4" name="Bollinger Alt" />

                      {/* SMA Çizgileri */}
                      <Line type="monotone" dataKey="sma10" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="SMA 10" />
                      <Line type="monotone" dataKey="sma20" stroke="#ef4444" strokeWidth={1.5} dot={false} name="SMA 20" />
                      <Line type="monotone" dataKey="sma50" stroke="#22c55e" strokeWidth={1.5} dot={false} name="SMA 50" />

                      {/* Fiyat */}
                      <Area type="monotone" dataKey="close" stroke="#3b82f6" strokeWidth={2} fill="url(#priceGrad)" name="Kapanış" />

                      {/* AI Tahmin Çizgisi */}
                      {forecastData?.predicted_price && (
                        <ReferenceLine y={forecastData.predicted_price} stroke="#a855f7" strokeDasharray="6 4" strokeWidth={2} label={{ value: `AI: ₺${forecastData.predicted_price}`, position: 'right', fill: '#a855f7', fontSize: 11, fontWeight: 'bold' }} />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* RSI + Fiyat */}
              {activeTab === 'rsi' && (
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                  <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                    <Activity size={14} className="text-blue-500" />
                    RSI (Relative Strength Index) — Aşırı Alım / Aşırı Satım Bölgeleri
                  </h4>
                  <ResponsiveContainer width="100%" height={350}>
                    <ComposedChart data={chartData} margin={{ top: 5, right: 55, left: 15, bottom: 5 }}>
                      <defs>
                        <linearGradient id="rsiGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="rsi" domain={[0, 100]} ticks={[0, 20, 30, 50, 70, 80, 100]} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                      <YAxis yAxisId="price" orientation="right" domain={['auto', 'auto']} tick={{ fill: '#f59e0b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₺${v}`} width={65} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />

                      {/* Aşırı Alım / Satım Bölgeleri */}
                      <ReferenceLine yAxisId="rsi" y={70} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Aşırı Alım (70)', position: 'right', fill: '#ef4444', fontSize: 10 }} />
                      <ReferenceLine yAxisId="rsi" y={30} stroke="#22c55e" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Aşırı Satım (30)', position: 'right', fill: '#22c55e', fontSize: 10 }} />
                      <ReferenceLine yAxisId="rsi" y={50} stroke="rgba(255,255,255,0.1)" strokeDasharray="2 2" />

                      <Area yAxisId="rsi" type="monotone" dataKey="rsi" stroke="#3b82f6" strokeWidth={2} fill="url(#rsiGrad)" name="RSI (14)" />
                      <Line yAxisId="price" type="monotone" dataKey="close" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeOpacity={0.6} name="Fiyat (₺)" />
                    </ComposedChart>
                  </ResponsiveContainer>

                  {/* RSI Yorumu */}
                  {lastPoint && (
                    <div className={`mt-4 p-3 rounded-xl text-sm ${
                      lastPoint.rsi > 70 ? 'bg-red-500/10 border border-red-500/20 text-red-300' :
                      lastPoint.rsi < 30 ? 'bg-green-500/10 border border-green-500/20 text-green-300' :
                      'bg-blue-500/10 border border-blue-500/20 text-blue-300'
                    }`}>
                      <strong>RSI: {lastPoint.rsi}</strong> —{' '}
                      {lastPoint.rsi > 70
                        ? 'Aşırı alım bölgesinde. Fiyat düzeltme yapabilir, dikkatli olun.'
                        : lastPoint.rsi < 30
                        ? 'Aşırı satım bölgesinde. Dip fırsatı olabilir.'
                        : 'Nötr bölgede. Net bir yön sinyali yok.'}
                    </div>
                  )}
                </div>
              )}

              {/* MACD + Fiyat */}
              {activeTab === 'macd' && (
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                  <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                    <BarChart3 size={14} className="text-blue-500" />
                    MACD (Moving Average Convergence Divergence)
                  </h4>
                  <ResponsiveContainer width="100%" height={350}>
                    <ComposedChart data={chartData} margin={{ top: 5, right: 55, left: 15, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="macd" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={55} />
                      <YAxis yAxisId="price" orientation="right" domain={['auto', 'auto']} tick={{ fill: '#f59e0b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₺${v}`} width={65} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                      <ReferenceLine yAxisId="macd" y={0} stroke="rgba(255,255,255,0.1)" />

                      {/* MACD Histogram */}
                      <Bar yAxisId="macd" dataKey="macd_hist" name="Histogram" radius={[2, 2, 0, 0]}>
                        {chartData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.macd_hist >= 0 ? '#22c55e' : '#ef4444'} />
                        ))}
                      </Bar>

                      {/* MACD ve Sinyal Çizgileri */}
                      <Line yAxisId="macd" type="monotone" dataKey="macd" stroke="#3b82f6" strokeWidth={2} dot={false} name="MACD" />
                      <Line yAxisId="macd" type="monotone" dataKey="macd_signal" stroke="#a855f7" strokeWidth={2} dot={false} name="Sinyal" />
                      <Line yAxisId="price" type="monotone" dataKey="close" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeOpacity={0.6} name="Fiyat (₺)" />
                    </ComposedChart>
                  </ResponsiveContainer>

                  {/* MACD Yorumu */}
                  {lastPoint && (
                    <div className={`mt-4 p-3 rounded-xl text-sm ${
                      lastPoint.macd_hist > 0 ? 'bg-green-500/10 border border-green-500/20 text-green-300' :
                      'bg-red-500/10 border border-red-500/20 text-red-300'
                    }`}>
                      <strong>MACD Histogram: {lastPoint.macd_hist > 0 ? 'Pozitif' : 'Negatif'}</strong> —{' '}
                      {lastPoint.macd_hist > 0
                        ? 'MACD sinyal çizgisinin üzerinde. Yükseliş momentumu güçlü.'
                        : 'MACD sinyal çizgisinin altında. Düşüş baskısı devam ediyor.'}
                      {' '}MACD: {lastPoint.macd}, Sinyal: {lastPoint.macd_signal}
                    </div>
                  )}
                </div>
              )}

              {/* Hacim + Fiyat */}
              {activeTab === 'volume' && (
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                  <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                    <Layers size={14} className="text-blue-500" />
                    İşlem Hacmi &amp; 20 Günlük Ortalama
                  </h4>
                  <ResponsiveContainer width="100%" height={350}>
                    <ComposedChart data={chartData} margin={{ top: 5, right: 55, left: 15, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="volume" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : v} width={55} />
                      <YAxis yAxisId="price" orientation="right" domain={['auto', 'auto']} tick={{ fill: '#f59e0b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₺${v}`} width={65} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />

                      <Bar yAxisId="volume" dataKey="volume" name="Hacim" fill="#3b82f6" opacity={0.4} radius={[2, 2, 0, 0]} />
                      <Line yAxisId="volume" type="monotone" dataKey="volume_sma" stroke="#22c55e" strokeWidth={2} dot={false} name="20 Gün Ort." />
                      <Line yAxisId="price" type="monotone" dataKey="close" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeOpacity={0.6} name="Fiyat (₺)" />
                    </ComposedChart>
                  </ResponsiveContainer>

                  {lastPoint && (
                    <div className={`mt-4 p-3 rounded-xl text-sm ${
                      lastPoint.volume > lastPoint.volume_sma ? 'bg-green-500/10 border border-green-500/20 text-green-300' :
                      'bg-yellow-500/10 border border-yellow-500/20 text-yellow-300'
                    }`}>
                      <strong>Hacim: {(lastPoint.volume / 1e6).toFixed(2)}M</strong> —{' '}
                      {lastPoint.volume > lastPoint.volume_sma
                        ? 'Ortalama üstü hacim. Güçlü katılım var.'
                        : 'Ortalama altı hacim. Piyasa ilgisi düşük.'}
                    </div>
                  )}
                </div>
              )}

              {/* Fibonacci Düzeltme Seviyeleri */}
              {activeTab === 'fibonacci' && (
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                  <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                    <Target size={14} className="text-blue-500" />
                    Fibonacci Düzeltme Seviyeleri (Retracement)
                  </h4>
                  <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 15, bottom: 5 }}>
                      <defs>
                        <linearGradient id="fibPriceGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.15} />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[fibLow * 0.95, fibHigh * 1.05]} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₺${v}`} width={65} />
                      <Tooltip content={<ChartTooltip />} />

                      {/* Fiyat */}
                      <Area type="monotone" dataKey="close" stroke="#3b82f6" strokeWidth={2} fill="url(#fibPriceGrad)" name="Kapanış" />

                      {/* Fibonacci Seviyeleri — etiket sağ tarafa */}
                      {fibLevels.map((fib, i) => (
                        <ReferenceLine key={i} y={fib.value} stroke={fib.color} strokeDasharray="6 3" strokeWidth={1.5}
                          label={{ value: `${fib.pct} ₺${fib.value}`, position: 'right', fill: fib.color, fontSize: 10, fontWeight: 'bold' }} />
                      ))}
                    </ComposedChart>
                  </ResponsiveContainer>

                  {/* Fibonacci Seviye Tablosu */}
                  {fibLevels.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {fibLevels.map((fib, i) => (
                        <div key={i} className="bg-white/[0.03] border border-white/5 rounded-lg p-2 text-center">
                          <div className="text-[10px] font-bold" style={{ color: fib.color }}>{fib.label}</div>
                          <div className="text-xs font-extrabold text-slate-200 mt-0.5">₺{fib.value}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {lastPoint && fibLevels.length > 0 && (
                    <div className="mt-3 p-3 rounded-xl text-sm bg-blue-500/10 border border-blue-500/20 text-blue-300">
                      <strong>Mevcut Fiyat: ₺{lastPoint.close}</strong> —{' '}
                      {(() => {
                        const price = lastPoint.close;
                        const nearestFib = fibLevels.reduce((closest, fib) =>
                          Math.abs(fib.value - price) < Math.abs(closest.value - price) ? fib : closest
                        , fibLevels[0]);
                        return `En yakın Fibonacci seviyesi: ${nearestFib.label} (₺${nearestFib.value})`;
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─── Mini Stat Kartı ─── */
const MiniStat = ({ label, value, color }) => (
  <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 text-center">
    <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">{label}</div>
    <div className={`text-sm font-extrabold ${color}`}>{value}</div>
  </div>
);

export default AnalysisChartModal;
