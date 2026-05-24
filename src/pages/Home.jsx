import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, FolderOpen, GitBranch, ArrowRight, Download, Upload, Loader, Play, Pause, RotateCcw, MessageSquare, Database, UploadCloud } from 'lucide-react';
import { api, isDesktopMode } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { can } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [groups, setGroups] = useState([]);
  const [deps, setDeps] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    api.jobs.list().then(setJobs).catch(() => {});
    api.groups.list().then(setGroups).catch(() => {});
    api.dependencies.list().then(setDeps).catch(() => {});
    api.sessions.list().then(setSessions).catch(() => {});
  }, []);

  const difficultyMap = { 'Kolay': 'badge-easy', 'Orta': 'badge-medium', 'Karmaşık': 'badge-hard' };

  // ─── Export all data as JSON file ───
  const exportData = async () => {
    setExporting(true);
    try {
      // Fetch full details for each job
      const fullJobs = [];
      for (const job of jobs) {
        const detail = await api.jobs.get(job.id);
        fullJobs.push(detail);
      }

      const exportObj = {
        _format: 'is-tanimlama-backup',
        _version: '1.0',
        _date: new Date().toISOString(),
        _count: { jobs: fullJobs.length, groups: groups.length, dependencies: deps.length },
        groups: groups,
        jobs: fullJobs,
        dependencies: deps,
      };

      const json = JSON.stringify(exportObj, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `is-tanimlama-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Disa aktarim hatasi: ' + err.message);
    }
    setExporting(false);
  };

  // ─── Full database backup ───
  const handleBackup = async () => {
    setBackingUp(true);
    try {
      const data = await api.backup.export();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `is-tanimlama-yedek-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Yedekleme hatasi: ' + err.message);
    }
    setBackingUp(false);
  };

  // ─── Restore from backup ───
  const handleRestore = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!confirm('Dikkat: Mevcut tum veriler silinecek ve yedekten geri yuklenecek. Devam etmek istiyor musunuz?')) return;
      setRestoring(true);
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data._format || !data._format.includes('is-tanimlama')) {
          throw new Error('Gecersiz yedek dosyasi');
        }
        await api.backup.import(data);
        alert('Geri yukleme basarili! Sayfa yenilenecek.');
        window.location.reload();
      } catch (err) {
        alert('Geri yukleme hatasi: ' + err.message);
      }
      setRestoring(false);
    };
    input.click();
  };

  return (
    <div>
      <div className="page-header">
        <h1>Ana Sayfa</h1>
        <div className="export-actions">
          {can('manage_users') && (
            <>
              <button className="btn btn-secondary" onClick={handleBackup} disabled={backingUp}>
                {backingUp ? <><Loader size={16} className="spin" /> Yedekleniyor...</> : <><Database size={16} /> Yedekle</>}
              </button>
              <button className="btn btn-secondary" onClick={handleRestore} disabled={restoring}>
                {restoring ? <><Loader size={16} className="spin" /> Yukleniyor...</> : <><UploadCloud size={16} /> Geri Yukle</>}
              </button>
            </>
          )}
          <button className="btn btn-secondary" onClick={exportData} disabled={exporting || jobs.length === 0}>
            {exporting ? <><Loader size={16} className="spin" /> Aktariliyor...</> : <><Download size={16} /> Veriyi Disa Aktar</>}
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{jobs.length}</div>
          <div className="stat-label">Toplam Is</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{groups.length}</div>
          <div className="stat-label">Grup</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{deps.length}</div>
          <div className="stat-label">Bagimlilik</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{jobs.reduce((sum, j) => sum + (j.step_count || 0), 0)}</div>
          <div className="stat-label">Toplam Adim</div>
        </div>
      </div>

      {/* Active/Paused Sessions */}
      {sessions.length > 0 && (
        <>
          <div className="section-title">Uzerinde Calisilan Isler</div>
          <div className="session-cards">
            {sessions.map(s => {
              const completedCount = s.completed_steps?.length || 0;
              const totalSteps = s.total_steps || 0;
              const pct = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;
              return (
                <Link key={s.id} to={`/jobs/${s.job_id}`} className={`session-card session-card-${s.status}`}>
                  <div className="session-card-header">
                    {s.status === 'active' ? <><div className="session-live-dot" /> <span>Calisiyor</span></> : <><Pause size={14} /> <span>Duraklatildi</span></>}
                  </div>
                  <div className="session-card-title">{s.job_title}</div>
                  {s.group_name && <span className="badge badge-group" style={{ fontSize: 11 }}>{s.group_name}</span>}
                  <div className="session-progress" style={{ marginTop: 8 }}>
                    <div className="session-progress-bar">
                      <div className="session-progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="session-progress-text">{completedCount}/{totalSteps} ({pct}%)</span>
                  </div>
                  {s.status === 'paused' && s.pause_note && (
                    <div className="session-card-note">
                      <MessageSquare size={12} /> {s.pause_note}
                    </div>
                  )}
                  <div className="session-card-action">
                    {s.status === 'paused' ? <><RotateCcw size={14} /> Devam Et</> : <><Play size={14} /> Devam</>}
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      <div className="section-title">Son Eklenen Isler</div>
      <div className="job-grid">
        {jobs.slice(0, 6).map(job => (
          <Link
            key={job.id}
            to={`/jobs/${job.id}`}
            className="job-card"
            style={{ borderLeftColor: job.group_color || '#3b82f6' }}
          >
            <div className="job-card-header">
              <div className="job-card-title">{job.title}</div>
            </div>
            <div className="job-card-meta">
              {job.difficulty && <span className={`badge ${difficultyMap[job.difficulty]}`}>{job.difficulty}</span>}
              {job.group_name && <span className="badge badge-group">{job.group_name}</span>}
            </div>
            <div className="job-card-footer">
              <span>{job.responsible}</span>
              <span>{job.step_count} adim</span>
            </div>
          </Link>
        ))}
      </div>

      {jobs.length === 0 && (
        <div className="empty-state">
          <ClipboardList size={48} />
          <h3>Henuz is eklenmemis</h3>
          <p>Ilk isinizi ekleyerek baslayabilirsiniz.</p>
          <Link to="/jobs/new" className="btn btn-primary">Yeni Is Ekle</Link>
        </div>
      )}
    </div>
  );
}
