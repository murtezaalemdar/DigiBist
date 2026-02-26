/**
 * DigiBist — Yapılandırma Sabitleri (config.js)
 * ═══════════════════════════════════════════════
 *
 * Tüm API, WebSocket ve versiyon bilgileri burada tanımlanır.
 * Environment variable'lar ile override edilebilir:
 *   REACT_APP_API_URL  → API_BASE (ör: http://192.168.0.28:8000)
 *   REACT_APP_ADMIN_URL → ADMIN_API_BASE (Filament admin, port 8001)
 *   REACT_APP_WS_URL   → WS_BASE (WebSocket, ör: ws://192.168.0.28:8000)
 *
 * Production'da:
 *   API_BASE  = '' (aynı host, Nginx proxy)
 *   WS_BASE   = 'ws://{window.location.host}' (aynı host, WS path)
 *
 * NOT: deploy.ps1 versiyon artırmayı otomatik yapar.
 *      Manuel artırma gerekirse APP_VERSION ve APP_VERSION_FULL'u güncelle.
 */

/** Development mi Production mı? NODE_ENV'den otomatik algılanır */
const isDev = process.env.NODE_ENV === 'development';

/** Backend API base URL — FastAPI (port 8000) */
export const API_BASE = process.env.REACT_APP_API_URL || (isDev ? 'http://localhost:8000' : '');

/** Filament Admin API base URL — Laravel (port 8001) */
export const ADMIN_API_BASE = process.env.REACT_APP_ADMIN_URL || (isDev ? 'http://localhost:8001' : '');

/** WebSocket base URL — Gerçek zamanlı fiyat akışı */
export const WS_BASE = process.env.REACT_APP_WS_URL || (isDev ? 'ws://localhost:8000' : `ws://${window.location.host}`);

/**
 * Versiyon bilgisi — her deploy'da deploy.ps1 otomatik artırır.
 * Navbar'da ve footer'da gösterilir.
 */
export const APP_VERSION = 'v8.09';
export const APP_VERSION_FULL = 'v8.09.01';
