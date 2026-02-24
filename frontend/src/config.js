/* API & WebSocket yapılandırma sabitleri */
const isDev = process.env.NODE_ENV === 'development';
export const API_BASE = process.env.REACT_APP_API_URL || (isDev ? 'http://localhost:8000' : '');
export const ADMIN_API_BASE = process.env.REACT_APP_ADMIN_URL || (isDev ? 'http://localhost:8001' : '');
export const WS_BASE = process.env.REACT_APP_WS_URL || (isDev ? 'ws://localhost:8000' : `ws://${window.location.host}`);

/* Versiyon — her deploy'da burayı artır */
export const APP_VERSION = 'v8.06';
export const APP_VERSION_FULL = 'v8.06.00';
