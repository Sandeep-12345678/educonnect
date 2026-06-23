import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import OAuthButtons from './OAuthButtons';
import api from '../utils/api';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();

  // 2FA state
  const [twoFactorMode, setTwoFactorMode] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [backupCode, setBackupCode] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { username, password });
      
      if (res.data.requires_2fa) {
        setTempToken(res.data.temp_token);
        setTwoFactorMode(true);
        setError('');
      } else {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        setUser(res.data.user);
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handle2FAVerify = async (e) => {
    e.preventDefault();
    if (!totpCode && !backupCode) {
      setError('Enter a 6-digit code or backup code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/totp/verify', {
        temp_token: tempToken,
        code: totpCode || undefined,
        backup_code: backupCode || undefined
      });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      setUser(res.data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid 2FA code');
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>🦞 Welcome Back</h1>
        <p className="subtitle">{twoFactorMode ? 'Two-Factor Authentication' : 'Log in to EduConnect'}</p>

        {error && <div className="auth-error">{error}</div>}

        {!twoFactorMode ? (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Username or Email</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="yourname or email@school.edu"
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handle2FAVerify}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🔐</div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Enter the 6-digit code from your authenticator app, or use a backup code.
              </p>
            </div>
            <div className="form-group">
              <label>Authenticator Code</label>
              <input
                type="text"
                value={totpCode}
                onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                style={{ textAlign: 'center', fontSize: '1.4rem', letterSpacing: 8, fontWeight: 700 }}
                autoFocus
                disabled={!!backupCode}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '12px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>or use backup</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <div className="form-group">
              <label>Backup Code</label>
              <input
                type="text"
                value={backupCode}
                onChange={e => setBackupCode(e.target.value.toUpperCase())}
                placeholder="XXXXXXXX"
                maxLength={8}
                style={{ textAlign: 'center', fontSize: '1.1rem', letterSpacing: 4 }}
                disabled={!!totpCode}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={loading || (!totpCode && !backupCode)}>
              {loading ? 'Verifying...' : 'Verify'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => { setTwoFactorMode(false); setTotpCode(''); setBackupCode(''); }}
              style={{ width: '100%', marginTop: 8 }}>
              ← Back to login
            </button>
          </form>
        )}

        {!twoFactorMode && (
          <>
            <p className="footer-text" style={{ marginTop: 12 }}>
              New student? <Link to="/register">Create an account</Link>
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <OAuthButtons />
          </>
        )}
      </div>
    </div>
  );
}
