import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, FolderOpen, GitBranch, ArrowRight } from 'lucide-react';
import { api } from '../api';

export default function Home() {
  const [jobs, setJobs] = useState([]);
  const [groups, setGroups] = useState([]);
  const [deps, setDeps] = useState([]);

  useEffect(() => {
    api.jobs.list().then(setJobs).catch(() => {});
    api.groups.list().then(setGroups).catch(() => {});
    api.dependencies.list().then(setDeps).catch(() => {});
  }, []);

  const difficultyMap = { 'Kolay': 'badge-easy', 'Orta': 'badge-medium', 'Karmaşık': 'badge-hard' };

  return (
    <div>
      <div className="page-header">
        <h1>Ana Sayfa</h1>
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
