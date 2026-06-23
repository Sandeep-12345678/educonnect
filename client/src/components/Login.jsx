import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import OAuthButtons from './OAuthButtons';
import api from '../utils/api';

export default function Login() {
  const [mode, setMode] = useState('password'); // password | email_code | forgot | reset
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [demoCode, setDemoCode] = useState('');
  const { setUser } = useAuth();
  const navigate = useNavigate();

  // 2FA state
  const [twoFactorMode, setTwoFactorMode] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [backupCode, setBackupCode] = useState('');

  // ====== Password Login ======
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { username, password });
      if (res.data.requires_2fa) {
        setTempToken(res.data.temp_token);
        setTwoFactorMode(true);
      } else {
        login(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
    setLoading(false);
  };

  // ====== Send Email Code ======
  const handleSendEmailCode = async (e) => {
    e?.preventDefault();
    setError(''); setSuccess('');
    if (!email) { setError('Enter your email'); return; }
    setLoading(true);
    try {
      const res = await api.post('/passcode/send-email', { email, type: 'login' });
      setCodeSent(true);
      setDemoCode(res.data.demo_code || '');
      setSuccess(`Code sent to ${email}${res.data.demo_code ? ' (demo: ' + res.data.demo_code + ')' : ''}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send code');
    }
    setLoading(false);
  };

  // ====== Verify Email Code Login ======
  const handleEmailCodeLogin = async (e) => {
    e.preventDefault();
    if (!code) { setError('Enter the code'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post('/passcode/verify-email-login', { email, code });
      login(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code');
    }
    setLoading(false);
  };

  // ====== Send SMS Code ======
  const handleSendSMS = async (e) => {
    e?.preventDefault();
    setError(''); setSuccess('');
    if (!phone) { setError('Enter your phone number'); return; }
    setLoading(true);
    try {
      const res = await api.post('/passcode/send-phone', { phone });
      setCodeSent(true);
      setDemoCode(res.data.demo_code || '');
      setSuccess(`Code sent to ${phone}${res.data.demo_code ? ' (demo: ' + res.data.demo_code + ')' : ''}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed');
    }
    setLoading(false);
  };

  // ====== Verify SMS Code Login ======
  const handleSMSLogin = async (e) => {
    e.preventDefault();
    if (!code) { setError('Enter the code'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post('/passcode/verify-phone-login', { phone, code });
      login(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code');
    }
    setLoading(false);
  };

  // ====== Forgot Password ======
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!email) { setError('Enter your email'); return; }
    setLoading(true);
    try {
      const res = await api.post('/passcode/send-email', { email, type: 'reset' });
      setDemoCode(res.data.demo_code || '');
      setSuccess(`Reset code sent to ${email}${res.data.demo_code ? ' (demo: ' + res.data.demo_code + ')' : ''}`);
      setMode('reset');
      setCodeSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Email not found');
    }
    setLoading(false);
  };

  // ====== Reset Password ======
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!code || !newPassword) { setError('Code and new password required'); return; }
    setLoading(true); setError('');
    try {
      await api.post('/passcode/reset-password', { email, code, new_password: newPassword });
      setSuccess('Password reset! You can now log in.');
      setTimeout(() => { setMode('password'); setSuccess(''); }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Reset failed');
    }
    setLoading(false);
  };

  // ====== 2FA Verify ======
  const handle2FAVerify = async (e) => {
    e.preventDefault();
    if (!totpCode && !backupCode) { setError('Enter a code'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post('/totp/verify', { temp_token: tempToken, code: totpCode || undefined, backup_code: backupCode || undefined });
      login(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code');
    }
    setLoading(false);
  };

  const login = (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    navigate('/');
  };

  // ====== 2FA Screen ======
  if (twoFactorMode) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>🔐 Two-Factor Auth</h1>
          <p className="subtitle">Enter code from authenticator app</p>
          {error && <div className="auth-error">{error}</div>}
          <form onSubmit={handle2FAVerify}>
            <div className="form-group">
              <label>Authenticator Code</label>
              <input type="text" value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6} style={{ textAlign: 'center', fontSize: '1.4rem', letterSpacing: 8, fontWeight: 700 }} autoFocus disabled={!!backupCode} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '12px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} /><span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>or backup</span><div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <div className="form-group">
              <label>Backup Code</label>
              <input type="text" value={backupCode} onChange={e => setBackupCode(e.target.value.toUpperCase())} placeholder="XXXXXXXX" maxLength={8} style={{ textAlign: 'center', fontSize: '1.1rem', letterSpacing: 4 }} disabled={!!totpCode} />
            </div>
            <button type="submit" className="btn-primary" disabled={loading || (!totpCode && !backupCode)}>{loading ? 'Verifying...' : 'Verify'}</button>
            <button type="button" className="btn-secondary" onClick={() => { setTwoFactorMode(false); setTotpCode(''); setBackupCode(''); }} style={{ width: '100%', marginTop: 8 }}>← Back</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 440 }}>
        <h1>🦞 Welcome Back</h1>
        <p className="subtitle">
          {mode === 'password' && 'Log in to EduConnect'}
          {mode === 'email_code' && 'Login with Email Code'}
          {mode === 'forgot' && 'Forgot Password'}
          {mode === 'reset' && 'Reset Password'}
        </p>

        {error && <div className="auth-error">{error}</div>}
        {success && <div style={{ background: '#f0fdf4', color: 'var(--success)', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.85rem' }}>{success}</div>}

        {/* Password Login */}
        {mode === 'password' && (
          <form onSubmit={handlePasswordLogin}>
            <div className="form-group"><label>Username or Email</label><input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="yourname or email@school.edu" required autoFocus /></div>
            <div className="form-group"><label>Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required /></div>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Logging in...' : 'Log In'}</button>
          </form>
        )}

        {/* Email Code Login */}
        {mode === 'email_code' && (
          <form onSubmit={codeSent ? handleEmailCodeLogin : handleSendEmailCode}>
            <div className="form-group"><label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" required autoFocus disabled={codeSent} /></div>
            {codeSent && <div className="form-group"><label>6-Digit Code</label><input type="text" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6} style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: 4 }} autoFocus /></div>}
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Sending...' : codeSent ? 'Verify & Login' : 'Send Code'}</button>
            {codeSent && <button type="button" className="btn-secondary" onClick={() => { setCodeSent(false); setCode(''); }} style={{ width: '100%', marginTop: 8 }}>← Change Email</button>}
          </form>
        )}

        {/* Forgot Password */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword}>
            <div className="form-group"><label>Account Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" required autoFocus /></div>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Sending...' : 'Send Reset Code'}</button>
          </form>
        )}

        {/* Reset Password */}
        {mode === 'reset' && (
          <form onSubmit={handleResetPassword}>
            <div className="form-group"><label>Reset Code</label><input type="text" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6} style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: 4 }} autoFocus /></div>
            <div className="form-group"><label>New Password</label><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 6 characters" required /></div>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Resetting...' : 'Reset Password'}</button>
          </form>
        )}

        {/* Login method switchers */}
        {mode === 'password' && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={() => { setMode('email_code'); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.85rem', padding: 0 }}>📧 Login with email code</button>
            <button onClick={() => { setMode('forgot'); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer', fontSize: '0.85rem', padding: 0 }}>Forgot password?</button>
          </div>
        )}

        {(mode === 'email_code' || mode === 'forgot' || mode === 'reset') && (
          <button onClick={() => { setMode('password'); setError(''); setCodeSent(false); setCode(''); }} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.85rem', marginTop: 12, padding: 0 }}>← Back to login</button>
        )}

        {mode !== 'reset' && (
          <p className="footer-text" style={{ marginTop: 12 }}>New student? <Link to="/register">Create an account</Link></p>
        )}

        {mode === 'password' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} /><span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>or</span><div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <OAuthButtons />
          </>
        )}
      </div>
    </div>
  );
}
