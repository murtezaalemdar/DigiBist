import React from 'react';
import {
  BrainCircuit,
  Settings,
  Activity,
  Zap,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { API_BASE, ADMIN_API_BASE, WS_BASE } from '../config';

const SettingsPage = ({
  wsConnected,
  stocks,
  livePrices,
  favorites,
  tickerSpeed,
  setTickerSpeed,
}) => {
  const speedLabels = { 15: 'Çok Yavaş', 40: 'Yavaş', 80: 'Normal', 120: 'Orta-Hızlı', 200: 'Hızlı', 400: 'Çok Hızlı', 600: 'Ultra' };
  const currentLabel = speedLabels[tickerSpeed] || `${tickerSpeed} px/sn`;
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold mb-2 flex items-center gap-3">
          <Settings className="text-blue-500" size={28} /> Ayarlar
        </h2>
        <p className="text-slate-500 text-sm">
          Uygulama yapılandırması ve bağlantı bilgileri.
        </p>
      </div>

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

        {/* Cache Bilgisi */}
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
              <span className="text-sm text-slate-400">Cache TTL</span>
              <span className="font-bold">3600s (1 saat)</span>
            </div>
          </div>
        </div>

        {/* Versiyon */}
        <div className="md:col-span-2 bg-gradient-to-br from-blue-600/10 to-indigo-600/10 border border-blue-500/20 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-2xl">
                <BrainCircuit className="text-white" size={28} />
              </div>
              <div>
                <h3 className="font-bold text-lg">BIST AI Engine</h3>
                <p className="text-sm text-slate-400">
                  v8.0 — RandomForest + Risk Engine + WebSocket + Telegram
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
