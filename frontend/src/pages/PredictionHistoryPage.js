/**
 * PredictionHistoryPage.js — AI Tahmin Geçmişi & Doğruluk Analizi Sayfası
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * v8.09.00 — 26 Şubat 2026
 * 
 * Bu sayfa AI modelinin geçmiş tahminlerini ve gerçek piyasa verileriyle
 * karşılaştırma sonuçlarını gösterir.
 * 
 * 3 Sekme:
 *   1. Genel Bakış  — SVG dairesel gauge (yön doğruluğu), sinyal başarı çubukları
 *                     (BUY/SELL), haftalık trend bar chart, 6+4 özet kart
 *   2. Tahmin Geçmişi — 11 kolonlu filtrelenebilir + sayfalı tablo
 *                       Kolonlar: Sembol, AI Sinyal, Risk Sonuç, Mevcut Fiyat,
 *                       Tahmin Fiyat, Gerçek Fiyat, Değişim, Güven, Yön, Skor, Tarih
 *   3. Sıralama — En başarılı (yeşil) + iyileştirilmesi gereken (kırmızı) semboller
 * 
 * "Tahminleri Doğrula" butonu: POST /api/predictions/verify tetikler
 * TradingView Scanner API (birincil) + Yahoo Spark (yedek) ile doğrulama yapar.
 * 
 * Önemli Notlar:
 *   - Auth: useAuth() hook'undaki authFetch kullanılır (token key: 'bist_token')
 *   - AI Sinyal vs Risk Sonuç: İki ayrı kolon. Risk Engine düşük güvenli
 *     sinyalleri HOLD'a çevirir (confidence avg %48, threshold %75).
 *     ⚠ ikonu farklılık olduğunda gösterilir.
 *   - Skor: 0-100 (50 yön doğruluğu + 50 fiyat hassasiyeti)
 * 
 * Bağımlılıklar:
 *   - lucide-react ikoncukları
 *   - useAuth hook (JWT auth)
 *   - API_BASE (config.js)
 *   - Backend endpoints: /api/predictions/*
 * 
 * Komponentler:
 *   - AccuracyGauge — SVG dairesel ilerleme göstergesi
 *   - MiniBarChart — Haftalık doğruluk trend çubuğu
 *   - SignalBadge — BUY/SELL/HOLD renkli etiket
 *   - VerificationBadge — Doğru/Yanlış ikonu
 *   - ScoreBadge — Renk kodlu skor göstergesi
 */
import React, { useState, useEffect, useCallback } from 'react';
import useAutoRefresh from '../hooks/useAutoRefresh';
import {
  Target,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  BarChart3,
  Trophy,
  History,
  RefreshCw,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  AlertTriangle,
  Zap,
  Clock,
  Minus,
  Calendar,
} from 'lucide-react';
import { API_BASE } from '../config';
import { useAuth } from '../hooks/useAuth';

// ── SVG Dairesel Gösterge ──
const AccuracyGauge = ({ value, size = 140, label, color = 'blue' }) => {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(value, 0), 100);
  const offset = circumference - (progress / 100) * circumference;

  const colorMap = {
    blue: { stroke: '#3b82f6', bg: 'from-blue-500/20 to-blue-600/10', text: 'text-blue-400' },
    green: { stroke: '#22c55e', bg: 'from-green-500/20 to-green-600/10', text: 'text-green-400' },
    yellow: { stroke: '#eab308', bg: 'from-yellow-500/20 to-yellow-600/10', text: 'text-yellow-400' },
    red: { stroke: '#ef4444', bg: 'from-red-500/20 to-red-600/10', text: 'text-red-400' },
    purple: { stroke: '#a855f7', bg: 'from-purple-500/20 to-purple-600/10', text: 'text-purple-400' },
  };
  const c = colorMap[color] || colorMap.blue;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke="rgba(255,255,255,0.05)" strokeWidth="8" fill="none"
          />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke={c.stroke} strokeWidth="8" fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-extrabold ${c.text}`}>%{progress.toFixed(1)}</span>
        </div>
      </div>
      {label && <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</span>}
    </div>
  );
};

// ── Mini Bar Chart ──
const MiniBarChart = ({ data, height = 80 }) => {
  if (!data || data.length === 0) return <div className="text-slate-600 text-xs text-center py-4">Veri yok</div>;
  const max = Math.max(...data.map(d => d.accuracy || 0), 1);

  return (
    <div className="flex items-end gap-1.5 justify-center" style={{ height }}>
      {data.slice().reverse().map((d, i) => {
        const h = Math.max(((d.accuracy || 0) / max) * height * 0.85, 4);
        const acc = d.accuracy || 0;
        const barColor = acc >= 70 ? 'bg-green-500' : acc >= 50 ? 'bg-yellow-500' : 'bg-red-500';
        return (
          <div key={i} className="flex flex-col items-center gap-1 group relative">
            <div
              className={`${barColor} rounded-t-md w-5 sm:w-6 transition-all duration-300 hover:opacity-80`}
              style={{ height: h }}
            />
            <div className="absolute -top-8 bg-black/90 text-white text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
              %{acc.toFixed(1)} · {d.verified || 0} doğr.
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Sinyal Badge ──
const SignalBadge = ({ signal }) => {
  const s = (signal || 'HOLD').toUpperCase();
  const config = {
    BUY: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', icon: TrendingUp },
    SELL: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', icon: TrendingDown },
    HOLD: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', icon: Minus },
  };
  const c = config[s] || config.HOLD;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${c.bg} ${c.text} border ${c.border}`}>
      <Icon size={10} /> {s}
    </span>
  );
};

