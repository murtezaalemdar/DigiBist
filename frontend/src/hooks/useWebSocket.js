import { useState, useEffect, useRef, useCallback } from 'react';
import { WS_BASE } from '../config';

/**
 * WebSocket hook — gerçek zamanlı piyasa verisi akışı.
 * Otomatik yeniden bağlanma mantığı içerir.
 * OPPORTUNITY_ALERT mesajlarını onAlert callback'i ile iletir.
 */
export default function useWebSocket(onAlert) {
  const [livePrices, setLivePrices] = useState({});
  const [wsConnected, setWsConnected] = useState(false);
  const [priceProvider, setPriceProvider] = useState('none');
  const [lastPriceUpdate, setLastPriceUpdate] = useState(null);
  const [updateInterval, setUpdateInterval] = useState(60);
  const lastUpdateRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const onAlertRef = useRef(onAlert);

  // onAlert değiştiğinde ref güncelle (closure stale olmasın)
  useEffect(() => { onAlertRef.current = onAlert; }, [onAlert]);

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(`${WS_BASE}/ws/market`);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        console.log('✅ WebSocket bağlandı');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'MARKET_UPDATE') {
            setLivePrices(msg.data || {});
            const now = Date.now();
            if (lastUpdateRef.current) {
              const diff = Math.round((now - lastUpdateRef.current) / 1000);
              if (diff > 0 && diff < 120) setUpdateInterval(diff);
            }
            lastUpdateRef.current = now;
            setLastPriceUpdate(now);
            if (msg.provider) setPriceProvider(msg.provider);
          } else if (msg.type === 'OPPORTUNITY_ALERT' && msg.alert) {
            // Fırsat bildirimi geldi — callback ile ilet
            if (onAlertRef.current) {
              onAlertRef.current(msg.alert);
            }
          }
        } catch (e) {
          console.error('WS mesaj hatası:', e);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        console.warn('⚠️ WebSocket bağlantısı kesildi. 5s sonra yeniden denenecek.');
        reconnectTimer.current = setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (e) {
      console.error('WebSocket bağlantı hatası:', e);
      reconnectTimer.current = setTimeout(connect, 5000);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { livePrices, wsConnected, priceProvider, lastPriceUpdate, updateInterval };
}
