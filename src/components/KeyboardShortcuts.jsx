import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const shortcuts = [
  { key: '1', ctrl: true, label: 'Ana Sayfa', path: '/' },
  { key: '2', ctrl: true, label: 'Isler', path: '/jobs' },
  { key: '3', ctrl: true, label: 'Gruplar', path: '/groups' },
  { key: '4', ctrl: true, label: 'Bagimlilik Haritasi', path: '/graph' },
  { key: '5', ctrl: true, label: 'Aktivite Logu', path: '/logs' },
  { key: 'n', ctrl: true, label: 'Yeni Is', path: '/jobs/new', requireEdit: true },
  { key: 'u', ctrl: true, label: 'Kullanicilar', path: '/users', requireAdmin: true },
];

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      // Don't intercept if typing in input/textarea
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Ctrl+K or ? — show help
      if ((e.ctrlKey && e.key === 'k') || (e.key === '?' && !e.ctrlKey)) {
        e.preventDefault();
        setShowHelp(prev => !prev);
        return;
      }

      // Escape — close help or go back
      if (e.key === 'Escape') {
        if (showHelp) {
          setShowHelp(false);
        }
        return;
      }

      // Ctrl+number or Ctrl+letter shortcuts
      if (e.ctrlKey) {
        const match = shortcuts.find(s => s.key === e.key);
        if (match) {
          if (match.requireEdit && !can('edit')) return;
          if (match.requireAdmin && !can('manage_users')) return;
          e.preventDefault();
          navigate(match.path);
          setShowHelp(false);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, can, showHelp]);

  return { showHelp, setShowHelp, shortcuts };
}

export function ShortcutHelpModal({ showHelp, setShowHelp, shortcuts }) {
  const { can } = useAuth();

  if (!showHelp) return null;

  const visibleShortcuts = shortcuts.filter(s => {
    if (s.requireEdit && !can('edit')) return false;
    if (s.requireAdmin && !can('manage_users')) return false;
    return true;
  });

  return (
    <div className="lightbox-overlay" onClick={() => setShowHelp(false)}>
      <div className="shortcut-modal" onClick={e => e.stopPropagation()}>
        <h3>Klavye Kisayollari</h3>
        <div className="shortcut-list">
          {visibleShortcuts.map(s => (
            <div key={s.key} className="shortcut-item">
              <kbd className="shortcut-key">Ctrl + {s.key.toUpperCase()}</kbd>
              <span>{s.label}</span>
            </div>
          ))}
          <div className="shortcut-item">
            <kbd className="shortcut-key">Ctrl + K</kbd>
            <span>Kisayollari goster/gizle</span>
          </div>
          <div className="shortcut-item">
            <kbd className="shortcut-key">?</kbd>
            <span>Kisayollari goster/gizle</span>
          </div>
          <div className="shortcut-item">
            <kbd className="shortcut-key">Esc</kbd>
            <span>Kapat</span>
          </div>
        </div>
      </div>
    </div>
  );
}
