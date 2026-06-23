import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../utils/api';

export default function OAuthCallback() {
  const { provider } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Processing...');
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code) {
      setError('No authorization code received. Please try again.');
      return;
    }

    setStatus(`Signing in with ${provider}...`);

    api.post(`/oauth/callback/${provider}`, { code, state })
      .then(res => {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        window.location.href = '/';
      })
      .catch(err => {
        const msg = err.response?.data?.error || 'Authentication failed';
        if (err.response?.data?.needs_config) {
          setError(`${msg}\n\nAdd ${provider.toUpperCase()}_CLIENT_ID and ${provider.toUpperCase()}_CLIENT_SECRET to server/.env`);
        } else {
          setError(msg);
        }
      });
  }, [provider, searchParams, navigate]);

  if (error) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>❌</div>
          <h2>Sign-in Failed</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8, whiteSpace: 'pre-wrap' }}>{error}</p>
          <button className="btn-primary" onClick={() => navigate('/login')} style={{ marginTop: 20 }}>
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 16px' }} />
        <h2>{status}</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
          You'll be redirected automatically...
        </p>
      </div>
    </div>
  );
}
