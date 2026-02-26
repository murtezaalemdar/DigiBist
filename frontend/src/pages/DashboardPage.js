/**
 * DashboardPage.js — Ana Analiz Panosu
 * ═══════════════════════════════════════════════════════════
 *
 * Seçili hisse senedi için kapsamlı AI tahmin analizi gösterir.
 *
 * Bölümler:
 *   - Başlık Kartı     : Hisse adı, canlı fiyat, sinyal rozeti (AL/SAT/TUT)
 *   - Canlı Fiyat Kartı: WebSocket'ten gelen anlık fiyat, provider bilgisi,
 *                        geri sayım, bağlantı durumu (TradingView/Yahoo/yfinance)
 *   - AI Tahmin Kartı  : Yön tahmini (yukarı/aşağı), olasılık %, hedef fiyat,
 *                        güven skoru, risk seviyesi, drill-down detaylar
 *   - Teknik Göstergeler: RSI, MACD, Bollinger, SMA, hacim — FeaturePopup ile
 *                        her göstergenin açıklamasını gösterir
 *   - Grafik Butonu    : AnalysisChartModal açar (Recharts — mum, çizgi, bar)
 *   - KAP Haberleri    : Google News RSS proxy üzerinden son haberler
 *
 * Props:
 *   selectedSymbol, stocks, data, loading, isRefreshing, handleRefresh,
 *   displayPrice, wsConnected, livePrice, priceProvider, lastPriceUpdate,
 *   updateInterval
 *
 * Alt Bileşenler: AnalysisChartModal, DrillDownModal, FeaturePopup
 * API: /api/ai-forecast/{symbol}, /api/kap-news/{symbol}
 *
 * @module DashboardPage
 * @version 8.09.01
 * @since 8.00
 */

import React, { useState, useEffect } from 'react';
import {
  BrainCircuit,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  LayoutDashboard,
  Activity,
  ShieldCheck,
  Zap,
  RefreshCw,
  Info,
  Wifi,
  Shield,
  BarChart3,
  ExternalLink,
} from 'lucide-react';
import { getRiskColor } from '../utils/helpers';
import { API_BASE } from '../config';
import AnalysisChartModal from '../components/AnalysisChartModal';
import DrillDownModal from '../components/DrillDownModal';
import FeaturePopup from '../components/FeaturePopup';

