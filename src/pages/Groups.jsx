import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit, Trash2, FolderOpen } from 'lucide-react';
import { api } from '../api';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export default function Groups() {
  const [groups, setGroups] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editGroup, setEditGroup] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', color: '#3b82f6' });
  const [error, setError] = useState('');

  const load = () => api.groups.list().then(setGroups).catch(() => {});
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditGroup(null); setForm({ name: '', description: '', color: '#3b82f6' }); setError(''); setShowModal(true); };
  const openEdit = (g) => { setEditGroup(g); setForm({ name: g.name, description: g.description || '', color: g.color || '#3b82f6' }); setError(''); setShowModal(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Grup adi zorunludur'); return; }
    try {
      if (editGroup) {
        await api.groups.update(editGroup.id, form);
      } else {
        await api.groups.create(form);
      }
      setShowModal(false);
      load();
    } catch (err) { setError(err.message); }
  };

  const handleDelete = async (id) => {
    if (confirm('Bu grubu silmek istediginize emin misiniz? Gruptaki isler grupsuz kalacaktir.')) {
      await api.groups.delete(id);
      load();
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Gruplar</h1>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Yeni Grup</button>
      </div>

      {groups.length > 0 ? (
        <div className="group-grid">
          {groups.map(g => (
            <div key={g.id} className="group-card" style={{ borderTopColor: g.color || '#3b82f6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="group-card-title">{g.name}</div>
                  <div className="group-card-desc">{g.description || 'Aciklama eklenmemis'}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn-icon" onClick={() => openEdit(g)}><Edit size={16} /></button>
                  <button className="btn-icon" onClick={() => handleDelete(g.id)}><Trash2 size={16} /></button>
                </div>
              </div>
              <div className="group-card-count">{g.job_count} is</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <FolderOpen size={48} />
          <h3>Henuz grup eklenmemis</h3>
          <p>Isleri kategorilendirmek icin gruplar olusturun.</p>
          <button className="btn btn-primary" onClick={openNew}>Yeni Grup Olustur</button>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editGroup ? 'Grubu Duzenle' : 'Yeni Grup'}</div>
            {error && <div style={{ padding: 8, background: '#fef2f2', color: '#991b1b', borderRadius: 6, marginBottom: 12, fontSize: 13 }}>{error}</div>}
            <div className="form-group">
              <label>Grup Adi *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ornegin: Dokuman Islemleri" />
            </div>
            <div className="form-group">
              <label>Aciklama</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Bu grubun amaci..." rows={3} />
            </div>
            <div className="form-group">
              <label>Renk</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {COLORS.map(c => (
                  <div key={c} onClick={() => setForm({ ...form, color: c })}
                    style={{ width: 32, height: 32, borderRadius: '50%', background: c, cursor: 'pointer', border: form.color === c ? '3px solid #1e293b' : '3px solid transparent', transition: 'border 0.15s' }} />
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Iptal</button>
              <button className="btn btn-primary" onClick={handleSave}>{editGroup ? 'Kaydet' : 'Olustur'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
