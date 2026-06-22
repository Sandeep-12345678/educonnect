import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function SocialConnect() {
  const { user } = useAuth();
  const [platforms, setPlatforms] = useState([]);
  const [connections, setConnections] = useState([]);
  const [consents, setConsents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('connect');

  // Consent form state
  const [parentEmail, setParentEmail] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [consentNotes, setConsentNotes] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [consentResult, setConsentResult] = useState(null);

  // Parent approval state
  const [consentCode, setConsentCode] = useState('');
  const [approving, setApproving] = useState(false);
  const [approvalResult, setApprovalResult] = useState(null);

  // Connection edit state
  const [editingPlatform, setEditingPlatform] = useState(null);
  const [editForm, setEditForm] = useState({ platform_username: '', platform_url: '', share_posts: false, share_media: false });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [platRes, connRes, consentRes] = await Promise.all([
        api.get('/social/platforms'),
        api.get('/social/connections'),
        api.get('/social/consent/status')
      ]);
      setPlatforms(platRes.data.platforms || []);
      setConnections(connRes.data.connections || []);
      setConsents(consentRes.data.consents || []);
    } catch (err) {
      console.error('Failed to load social data', err);
    }
    setLoading(false);
  };

  const togglePlatform = (platformId) => {
    setSelectedPlatforms(prev =>
      prev.includes(platformId)
        ? prev.filter(p => p !== platformId)
        : [...prev, platformId]
    );
  };

  const requestConsent = async () => {
    if (!parentEmail || selectedPlatforms.length === 0) return;
    setRequesting(true);
    try {
      const res = await api.post('/social/consent/request', {
        parent_email: parentEmail,
        platforms: selectedPlatforms,
        notes: consentNotes
      });
      setConsentResult(res.data);
      setParentEmail('');
      setSelectedPlatforms([]);
      setConsentNotes('');
      fetchAll();
    } catch (err) {
      setConsentResult({ error: err.response?.data?.error || 'Failed to send request' });
    }
    setRequesting(false);
  };

  const approveConsent = async () => {
    if (!consentCode) return;
    setApproving(true);
    try {
      const res = await api.post('/social/consent/approve', { consent_code: consentCode });
      setApprovalResult(res.data);
      setConsentCode('');
      fetchAll();
    } catch (err) {
      setApprovalResult({ error: err.response?.data?.error || 'Invalid code' });
    }
    setApproving(false);
  };

  const denyConsent = async () => {
    if (!consentCode) return;
    setApproving(true);
    try {
      await api.post('/social/consent/deny', { consent_code: consentCode });
      setApprovalResult({ message: 'Consent denied.' });
      setConsentCode('');
    } catch (err) {
      setApprovalResult({ error: err.response?.data?.error || 'Error' });
    }
    setApproving(false);
  };

  const updateConnection = async (platform) => {
    try {
      await api.put(`/social/connections/${platform}`, editForm);
      setEditingPlatform(null);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update');
    }
  };

  const disconnectPlatform = async (platform) => {
    if (!confirm(`Disconnect ${platform}?`)) return;
    try {
      await api.delete(`/social/connections/${platform}`);
      fetchAll();
    } catch (err) {
      alert('Failed to disconnect');
    }
  };

  const openEditForm = (conn) => {
    setEditingPlatform(conn.platform);
    setEditForm({
      platform_username: conn.platform_username || '',
      platform_url: conn.platform_url || '',
      share_posts: !!conn.share_posts,
      share_media: !!conn.share_media
    });
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  const connectedMap = {};
  connections.forEach(c => { connectedMap[c.platform] = c; });

  const pendingConsent = consents.find(c => c.status === 'pending');

  return (
    <div>
      <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 24 }}>🔗 Social Media</h2>

      <div className="admin-tabs" style={{ marginBottom: 24 }}>
        <button className={`admin-tab ${tab === 'connect' ? 'active' : ''}`} onClick={() => setTab('connect')}>
          Connections
        </button>
        <button className={`admin-tab ${tab === 'consent' ? 'active' : ''}`} onClick={() => setTab('consent')}>
          Parental Consent
        </button>
        <button className={`admin-tab ${tab === 'parent' ? 'active' : ''}`} onClick={() => setTab('parent')}>
          👨‍👩‍👧 I'm a Parent
        </button>
      </div>

      {/* Tab: Connections */}
      {tab === 'connect' && (
        <>
          {/* Pending consent banner */}
          {pendingConsent && (
            <div style={{
              background: '#fef3c7', border: '2px solid var(--warning)', borderRadius: 'var(--radius)',
              padding: '16px 24px', marginBottom: 24
            }}>
              <strong>⏳ Consent pending!</strong>{' '}
              Share this code with your parent: <code style={{
                background: 'white', padding: '4px 10px', borderRadius: 4, fontSize: '1.2rem',
                fontWeight: 700, letterSpacing: 2
              }}>{pendingConsent.consent_code}</code>
              <br />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Email sent to {pendingConsent.parent_email}. Expires {new Date(pendingConsent.expires_at).toLocaleDateString()}.
              </span>
            </div>
          )}

          {/* Consent request form */}
          {!pendingConsent && (
            <div className="screen-time-card" style={{ marginBottom: 24 }}>
              <h3>🔐 Request Parental Consent</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: '0.9rem' }}>
                To connect social media accounts, your parent or guardian must approve it first.
              </p>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: 6 }}>
                  Parent's Email
                </label>
                <input
                  type="email"
                  value={parentEmail}
                  onChange={e => setParentEmail(e.target.value)}
                  placeholder="parent@email.com"
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: 8 }}>
                  Select Platforms to Connect
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {platforms.filter(p => !p.connected).map(p => (
                    <button
                      key={p.id}
                      onClick={() => togglePlatform(p.id)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '20px',
                        border: selectedPlatforms.includes(p.id) ? `2px solid ${p.color}` : '2px solid var(--border)',
                        background: selectedPlatforms.includes(p.id) ? `${p.color}15` : 'white',
                        fontWeight: 500,
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                    >
                      {p.icon} {p.name}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: 6 }}>
                  Message for Parent (optional)
                </label>
                <textarea
                  value={consentNotes}
                  onChange={e => setConsentNotes(e.target.value)}
                  placeholder="e.g., I want to share my artwork on Instagram..."
                  rows={2}
                />
              </div>

              <button
                className="btn-primary"
                onClick={requestConsent}
                disabled={requesting || !parentEmail || selectedPlatforms.length === 0}
              >
                {requesting ? 'Sending...' : 'Send Consent Request'}
              </button>

              {consentResult && (
                <div style={{
                  marginTop: 16, padding: 14, borderRadius: 'var(--radius-sm)',
                  background: consentResult.error ? '#fef2f2' : '#f0fdf4',
                  color: consentResult.error ? 'var(--danger)' : 'var(--success)'
                }}>
                  {consentResult.error || consentResult.message}
                </div>
              )}
            </div>
          )}

          {/* Connected platforms */}
          <div className="screen-time-card">
            <h3>📱 Connected Platforms</h3>
            <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
              {platforms.map(p => {
                const conn = connectedMap[p.id];
                return (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: 16, borderRadius: 'var(--radius-sm)',
                    background: conn ? `${p.color}08` : 'var(--bg)',
                    border: `1px solid ${conn ? p.color + '40' : 'var(--border)'}`
                  }}>
                    <span style={{ fontSize: '2rem' }}>{p.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      {conn ? (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          @{conn.platform_username || 'not set'} ·
                          Posts: {conn.share_posts ? '✅' : '❌'} ·
                          Media: {conn.share_media ? '✅' : '❌'}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                          {p.connected === 'pending' ? '⏳ Awaiting approval' : 'Not connected'}
                        </div>
                      )}
                    </div>

                    {conn && editingPlatform === p.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200 }}>
                        <input
                          type="text"
                          placeholder="Username"
                          value={editForm.platform_username}
                          onChange={e => setEditForm(prev => ({ ...prev, platform_username: e.target.value }))}
                          style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                        />
                        <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input type="checkbox" checked={editForm.share_posts}
                            onChange={e => setEditForm(prev => ({ ...prev, share_posts: e.target.checked }))} />
                          Share posts
                        </label>
                        <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input type="checkbox" checked={editForm.share_media}
                            onChange={e => setEditForm(prev => ({ ...prev, share_media: e.target.checked }))} />
                          Share media
                        </label>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn-primary btn-sm" onClick={() => updateConnection(p.id)}>Save</button>
                          <button className="btn-secondary btn-sm" onClick={() => setEditingPlatform(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : conn ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-secondary btn-sm" onClick={() => openEditForm(conn)}>⚙️</button>
                        <button className="btn-danger btn-sm" onClick={() => disconnectPlatform(p.id)}>✕</button>
                      </div>
                    ) : (
                      <span className="badge" style={{
                        background: 'var(--bg)', color: 'var(--text-light)', padding: '6px 12px'
                      }}>
                        Parent approval needed
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Tab: Consent History */}
      {tab === 'consent' && (
        <div className="screen-time-card">
          <h3>📋 Consent History</h3>
          {consents.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-light)', padding: 40 }}>
              No consent requests yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
              {consents.map(c => {
                const platforms = JSON.parse(c.platforms || '[]');
                const statusColors = { pending: 'var(--warning)', approved: 'var(--success)', denied: 'var(--danger)' };
                return (
                  <div key={c.id} style={{
                    padding: 16, borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg)', border: '1px solid var(--border)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <strong>Code: <code>{c.consent_code}</code></strong>
                      <span style={{
                        padding: '4px 12px', borderRadius: 12, fontSize: '0.8rem', fontWeight: 600,
                        background: statusColors[c.status] + '20', color: statusColors[c.status]
                      }}>
                        {c.status.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Parent: {c.parent_email} · Platforms: {platforms.map(p => {
                        const plat = AVAILABLE.find(pp => pp.id === p);
                        return plat ? plat.icon + ' ' + plat.name : p;
                      }).join(', ') || 'None'}
                    </div>
                    {c.notes && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginTop: 4, fontStyle: 'italic' }}>
                        "{c.notes}"
                      </div>
                    )}
                    {c.status === 'pending' && (
                      <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--text-light)' }}>
                        Share code with parent · Expires {new Date(c.expires_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Parent Approval */}
      {tab === 'parent' && (
        <div className="screen-time-card" style={{ maxWidth: 520 }}>
          <h3>👨‍👩‍👧 Parent Approval Portal</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: '0.9rem' }}>
            Enter the consent code your child shared with you to approve or deny their social media connections.
          </p>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: 6 }}>
              Consent Code
            </label>
            <input
              type="text"
              value={consentCode}
              onChange={e => setConsentCode(e.target.value.toUpperCase())}
              placeholder="Enter 8-character code (e.g., A1B2C3D4)"
              maxLength={8}
              style={{ fontSize: '1.2rem', textAlign: 'center', letterSpacing: 4, fontWeight: 700 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn-primary"
              onClick={approveConsent}
              disabled={approving || consentCode.length < 8}
              style={{ flex: 1 }}
            >
              {approving ? 'Processing...' : '✅ Approve'}
            </button>
            <button
              className="btn-danger"
              onClick={denyConsent}
              disabled={approving || consentCode.length < 8}
              style={{ flex: 1 }}
            >
              ❌ Deny
            </button>
          </div>

          {approvalResult && (
            <div style={{
              marginTop: 16, padding: 14, borderRadius: 'var(--radius-sm)',
              background: approvalResult.error ? '#fef2f2' : '#f0fdf4',
              color: approvalResult.error ? 'var(--danger)' : 'var(--success)'
            }}>
              {approvalResult.error || approvalResult.message}
            </div>
          )}

          <div style={{ marginTop: 24, padding: 16, background: '#eff6ff', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
            <strong>ℹ️ How this works:</strong>
            <ol style={{ paddingLeft: 20, marginTop: 8, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              <li>Your child requests to connect social media</li>
              <li>You receive a unique consent code via email</li>
              <li>Enter the code here to approve or deny</li>
              <li>You can revoke access at any time</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

const AVAILABLE = [
  { id: 'instagram', name: 'Instagram', icon: '📸' },
  { id: 'twitter', name: 'X (Twitter)', icon: '🐦' },
  { id: 'tiktok', name: 'TikTok', icon: '🎵' },
  { id: 'youtube', name: 'YouTube', icon: '▶️' },
  { id: 'snapchat', name: 'Snapchat', icon: '👻' },
  { id: 'facebook', name: 'Facebook', icon: '👤' },
  { id: 'discord', name: 'Discord', icon: '🎮' },
  { id: 'twitch', name: 'Twitch', icon: '🎬' }
];
