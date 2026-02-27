/**
 * SettingsPage.js — Sistem Ayarları ve Broker Yönetimi
 * ════════════════════════════════════════════════════════════
 *
 * Broker bağlantıları, borsa seçimi, API key yönetimi ve
 * ticker hızı gibi uygulama geneli ayarları yönetir.
 *
 * Bölümler:
 *   - Broker Listesi     : Paper, IBKR, Matriks, İş Yatırım kartları
 *   - Borsa Seçimi       : BIST, NYSE, NASDAQ (bayrak + para birimi)
 *   - API Key Yapılandırma: Broker başına genellenebilir config formu
 *   - Canlı Fiyat Hızı  : Ticker animasyon hızı slider
 *   - WebSocket Durumu   : Bağlantı göstergesi
 *
 * API:
 *   GET  /api/broker/list     — Broker listesi
 *   POST /api/broker/connect  — Broker aktifle
 *   POST /api/broker/config   — Broker config kaydet
 *
 * Props:
 *   wsConnected, stocks, livePrices, favorites,
 *   tickerSpeed, setTickerSpeed, brokerStatus, setBrokerStatus
 *
 * @module SettingsPage
 * @version 8.09.01
 * @since 8.05
 */

import React, { useState, useEffect, useCallback } from 'react';
import useAutoRefresh from '../hooks/useAutoRefresh';
import {
  BrainCircuit,
  Settings,
  Activity,
  Zap,
  Wifi,
  WifiOff,
  Link2,
  Unlink2,
  ShieldCheck,
  ShieldX,
  Building2,
  Globe,
  Key,
  Save,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  Clock,
  Play,
  Square,
  Timer,
  BarChart3,
  Bell,
  BellOff,
  Star,
  List,
  Users,
} from 'lucide-react';
import { API_BASE, ADMIN_API_BASE, WS_BASE } from '../config';
import { useAuth } from '../hooks/useAuth';

/* ─── Broker bilgileri (icon + renk) ─── */
const BROKER_META = {
  paper:      { icon: '📝', color: 'blue',   gradient: 'from-blue-500/20 to-cyan-500/20',   border: 'border-blue-500/30' },
  ibkr:       { icon: '🏛️', color: 'amber',  gradient: 'from-amber-500/20 to-orange-500/20', border: 'border-amber-500/30' },
  matriks:    { icon: '📊', color: 'emerald', gradient: 'from-emerald-500/20 to-green-500/20', border: 'border-emerald-500/30' },
  is_yatirim: { icon: '🏦', color: 'purple',  gradient: 'from-purple-500/20 to-violet-500/20', border: 'border-purple-500/30' },
};

const EXCHANGE_META = {
  BIST:   { label: 'Borsa İstanbul', flag: '🇹🇷', currency: 'TRY' },
  NYSE:   { label: 'New York Stock Exchange', flag: '🇺🇸', currency: 'USD' },
  NASDAQ: { label: 'NASDAQ', flag: '🇺🇸', currency: 'USD' },
};

