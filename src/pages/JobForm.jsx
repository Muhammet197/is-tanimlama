import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Image } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function JobForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const isEdit = !!id;

  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    title: '', responsible: '', group_id: '', period: '', estimated_duration: '',
    difficulty: 'Orta', environments: [], prerequisites: [], notes: '', status: 'aktif',
    assigned_to: ''
  });
  const [steps, setSteps] = useState([]);
  const [envInput, setEnvInput] = useState('');
  const [preqInput, setPreqInput] = useState('');
  const [error, setError] = useState('');

  // Store original data for change detection
  const [originalForm, setOriginalForm] = useState(null);
  const [originalStepCount, setOriginalStepCount] = useState(0);

  useEffect(() => {
    api.groups.list().then(setGroups).catch(() => {});
    api.users.list().then(u => setUsers(u.filter(x => x.active))).catch(() => {});
    if (isEdit) {
      api.jobs.get(id).then(job => {
        const formData = {
          title: job.title, responsible: job.responsible || '', group_id: job.group_id || '',
          period: job.period || '', estimated_duration: job.estimated_duration || '',
          difficulty: job.difficulty || 'Orta', environments: job.environments || [],
          prerequisites: job.prerequisites || [], notes: job.notes || '', status: job.status || 'aktif',
          assigned_to: job.assigned_to || ''
        };
        setForm(formData);
        setOriginalForm(formData);
        setOriginalStepCount((job.steps || []).length);
        setSteps((job.steps || []).map(s => ({
          title: s.title || '', environment: s.environment || '', description: s.description || '',
          tip: s.tip || '', warning: s.warning || '', screenshot_url: s.screenshot_url || ''
        })));
      }).catch(() => navigate('/jobs'));
    }
  }, [id]);

  const setField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const addTag = (field, input, setInput) => {
    if (input.trim()) {
      setForm(prev => ({ ...prev, [field]: [...prev[field], input.trim()] }));
      setInput('');
    }
  };

  const removeTag = (field, index) => {
    setForm(prev => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }));
  };

  const addStep = () => {
    setSteps(prev => [...prev, { title: '', environment: '', description: '', tip: '', warning: '', screenshot_url: '' }]);
  };

  const updateStep = (index, field, value) => {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const removeStep = (index) => {
    setSteps(prev => prev.filter((_, i) => i !== index));
  };

  const handleFileUpload = (index, e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Dosya boyutu 2MB\'dan kucuk olmali');
      return;
    }
    if (!file.type.startsWith('image/')) {
      alert('Sadece resim dosyalari yuklenebilir');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      updateStep(index, 'screenshot_url', ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Build a human-readable change summary
  const buildChangeSummary = () => {
    if (!originalForm) return '';
    const changes = [];
    const labels = {
      title: 'Baslik', responsible: 'Sorumlu', difficulty: 'Zorluk',
      period: 'Periyot', estimated_duration: 'Tahmini sure', status: 'Durum', notes: 'Notlar'
    };

    for (const key of Object.keys(labels)) {
      if (form[key] !== originalForm[key]) {
        if (originalForm[key] && form[key]) {
          changes.push(`${labels[key]}: ${originalForm[key]} → ${form[key]}`);
        } else if (form[key]) {
          changes.push(`${labels[key]} eklendi`);
        } else {
          changes.push(`${labels[key]} kaldirildi`);
        }
      }
    }

    // Group change
    if (String(form.group_id || '') !== String(originalForm.group_id || '')) {
      changes.push('Grup degistirildi');
    }

    // Step count change
    if (steps.length !== originalStepCount) {
      const diff = steps.length - originalStepCount;
      changes.push(diff > 0 ? `${diff} yeni adim eklendi` : `${Math.abs(diff)} adim cikarildi`);
    }

    return changes.length > 0 ? changes.join(', ') : 'Kucuk duzenlemeler';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.title.trim()) {
      setError('Is basligi zorunludur');
      return;
    }

    try {
      const data = { ...form, group_id: form.group_id || null, assigned_to: form.assigned_to || null, steps };
      if (isEdit) {
        await api.jobs.update(id, data);
        // Log what changed
        const summary = buildChangeSummary();
        const today = new Date().toISOString().slice(0, 10);
        await api.jobs.addHistory(id, {
          date: today,
          person: currentUser?.display_name || form.responsible || 'Sistem',
          note: `Is guncellendi: ${summary}`
        });
        navigate(`/jobs/${id}`);
      } else {
        const result = await api.jobs.create(data);
        navigate(`/jobs/${result.id}`);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link to={isEdit ? `/jobs/${id}` : '/jobs'} className="btn btn-secondary btn-sm">
          <ArrowLeft size={14} /> Geri Don
        </Link>
      </div>

      <div className="page-header">
        <h1>{isEdit ? 'Isi Duzenle' : 'Yeni Is Ekle'}</h1>
      </div>

      {error && <div style={{ padding: 12, background: '#fef2f2', color: '#991b1b', borderRadius: 8, marginBottom: 16 }}>{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Genel Bilgi</h3>
          <div className="form-group">
            <label>Is Basligi *</label>
            <input type="text" value={form.title} onChange={e => setField('title', e.target.value)} placeholder="Ornegin: Dokuman Hazirlama ve Onay Sureci" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Sorumlu</label>
              <input type="text" value={form.responsible} onChange={e => setField('responsible', e.target.value)} placeholder="Ornegin: Ahmet" />
            </div>
            <div className="form-group">
              <label>Atanan Kisi</label>
              <select value={form.assigned_to} onChange={e => setField('assigned_to', e.target.value)}>
                <option value="">Atanmamis</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.display_name} (@{u.username})</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Grup</label>
              <select value={form.group_id} onChange={e => setField('group_id', e.target.value)}>
                <option value="">Grup Sec</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Periyot</label>
              <input type="text" value={form.period} onChange={e => setField('period', e.target.value)} placeholder="Ornegin: 3 ayda bir, Haftalik" />
            </div>
            <div className="form-group">
              <label>Tahmini Sure</label>
              <input type="text" value={form.estimated_duration} onChange={e => setField('estimated_duration', e.target.value)} placeholder="Ornegin: ~2 saat" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Zorluk</label>
              <select value={form.difficulty} onChange={e => setField('difficulty', e.target.value)}>
                <option value="Kolay">Kolay</option>
                <option value="Orta">Orta</option>
                <option value="Karmaşık">Karmasik</option>
              </select>
            </div>
            <div className="form-group">
              <label>Durum</label>
              <select value={form.status} onChange={e => setField('status', e.target.value)}>
                <option value="aktif">Aktif</option>
                <option value="pasif">Pasif</option>
                <option value="taslak">Taslak</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 16 }}>Ortamlar</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" value={envInput} onChange={e => setEnvInput(e.target.value)}
              placeholder="Ortam ekle (ornegin: Microsoft Word)" style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--bg-input)', color: 'var(--text)' }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag('environments', envInput, setEnvInput); }}} />
            <button type="button" className="btn btn-secondary" onClick={() => addTag('environments', envInput, setEnvInput)}>Ekle</button>
          </div>
          <div className="tags-container">
            {form.environments.map((env, i) => (
              <span key={i} className="tag">{env} <button type="button" onClick={() => removeTag('environments', i)}>&times;</button></span>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 16 }}>On Kosullar</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" value={preqInput} onChange={e => setPreqInput(e.target.value)}
              placeholder="On kosul ekle" style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--bg-input)', color: 'var(--text)' }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag('prerequisites', preqInput, setPreqInput); }}} />
            <button type="button" className="btn btn-secondary" onClick={() => addTag('prerequisites', preqInput, setPreqInput)}>Ekle</button>
          </div>
          <div className="tags-container">
            {form.prerequisites.map((p, i) => (
              <span key={i} className="tag">{p} <button type="button" onClick={() => removeTag('prerequisites', i)}>&times;</button></span>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3>Adimlar ({steps.length})</h3>
            <button type="button" className="btn btn-primary btn-sm" onClick={addStep}><Plus size={14} /> Adim Ekle</button>
          </div>

          {steps.map((step, i) => (
            <div key={i} className="step-form-item">
              <div className="step-form-header">
                <strong>Adim {i + 1}</strong>
                <button type="button" className="btn-icon" onClick={() => removeStep(i)}><Trash2 size={16} /></button>
              </div>
              <div className="form-group">
                <label>Adim Basligi</label>
                <input type="text" value={step.title} onChange={e => updateStep(i, 'title', e.target.value)} placeholder="Ornegin: Word Sablon Dosyasini Ac" />
              </div>
              <div className="form-group">
                <label>Ortam</label>
                <input type="text" value={step.environment} onChange={e => updateStep(i, 'environment', e.target.value)} placeholder="Ornegin: Dosya Gezgini + Microsoft Word" />
              </div>
              <div className="form-group">
                <label>Aciklama</label>
                <textarea value={step.description} onChange={e => updateStep(i, 'description', e.target.value)} placeholder="Adimin detayli aciklamasi..." />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Ipucu (opsiyonel)</label>
                  <input type="text" value={step.tip || ''} onChange={e => updateStep(i, 'tip', e.target.value)} placeholder="Faydali bir ipucu..." />
                </div>
                <div className="form-group">
                  <label>Uyari (opsiyonel)</label>
                  <input type="text" value={step.warning || ''} onChange={e => updateStep(i, 'warning', e.target.value)} placeholder="Dikkat edilecek nokta..." />
                </div>
              </div>

              {/* Screenshot section */}
              <div className="form-group">
                <label><Image size={13} style={{ marginRight: 4 }} />Ekran Goruntusu (opsiyonel)</label>
                <div className="screenshot-input-row">
                  <input
                    type="text"
                    value={step.screenshot_url || ''}
                    onChange={e => updateStep(i, 'screenshot_url', e.target.value)}
                    placeholder="Resim URL'si yapistir veya dosya yukle..."
                  />
                  <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <Image size={13} /> Yukle
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={e => handleFileUpload(i, e)}
                    />
                  </label>
                </div>
                {step.screenshot_url && (
                  <div className="screenshot-preview">
                    <img src={step.screenshot_url} alt="Onizleme" onError={e => e.target.style.display = 'none'} />
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      style={{ marginTop: 4 }}
                      onClick={() => updateStep(i, 'screenshot_url', '')}
                    >
                      <Trash2 size={12} /> Resmi Kaldir
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {steps.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
              Henuz adim eklenmemis. "Adim Ekle" butonuna tiklayin.
            </div>
          )}
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 16 }}>Notlar</h3>
          <div className="form-group">
            <textarea value={form.notes} onChange={e => setField('notes', e.target.value)}
              placeholder="Ek bilgiler, sik karsilasilan sorunlar veya dikkat edilecek noktalar..." rows={4} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <Link to={isEdit ? `/jobs/${id}` : '/jobs'} className="btn btn-secondary">Iptal</Link>
          <button type="submit" className="btn btn-primary">{isEdit ? 'Kaydet' : 'Olustur'}</button>
        </div>
      </form>
    </div>
  );
}
