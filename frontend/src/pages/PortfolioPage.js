import React from 'react';
import {
  Briefcase,
  Star,
  StarOff,
  BarChart3,
} from 'lucide-react';

const PortfolioPage = ({ stocks, livePrices, favorites, toggleFavorite, setSelectedSymbol, setActivePage }) => {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold mb-2 flex items-center gap-3">
          <Briefcase className="text-blue-500" size={28} /> Portföy Yönetimi
        </h2>
        <p className="text-slate-500 text-sm">
          Favori hisselerinizi takip edin ve portföy performansınızı izleyin.
        </p>
      </div>

      {/* Favori Hisseler */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 backdrop-blur-lg">
        <h3 className="text-base sm:text-lg font-bold mb-4 sm:mb-6 flex items-center gap-2">
          <Star className="text-yellow-400" size={20} /> Favori Hisselerim
        </h3>
        {favorites.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <StarOff size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-sm">Henüz favori hisse eklemediniz.</p>
            <p className="text-xs mt-1">Aşağıdaki listeden ⭐ ikonuna tıklayarak favori ekleyin.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {favorites.map((sym) => {
              const stock = stocks.find((s) => s.symbol === sym);
              const live = livePrices[sym];
              return (
                <div
                  key={sym}
                  className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 hover:border-blue-500/30 transition-all group cursor-pointer"
                  onClick={() => {
                    setSelectedSymbol(sym);
                    setActivePage('dashboard');
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-lg">{sym}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(sym);
                      }}
                      className="text-yellow-400 hover:text-yellow-300"
                    >
                      <Star size={16} fill="currentColor" />
                    </button>
                  </div>
                  <div className="text-xs text-slate-500 mb-2">{stock?.name || sym}</div>
                  {(() => {
                    const price = live?.price > 0 ? live.price : (parseFloat(stock?.current_price) || 0);
                    const change = live?.change || parseFloat(stock?.change_percent) || 0;
                    return price > 0 ? (
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xl font-mono font-bold">₺{price.toFixed(2)}</span>
                          {change !== 0 && (
                            <span className={`ml-2 text-xs font-bold ${change > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {change > 0 ? '+' : ''}{change.toFixed(2)}%
                            </span>
                          )}
                        </div>
                        {live?.signal && live.signal !== '—' && (
                        <span
                          className={`text-xs font-bold px-2 py-1 rounded-lg ${
                            live.signal === 'BUY'
                              ? 'bg-green-500/20 text-green-400'
                              : live.signal === 'SELL'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}
                        >
                          {live.signal}
                        </span>
                      )}
                      </div>
                    ) : null;
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tüm Hisseler Tablosu */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 backdrop-blur-lg">
        <h3 className="text-base sm:text-lg font-bold mb-4 sm:mb-6 flex items-center gap-2">
          <BarChart3 className="text-blue-400" size={20} /> Tüm Hisseler
        </h3>

        {/* Mobil Card View */}
        <div className="md:hidden space-y-3">
          {stocks.map((stock) => {
            const live = livePrices[stock.symbol];
            const price = live?.price > 0 ? live.price : (parseFloat(stock.current_price) || 0);
            const change = live?.change || parseFloat(stock.change_percent) || 0;
            return (
              <div
                key={stock.symbol}
                className="bg-white/[0.02] border border-white/10 rounded-xl p-4 cursor-pointer hover:bg-white/[0.05] transition-colors"
                onClick={() => {
                  setSelectedSymbol(stock.symbol);
                  setActivePage('dashboard');
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{stock.symbol}</span>
                    {live?.signal && live.signal !== '—' && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg ${
                        live.signal === 'BUY' ? 'bg-green-500/20 text-green-400'
                        : live.signal === 'SELL' ? 'bg-red-500/20 text-red-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                      }`}>{live.signal}</span>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(stock.symbol); }}
                    className={favorites.includes(stock.symbol) ? 'text-yellow-400' : 'text-slate-600 hover:text-yellow-400'}
                  >
                    <Star size={14} fill={favorites.includes(stock.symbol) ? 'currentColor' : 'none'} />
                  </button>
                </div>
                <div className="text-xs text-slate-500 mb-2">{stock.name}</div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-mono font-bold">{price > 0 ? `₺${price.toFixed(2)}` : '—'}</span>
                  {change !== 0 && (
                    <span className={`text-xs font-bold ${change > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {change > 0 ? '+' : ''}{change.toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop Tablo */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs uppercase border-b border-white/5">
                <th className="text-left py-3 px-2">Sembol</th>
                <th className="text-left py-3 px-2">İsim</th>
                <th className="text-left py-3 px-2">Sektör</th>
                <th className="text-right py-3 px-2">Fiyat</th>
                <th className="text-right py-3 px-2">Değişim</th>
                <th className="text-right py-3 px-2">Sinyal</th>
                <th className="text-center py-3 px-2">Favori</th>
              </tr>
            </thead>
            <tbody>
              {stocks.map((stock) => {
                const live = livePrices[stock.symbol];
                const price = live?.price > 0 ? live.price : (parseFloat(stock.current_price) || 0);
                const change = live?.change || parseFloat(stock.change_percent) || 0;
                return (
                  <tr
                    key={stock.symbol}
                    className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer transition-colors"
                    onClick={() => {
                      setSelectedSymbol(stock.symbol);
                      setActivePage('dashboard');
                    }}
                  >
                    <td className="py-3 px-2 font-bold">{stock.symbol}</td>
                    <td className="py-3 px-2 text-slate-400">{stock.name}</td>
                    <td className="py-3 px-2 text-slate-500 text-xs">{stock.sector || '—'}</td>
                    <td className="py-3 px-2 text-right font-mono font-bold">
                      {price > 0 ? `₺${price.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-3 px-2 text-right">
                      {change !== 0 ? (
                        <span className={`text-xs font-bold ${change > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {change > 0 ? '+' : ''}{change.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-right">
                      {live?.signal && live.signal !== '—' ? (
                        <span
                          className={`text-xs font-bold px-2 py-1 rounded-lg ${
                            live.signal === 'BUY'
                              ? 'bg-green-500/20 text-green-400'
                              : live.signal === 'SELL'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}
                        >
                          {live.signal}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(stock.symbol);
                        }}
                        className={
                          favorites.includes(stock.symbol)
                            ? 'text-yellow-400'
                            : 'text-slate-600 hover:text-yellow-400'
                        }
                      >
                        <Star
                          size={14}
                          fill={favorites.includes(stock.symbol) ? 'currentColor' : 'none'}
                        />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PortfolioPage;
