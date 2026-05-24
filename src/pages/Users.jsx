import { useState, useEffect } from 'react';
import { Users as UsersIcon, Plus, Edit, Trash2, Shield, ShieldCheck, Eye, X, Save, Key } from 'lucide-react';
import { api } from '../api';
import { useAuth, hashPassword } from '../context/AuthContext';

const roleLabels = {
  admin: 'Yonetici',
  editor: 'Duzenleyici',
  viewer: 'Goruntuleyen',
};

const roleColors = {
  admin: '#ef4444',
  editor: '#3b82f6',
  viewer: '#6b7280',
};

const roleIcons = {
  admin: <ShieldCheck size={14} />,
  editor: <Shield size={14} />,
  viewer: <Eye size={14} />,
};

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ username: '', display_name: '', password: '', role: 'editor' });
  const [error, setError] = useState('');
  const [showPasswordChange, setShowPasswordChange] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await api.users.list();
      setUsers(data);
    } catch (e) {
      console.error(e);
    }
  };

  const openAdd = () => {
    setEditUser(null);
    setForm({ username: '', display_name: '', password: '', role: 'editor' });
    setError('');
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditUser(u);
    setForm({ username: u.username, display_name: u.display_name, password: '', role: u.role });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.username.trim()) {
      setError('Kullanici adi zorunludur');
      return;
    }
    if (!form.display_name.trim()) {
      setError('Gorunen ad zorunludur');
      return;
    }
    if (!editUser && !form.password.trim()) {
      setError('Sifre zorunludur');
      return;
    }

    try {
      const data = {
        username: form.username.trim(),
        display_name: form.display_name.trim(),
        role: form.role,
      };

      if (form.password.trim()) {
        data.password_hash = await hashPassword(form.password.trim());
      }

      if (editUser) {
        await api.users.update(editUser.id, data);
      } else {
        if (!data.password_hash) {
          setError('Sifre zorunludur');
          return;
        }
        await api.users.create(data);
      }

      setShowModal(false);
      loadUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (u) => {
    if (u.id === currentUser.id) {
      alert('Kendi hesabinizi silemezsiniz');
      return;
    }
    if (confirm(`"${u.display_name}" kullanicisini silmek istediginize emin misiniz?`)) {
      try {
        await api.users.delete(u.id);
        loadUsers();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const handleToggleActive = async (u) => {
    if (u.id === currentUser.id) {
      alert('Kendi hesabinizi devre disi birakamazsiniz');
      return;
    }
    try {
      await api.users.update(u.id, { ...u, active: u.active ? 0 : 1 });
      loadUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  const handlePasswordChange = async (userId) => {
    if (!newPassword.trim()) return;
    try {
      const hash = await hashPassword(newPassword.trim());
      await api.users.changePassword(userId, hash);
      setShowPasswordChange(null);
      setNewPassword('');
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1><UsersIcon size={24} /> Kullanici Yonetimi</h1>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} /> Yeni Kullanici
        </button>
      </div>

      <div className="users-grid">
        {users.map(u => (
          <div key={u.id} className={`user-card ${!u.active ? 'user-card-inactive' : ''}`}>
            <div className="user-card-header">
              <div className="user-avatar">
                {u.display_name.charAt(0).toUpperCase()}
              </div>
              <div className="user-info">
                <div className="user-display-name">
                  {u.display_name}
                  {u.id === currentUser.id && <span className="badge badge-you">Sen</span>}
                </div>
                <div className="user-username">@{u.username}</div>
              </div>
              <div className="user-role-badge" style={{ background: roleColors[u.role] + '18', color: roleColors[u.role] }}>
                {roleIcons[u.role]} {roleLabels[u.role]}
              </div>
            </div>

            {!u.active && (
              <div className="user-inactive-badge">Devre Disi</div>
            )}

            <div className="user-card-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => openEdit(u)} title="Duzenle">
                <Edit size={14} /> Duzenle
              </button>

              {showPasswordChange === u.id ? (
                <div className="user-password-change">
                  <input
                    type="password"
                    placeholder="Yeni sifre"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="form-input"
                  />
                  <button className="btn btn-primary btn-sm" onClick={() => handlePasswordChange(u.id)}>
                    <Save size={12} />
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setShowPasswordChange(null); setNewPassword(''); }}>
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button className="btn btn-secondary btn-sm" onClick={() => setShowPasswordChange(u.id)} title="Sifre degistir">
                  <Key size={14} />
                </button>
              )}

              {u.id !== currentUser.id && (
                <>
                  <button
                    className={`btn btn-sm ${u.active ? 'btn-warning' : 'btn-primary'}`}
                    onClick={() => handleToggleActive(u)}
                    title={u.active ? 'Devre disi birak' : 'Aktif et'}
                  >
                    {u.active ? 'Pasif' : 'Aktif'}
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u)} title="Sil">
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}

        {users.length === 0 && (
          <div className="empty-state">
            <UsersIcon size={48} />
            <h3>Henuz kullanici yok</h3>
            <p>Ilk kullaniciyi ekleyerek baslayin.</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="lightbox-overlay" onClick={() => setShowModal(false)}>
          <div className="pause-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h3>{editUser ? 'Kullaniciyi Duzenle' : 'Yeni Kullanici Ekle'}</h3>

            {error && <div className="login-error" style={{ marginTop: 12 }}>{error}</div>}

            <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
              <div className="form-group">
                <label>Kullanici Adi</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="ornek: ahmet"
                  disabled={!!editUser}
                />
              </div>

              <div className="form-group">
                <label>Gorunen Ad</label>
                <input
                  type="text"
                  value={form.display_name}
                  onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                  placeholder="ornek: Ahmet Yilmaz"
                />
              </div>

              <div className="form-group">
                <label>{editUser ? 'Yeni Sifre (bos birakirsaniz degismez)' : 'Sifre'}</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder={editUser ? 'Degistirmek icin yeni sifre girin' : 'Sifre belirleyin'}
                />
              </div>

              <div className="form-group">
                <label>Rol</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="admin">Yonetici (Tam yetki)</option>
                  <option value="editor">Duzenleyici (Olusturma, duzenleme, silme)</option>
                  <option value="viewer">Goruntuleyen (Sadece okuma)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Vazgec</button>
                <button type="submit" className="btn btn-primary">
                  {editUser ? 'Kaydet' : 'Olustur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
