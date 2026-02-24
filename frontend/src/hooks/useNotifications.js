import { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE } from '../config';

/**
 * Fırsat Bildirim Sistemi Hook'u
 * ─────────────────────────────────
 * - Backend'den alert listesini çeker
 * - WebSocket OPPORTUNITY_ALERT mesajlarını dinler
 * - Browser Notification API desteği
 * - Ses bildirimi (kritik alertlerde)
 */

// Bildirim sesi (kısa beep)
const playNotificationSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    // Ses çalamazsa sessizce devam et
  }
};

// Browser bildirim göster
const showBrowserNotification = (alert) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(`${alert.emoji || '🔔'} ${alert.title}`, {
      body: alert.message,
      icon: '/favicon.ico',
      tag: alert.id,
      silent: false,
    });
    // 10 saniye sonra otomatik kapat
    setTimeout(() => n.close(), 10000);
  } catch (e) {
    // Mobile/bazı browser'larda çalışmaz
  }
};

export default function useNotifications(wsRef) {
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(
    'Notification' in window ? Notification.permission : 'denied'
  );
  const latestAlertRef = useRef(null);
  const pollTimerRef = useRef(null);

  // Browser bildirim izni iste
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return;
    try {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
    } catch (e) {
      console.warn('Bildirim izni hatası:', e);
    }
  }, []);

  // Backend'den alert listesini çek
  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/alerts?limit=50`);
      if (!res.ok) return;
      const data = await res.json();
      setAlerts(data.alerts || []);
      setUnreadCount(data.unread_count || 0);
    } catch (e) {
      console.warn('Bildirim çekme hatası:', e);
    }
  }, []);

  // Belirli bir alert'i okundu işaretle
  const markRead = useCallback(async (alertId) => {
    try {
      const res = await fetch(`${API_BASE}/api/alerts/read/${alertId}`, { method: 'POST' });
      if (!res.ok) return;
      const data = await res.json();
      setUnreadCount(data.unread_count || 0);
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, read: true } : a));
    } catch (e) {
      console.warn('Okundu işaretleme hatası:', e);
    }
  }, []);

  // Tümünü okundu işaretle
  const markAllRead = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/alerts/read-all`, { method: 'POST' });
      if (!res.ok) return;
      setUnreadCount(0);
      setAlerts(prev => prev.map(a => ({ ...a, read: true })));
    } catch (e) {
      console.warn('Toplu okundu hatası:', e);
    }
  }, []);

  // Tüm bildirimleri sil
  const clearAll = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/alerts`, { method: 'DELETE' });
      if (!res.ok) return;
      setAlerts([]);
      setUnreadCount(0);
    } catch (e) {
      console.warn('Bildirim silme hatası:', e);
    }
  }, []);

  // Yeni alert geldiğinde (WebSocket'ten)
  const handleNewAlert = useCallback((alert) => {
    // Listeye ekle (başa)
    setAlerts(prev => {
      // Aynı ID varsa ekleme
      if (prev.find(a => a.id === alert.id)) return prev;
      const updated = [alert, ...prev];
      return updated.slice(0, 50); // Maks. 50
    });
    setUnreadCount(prev => prev + 1);

    // Kritik ve yüksek öncelikli alertlerde ses çal + browser bildirim
    if (alert.priority === 'critical' || alert.priority === 'high') {
      playNotificationSound();
      showBrowserNotification(alert);
    }

    latestAlertRef.current = alert;
  }, []);

  // İlk yükleme — alert listesini çek
  useEffect(() => {
    fetchAlerts();
    // Her 2 dakikada yenile (backup polling)
    pollTimerRef.current = setInterval(fetchAlerts, 120000);
    return () => clearInterval(pollTimerRef.current);
  }, [fetchAlerts]);

  return {
    alerts,
    unreadCount,
    isLoading,
    notificationPermission,
    latestAlert: latestAlertRef.current,
    requestPermission,
    fetchAlerts,
    markRead,
    markAllRead,
    clearAll,
    handleNewAlert,
  };
}
