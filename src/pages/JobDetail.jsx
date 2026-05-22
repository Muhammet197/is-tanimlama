import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Edit, Trash2, ArrowLeft, ArrowRight, Clock, User, FolderOpen, FileText, FileDown, Printer } from 'lucide-react';
import { api } from '../api';
import { generateJobMarkdown, generatePrintHTML, downloadFile } from '../utils/export';

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [checklist, setChecklist] = useState({});
  const [lightboxImg, setLightboxImg] = useState(null);

  useEffect(() => {
    api.jobs.get(id).then(setJob).catch(() => navigate('/jobs'));
  }, [id]);

  if (!job) return <div>Yukleniyor...</div>;

  const difficultyMap = { 'Kolay': 'badge-easy', 'Orta': 'badge-medium', 'Karmaşık': 'badge-hard' };
  const depTypeColors = { 'Girdi sağlar': '#10b981', 'Sıralı': '#3b82f6', 'Bilgi paylaşımı': '#f59e0b', 'Onay gerektirir': '#ef4444' };

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
    const w = window.open('', '_blank', 'width=900,height=700');
    w.document.write(html);
    w.document.close();
    w.onload = () => setTimeout(() => w.print(), 300);
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Link to="/jobs" className="btn btn-secondary btn-sm"><ArrowLeft size={14} /> Islere Don</Link>
        <div className="export-actions">
          <button onClick={handleExportMD} className="btn btn-secondary btn-sm" title="Markdown olarak indir (AI-uyumlu)"><FileText size={14} /> .md</button>
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
          <div style={{ display: 'flex', gap: 8 }}>
            <Link to={`/jobs/${id}/edit`} className="btn btn-secondary"><Edit size={14} /> Duzenle</Link>
            <button onClick={handleDelete} className="btn btn-danger"><Trash2 size={14} /> Sil</button>
          </div>
        </div>
      </div>

      <div className="info-grid">
        <div className="info-item">
          <div className="info-label">Sorumlu</div>
          <div className="info-value">{job.responsible || '-'}</div>
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
                      <span className="dep-type" style={{ background: depTypeColors[dep.type] + '20', color: depTypeColors[dep.type] }}>
                        {dep.type}
                      </span>
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
                      <span className="dep-type" style={{ background: depTypeColors[dep.type] + '20', color: depTypeColors[dep.type] }}>
                        {dep.type}
                      </span>
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
          {job.steps.map((step) => (
            <div key={step.id} className="step-item">
              <div className="step-number">{step.order_num}</div>
              <div className="step-title">{step.title}</div>
              <div className="step-env">{step.environment}</div>
              <div className="step-desc">{step.description}</div>
              {step.tip && <div className="step-tip">Ipucu: {step.tip}</div>}
              {step.warning && <div className="step-warning">Dikkat: {step.warning}</div>}
              {step.screenshot_url && (
                <div className="step-screenshot">
                  <img
                    src={step.screenshot_url}
                    alt={`${step.title} ekran goruntusu`}
                    onClick={() => setLightboxImg(step.screenshot_url)}
                  />
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {job.steps && job.steps.length > 0 && (
        <>
          <div className="section-title">Kontrol Listesi</div>
          <div className="card">
            <ul className="checklist">
              {job.steps.map((step) => (
                <li key={step.id}>
                  <input
                    type="checkbox"
                    checked={!!checklist[step.id]}
                    onChange={() => setChecklist(prev => ({ ...prev, [step.id]: !prev[step.id] }))}
                  />
                  Adim {step.order_num}: {step.title}
                </li>
              ))}
              <li>
                <input
                  type="checkbox"
                  checked={!!checklist['done']}
                  onChange={() => setChecklist(prev => ({ ...prev, done: !prev.done }))}
                />
                <strong>Is tamamlandi ve onaylandi</strong>
              </li>
            </ul>
          </div>
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
              <thead>
                <tr><th>Tarih</th><th>Yapan</th><th>Not</th></tr>
              </thead>
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
    </div>
  );
}
