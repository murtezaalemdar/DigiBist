import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { API_BASE } from '../config';

/**
 * JWT Authentication hook + React Context.
 * Login, register, logout, token yönetimi ve izin kontrolü.
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('bist_token'));
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState([]);

  // Token varsa kullanıcı bilgisini al
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Token geçersiz');
        return res.json();
      })
      .then((data) => {
        setUser(data.user);
        setPermissions(data.user.permissions || []);
      })
      .catch(() => {
        // Token geçersiz — temizle
        localStorage.removeItem('bist_token');
        setToken(null);
        setUser(null);
        setPermissions([]);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const login = useCallback(async (username, password) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Giriş başarısız');
    }
    const data = await res.json();
    localStorage.setItem('bist_token', data.access_token);
    setToken(data.access_token);
    setUser(data.user);
    setPermissions(data.user.permissions || []);
    return data;
  }, []);

  const register = useCallback(async (name, username, password) => {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Kayıt başarısız');
    }
    const data = await res.json();
    localStorage.setItem('bist_token', data.access_token);
    setToken(data.access_token);
    setUser(data.user);
    setPermissions(data.user.permissions || []);
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('bist_token');
    setToken(null);
    setUser(null);
    setPermissions([]);
  }, []);

  /** Belirli bir izin var mı kontrol et */
  const hasPermission = useCallback(
    (permKey) => {
      if (!user) return false;
      if (user.role === 'admin') return true;
      return permissions.includes(permKey);
    },
    [user, permissions],
  );

  /** Birden fazla izinden herhangi biri var mı */
  const hasAnyPermission = useCallback(
    (permKeys) => {
      if (!user) return false;
      if (user.role === 'admin') return true;
      return permKeys.some((k) => permissions.includes(k));
    },
    [user, permissions],
  );

  /** Authenticated fetch — token otomatik eklenir */
  const authFetch = useCallback(
    (url, options = {}) => {
      const headers = { ...options.headers };
      if (token) headers.Authorization = `Bearer ${token}`;
      return fetch(url, { ...options, headers });
    },
    [token],
  );

  return (
    <AuthContext.Provider
      value={{ user, token, loading, permissions, login, register, logout, authFetch, hasPermission, hasAnyPermission }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export default useAuth;
