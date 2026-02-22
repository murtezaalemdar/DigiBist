import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ComposedChart, Legend,
} from 'recharts';
import {
  X, TrendingUp, Activity, BarChart3, Layers, ChevronDown,
} from 'lucide-react';
import { API_BASE } from '../config';

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
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !symbol) return;
    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/api/ai-chart-data/${symbol}?period=${period}`)
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
  }, [isOpen, symbol, period]);

  if (!isOpen) return null;

  // Son veri noktasını al
  const lastPoint = chartData.length > 0 ? chartData[chartData.length - 1] : null;

  // X-axis tick formatter
  const formatDate = (d) => {
    const parts = d.split('-');
    return `${parts[2]}/${parts[1]}`;
  };

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

          {/* Periyot Seçimi */}
          <div className="flex gap-1 bg-white/5 p-1 rounded-2xl">
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  period === p.value
                    ? 'bg-white/10 text-white'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {p.label}
              </button>
            ))}
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
                    <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
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
                      <YAxis domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₺${v}`} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />

                      {/* Bollinger Bantları */}
                      <Area type="monotone" dataKey="bb_upper" stroke="none" fill="url(#bbGrad)" name="Bollinger Üst" />
                      <Area type="monotone" dataKey="bb_lower" stroke="none" fill="transparent" name="Bollinger Alt" />
                      <Line type="monotone" dataKey="bb_upper" stroke="#6366f1" strokeWidth={1} dot={false} strokeDasharray="4 4" name="BB Üst" />
                      <Line type="monotone" dataKey="bb_lower" stroke="#6366f1" strokeWidth={1} dot={false} strokeDasharray="4 4" name="BB Alt" />

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

              {/* RSI */}
              {activeTab === 'rsi' && (
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                  <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                    <Activity size={14} className="text-blue-500" />
                    RSI (Relative Strength Index) — Aşırı Alım / Aşırı Satım Bölgeleri
                  </h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <defs>
                        <linearGradient id="rsiGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} ticks={[0, 20, 30, 50, 70, 80, 100]} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />

                      {/* Aşırı Alım / Satım Bölgeleri */}
                      <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Aşırı Alım (70)', position: 'right', fill: '#ef4444', fontSize: 10 }} />
                      <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Aşırı Satım (30)', position: 'right', fill: '#22c55e', fontSize: 10 }} />
                      <ReferenceLine y={50} stroke="rgba(255,255,255,0.1)" strokeDasharray="2 2" />

                      <Area type="monotone" dataKey="rsi" stroke="#3b82f6" strokeWidth={2} fill="url(#rsiGrad)" name="RSI (14)" />
                    </AreaChart>
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

              {/* MACD */}
              {activeTab === 'macd' && (
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                  <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                    <BarChart3 size={14} className="text-blue-500" />
                    MACD (Moving Average Convergence Divergence)
                  </h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                      <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />

                      {/* MACD Histogram */}
                      <Bar dataKey="macd_hist" name="Histogram" fill="#3b82f6" radius={[2, 2, 0, 0]}>
                        {chartData.map((entry, idx) => (
                          <rect key={idx} fill={entry.macd_hist >= 0 ? '#22c55e' : '#ef4444'} />
                        ))}
                      </Bar>

                      {/* MACD ve Sinyal Çizgileri */}
                      <Line type="monotone" dataKey="macd" stroke="#3b82f6" strokeWidth={2} dot={false} name="MACD" />
                      <Line type="monotone" dataKey="macd_signal" stroke="#f59e0b" strokeWidth={2} dot={false} name="Sinyal" />
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

              {/* Hacim */}
              {activeTab === 'volume' && (
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                  <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                    <Layers size={14} className="text-blue-500" />
                    İşlem Hacmi &amp; 20 Günlük Ortalama
                  </h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : v} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />

                      <Bar dataKey="volume" name="Hacim" fill="#3b82f6" opacity={0.4} radius={[2, 2, 0, 0]} />
                      <Line type="monotone" dataKey="volume_sma" stroke="#f59e0b" strokeWidth={2} dot={false} name="20 Gün Ort." />
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

              {/* Fiyat mini grafiği (diğer tablarda alt bilgi olarak) */}
              {activeTab !== 'price' && (
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                  <h4 className="text-xs font-bold text-slate-500 mb-2">Fiyat Özeti</h4>
                  <ResponsiveContainer width="100%" height={120}>
                    <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="miniPriceGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="close" stroke="#3b82f6" strokeWidth={1.5} fill="url(#miniPriceGrad)" />
                      <XAxis dataKey="date" hide />
                      <YAxis hide domain={['auto', 'auto']} />
                      <Tooltip content={<ChartTooltip />} />
                    </AreaChart>
                  </ResponsiveContainer>
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
