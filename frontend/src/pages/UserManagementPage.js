import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, UserPlus, Pencil, Trash2, KeyRound, Save, X, Shield, Eye, UserCog,
  AlertTriangle, CheckCircle2, Loader2, ShieldCheck, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { API_BASE } from '../config';
import { useAuth } from '../hooks/useAuth';

const ROLES = [
  { value: 'admin', label: 'Admin', icon: Shield, color: 'text-red-400 bg-red-500/10 border-red-500/30' },
  { value: 'user', label: 'Kullanıcı', icon: UserCog, color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  { value: 'viewer', label: 'İzleyici', icon: Eye, color: 'text-slate-400 bg-slate-500/10 border-slate-500/30' },
];

const getRoleBadge = (role) => {
  const r = ROLES.find((x) => x.value === role) || ROLES[2];
  const Icon = r.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${r.color}`}>
      <Icon size={10} /> {r.label}
    </span>
  );
};

// ── Toast Bildirimi ──
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div
      className={`fixed top-20 right-6 z-[100] flex items-center gap-2 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md text-sm font-medium animate-slide-in ${
        type === 'success'
          ? 'bg-green-500/10 border-green-500/30 text-green-400'
          : 'bg-red-500/10 border-red-500/30 text-red-400'
      }`}
    >
      {type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
      {message}
    </div>
  );
};

// ── Modal Wrapper ──
const Modal = ({ title, children, onClose }) => (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
    <div
      className="bg-[#0d1117] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-white/5 sticky top-0 bg-[#0d1117] z-10">
        <h3 className="text-base sm:text-lg font-bold text-white">{title}</h3>
        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1">
          <X size={18} />
        </button>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  </div>
);

// ── Form Input ──
const FormInput = ({ label, ...props }) => (
  <div className="mb-3">
    <label className="block text-xs font-bold text-slate-400 mb-1">{label}</label>
    <input
      className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
      {...props}
    />
  </div>
);

const UserManagementPage = () => {
  const { authFetch } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [passwordUser, setPasswordUser] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [permUser, setPermUser] = useState(null); // İzin yönetim modalı

  // Form states
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '', role: 'user' });
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  // İzin state'leri
  const [allPermissions, setAllPermissions] = useState([]);
  const [permGroups, setPermGroups] = useState({});
  const [userPerms, setUserPerms] = useState([]);
  const [permLoading, setPermLoading] = useState(false);

  const showToast = (message, type = 'success') => setToast({ message, type });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/api/users`);
      if (!res.ok) throw new Error('Yetki hatası');
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      showToast(err.message || 'Kullanıcılar yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // ── İzin Listesini Yükle ──
  const fetchPermissions = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/permissions`);
      if (!res.ok) return;
      const data = await res.json();
      setAllPermissions(data.permissions || []);
      setPermGroups(data.groups || {});
    } catch (err) {
      console.error('İzinler yüklenemedi:', err);
    }
  }, [authFetch]);

  // ── Kullanıcı İzinlerini Aç ──
  const openPermModal = useCallback(async (u) => {
    setPermUser(u);
    setPermLoading(true);
    await fetchPermissions();
    try {
      const res = await authFetch(`${API_BASE}/api/users/${u.id}/permissions`);
      if (!res.ok) throw new Error('İzinler yüklenemedi');
      const data = await res.json();
      setUserPerms(data.permissions || []);
    } catch (err) {
      showToast(err.message, 'error');
      setUserPerms([]);
    } finally {
      setPermLoading(false);
    }
  }, [authFetch, fetchPermissions]);

  // ── İzin Toggle ──
  const togglePerm = (key) => {
    setUserPerms((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // ── Tüm grubu aç/kapat ──
  const toggleGroup = (groupPerms) => {
    const groupKeys = groupPerms.map((p) => p.key);
    const allSelected = groupKeys.every((k) => userPerms.includes(k));
    if (allSelected) {
      setUserPerms((prev) => prev.filter((k) => !groupKeys.includes(k)));
    } else {
      setUserPerms((prev) => [...new Set([...prev, ...groupKeys])]);
    }
  };

  // ── İzinleri Kaydet ──
  const handleSavePerms = async () => {
    if (!permUser) return;
    setSaving(true);
    try {
      const res = await authFetch(`${API_BASE}/api/users/${permUser.id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: userPerms }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'İzinler kaydedilemedi');
      showToast(`"${permUser.username}" izinleri güncellendi`);
      setPermUser(null);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Kullanıcı Ekle ──
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name || !form.username || !form.password) {
      showToast('Ad, kullanıcı adı ve şifre zorunlu', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch(`${API_BASE}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Kullanıcı eklenemedi');
      showToast(`"${form.username}" başarıyla eklendi`);
      setShowAddModal(false);
      setForm({ name: '', username: '', email: '', password: '', role: 'user' });
      fetchUsers();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Kullanıcı Düzenle ──
  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editUser) return;
    setSaving(true);
    try {
      const res = await authFetch(`${API_BASE}/api/users/${editUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editUser.name,
          username: editUser.username,
          email: editUser.email,
          role: editUser.role,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Güncellenemedi');
      showToast(`"${editUser.username}" güncellendi`);
      setEditUser(null);
      fetchUsers();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Şifre Değiştir ──
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!passwordUser || newPassword.length < 6) {
      showToast('Şifre en az 6 karakter olmalı', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch(`${API_BASE}/api/users/${passwordUser.id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Şifre değiştirilemedi');
      showToast(`"${passwordUser.username}" şifresi değiştirildi`);
      setPasswordUser(null);
      setNewPassword('');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Kullanıcı Sil ──
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setSaving(true);
    try {
      const res = await authFetch(`${API_BASE}/api/users/${deleteConfirm.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Silinemedi');
      showToast(`"${deleteConfirm.username}" silindi`);
      setDeleteConfirm(null);
      fetchUsers();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-violet-500 to-purple-600 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl shadow-lg shadow-violet-500/20">
            <Users size={20} className="text-white sm:hidden" />
            <Users size={24} className="text-white hidden sm:block" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Kullanıcı Yönetimi</h1>
            <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 hidden sm:block">
              Kullanıcı ekleme, düzenleme, silme ve şifre değiştirme işlemlerini buradan yapabilirsiniz
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setForm({ name: '', username: '', email: '', password: '', role: 'user' });
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-lg shadow-blue-500/20 w-full sm:w-auto justify-center sm:justify-start"
        >
          <UserPlus size={16} /> Yeni Kullanıcı
        </button>
      </div>

      {/* Kullanıcı Tablosu */}
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <Loader2 size={24} className="animate-spin mr-2" /> Yükleniyor...
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Users size={48} className="mb-3 opacity-30" />
            <p className="text-sm">Henüz kullanıcı yok</p>
          </div>
        ) : (
          <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs text-slate-500 uppercase tracking-wider">
                  <th className="text-left px-4 lg:px-6 py-4 font-bold">ID</th>
                  <th className="text-left px-4 lg:px-6 py-4 font-bold">Ad Soyad</th>
                  <th className="text-left px-4 lg:px-6 py-4 font-bold">Kullanıcı Adı</th>
                  <th className="text-left px-4 lg:px-6 py-4 font-bold hidden lg:table-cell">E-posta</th>
                  <th className="text-left px-4 lg:px-6 py-4 font-bold">Rol</th>
                  <th className="text-left px-4 lg:px-6 py-4 font-bold hidden xl:table-cell">Kayıt Tarihi</th>
                  <th className="text-right px-4 lg:px-6 py-4 font-bold">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 lg:px-6 py-4 text-slate-500 font-mono text-xs">#{u.id}</td>
                    <td className="px-4 lg:px-6 py-4 font-medium text-white">{u.name}</td>
                    <td className="px-4 lg:px-6 py-4 text-blue-400 font-mono text-xs">@{u.username}</td>
                    <td className="px-4 lg:px-6 py-4 text-slate-400 text-xs hidden lg:table-cell">{u.email || '—'}</td>
                    <td className="px-4 lg:px-6 py-4">{getRoleBadge(u.role)}</td>
                    <td className="px-4 lg:px-6 py-4 text-slate-500 text-xs hidden xl:table-cell">
                      {u.created_at
                        ? new Date(u.created_at).toLocaleDateString('tr-TR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="px-4 lg:px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openPermModal(u)}
                          className="p-2 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                          title="İzinleri Yönet"
                        >
                          <ShieldCheck size={14} />
                        </button>
                        <button
                          onClick={() =>
                            setEditUser({
                              id: u.id,
                              name: u.name,
                              username: u.username,
                              email: u.email || '',
                              role: u.role,
                            })
                          }
                          className="p-2 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                          title="Düzenle"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setPasswordUser(u)}
                          className="p-2 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                          title="Şifre Değiştir"
                        >
                          <KeyRound size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(u)}
                          className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          title="Sil"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-white/[0.03]">
            {users.map((u) => (
              <div key={u.id} className="p-4 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-white text-sm truncate">{u.name}</span>
                      {getRoleBadge(u.role)}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-blue-400 font-mono">@{u.username}</span>
                      <span className="text-slate-600">#{u.id}</span>
                    </div>
                    {u.email && <p className="text-slate-500 text-[10px] mt-1 truncate">{u.email}</p>}
                  </div>
                  {u.created_at && (
                    <span className="text-[10px] text-slate-600 shrink-0 ml-2">
                      {new Date(u.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-2 -ml-1">
                  <button
                    onClick={() => openPermModal(u)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                  >
                    <ShieldCheck size={13} /> İzinler
                  </button>
                  <button
                    onClick={() => setEditUser({ id: u.id, name: u.name, username: u.username, email: u.email || '', role: u.role })}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                  >
                    <Pencil size={13} /> Düzenle
                  </button>
                  <button
                    onClick={() => setPasswordUser(u)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                  >
                    <KeyRound size={13} /> Şifre
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(u)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all ml-auto"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          </>
        )}

        {/* Alt bilgi */}
        {!loading && users.length > 0 && (
          <div className="px-6 py-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-600">
            <span>Toplam {users.length} kullanıcı</span>
            <span>BIST AI v8.0 Kullanıcı Yönetimi</span>
          </div>
        )}
      </div>

      {/* ── Yeni Kullanıcı Ekle Modal ── */}
      {showAddModal && (
        <Modal title="Yeni Kullanıcı Ekle" onClose={() => setShowAddModal(false)}>
          <form onSubmit={handleAdd}>
            <FormInput
              label="Ad Soyad *"
              placeholder="Ahmet Yılmaz"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <FormInput
              label="Kullanıcı Adı *"
              placeholder="ahmet"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
            <FormInput
              label="E-posta (opsiyonel)"
              placeholder="ahmet@ornek.com"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <FormInput
              label="Şifre *"
              placeholder="En az 6 karakter"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              minLength={6}
              required
            />
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-400 mb-1">Rol</label>
              <div className="flex gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setForm({ ...form, role: r.value })}
                    className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                      form.role === r.value
                        ? r.color + ' ring-1 ring-current'
                        : 'border-white/10 text-slate-500 hover:border-white/20'
                    }`}
                  >
                    <r.icon size={12} /> {r.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white px-4 py-3 rounded-xl text-sm font-bold transition-all"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              {saving ? 'Ekleniyor...' : 'Kullanıcı Ekle'}
            </button>
          </form>
        </Modal>
      )}

      {/* ── Kullanıcı Düzenle Modal ── */}
      {editUser && (
        <Modal title="Kullanıcı Düzenle" onClose={() => setEditUser(null)}>
          <form onSubmit={handleEdit}>
            <FormInput
              label="Ad Soyad"
              value={editUser.name}
              onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
              required
            />
            <FormInput
              label="Kullanıcı Adı"
              value={editUser.username}
              onChange={(e) => setEditUser({ ...editUser, username: e.target.value })}
              required
            />
            <FormInput
              label="E-posta"
              type="email"
              value={editUser.email}
              onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
            />
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-400 mb-1">Rol</label>
              <div className="flex gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setEditUser({ ...editUser, role: r.value })}
                    className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                      editUser.role === r.value
                        ? r.color + ' ring-1 ring-current'
                        : 'border-white/10 text-slate-500 hover:border-white/20'
                    }`}
                  >
                    <r.icon size={12} /> {r.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white px-4 py-3 rounded-xl text-sm font-bold transition-all"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
            </button>
          </form>
        </Modal>
      )}

      {/* ── Şifre Değiştir Modal ── */}
      {passwordUser && (
        <Modal title={`Şifre Değiştir — @${passwordUser.username}`} onClose={() => { setPasswordUser(null); setNewPassword(''); }}>
          <form onSubmit={handleChangePassword}>
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 mb-4">
              <p className="text-amber-400 text-xs flex items-center gap-1.5">
                <AlertTriangle size={12} />
                <strong>{passwordUser.name}</strong> kullanıcısının şifresi değiştirilecek
              </p>
            </div>
            <FormInput
              label="Yeni Şifre"
              type="password"
              placeholder="En az 6 karakter"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
              required
            />
            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-50 text-white px-4 py-3 rounded-xl text-sm font-bold transition-all"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
              {saving ? 'Değiştiriliyor...' : 'Şifreyi Değiştir'}
            </button>
          </form>
        </Modal>
      )}

      {/* ── Silme Onay Modal ── */}
      {deleteConfirm && (
        <Modal title="Kullanıcı Sil" onClose={() => setDeleteConfirm(null)}>
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 mb-4">
            <p className="text-red-400 text-sm flex items-center gap-2">
              <AlertTriangle size={16} />
              Bu işlem geri alınamaz!
            </p>
            <p className="text-slate-400 text-xs mt-2">
              <strong className="text-white">@{deleteConfirm.username}</strong> ({deleteConfirm.name}) kullanıcısı
              kalıcı olarak silinecek.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setDeleteConfirm(null)}
              className="flex-1 border border-white/10 text-slate-400 hover:text-white px-4 py-3 rounded-xl text-sm font-bold transition-all"
            >
              İptal
            </button>
            <button
              onClick={handleDelete}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 text-white px-4 py-3 rounded-xl text-sm font-bold transition-all"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              {saving ? 'Siliniyor...' : 'Evet, Sil'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── İzin Yönetim Modal ── */}
      {permUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setPermUser(null)}>
          <div
            className="bg-[#0d1117] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-white/5 shrink-0">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-1.5 sm:p-2 rounded-lg sm:rounded-xl shrink-0">
                  <ShieldCheck size={16} className="text-white sm:hidden" />
                  <ShieldCheck size={18} className="text-white hidden sm:block" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-white">İzin Yönetimi</h3>
                  <p className="text-[10px] sm:text-xs text-slate-500 truncate">
                    @{permUser.username} — {permUser.name}
                    {permUser.role === 'admin' && (
                      <span className="ml-1 sm:ml-2 text-amber-400 font-bold">(Admin — tüm izinlere sahip)</span>
                    )}
                  </p>
                </div>
              </div>
              <button onClick={() => setPermUser(null)} className="text-slate-500 hover:text-white transition-colors p-1 shrink-0">
                <X size={18} />
              </button>
            </div>

            {/* İzin Listesi */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3 sm:space-y-5">
              {permLoading ? (
                <div className="flex items-center justify-center py-12 text-slate-500">
                  <Loader2 size={24} className="animate-spin mr-2" /> İzinler yükleniyor...
                </div>
              ) : (
                Object.entries(permGroups).map(([groupName, groupPerms]) => {
                  const groupKeys = groupPerms.map((p) => p.key);
                  const selectedCount = groupKeys.filter((k) => userPerms.includes(k)).length;
                  const allSelected = selectedCount === groupKeys.length;
                  const someSelected = selectedCount > 0 && !allSelected;

                  return (
                    <div key={groupName} className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
                      {/* Grup Header */}
                      <div
                        className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 bg-white/[0.03] cursor-pointer hover:bg-white/[0.05] transition-colors"
                        onClick={() => toggleGroup(groupPerms)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-bold text-white">{groupName}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            allSelected
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : someSelected
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-slate-500/20 text-slate-500 border border-slate-500/30'
                          }`}>
                            {selectedCount}/{groupKeys.length}
                          </span>
                        </div>
                        <button
                          className={`text-xs font-bold px-3 py-1 rounded-lg transition-all ${
                            allSelected
                              ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'
                              : 'text-slate-500 bg-white/5 hover:bg-white/10'
                          }`}
                        >
                          {allSelected ? 'Tümünü Kaldır' : 'Tümünü Seç'}
                        </button>
                      </div>

                      {/* İzinler */}
                      <div className="divide-y divide-white/[0.03]">
                        {groupPerms.map((perm) => {
                          const isGranted = userPerms.includes(perm.key);
                          const isAdmin = permUser.role === 'admin';
                          return (
                            <div
                              key={perm.key}
                              className={`flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 transition-colors ${
                                isAdmin ? 'opacity-60' : 'hover:bg-white/[0.02] cursor-pointer'
                              }`}
                              onClick={() => !isAdmin && togglePerm(perm.key)}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
                                  <span className="text-xs sm:text-sm font-medium text-white">{perm.name}</span>
                                  <code className="text-[9px] sm:text-[10px] text-slate-600 font-mono">{perm.key}</code>
                                </div>
                                {perm.description && (
                                  <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 hidden sm:block">{perm.description}</p>
                                )}
                              </div>
                              <div className="ml-3 shrink-0">
                                {isAdmin ? (
                                  <ToggleRight size={24} className="text-emerald-400" />
                                ) : isGranted ? (
                                  <ToggleRight size={24} className="text-emerald-400" />
                                ) : (
                                  <ToggleLeft size={24} className="text-slate-600" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-t border-white/5 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-0">
              <p className="text-[10px] sm:text-xs text-slate-600 text-center sm:text-left">
                {userPerms.length} / {allPermissions.length} izin seçili
              </p>
              <div className="flex gap-2 sm:gap-3">
                <button
                  onClick={() => setPermUser(null)}
                  className="flex-1 sm:flex-none border border-white/10 text-slate-400 hover:text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all"
                >
                  İptal
                </button>
                {permUser.role !== 'admin' && (
                  <button
                    onClick={handleSavePerms}
                    disabled={saving}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-lg shadow-emerald-500/20"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? 'Kaydediliyor...' : 'İzinleri Kaydet'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementPage;
