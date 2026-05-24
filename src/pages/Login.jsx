import { useState } from 'react';
import { ClipboardList, LogIn, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Kullanici adi ve sifre zorunludur');
      return;
    }

    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err.message || 'Giris basarisiz');
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <ClipboardList size={36} />
          <h1>Is Tanimlama</h1>
          <p>Operasyonel Runbook Sistemi</p>
        </div>

        {error && (
          <div className="login-error">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Kullanici Adi</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Kullanici adinizi girin"
              autoFocus
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label>Sifre</label>
            <div className="login-password-wrap">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Sifrenizi girin"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPass(!showPass)}
                tabIndex={-1}
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading ? 'Giris yapiliyor...' : <><LogIn size={18} /> Giris Yap</>}
          </button>
        </form>

        <div className="login-footer">
          <small>Varsayilan: admin / admin123</small>
        </div>
      </div>
    </div>
  );
}
