import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ClipboardList } from 'lucide-react';
import { api } from '../api';

export default function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');

  useEffect(() => {
    api.groups.list().then(setGroups).catch(() => {});
  }, []);

  useEffect(() => {
    const params = {};
    if (search) params.search = search;
    if (groupFilter) params.group_id = groupFilter;
    if (difficultyFilter) params.difficulty = difficultyFilter;
    api.jobs.list(params).then(setJobs).catch(() => {});
  }, [search, groupFilter, difficultyFilter]);

  const difficultyMap = { 'Kolay': 'badge-easy', 'Orta': 'badge-medium', 'Karmaşık': 'badge-hard' };

  return (
    <div>
      <div className="page-header">
        <h1>Isler</h1>
        <Link to="/jobs/new" className="btn btn-primary"><Plus size={16} /> Yeni Is</Link>
      </div>

      <div className="search-bar">
        <input
          type="text"
          className="search-input"
          placeholder="Is ara (baslik, sorumlu, not...)"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="filter-select" value={groupFilter} onChange={e => setGroupFilter(e.target.value)}>
          <option value="">Tum Gruplar</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select className="filter-select" value={difficultyFilter} onChange={e => setDifficultyFilter(e.target.value)}>
          <option value="">Tum Zorluklar</option>
          <option value="Kolay">Kolay</option>
          <option value="Orta">Orta</option>
          <option value="Karmaşık">Karmasik</option>
        </select>
      </div>

      {jobs.length > 0 ? (
        <div className="job-grid">
          {jobs.map(job => (
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
                {job.period && <span className="badge badge-env">{job.period}</span>}
              </div>
              <div className="job-card-footer">
                <span>{job.responsible}</span>
                <span>{job.step_count} adim</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <ClipboardList size={48} />
          <h3>Is bulunamadi</h3>
          <p>Arama kriterlerinize uygun is yok veya henuz is eklenmemis.</p>
          <Link to="/jobs/new" className="btn btn-primary">Yeni Is Ekle</Link>
        </div>
      )}
    </div>
  );
}