const SettingsPage = ({
  wsConnected,
  stocks,
  livePrices,
  favorites,
  tickerSpeed,
  setTickerSpeed,
  brokerStatus,
  setBrokerStatus,
}) => {
  const { authFetch } = useAuth();
  const [brokers, setBrokers] = useState([]);
  const [activeBroker, setActiveBroker] = useState('paper');
  const [activeExchange, setActiveExchange] = useState('BIST');
  const [expandedBroker, setExpandedBroker] = useState(null);
  const [brokerConfigs, setBrokerConfigs] = useState({});
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState({});
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  /* ─── Analiz Zamanlayıcı state ─── */
  const [scheduleConfig, setScheduleConfig] = useState({
    enabled: false,
    interval_minutes: 60,
    stock_mode: 'all',
    custom_symbols: '',
    market_hours_only: true,
    max_concurrent: 3,
    notify_telegram: true,
    notify_browser: true,
  });
  const [scheduleStatus, setScheduleStatus] = useState({});
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleRunning, setScheduleRunning] = useState(false);

  /* ─── Broker listesini çek ─── */
  const fetchBrokers = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/broker/list`);
      const data = await res.json();
      setBrokers(data.brokers || []);
      setActiveBroker(data.active_broker || 'paper');
      setActiveExchange(data.active_exchange || 'BIST');
    } catch (e) { console.error('Broker list fetch error:', e); }
  }, [authFetch]);

  /* ─── Broker durumunu çek ─── */
  const fetchStatus = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/broker/status`);
      const data = await res.json();
      if (setBrokerStatus) setBrokerStatus(data);
      setActiveBroker(data.broker_type || 'paper');
      setActiveExchange(data.active_exchange || 'BIST');
    } catch (e) { console.error('Broker status fetch error:', e); }
  }, [setBrokerStatus, authFetch]);

  useEffect(() => {
    fetchBrokers();
    fetchStatus();
    fetchScheduleConfig();
  }, [fetchBrokers, fetchStatus]);

  // ─── AUTO-REFRESH: Broker durumu + zamanlayıcı (30s) ───
  const refreshSettingsData = useCallback(() => {
    fetchStatus();
    fetchScheduleConfig();
  }, [fetchStatus]);
  useAutoRefresh(refreshSettingsData, 30000, true);

  /* ─── Analiz Zamanlayıcı fonksiyonları ─── */
  const fetchScheduleConfig = async () => {
    setScheduleLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/api/analysis-schedule`);
      const data = await res.json();
      const { scheduler_status, ...config } = data;
      setScheduleConfig(prev => ({ ...prev, ...config }));
      if (scheduler_status) setScheduleStatus(scheduler_status);
    } catch (e) { console.error('Schedule fetch error:', e); }
    finally { setScheduleLoading(false); }
  };

  const saveScheduleConfig = async (overrides = {}) => {
    setScheduleSaving(true);
    try {
      const payload = { ...scheduleConfig, ...overrides };
      const res = await authFetch(`${API_BASE}/api/analysis-schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      const { scheduler_status, ...config } = data;
      setScheduleConfig(prev => ({ ...prev, ...config }));
      if (scheduler_status) setScheduleStatus(scheduler_status);
      setStatusMsg({ type: 'success', text: 'Zamanlayıcı ayarları kaydedildi.' });
    } catch (e) {
      setStatusMsg({ type: 'error', text: 'Zamanlayıcı kayıt hatası: ' + e.message });
    } finally {
      setScheduleSaving(false);
      setTimeout(() => setStatusMsg({ type: '', text: '' }), 3000);
    }
  };

  const runScheduleNow = async () => {
    setScheduleRunning(true);
    try {
      const res = await authFetch(`${API_BASE}/api/analysis-schedule/run-now`, { method: 'POST' });
      const data = await res.json();
      if (data.scheduler_status) setScheduleStatus(data.scheduler_status);
      setStatusMsg({ type: 'success', text: 'Analiz döngüsü tamamlandı!' });
    } catch (e) {
      setStatusMsg({ type: 'error', text: 'Analiz çalıştırma hatası: ' + e.message });
    } finally {
      setScheduleRunning(false);
      setTimeout(() => setStatusMsg({ type: '', text: '' }), 3000);
    }
  };

  /* ─── Broker config alanlarını çek ─── */
  const fetchBrokerConfig = async (brokerType) => {
    try {
      const res = await authFetch(`${API_BASE}/api/broker/config/${brokerType}`);
      const data = await res.json();
      setBrokerConfigs(prev => ({
        ...prev,
        [brokerType]: {
          fields: data.fields || [],
          values: data.current_config || {},
        },
      }));
    } catch (e) { console.error('Config fetch error:', e); }
  };

  const toggleExpand = (brokerType) => {
    if (expandedBroker === brokerType) {
      setExpandedBroker(null);
    } else {
      setExpandedBroker(brokerType);
      if (!brokerConfigs[brokerType]) fetchBrokerConfig(brokerType);
    }
  };

  /* ─── Config kaydet ─── */
  const saveConfig = async (brokerType) => {
    setSaving(true);
    try {
      const values = brokerConfigs[brokerType]?.values || {};
      await authFetch(`${API_BASE}/api/broker/config/${brokerType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      setStatusMsg({ type: 'success', text: 'Konfigürasyon kaydedildi.' });
    } catch (e) {
      setStatusMsg({ type: 'error', text: 'Kayıt hatası: ' + e.message });
    } finally {
      setSaving(false);
      setTimeout(() => setStatusMsg({ type: '', text: '' }), 3000);
    }
  };

  /* ─── Broker'a bağlan ─── */
  const connectBroker = async (brokerType) => {
    setConnecting(true);
    try {
      // Önce config'i kaydet
      const values = brokerConfigs[brokerType]?.values || {};
      await authFetch(`${API_BASE}/api/broker/config/${brokerType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      // Bağlan
      const res = await authFetch(`${API_BASE}/api/broker/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broker_type: brokerType, exchange: activeExchange }),
      });
      const data = await res.json();
      if (data.connected) {
        setActiveBroker(brokerType);
        if (setBrokerStatus) setBrokerStatus(data);
        setStatusMsg({ type: 'success', text: `${data.broker_name || brokerType} bağlantısı başarılı!` });
      } else {
        setStatusMsg({ type: 'error', text: data.message || 'Bağlantı başarısız.' });
      }
    } catch (e) {
      setStatusMsg({ type: 'error', text: 'Bağlantı hatası: ' + e.message });
    } finally {
      setConnecting(false);
      setTimeout(() => setStatusMsg({ type: '', text: '' }), 5000);
    }
  };

  /* ─── Bağlantıyı kes ─── */
  const disconnectBroker = async () => {
    try {
      await authFetch(`${API_BASE}/api/broker/disconnect`, { method: 'POST' });
      setActiveBroker('paper');
      setStatusMsg({ type: 'success', text: 'Broker bağlantısı kesildi. Paper moda geçildi.' });
      fetchStatus();
    } catch (e) {
      setStatusMsg({ type: 'error', text: 'Bağlantı kesme hatası.' });
    }
    setTimeout(() => setStatusMsg({ type: '', text: '' }), 3000);
  };

  /* ─── Borsa değiştir ─── */
  const changeExchange = async (exchange) => {
    try {
      await authFetch(`${API_BASE}/api/broker/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exchange }),
      });
      setActiveExchange(exchange);
    } catch (e) { console.error('Exchange change error:', e); }
  };

  const updateConfigValue = (brokerType, key, value) => {
    setBrokerConfigs(prev => ({
      ...prev,
      [brokerType]: {
        ...prev[brokerType],
        values: { ...(prev[brokerType]?.values || {}), [key]: value },
      },
    }));
  };

  const toggleSecretVisibility = (key) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const speedLabels = { 15: 'Çok Yavaş', 40: 'Yavaş', 80: 'Normal', 120: 'Orta-Hızlı', 200: 'Hızlı', 400: 'Çok Hızlı', 600: 'Ultra' };
  const currentLabel = speedLabels[tickerSpeed] || `${tickerSpeed} px/sn`;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold mb-2 flex items-center gap-3">
          <Settings className="text-blue-500" size={28} /> Ayarlar
        </h2>
        <p className="text-slate-500 text-sm">
          Broker bağlantıları, borsa seçimi ve uygulama yapılandırması.
        </p>
      </div>

      {/* Status mesajı */}
      {statusMsg.text && (
        <div className={`flex items-center gap-3 p-4 rounded-2xl border ${
          statusMsg.type === 'success'
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          {statusMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span className="text-sm font-medium">{statusMsg.text}</span>
        </div>
      )}

      {/* ═══ BROKER & BORSA SEÇİMİ ═══ */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 backdrop-blur-lg">
        <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
          <Building2 className="text-amber-500" size={20} /> Broker & Borsa Yönetimi
        </h3>

        {/* Aktif durum kartı */}
        <div className={`p-5 rounded-2xl border mb-6 bg-gradient-to-r ${
          BROKER_META[activeBroker]?.gradient || 'from-slate-500/20 to-slate-600/20'
        } ${BROKER_META[activeBroker]?.border || 'border-slate-500/30'}`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="text-3xl">{BROKER_META[activeBroker]?.icon || '📝'}</div>
              <div>
                <div className="text-sm text-slate-400">Aktif Broker</div>
                <div className="font-bold text-lg">
                  {brokers.find(b => b.broker_type === activeBroker)?.name || 'Paper Trading'}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {brokerStatus?.connected ? (
                    <span className="flex items-center gap-1 text-xs text-green-400">
                      <ShieldCheck size={12} /> Bağlı
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-red-400">
                      <ShieldX size={12} /> Bağlı Değil
                    </span>
                  )}
                  {brokerStatus?.account_id && (
                    <span className="text-xs text-slate-500">| Hesap: {brokerStatus.account_id}</span>
                  )}
                </div>
              </div>
            </div>
            {activeBroker !== 'paper' && (
              <button
                onClick={disconnectBroker}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-sm font-medium transition"
              >
                <Unlink2 size={14} /> Bağlantıyı Kes
              </button>
            )}
          </div>
        </div>

        {/* Borsa Seçimi */}
        <div className="mb-6">
          <label className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
            <Globe size={14} /> Aktif Borsa
          </label>
          <div className="flex flex-wrap gap-3 mt-2">
            {Object.entries(EXCHANGE_META).map(([key, meta]) => {
              // Aktif broker'ın desteklediği borsaları kontrol et
              const brokerInfo = brokers.find(b => b.broker_type === activeBroker);
              const supported = brokerInfo?.exchanges?.includes(key) ?? true;
              return (
                <button
                  key={key}
                  disabled={!supported}
                  onClick={() => changeExchange(key)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition ${
                    activeExchange === key
                      ? 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                      : supported
                        ? 'bg-black/20 border-white/10 text-slate-400 hover:border-white/20'
                        : 'bg-black/10 border-white/5 text-slate-600 cursor-not-allowed opacity-50'
                  }`}
                >
                  <span className="text-lg">{meta.flag}</span>
                  <span>{key}</span>
                  <span className="text-xs text-slate-500">({meta.currency})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Broker Listesi */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
            <Key size={14} /> Broker Seçimi & API Ayarları
          </label>
          {brokers.map((broker) => {
            const meta = BROKER_META[broker.broker_type] || BROKER_META.paper;
            const isActive = activeBroker === broker.broker_type;
            const isExpanded = expandedBroker === broker.broker_type;
            const cfg = brokerConfigs[broker.broker_type];

            return (
              <div key={broker.broker_type} className={`rounded-2xl border transition ${
                isActive ? `${meta.border} bg-gradient-to-r ${meta.gradient}` : 'border-white/10 bg-black/20'
              }`}>
                {/* Broker header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer"
                  onClick={() => toggleExpand(broker.broker_type)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{meta.icon}</span>
                    <div>
                      <div className="font-bold text-sm">{broker.name}</div>
                      <div className="text-xs text-slate-500">{broker.description}</div>
                      <div className="flex gap-1 mt-1">
                        {broker.exchanges?.map(ex => (
                          <span key={ex} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-500">
                            {ex}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isActive && (
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                        AKTİF
                      </span>
                    )}
                    {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                  </div>
                </div>

                {/* Broker config (expanded) */}
                {isExpanded && cfg && (
                  <div className="px-4 pb-4 border-t border-white/5 pt-4 space-y-4">
                    {cfg.fields.map((field) => {
                      const value = cfg.values?.[field.key] ?? field.default ?? '';
                      const isSecret = field.type === 'password';
                      const fieldId = `${broker.broker_type}_${field.key}`;
                      return (
                        <div key={field.key}>
                          <label className="text-xs font-medium text-slate-400 mb-1 block">
                            {field.label}
                            {field.hint && <span className="text-slate-600 ml-2">({field.hint})</span>}
                          </label>
                          {field.type === 'select' ? (
                            <select
                              value={value}
                              onChange={(e) => updateConfigValue(broker.broker_type, field.key, e.target.value)}
                              className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-white text-sm"
                            >
                              {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          ) : (
                            <div className="relative">
                              <input
                                type={isSecret && !showSecrets[fieldId] ? 'password' : (field.type === 'number' ? 'number' : 'text')}
                                value={value}
                                onChange={(e) => updateConfigValue(broker.broker_type, field.key, e.target.value)}
                                placeholder={field.label}
                                className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-white text-sm placeholder-slate-600 pr-10"
                              />
                              {isSecret && (
                                <button
                                  type="button"
                                  onClick={() => toggleSecretVisibility(fieldId)}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                                >
                                  {showSecrets[fieldId] ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Kaydet + Bağlan butonları */}
                    <div className="flex flex-wrap gap-3 pt-2">
                      <button
                        onClick={() => saveConfig(broker.broker_type)}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-500/20 hover:bg-slate-500/30 text-slate-300 border border-slate-500/30 text-sm font-medium transition"
                      >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Kaydet
                      </button>
                      {!isActive && (
                        <button
                          onClick={() => connectBroker(broker.broker_type)}
                          disabled={connecting}
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
                            connecting
                              ? 'bg-slate-500/20 text-slate-400'
                              : 'bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30'
                          }`}
                        >
                          {connecting ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                          Bağlan
                        </button>
                      )}
                      {isActive && broker.broker_type !== 'paper' && (
                        <button
                          onClick={disconnectBroker}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-sm font-medium transition"
                        >
                          <Unlink2 size={14} /> Bağlantıyı Kes
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ OTOMATİK ANALİZ ZAMANLAYICI ═══ */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 backdrop-blur-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Timer className="text-purple-400" size={20} /> Otomatik Analiz Zamanlayıcı
          </h3>
          <div className="flex items-center gap-3">
            {/* Durum göstergesi */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${
              scheduleConfig.enabled
                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
            }`}>
              <div className={`w-2 h-2 rounded-full ${scheduleConfig.enabled ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
              {scheduleConfig.enabled ? 'AKTİF' : 'DEVRE DIŞI'}
            </div>
            {/* Aç/Kapa toggle */}
            <button
              onClick={() => saveScheduleConfig({ enabled: !scheduleConfig.enabled })}
              disabled={scheduleSaving}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
                scheduleConfig.enabled
                  ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30'
                  : 'bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30'
              }`}
            >
              {scheduleSaving ? <Loader2 size={14} className="animate-spin" /> :
                scheduleConfig.enabled ? <><Square size={14} /> Durdur</> : <><Play size={14} /> Başlat</>
              }
            </button>
          </div>
        </div>

        {/* Ayar kartları grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">

          {/* Analiz Aralığı */}
          <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="text-blue-400" size={16} />
              <span className="text-sm font-bold text-slate-300">Analiz Aralığı</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {[
                { label: '5 dk', value: 5 },
                { label: '15 dk', value: 15 },
                { label: '30 dk', value: 30 },
                { label: '1 saat', value: 60 },
                { label: '2 saat', value: 120 },
                { label: '4 saat', value: 240 },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setScheduleConfig(prev => ({ ...prev, interval_minutes: opt.value }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    scheduleConfig.interval_minutes === opt.value
                      ? 'bg-blue-500/30 text-blue-400 border border-blue-500/40'
                      : 'bg-white/5 text-slate-400 border border-white/10 hover:border-blue-500/30'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="1440"
                value={scheduleConfig.interval_minutes}
                onChange={(e) => setScheduleConfig(prev => ({ ...prev, interval_minutes: Math.max(1, parseInt(e.target.value) || 60) }))}
                className="w-20 px-2 py-1.5 rounded-lg bg-black/30 border border-white/10 text-white text-sm text-center"
              />
              <span className="text-xs text-slate-500">dakika</span>
            </div>
          </div>

          {/* Hisse Seçimi */}
          <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="text-emerald-400" size={16} />
              <span className="text-sm font-bold text-slate-300">Analiz Edilecek Hisseler</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {[
                { label: 'Tüm Hisseler', value: 'all', icon: <List size={12} /> },
                { label: 'Favoriler', value: 'favorites', icon: <Star size={12} /> },
                { label: 'Özel Liste', value: 'custom', icon: <Users size={12} /> },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setScheduleConfig(prev => ({ ...prev, stock_mode: opt.value }))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    scheduleConfig.stock_mode === opt.value
                      ? 'bg-emerald-500/30 text-emerald-400 border border-emerald-500/40'
                      : 'bg-white/5 text-slate-400 border border-white/10 hover:border-emerald-500/30'
                  }`}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
            {scheduleConfig.stock_mode === 'custom' && (
              <input
                type="text"
                value={scheduleConfig.custom_symbols}
                onChange={(e) => setScheduleConfig(prev => ({ ...prev, custom_symbols: e.target.value.toUpperCase() }))}
                placeholder="THYAO, AKBNK, GARAN, SAHOL..."
                className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm placeholder-slate-600"
              />
            )}
            {scheduleConfig.stock_mode === 'all' && (
              <div className="text-xs text-slate-500">📊 Aktif tüm hisseler analiz edilecek ({stocks.length} hisse)</div>
            )}
            {scheduleConfig.stock_mode === 'favorites' && (
              <div className="text-xs text-slate-500">⭐ Favori listenizdeki hisseler analiz edilecek ({favorites.length} hisse)</div>
            )}
          </div>

          {/* Borsa Saatleri & Eşzamanlılık */}
          <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="text-amber-400" size={16} />
              <span className="text-sm font-bold text-slate-300">Çalışma Koşulları</span>
            </div>
            <div className="space-y-3">
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-sm text-slate-400 group-hover:text-slate-300">Sadece borsa saatlerinde çalış</span>
                <div
                  onClick={() => setScheduleConfig(prev => ({ ...prev, market_hours_only: !prev.market_hours_only }))}
                  className={`w-11 h-6 rounded-full transition-colors cursor-pointer flex items-center ${
                    scheduleConfig.market_hours_only ? 'bg-amber-500/50' : 'bg-slate-600/50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    scheduleConfig.market_hours_only ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </div>
              </label>
              {scheduleConfig.market_hours_only && (
                <div className="text-xs text-amber-400/70 pl-1">🕐 09:30 — 18:00 (Borsa İstanbul)</div>
              )}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-400">Eşzamanlı analiz limiti</span>
                  <span className="text-sm font-bold text-purple-400">{scheduleConfig.max_concurrent}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={scheduleConfig.max_concurrent}
                  onChange={(e) => setScheduleConfig(prev => ({ ...prev, max_concurrent: parseInt(e.target.value) }))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                  <span>1 (yavaş)</span>
                  <span>5</span>
                  <span>10 (hızlı)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bildirimler */}
          <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="text-cyan-400" size={16} />
              <span className="text-sm font-bold text-slate-300">Bildirimler</span>
            </div>
            <div className="space-y-3">
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-sm text-slate-400 group-hover:text-slate-300">📱 Telegram Bildirimi</span>
                <div
                  onClick={() => setScheduleConfig(prev => ({ ...prev, notify_telegram: !prev.notify_telegram }))}
                  className={`w-11 h-6 rounded-full transition-colors cursor-pointer flex items-center ${
                    scheduleConfig.notify_telegram ? 'bg-cyan-500/50' : 'bg-slate-600/50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    scheduleConfig.notify_telegram ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </div>
              </label>
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-sm text-slate-400 group-hover:text-slate-300">🔔 Tarayıcı Bildirimi</span>
                <div
                  onClick={() => setScheduleConfig(prev => ({ ...prev, notify_browser: !prev.notify_browser }))}
                  className={`w-11 h-6 rounded-full transition-colors cursor-pointer flex items-center ${
                    scheduleConfig.notify_browser ? 'bg-cyan-500/50' : 'bg-slate-600/50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    scheduleConfig.notify_browser ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Durum bilgisi + aksiyonlar */}
        <div className="p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-2xl border border-purple-500/20">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-xs text-slate-500 mb-1">Son Çalışma</div>
              <div className="text-sm font-bold text-purple-400">
                {scheduleConfig.last_run_at
                  ? new Date(scheduleConfig.last_run_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
                  : '—'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-500 mb-1">Sonraki Çalışma</div>
              <div className="text-sm font-bold text-blue-400">
                {scheduleStatus.next_run_at
                  ? new Date(scheduleStatus.next_run_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
                  : '—'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-500 mb-1">Toplam Çalışma</div>
              <div className="text-sm font-bold text-emerald-400">{scheduleConfig.total_runs || 0}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-500 mb-1">Analiz Edilen</div>
              <div className="text-sm font-bold text-amber-400">{scheduleStatus.analyzed_count || 0} hisse</div>
            </div>
          </div>

          {/* Son loglar */}
          {scheduleStatus.recent_logs && scheduleStatus.recent_logs.length > 0 && (
            <div className="mb-4 max-h-32 overflow-y-auto">
              <div className="text-xs text-slate-500 mb-2">Son İşlemler:</div>
              <div className="space-y-1">
                {scheduleStatus.recent_logs.slice(-5).reverse().map((log, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={`font-bold ${
                      log.action === 'ERROR' ? 'text-red-400' :
                      log.action === 'SKIP' ? 'text-slate-500' :
                      log.action === 'DONE' ? 'text-green-400' :
                      log.action === 'BUY' ? 'text-green-400' :
                      log.action === 'SELL' ? 'text-red-400' :
                      'text-blue-400'
                    }`}>{log.symbol}</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-400">{log.action}</span>
                    <span className="text-slate-600">—</span>
                    <span className="text-slate-500 truncate">{log.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => saveScheduleConfig()}
              disabled={scheduleSaving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/30 text-sm font-medium transition"
            >
              {scheduleSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Ayarları Kaydet
            </button>
            <button
              onClick={runScheduleNow}
              disabled={scheduleRunning}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 text-sm font-medium transition"
            >
              {scheduleRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              Şimdi Çalıştır
            </button>
            <button
              onClick={fetchScheduleConfig}
              disabled={scheduleLoading}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-500/20 hover:bg-slate-500/30 text-slate-400 border border-slate-500/30 text-sm font-medium transition"
            >
              {scheduleLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            </button>
          </div>
        </div>
      </div>

      {/* ═══ ALT BÖLÜM: API + Ticker + Sistem ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* API Endpoints */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 backdrop-blur-lg">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Zap className="text-yellow-500" size={18} /> API Bağlantıları
          </h3>
          <div className="space-y-4">
            {[
              { label: 'ML Backend (FastAPI)', url: API_BASE, status: true },
              { label: 'Admin Panel (Laravel)', url: ADMIN_API_BASE, status: true },
              { label: 'WebSocket Stream', url: `${WS_BASE}/ws/market`, status: wsConnected },
            ].map((ep) => (
              <div
                key={ep.label}
                className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5"
              >
                <div>
                  <div className="text-sm font-bold">{ep.label}</div>
                  <div className="text-xs text-slate-500 font-mono">{ep.url}</div>
                </div>
                <div
                  className={`w-3 h-3 rounded-full ${
                    ep.status
                      ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]'
                      : 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]'
                  }`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Canlı Ticker Hızı */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 backdrop-blur-lg">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Activity className="text-blue-400" size={18} /> Canlı Şerit Ayarları
          </h3>
          <div className="space-y-4">
            <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-slate-400">Kayma Hızı</span>
                <span className="text-sm font-bold text-blue-400">{currentLabel}</span>
              </div>
              <input
                type="range"
                min="15"
                max="600"
                step="5"
                value={tickerSpeed}
                onChange={(e) => setTickerSpeed(Number(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between mt-2 text-[10px] text-slate-600">
                <span>🐢 Çok Yavaş</span>
                <span>Normal</span>
                <span>🚀 Ultra Hızlı</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sistem Bilgisi */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 backdrop-blur-lg">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Activity className="text-blue-400" size={18} /> Sistem Bilgisi
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
              <span className="text-sm text-slate-400">Takip Edilen Hisse</span>
              <span className="font-bold">{stocks.length}</span>
            </div>
            <div className="flex justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
              <span className="text-sm text-slate-400">Canlı Fiyat Akışı</span>
              <span className="font-bold">{Object.keys(livePrices).length} sembol</span>
            </div>
            <div className="flex justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
              <span className="text-sm text-slate-400">Favori Sayısı</span>
              <span className="font-bold">{favorites.length}</span>
            </div>
            <div className="flex justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
              <span className="text-sm text-slate-400">Aktif Broker</span>
              <span className="font-bold capitalize">{activeBroker}</span>
            </div>
            <div className="flex justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
              <span className="text-sm text-slate-400">Aktif Borsa</span>
              <span className="font-bold">{activeExchange}</span>
            </div>
          </div>
        </div>

        {/* Versiyon */}
        <div className="bg-gradient-to-br from-blue-600/10 to-indigo-600/10 border border-blue-500/20 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-2xl">
                <BrainCircuit className="text-white" size={28} />
              </div>
              <div>
                <h3 className="font-bold text-lg">BIST AI Engine</h3>
                <p className="text-sm text-slate-400">
                  v8.0 — Multi-Broker + BIST & ABD Borsaları
                </p>
              </div>
            </div>
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
              GÜNCEL
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
