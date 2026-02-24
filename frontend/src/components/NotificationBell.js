import React, { useState, useRef, useEffect } from 'react';
import { Bell, BellRing, Check, CheckCheck, Trash2, X, ExternalLink, Volume2, VolumeX } from 'lucide-react';

/**
 * Bildirim Zili Bileşeni
 * ──────────────────────
 * Navbar'da gösterilir, tıklanınca dropdown panel açılır.
 * Fırsat bildirimlerini listeler, okundu/sil işlemleri yapar.
 */

const PRIORITY_COLORS = {
  critical: 'border-red-500/40 bg-red-500/10',
  high: 'border-orange-500/30 bg-orange-500/10',
  medium: 'border-blue-500/20 bg-blue-500/5',
  low: 'border-slate-700 bg-white/5',
};

const PRIORITY_BADGE = {
  critical: 'bg-red-500 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-blue-500 text-white',
  low: 'bg-slate-600 text-slate-300',
};

const PRIORITY_LABELS = {
  critical: 'KRİTİK',
  high: 'YÜKSEK',
  medium: 'NORMAL',
  low: 'DÜŞÜK',
};

// Zaman farkını insan dostu formata çevir
const timeAgo = (isoDate) => {
  if (!isoDate) return '';
  const diff = (Date.now() - new Date(isoDate).getTime()) / 1000;
  if (diff < 60) return 'Az önce';
  if (diff < 3600) return `${Math.floor(diff / 60)}dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}sa önce`;
  return `${Math.floor(diff / 86400)}g önce`;
};

const NotificationBell = ({
  alerts = [],
  unreadCount = 0,
  onMarkRead,
  onMarkAllRead,
  onClearAll,
  onRequestPermission,
  notificationPermission,
  onSymbolClick,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('all'); // all, unread, critical, high
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return localStorage.getItem('bist_notif_sound') !== 'false'; } catch { return true; }
  });
  const panelRef = useRef(null);

  // Dışarı tıklanınca kapat
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Ses tercihi kaydet
  useEffect(() => {
    localStorage.setItem('bist_notif_sound', String(soundEnabled));
  }, [soundEnabled]);

  // Filtreli alertler
  const filteredAlerts = alerts.filter(a => {
    if (filter === 'unread') return !a.read;
    if (filter === 'critical') return a.priority === 'critical';
    if (filter === 'high') return a.priority === 'critical' || a.priority === 'high';
    return true;
  });

  return (
    <div className="relative" ref={panelRef}>
      {/* Zil Butonu */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-lg transition-all duration-200 ${
          isOpen
            ? 'bg-blue-500/20 text-blue-400'
            : unreadCount > 0
              ? 'text-yellow-400 hover:bg-yellow-500/10 hover:text-yellow-300'
              : 'text-slate-400 hover:bg-white/10 hover:text-white'
        }`}
        title={unreadCount > 0 ? `${unreadCount} okunmamış bildirim` : 'Bildirimler'}
      >
        {unreadCount > 0 ? (
          <BellRing size={18} className="animate-[wiggle_0.5s_ease-in-out]" />
        ) : (
          <Bell size={18} />
        )}
        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-black rounded-full px-1 shadow-lg shadow-red-500/30 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[380px] max-h-[520px] bg-[#0d1117] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 z-[100] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <BellRing size={16} className="text-blue-400" />
              <h3 className="text-sm font-bold text-white">Fırsat Bildirimleri</h3>
              {unreadCount > 0 && (
                <span className="bg-red-500/20 text-red-400 text-[10px] font-black px-2 py-0.5 rounded-full">
                  {unreadCount} yeni
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {/* Ses açma/kapama */}
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all"
                title={soundEnabled ? 'Sesi kapat' : 'Sesi aç'}
              >
                {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              </button>
              {/* Tümünü okundu */}
              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllRead}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-green-400 hover:bg-green-500/10 transition-all"
                  title="Tümünü okundu işaretle"
                >
                  <CheckCheck size={14} />
                </button>
              )}
              {/* Temizle */}
              {alerts.length > 0 && (
                <button
                  onClick={onClearAll}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  title="Tümünü sil"
                >
                  <Trash2 size={14} />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Filtre Tabları */}
          <div className="flex gap-1 px-3 py-2 border-b border-white/5">
            {[
              { key: 'all', label: 'Tümü' },
              { key: 'unread', label: 'Okunmamış' },
              { key: 'high', label: 'Önemli' },
              { key: 'critical', label: 'Kritik' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  filter === f.key
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'text-slate-500 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Browser bildirim izni */}
          {notificationPermission === 'default' && (
            <div className="px-4 py-2 bg-blue-500/5 border-b border-white/5">
              <button
                onClick={onRequestPermission}
                className="w-full text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                🔔 Masaüstü bildirimleri almak için tıklayın
              </button>
            </div>
          )}

          {/* Alert Listesi */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {filteredAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Bell size={32} className="text-slate-700 mb-3" />
                <p className="text-slate-500 text-sm font-medium">
                  {filter !== 'all' ? 'Bu filtrede bildirim yok' : 'Henüz bildirim yok'}
                </p>
                <p className="text-slate-600 text-xs mt-1">
                  Hisse analiz edildiğinde fırsatlar burada belirecek
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {filteredAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`px-4 py-3 transition-all duration-200 hover:bg-white/[0.03] cursor-pointer ${
                      !alert.read ? 'bg-white/[0.02]' : ''
                    }`}
                    onClick={() => {
                      if (!alert.read && onMarkRead) onMarkRead(alert.id);
                      if (alert.symbol && onSymbolClick) {
                        onSymbolClick(alert.symbol);
                        setIsOpen(false);
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      {/* Okunmadı göstergesi */}
                      <div className="mt-1.5 shrink-0">
                        {!alert.read ? (
                          <div className="w-2 h-2 bg-blue-500 rounded-full shadow-sm shadow-blue-500/50" />
                        ) : (
                          <div className="w-2 h-2 bg-transparent rounded-full" />
                        )}
                      </div>

                      {/* İçerik */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-base">{alert.emoji}</span>
                          <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${PRIORITY_BADGE[alert.priority] || PRIORITY_BADGE.low}`}>
                            {PRIORITY_LABELS[alert.priority] || 'BİLGİ'}
                          </span>
                          <span className="text-[10px] text-slate-600 ml-auto shrink-0">
                            {timeAgo(alert.created_at)}
                          </span>
                        </div>
                        <p className={`text-xs font-bold truncate ${!alert.read ? 'text-white' : 'text-slate-400'}`}>
                          {alert.title}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                          {alert.message}
                        </p>
                        {/* Sembol etiketi */}
                        {alert.symbol && (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-md font-mono font-bold text-blue-400">
                              {alert.symbol}
                            </span>
                            {alert.data?.price && (
                              <span className="text-[10px] text-slate-600 font-mono">
                                ₺{alert.data.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Okundu butonu */}
                      {!alert.read && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onMarkRead) onMarkRead(alert.id);
                          }}
                          className="mt-1 p-1 rounded text-slate-600 hover:text-green-400 hover:bg-green-500/10 transition-all shrink-0"
                          title="Okundu"
                        >
                          <Check size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {alerts.length > 0 && (
            <div className="px-4 py-2 border-t border-white/5 text-center">
              <span className="text-[10px] text-slate-600">
                Toplam {alerts.length} bildirim • {unreadCount} okunmamış
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
