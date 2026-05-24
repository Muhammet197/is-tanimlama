import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Search, Calendar, Play, Pause, RotateCcw, CheckCircle, Edit, Plus, GitBranch, Trash2, X } from 'lucide-react';
import { api } from '../api';

const iconMap = {
  'baslatildi': <Play size={14} color="#10b981" />,
  'tamamlandi': <CheckCircle size={14} color="#10b981" />,
  'Duraklatildi': <Pause size={14} color="#f59e0b" />,
  'devam edildi': <RotateCcw size={14} color="#3b82f6" />,
  'iptal edildi': <X size={14} color="#ef4444" />,
  'geri alindi': <RotateCcw size={14} color="#f59e0b" />,
  'olusturma': <Plus size={14} color="#10b981" />,
  'olusturuldu': <Plus size={14} color="#10b981" />,
  'guncellendi': <Edit size={14} color="#3b82f6" />,
  'Bagimlilik': <GitBranch size={14} color="#8b5cf6" />,
  'kaldirildi': <Trash2 size={14} color="#ef4444" />,
};

function getIcon(note) {
  for (const [key, icon] of Object.entries(iconMap)) {
    if (note && note.includes(key)) return icon;
  }
  return <Activity size={14} color="#6b7280" />;
}

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [persons, setPersons] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [filters, setFilters] = useState({ person: '', job_id: '', search: '', date_from: '', date_to: '' });
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
    api.logs.persons().then(p => setPersons(p.map(r => r.person))).catch(() => {});
    api.jobs.list().then(setJobs).catch(() => {});
  }, []);

  useEffect(() => {
    loadLogs();
  }, [filters.person, filters.job_id, filters.date_from, filters.date_to]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.person) params.person = filters.person;
      if (filters.job_id) params.job_id = filters.job_id;
      if (filters.search) params.search = filters.search;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      const data = await api.logs.list(params);
      setLogs(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setFilters(f => ({ ...f, search: searchInput }));
    loadLogs();
  };

  const clearFilters = () => {
    setFilters({ person: '', job_id: '', search: '', date_from: '', date_to: '' });
    setSearchInput('');
  };

  const hasFilters = filters.person || filters.job_id || filters.search || filters.date_from || filters.date_to;

  // Group logs by date
  const grouped = {};
  logs.forEach(log => {
    const date = log.date || 'Tarihsiz';
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(log);
  });

  return (
    <div>
      <div className="page-header">
        <h1><Activity size={24} /> Aktivite Logu</h1>
      </div>

      {/* Filters */}
      <div className="log-filters">
        <form onSubmit={handleSearch} className="log-search-form">
          <div className="log-search-input-wrap">
            <Search size={16} />
            <input
              type="text"
              className="form-input"
              placeholder="Log ara..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-sm">Ara</button>
        </form>

        <div className="log-filter-selects">
          <select
            className="form-input"
            value={filters.person}
            onChange={e => setFilters(f => ({ ...f, person: e.target.value }))}
          >
            <option value="">Tum kisiler</option>
            {persons.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          <select
            className="form-input"
            value={filters.job_id}
            onChange={e => setFilters(f => ({ ...f, job_id: e.target.value }))}
          >
            <option value="">Tum isler</option>
            {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>

          <div className="log-date-range">
            <Calendar size={14} />
            <input
              type="date"
              className="form-input"
              value={filters.date_from}
              onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
              title="Baslangic tarihi"
            />
            <span>—</span>
            <input
              type="date"
              className="form-input"
              value={filters.date_to}
              onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
              title="Bitis tarihi"
            />
          </div>

          {hasFilters && (
            <button className="btn btn-secondary btn-sm" onClick={clearFilters}>
              <X size={14} /> Temizle
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="log-stats">
        <span>{logs.length} kayit</span>
        {hasFilters && <span className="log-stats-filtered">(filtrelenmis)</span>}
      </div>

      {/* Log Timeline */}
      {loading ? (
        <div className="empty-state"><p>Yukleniyor...</p></div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <Activity size={48} />
          <h3>Henuz log yok</h3>
          <p>Isler uzerinde calisildikca burada gorunecek.</p>
        </div>
      ) : (
        <div className="log-timeline">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date} className="log-date-group">
              <div className="log-date-header">{date}</div>
              {items.map(log => (
                <div key={log.id} className="log-entry">
                  <div className="log-entry-icon">{getIcon(log.note)}</div>
                  <div className="log-entry-content">
                    <div className="log-entry-note">{log.note}</div>
                    <div className="log-entry-meta">
                      <Link to={`/jobs/${log.job_id}`} className="log-entry-job" style={{ borderLeftColor: log.group_color || '#3b82f6' }}>
                        {log.job_title}
                      </Link>
                      {log.group_name && <span className="badge badge-group" style={{ fontSize: 11 }}>{log.group_name}</span>}
                      <span className="log-entry-person">{log.person}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
