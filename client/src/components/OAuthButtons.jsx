import { useEffect, useRef, useState } from 'react';
import api from '../utils/api';

const PROVIDER_UI = {
  google: {
    name: 'Google', flow: 'onetap',
    icon: (<svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>),
    bgColor: '#4285F4', bgHover: '#3367D6'
  },
  github: {
    name: 'GitHub', flow: 'redirect',
    icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>),
    bgColor: '#24292e', bgHover: '#1a1f23'
  },
  apple: {
    name: 'Apple', flow: 'popup',
    icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>),
    bgColor: '#000000', bgHover: '#333333'
  },
  microsoft: {
    name: 'Microsoft', flow: 'redirect',
    icon: (<svg width="20" height="20" viewBox="0 0 24 24"><rect x="1" y="1" width="10" height="10" fill="#F25022"/><rect x="13" y="1" width="10" height="10" fill="#7FBA00"/><rect x="1" y="13" width="10" height="10" fill="#00A4EF"/><rect x="13" y="13" width="10" height="10" fill="#FFB900"/></svg>),
    bgColor: '#2F2F2F', bgHover: '#1a1a1a'
  },
  discord: {
    name: 'Discord', flow: 'redirect',
    icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>),
    bgColor: '#5865F2', bgHover: '#4752C4'
  }
};

export default function OAuthButtons({ showAll = false }) {
  const [loadingProvider, setLoadingProvider] = useState(null);
  const [configStatus, setConfigStatus] = useState({});
  const [error, setError] = useState('');
  const googleAttempted = useRef(false);

  useEffect(() => {
    api.get('/oauth/providers').then(res => {
      const status = {};
      (res.data.providers || []).forEach(p => status[p.id] = p.configured);
      setConfigStatus(status);
    }).catch(() => {});
  }, []);

  // ====== Load Google Identity Services ======
  useEffect(() => {
    if (document.getElementById('google-gis-script')) return;
    const script = document.createElement('script');
    script.id = 'google-gis-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  // ====== Load Apple Sign In ======
  useEffect(() => {
    if (document.getElementById('appleid-script')) return;
    const script = document.createElement('script');
    script.id = 'appleid-script';
    script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  // ====== Google Sign-In ======
  const handleGoogleClick = async () => {
    setError('');
    setLoadingProvider('google');
    
    // If not configured, show setup guide
    if (!configStatus.google) {
      setLoadingProvider(null);
      setError('Google sign-in needs setup:\n1. Go to https://console.cloud.google.com\n2. Create OAuth 2.0 Client ID\n3. Add to server/.env: GOOGLE_CLIENT_ID=...');
      return;
    }

    // Wait for Google SDK to load
    if (!window.google?.accounts?.id) {
      await new Promise(r => setTimeout(r, 2000));
      if (!window.google?.accounts?.id) {
        setLoadingProvider(null);
        setError('Google Sign-In is loading... Please try again in a moment.');
        return;
      }
    }

    try {
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || window.__GOOGLE_CLIENT_ID__ || '',
        callback: async (response) => {
          try {
            const res = await api.post('/oauth/google/verify', { credential: response.credential });
            setLoadingProvider(null);
            saveAndRedirect(res.data);
          } catch (err) {
            setLoadingProvider(null);
            setError(err.response?.data?.error || 'Google verification failed');
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true
      });
      window.google.accounts.id.prompt();
    } catch (e) {
      setLoadingProvider(null);
      setError('Google popup was closed or blocked. Please allow popups for this site.');
    }
  };

  // ====== Apple Sign In ======
  const handleAppleClick = async () => {
    setError('');
    if (!configStatus.apple) {
      setError('Apple Sign In needs setup:\n1. Go to https://developer.apple.com\n2. Create Service ID with Sign In with Apple\n3. Add to server/.env: APPLE_CLIENT_ID=...');
      return;
    }
    setLoadingProvider('apple');
    try {
      await new Promise(r => setTimeout(r, 1000));
      if (!window.AppleID) {
        throw new Error('Apple SDK loading...');
      }
      window.AppleID.auth.init({
        clientId: import.meta.env.VITE_APPLE_CLIENT_ID || 'com.educonnect.signin',
        scope: 'name email',
        redirectURI: window.location.origin + '/auth/apple/callback',
        usePopup: true
      });
      const response = await window.AppleID.auth.signIn();
      const res = await api.post('/oauth/apple/verify', {
        identityToken: response.authorization?.id_token,
        user: response.user
      });
      setLoadingProvider(null);
      saveAndRedirect(res.data);
    } catch (err) {
      setLoadingProvider(null);
      setError('Apple Sign In unavailable. Needs configuration at developer.apple.com');
    }
  };

  // ====== Redirect providers (GitHub, Microsoft, Discord) ======
  const handleRedirectLogin = async (provider) => {
    setError('');
    if (!configStatus[provider]) {
      setError(`${PROVIDER_UI[provider].name} sign-in needs setup. Add ${provider.toUpperCase()}_CLIENT_ID to server/.env`);
      return;
    }
    setLoadingProvider(provider);
    try {
      const res = await api.get(`/oauth/url/${provider}`);
      window.location.href = res.data.url;
    } catch (err) {
      setLoadingProvider(null);
      setError(err.response?.data?.error || `${PROVIDER_UI[provider].name} not configured. Add credentials to .env`);
    }
  };

  const saveAndRedirect = (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    window.location.href = '/';
  };

  const displayProviders = showAll 
    ? Object.keys(PROVIDER_UI)
    : ['google', 'github', 'apple'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {error && (
        <div style={{
          background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 'var(--radius-sm)',
          padding: '12px 14px', fontSize: '0.8rem', whiteSpace: 'pre-wrap',
          color: '#1e40af', lineHeight: 1.6
        }}>
          {error}
        </div>
      )}

      {displayProviders.map(provider => {
        const config = PROVIDER_UI[provider];
        const handleClick = () => {
          if (provider === 'google') handleGoogleClick();
          else if (provider === 'apple') handleAppleClick();
          else handleRedirectLogin(provider);
        };

        return (
          <button
            key={provider}
            type="button"
            onClick={handleClick}
            disabled={loadingProvider !== null}
            style={{
              width: '100%', padding: '12px 20px', background: config.bgColor, color: 'white',
              border: 'none', borderRadius: 'var(--radius-sm)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', gap: 12,
              fontSize: '1rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s',
              opacity: loadingProvider && loadingProvider !== provider ? 0.6 : 1
            }}
            onMouseEnter={e => { e.currentTarget.style.background = config.bgHover; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = config.bgColor; e.currentTarget.style.transform = 'none'; }}
          >
            {config.icon}
            {loadingProvider === provider ? 'Signing in...' : `Continue with ${config.name}`}
          </button>
        );
      })}

      <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', textAlign: 'center', marginTop: 4 }}>
        🔧 Providers need API keys in server/.env to work
      </p>
    </div>
  );
}
