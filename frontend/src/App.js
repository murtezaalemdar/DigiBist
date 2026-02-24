import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BrainCircuit, ShieldX } from 'lucide-react';

import { API_BASE, ADMIN_API_BASE, APP_VERSION_FULL } from './config';
import useWebSocket from './hooks/useWebSocket';
import { AuthProvider, useAuth } from './hooks/useAuth';
import LiveTicker from './components/LiveTicker';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import PortfolioPage from './pages/PortfolioPage';
import ModelsPage from './pages/ModelsPage';
import SettingsPage from './pages/SettingsPage';
import TradePage from './pages/TradePage';
import DashboardPage from './pages/DashboardPage';
import UserManagementPage from './pages/UserManagementPage';

/* ─── Erişim Engeli Bileşeni ─── */
const AccessDenied = ({ pageName }) => (
  <div className="flex flex-col items-center justify-center py-32 text-center">
    <div className="bg-red-500/10 p-4 rounded-2xl mb-4">
      <ShieldX size={48} className="text-red-400" />
    </div>
    <h2 className="text-xl font-bold text-white mb-2">Erişim Engellendi</h2>
    <p className="text-sm text-slate-500 max-w-sm">
      <strong className="text-slate-400">{pageName}</strong> sayfasına erişim izniniz bulunmuyor.
      Yöneticinizden gerekli izinleri talep edin.
    </p>
  </div>
);

/* ─── Sayfa → İzin Eşleştirmesi ─── */
const PAGE_PERMISSIONS = {
  dashboard: 'dashboard.view',
  portfolio: 'portfolio.view',
  models: 'models.view',
  settings: 'settings.view',
  trade: 'trade.view',
  users: 'users.view',
};

const PAGE_NAMES = {
  dashboard: 'Dashboard',
  portfolio: 'Portföy',
  models: 'ML Modelleri',
  settings: 'Ayarlar',
  trade: 'İşlem',
  users: 'Kullanıcı Yönetimi',
};

