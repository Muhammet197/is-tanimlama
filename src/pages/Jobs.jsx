import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ClipboardList, Download, FileDown, UserCheck } from 'lucide-react';
import JSZip from 'jszip';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { generateJobMarkdown, generateAnaSayfa, generateGroupMarkdown, downloadFile } from '../utils/export';

export default function Jobs() {
  const { can } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.groups.list().then(setGroups).catch(() => {});
    api.users.list().then(u => setUsers(u.filter(x => x.active))).catch(() => {});
  }, []);

  useEffect(() => {
    const params = {};
    if (search) params.search = search;
    if (groupFilter) params.group_id = groupFilter;
    if (difficultyFilter) params.difficulty = difficultyFilter;
    api.jobs.list(params).then(data => {
      // Client-side filter for assigned_to
      if (assignedFilter) {
        setJobs(data.filter(j => String(j.assigned_to) === String(assignedFilter)));
      } else {
        setJobs(data);
      }
    }).catch(() => {});
  }, [search, groupFilter, difficultyFilter, assignedFilter]);

  const difficultyMap = { 'Kolay': 'badge-easy', 'Orta': 'badge-medium', 'Karmaşık': 'badge-hard' };

  const handleBulkExport = async () => {
    setExporting(true);
    try {
      // Fetch all jobs with full details
      const allJobs = await api.jobs.list({});
      const fullJobs = await Promise.all(allJobs.map(j => api.jobs.get(j.id)));
      const allGroups = await api.groups.list();

      const zip = new JSZip();

      // Ana Sayfa
      zip.file('Ana Sayfa.md', generateAnaSayfa(allJobs, allGroups));

      // Isler folder
      const islerFolder = zip.folder('Isler');
      fullJobs.forEach(job => {
        const safeName = job.title.replace(/[<>:"/\\|?*]/g, '_');
        islerFolder.file(`${safeName}.md`, generateJobMarkdown(job));
      });

      // Gruplar folder
      const gruplarFolder = zip.folder('Gruplar');
      allGroups.forEach(group => {
        const safeName = group.name.replace(/[<>:"/\\|?*]/g, '_');
        gruplarFolder.file(`${safeName}.md`, generateGroupMarkdown(group, allJobs));
      });

      // Generate and download
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'is-tanimlama-export.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Disa aktarim sirasinda hata olustu: ' + err.message);
    }
    setExporting(false);
  };

  return (
    <div>
      <div className="page-header">
        <h1>Isler</h1>
        <div className="export-actions">
          <button
            onClick={handleBulkExport}
            className="btn btn-secondary"
            disabled={exporting}
            title="Tum isleri Markdown + ZIP olarak indir (Obsidian / AI uyumlu)"
          >
            <Download size={16} /> {exporting ? 'Hazirlaniyor...' : 'Toplu Aktar (.zip)'}
          </button>
          {can('edit') && (
            <Link to="/jobs/new" className="btn btn-primary"><Plus size={16} /> Yeni Is</Link>
          )}
        </div>
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
        <select className="filter-select" value={assignedFilter} onChange={e => setAssignedFilter(e.target.value)}>
          <option value="">Tum Kisiler</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
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
