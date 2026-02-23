import React, { useState } from 'react';
import { Activity, Zap, BrainCircuit, Star, Filter } from 'lucide-react';

/** Sol kenar takip listesi + premium kartı */
const Sidebar = ({
  stocks = [],
  livePrices = {},
  selectedSymbol,
  setSelectedSymbol,
  searchQuery,
  favorites = [],
  toggleFavorite,
}) => {
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  const displayStocks = showOnlyFavorites
    ? stocks.filter((s) => favorites.includes(s.symbol))
    : stocks;

  return (
    <div className="lg:col-span-3 order-2 lg:order-1">
      <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-4 xl:p-6 backdrop-blur-lg lg:sticky lg:top-20">
        {/* Başlık + Filtre */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <Activity size={16} /> Takip Listesi
          </h3>
          <div className="flex items-center gap-2">
            {searchQuery && (
              <span className="text-blue-400 text-[10px]">{displayStocks.length} sonuç</span>
            )}
            <button
              onClick={() => setShowOnlyFavorites((p) => !p)}
              title={showOnlyFavorites ? 'Tümünü göster' : 'Sadece favoriler'}
              className={`p-1.5 rounded-lg transition-all text-xs ${
                showOnlyFavorites
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  : 'bg-white/5 text-slate-500 border border-white/10 hover:text-white'
              }`}
            >
              {showOnlyFavorites ? <Star size={12} fill="currentColor" /> : <Filter size={12} />}
            </button>
          </div>
        </div>

        {/* Filtre sekmeleri */}
        <div className="flex gap-1 mb-3">
          <button
            onClick={() => setShowOnlyFavorites(false)}
            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${
              !showOnlyFavorites
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Tümü ({stocks.length})
          </button>
          <button
            onClick={() => setShowOnlyFavorites(true)}
            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
              showOnlyFavorites
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Star size={9} fill={showOnlyFavorites ? 'currentColor' : 'none'} />
            Favoriler ({favorites.length})
          </button>
        </div>

        {/* Hisse listesi */}
        <div className="space-y-2 max-h-[60vh] xl:max-h-[70vh] overflow-y-auto pr-1 scrollbar-hide">
          {displayStocks.length === 0 && (
            <div className="text-center py-8 text-slate-600">
              <Star size={24} className="mx-auto mb-2 opacity-30" />
              <p className="text-xs">Favori hisse yok. Yıldıza tıklayarak ekleyin.</p>
            </div>
          )}
          {displayStocks.map((stock) => {
            const live = livePrices[stock.symbol];
            const price = live?.price > 0 ? live.price : (parseFloat(stock.current_price) || 0);
            const change = live?.change || parseFloat(stock.change_percent) || 0;
            const isFav = favorites.includes(stock.symbol);
            return (
              <div
                key={stock.symbol}
                className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all duration-300 group ${
                  selectedSymbol === stock.symbol
                    ? 'bg-blue-500/10 border border-blue-500/30 text-white translate-x-1'
                    : 'hover:bg-white/5 border border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {/* Favori yıldız */}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFavorite(stock.symbol); }}
                  className={`shrink-0 mr-2 transition-all ${
                    isFav ? 'text-yellow-400 hover:text-yellow-300' : 'text-slate-700 hover:text-yellow-400'
                  }`}
                  title={isFav ? 'Favorilerden çıkar' : 'Favorilere ekle'}
                >
                  <Star size={14} fill={isFav ? 'currentColor' : 'none'} />
                </button>

                {/* Hisse bilgisi — tıklanınca seçer */}
                <button
                  onClick={() => setSelectedSymbol(stock.symbol)}
                  className="flex-1 flex items-center justify-between text-left"
                >
                  <div>
                    <div className="font-bold flex items-center gap-2">
                      {stock.symbol}
                      {selectedSymbol === stock.symbol && (
                        <Zap size={12} className="text-blue-500 animate-pulse" />
                      )}
                    </div>
                    <div className="text-[10px] opacity-60">{stock.name}</div>
                  </div>
                  {price > 0 && (
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-white">₺{price.toFixed(2)}</div>
                      {change !== 0 && (
                        <div className={`text-[9px] font-black ${change > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {change > 0 ? '+' : ''}{change.toFixed(2)}%
                        </div>
                      )}
                      {live?.signal && live.signal !== '—' && (
                        <div
                          className={`text-[9px] font-black ${
                            live.signal === 'BUY'
                              ? 'text-green-400'
                              : live.signal === 'SELL'
                              ? 'text-red-400'
                              : 'text-yellow-400'
                          }`}
                        >
                          {live.signal}
                        </div>
                      )}
                    </div>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};

export default Sidebar;