/* ─── Ana Uygulama ─── */
const AppContent = () => {
  const { hasPermission, user } = useAuth();
  const [stocks, setStocks] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activePage, setActivePage] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bist_favorites') || '[]'); } catch { return []; }
  });
  const [manualOrder, setManualOrder] = useState({
    symbol: '', side: 'BUY', quantity: 10, mode: 'paper',
    order_type: 'market', strategy_type: 'manual',
    trigger_price: null, stop_price: null, take_profit_price: null,
    trailing_stop_pct: null, portfolio_value: 250000, notes: '',
  });
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeResult, setTradeResult] = useState(null);
  const [autoTradeStatus, setAutoTradeStatus] = useState({ enabled: false, config: {}, recent_logs: [] });
  const [autoTradeConfig, setAutoTradeConfig] = useState({
    symbols: 'THYAO,AKBNK,EREGL',
    mode: 'paper',
    min_confidence: 0.75,
    max_order_size: 20000,
    cycle_seconds: 60,
    portfolio_value: 250000,
    strategy_type: 'ai_only',
    rsi_oversold: 30,
    rsi_overbought: 70,
    use_macd: true,
    use_bollinger: true,
    use_volume: true,
    auto_stop_loss_pct: 3.0,
    auto_take_profit_pct: 5.0,
  });
  const [orderHistory, setOrderHistory] = useState([]);
  const [tickerSpeed, setTickerSpeed] = useState(() => {
    try { return Number(localStorage.getItem('bist_ticker_speed')) || 120; } catch { return 120; }
  });

  // Broker state
  const [brokerStatus, setBrokerStatus] = useState({
    connected: false,
    broker_type: 'paper',
    broker_name: 'Paper Trading',
    exchange: 'BIST',
    active_exchange: 'BIST',
  });

  // WebSocket hook
  const { livePrices, wsConnected, priceProvider, lastPriceUpdate, updateInterval } = useWebSocket();

  // Favorileri localStorage'a kaydet
  useEffect(() => { localStorage.setItem('bist_favorites', JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => { localStorage.setItem('bist_ticker_speed', String(tickerSpeed)); }, [tickerSpeed]);

  useEffect(() => {
    if (selectedSymbol) setManualOrder(prev => ({ ...prev, symbol: selectedSymbol }));
  }, [selectedSymbol]);

  const toggleFavorite = (symbol) => {
    setFavorites(prev => prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]);
  };

  // Arama filtresi
  const filteredStocks = useMemo(() => {
    if (!searchQuery.trim()) return stocks;
    const q = searchQuery.toLowerCase();
    return stocks.filter(s => s.symbol.toLowerCase().includes(q) || (s.name && s.name.toLowerCase().includes(q)));
  }, [stocks, searchQuery]);

  // ─── Hisse listesi (FastAPI Backend) ───
  useEffect(() => {
    fetch(`${API_BASE}/api/stocks`)
      .then(res => res.json())
      .then(d => {
        setStocks(d);
        if (d.length > 0) setSelectedSymbol(d[0].symbol);
      })
      .catch(err => console.error('Hisse listesi yüklenemedi:', err));
  }, []);

  // ─── AI Tahmin Çekme (retry + hata yönetimi) ───
  const fetchForecast = useCallback((symbol, retryCount = 0) => {
    if (!symbol) return;
    setLoading(true);
    fetch(`${API_BASE}/api/ai-forecast/${symbol}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(d => {
        if (d.error) {
          // Backend hata döndü — retry (max 2 kez)
          console.warn(`Tahmin hatası (${symbol}): ${d.error}, deneme ${retryCount + 1}`);
          if (retryCount < 2) {
            setTimeout(() => fetchForecast(symbol, retryCount + 1), 3000 * (retryCount + 1));
          } else {
            setData({ error: d.error, symbol });
            setLoading(false);
            setIsRefreshing(false);
          }
        } else {
          setData(d);
          setLoading(false);
          setIsRefreshing(false);
        }
      })
      .catch(err => {
        console.error('Tahmin çekme hatası:', err);
        if (retryCount < 2) {
          setTimeout(() => fetchForecast(symbol, retryCount + 1), 3000 * (retryCount + 1));
        } else {
          setData({ error: 'Sunucuya bağlanılamadı', symbol });
          setLoading(false);
          setIsRefreshing(false);
        }
      });
  }, []);

  const loadTradingState = useCallback(() => {
    fetch(`${API_BASE}/api/auto-trade/status`)
      .then(res => res.json())
      .then(d => setAutoTradeStatus(d || { enabled: false, config: {}, recent_logs: [] }))
      .catch(() => { });

    fetch(`${API_BASE}/api/order/history?limit=20`)
      .then(res => res.json())
      .then(d => setOrderHistory(d.orders || []))
      .catch(() => { });

    fetch(`${API_BASE}/api/broker/status`)
      .then(res => res.json())
      .then(d => setBrokerStatus(d))
      .catch(() => { });
  }, []);

  useEffect(() => {
    if (activePage === 'settings' || activePage === 'trade') loadTradingState();
  }, [activePage, loadTradingState]);

  const submitManualOrder = () => {
    if (!manualOrder.symbol || !manualOrder.quantity) return;
    setTradeLoading(true);
    setTradeResult(null);

    fetch(`${API_BASE}/api/order/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: manualOrder.symbol,
        side: manualOrder.side,
        quantity: Number(manualOrder.quantity),
        mode: manualOrder.mode,
        portfolio_value: Number(manualOrder.portfolio_value || 250000),
        order_type: manualOrder.order_type || 'market',
        strategy_type: manualOrder.strategy_type || 'manual',
        trigger_price: manualOrder.trigger_price || null,
        stop_price: manualOrder.stop_price || null,
        take_profit_price: manualOrder.take_profit_price || null,
        trailing_stop_pct: manualOrder.trailing_stop_pct || null,
        notes: manualOrder.notes || '',
      }),
    })
      .then(res => res.json())
      .then(d => { setTradeResult(d); loadTradingState(); })
      .catch(() => setTradeResult({ status: 'error', reason: 'Emir gönderilemedi' }))
      .finally(() => setTradeLoading(false));
  };

  const triggerAutoTrade = (action) => {
    setTradeLoading(true);
    const symbols = autoTradeConfig.symbols.split(',').map(x => x.trim().toUpperCase()).filter(Boolean);

    const body = {
      symbols,
      mode: autoTradeConfig.mode,
      min_confidence: Number(autoTradeConfig.min_confidence),
      max_order_size: Number(autoTradeConfig.max_order_size),
      cycle_seconds: Number(autoTradeConfig.cycle_seconds),
      portfolio_value: Number(autoTradeConfig.portfolio_value),
      strategy_type: autoTradeConfig.strategy_type || 'ai_only',
      rsi_oversold: Number(autoTradeConfig.rsi_oversold ?? 30),
      rsi_overbought: Number(autoTradeConfig.rsi_overbought ?? 70),
      use_macd: autoTradeConfig.use_macd ?? true,
      use_bollinger: autoTradeConfig.use_bollinger ?? true,
      use_volume: autoTradeConfig.use_volume ?? true,
      auto_stop_loss_pct: Number(autoTradeConfig.auto_stop_loss_pct ?? 3.0),
      auto_take_profit_pct: Number(autoTradeConfig.auto_take_profit_pct ?? 5.0),
    };

    const endpoint = action === 'start'
      ? '/api/auto-trade/start'
      : action === 'stop'
        ? '/api/auto-trade/stop'
        : '/api/auto-trade/run-once';

    fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: action === 'stop' ? undefined : JSON.stringify(body),
    })
      .then(res => res.json())
      .then(d => { setTradeResult(d); loadTradingState(); })
      .catch(() => setTradeResult({ status: 'error', reason: 'Auto trade işlemi başarısız' }))
      .finally(() => setTradeLoading(false));
  };

  useEffect(() => { fetchForecast(selectedSymbol); }, [selectedSymbol, fetchForecast]);

  const handleRefresh = (forceRefresh = false) => {
    setIsRefreshing(true);
    if (forceRefresh) {
      // Cache'i atla, yeniden analiz yap
      setLoading(true);
      fetch(`${API_BASE}/api/ai-forecast/${selectedSymbol}?force=true`)
        .then(res => res.json())
        .then(d => { setData(d); setLoading(false); setIsRefreshing(false); })
        .catch(() => { setLoading(false); setIsRefreshing(false); });
    } else {
      fetchForecast(selectedSymbol);
    }
  };

  // Aktif hisse için canlı fiyat
  const livePrice = livePrices[selectedSymbol];
  const displayPrice = (livePrice?.price > 0 ? livePrice.price : data?.current_price) ?? null;

  return (
      <div className="min-h-screen bg-[#070b14] text-slate-200 font-sans selection:bg-blue-500/30">
        {/* Arka plan efektleri */}
        <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full" />
        </div>

        {/* NAV */}
        <Navbar
          activePage={activePage}
          setActivePage={setActivePage}
          wsConnected={wsConnected}
          priceProvider={priceProvider}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />

        {/* CANLI TICKER */}
        <LiveTicker
          prices={livePrices}
          isConnected={wsConnected}
          speed={tickerSpeed}
          onSymbolClick={(sym) => {
            setSelectedSymbol(sym);
            setActivePage('dashboard');
          }}
        />

        <main className="w-full px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">

            {/* Sidebar — sadece dashboard'da */}
            {activePage === 'dashboard' && (
              <Sidebar
                stocks={filteredStocks}
                livePrices={livePrices}
                selectedSymbol={selectedSymbol}
                setSelectedSymbol={setSelectedSymbol}
                setActivePage={setActivePage}
                searchQuery={searchQuery}
                favorites={favorites}
                toggleFavorite={toggleFavorite}
              />
            )}

            {/* ANA İÇERİK */}
            <div className={activePage === 'dashboard' ? 'lg:col-span-9 order-1 lg:order-2' : 'lg:col-span-12 order-1'}>

              {activePage === 'portfolio' && (
                user && !hasPermission('portfolio.view') ? <AccessDenied pageName={PAGE_NAMES.portfolio} /> :
                <PortfolioPage
                  stocks={stocks}
                  livePrices={livePrices}
                  favorites={favorites}
                  toggleFavorite={toggleFavorite}
                  setSelectedSymbol={setSelectedSymbol}
                  setActivePage={setActivePage}
                />
              )}

              {activePage === 'models' && (
                user && !hasPermission('models.view') ? <AccessDenied pageName={PAGE_NAMES.models} /> :
                <ModelsPage wsConnected={wsConnected} livePrices={livePrices} />
              )}

              {activePage === 'settings' && (
                user && !hasPermission('settings.view') ? <AccessDenied pageName={PAGE_NAMES.settings} /> :
                <SettingsPage
                  wsConnected={wsConnected}
                  stocks={stocks}
                  livePrices={livePrices}
                  favorites={favorites}
                  tickerSpeed={tickerSpeed}
                  setTickerSpeed={setTickerSpeed}
                  brokerStatus={brokerStatus}
                  setBrokerStatus={setBrokerStatus}
                />
              )}

              {activePage === 'trade' && (
                user && !hasPermission('trade.view') ? <AccessDenied pageName={PAGE_NAMES.trade} /> :
                <TradePage
                  manualOrder={manualOrder}
                  setManualOrder={setManualOrder}
                  submitManualOrder={submitManualOrder}
                  autoTradeConfig={autoTradeConfig}
                  setAutoTradeConfig={setAutoTradeConfig}
                  triggerAutoTrade={triggerAutoTrade}
                  autoTradeStatus={autoTradeStatus}
                  orderHistory={orderHistory}
                  tradeLoading={tradeLoading}
                  tradeResult={tradeResult}
                  loadTradingState={loadTradingState}
                  stocks={stocks}
                  livePrices={livePrices}
                  brokerStatus={brokerStatus}
                  setActivePage={setActivePage}
                />
              )}

              {activePage === 'users' && (
                user && !hasPermission('users.view') ? <AccessDenied pageName={PAGE_NAMES.users} /> :
                <UserManagementPage />
              )}

              {activePage === 'dashboard' && (
                user && !hasPermission('dashboard.view') ? <AccessDenied pageName={PAGE_NAMES.dashboard} /> :
                <DashboardPage
                  selectedSymbol={selectedSymbol}
                  stocks={stocks}
                  data={data}
                  loading={loading}
                  isRefreshing={isRefreshing}
                  handleRefresh={handleRefresh}
                  displayPrice={displayPrice}
                  wsConnected={wsConnected}
                  livePrice={livePrice}
                  priceProvider={priceProvider}
                  lastPriceUpdate={lastPriceUpdate}
                  updateInterval={updateInterval}
                />
              )}
            </div>
          </div>
        </main>

        <footer className="border-t border-white/5 mt-10 sm:mt-20 py-8 sm:py-12">
          <div className="w-full px-3 sm:px-4 lg:px-6 xl:px-8 flex flex-col items-center gap-5">
            {/* İmza */}
            <div className="flex flex-col items-center gap-2">
              <p className="text-slate-600 text-[10px] uppercase tracking-[0.3em] font-medium">
                Designed by
              </p>
              <p className="text-slate-400 text-sm sm:text-base font-bold tracking-[0.2em] uppercase">
                Murteza Alemdar
              </p>
            </div>
            {/* Versiyon */}
            <div className="px-4 py-1.5 rounded-full border border-white/10 bg-white/[0.02]">
              <span className="text-slate-500 text-[11px] font-mono font-bold tracking-wider">{APP_VERSION_FULL}</span>
            </div>
            {/* Alt bilgi */}
            <div className="flex flex-col sm:flex-row items-center gap-3 text-slate-700 text-[9px] uppercase tracking-widest">
              <div className="flex items-center gap-1.5 opacity-50">
                <BrainCircuit size={14} />
                <span>Powered by NextGen ML Engine</span>
              </div>
              <span className="hidden sm:inline">•</span>
              <span>© 2026 BIST AI Analytics</span>
            </div>
          </div>
        </footer>
      </div>
  );
};

const App = () => (
  <AuthProvider>
    <AppContent />
  </AuthProvider>
);

export default App;
