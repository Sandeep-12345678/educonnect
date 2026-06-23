import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function TwoFactorAuth() {
  const { user, refreshUser } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState('status'); // status | setup | verify | codes
  const [secret, setSecret] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');

  useEffect(() => { fetchStatus(); }, []);

  const fetchStatus = async () => {
    try {
      const res = await api.get('/totp/status');
      setEnabled(res.data.enabled);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const startSetup = async () => {
    setActionLoading(true);
    setError('');
    try {
      const res = await api.post('/totp/setup');
      setSecret(res.data.secret);
      setQrCode(res.data.qr_code);
      setStep('setup');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start setup');
    }
    setActionLoading(false);
  };

  const verifyAndEnable = async () => {
    if (code.length !== 6) { setError('Enter 6-digit code'); return; }
    setActionLoading(true);
    setError('');
    try {
      const res = await api.post('/totp/enable', { code });
      setSuccess(res.data.message);
      setBackupCodes(res.data.backup_codes || []);
      setEnabled(true);
      setStep('codes');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code');
    }
    setActionLoading(false);
  };

  const disable2FA = async () => {
    setActionLoading(true);
    setError('');
    try {
      await api.post('/totp/disable', { code: code || undefined, password: disablePassword || undefined });
      setEnabled(false);
      setSuccess('2FA disabled.');
      setStep('status');
      setCode('');
      setDisablePassword('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to disable');
    }
    setActionLoading(false);
  };

  const regenerateCodes = async () => {
    setActionLoading(true);
    try {
      const res = await api.post('/totp/backup-codes/regenerate');
      setBackupCodes(res.data.codes);
      setSuccess('New backup codes generated!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed');
    }
    setActionLoading(false);
  };

  const fetchBackupCodes = async () => {
    setActionLoading(true);
    try {
      const res = await api.get('/totp/backup-codes');
      setBackupCodes(res.data.codes || []);
      setStep('codes');
    } catch (err) {
      setError('Failed to fetch backup codes');
    }
    setActionLoading(false);
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 8 }}>🔐 Two-Factor Authentication</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
        Add an extra layer of security with time-based one-time passwords (TOTP).
      </p>

      {error && <div style={{ background: '#fef2f2', color: 'var(--danger)', padding: 12, borderRadius: 'var(--radius-sm)', marginBottom: 16 }}>{error}</div>}
      {success && <div style={{ background: '#f0fdf4', color: 'var(--success)', padding: 12, borderRadius: 'var(--radius-sm)', marginBottom: 16 }}>{success}</div>}

      <div className="screen-time-card">
        {/* Status */}
        {step === 'status' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: enabled ? '#f0fdf4' : '#fef3c7', fontSize: '2rem'
              }}>
                {enabled ? '🔒' : '🔓'}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                  {enabled ? '2FA is Active' : '2FA is Not Enabled'}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {enabled 
                    ? 'Your account is protected with two-factor authentication.' 
                    : 'Enable 2FA to protect your account with an authenticator app.'}
                </div>
              </div>
            </div>

            {!enabled ? (
              <button className="btn-primary" onClick={startSetup} disabled={actionLoading} style={{ width: '100%' }}>
                {actionLoading ? 'Starting...' : '🔐 Set Up Two-Factor Authentication'}
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button className="btn-secondary" onClick={fetchBackupCodes}>
                  📋 View Backup Codes
                </button>
                <div style={{ marginTop: 16 }}>
                  <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 8 }}>Disable 2FA</p>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input
                      type="text"
                      value={code}
                      onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="6-digit code"
                      maxLength={6}
                      style={{ flex: 1, textAlign: 'center', fontSize: '1.1rem', letterSpacing: 2 }}
                    />
                    <span style={{ alignSelf: 'center', color: 'var(--text-light)', fontSize: '0.85rem' }}>or</span>
                    <input
                      type="password"
                      value={disablePassword}
                      onChange={e => setDisablePassword(e.target.value)}
                      placeholder="Password"
                      style={{ flex: 1 }}
                    />
                  </div>
                  <button className="btn-danger btn-sm" onClick={disable2FA} disabled={actionLoading || (!code && !disablePassword)}>
                    Disable 2FA
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Setup: QR code */}
        {step === 'setup' && (
          <>
            <h3>Step 1: Scan QR Code</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 16 }}>
              Scan this with Google Authenticator, Authy, 1Password, or any TOTP app.
            </p>

            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <img src={qrCode} alt="TOTP QR Code" style={{ width: 200, height: 200, borderRadius: 'var(--radius-sm)', border: '2px solid var(--border)' }} />
            </div>

            <div style={{ background: 'var(--bg)', padding: 16, borderRadius: 'var(--radius-sm)', marginBottom: 20 }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginBottom: 4 }}>Or enter this code manually:</div>
              <code style={{ fontSize: '1rem', fontWeight: 600, wordBreak: 'break-all', userSelect: 'all' }}>{secret}</code>
            </div>

            <h3>Step 2: Verify</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 12 }}>
              Enter the 6-digit code from your authenticator app:
            </p>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                style={{ flex: 1, textAlign: 'center', fontSize: '1.3rem', letterSpacing: 6, fontWeight: 700 }}
                onKeyDown={e => e.key === 'Enter' && verifyAndEnable()}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-secondary" onClick={() => { setStep('status'); setCode(''); setError(''); }}>
                ← Back
              </button>
              <button className="btn-primary" onClick={verifyAndEnable} disabled={actionLoading || code.length !== 6} style={{ flex: 1 }}>
                {actionLoading ? 'Verifying...' : 'Verify & Enable'}
              </button>
            </div>
          </>
        )}

        {/* Backup Codes */}
        {step === 'codes' && (
          <>
            <h3>📋 Backup Codes</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 16 }}>
              Save these codes in a safe place. Each code can be used once if you lose access to your authenticator app.
            </p>

            <div style={{ 
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20,
              background: 'var(--bg)', padding: 16, borderRadius: 'var(--radius-sm)'
            }}>
              {backupCodes.map((c, i) => (
                <div key={i} style={{
                  fontFamily: 'monospace', fontSize: '0.95rem', fontWeight: 600,
                  padding: '6px 10px', borderRadius: 4, background: c.used ? '#fef2f2' : 'white',
                  color: c.used ? 'var(--text-light)' : 'var(--text)',
                  textDecoration: c.used ? 'line-through' : 'none',
                  border: '1px solid var(--border)'
                }}>
                  {c.code || c} {c.used ? '(used)' : ''}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-secondary" onClick={() => setStep('status')}>
                ← Back
              </button>
              <button className="btn-primary" onClick={regenerateCodes} disabled={actionLoading}>
                🔄 Regenerate Codes
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
