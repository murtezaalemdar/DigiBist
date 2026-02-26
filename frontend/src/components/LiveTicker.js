import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

/**
 * LiveTicker — Kayan Canlı Fiyat Şeridi (v8.09)
 * ═══════════════════════════════════════════════
 *
 * Sayfanın üst kısmında (Navbar altında) sürekli sola kayan marquee tarzı
 * canlı hisse fiyat şeridi. Sticky header wrapper içinde Navbar ile birlikte
 * sabitlenir (z-50).
 *
 * @param {Object}   prices       — Canlı fiyat nesnesi {THYAO: {price, change, signal}, ...}
 * @param {boolean}  isConnected  — WebSocket bağlantı durumu (yeşil/gri ikon)
 * @param {number}   speed        — Kayma hızı (piksel/saniye, varsayılan 120)
 * @param {Function} onSymbolClick — Sembol tıklama callback'i (hisse analizini açar)
 *
 * Kayan Animasyon Mekanizması:
 * - CSS @keyframes ticker-scroll: translateX(0) → translateX(-50%)
 * - entries dizisi 2x render edilir (orijinal + _dup): kesintisiz döngü efekti
 * - duration: scrollWidth / 2 / speed (içerik genişliğine göre otomatik hesap)
 * - Mouse hover: animasyonPlayState='paused' → kullanıcı fiyatı okuyabilir
 *
 * Bağlantı Durumu:
 * - Wifi + "CANLI" (yeşil, animate-pulse): WebSocket aktif
 * - WifiOff + "BAĞLANTI YOK" (gri): WebSocket kopuk
 *
 * Sinyal Gösterimi:
 * - BUY: yeşil ring + yeşil arka plan + animate-pulse badge
 * - SELL: kırmızı ring + kırmızı arka plan + animate-pulse badge
 * - HOLD: sarı badge (pulse yok)
 * - XU100 filtrelenir (Navbar'da ayrıca gösterilir)
 *
 * Changelog:
 * - v8.09.01: JSDoc header eklendi (Sprint 3)
 * - v8.06.00: XU100 filtreleme, onSymbolClick entegrasyonu
 * - v8.05.00: İlk LiveTicker implementasyonu
 */
const LiveTicker = ({ prices, isConnected, speed = 120, onSymbolClick }) => {
  const entries = Object.entries(prices).filter(([sym]) => sym !== 'XU100');
  const trackRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const [duration, setDuration] = useState(60);

  /* İçerik genişliğine göre hız ayarla — her fiyat güncellemesinde */
  const recalc = useCallback(() => {
    if (!trackRef.current) return;
    const w = trackRef.current.scrollWidth / 2;
    setDuration(Math.max(5, w / speed));
  }, [speed]);

  useEffect(() => { recalc(); }, [entries.length, recalc]);

  if (!entries.length) return null;

  /* Gerçek sembol adını al (_dup son ekini kaldır) */
  const realSymbol = (sym) => sym.replace(/_dup$/, '');

  /* Tıklanabilirlik: sinyal varsa veya onSymbolClick tanımlıysa */
  const handleClick = (sym) => {
    if (!onSymbolClick) return;
    onSymbolClick(realSymbol(sym));
  };

  /* Tek bir hisse öğesini renderla */
  const renderItem = ([symbol, info]) => {
    const hasSignal = info.signal && info.signal !== '—';
    const isBuy = info.signal === 'BUY';
    const isSell = info.signal === 'SELL';
    const clickable = !!onSymbolClick;

    return (
      <div
        key={symbol}
        onClick={() => handleClick(symbol)}
        className={`flex items-center gap-2 shrink-0 px-2 py-1 rounded-lg transition-all duration-150 ${
          clickable ? 'cursor-pointer hover:bg-white/10 hover:scale-105' : 'cursor-default'
        } ${
          hasSignal && isBuy ? 'ring-1 ring-green-500/30 bg-green-500/5' :
          hasSignal && isSell ? 'ring-1 ring-red-500/30 bg-red-500/5' : ''
        }`}
        title={clickable ? `${realSymbol(symbol)} analizini görüntüle` : undefined}
      >
        <span className={`text-xs font-bold ${hasSignal ? (isBuy ? 'text-green-300' : isSell ? 'text-red-300' : 'text-yellow-300') : 'text-slate-300'}`}>
          {realSymbol(symbol)}
        </span>
        <span className="text-xs font-mono font-bold text-white">
          {info.price > 0 ? `₺${info.price.toFixed(2)}` : '—'}
        </span>
        {info.change !== undefined && info.change !== 0 && (
          <span
            className={`text-[9px] font-black ${
              info.change > 0 ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {info.change > 0 ? '+' : ''}{info.change.toFixed(2)}%
          </span>
        )}
        {hasSignal && (
          <span
            className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
              isBuy
                ? 'bg-green-500/20 text-green-400 animate-pulse'
                : isSell
                ? 'bg-red-500/20 text-red-400 animate-pulse'
                : 'bg-yellow-500/20 text-yellow-400'
            }`}
          >
            {info.signal}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="border-b border-white/5 bg-black/30 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center px-4 py-2">
        {/* Bağlantı durumu — sabit */}
        <div
          className={`flex items-center gap-1.5 text-xs font-bold mr-4 shrink-0 z-10 ${
            isConnected ? 'text-green-400' : 'text-slate-500'
          }`}
        >
          {isConnected ? <Wifi size={12} className="animate-pulse" /> : <WifiOff size={12} />}
          {isConnected ? 'CANLI' : 'BAĞLANTI YOK'}
        </div>

        {/* Kayan şerit */}
        <div
          className="relative flex-1 overflow-hidden"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div
            ref={trackRef}
            className="flex gap-6 whitespace-nowrap ticker-track"
            style={{
              animationDuration: `${duration}s`,
              animationPlayState: paused ? 'paused' : 'running',
            }}
          >
            {/* Orijinal kopya */}
            {entries.map(renderItem)}
            {/* Tekrar — kesintisiz döngü için */}
            {entries.map(([s, i]) => renderItem([s + '_dup', i]))}
          </div>
        </div>
      </div>

      {/* Keyframe animasyon — inline style tag */}
      <style>{`
        .ticker-track {
          animation: ticker-scroll linear infinite;
        }
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
};

export default LiveTicker;
