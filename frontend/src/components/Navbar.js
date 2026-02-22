import React, { useState, useEffect, useRef } from 'react';
import {
  BrainCircuit,
  LayoutDashboard,
  Briefcase,
  Cpu,
  Activity,
  Settings,
  Wifi,
  WifiOff,
  Search,
  X,
  LogIn,
  LogOut,
  User,
  Users,
  Menu,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const Navbar = ({ activePage, setActivePage, searchQuery, setSearchQuery, wsConnected }) => {
  const { user, logout, login, hasPermission } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [loginUsername, setLoginUsername] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('password');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef(null);

  // Mobil menüyü dışarı tıklanınca kapat
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target)) {
        setMobileMenuOpen(false);
      }
    };
    if (mobileMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileMenuOpen]);

  // İzinlere göre görünür tab'lar
  const allTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, perm: 'dashboard.view' },
    { id: 'portfolio', label: 'Portföy', icon: Briefcase, perm: 'portfolio.view' },
    { id: 'models', label: 'ML Modelleri', icon: Cpu, perm: 'models.view' },
    { id: 'settings', label: 'Ayarlar', icon: Settings, perm: 'settings.view' },
    { id: 'trade', label: 'İşlem', icon: Activity, perm: 'trade.view' },
    { id: 'users', label: 'Kullanıcılar', icon: Users, perm: 'users.view' },
  ];

  const tabs = user
    ? allTabs.filter((t) => hasPermission(t.perm))
    : allTabs;

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      await login(loginUsername, loginPassword);
      setShowLogin(false);
    } catch (err) {
      setLoginError(err.message || 'Giriş başarısız');
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <nav className="border-b border-white/5 bg-black/20 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-1.5 sm:p-2 rounded-lg sm:rounded-xl shadow-lg shadow-blue-500/20">
            <BrainCircuit size={20} className="text-white sm:hidden" />
            <BrainCircuit size={24} className="text-white hidden sm:block" />
          </div>
          <span className="text-lg sm:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            BIST AI <span className="text-blue-500 font-medium text-xs sm:text-sm ml-1">V8.0</span>
          </span>
        </div>

        {/* Desktop Tabs */}
        <div className="hidden lg:flex items-center gap-6 xl:gap-8 text-sm font-medium text-slate-400">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActivePage(tab.id)}
              className={`flex items-center gap-1.5 pb-1 transition-all duration-200 whitespace-nowrap ${
                activePage === tab.id
                  ? 'text-blue-400 border-b-2 border-blue-400/50'
                  : 'hover:text-white border-b-2 border-transparent'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* WS Status — desktop only */}
          <div
            className={`hidden md:flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full border ${
              wsConnected
                ? 'border-green-500/30 text-green-400 bg-green-500/10'
                : 'border-slate-700 text-slate-500 bg-white/5'
            }`}
          >
            {wsConnected ? <Wifi size={12} className="animate-pulse" /> : <WifiOff size={12} />}
            {wsConnected ? 'CANLI' : 'BAĞLANILIYOR'}
          </div>

          {/* WS indicator — mobile only (dot) */}
          <div className={`md:hidden w-2 h-2 rounded-full ${wsConnected ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`} title={wsConnected ? 'Bağlı' : 'Bağlanıyor'} />

          {/* Search */}
          <div className="relative group hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Sembol ara..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (activePage !== 'dashboard') setActivePage('dashboard');
              }}
              className="bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-36 md:w-48"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Auth Button */}
          {user ? (
            <div className="flex items-center gap-2">
              <span className="hidden md:inline text-xs text-slate-400">
                <User size={12} className="inline mr-1" />
                {user.name}
              </span>
              <button
                onClick={logout}
                className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                title="Çıkış"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowLogin(!showLogin)}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-400 border border-white/10 px-3 py-1.5 rounded-full transition-colors"
              >
                <LogIn size={12} /> <span className="hidden sm:inline">Giriş</span>
              </button>
              {showLogin && (
                <form
                  onSubmit={handleLogin}
                  className="absolute right-0 top-full mt-2 bg-slate-900 border border-white/10 rounded-2xl p-4 w-64 shadow-2xl z-50"
                >
                  <input
                    type="text"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="Kullanıcı adı"
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm mb-2"
                  />
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Şifre"
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm mb-2"
                  />
                  {loginError && <p className="text-red-400 text-xs mb-2">{loginError}</p>}
                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2 rounded-xl text-sm font-bold"
                  >
                    {loginLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Hamburger Menu — mobile/tablet only */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            aria-label="Menü"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div
          ref={mobileMenuRef}
          className="lg:hidden border-t border-white/5 bg-[#0d1117]/95 backdrop-blur-lg"
        >
          {/* Mobile Search */}
          <div className="px-4 pt-3 sm:hidden">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type="text"
                placeholder="Sembol ara..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (activePage !== 'dashboard') setActivePage('dashboard');
                }}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Mobile Tabs */}
          <div className="grid grid-cols-2 gap-1 p-3">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActivePage(tab.id);
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  activePage === tab.id
                    ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Mobile WS Status */}
          <div className="px-4 pb-3 md:hidden">
            <div
              className={`flex items-center justify-center gap-2 text-xs font-bold py-2 rounded-xl border ${
                wsConnected
                  ? 'border-green-500/20 text-green-400 bg-green-500/5'
                  : 'border-slate-700 text-slate-500 bg-white/5'
              }`}
            >
              {wsConnected ? <Wifi size={12} className="animate-pulse" /> : <WifiOff size={12} />}
              {wsConnected ? 'CANLI BAĞLANTI' : 'BAĞLANILIYOR...'}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
