import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

// Simple SHA-256 hash for passwords
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + '__is_tanimlama_salt_2026');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('currentUser');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  // On mount, verify stored user still exists
  useEffect(() => {
    const verify = async () => {
      if (user) {
        try {
          const found = await api.users.get(user.id);
          if (!found || !found.active) {
            logout();
          } else {
            // Update stored data in case role changed
            const updated = { ...user, role: found.role, display_name: found.display_name };
            setUser(updated);
            localStorage.setItem('currentUser', JSON.stringify(updated));
          }
        } catch {
          // API not ready yet, keep stored user
        }
      }
      setLoading(false);
    };
    verify();
  }, []);

  const login = async (username, password) => {
    const hash = await hashPassword(password);
    const result = await api.users.login({ username, password_hash: hash });
    if (result.error) throw new Error(result.error);
    const userData = {
      id: result.id,
      username: result.username,
      display_name: result.display_name,
      role: result.role,
    };
    setUser(userData);
    localStorage.setItem('currentUser', JSON.stringify(userData));
    return userData;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('currentUser');
  };

  // Role-based permission check
  const can = (action) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'editor') {
      return ['view', 'edit', 'create', 'delete', 'session'].includes(action);
    }
    // viewer
    return action === 'view';
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, can, loading, hashPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { hashPassword };
