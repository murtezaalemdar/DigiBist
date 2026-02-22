/* API & WebSocket yapılandırma sabitleri */
export const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';
export const ADMIN_API_BASE = process.env.REACT_APP_ADMIN_URL || 'http://localhost:8001';
export const WS_BASE = process.env.REACT_APP_WS_URL || API_BASE.replace(/^http/i, 'ws');