// ── Doğruluk Badge ──
const VerificationBadge = ({ verified, isCorrect }) => {
  if (!verified) return <span className="text-slate-600 text-xs">—</span>;
  if (isCorrect) return (
    <span className="inline-flex items-center gap-1 text-green-400 text-xs font-medium">
      <CheckCircle2 size={14} /> Doğru
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-red-400 text-xs font-medium">
      <XCircle size={14} /> Yanlış
    </span>
  );
};

// ── Skor Badge ──
const ScoreBadge = ({ score }) => {
  if (score === null || score === undefined) return <span className="text-slate-600 text-xs">—</span>;
  const s = parseFloat(score);
  let color = 'text-red-400';
  if (s >= 80) color = 'text-green-400';
  else if (s >= 60) color = 'text-blue-400';
  else if (s >= 40) color = 'text-yellow-400';
  return <span className={`font-bold text-sm ${color}`}>{s.toFixed(0)}</span>;
};


/**
 * Ana Sayfa Komponent'i — PredictionHistoryPage
 * 
 * State'ler:
 *   activeTab      : Aktif sekme ('overview' | 'history' | 'leaderboard')
 *   accuracy       : Genel doğruluk istatistikleri (GET /api/predictions/accuracy)
 *   timeline       : Haftalık trend verisi (GET /api/predictions/accuracy-timeline)
 *   leaderboard    : Sembol sıralaması (GET /api/predictions/leaderboard)
 *   predictions    : Tahmin listesi (GET /api/predictions/history)
 *   total          : Toplam tahmin sayısı (sayfalama için)
 *   page           : Aktif sayfa numarası (0-indexed)
 *   verifying      : Doğrulama işlemi devam mı
 *   verifyResult   : Doğrulama sonucu (POST /api/predictions/verify)
 *   filterSymbol   : Sembol filtresi (ör: 'THYAO')
 *   filterSignal   : Sinyal filtresi ('BUY'/'SELL'/'HOLD')
 *   filterVerified : Sadece doğrulanmış tahminler
 */