const DashboardPage = ({
  selectedSymbol,
  stocks,
  data,
  loading,
  isRefreshing,
  handleRefresh,
  displayPrice,
  wsConnected,
  livePrice,
  priceProvider,
  lastPriceUpdate,
  updateInterval,
}) => {
  const [chartModalOpen, setChartModalOpen] = useState(false);
  const [drillDown, setDrillDown] = useState({ open: false, type: null });
  const [featurePopup, setFeaturePopup] = useState({ open: false, name: null });
  const [countdown, setCountdown] = useState(60);
  const [kapNews, setKapNews] = useState(null);
  const [kapLoading, setKapLoading] = useState(false);
  const activeSignal = data?.risk_signal || data?.signal;

  // KAP haberleri fetch
  useEffect(() => {
    if (!selectedSymbol) return;
    setKapLoading(true);
    fetch(`${API_BASE}/api/kap-news/${selectedSymbol}`)
      .then(r => r.json())
      .then(d => { setKapNews(d); setKapLoading(false); })
      .catch(() => setKapLoading(false));
  }, [selectedSymbol]);

  // Geri sayım: gerçek güncelleme aralığına göre
  useEffect(() => {
    if (lastPriceUpdate) setCountdown(updateInterval || 10);
  }, [lastPriceUpdate, updateInterval]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  const riskColors = getRiskColor(activeSignal);

  return (
    <>
      {/* Başlık */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div>
          <div className="flex items-center gap-3 text-slate-400 text-sm mb-2">
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
            <span>/</span>
            <span className="text-blue-400 font-medium">{selectedSymbol} Analizi</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-4">
            {selectedSymbol}
            <span className="text-sm sm:text-lg md:text-xl font-normal text-slate-500 italic">
              — {stocks.find((s) => s.symbol === selectedSymbol)?.name}
            </span>
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleRefresh(false)}
            disabled={isRefreshing || loading}
            className="bg-white/5 border border-white/10 p-3 rounded-2xl hover:bg-white/10 transition-all text-slate-400 hover:text-white"
          >
            <RefreshCw size={20} className={isRefreshing ? 'animate-spin text-blue-500' : ''} />
          </button>
          <button
            onClick={() => handleRefresh(true)}
            disabled={isRefreshing || loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-2xl font-bold shadow-lg shadow-blue-900/40 transition-all flex items-center gap-2"
          >
            <Activity size={18} className={loading ? 'animate-pulse' : ''} />{' '}
            {loading ? 'Analiz Ediliyor...' : 'Teknik Analiz AI'}
          </button>
        </div>
      </div>

      {loading || !data ? (
        <div className="h-[300px] sm:h-[400px] md:h-[500px] flex flex-col items-center justify-center bg-white/[0.02] border border-white/5 rounded-2xl sm:rounded-[2rem]">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            <BrainCircuit
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-500"
              size={24}
            />
          </div>
          <p className="mt-6 text-slate-400 animate-pulse font-medium tracking-wide">
            Yapay Zeka Modeli Eğitiliyor...
          </p>
          <p className="mt-2 text-slate-600 text-xs">İlk analiz ~20 saniye sürebilir</p>
        </div>
      ) : data?.error ? (
        <div className="h-[300px] sm:h-[400px] md:h-[500px] flex flex-col items-center justify-center bg-white/[0.02] border border-red-500/20 rounded-2xl sm:rounded-[2rem]">
          <AlertTriangle size={48} className="text-red-400 mb-4" />
          <p className="text-red-400 font-medium mb-2">Analiz Başarısız</p>
          <p className="text-slate-500 text-sm max-w-md text-center">{data.error}</p>
          <button
            onClick={handleRefresh}
            className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-bold text-sm transition-all"
          >
            Tekrar Dene
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Risk Engine Uyarısı */}
          {data.risk_adjusted && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-4 p-4">
                <Shield className="text-yellow-400 shrink-0" size={20} />
                <div className="flex-1">
                  <span className="text-yellow-400 font-bold text-sm">
                    ⚠ Risk Yönetim Sistemi Devreye Girdi{' '}
                  </span>
                  <span className="text-yellow-300/80 text-sm">— {data.risk_reason}</span>
                </div>
                <div className="shrink-0 text-xs font-black px-3 py-1.5 rounded-xl bg-yellow-500/20 text-yellow-400">
                  SİNYAL → HOLD
                </div>
              </div>
              <div className="px-4 pb-4 pt-0">
                <div className="bg-yellow-500/5 rounded-xl p-3 text-[11px] text-yellow-300/70 leading-relaxed space-y-1">
                  <p>🔍 <strong>Ne oldu?</strong> AI modeli <strong>"{data.signal}"</strong> sinyali üretti, ancak Risk Engine bu sinyalin güvenilir olmadığına karar verdi.</p>
                  <p>📊 <strong>Neden?</strong> Model güven skoru <strong>%{Math.round(data.confidence * 100)}</strong> — dinamik eşik <strong>%{Math.round((data.confidence_threshold || 0.70) * 100)}</strong>.
                    {data.cv_r2 != null && data.cv_r2 < 0 && ' Ayrıca CV R² skoru negatif, yani model veriye rastgeleden bile kötü uyum sağlamış.'}
                    {data.directional_accuracy != null && data.directional_accuracy <= 0.5 && ' Yönsel doğruluk %50 veya altında, bu yazı-tura atmaktan farksız.'}
                  </p>
                  <p>✅ <strong>Sonuç:</strong> Sinyal otomatik olarak <strong>HOLD</strong>'a (çevrildi). Bu, sizi hatalı işlem yapmaktan korur.</p>
                  {data.filters_applied && data.filters_applied.length > 0 && (
                    <p>🛡 <strong>Uygulanan filtre:</strong> {data.filters_applied.join(', ')}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Market Rejim Banner */}
          {data.market_regime && (
            <div className={`flex items-center gap-4 p-4 rounded-2xl border ${
              data.market_regime === 'BULL' ? 'bg-green-500/10 border-green-500/20' :
              data.market_regime === 'BULL_WEAK' ? 'bg-green-500/5 border-green-500/10' :
              data.market_regime === 'BEAR' ? 'bg-red-500/10 border-red-500/20' :
              data.market_regime === 'BEAR_WEAK' ? 'bg-red-500/5 border-red-500/10' :
              'bg-slate-500/10 border-slate-500/20'
            }`}>
              <span className="text-2xl">
                {data.market_regime === 'BULL' ? '🐂' :
                 data.market_regime === 'BULL_WEAK' ? '🐂' :
                 data.market_regime === 'BEAR' ? '🐻' :
                 data.market_regime === 'BEAR_WEAK' ? '🐻' : '↔️'}
              </span>
              <div className="flex-1">
                <span className={`font-bold text-sm ${
                  data.market_regime.startsWith('BULL') ? 'text-green-400' :
                  data.market_regime.startsWith('BEAR') ? 'text-red-400' : 'text-slate-400'
                }`}>
                  Piyasa Rejimi: {data.market_regime === 'BULL' ? 'Güçlü Boğa' :
                    data.market_regime === 'BULL_WEAK' ? 'Zayıf Boğa' :
                    data.market_regime === 'BEAR' ? 'Güçlü Ayı' :
                    data.market_regime === 'BEAR_WEAK' ? 'Zayıf Ayı' : 'Yatay'}
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">{data.regime_description}</p>
              </div>
              {data.atr_pct != null && (
                <div className="text-right">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Volatilite (ATR)</div>
                  <div className={`text-sm font-bold ${data.atr_pct > 3 ? 'text-red-400' : data.atr_pct > 2 ? 'text-yellow-400' : 'text-green-400'}`}>
                    %{data.atr_pct}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {/* Güncel Fiyat */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 md:p-8 backdrop-blur-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 text-slate-800 pointer-events-none group-hover:text-blue-500/10 transition-colors">
                <Zap size={100} strokeWidth={4} />
              </div>
              <p className="text-slate-400 text-sm font-medium mb-1 font-mono tracking-tighter uppercase">
                Piyasa Fiyatı
              </p>
              {wsConnected && livePrice?.price > 0 && (
                <div className="flex items-center gap-2 text-[10px] font-bold mb-2">
                  <span className="flex items-center gap-1 text-green-400">
                    <Wifi size={10} className="animate-pulse" /> CANLI
                  </span>
                  <span className={`inline-flex items-center justify-center min-w-[20px] h-[18px] px-1 rounded text-[10px] font-mono font-bold ${
                    countdown <= 2 ? 'bg-green-500/30 text-green-400 animate-pulse' : 'bg-white/10 text-slate-400'
                  }`}>
                    {countdown}s
                  </span>
                </div>
              )}
              <h3 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4 italic font-mono tracking-tighter">
                ₺{displayPrice !== null ? Number(displayPrice).toFixed(2) : '—'}
                {livePrice?.change !== undefined && livePrice.change !== 0 && (
                  <span className={`inline-flex items-center gap-1 ml-2 text-base sm:text-lg font-black not-italic align-middle ${
                    livePrice.change > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {livePrice.change > 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                    {livePrice.change > 0 ? '+' : ''}{livePrice.change.toFixed(2)}%
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-2 text-sm">
                <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded-lg font-bold">
                  GERÇEK VERİ
                </span>
                <span className="text-slate-500">
                  {priceProvider === 'tradingview' ? 'TradingView' : priceProvider === 'yahoo_spark' ? 'Yahoo Finance' : priceProvider === 'bigpara' ? 'Bigpara' : 'Yahoo Finance'}
                </span>
              </div>
            </div>

            {/* AI Tahmini */}
            <div
              className={`border rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 md:p-8 backdrop-blur-xl relative overflow-hidden transition-all duration-500 ${riskColors.bg} ${riskColors.border}`}
            >
              <div className="absolute top-0 right-0 p-6 pointer-events-none opacity-10">
                {activeSignal === 'BUY' ? (
                  <TrendingUp size={100} />
                ) : activeSignal === 'SELL' ? (
                  <TrendingDown size={100} />
                ) : (
                  <Shield size={100} />
                )}
              </div>
              <p className="text-slate-400 text-sm font-medium mb-1 font-mono tracking-tighter uppercase">
                AI Tahmini{' '}
                <Info
                  size={14}
                  title="Yapay zeka modelinin bir sonraki işlem günü kapanış fiyatı tahmini"
                  className="inline cursor-help"
                />
              </p>
              {data.risk_adjusted && (
                <div className="text-[10px] text-yellow-400 font-bold mb-2 flex items-center gap-1" title="Risk Engine düşük güvenli sinyali HOLD'a çevirdi">
                  <Shield size={10} /> Risk Engine Düzeltmesi Uygulandı
                </div>
              )}
              <h3 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-2 font-mono tracking-tighter">
                ₺{data.predicted_price > 0 ? data.predicted_price : '—'}
              </h3>
              {data.predicted_price > 0 && data.current_price > 0 && (
                <div className={`text-sm font-bold mb-2 ${
                  data.predicted_price > data.current_price ? 'text-green-400' : data.predicted_price < data.current_price ? 'text-red-400' : 'text-slate-400'
                }`}>
                  {data.predicted_price > data.current_price ? '▲' : data.predicted_price < data.current_price ? '▼' : '→'}
                  {' '}{((data.predicted_price - data.current_price) / data.current_price * 100).toFixed(2)}%
                  <span className="text-slate-600 font-normal ml-1">
                    ({data.predicted_price > data.current_price ? '+' : ''}₺{(data.predicted_price - data.current_price).toFixed(2)})
                  </span>
                </div>
              )}
              <div
                className={`flex items-center gap-2 font-bold px-3 py-1.5 rounded-xl w-fit ${riskColors.badge}`}
              >
                {activeSignal === 'BUY' ? (
                  <TrendingUp size={16} />
                ) : activeSignal === 'SELL' ? (
                  <TrendingDown size={16} />
                ) : (
                  <Shield size={16} />
                )}
                {activeSignal === 'BUY' ? 'AL Sinyali' : activeSignal === 'SELL' ? 'SAT Sinyali' : 'BEKLE Sinyali'}
              </div>
              <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">
                {data.predicted_price <= 0
                  ? 'Model bu hisse için güvenilir bir tahmin üretemedi. Farklı bir hisse seçmeyi deneyin.'
                  : activeSignal === 'BUY' 
                  ? `Model, fiyatın ₺${data.predicted_price} seviyesine yükselebileceğini öngörüyor. Aşağıdaki risk göstergelerini de kontrol edin.` 
                  : activeSignal === 'SELL' 
                  ? `Model, fiyatın ₺${data.predicted_price} seviyesine düşebileceğini öngörüyor. Satış düşünülebilir ama risk yönetimine dikkat edin.` 
                  : `Model henüz net bir yön belirleyemedi veya güven skoru yetersiz. Pozisyonunuzu koruyun, gelişmeleri izleyin.`}
              </p>
            </div>

            {/* Model Güveni + Detay Metrikleri */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 md:p-8 backdrop-blur-xl relative overflow-hidden">
              <p className="text-slate-400 text-sm font-medium mb-1 font-mono tracking-tighter uppercase">
                Model Güveni
              </p>
              <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">
                Modelin kendi tahmininden ne kadar emin olduğunu gösterir.
                {Math.round(data.confidence * 100) >= 70 
                  ? ' Yüksek güven — sinyal güvenilir, teknik göstergeler tutarlı.' 
                  : Math.round(data.confidence * 100) >= 50 
                  ? ' Orta güven — dikkatli olun, model tam emin değil.' 
                  : ' Düşük güven — model bu hisse için sağlıklı öğrenememiş. İşlem yapmayın.'}
                {data.cv_r2 != null && data.cv_r2 < 0 && ' (CV R² negatif: model rastgeleden kötü uyum sağlamış.)'}
              </p>
              <h3 className={`text-3xl sm:text-4xl md:text-5xl font-extrabold mb-1 font-mono tracking-tighter ${
                data.confidence >= 0.7 ? 'text-green-400' : data.confidence >= 0.5 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                %{Math.round(data.confidence * 100)}
              </h3>
              {data.confidence_threshold != null && (
                <p className="text-[10px] mb-3 flex items-center gap-1">
                  <span className="text-slate-600">Dinamik Eşik:</span>
                  <span className={`font-bold ${data.confidence >= data.confidence_threshold ? 'text-green-400' : 'text-red-400'}`}>
                    %{Math.round(data.confidence_threshold * 100)}
                  </span>
                  <span className="text-slate-600">
                    {data.confidence >= data.confidence_threshold ? ' ✅ Eşik aşıldı' : ' ❌ Eşik altında'}
                  </span>
                </p>
              )}
              <div className="w-full bg-white/5 h-2.5 rounded-full overflow-hidden mb-1">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    data.confidence >= 0.7 ? 'bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.5)]' 
                    : data.confidence >= 0.5 ? 'bg-yellow-500 shadow-[0_0_12px_rgba(234,179,8,0.5)]' 
                    : 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                  }`}
                  style={{ width: `${data.confidence * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-slate-600 mb-4">
                <span>Düşük</span><span>Orta</span><span>Yüksek</span>
              </div>

              {/* Detay metrikleri — tıklanabilir */}
              <div className="space-y-2.5 text-[11px]">
                {data.directional_accuracy != null && (
                  <div
                    className="flex justify-between text-slate-400 cursor-pointer hover:bg-white/5 rounded-lg px-2 py-1.5 -mx-2 transition-all group"
                    onClick={() => setDrillDown({ open: true, type: 'directional' })}
                  >
                    <span className="flex items-center gap-1 group-hover:text-blue-400 transition-colors">📈 Yönsel Doğruluk <Info size={10} className="text-slate-600" /></span>
                    <span className={`font-bold ${data.directional_accuracy >= 0.6 ? 'text-green-400' : data.directional_accuracy >= 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                      %{Math.round(data.directional_accuracy * 100)}
                      <span className="text-slate-600 font-normal ml-1">
                        {data.directional_accuracy >= 0.6 ? '(iyi)' : data.directional_accuracy >= 0.5 ? '(zayıf)' : '(kötü)'}
                      </span>
                    </span>
                  </div>
                )}
                {data.cv_r2 != null && (
                  <div
                    className="flex justify-between text-slate-400 cursor-pointer hover:bg-white/5 rounded-lg px-2 py-1.5 -mx-2 transition-all group"
                    onClick={() => setDrillDown({ open: true, type: 'cv_r2' })}
                  >
                    <span className="flex items-center gap-1 group-hover:text-blue-400 transition-colors">🧪 CV R² Skoru <Info size={10} className="text-slate-600" /></span>
                    <span className={`font-bold ${data.cv_r2 >= 0.5 ? 'text-green-400' : data.cv_r2 >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {data.cv_r2.toFixed(4)}
                      <span className="text-slate-600 font-normal ml-1">
                        {data.cv_r2 >= 0.7 ? '(mükemmel)' : data.cv_r2 >= 0.5 ? '(iyi)' : data.cv_r2 >= 0 ? '(zayıf)' : '(yetersiz)'}
                      </span>
                    </span>
                  </div>
                )}
                {data.rsi != null && (
                  <div
                    className="flex justify-between text-slate-400 cursor-pointer hover:bg-white/5 rounded-lg px-2 py-1.5 -mx-2 transition-all group"
                    onClick={() => setDrillDown({ open: true, type: 'rsi' })}
                  >
                    <span className="flex items-center gap-1 group-hover:text-blue-400 transition-colors">📊 RSI (14) <Info size={10} className="text-slate-600" /></span>
                    <span className={`font-bold ${data.rsi > 70 ? 'text-red-400' : data.rsi < 30 ? 'text-green-400' : 'text-slate-300'}`}>
                      {data.rsi}
                      <span className="text-slate-600 font-normal ml-1">
                        {data.rsi > 70 ? '(aşırı alım!)' : data.rsi < 30 ? '(aşırı satım!)' : data.rsi > 60 ? '(yükseliş)' : data.rsi < 40 ? '(düşüş)' : '(nötr)'}
                      </span>
                    </span>
                  </div>
                )}
                {data.features_used != null && (
                  <div
                    className="flex justify-between text-slate-400 cursor-pointer hover:bg-white/5 rounded-lg px-2 py-1.5 -mx-2 transition-all group"
                    onClick={() => setDrillDown({ open: true, type: 'features' })}
                  >
                    <span className="flex items-center gap-1 group-hover:text-blue-400 transition-colors">🔧 Kullanılan Gösterge <Info size={10} className="text-slate-600" /></span>
                    <span className="font-bold text-slate-300">{data.features_used} indikatör</span>
                  </div>
                )}
                {data.training_samples != null && (
                  <div
                    className="flex justify-between text-slate-400 cursor-pointer hover:bg-white/5 rounded-lg px-2 py-1.5 -mx-2 transition-all group"
                    onClick={() => setDrillDown({ open: true, type: 'training' })}
                  >
                    <span className="flex items-center gap-1 group-hover:text-blue-400 transition-colors">📅 Eğitim Verisi <Info size={10} className="text-slate-600" /></span>
                    <span className="font-bold text-slate-300">{data.training_samples} işlem günü</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-white/5">
                <p className="text-[10px] text-slate-500 flex items-center gap-1 uppercase tracking-widest font-bold">
                  <ShieldCheck size={12} className="text-blue-500" />
                  {data.model_name || 'Ensemble'} + Risk Engine v2
                </p>
                <p className="text-[9px] text-slate-600 mt-1">
                  {data.model_name === 'RandomForest'
                    ? 'Random Forest: Çok sayıda karar ağacının ortalamasını alır. Aşırı öğrenmeye dirençlidir.'
                    : data.model_name === 'XGBoost'
                    ? 'XGBoost: Gradient boosting\'in optimize versiyonu. Genellikle en yüksek doğruluk.'
                    : 'Gradient Boosting: Hataları iteratif düzeltir. Sağlam ve güvenilir.'}
                </p>
                {/* Ensemble Ağırlıkları */}
                {data.model_weights && (
                  <div className="mt-2 space-y-1">
                    <p className="text-[9px] text-slate-600 font-bold uppercase">Ensemble Ağırlıkları (CV R² bazlı):</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {Object.entries(data.model_weights).map(([name, weight]) => (
                        <span key={name} className={`text-[9px] px-2 py-0.5 rounded-lg font-bold ${
                          name === data.model_name ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-slate-500'
                        }`}>
                          {name}: %{Math.round(weight * 100)}
                          {data.cv_scores && data.cv_scores[name] != null && (
                            <span className="text-slate-600 font-normal ml-0.5">
                              (R²: {data.cv_scores[name].toFixed(2)})
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                    {data.cv_scores && Object.values(data.cv_scores).every(v => v < 0) && (
                      <p className="text-[9px] text-yellow-400 mt-1">
                        ⚠ Tüm model R² skorları negatif — eşit ağırlık kullanılıyor. Bu hissede model performansı düşük.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Analiz + Uyarı */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div
              onClick={() => setChartModalOpen(true)}
              className="bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 cursor-pointer hover:bg-white/[0.06] hover:border-blue-500/30 transition-all duration-300 group relative"
            >
              {/* Tıkla ipucu */}
              <div className="absolute top-4 right-4 flex items-center gap-1.5 text-[10px] text-blue-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                <BarChart3 size={12} /> Grafikleri Gör <ExternalLink size={10} />
              </div>
              <h4 className="font-bold mb-4 flex items-center gap-2">
                <Zap className="text-yellow-500" size={18} /> AI Analiz Notu
                <span className="ml-auto text-[10px] text-slate-500 font-normal flex items-center gap-1">
                  <BarChart3 size={10} /> tıkla → grafikler
                </span>
              </h4>
              <p className="text-slate-400 text-sm leading-relaxed mb-3">
                <strong className="text-slate-300">{selectedSymbol}</strong> hissesi için son <strong>{data.training_samples || 252}</strong> işlem günlük tarihsel veri üzerinde
                {' '}<strong className="text-blue-400">{data.features_used || 43} teknik indikatör</strong> kullanılarak
                {' '}<strong className="text-blue-400">{data.model_name || 'GradientBoosting'}</strong> algoritması ile analiz yapıldı.
              </p>

              {/* Teknik Analiz Özeti */}
              <div className="bg-black/30 rounded-xl p-3 mb-4 space-y-1.5 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span className="text-slate-500">RSI (14):</span>
                  <span className={`font-bold ${data.rsi > 70 ? 'text-red-400' : data.rsi < 30 ? 'text-green-400' : 'text-slate-300'}`}>
                    {data.rsi || '—'}
                  </span>
                  <span className="text-slate-600">
                    {data.rsi > 70 ? '→ Aşırı alım bölgesi, düzeltme gelebilir' : data.rsi < 30 ? '→ Aşırı satım, dip fırsatı olabilir' : '→ Nötr bölgede'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  <span className="text-slate-500">MACD:</span>
                  <span className={`font-bold ${data.macd_histogram > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {data.macd_histogram > 0 ? 'Pozitif' : 'Negatif'}
                  </span>
                  <span className="text-slate-600">
                    {data.macd_histogram > 0 ? '→ Yükseliş momentumu devam ediyor' : '→ Düşüş baskısı mevcut'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                  <span className="text-slate-500">Yön Tahmini:</span>
                  <span className={`font-bold ${data.predicted_price > data.current_price ? 'text-green-400' : 'text-red-400'}`}>
                    {data.predicted_price > data.current_price ? '▲ Yükseliş' : '▼ Düşüş'}
                  </span>
                  <span className="text-slate-600">
                    → ₺{data.current_price} → ₺{data.predicted_price} ({data.predicted_price > data.current_price ? '+' : ''}{((data.predicted_price - data.current_price) / data.current_price * 100).toFixed(2)}%)
                  </span>
                </div>
                {data.stochastic_k != null && (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                    <span className="text-slate-500">Stochastic %K:</span>
                    <span className={`font-bold ${data.stochastic_k > 80 ? 'text-red-400' : data.stochastic_k < 20 ? 'text-green-400' : 'text-slate-300'}`}>
                      {data.stochastic_k}
                    </span>
                    <span className="text-slate-600">
                      {data.stochastic_k > 80 ? '→ Aşırı alım, geri çekilme riski' : data.stochastic_k < 20 ? '→ Aşırı satım, toparlanma fırsatı' : '→ Nötr bölgede'}
                    </span>
                  </div>
                )}
                {data.bollinger_pctb != null && (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                    <span className="text-slate-500">Bollinger %B:</span>
                    <span className={`font-bold ${data.bollinger_pctb > 1 ? 'text-red-400' : data.bollinger_pctb < 0 ? 'text-green-400' : 'text-slate-300'}`}>
                      {data.bollinger_pctb}
                    </span>
                    <span className="text-slate-600">
                      {data.bollinger_pctb > 1 ? '→ Üst bandın üstünde, aşırı alım' : data.bollinger_pctb < 0 ? '→ Alt bandın altında, aşırı satım' : data.bollinger_pctb > 0.8 ? '→ Üst banda yakın' : data.bollinger_pctb < 0.2 ? '→ Alt banda yakın' : '→ Bant ortasında'}
                    </span>
                  </div>
                )}
              </div>

              <p className="text-slate-500 text-xs leading-relaxed mb-4">
                <strong>Sonuç:</strong> Model, <strong>%{Math.round(data.confidence * 100)}</strong> güven oranıyla fiyatın
                <strong> ₺{data.predicted_price}</strong> seviyesine yöneleceğini öngörüyor.
                {data.risk_adjusted && (
                  <span className="text-yellow-400">
                    {' '}Ancak Risk Engine düşük güven nedeniyle bu sinyali <strong>HOLD</strong>'a çevirdi — mevcut pozisyonunuzu koruyun.
                  </span>
                )}
                {!data.risk_adjusted && activeSignal === 'BUY' && (
                  <span className="text-green-400"> Teknik göstergeler alım yönünü destekliyor.</span>
                )}
                {!data.risk_adjusted && activeSignal === 'SELL' && (
                  <span className="text-red-400"> Teknik göstergeler satış baskısına işaret ediyor.</span>
                )}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="text-center bg-black/40 p-3 rounded-2xl flex-1 border border-white/5" title="ATR bazlı stop-loss seviyesi — zararı sınırlamak için önerilen çıkış noktası">
                  <div className="text-[10px] text-red-400/60 uppercase font-bold mb-1">
                    🛑 Stop-Loss
                  </div>
                  <div className="text-sm font-bold text-red-300">
                    ₺{data.stop_loss || ((displayPrice || data.current_price) * 0.98).toFixed(2)}
                  </div>
                  <div className="text-[9px] text-slate-600 mt-1">Bu seviyede zararı kes</div>
                </div>
                <div className="text-center bg-black/40 p-3 rounded-2xl flex-1 border border-white/5" title="ATR bazlı take-profit seviyesi — kârı realize etmek için önerilen hedef">
                  <div className="text-[10px] text-green-400/60 uppercase font-bold mb-1">
                    🎯 Take-Profit
                  </div>
                  <div className="text-sm font-bold text-green-300">
                    ₺{data.take_profit || ((displayPrice || data.current_price) * 1.02).toFixed(2)}
                  </div>
                  <div className="text-[9px] text-slate-600 mt-1">Bu seviyede kârı al</div>
                </div>
                {data.risk_reward_ratio != null && (
                  <div className="text-center bg-black/40 p-3 rounded-2xl flex-1 border border-white/5" title="Risk/Ödül oranı: 1.5 üzeri iyi, 2 üzeri çok iyi">
                    <div className="text-[10px] text-blue-400/60 uppercase font-bold mb-1">
                      ⚖️ Risk/Ödül
                    </div>
                    <div className={`text-sm font-bold ${data.risk_reward_ratio >= 2 ? 'text-green-400' : data.risk_reward_ratio >= 1.5 ? 'text-blue-400' : 'text-yellow-400'}`}>
                      1:{data.risk_reward_ratio}
                    </div>
                    <div className="text-[9px] text-slate-600 mt-1">{data.risk_reward_ratio >= 2 ? 'Çok iyi oran' : data.risk_reward_ratio >= 1.5 ? 'İyi oran' : 'Düşük oran'}</div>
                  </div>
                )}
              </div>

              {/* Kelly Criterion & Top Features */}
              {(data.kelly_fraction != null || data.top_features) && (
                <div className="mt-4 pt-3 border-t border-white/5 space-y-3">
                  {/* Kelly Criterion */}
                  {data.kelly_fraction != null && (
                    <div
                      className="bg-black/30 rounded-xl p-3 cursor-pointer hover:bg-black/50 transition-all group/kelly relative"
                      onClick={(e) => { e.stopPropagation(); setDrillDown({ open: true, type: 'kelly' }); }}
                    >
                      <div className="absolute top-2 right-2 flex items-center gap-1 text-[9px] text-blue-400 opacity-0 group-hover/kelly:opacity-100 transition-opacity">
                        <ExternalLink size={10} /> Kaynak
                      </div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold mb-2 flex items-center gap-1">
                        🎰 Kelly Criterion Pozisyon Önerisi
                        <Info size={10} className="text-slate-600 cursor-help" title="Matematiksel optimal pozisyon büyüklüğü. Half-Kelly (yarım) kullanılır — daha muhafazakâr." />
                      </p>
                      {data.kelly_fraction > 0 ? (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                          <div className="text-center">
                            <div className="text-lg font-bold text-blue-400">%{data.kelly_position_pct}</div>
                            <div className="text-[9px] text-slate-600">Portföy Payı</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-slate-300">₺{data.kelly_position_size?.toLocaleString('tr-TR')}</div>
                            <div className="text-[9px] text-slate-600">Pozisyon Tutarı</div>
                          </div>
                          <div className="flex-1 text-[10px] text-slate-500">{data.kelly_reason}</div>
                        </div>
                      ) : (
                        <p className="text-[10px] text-red-400">{data.kelly_reason || 'Kelly negatif — işlem önerilmiyor.'}</p>
                      )}
                      {data.win_rate != null && (
                        <div className="flex gap-3 mt-2 text-[9px] text-slate-600">
                          <span>Kazanma Oranı: <strong className="text-slate-400">%{Math.round(data.win_rate * 100)}</strong></span>
                          <span>Ort. Kazanç: <strong className="text-green-400">%{(data.avg_win * 100).toFixed(2)}</strong></span>
                          <span>Ort. Kayıp: <strong className="text-red-400">%{(data.avg_loss * 100).toFixed(2)}</strong></span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 mt-2 text-[9px] text-blue-400/60 group-hover/kelly:text-blue-400 transition-colors">
                        <ExternalLink size={9} /> Kelly Criterion Nedir? — Investopedia
                      </div>
                    </div>
                  )}

                  {/* Top Features */}
                  {data.top_features && data.top_features.length > 0 && (
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold mb-1.5">
                        🎯 En Etkili {data.top_features.length} Gösterge (Feature Importance)
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {data.top_features.map((f, i) => (
                          <span
                            key={f}
                            onClick={(e) => { e.stopPropagation(); setFeaturePopup({ open: true, name: f }); }}
                            className={`text-[9px] px-2 py-0.5 rounded-lg cursor-pointer transition-all hover:scale-105 hover:shadow-lg ${
                              i < 3 ? 'bg-blue-500/20 text-blue-400 font-bold hover:bg-blue-500/30' : 'bg-white/5 text-slate-500 hover:bg-white/10 hover:text-slate-300'
                            }`}
                          >
                            {i + 1}. {f}
                          </span>
                        ))}
                      </div>
                      {data.low_importance_features != null && data.low_importance_features > 0 && (
                        <p className="text-[9px] text-slate-600 mt-1">
                          {data.low_importance_features} gösterge düşük önemde ({'<'}%0.5 katkı)
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* KAP Bildirileri */}
              <div className="mt-4 pt-3 border-t border-white/5">
                <div className="bg-black/30 rounded-xl p-3 relative">
                  <p className="text-[10px] text-slate-500 uppercase font-bold mb-2 flex items-center gap-1">
                    📋 {selectedSymbol} — KAP Bildirileri
                  </p>

                  {/* Son KAP Haberi */}
                  {kapLoading ? (
                    <p className="text-[10px] text-slate-500 animate-pulse">KAP haberleri yükleniyor...</p>
                  ) : kapNews?.news?.length > 0 ? (
                    <a
                      href={kapNews.news[0].link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-blue-500/10 hover:bg-blue-500/20 rounded-lg p-2 mb-2 transition-all group/newslink"
                    >
                      <p className="text-[10px] text-blue-300 font-semibold leading-snug group-hover/newslink:text-blue-200 transition-colors">
                        {kapNews.news[0].title}
                      </p>
                      <p className="text-[9px] text-slate-500 mt-1">
                        {kapNews.news[0].source} · {new Date(kapNews.news[0].date).toLocaleDateString('tr-TR', {day:'numeric',month:'short',year:'numeric'})}
                      </p>
                    </a>
                  ) : (
                    <p className="text-[10px] text-slate-400 leading-relaxed mb-2">
                      {selectedSymbol} hissesine ait güncel KAP haberi bulunamadı.
                    </p>
                  )}

                  {/* 2. ve 3. haber (varsa) */}
                  {kapNews?.news?.length > 1 && (
                    <div className="space-y-1 mb-2">
                      {kapNews.news.slice(1, 3).map((n, idx) => (
                        <a
                          key={idx}
                          href={n.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-start gap-1.5 text-[9px] text-slate-400 hover:text-blue-300 transition-colors"
                        >
                          <span className="text-blue-500 mt-0.5">▸</span>
                          <span className="line-clamp-1">{n.title}</span>
                          <span className="text-slate-600 whitespace-nowrap ml-auto">{n.source}</span>
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Tıklanabilir kategori etiketleri */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <a href={`https://www.kap.org.tr/tr/bildirim-sorgu`} target="_blank" rel="noopener noreferrer"
                       className="text-[9px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-lg font-bold hover:bg-blue-500/40 hover:scale-105 transition-all inline-flex items-center gap-1 no-underline">
                      Özel Durum Açıklamaları <ExternalLink size={8} />
                    </a>
                    <a href={`https://www.kap.org.tr/tr/bildirim-sorgu`} target="_blank" rel="noopener noreferrer"
                       className="text-[9px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-lg font-bold hover:bg-purple-500/40 hover:scale-105 transition-all inline-flex items-center gap-1 no-underline">
                      Finansal Tablolar <ExternalLink size={8} />
                    </a>
                    <a href={`https://www.kap.org.tr/tr/bildirim-sorgu`} target="_blank" rel="noopener noreferrer"
                       className="text-[9px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-lg font-bold hover:bg-green-500/40 hover:scale-105 transition-all inline-flex items-center gap-1 no-underline">
                      Genel Kurul <ExternalLink size={8} />
                    </a>
                    <a href={`https://www.kap.org.tr/tr/bildirim-sorgu`} target="_blank" rel="noopener noreferrer"
                       className="text-[9px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-lg font-bold hover:bg-yellow-500/40 hover:scale-105 transition-all inline-flex items-center gap-1 no-underline">
                      Yönetim Kurulu <ExternalLink size={8} />
                    </a>
                  </div>

                  <div className="flex items-center gap-1 mt-2 text-[9px] text-blue-400/60">
                    <ExternalLink size={9} /> Kaynak: Google News · kap.org.tr
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-orange-500/5 border border-orange-500/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 flex flex-col justify-center">
              <div className="flex items-start gap-4">
                <div className="bg-orange-500/20 p-3 rounded-2xl text-orange-500 shrink-0">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-orange-400 mb-2">⚠ Önemli Risk & Yasal Uyarı</h4>
                  <p className="text-xs text-orange-300/70 leading-relaxed mb-3">
                    Bu platformda sunulan tahminler, yapay zeka ve makine öğrenmesi algoritmaları tarafından
                    geçmiş fiyat verileri üzerinden üretilmekte olup <strong>kesinlikle "Yatırım Danışmanlığı" kapsamında değildir.</strong>
                  </p>
                  <ul className="text-[11px] text-orange-300/60 space-y-1.5 mb-3 list-none">
                    <li>• Geçmiş performans, gelecekteki sonuçların garantisi değildir</li>
                    <li>• AI modelleri piyasa manipülasyonu, siyasi gelişmeler veya beklenmedik olayları öngöremez</li>
                    <li>• Buradaki sinyaller otomatik alım-satım emri değildir; nihai kararı siz vermelisiniz</li>
                    <li>• Yatırım yapmadan önce mutlaka SPK lisanslı bir yatırım danışmanına başvurun</li>
                  </ul>
                  <div className="text-[10px] text-orange-500/60 uppercase font-black tracking-[0.2em]">
                    Tüm Kullanım Riski Kullanıcıya Aittir · SPK Uyarısı
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analiz Grafik Modalı */}
      <AnalysisChartModal
        isOpen={chartModalOpen}
        onClose={() => setChartModalOpen(false)}
        symbol={selectedSymbol}
        forecastData={data}
      />

      {/* Drill-Down Detay Modalı */}
      <DrillDownModal
        isOpen={drillDown.open}
        onClose={() => setDrillDown({ open: false, type: null })}
        type={drillDown.type}
        data={data}
      />

      {/* Feature Detay Popup */}
      <FeaturePopup
        isOpen={featurePopup.open}
        onClose={() => setFeaturePopup({ open: false, name: null })}
        featureName={featurePopup.name}
        data={data}
      />
    </>
  );
};

export default DashboardPage;
