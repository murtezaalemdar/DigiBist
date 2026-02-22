import React from 'react';
import { ShieldCheck, Bot, FileText, Activity } from 'lucide-react';

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
}) => {
  return (
    <div className="space-y-8">
      {/* Başlık */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold mb-2 flex items-center gap-3">
          <Activity className="text-emerald-500" size={28} /> İşlem Merkezi
        </h2>
        <p className="text-slate-500 text-sm">
          Manuel emir gönder veya AI destekli otomatik trade başlat.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* ─── Manuel Emir ─── */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 backdrop-blur-lg">
          <h3 className="text-base sm:text-lg font-bold mb-4 sm:mb-5 flex items-center gap-2">
            <ShieldCheck className="text-blue-400" size={18} /> Manuel Emir (AI + Risk Kontrollü)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <input
              className="bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm"
              value={manualOrder.symbol}
              onChange={(e) =>
                setManualOrder((p) => ({ ...p, symbol: e.target.value.toUpperCase() }))
              }
              placeholder="Sembol"
            />
            <select
              className="bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm"
              value={manualOrder.side}
              onChange={(e) => setManualOrder((p) => ({ ...p, side: e.target.value }))}
            >
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              className="bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm"
              value={manualOrder.quantity}
              onChange={(e) =>
                setManualOrder((p) => ({ ...p, quantity: e.target.value }))
              }
              placeholder="Miktar"
            />
            <select
              className="bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm"
              value={manualOrder.mode}
              onChange={(e) => setManualOrder((p) => ({ ...p, mode: e.target.value }))}
            >
              <option value="paper">paper</option>
              <option value="real">real(dry-run)</option>
            </select>
            <button
              onClick={submitManualOrder}
              disabled={tradeLoading}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2 rounded-xl text-sm font-bold transition-colors"
            >
              {tradeLoading ? 'Gönderiliyor...' : 'Emir Gönder'}
            </button>
          </div>
          {tradeResult?.order && (
            <div className="mt-4 text-xs text-slate-300 bg-black/20 border border-white/10 rounded-xl p-3">
              Emir #{tradeResult.order.order_id} · {tradeResult.order.symbol} ·{' '}
              {tradeResult.order.side} · {tradeResult.order.status.toUpperCase()} ·{' '}
              {tradeResult.order.reason}
            </div>
          )}
        </div>

        {/* ─── Otomatik AI Trade ─── */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 backdrop-blur-lg">
          <h3 className="text-base sm:text-lg font-bold mb-4 sm:mb-5 flex items-center gap-2">
            <Bot className="text-emerald-400" size={18} /> Otomatik AI Trade Kontrolü
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <input
              className="sm:col-span-2 md:col-span-3 bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm"
              value={autoTradeConfig.symbols}
              onChange={(e) =>
                setAutoTradeConfig((p) => ({ ...p, symbols: e.target.value }))
              }
              placeholder="Semboller: THYAO,AKBNK,EREGL"
            />
            <select
              className="bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm"
              value={autoTradeConfig.mode}
              onChange={(e) =>
                setAutoTradeConfig((p) => ({ ...p, mode: e.target.value }))
              }
            >
              <option value="paper">paper</option>
              <option value="real">real(dry-run)</option>
            </select>
            <input
              type="number"
              min="0.5"
              max="0.99"
              step="0.01"
              className="bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm"
              value={autoTradeConfig.min_confidence}
              onChange={(e) =>
                setAutoTradeConfig((p) => ({ ...p, min_confidence: e.target.value }))
              }
              placeholder="Min confidence"
            />
            <input
              type="number"
              min="1000"
              step="1000"
              className="bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm"
              value={autoTradeConfig.max_order_size}
              onChange={(e) =>
                setAutoTradeConfig((p) => ({ ...p, max_order_size: e.target.value }))
              }
              placeholder="Maks emir tutarı"
            />
            <input
              type="number"
              min="10"
              step="10"
              className="bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm"
              value={autoTradeConfig.cycle_seconds}
              onChange={(e) =>
                setAutoTradeConfig((p) => ({ ...p, cycle_seconds: e.target.value }))
              }
              placeholder="Döngü sn"
            />
            <input
              type="number"
              min="10000"
              step="1000"
              className="bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm"
              value={autoTradeConfig.portfolio_value}
              onChange={(e) =>
                setAutoTradeConfig((p) => ({ ...p, portfolio_value: e.target.value }))
              }
              placeholder="Portföy değeri"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={() => triggerAutoTrade('start')}
              disabled={tradeLoading}
              className="bg-green-600 hover:bg-green-500 disabled:opacity-50 px-4 py-2 rounded-xl text-sm font-bold transition-colors"
            >
              Start
            </button>
            <button
              onClick={() => triggerAutoTrade('runOnce')}
              disabled={tradeLoading}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2 rounded-xl text-sm font-bold transition-colors"
            >
              Run Once
            </button>
            <button
              onClick={() => triggerAutoTrade('stop')}
              disabled={tradeLoading}
              className="bg-red-600 hover:bg-red-500 disabled:opacity-50 px-4 py-2 rounded-xl text-sm font-bold transition-colors"
            >
              Stop
            </button>
            <button
              onClick={loadTradingState}
              disabled={tradeLoading}
              className="bg-white/10 hover:bg-white/20 disabled:opacity-50 px-4 py-2 rounded-xl text-sm font-bold transition-colors"
            >
              Durum Yenile
            </button>
            <span
              className={`text-xs font-bold px-2 py-1 rounded-lg ${
                autoTradeStatus?.enabled
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-slate-600/20 text-slate-300'
              }`}
            >
              {autoTradeStatus?.enabled ? 'AUTO TRADE AKTİF' : 'AUTO TRADE PASİF'}
            </span>
          </div>

          {/* Log & Geçmiş */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-black/20 border border-white/10 rounded-xl p-4">
              <div className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                <FileText size={12} /> Son Auto Trade Logları
              </div>
              <div className="max-h-48 overflow-auto space-y-1 text-xs text-slate-300">
                {(autoTradeStatus?.recent_logs || []).slice(0, 10).map((log, idx) => (
                  <div key={`${log.ts}-${idx}`} className="border-b border-white/5 pb-1">
                    {log.symbol} · {log.action} · {log.reason}
                  </div>
                ))}
                {!autoTradeStatus?.recent_logs?.length && (
                  <div className="text-slate-500">Log yok.</div>
                )}
              </div>
            </div>
            <div className="bg-black/20 border border-white/10 rounded-xl p-4">
              <div className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                <FileText size={12} /> Son Emir Geçmişi
              </div>
              <div className="max-h-48 overflow-auto space-y-1 text-xs text-slate-300">
                {orderHistory.slice(0, 10).map((ord) => (
                  <div key={ord.order_id} className="border-b border-white/5 pb-1">
                    {ord.symbol} · {ord.side} · {ord.status} · {ord.mode}
                  </div>
                ))}
                {!orderHistory.length && <div className="text-slate-500">Emir yok.</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradePage;