const PredictionHistoryPage = () => {
  // useAuth hook — JWT Bearer token ile authenticated fetch
  // Token key: 'bist_token' (localStorage'da)
  const { authFetch } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [accuracy, setAccuracy] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [leaderboard, setLeaderboard] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);

  // Tahmin Geçmişi sekmesi filtreleri
  const [filterSymbol, setFilterSymbol] = useState('');
  const [filterSignal, setFilterSignal] = useState('');
  const [filterVerified, setFilterVerified] = useState(false);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  /** Her sayfada gösterilecek tahmin sayısı */
  const PAGE_SIZE = 20;

  // ══════════════════════════════════════════════════════════════
  // VERİ ÇEKME FONKSİYONLARI  (useCallback ile memoize edilmiş)
  // Her biri ilgili backend endpoint'ini authFetch ile çağırır.
  // authFetch, Authorization: Bearer <token> header'ını otomatik ekler.
  // ══════════════════════════════════════════════════════════════

  /**
   * Genel doğruluk istatistiklerini çeker.
   * Endpoint: GET /api/predictions/accuracy
   * Dönen veri: { total, verified, correct, wrong, accuracy, signal_breakdown }
   */
  const fetchAccuracy = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/predictions/accuracy`);
      if (res.ok) setAccuracy(await res.json());
    } catch (e) { console.error('Accuracy fetch error:', e); }
  }, [authFetch]);

  /**
   * Haftalık başarı trendi (son 12 hafta).
   * Endpoint: GET /api/predictions/accuracy-timeline?weeks=12
   * Dönen veri: [{ week, total, correct, accuracy }, ...]
   */
  const fetchTimeline = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/predictions/accuracy-timeline?weeks=12`);
      if (res.ok) setTimeline(await res.json());
    } catch (e) { console.error('Timeline fetch error:', e); }
  }, [authFetch]);

  /**
   * Sembol sıralaması — en başarılı/başarısız semboller.
   * Endpoint: GET /api/predictions/leaderboard?limit=15
   * Dönen veri: { best: [...], worst: [...] }
   */
  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/predictions/leaderboard?limit=15`);
      if (res.ok) setLeaderboard(await res.json());
    } catch (e) { console.error('Leaderboard fetch error:', e); }
  }, [authFetch]);

  /**
   * Sayfalı tahmin geçmişi. Filtreler query params olarak eklenir.
   * Endpoint: GET /api/predictions/history?limit=20&offset=0&symbol=X&signal=Y&verified_only=true
   * Dönen veri: { predictions: [...], total: N }
   */
  const fetchPredictions = useCallback(async (pageNum = 0) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: PAGE_SIZE,
        offset: pageNum * PAGE_SIZE,
      });
      // Opsiyonel filtreler — sadece değer varsa eklenir
      if (filterSymbol) params.append('symbol', filterSymbol.toUpperCase());
      if (filterSignal) params.append('signal', filterSignal);
      if (filterVerified) params.append('verified_only', 'true');
      if (filterDateFrom) params.append('date_from', filterDateFrom);
      if (filterDateTo) params.append('date_to', filterDateTo);

      const res = await authFetch(`${API_BASE}/api/predictions/history?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPredictions(data.predictions || []);
        setTotal(data.total || 0);
      }
    } catch (e) { console.error('Predictions fetch error:', e); }
    setLoading(false);
  }, [authFetch, filterSymbol, filterSignal, filterVerified, filterDateFrom, filterDateTo]);

  // ══════════════════════════════════════════════════════════════
  // DOĞRULAMA (Verification)
  // TradingView Scanner + Yahoo Spark ile gerçek fiyatları çekip
  // son 72 saatteki tahminleri doğrular. Ardından tüm verileri yeniler.
  // Endpoint: POST /api/predictions/verify { lookback_hours: 72 }
  // ══════════════════════════════════════════════════════════════
  const handleVerify = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await authFetch(`${API_BASE}/api/predictions/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lookback_hours: 72 }),
      });
      if (res.ok) {
        const result = await res.json();
        setVerifyResult(result);
        // Doğrulama sonrası tüm sekme verilerini paralel olarak yenile
        await Promise.all([fetchAccuracy(), fetchTimeline(), fetchLeaderboard(), fetchPredictions(page)]);
      }
    } catch (e) { console.error('Verify error:', e); }
    setVerifying(false);
  };

  // ══════════════════════════════════════════════════════════════
  // LIFECYCLE — İlk yükleme + filtre/sayfa değişiklikleri
  // ══════════════════════════════════════════════════════════════

  /** Sayfa ilk açıldığında 4 endpoint paralel çağrılır */
  useEffect(() => {
    fetchAccuracy();
    fetchTimeline();
    fetchLeaderboard();
    fetchPredictions(0);
  }, []);

  /** Filtre veya sayfa değiştiğinde sadece tahmin listesi yenilenir */
  useEffect(() => {
    fetchPredictions(page);
  }, [page, filterSymbol, filterSignal, filterVerified, filterDateFrom, filterDateTo, fetchPredictions]);

  // ─── AUTO-REFRESH: Genel bakış verileri (60s) ───
  const refreshOverview = useCallback(() => {
    fetchAccuracy();
    fetchTimeline();
    fetchLeaderboard();
  }, [fetchAccuracy, fetchTimeline, fetchLeaderboard]);
  useAutoRefresh(refreshOverview, 60000, true);

  // ─── AUTO-REFRESH: Tahmin listesi (60s) ───
  const refreshPredictions = useCallback(() => {
    fetchPredictions(page);
  }, [fetchPredictions, page]);
  useAutoRefresh(refreshPredictions, 60000, true);

  /**
   * Genel Bakış / Sıralama sekmesindeki öğeler tıklandığında
   * "Tahmin Geçmişi" sekmesine uygun filtrelerle yönlendirir.
   * @param {{ symbol?: string, signal?: string, verified?: boolean }} opts
   */
  const navigateToHistory = (opts = {}) => {
    setFilterSymbol(opts.symbol || '');
    setFilterSignal(opts.signal || '');
    setFilterVerified(opts.verified || false);
    setFilterDateFrom('');
    setFilterDateTo('');
    setPage(0);
    setActiveTab('history');
  };

  /** Toplam sayfa hesabı (sayfalama kontrolü için) */
  const totalPages = Math.ceil(total / PAGE_SIZE);

  /** 3 ana sekme tanımı — her biri lucide-react ikonu ile */
  const tabs = [
    { id: 'overview', label: 'Genel Bakış', icon: BarChart3 },
    { id: 'history', label: 'Tahmin Geçmişi', icon: History },
    { id: 'leaderboard', label: 'Sıralama', icon: Trophy },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ══════════════════════════════════════════════════════
          SAYFA BAŞLIĞI + DOĞRULAMA BUTONU
          Sağ üstte "Tahminleri Doğrula" butonu — handleVerify tetikler.
          POST /api/predictions/verify çağırarak TradingView'dan
          gerçek fiyatları çeker ve DB'deki tahminleri günceller.
          ══════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 text-slate-400 text-sm mb-2">
            <Target size={16} />
            <span>AI Tahmin Geçmişi</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-3">
            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-2 rounded-xl shadow-lg shadow-purple-500/20">
              <Target size={24} className="text-white" />
            </div>
            Tahmin Doğruluk Analizi
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            AI modelinin geçmiş tahminlerini ve gerçek sonuçlarla karşılaştırma başarısını inceleyin.
          </p>
        </div>
        <button
          onClick={handleVerify}
          disabled={verifying}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium text-sm hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-50 shadow-lg shadow-purple-500/20"
        >
          <RefreshCw size={16} className={verifying ? 'animate-spin' : ''} />
          {verifying ? 'Doğrulanıyor...' : 'Tahminleri Doğrula'}
        </button>
      </div>

      {/* Doğrulama Sonucu */}
      {verifyResult && (
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle2 size={20} className="text-purple-400 shrink-0" />
          <span className="text-sm text-purple-300">
            <strong>{verifyResult.verified}</strong> tahmin doğrulandı — TradingView verileriyle (toplam {verifyResult.total_checked} kontrol edildi).
            {verifyResult.errors?.length > 0 && <span className="text-red-400 ml-2">{verifyResult.errors.length} hata</span>}
          </span>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          SEKME NAVİGASYONU — 3 sekme: Genel Bakış / Tahmin Geçmişi / Sıralama
          activeTab state'ine göre aşağıdaki conditional render bölümleri açılır.
          ══════════════════════════════════════════════════════ */}
      <div className="flex gap-1 bg-white/[0.03] border border-white/10 rounded-xl p-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white/10 text-white shadow-lg'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`}
            >
              <Icon size={16} /> {tab.label}
            </button>
          );
        })}
      </div>


      {/* ══════════════ SEKME 1: GENEL BAKIŞ ══════════════
          Veri kaynağı: accuracy state (GET /api/predictions/accuracy)
          + timeline state (GET /api/predictions/accuracy-timeline)
          
          İçerik:
           - 6 özet kartı (Toplam, Doğrulanmış, Yön Doğruluğu, Ort Skor, Ort Hata, Bekleyen)
           - AccuracyGauge (SVG dairesel ilerleme) — direction_accuracy yüzdesi
           - Sinyal dağılımı (BUY/SELL/HOLD oranları)
           - MiniBarChart (haftalık trend çubuğu)
           - Ek istatistikler (en iyi/kötü skor, ort güven, BUY/SELL oranı)
       */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Özet Kartları — 6 adet, renk kodu dinamik (yeşil/sarı/kırmızı) */}
          {accuracy && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              {[
                { label: 'Toplam Tahmin', value: accuracy.total_predictions, icon: Target, color: 'blue', action: () => navigateToHistory() },
                { label: 'Doğrulanmış', value: accuracy.verified_count, icon: CheckCircle2, color: 'green', action: () => navigateToHistory({ verified: true }) },
                { label: 'Yön Doğruluğu', value: `%${accuracy.direction_accuracy}`, icon: TrendingUp, color: accuracy.direction_accuracy >= 60 ? 'green' : 'yellow', action: () => navigateToHistory({ verified: true }) },
                { label: 'Ort. Skor', value: accuracy.avg_score?.toFixed(1), icon: Zap, color: accuracy.avg_score >= 60 ? 'green' : 'yellow', action: () => navigateToHistory({ verified: true }) },
                { label: 'Ort. Hata', value: `%${accuracy.avg_price_error?.toFixed(2)}`, icon: AlertTriangle, color: accuracy.avg_price_error <= 3 ? 'green' : 'red', action: () => navigateToHistory({ verified: true }) },
                { label: 'Bekleyen', value: accuracy.unverified_count, icon: Clock, color: 'slate', action: () => navigateToHistory() },
              ].map((card, i) => {
                const Icon = card.icon;
                const colorMap = {
                  blue: 'from-blue-500/20 to-blue-600/10 text-blue-400 border-blue-500/20',
                  green: 'from-green-500/20 to-green-600/10 text-green-400 border-green-500/20',
                  yellow: 'from-yellow-500/20 to-yellow-600/10 text-yellow-400 border-yellow-500/20',
                  red: 'from-red-500/20 to-red-600/10 text-red-400 border-red-500/20',
                  slate: 'from-slate-500/20 to-slate-600/10 text-slate-400 border-slate-500/20',
                };
                const cm = colorMap[card.color] || colorMap.blue;
                return (
                  <div
                    key={i}
                    onClick={card.action}
                    className={`bg-gradient-to-br ${cm} border rounded-2xl p-4 backdrop-blur-lg cursor-pointer hover:scale-[1.03] hover:shadow-lg transition-all duration-200 group`}
                    title="Tahmin Geçmişi'nde görüntüle"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon size={16} className="opacity-70" />
                      <span className="text-[10px] uppercase tracking-wider font-bold opacity-70">{card.label}</span>
                    </div>
                    <div className="text-2xl font-extrabold flex items-center gap-2">
                      {card.value}
                      <ChevronRight size={14} className="opacity-0 group-hover:opacity-70 transition-opacity text-current" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Gauge'ler + Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Yön Doğruluğu Gauge */}
            <div
              onClick={() => navigateToHistory({ verified: true })}
              className="bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl p-6 backdrop-blur-lg flex flex-col items-center justify-center cursor-pointer hover:bg-white/[0.05] hover:border-white/20 transition-all group"
              title="Doğrulanmış tahminleri görüntüle"
            >
              <h3 className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-wider flex items-center gap-2">
                Yön Doğruluğu
                <ChevronRight size={14} className="opacity-0 group-hover:opacity-60 transition-opacity text-slate-400" />
              </h3>
              {accuracy ? (
                <AccuracyGauge
                  value={accuracy.direction_accuracy || 0}
                  label="Doğru Yön Tahmini"
                  color={accuracy.direction_accuracy >= 70 ? 'green' : accuracy.direction_accuracy >= 50 ? 'yellow' : 'red'}
                  size={160}
                />
              ) : <div className="text-slate-600 text-sm">Yükleniyor...</div>}
              {accuracy && (
                <div className="flex gap-6 mt-4 text-xs">
                  <div className="text-center">
                    <div className="text-green-400 font-bold text-lg">{accuracy.correct_direction}</div>
                    <div className="text-slate-500">Doğru</div>
                  </div>
                  <div className="text-center">
                    <div className="text-red-400 font-bold text-lg">{accuracy.wrong_direction}</div>
                    <div className="text-slate-500">Yanlış</div>
                  </div>
                </div>
              )}
            </div>

            {/* Sinyal Başarısı */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl p-6 backdrop-blur-lg hover:border-white/20 transition-all">
              <h3 className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-wider">Sinyal Bazlı Başarı</h3>
              {accuracy?.signal_breakdown && (
                <div className="space-y-5">
                  {['BUY', 'SELL'].map(sig => {
                    const d = accuracy.signal_breakdown[sig];
                    if (!d) return null;
                    const acc = d.accuracy || 0;
                    return (
                      <div
                        key={sig}
                        onClick={() => navigateToHistory({ signal: sig })}
                        className="cursor-pointer hover:bg-white/[0.03] rounded-xl p-2 -mx-2 transition-all group"
                        title={`${sig} sinyallerini Tahmin Geçmişi'nde görüntüle`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <SignalBadge signal={sig} />
                            <ChevronRight size={12} className="opacity-0 group-hover:opacity-60 transition-opacity text-slate-400" />
                          </div>
                          <span className="text-xs text-slate-500">{d.correct}/{d.total} doğru</span>
                        </div>
                        <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${sig === 'BUY' ? 'bg-gradient-to-r from-green-600 to-green-400' : 'bg-gradient-to-r from-red-600 to-red-400'}`}
                            style={{ width: `${Math.min(acc, 100)}%` }}
                          />
                        </div>
                        <div className="text-right mt-1">
                          <span className={`text-sm font-bold ${sig === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>%{acc.toFixed(1)}</span>
                        </div>
                      </div>
                    );
                  })}
                  {accuracy.signal_breakdown.HOLD && (
                    <div
                      onClick={() => navigateToHistory({ signal: 'HOLD' })}
                      className="flex items-center justify-between pt-2 border-t border-white/5 cursor-pointer hover:bg-white/[0.03] rounded-xl p-2 -mx-2 transition-all group"
                      title="HOLD sinyallerini Tahmin Geçmişi'nde görüntüle"
                    >
                      <div className="flex items-center gap-2">
                        <SignalBadge signal="HOLD" />
                        <ChevronRight size={12} className="opacity-0 group-hover:opacity-60 transition-opacity text-slate-400" />
                      </div>
                      <span className="text-xs text-slate-500">{accuracy.signal_breakdown.HOLD.total} tahmin</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Haftalık Trend */}
            <div
              onClick={() => navigateToHistory({ verified: true })}
              className="bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl p-6 backdrop-blur-lg cursor-pointer hover:bg-white/[0.05] hover:border-white/20 transition-all group"
              title="Doğrulanmış tahminleri görüntüle"
            >
              <h3 className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-wider flex items-center gap-2">
                Haftalık Doğruluk Trendi
                <ChevronRight size={14} className="opacity-0 group-hover:opacity-60 transition-opacity text-slate-400" />
              </h3>
              <MiniBarChart data={timeline} height={100} />
              {timeline.length > 0 && (
                <div className="flex justify-between mt-3 text-[10px] text-slate-600">
                  <span>{timeline.length} hafta önce</span>
                  <span>Bu hafta</span>
                </div>
              )}
              {timeline.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <div className="bg-black/30 rounded-xl p-2.5 text-center border border-white/5">
                    <div className="text-[9px] text-slate-500 uppercase font-bold">Ort. Doğruluk</div>
                    <div className="text-sm font-bold text-blue-400">
                      %{(timeline.reduce((a, b) => a + (b.accuracy || 0), 0) / timeline.length).toFixed(1)}
                    </div>
                  </div>
                  <div className="bg-black/30 rounded-xl p-2.5 text-center border border-white/5">
                    <div className="text-[9px] text-slate-500 uppercase font-bold">Toplam Doğrulanan</div>
                    <div className="text-sm font-bold text-purple-400">
                      {timeline.reduce((a, b) => a + (b.verified || 0), 0)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Ek İstatistikler */}
          {accuracy && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div
                onClick={() => navigateToHistory({ verified: true })}
                className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-center cursor-pointer hover:bg-white/[0.06] hover:scale-[1.03] transition-all"
                title="Doğrulanmış tahminleri görüntüle"
              >
                <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">En İyi Skor</div>
                <div className="text-xl font-extrabold text-green-400">{accuracy.best_score}</div>
              </div>
              <div
                onClick={() => navigateToHistory({ verified: true })}
                className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-center cursor-pointer hover:bg-white/[0.06] hover:scale-[1.03] transition-all"
                title="Doğrulanmış tahminleri görüntüle"
              >
                <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">En Kötü Skor</div>
                <div className="text-xl font-extrabold text-red-400">{accuracy.worst_score}</div>
              </div>
              <div
                onClick={() => navigateToHistory()}
                className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-center cursor-pointer hover:bg-white/[0.06] hover:scale-[1.03] transition-all"
                title="Tüm tahminleri görüntüle"
              >
                <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Ort. Güven</div>
                <div className="text-xl font-extrabold text-blue-400">%{(accuracy.avg_confidence * 100).toFixed(1)}</div>
              </div>
              <div
                onClick={() => navigateToHistory()}
                className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-center cursor-pointer hover:bg-white/[0.06] hover:scale-[1.03] transition-all"
                title="Tüm tahminleri görüntüle"
              >
                <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">BUY/SELL Oranı</div>
                <div className="text-xl font-extrabold">
                  <span className="text-green-400">{accuracy.signal_breakdown?.BUY?.total || 0}</span>
                  <span className="text-slate-600 mx-1">/</span>
                  <span className="text-red-400">{accuracy.signal_breakdown?.SELL?.total || 0}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}


      {/* ══════════════ SEKME 2: TAHMİN GEÇMİŞİ ══════════════
          Veri kaynağı: predictions state (GET /api/predictions/history)
          
          İçerik:
           - Filtre çubuğu: sembol arama, sinyal dropdown, doğrulanmış toggle
           - Sayfalı tablo (PAGE_SIZE=20): Sembol, AI Sinyal, Risk Sonuç,
             Mevcut Fiyat, Tahmin Fiyat, Gerçek Fiyat, Değişim %, Güven,
             Doğrulama, Skor, Tarih
           - NOT: "AI Sinyal" = p.signal (ham model çıktısı)
                  "Risk Sonuç" = p.risk_signal (risk engine sonrası, genelde HOLD)
           - Pagination: Önceki/Sonraki butonları, sayfa göstergesi
       */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Filtre çubuğu — sembol arama + sinyal dropdown + doğrulanmış toggle + tarih aralığı */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-3">
            {/* Üst satır: Sembol arama + sinyal + doğrulanmış */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Sembol ara (ör: THYAO)..."
                  value={filterSymbol}
                  onChange={e => { setFilterSymbol(e.target.value); setPage(0); }}
                  className="w-full pl-10 pr-4 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/50 transition-colors"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={filterSignal}
                  onChange={e => { setFilterSignal(e.target.value); setPage(0); }}
                  className="px-4 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500/50 appearance-none cursor-pointer"
                >
                  <option value="">Tüm Sinyaller</option>
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                  <option value="HOLD">HOLD</option>
                </select>
                <button
                  onClick={() => { setFilterVerified(!filterVerified); setPage(0); }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                    filterVerified
                      ? 'bg-purple-500/20 border-purple-500/30 text-purple-400'
                      : 'bg-black/30 border-white/10 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <Filter size={14} /> Doğrulanmış
                </button>
              </div>
            </div>

            {/* Alt satır: Tarih aralığı filtresi + hızlı tarih butonları */}
            <div className="flex flex-col sm:flex-row gap-3 items-center">
              <div className="flex items-center gap-2 flex-1">
                <Calendar size={16} className="text-slate-500 shrink-0" />
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={e => { setFilterDateFrom(e.target.value); setPage(0); }}
                  className="flex-1 px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500/50 transition-colors [color-scheme:dark]"
                  placeholder="Başlangıç"
                />
                <span className="text-slate-600 text-xs">—</span>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={e => { setFilterDateTo(e.target.value); setPage(0); }}
                  className="flex-1 px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500/50 transition-colors [color-scheme:dark]"
                  placeholder="Bitiş"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: 'Bugün', days: 0 },
                  { label: 'Son 7 Gün', days: 7 },
                  { label: 'Son 30 Gün', days: 30 },
                  { label: 'Son 90 Gün', days: 90 },
                ].map(({ label, days }) => (
                  <button
                    key={label}
                    onClick={() => {
                      const today = new Date().toISOString().slice(0, 10);
                      if (days === 0) {
                        setFilterDateFrom(today);
                        setFilterDateTo(today);
                      } else {
                        const from = new Date();
                        from.setDate(from.getDate() - days);
                        setFilterDateFrom(from.toISOString().slice(0, 10));
                        setFilterDateTo(today);
                      }
                      setPage(0);
                    }}
                    className="px-3 py-1.5 bg-black/30 border border-white/10 rounded-lg text-xs text-slate-400 hover:text-white hover:border-purple-500/30 transition-all"
                  >
                    {label}
                  </button>
                ))}
                <button
                  onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); setPage(0); }}
                  className="px-3 py-1.5 bg-black/30 border border-white/10 rounded-lg text-xs text-slate-400 hover:text-red-400 hover:border-red-500/30 transition-all"
                >
                  Temizle
                </button>
              </div>
            </div>
          </div>

          {/* Tablo */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl overflow-hidden backdrop-blur-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left px-4 py-3 text-[10px] text-slate-500 uppercase tracking-wider font-bold">Sembol</th>
                    <th className="text-left px-4 py-3 text-[10px] text-slate-500 uppercase tracking-wider font-bold">AI Sinyal</th>
                    <th className="text-left px-4 py-3 text-[10px] text-slate-500 uppercase tracking-wider font-bold">Risk Sonuç</th>
                    <th className="text-right px-4 py-3 text-[10px] text-slate-500 uppercase tracking-wider font-bold">Mevcut Fiyat</th>
                    <th className="text-right px-4 py-3 text-[10px] text-slate-500 uppercase tracking-wider font-bold">Tahmin Fiyat</th>
                    <th className="text-right px-4 py-3 text-[10px] text-slate-500 uppercase tracking-wider font-bold">Gerçek Fiyat</th>
                    <th className="text-right px-4 py-3 text-[10px] text-slate-500 uppercase tracking-wider font-bold">Değişim</th>
                    <th className="text-center px-4 py-3 text-[10px] text-slate-500 uppercase tracking-wider font-bold">Güven</th>
                    <th className="text-center px-4 py-3 text-[10px] text-slate-500 uppercase tracking-wider font-bold">Yön</th>
                    <th className="text-center px-4 py-3 text-[10px] text-slate-500 uppercase tracking-wider font-bold">Skor</th>
                    <th className="text-right px-4 py-3 text-[10px] text-slate-500 uppercase tracking-wider font-bold">Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={11} className="text-center py-12 text-slate-600">
                      <RefreshCw size={20} className="animate-spin mx-auto mb-2" /> Yükleniyor...
                    </td></tr>
                  ) : predictions.length === 0 ? (
                    <tr><td colSpan={11} className="text-center py-12 text-slate-600">
                      Tahmin kaydı bulunamadı.
                    </td></tr>
                  ) : predictions.map((p, i) => (
                    <tr key={p.id || i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-bold text-white">{p.symbol}</span>
                      </td>
                      <td className="px-4 py-3">
                        <SignalBadge signal={p.signal} />
                      </td>
                      <td className="px-4 py-3">
                        {p.risk_adjusted ? (
                          <div className="flex items-center gap-1">
                            <SignalBadge signal={p.risk_signal || p.signal} />
                            {p.risk_signal && p.risk_signal !== p.signal && (
                              <span className="text-[9px] text-yellow-500" title={p.risk_reason}>⚠</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-300">
                        ₺{p.current_price?.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-blue-400 font-medium">
                        ₺{p.predicted_price?.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {p.actual_price ? (
                          <span className={p.actual_price >= p.current_price ? 'text-green-400' : 'text-red-400'}>
                            ₺{p.actual_price.toFixed(2)}
                          </span>
                        ) : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {p.actual_change_pct !== null && p.actual_change_pct !== undefined ? (
                          <span className={`font-medium ${p.actual_change_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {p.actual_change_pct >= 0 ? '+' : ''}{p.actual_change_pct?.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs">
                            {p.change_percent >= 0 ? '+' : ''}{p.change_percent?.toFixed(2)}%
                            <span className="text-[10px] text-slate-700 ml-1">(tah.)</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <div className="w-12 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400"
                              style={{ width: `${Math.min((p.confidence || 0) * 100, 100)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">{((p.confidence || 0) * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <VerificationBadge verified={p.verified} isCorrect={p.is_direction_correct} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ScoreBadge score={p.prediction_score} />
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-500 whitespace-nowrap">
                        {p.forecasted_at ? new Date(p.forecasted_at).toLocaleString('tr-TR', {
                          day: '2-digit', month: '2-digit', year: '2-digit',
                          hour: '2-digit', minute: '2-digit',
                        }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
                <span className="text-xs text-slate-500">
                  Toplam <strong className="text-slate-400">{total}</strong> tahmin · Sayfa {page + 1}/{totalPages}
                </span>
                <div className="flex gap-1">
                  <button
                    disabled={page === 0}
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    className="p-2 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(p => p + 1)}
                    className="p-2 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}


      {/* ══════════════ SEKME 3: SIRALAMA (Leaderboard) ══════════════
          Veri kaynağı: leaderboard state (GET /api/predictions/leaderboard)
          
          İçerik:
           - 2 sütunlu grid: Sol=En Başarılı (best), Sağ=İyileştirilmesi Gereken (worst)
           - Her sembol satırında: sıralama, sembol adı, doğruluk %, ort. skor
           - En kötü tarafta ayrıca ort. hata % gösterilir
           - İlk 3 sırada altın/gümüş/bronz renk kodlaması
       */}
      {activeTab === 'leaderboard' && leaderboard && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* En Başarılı Semboller — avg_score'a göre sıralı, yeşil tema */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl overflow-hidden backdrop-blur-lg">
            <div className="px-6 py-4 border-b border-white/10 flex items-center gap-3">
              <div className="bg-green-500/20 p-2 rounded-xl">
                <Trophy size={18} className="text-green-400" />
              </div>
              <div>
                <h3 className="font-bold text-white">En Başarılı Tahminler</h3>
                <p className="text-xs text-slate-500">En yüksek ortalama skor</p>
              </div>
            </div>
            <div className="divide-y divide-white/5">
              {(leaderboard.best || []).map((item, i) => (
                <div
                  key={item.symbol}
                  onClick={() => navigateToHistory({ symbol: item.symbol })}
                  className="flex items-center px-6 py-3 hover:bg-white/[0.04] transition-colors cursor-pointer group"
                  title={`${item.symbol} tahminlerini görüntüle`}
                >
                  <div className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-extrabold mr-3 ${
                    i === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                    i === 1 ? 'bg-slate-400/20 text-slate-300' :
                    i === 2 ? 'bg-amber-700/20 text-amber-500' :
                    'bg-white/5 text-slate-500'
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white text-sm group-hover:text-blue-400 transition-colors">{item.symbol}</div>
                    <div className="text-[10px] text-slate-500">
                      {item.correct_count}/{item.verified_count} doğru · {item.total_predictions} tahmin
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className={`text-sm font-bold ${item.accuracy >= 70 ? 'text-green-400' : item.accuracy >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                        %{item.accuracy.toFixed(1)}
                      </div>
                      <div className="text-[10px] text-slate-600">doğruluk</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${item.avg_score >= 60 ? 'text-blue-400' : 'text-slate-400'}`}>
                        {item.avg_score.toFixed(1)}
                      </div>
                      <div className="text-[10px] text-slate-600">skor</div>
                    </div>
                    <ChevronRight size={14} className="opacity-0 group-hover:opacity-60 transition-opacity text-slate-400" />
                  </div>
                </div>
              ))}
              {(!leaderboard.best || leaderboard.best.length === 0) && (
                <div className="text-center py-8 text-slate-600 text-sm">Henüz yeterli veri yok</div>
              )}
            </div>
          </div>

          {/* En Kötü Semboller — avg_score'a göre sıralı, kırmızı tema, ek olarak hata % gösteriyor */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl overflow-hidden backdrop-blur-lg">
            <div className="px-6 py-4 border-b border-white/10 flex items-center gap-3">
              <div className="bg-red-500/20 p-2 rounded-xl">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-white">İyileştirilmesi Gereken</h3>
                <p className="text-xs text-slate-500">En düşük ortalama skor</p>
              </div>
            </div>
            <div className="divide-y divide-white/5">
              {(leaderboard.worst || []).map((item, i) => (
                <div
                  key={item.symbol}
                  onClick={() => navigateToHistory({ symbol: item.symbol })}
                  className="flex items-center px-6 py-3 hover:bg-white/[0.04] transition-colors cursor-pointer group"
                  title={`${item.symbol} tahminlerini görüntüle`}
                >
                  <div className="w-7 h-7 flex items-center justify-center rounded-lg text-xs font-extrabold mr-3 bg-red-500/10 text-red-500">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white text-sm group-hover:text-blue-400 transition-colors">{item.symbol}</div>
                    <div className="text-[10px] text-slate-500">
                      {item.correct_count}/{item.verified_count} doğru · {item.total_predictions} tahmin
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className={`text-sm font-bold ${item.accuracy >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                        %{item.accuracy.toFixed(1)}
                      </div>
                      <div className="text-[10px] text-slate-600">doğruluk</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-red-400">{item.avg_score.toFixed(1)}</div>
                      <div className="text-[10px] text-slate-600">skor</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-orange-400">%{item.avg_error.toFixed(1)}</div>
                      <div className="text-[10px] text-slate-600">hata</div>
                    </div>
                    <ChevronRight size={14} className="opacity-0 group-hover:opacity-60 transition-opacity text-slate-400" />
                  </div>
                </div>
              ))}
              {(!leaderboard.worst || leaderboard.worst.length === 0) && (
                <div className="text-center py-8 text-slate-600 text-sm">Henüz yeterli veri yok</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PredictionHistoryPage;
