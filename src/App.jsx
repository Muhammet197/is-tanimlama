import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, FolderOpen, GitBranch, Plus, Moon, Sun, Monitor, Globe, Download, Activity, Users as UsersIcon, LogOut, Shield } from 'lucide-react';
import { isDesktopMode } from './api';
import { useAuth } from './context/AuthContext';
import Home from './pages/Home';
import Jobs from './pages/Jobs';
import JobDetail from './pages/JobDetail';
import JobForm from './pages/JobForm';
import Groups from './pages/Groups';
import GraphView from './pages/GraphView';
import DataImport from './pages/DataImport';
import Logs from './pages/Logs';
import Login from './pages/Login';
import Users from './pages/Users';

const roleLabels = { admin: 'Yonetici', editor: 'Duzenleyici', viewer: 'Goruntuleyen' };

export default function App() {
  const location = useLocation();
  const { user, logout, can, loading } = useAuth();
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  // Show loading while verifying stored user
  if (loading) {
    return (
      <div className="login-page">
        <div style={{ color: 'var(--text-light)' }}>Yukleniyor...</div>
      </div>
    );
  }

  // Not logged in — show login page
  if (!user) {
    return <Login />;
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <ClipboardList size={22} />
          Is Tanimlama
        </div>
        <div className="sidebar-subtitle">Operasyonel Runbook Sistemi</div>

        {/* Current user info */}
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            {user.display_name.charAt(0).toUpperCase()}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user.display_name}</div>
            <div className="sidebar-user-role">
              <Shield size={10} /> {roleLabels[user.role]}
            </div>
          </div>
        </div>

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
          <NavLink to="/logs" className={({ isActive }) => isActive ? 'active' : ''}>
            <Activity size={18} /> Aktivite Logu
          </NavLink>
        </nav>

        {can('edit') && (
          <>
            <div className="sidebar-section">Hizli Islem</div>
            <nav className="sidebar-nav">
              <NavLink to="/jobs/new" className={({ isActive }) => isActive ? 'active' : ''}>
                <Plus size={18} /> Yeni Is Ekle
              </NavLink>
              {isDesktopMode && (
                <NavLink to="/import" className={({ isActive }) => isActive ? 'active' : ''}>
                  <Download size={18} /> Web'den Aktar
                </NavLink>
              )}
            </nav>
          </>
        )}

        {can('manage_users') && (
          <>
            <div className="sidebar-section">Yonetim</div>
            <nav className="sidebar-nav">
              <NavLink to="/users" className={({ isActive }) => isActive ? 'active' : ''}>
                <UsersIcon size={18} /> Kullanicilar
              </NavLink>
            </nav>
          </>
        )}

        <div style={{ flex: 1 }} />

        <div className="sidebar-mode-badge" title={isDesktopMode ? 'Yerel SQLite veritabanı kullanılıyor' : 'Bulut veritabanı kullanılıyor'}>
          {isDesktopMode ? <Monitor size={14} /> : <Globe size={14} />}
          {isDesktopMode ? 'Masaüstü Modu' : 'Web Modu'}
        </div>

        <button className="theme-toggle" onClick={() => setDark(!dark)}>
          {dark ? <Sun size={18} /> : <Moon size={18} />}
          {dark ? 'Acik Mod' : 'Koyu Mod'}
        </button>

        <button className="theme-toggle sidebar-logout" onClick={logout}>
          <LogOut size={18} /> Cikis Yap
        </button>
      </aside>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/new" element={can('edit') ? <JobForm /> : <Jobs />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/jobs/:id/edit" element={can('edit') ? <JobForm /> : <JobDetail />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/graph" element={<GraphView />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/import" element={<DataImport />} />
          <Route path="/users" element={can('manage_users') ? <Users /> : <Home />} />
        </Routes>
      </main>
    </div>
  );
}
