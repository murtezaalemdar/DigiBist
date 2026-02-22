import { useState, useEffect, useRef, useCallback } from 'react';
import { WS_BASE } from '../config';

/**
 * WebSocket hook — gerçek zamanlı piyasa verisi akışı.
 * Otomatik yeniden bağlanma mantığı içerir.
 */
export default function useWebSocket() {
  const [livePrices, setLivePrices] = useState({});
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

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

  return { livePrices, wsConnected };
}
