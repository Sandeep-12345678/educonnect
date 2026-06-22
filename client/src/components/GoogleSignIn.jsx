import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function GoogleSignIn({ onSuccess }) {
  const { googleLogin } = useAuth();
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    // In production: use Google Identity Services library
    // window.google.accounts.id.initialize()...
    
    // For demo/dev: use a simulated Google flow
    // The backend accepts google_id + email + name + picture
    const demoGoogleUser = {
      google_id: `google_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email: prompt('Enter your Google email:', 'student@gmail.com'),
      name: prompt('Enter your display name:', ''),
      picture: null
    };

    if (!demoGoogleUser.email || !demoGoogleUser.name) return;

    try {
      const result = await googleLogin(demoGoogleUser);
      if (result.newUser) {
        alert('Account created via Google! 🎉');
      } else if (result.linked) {
        alert('Google account linked to your existing account! 🔗');
      }
      navigate('/');
      onSuccess?.();
    } catch (err) {
      alert('Google sign-in failed: ' + (err.response?.data?.error || 'Please try again'));
    }
  };

  return (
    <button
      type="button"
      onClick={handleGoogleSignIn}
      style={{
        width: '100%',
        padding: '12px 20px',
        background: 'white',
        border: '2px solid #e2e8f0',
        borderRadius: 'var(--radius-sm)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        fontSize: '1rem',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.2s',
        marginTop: 12
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#4285f4'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(66,133,244,0.3)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Continue with Google
    </button>
  );
}
