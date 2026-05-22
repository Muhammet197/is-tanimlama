import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, FolderOpen, GitBranch, Plus, Moon, Sun } from 'lucide-react';
import Home from './pages/Home';
import Jobs from './pages/Jobs';
import JobDetail from './pages/JobDetail';
import JobForm from './pages/JobForm';
import Groups from './pages/Groups';
import GraphView from './pages/GraphView';

export default function App() {
  const location = useLocation();
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <ClipboardList size={22} />
          Is Tanimlama
        </div>
        <div className="sidebar-subtitle">Operasyonel Runbook Sistemi</div>

        <div className="sidebar-section">Ana Menu</div>
        <nav className="sidebar-nav">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
            <LayoutDashboard size={18} /> Ana Sayfa
          </NavLink>
          <NavLink to="/jobs" className={({ isActive }) => isActive || location.pathname.startsWith('/jobs') ? 'active' : ''}>
            <ClipboardList size={18} /> Isler
          </NavLink>
          <NavLink to="/groups" className={({ isActive }) => isActive ? 'active' : ''}>
            <FolderOpen size={18} /> Gruplar
          </NavLink>
          <NavLink to="/graph" className={({ isActive }) => isActive ? 'active' : ''}>
            <GitBranch size={18} /> Bagimlilik Haritasi
          </NavLink>
        </nav>

        <div className="sidebar-section">Hizli Islem</div>
        <nav className="sidebar-nav">
          <NavLink to="/jobs/new" className={({ isActive }) => isActive ? 'active' : ''}>
            <Plus size={18} /> Yeni Is Ekle
          </NavLink>
        </nav>

        <div style={{ flex: 1 }} />

        <button className="theme-toggle" onClick={() => setDark(!dark)}>
          {dark ? <Sun size={18} /> : <Moon size={18} />}
          {dark ? 'Acik Mod' : 'Koyu Mod'}
        </button>
      </aside>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/new" element={<JobForm />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/jobs/:id/edit" element={<JobForm />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/graph" element={<GraphView />} />
        </Routes>
      </main>
    </div>
  );
}
