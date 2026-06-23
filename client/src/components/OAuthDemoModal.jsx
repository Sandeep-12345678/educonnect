import { useState } from 'react';
import api from '../utils/api';

export default function OAuthDemoModal({ provider, config, onClose, onSuccess }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !name) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/oauth', {
        provider,
        provider_id: `${provider}_demo_${Date.now()}`,
        email,
        name,
        picture: null
      });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      window.location.href = '/';
      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Sign-in failed');
    }
    setLoading(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, backdropFilter: 'blur(4px)'
    }} onClick={onClose}>
      <div style={{
        background: 'white', borderRadius: 16, padding: '32px 36px',
        maxWidth: 400, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }} onClick={e => e.stopPropagation()}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>{config.icon}</div>
          <h3 style={{ fontWeight: 700 }}>Sign in with {config.name}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 4 }}>
            Demo mode — enter your email to create an account.
          </p>
          <p style={{ color: 'var(--text-light)', fontSize: '0.75rem', marginTop: 4 }}>
            Add API keys to server/.env for real {config.name} OAuth.
          </p>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', color: 'var(--danger)', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={`Your ${config.name} email`}
              required
              autoFocus
              style={{ padding: '12px 14px' }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your display name"
              required
              style={{ padding: '12px 14px' }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '12px', background: config.bgColor, color: 'white',
              border: 'none', borderRadius: 8, fontSize: '1rem', fontWeight: 600,
              cursor: 'pointer', opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Signing in...' : `Continue as ${name || '...'}`}
          </button>
        </form>

        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '8px', background: 'none', border: 'none',
            color: 'var(--text-light)', fontSize: '0.85rem', marginTop: 12, cursor: 'pointer'
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
