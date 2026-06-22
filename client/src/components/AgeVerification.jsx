import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function AgeVerification() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [method, setMethod] = useState('self_declare');
  const [age, setAge] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [stream, setStream] = useState(null);

  const videoRef = useState(null);
  const canvasRef = useState(null);

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      setStream(s);
      setCameraActive(true);
      setTimeout(() => {
        const video = document.getElementById('verification-camera');
        if (video && s) video.srcObject = s;
      }, 100);
    } catch (err) {
      setError('Camera access denied. Please allow camera permissions or use self-declaration.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  const captureImage = () => {
    const video = document.getElementById('verification-camera');
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    setCapturedImage(canvas.toDataURL('image/jpeg'));
    stopCamera();
  };

  const handleVerify = async () => {
    const parsedAge = parseInt(age);
    if (!parsedAge || parsedAge < 13) {
      setError('You must be at least 13 years old.');
      return;
    }
    if (parsedAge < 18) {
      setError('Adult features require 18+. Your student account will remain active with all safety features.');
      setStep(4);
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const res = await api.post('/verify/verify', {
        method: method + (capturedImage ? '_face' : ''),
        self_declared_age: parsedAge
      });

      setResult(res.data);

      if (res.data.verified) {
        updateUser({ user: res.data.user, token: res.data.token });
        setStep(3);
      } else {
        setError('Verification could not be completed. Please try again.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed');
    }
    setLoading(false);
  };

  const isAdult = user?.role === 'verified_adult' || user?.age_verified;

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 8 }}>
        🔞 Adult Feature Access
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: '0.95rem' }}>
        Verify your age to unlock all modern social media features: unlimited screen time, 
        all platforms, unrestricted content, and no parental consent needed.
      </p>

      {isAdult && (
        <div style={{
          background: '#f0fdf4', border: '2px solid var(--success)', borderRadius: 'var(--radius)',
          padding: 24, marginBottom: 24, textAlign: 'center'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: 8 }}>✅</div>
          <h3 style={{ color: 'var(--success)' }}>You're Verified!</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
            All adult features are unlocked. Enjoy unrestricted access to EduConnect.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
            <span className="badge" style={{ background: '#dcfce7', color: '#16a34a' }}>🔓 No Time Limits</span>
            <span className="badge" style={{ background: '#dbeafe', color: '#2563eb' }}>🌐 All Platforms</span>
            <span className="badge" style={{ background: '#fef3c7', color: '#d97706' }}>🔞 No Filters</span>
            <span className="badge" style={{ background: '#ede9fe', color: '#7c3aed' }}>🚫 No Consent Needed</span>
          </div>
        </div>
      )}

      {!isAdult && (
        <div className="screen-time-card">
          {/* Step 1: Choose method */}
          {step === 1 && (
            <>
              <h3>Step 1: Choose Verification Method</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: 16,
                  border: `2px solid ${method === 'self_declare' ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  background: method === 'self_declare' ? '#eef2ff' : 'white'
                }}>
                  <input type="radio" name="method" checked={method === 'self_declare'}
                    onChange={() => setMethod('self_declare')} />
                  <div>
                    <strong>📝 Self-Declaration</strong>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Enter your age directly</div>
                  </div>
                </label>

                <label style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: 16,
                  border: `2px solid ${method === 'face' ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  background: method === 'face' ? '#eef2ff' : 'white'
                }}>
                  <input type="radio" name="method" checked={method === 'face'}
                    onChange={() => setMethod('face')} />
                  <div>
                    <strong>📸 Face Age Estimation</strong>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Take a selfie for AI age verification</div>
                  </div>
                </label>
              </div>

              <button className="btn-primary" onClick={() => {
                setStep(2);
                if (method === 'face') startCamera();
              }} style={{ marginTop: 20, width: '100%' }}>
                Continue →
              </button>
            </>
          )}

          {/* Step 2: Verification */}
          {step === 2 && (
            <>
              <h3>Step 2: Verify Your Age</h3>

              {method === 'face' && !capturedImage && (
                <div style={{ marginTop: 16, textAlign: 'center' }}>
                  {cameraActive ? (
                    <>
                      <div style={{ position: 'relative', borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 12 }}>
                        <video
                          id="verification-camera"
                          autoPlay
                          playsInline
                          muted
                          style={{ width: '100%', borderRadius: 'var(--radius)', transform: 'scaleX(-1)' }}
                        />
                        <div style={{
                          position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
                          border: '3px dashed rgba(255,255,255,0.8)', borderRadius: '50%',
                          width: 200, height: 200, pointerEvents: 'none'
                        }} />
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                        Center your face in the circle
                      </p>
                      <button className="btn-primary" onClick={captureImage} style={{ marginRight: 8 }}>
                        📸 Capture
                      </button>
                      <button className="btn-secondary" onClick={stopCamera}>Cancel</button>
                    </>
                  ) : (
                    <div style={{ padding: 40, textAlign: 'center' }}>
                      <div style={{ fontSize: '3rem', marginBottom: 12 }}>📸</div>
                      <button className="btn-primary" onClick={startCamera}>
                        Open Camera
                      </button>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: 8 }}>
                        Camera is used only for age verification and the image is not stored.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {capturedImage && (
                <div style={{ marginTop: 16, textAlign: 'center' }}>
                  <img src={capturedImage} alt="Verification" 
                    style={{ width: 200, height: 200, borderRadius: '50%', objectFit: 'cover', marginBottom: 12 }} />
                  <p style={{ fontSize: '0.85rem', color: 'var(--success)', marginBottom: 12 }}>Selfie captured!</p>
                </div>
              )}

              <div style={{ marginTop: 16 }}>
                <label style={{ fontWeight: 600, fontSize: '0.9rem', display: 'block', marginBottom: 6 }}>
                  I declare I am:
                </label>
                <input
                  type="number"
                  value={age}
                  onChange={e => setAge(e.target.value)}
                  placeholder="Enter your age (18+)"
                  min={13}
                  max={120}
                  style={{ fontSize: '1.2rem', textAlign: 'center', maxWidth: 200 }}
                />
              </div>

              {error && (
                <div style={{ 
                  background: error.includes('13') ? '#eff6ff' : '#fef2f2',
                  color: error.includes('13') ? 'var(--secondary)' : 'var(--danger)',
                  padding: 12, borderRadius: 'var(--radius-sm)', marginTop: 12, fontSize: '0.9rem'
                }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                <button className="btn-secondary" onClick={() => { stopCamera(); setStep(1); setCapturedImage(null); }}>
                  ← Back
                </button>
                <button className="btn-primary" onClick={handleVerify} disabled={loading || !age} style={{ flex: 1 }}>
                  {loading ? 'Verifying...' : 'Verify My Age'}
                </button>
              </div>
            </>
          )}

          {/* Step 3: Success */}
          {step === 3 && result?.verified && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: '4rem', marginBottom: 12 }}>🎉</div>
              <h3 style={{ color: 'var(--success)' }}>You're now a Verified Adult!</h3>
              <p style={{ color: 'var(--text-secondary)', margin: '12px 0 24px', lineHeight: 1.8 }}>
                {result.message}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24, textAlign: 'left' }}>
                {[
                  { icon: '⏱️', text: 'Unlimited screen time' },
                  { icon: '🌐', text: 'All social platforms unlocked' },
                  { icon: '🔞', text: 'Full content access' },
                  { icon: '🔓', text: 'No parental consent needed' },
                  { icon: '📱', text: 'Cross-post anywhere' },
                  { icon: '🎬', text: 'All media types allowed' }
                ].map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg)', borderRadius: 8 }}>
                    <span>{f.icon}</span>
                    <span style={{ fontSize: '0.85rem' }}>{f.text}</span>
                  </div>
                ))}
              </div>
              <button className="btn-primary" onClick={() => navigate('/')}>
                Go to Feed →
              </button>
            </div>
          )}

          {/* Step 4: Under 18 */}
          {step === 4 && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: '4rem', marginBottom: 12 }}>🛡️</div>
              <h3>Your Student Account is Protected</h3>
              <p style={{ color: 'var(--text-secondary)', margin: '12px 0 24px', lineHeight: 1.8 }}>
                Since you're under 18, your account stays in safe student mode with screen time limits, 
                content filtering, and parental consent features. These protections keep you safe online.
              </p>
              <button className="btn-primary" onClick={() => navigate('/')}>
                Continue with Student Mode →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
