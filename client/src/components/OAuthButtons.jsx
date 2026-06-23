import { useEffect, useState } from 'react';
import api from '../utils/api';
import OAuthDemoModal from './OAuthDemoModal';

const PROVIDER_UI = {
  google: {
    name: 'Google', flow: 'onetap',
    icon: '🔵', bgColor: '#4285F4', bgHover: '#3367D6'
  },
  github: {
    name: 'GitHub', flow: 'redirect',
    icon: '🐙', bgColor: '#24292e', bgHover: '#1a1f23'
  },
  microsoft: {
    name: 'Microsoft', flow: 'redirect',
    icon: '🪟', bgColor: '#2F2F2F', bgHover: '#1a1a1a'
  },
  discord: {
    name: 'Discord', flow: 'redirect',
    icon: '🎮', bgColor: '#5865F2', bgHover: '#4752C4'
  }
};

export default function OAuthButtons({ showAll = false }) {
  const [loadingProvider, setLoadingProvider] = useState(null);
  const [configStatus, setConfigStatus] = useState({});
  const [demoModal, setDemoModal] = useState(null);

  useEffect(() => {
    api.get('/oauth/providers').then(res => {
      const status = {};
      (res.data.providers || []).forEach(p => status[p.id] = p.configured);
      setConfigStatus(status);
    }).catch(() => {});
  }, []);

  // Load Google GIS SDK
  useEffect(() => {
    if (document.getElementById('gis-script')) return;
    const s = document.createElement('script');
    s.id = 'gis-script';
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true;
    document.head.appendChild(s);
  }, []);

  const handleGoogle = async () => {
    if (!configStatus.google) {
      setDemoModal({ provider: 'google', config: PROVIDER_UI.google });
      return;
    }
    setLoadingProvider('google');
    if (!window.google?.accounts?.id) {
      await new Promise(r => setTimeout(r, 2000));
      if (!window.google?.accounts?.id) { setLoadingProvider(null); return; }
    }
    try {
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
        callback: async (resp) => {
          const res = await api.post('/oauth/google/verify', { credential: resp.credential });
          setLoadingProvider(null);
          loginSuccess(res.data);
        },
        auto_select: false, cancel_on_tap_outside: true
      });
      window.google.accounts.id.prompt();
    } catch { setLoadingProvider(null); }
  };

  const handleRedirect = async (provider) => {
    if (!configStatus[provider]) {
      setDemoModal({ provider, config: PROVIDER_UI[provider] });
      return;
    }
    setLoadingProvider(provider);
    try {
      const res = await api.get(`/oauth/url/${provider}`);
      window.location.href = res.data.url;
    } catch {
      setLoadingProvider(null);
    }
  };

  const loginSuccess = (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    window.location.href = '/';
  };

  const handleClick = (provider) => {
    if (provider === 'google') handleGoogle();
    else handleRedirect(provider);
  };

  const displayProviders = showAll ? Object.keys(PROVIDER_UI) : ['google', 'github'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {demoModal && (
        <OAuthDemoModal provider={demoModal.provider} config={demoModal.config} onClose={() => setDemoModal(null)} />
      )}
      {displayProviders.map(provider => {
        const cfg = PROVIDER_UI[provider];
        return (
          <button key={provider} type="button" onClick={() => handleClick(provider)} disabled={!!loadingProvider}
            style={{
              width: '100%', padding: '12px 20px', background: cfg.bgColor, color: 'white',
              border: 'none', borderRadius: 'var(--radius-sm)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', gap: 12,
              fontSize: '1rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s',
              opacity: loadingProvider && loadingProvider !== provider ? 0.6 : 1
            }}
            onMouseEnter={e => { e.currentTarget.style.background = cfg.bgHover; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = cfg.bgColor; e.currentTarget.style.transform = 'none'; }}
          >
            <span style={{ fontSize: '1.2rem' }}>{cfg.icon}</span>
            {loadingProvider === provider ? 'Signing in...' : `Continue with ${cfg.name}`}
          </button>
        );
      })}
    </div>
  );
}
