import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ShieldCheck, Bot, FileText, Activity, Search, X, ChevronDown,
  TrendingUp, TrendingDown, Zap, Target, ArrowDownUp, SlidersHorizontal,
  AlertTriangle, CheckCircle2, XCircle, Info, BarChart3, Clock
} from 'lucide-react';

/* ─────────────────────────────────────────────
   Searchable Multi-Select Dropdown Bileşeni
───────────────────────────────────────────── */
const StockDropdown = ({ stocks, livePrices, value, onChange, multiple = false, placeholder = 'Sembol seçin...' }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return stocks;
    const q = search.toLowerCase();
    return stocks.filter(s => s.symbol.toLowerCase().includes(q) || (s.name && s.name.toLowerCase().includes(q)));
  }, [stocks, search]);

  const selected = multiple ? (Array.isArray(value) ? value : []) : [];

  const toggleSymbol = (sym) => {
    if (multiple) {
      const next = selected.includes(sym) ? selected.filter(s => s !== sym) : [...selected, sym];
      onChange(next);
    } else {
      onChange(sym);
      setOpen(false);
      setSearch('');
    }
  };

  const removeChip = (sym, e) => {
    e.stopPropagation();
    onChange(selected.filter(s => s !== sym));
  };

  const getLiveData = (sym) => livePrices?.[sym] || null;

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setOpen(!open)}
        className="bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm cursor-pointer flex items-center gap-2 min-h-[38px] hover:border-white/20 transition-colors"
      >
        {multiple ? (
          <div className="flex flex-wrap gap-1 flex-1">
            {selected.length === 0 && <span className="text-slate-500">{placeholder}</span>}
            {selected.map(sym => (
              <span key={sym} className="bg-blue-600/30 text-blue-300 text-xs px-2 py-0.5 rounded-lg flex items-center gap-1">
                {sym}
                <X size={10} className="cursor-pointer hover:text-white" onClick={(e) => removeChip(sym, e)} />
              </span>
            ))}
          </div>
        ) : (
          <span className={value ? 'text-white flex-1' : 'text-slate-500 flex-1'}>
            {value || placeholder}
          </span>
        )}
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#0d1525] border border-white/10 rounded-xl shadow-2xl max-h-72 overflow-hidden">
          <div className="p-2 border-b border-white/5">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                className="w-full bg-black/30 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
                placeholder="Hisse ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <div className="overflow-auto max-h-56 scrollbar-thin">
            {filtered.length === 0 && (
              <div className="text-center text-slate-500 text-xs py-4">Sonuç bulunamadı</div>
            )}
            {filtered.map(stock => {
              const live = getLiveData(stock.symbol);
              const isSelected = multiple ? selected.includes(stock.symbol) : value === stock.symbol;
              const changeColor = (live?.change_pct ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400';
              return (
                <div
                  key={stock.symbol}
                  onClick={() => toggleSymbol(stock.symbol)}
                  className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-600/20 text-blue-300' : 'hover:bg-white/5 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {multiple && (
                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                        isSelected ? 'bg-blue-600 border-blue-500' : 'border-white/20'
                      }`}>
                        {isSelected && <CheckCircle2 size={10} className="text-white" />}
                      </div>
                    )}
                    <span className="font-bold">{stock.symbol}</span>
                    <span className="text-slate-500 truncate max-w-[120px]">{stock.name}</span>
                  </div>
                  {live && (
                    <div className="flex items-center gap-2">
                      <span className="font-mono">₺{live.price?.toFixed(2)}</span>
                      <span className={`font-mono ${changeColor}`}>
                        {(live.change_pct ?? 0) >= 0 ? '+' : ''}{(live.change_pct ?? 0).toFixed(2)}%
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {multiple && selected.length > 0 && (
            <div className="border-t border-white/5 p-2 flex items-center justify-between">
              <span className="text-xs text-slate-400">{selected.length} hisse seçili</span>
              <button onClick={() => onChange([])} className="text-xs text-red-400 hover:text-red-300">Temizle</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────
   Toggle Switch Bileşeni
───────────────────────────────────────────── */
const Toggle = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-2 cursor-pointer text-sm select-none">
    <div
      onClick={() => onChange(!checked)}
      className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${checked ? 'bg-blue-600' : 'bg-white/10'}`}
    >
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </div>
    <span className="text-slate-300">{label}</span>
  </label>
);

/* ─────────────────────────────────────────────
   Ana TradePage Bileşeni
───────────────────────────────────────────── */
const TradePage = ({
  manualOrder,
  setManualOrder,
  submitManualOrder,
  autoTradeConfig,
  setAutoTradeConfig,
  triggerAutoTrade,
  autoTradeStatus,
  orderHistory,
  tradeLoading,
  tradeResult,
  loadTradingState,
  stocks = [],
  livePrices = {},
  brokerStatus = {},
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState('manual'); // manual | auto

  // Seçili hissenin canlı verisini al
  const selectedLive = livePrices[manualOrder.symbol] || null;

  // Strateji bilgi metinleri
  const strategyInfo = {
    manual: { label: 'Manuel', desc: 'Kendiniz fiyat ve miktar belirlersiniz', icon: SlidersHorizontal, color: 'text-blue-400' },
    ai_only: { label: 'AI Kararı', desc: 'Yapay zeka analiz eder, sinyal doğrultusunda emir verir', icon: Zap, color: 'text-emerald-400' },
    indicator: { label: 'İndikatör', desc: 'RSI, MACD, Bollinger bantlarına göre otomatik karar', icon: BarChart3, color: 'text-amber-400' },
    hybrid: { label: 'Hibrit (AI + İndikatör)', desc: 'AI + teknik analiz birleşik karar verir', icon: Target, color: 'text-purple-400' },
  };

  const orderTypeInfo = {
    market: { label: 'Piyasa Emri', desc: 'Anlık piyasa fiyatından', icon: Zap },
    limit: { label: 'Limit Emir', desc: 'Belirlenen fiyata ulaşınca', icon: Target },
    stop_loss: { label: 'Stop-Loss', desc: 'Zarar durdurma emri', icon: AlertTriangle },
    take_profit: { label: 'Take-Profit', desc: 'Kâr realizasyonu', icon: TrendingUp },
    trailing_stop: { label: 'Trailing Stop', desc: 'Kayan stop-loss', icon: ArrowDownUp },
  };

  return (
    <div className="space-y-6">
      {/* Broker / Borsa Durum Bandı */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/10">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border ${
          brokerStatus?.connected
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
        }`}>
          <div className={`w-2 h-2 rounded-full ${brokerStatus?.connected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`} />
          {brokerStatus?.broker_name || 'Paper Trading'}
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs font-bold text-blue-400">
          🏛️ {brokerStatus?.active_exchange || brokerStatus?.exchange || 'BIST'}
        </div>
        {brokerStatus?.balance > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-400">
            💰 {Number(brokerStatus.balance).toLocaleString('tr-TR')} {brokerStatus?.currency || 'TRY'}
          </div>
        )}
        {brokerStatus?.account_id && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-500">
            Hesap: {brokerStatus.account_id}
          </div>
        )}
      </div>

      {/* Başlık */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold mb-1 flex items-center gap-3">
          <Activity className="text-emerald-500" size={28} /> İşlem Merkezi
        </h2>
        <p className="text-slate-500 text-sm">
          Profesyonel emir yönetimi — AI destekli veya manuel strateji ile işlem yapın.
        </p>
      </div>

      {/* Tab Seçimi */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('manual')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'manual'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'bg-white/5 text-slate-400 hover:bg-white/10'
          }`}
        >
          <ShieldCheck size={16} /> Manuel Emir
        </button>
        <button
          onClick={() => setActiveTab('auto')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'auto'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
              : 'bg-white/5 text-slate-400 hover:bg-white/10'
          }`}
        >
          <Bot size={16} /> Otomatik AI Trade
        </button>
      </div>

      {/* ════════════════════════════════════════════
          MANUEL EMİR PANELI
      ════════════════════════════════════════════ */}
      {activeTab === 'manual' && (
        <div className="space-y-4">
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 backdrop-blur-lg">

            {/* ── Hisse Seçimi + Canlı Fiyat ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">Hisse Senedi</label>
                <StockDropdown
                  stocks={stocks}
                  livePrices={livePrices}
                  value={manualOrder.symbol}
                  onChange={(sym) => setManualOrder(p => ({ ...p, symbol: sym }))}
                  placeholder="Hisse seçin..."
                />
              </div>
              {/* Canlı Fiyat Kartı */}
              {manualOrder.symbol && (
                <div className="bg-black/20 border border-white/10 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <div className="text-lg font-bold">{manualOrder.symbol}</div>
                    <div className="text-xs text-slate-500">Canlı Piyasa Fiyatı</div>
                  </div>
                  {selectedLive ? (
                    <div className="text-right">
                      <div className="text-2xl font-bold font-mono">₺{selectedLive.price?.toFixed(2)}</div>
                      <div className={`text-sm font-mono ${(selectedLive.change_pct ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {(selectedLive.change_pct ?? 0) >= 0 ? '+' : ''}{(selectedLive.change_pct ?? 0).toFixed(2)}%
                        {(selectedLive.change_pct ?? 0) >= 0
                          ? <TrendingUp size={14} className="inline ml-1" />
                          : <TrendingDown size={14} className="inline ml-1" />}
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-500 text-sm">Fiyat bekleniyor...</div>
                  )}
                </div>
              )}
            </div>

            {/* ── Strateji Seçimi ── */}
            <div className="mb-6">
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Strateji Tipi</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(strategyInfo).map(([key, info]) => {
                  const Icon = info.icon;
                  const isActive = manualOrder.strategy_type === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setManualOrder(p => ({ ...p, strategy_type: key }))}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-white/10 border-blue-500/50 text-white shadow-lg'
                          : 'bg-black/10 border-white/5 text-slate-400 hover:bg-white/5 hover:border-white/10'
                      }`}
                    >
                      <Icon size={18} className={isActive ? info.color : 'text-slate-500'} />
                      <span className={isActive ? 'text-white' : ''}>{info.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                <Info size={12} />
                {strategyInfo[manualOrder.strategy_type || 'manual']?.desc}
              </p>
            </div>

            {/* ── Yön + Miktar + Mod ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">Yön</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setManualOrder(p => ({ ...p, side: 'BUY' }))}
                    className={`py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                      manualOrder.side === 'BUY'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                        : 'bg-black/20 border border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    <TrendingUp size={14} /> AL
                  </button>
                  <button
                    onClick={() => setManualOrder(p => ({ ...p, side: 'SELL' }))}
                    className={`py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                      manualOrder.side === 'SELL'
                        ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                        : 'bg-black/20 border border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    <TrendingDown size={14} /> SAT
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">Miktar (Lot)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
                  value={manualOrder.quantity}
                  onChange={(e) => setManualOrder(p => ({ ...p, quantity: e.target.value }))}
                  placeholder="Miktar"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">İşlem Modu</label>
                <select
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500/50"
                  value={manualOrder.mode}
                  onChange={(e) => setManualOrder(p => ({ ...p, mode: e.target.value }))}
                >
                  <option value="paper">📝 Paper (Simülasyon)</option>
                  <option value="real">🔴 Real (Dry-Run)</option>
                </select>
              </div>
            </div>

            {/* ── Emir Tipi ── */}
            <div className="mb-4">
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Emir Tipi</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {Object.entries(orderTypeInfo).map(([key, info]) => {
                  const Icon = info.icon;
                  const isActive = manualOrder.order_type === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setManualOrder(p => ({ ...p, order_type: key }))}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                          : 'bg-black/10 border-white/5 text-slate-400 hover:bg-white/5'
                      }`}
                    >
                      <Icon size={13} />
                      {info.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Koşullu Fiyat Alanları (Emir tipine göre) ── */}
            {manualOrder.order_type !== 'market' && (
              <div className="bg-black/20 border border-white/5 rounded-xl p-4 mb-4 space-y-3">
                <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle size={12} /> Koşullu Emir Parametreleri
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(manualOrder.order_type === 'limit' || manualOrder.order_type === 'stop_loss') && (
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Tetikleme Fiyatı (₺)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50"
                        value={manualOrder.trigger_price || ''}
                        onChange={(e) => setManualOrder(p => ({ ...p, trigger_price: e.target.value ? Number(e.target.value) : null }))}
                        placeholder={selectedLive ? `Güncel: ₺${selectedLive.price?.toFixed(2)}` : 'Fiyat girin'}
                      />
                    </div>
                  )}
                  {(manualOrder.order_type === 'stop_loss' || manualOrder.order_type === 'take_profit') && (
                    <>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Stop-Loss Fiyatı (₺)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500/50"
                          value={manualOrder.stop_price || ''}
                          onChange={(e) => setManualOrder(p => ({ ...p, stop_price: e.target.value ? Number(e.target.value) : null }))}
                          placeholder="Stop fiyatı"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Take-Profit Fiyatı (₺)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50"
                          value={manualOrder.take_profit_price || ''}
                          onChange={(e) => setManualOrder(p => ({ ...p, take_profit_price: e.target.value ? Number(e.target.value) : null }))}
                          placeholder="Kâr fiyatı"
                        />
                      </div>
                    </>
                  )}
                  {manualOrder.order_type === 'trailing_stop' && (
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Trailing Stop (%)</label>
                      <input
                        type="number"
                        min="0.1"
                        max="50"
                        step="0.1"
                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50"
                        value={manualOrder.trailing_stop_pct || ''}
                        onChange={(e) => setManualOrder(p => ({ ...p, trailing_stop_pct: e.target.value ? Number(e.target.value) : null }))}
                        placeholder="Ör: 3.0"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Gelişmiş Ayarlar Toggle ── */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 mb-4 transition-colors"
            >
              <SlidersHorizontal size={12} />
              Gelişmiş Ayarlar {showAdvanced ? '▲' : '▼'}
            </button>

            {showAdvanced && (
              <div className="bg-black/20 border border-white/5 rounded-xl p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Portföy Değeri (₺)</label>
                  <input
                    type="number"
                    min="10000"
                    step="10000"
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50"
                    value={manualOrder.portfolio_value || 250000}
                    onChange={(e) => setManualOrder(p => ({ ...p, portfolio_value: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Not / Açıklama</label>
                  <input
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50"
                    value={manualOrder.notes || ''}
                    onChange={(e) => setManualOrder(p => ({ ...p, notes: e.target.value }))}
                    placeholder="İsteğe bağlı not..."
                  />
                </div>
              </div>
            )}

            {/* ── Tahmini Maliyet Bilgisi ── */}
            {manualOrder.symbol && selectedLive?.price && manualOrder.quantity > 0 && (
              <div className="bg-gradient-to-r from-blue-600/5 to-indigo-600/5 border border-white/5 rounded-xl p-4 mb-4">
                <div className="text-xs font-bold text-slate-400 mb-2">Tahmini İşlem Özeti</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <div className="text-slate-500">Piyasa Fiyatı</div>
                    <div className="font-mono font-bold text-white">₺{selectedLive.price.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Miktar</div>
                    <div className="font-mono font-bold text-white">{manualOrder.quantity} lot</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Tahmini Tutar</div>
                    <div className="font-mono font-bold text-emerald-400">
                      ₺{(selectedLive.price * Number(manualOrder.quantity)).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Tahmini Slipaj</div>
                    <div className="font-mono font-bold text-amber-400">~%0.05 - %0.30</div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Emir Gönder ── */}
            <button
              onClick={submitManualOrder}
              disabled={tradeLoading || !manualOrder.symbol}
              className={`w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40 ${
                manualOrder.side === 'BUY'
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20'
                  : 'bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/20'
              }`}
            >
              {tradeLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Emir İşleniyor...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  {manualOrder.side === 'BUY' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  {manualOrder.symbol ? `${manualOrder.symbol} — ${manualOrder.side === 'BUY' ? 'AL' : 'SAT'} Emri Gönder` : 'Hisse Seçiniz'}
                </span>
              )}
            </button>

            {/* ── Emir Sonucu ── */}
            {tradeResult?.order && (
              <div className={`mt-4 rounded-xl p-4 border ${
                tradeResult.order.status === 'filled'
                  ? 'bg-emerald-600/10 border-emerald-500/30'
                  : 'bg-red-600/10 border-red-500/30'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {tradeResult.order.status === 'filled'
                    ? <CheckCircle2 size={16} className="text-emerald-400" />
                    : <XCircle size={16} className="text-red-400" />
                  }
                  <span className={`text-sm font-bold ${
                    tradeResult.order.status === 'filled' ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {tradeResult.order.status === 'filled' ? 'Emir Gerçekleşti' : 'Emir Reddedildi'}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">Emir ID</span>
                    <div className="font-mono text-white">{tradeResult.order.order_id}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Sembol</span>
                    <div className="font-bold text-white">{tradeResult.order.symbol} · {tradeResult.order.side}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Dolum Fiyatı</span>
                    <div className="font-mono text-white">₺{tradeResult.order.simulated_fill_price?.toFixed(2)}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Slipaj</span>
                    <div className="font-mono text-amber-400">
                      {tradeResult.order.slippage_pct != null ? `%${tradeResult.order.slippage_pct.toFixed(4)}` : '—'}
                      {tradeResult.order.spread != null && (
                        <span className="text-slate-500 ml-1">(spread: ₺{tradeResult.order.spread.toFixed(4)})</span>
                      )}
                    </div>
                  </div>
                </div>
                {tradeResult.order.reason && (
                  <div className="mt-2 text-xs text-slate-400 flex items-start gap-1">
                    <Info size={11} className="mt-0.5 shrink-0" />
                    {tradeResult.order.reason}
                  </div>
                )}
                {tradeResult.ai_context && (
                  <div className="mt-2 bg-black/20 rounded-lg p-2 text-xs grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-slate-500">AI Sinyal</span>
                      <div className={tradeResult.ai_context.signal === 'BUY' ? 'text-emerald-400 font-bold' : tradeResult.ai_context.signal === 'SELL' ? 'text-red-400 font-bold' : 'text-slate-300'}>
                        {tradeResult.ai_context.signal}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">AI Güven</span>
                      <div className="text-blue-400 font-mono">{(tradeResult.ai_context.confidence * 100).toFixed(1)}%</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Risk</span>
                      <div className={tradeResult.risk?.approved ? 'text-emerald-400' : 'text-red-400'}>
                        {tradeResult.risk?.approved ? 'Onaylandı' : 'Reddedildi'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {tradeResult?.status === 'error' && (
              <div className="mt-4 bg-red-600/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400 flex items-center gap-2">
                <XCircle size={14} /> {tradeResult.reason}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          OTOMATİK AI TRADE PANELİ
      ════════════════════════════════════════════ */}
      {activeTab === 'auto' && (
        <div className="space-y-4">
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 backdrop-blur-lg">

            {/* ── Durum Göstergesi ── */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <Bot className="text-emerald-400" size={18} /> Otomatik AI Trade
              </h3>
              <div className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full ${
                autoTradeStatus?.enabled
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-600/20 text-slate-400 border border-slate-600/30'
              }`}>
                <div className={`w-2 h-2 rounded-full ${autoTradeStatus?.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                {autoTradeStatus?.enabled ? 'AKTİF — Çalışıyor' : 'PASİF — Durduruldu'}
              </div>
            </div>

            {/* ── Hisse Seçimi (Multi) ── */}
            <div className="mb-5">
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">İşlem Yapılacak Hisseler</label>
              <StockDropdown
                stocks={stocks}
                livePrices={livePrices}
                value={typeof autoTradeConfig.symbols === 'string'
                  ? autoTradeConfig.symbols.split(',').map(s => s.trim()).filter(Boolean)
                  : autoTradeConfig.symbols || []}
                onChange={(syms) => setAutoTradeConfig(p => ({ ...p, symbols: syms.join(',') }))}
                multiple
                placeholder="Hisse ekleyin..."
              />
            </div>

            {/* ── Strateji Seçimi ── */}
            <div className="mb-5">
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">Trade Stratejisi</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {['ai_only', 'indicator', 'hybrid'].map(key => {
                  const info = strategyInfo[key];
                  const Icon = info.icon;
                  const isActive = autoTradeConfig.strategy_type === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setAutoTradeConfig(p => ({ ...p, strategy_type: key }))}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-sm transition-all ${
                        isActive
                          ? 'bg-white/10 border-emerald-500/50 text-white'
                          : 'bg-black/10 border-white/5 text-slate-400 hover:bg-white/5'
                      }`}
                    >
                      <Icon size={20} className={isActive ? info.color : 'text-slate-500'} />
                      <div className="text-left">
                        <div className="font-bold text-xs">{info.label}</div>
                        <div className="text-[10px] text-slate-500">{info.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Temel Parametreler ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">İşlem Modu</label>
                <select
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50"
                  value={autoTradeConfig.mode}
                  onChange={(e) => setAutoTradeConfig(p => ({ ...p, mode: e.target.value }))}
                >
                  <option value="paper">📝 Paper (Simülasyon)</option>
                  <option value="real">🔴 Real (Dry-Run)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Min. AI Güveni</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0.5"
                    max="0.99"
                    step="0.01"
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50"
                    value={autoTradeConfig.min_confidence}
                    onChange={(e) => setAutoTradeConfig(p => ({ ...p, min_confidence: e.target.value }))}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                    {(Number(autoTradeConfig.min_confidence) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Maks. Emir Tutarı (₺)</label>
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50"
                  value={autoTradeConfig.max_order_size}
                  onChange={(e) => setAutoTradeConfig(p => ({ ...p, max_order_size: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Döngü Süresi (sn)</label>
                <input
                  type="number"
                  min="10"
                  max="3600"
                  step="10"
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50"
                  value={autoTradeConfig.cycle_seconds}
                  onChange={(e) => setAutoTradeConfig(p => ({ ...p, cycle_seconds: e.target.value }))}
                />
              </div>
            </div>

            {/* ── Portföy + Risk Parametreleri ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Portföy Değeri (₺)</label>
                <input
                  type="number"
                  min="10000"
                  step="10000"
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50"
                  value={autoTradeConfig.portfolio_value}
                  onChange={(e) => setAutoTradeConfig(p => ({ ...p, portfolio_value: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block flex items-center gap-1">
                  <AlertTriangle size={11} className="text-red-400" /> Oto Stop-Loss (%)
                </label>
                <input
                  type="number"
                  min="0.5"
                  max="20"
                  step="0.5"
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-500/50"
                  value={autoTradeConfig.auto_stop_loss_pct ?? 3.0}
                  onChange={(e) => setAutoTradeConfig(p => ({ ...p, auto_stop_loss_pct: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block flex items-center gap-1">
                  <TrendingUp size={11} className="text-emerald-400" /> Oto Take-Profit (%)
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  step="0.5"
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50"
                  value={autoTradeConfig.auto_take_profit_pct ?? 5.0}
                  onChange={(e) => setAutoTradeConfig(p => ({ ...p, auto_take_profit_pct: Number(e.target.value) }))}
                />
              </div>
            </div>

            {/* ── İndikatör Ayarları (strategy indicator veya hybrid ise) ── */}
            {(autoTradeConfig.strategy_type === 'indicator' || autoTradeConfig.strategy_type === 'hybrid') && (
              <div className="bg-gradient-to-r from-amber-600/5 to-orange-600/5 border border-amber-500/10 rounded-xl p-4 mb-5">
                <div className="text-xs font-bold text-amber-400 mb-3 flex items-center gap-1.5">
                  <BarChart3 size={14} /> Teknik İndikatör Parametreleri
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">RSI Aşırı Satım</label>
                    <input
                      type="number"
                      min="10"
                      max="50"
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50"
                      value={autoTradeConfig.rsi_oversold ?? 30}
                      onChange={(e) => setAutoTradeConfig(p => ({ ...p, rsi_oversold: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">RSI Aşırı Alım</label>
                    <input
                      type="number"
                      min="50"
                      max="90"
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50"
                      value={autoTradeConfig.rsi_overbought ?? 70}
                      onChange={(e) => setAutoTradeConfig(p => ({ ...p, rsi_overbought: Number(e.target.value) }))}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  <Toggle
                    checked={autoTradeConfig.use_macd ?? true}
                    onChange={(v) => setAutoTradeConfig(p => ({ ...p, use_macd: v }))}
                    label="MACD"
                  />
                  <Toggle
                    checked={autoTradeConfig.use_bollinger ?? true}
                    onChange={(v) => setAutoTradeConfig(p => ({ ...p, use_bollinger: v }))}
                    label="Bollinger Bands"
                  />
                  <Toggle
                    checked={autoTradeConfig.use_volume ?? true}
                    onChange={(v) => setAutoTradeConfig(p => ({ ...p, use_volume: v }))}
                    label="Hacim Analizi"
                  />
                </div>
              </div>
            )}

            {/* ── Kontrol Butonları ── */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => triggerAutoTrade('start')}
                disabled={tradeLoading}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-1.5"
              >
                <Zap size={14} /> Başlat
              </button>
              <button
                onClick={() => triggerAutoTrade('runOnce')}
                disabled={tradeLoading}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5"
              >
                <Activity size={14} /> Tek Döngü
              </button>
              <button
                onClick={() => triggerAutoTrade('stop')}
                disabled={tradeLoading}
                className="bg-red-600 hover:bg-red-500 disabled:opacity-50 px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5"
              >
                <XCircle size={14} /> Durdur
              </button>
              <button
                onClick={loadTradingState}
                disabled={tradeLoading}
                className="bg-white/10 hover:bg-white/20 disabled:opacity-50 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center gap-1.5"
              >
                <Clock size={14} /> Yenile
              </button>
            </div>
          </div>

          {/* ── Log & Geçmiş ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 sm:p-5 backdrop-blur-lg">
              <div className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-1.5">
                <FileText size={13} /> Son Auto Trade Logları
              </div>
              <div className="max-h-64 overflow-auto space-y-1.5 text-xs">
                {(autoTradeStatus?.recent_logs || []).slice(0, 15).map((log, idx) => (
                  <div key={`${log.ts}-${idx}`} className="bg-black/20 rounded-lg p-2 border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {log.action === 'BUY' && <TrendingUp size={12} className="text-emerald-400" />}
                      {log.action === 'SELL' && <TrendingDown size={12} className="text-red-400" />}
                      {log.action !== 'BUY' && log.action !== 'SELL' && <Activity size={12} className="text-slate-400" />}
                      <span className="font-bold text-white">{log.symbol}</span>
                      <span className={log.action === 'BUY' ? 'text-emerald-400' : log.action === 'SELL' ? 'text-red-400' : 'text-slate-400'}>
                        {log.action}
                      </span>
                    </div>
                    <span className="text-slate-500 truncate max-w-[150px]">{log.reason}</span>
                  </div>
                ))}
                {!autoTradeStatus?.recent_logs?.length && (
                  <div className="text-center text-slate-500 py-6">Henüz log kaydı yok.</div>
                )}
              </div>
            </div>
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 sm:p-5 backdrop-blur-lg">
              <div className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-1.5">
                <FileText size={13} /> Son Emir Geçmişi
              </div>
              <div className="max-h-64 overflow-auto space-y-1.5 text-xs">
                {orderHistory.slice(0, 15).map((ord) => (
                  <div key={ord.order_id} className="bg-black/20 rounded-lg p-2 border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {ord.side === 'BUY'
                        ? <TrendingUp size={12} className="text-emerald-400" />
                        : <TrendingDown size={12} className="text-red-400" />}
                      <span className="font-bold text-white">{ord.symbol}</span>
                      <span className={ord.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}>{ord.side}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        ord.status === 'filled' ? 'bg-emerald-500/20 text-emerald-400'
                          : ord.status === 'rejected' ? 'bg-red-500/20 text-red-400'
                          : 'bg-slate-500/20 text-slate-400'
                      }`}>{ord.status}</span>
                      <span className="text-slate-500">{ord.mode}</span>
                    </div>
                  </div>
                ))}
                {!orderHistory.length && (
                  <div className="text-center text-slate-500 py-6">Henüz emir geçmişi yok.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradePage;
