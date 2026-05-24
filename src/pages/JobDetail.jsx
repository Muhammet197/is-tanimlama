import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Edit, Trash2, ArrowLeft, ArrowRight, Clock, User, FolderOpen, FileText, FileDown, Printer, Play, Pause, RotateCcw, CheckCircle, MessageSquare, X, UserCheck } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { generateJobMarkdown, generatePrintHTML, downloadFile } from '../utils/export';

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, can } = useAuth();
  const [job, setJob] = useState(null);
  const [lightboxImg, setLightboxImg] = useState(null);
  const [assignedUser, setAssignedUser] = useState(null);

  // Work session state
  const [session, setSession] = useState(null);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseNote, setPauseNote] = useState('');

  useEffect(() => {
    api.jobs.get(id).then(j => {
      setJob(j);
      if (j.assigned_to) {
        api.users.get(j.assigned_to).then(setAssignedUser).catch(() => {});
      }
    }).catch(() => navigate('/jobs'));
    loadSession();
  }, [id]);

  const loadSession = async () => {
    try {
      const sessions = await api.sessions.list();
      const active = sessions.find(s => String(s.job_id) === String(id) && (s.status === 'active' || s.status === 'paused'));
      if (active) {
        setSession(active);
        setCompletedSteps(active.completed_steps || []);
      } else {
        setSession(null);
        setCompletedSteps([]);
      }
    } catch (e) { /* table may not exist yet */ }
  };

  if (!job) return <div>Yukleniyor...</div>;

  const difficultyMap = { 'Kolay': 'badge-easy', 'Orta': 'badge-medium', 'Karmaşık': 'badge-hard' };
  const depTypeColors = { 'Girdi sağlar': '#10b981', 'Sıralı': '#3b82f6', 'Bilgi paylaşımı': '#f59e0b', 'Onay gerektirir': '#ef4444' };

  const totalSteps = job.steps?.length || 0;
  const doneCount = completedSteps.length;
  const progressPct = totalSteps > 0 ? Math.round((doneCount / totalSteps) * 100) : 0;

  const handleDelete = async () => {
    if (confirm('Bu isi silmek istediginize emin misiniz?')) {
      await api.jobs.delete(id);
      navigate('/jobs');
    }
  };

  const handleExportMD = () => {
    const md = generateJobMarkdown(job);
    const safeName = job.title.replace(/[<>:"/\\|?*]/g, '_');
    downloadFile(md, `${safeName}.md`);
  };

  const handleExportPDF = () => {
    const html = generatePrintHTML(job);
    const printHtml = html.replace(
      '</body>',
      `<script>window.addEventListener('load',function(){setTimeout(function(){window.print()},400)})<\/script></body>`
    );
    const blob = new Blob([printHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (!w) {
      const frame = document.createElement('iframe');
      frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
      document.body.appendChild(frame);
      frame.contentDocument.open();
      frame.contentDocument.write(html);
      frame.contentDocument.close();
      setTimeout(() => { frame.contentWindow.focus(); frame.contentWindow.print(); setTimeout(() => document.body.removeChild(frame), 1000); }, 500);
    }
  };

  const todayStr = () => new Date().toISOString().slice(0, 10);
  const person = () => currentUser?.display_name || job?.responsible || 'Sistem';

  // ─── Work Session Actions ───
  const startSession = async () => {
    try {
      await api.sessions.create({ job_id: Number(id) });
      await api.jobs.addHistory(id, { date: todayStr(), person: person(), note: 'Çalışma başlatıldı' });
      await loadSession();
      setJob(await api.jobs.get(id));
    } catch (e) { alert(e.message); }
  };

  const toggleStep = async (orderNum) => {
    if (!session || session.status !== 'active') return;
    const wasDone = completedSteps.includes(orderNum);
    const updated = wasDone
      ? completedSteps.filter(s => s !== orderNum)
      : [...completedSteps, orderNum];
    setCompletedSteps(updated);

    // Find current step (first uncompleted)
    const allOrders = job.steps.map(s => s.order_num);
    const currentStep = allOrders.find(o => !updated.includes(o)) || 0;

    await api.sessions.update(session.id, {
      status: 'active',
      current_step: currentStep,
      completed_steps: updated,
      pause_note: session.pause_note,
    });

    // Log step toggle
    const stepTitle = job.steps.find(s => s.order_num === orderNum)?.title || `#${orderNum}`;
    const logNote = wasDone
      ? `Adım ${orderNum} geri alındı: ${stepTitle}`
      : `Adım ${orderNum} tamamlandı: ${stepTitle}`;
    await api.jobs.addHistory(id, { date: todayStr(), person: person(), note: logNote });
    setJob(await api.jobs.get(id));
  };

  const pauseSession = async () => {
    if (!session) return;
    const allOrders = job.steps.map(s => s.order_num);
    const currentStep = allOrders.find(o => !completedSteps.includes(o)) || 0;

    await api.sessions.update(session.id, {
      status: 'paused',
      current_step: currentStep,
      completed_steps: completedSteps,
      pause_note: pauseNote,
    });

    const logNote = pauseNote
      ? `Duraklatıldı (${doneCount}/${totalSteps}): ${pauseNote}`
      : `Duraklatıldı (${doneCount}/${totalSteps})`;
    await api.jobs.addHistory(id, { date: todayStr(), person: person(), note: logNote });

    setShowPauseModal(false);
    setPauseNote('');
    await loadSession();
    setJob(await api.jobs.get(id));
  };

  const resumeSession = async () => {
    if (!session) return;
    await api.sessions.resume(session.id);
    await api.jobs.addHistory(id, { date: todayStr(), person: person(), note: `Çalışmaya devam edildi (${doneCount}/${totalSteps})` });
    await loadSession();
    setJob(await api.jobs.get(id));
  };

  const completeSession = async () => {
    if (!session) return;
    await api.sessions.update(session.id, {
      status: 'completed',
      current_step: 0,
      completed_steps: completedSteps,
      pause_note: '',
    });
    await api.jobs.addHistory(id, { date: todayStr(), person: person(), note: `Çalışma tamamlandı (${doneCount}/${totalSteps} adım)` });
    setSession(null);
    setCompletedSteps([]);
    setJob(await api.jobs.get(id));
  };

  const cancelSession = async () => {
    if (!session) return;
    if (confirm('Oturumu iptal etmek istediginize emin misiniz? Ilerleme silinecek.')) {
      await api.sessions.delete(session.id);
      await api.jobs.addHistory(id, { date: todayStr(), person: person(), note: `Çalışma iptal edildi (${doneCount}/${totalSteps} adım tamamlanmıştı)` });
      setSession(null);
      setCompletedSteps([]);
      setJob(await api.jobs.get(id));
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Link to="/jobs" className="btn btn-secondary btn-sm"><ArrowLeft size={14} /> Islere Don</Link>
        <div className="export-actions">
          <button onClick={handleExportMD} className="btn btn-secondary btn-sm" title="Markdown olarak indir"><FileText size={14} /> .md</button>
          <button onClick={handleExportPDF} className="btn btn-secondary btn-sm" title="PDF olarak yazdir"><Printer size={14} /> PDF</button>
        </div>
      </div>

      <div className="detail-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="detail-title">{job.title}</div>
            <div className="detail-meta">
              {job.difficulty && <span className={`badge ${difficultyMap[job.difficulty]}`}>{job.difficulty}</span>}
              {job.group_name && <span className="badge badge-group">{job.group_name}</span>}
              <span className="badge badge-env">{job.status}</span>
            </div>
          </div>
          {can('edit') && (
            <div style={{ display: 'flex', gap: 8 }}>
              <Link to={`/jobs/${id}/edit`} className="btn btn-secondary"><Edit size={14} /> Duzenle</Link>
              <button onClick={handleDelete} className="btn btn-danger"><Trash2 size={14} /> Sil</button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Work Session Panel ─── */}
      {totalSteps > 0 && (
        <div className={`session-panel ${session ? `session-${session.status}` : 'session-idle'}`}>
          {!session ? (
            /* No active session */
            <div className="session-start">
              <div>
                <strong>Bu ise baslamak ister misiniz?</strong>
                <small>Adimlari takip edebilir, duraklatabilir ve kaldginiz yerden devam edebilirsiniz.</small>
              </div>
              <button className="btn btn-primary" onClick={startSession}>
                <Play size={16} /> Calismaya Basla
              </button>
            </div>
          ) : session.status === 'paused' ? (
            /* Paused session */
            <div className="session-paused-info">
              <div className="session-paused-header">
                <Pause size={20} />
                <div>
                  <strong>Duraklatildi</strong>
                  <small>{session.paused_at ? new Date(session.paused_at).toLocaleString('tr-TR') : ''}</small>
                </div>
              </div>
              {session.pause_note && (
                <div className="session-pause-note">
                  <MessageSquare size={14} />
                  <span>{session.pause_note}</span>
                </div>
              )}
              <div className="session-progress">
                <div className="session-progress-bar">
                  <div className="session-progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
                <span className="session-progress-text">{doneCount}/{totalSteps} adim ({progressPct}%)</span>
              </div>
              <div className="session-actions">
                <button className="btn btn-primary" onClick={resumeSession}>
                  <RotateCcw size={16} /> Devam Et
                </button>
                <button className="btn btn-secondary btn-sm" onClick={cancelSession}>
                  <X size={14} /> Iptal
                </button>
              </div>
            </div>
          ) : (
            /* Active session */
            <div className="session-active-info">
              <div className="session-active-header">
                <div className="session-live-dot" />
                <strong>Calisiyor</strong>
                <span className="session-progress-text">{doneCount}/{totalSteps} adim ({progressPct}%)</span>
              </div>
              <div className="session-progress">
                <div className="session-progress-bar">
                  <div className="session-progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
              <div className="session-actions">
                <button className="btn btn-warning" onClick={() => setShowPauseModal(true)}>
                  <Pause size={16} /> Duraklat
                </button>
                {progressPct === 100 && (
                  <button className="btn btn-success" onClick={completeSession}>
                    <CheckCircle size={16} /> Tamamla
                  </button>
                )}
                <button className="btn btn-secondary btn-sm" onClick={cancelSession}>
                  <X size={14} /> Iptal
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="info-grid">
        <div className="info-item">
          <div className="info-label">Sorumlu</div>
          <div className="info-value">{job.responsible || '-'}</div>
        </div>
        <div className="info-item">
          <div className="info-label"><UserCheck size={14} style={{ marginRight: 4 }} />Atanan Kisi</div>
          <div className="info-value">
            {assignedUser ? (
              <span className="assigned-user-badge">
                <span className="assigned-user-avatar">{assignedUser.display_name.charAt(0).toUpperCase()}</span>
                {assignedUser.display_name}
              </span>
            ) : (
              <span style={{ color: 'var(--text-light)' }}>Atanmamis</span>
            )}
          </div>
        </div>
        <div className="info-item">
          <div className="info-label">Periyot</div>
          <div className="info-value">{job.period || '-'}</div>
        </div>
        <div className="info-item">
          <div className="info-label">Tahmini Sure</div>
          <div className="info-value">{job.estimated_duration || '-'}</div>
        </div>
        <div className="info-item">
          <div className="info-label">Zorluk</div>
          <div className="info-value">{job.difficulty || '-'}</div>
        </div>
      </div>

      {job.environments && job.environments.length > 0 && (
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Ortamlar</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {job.environments.map((env, i) => <span key={i} className="badge badge-env">{env}</span>)}
          </div>
        </div>
      )}

      {job.prerequisites && job.prerequisites.length > 0 && (
        <>
          <div className="section-title">On Kosullar</div>
          <div className="card">
            <ul className="checklist">
              {job.prerequisites.map((p, i) => (
                <li key={i}><input type="checkbox" readOnly /> {p}</li>
              ))}
            </ul>
          </div>
        </>
      )}

      {(job.dependencies?.length > 0 || job.dependent_by?.length > 0) && (
        <>
          <div className="section-title">Bagimliliklar</div>
          <div className="card">
            {job.dependencies?.length > 0 && (
              <>
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Bu is tamamlaninca baslatilabilir:</div>
                <div className="dep-list">
                  {job.dependencies.map(dep => (
                    <Link key={dep.id} to={`/jobs/${dep.to_job_id}`} className="dep-item">
                      <ArrowRight size={16} color={depTypeColors[dep.type]} />
                      <span style={{ flex: 1 }}>{dep.to_job_title}</span>
                      <span className="dep-type" style={{ background: depTypeColors[dep.type] + '20', color: depTypeColors[dep.type] }}>{dep.type}</span>
                    </Link>
                  ))}
                </div>
              </>
            )}
            {job.dependent_by?.length > 0 && (
              <>
                <div style={{ fontWeight: 600, marginBottom: 8, marginTop: 16, fontSize: 14 }}>Bu is sunlara bagimli:</div>
                <div className="dep-list">
                  {job.dependent_by.map(dep => (
                    <Link key={dep.id} to={`/jobs/${dep.from_job_id}`} className="dep-item">
                      <ArrowLeft size={16} color={depTypeColors[dep.type]} />
                      <span style={{ flex: 1 }}>{dep.from_job_title}</span>
                      <span className="dep-type" style={{ background: depTypeColors[dep.type] + '20', color: depTypeColors[dep.type] }}>{dep.type}</span>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {job.steps && job.steps.length > 0 && (
        <>
          <div className="section-title">Adimlar ({job.steps.length})</div>
          {job.steps.map((step) => {
            const isDone = completedSteps.includes(step.order_num);
            const isActive = session?.status === 'active';
            return (
              <div key={step.id} className={`step-item ${isDone ? 'step-done' : ''} ${isActive ? 'step-clickable' : ''}`}>
                {session && (
                  <div className="step-check" onClick={() => isActive && toggleStep(step.order_num)}>
                    {isDone ? <CheckCircle size={22} color="#10b981" /> : <div className="step-check-empty" />}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div className="step-number">{step.order_num}</div>
                  <div className={`step-title ${isDone ? 'step-title-done' : ''}`}>{step.title}</div>
                  <div className="step-env">{step.environment}</div>
                  <div className="step-desc">{step.description}</div>
                  {step.tip && <div className="step-tip">Ipucu: {step.tip}</div>}
                  {step.warning && <div className="step-warning">Dikkat: {step.warning}</div>}
                  {step.screenshot_url && (
                    <div className="step-screenshot">
                      <img src={step.screenshot_url} alt={`${step.title} ekran goruntusu`} onClick={() => setLightboxImg(step.screenshot_url)} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}

      {job.notes && (
        <>
          <div className="section-title">Notlar</div>
          <div className="card" style={{ whiteSpace: 'pre-wrap' }}>{job.notes}</div>
        </>
      )}

      {job.history && job.history.length > 0 && (
        <>
          <div className="section-title">Gecmis</div>
          <div className="card">
            <table className="history-table">
              <thead><tr><th>Tarih</th><th>Yapan</th><th>Not</th></tr></thead>
              <tbody>
                {job.history.map(h => (
                  <tr key={h.id}><td>{h.date}</td><td>{h.person}</td><td>{h.note}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Lightbox */}
      {lightboxImg && (
        <div className="lightbox-overlay" onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} alt="Buyuk gorunum" />
        </div>
      )}

      {/* Pause Modal */}
      {showPauseModal && (
        <div className="lightbox-overlay" onClick={() => setShowPauseModal(false)}>
          <div className="pause-modal" onClick={e => e.stopPropagation()}>
            <h3><Pause size={20} /> Isi Duraklat</h3>
            <p style={{ color: 'var(--text-light)', margin: '8px 0 16px' }}>
              Kaldginiz yeri not edin — dondugunde hatirlayin:
            </p>
            <textarea
              className="form-input"
              rows={4}
              value={pauseNote}
              onChange={e => setPauseNote(e.target.value)}
              placeholder="Ornek: 3. adimi bitirdim, 4. adimda API key lazim, Ahmet'ten istemem gerekiyor..."
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowPauseModal(false)}>Vazgec</button>
              <button className="btn btn-warning" onClick={pauseSession}>
                <Pause size={14} /> Duraklat ve Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
