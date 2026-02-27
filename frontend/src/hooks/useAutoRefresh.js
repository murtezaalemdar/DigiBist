/**
 * useAutoRefresh.js — Otomatik Veri Yenileme Hook'u
 * ═══════════════════════════════════════════════════
 *
 * Belirtilen fonksiyonu periyodik olarak çağırır.
 * Sekme arka plana geçtiğinde (Page Visibility API) polling durur,
 * ön plana geldiğinde hemen bir kez çalışıp tekrar devam eder.
 *
 * Kullanım:
 *   useAutoRefresh(fetchData, 30000, isEnabled);
 *   useAutoRefresh(() => loadTradingState(), 15000, activePage === 'trade');
 *
 * @param {Function} fetchFn   — Çağrılacak async/sync fonksiyon
 * @param {number}   intervalMs — Milisaniye cinsinden polling aralığı
 * @param {boolean}  enabled    — true ise polling aktif, false ise durdurulur
 *
 * @module useAutoRefresh
 * @version 8.11.00
 */

import { useEffect, useRef, useCallback } from 'react';

const useAutoRefresh = (fetchFn, intervalMs = 30000, enabled = true) => {
  const intervalRef = useRef(null);
  const fetchRef = useRef(fetchFn);

  // fetchFn her render'da değişebilir — en güncel referansı tut
  useEffect(() => {
    fetchRef.current = fetchFn;
  }, [fetchFn]);

  const startPolling = useCallback(() => {
    // Önce varsa mevcut interval'i temizle
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!enabled) return;

    intervalRef.current = setInterval(() => {
      try {
        fetchRef.current();
      } catch (e) {
        console.error('[useAutoRefresh] polling error:', e);
      }
    }, intervalMs);
  }, [intervalMs, enabled]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      stopPolling();
      return;
    }

    // Polling'i başlat
    startPolling();

    // Page Visibility: sekme gizlenince durdur, açılınca hemen çalıştır + devam
    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        // Sekme tekrar görünür olunca hemen bir kez çalıştır
        try {
          fetchRef.current();
        } catch (e) {
          console.error('[useAutoRefresh] visibility refresh error:', e);
        }
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, startPolling, stopPolling]);

  // Manuel tetikleme fonksiyonu
  const refresh = useCallback(() => {
    try {
      fetchRef.current();
    } catch (e) {
      console.error('[useAutoRefresh] manual refresh error:', e);
    }
  }, []);

  return { refresh };
};

export default useAutoRefresh;
