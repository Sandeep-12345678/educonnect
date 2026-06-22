import { useState, useEffect } from 'react';
import api from '../utils/api';

export default function AdminPanel() {
  const [tab, setTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [flaggedPosts, setFlaggedPosts] = useState([]);
  const [reports, setReports] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [filterWord, setFilterWord] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchFlagged();
    fetchReports();
    fetchUsers();
    setLoading(false);
  }, []);

  const fetchStats = async () => {
    try { const res = await api.get('/admin/stats'); setStats(res.data.stats); } 
    catch (err) { console.error(err); }
  };

  const fetchFlagged = async () => {
    try { const res = await api.get('/admin/flagged'); setFlaggedPosts(res.data.posts); } 
    catch (err) { console.error(err); }
  };

  const fetchReports = async () => {
    try { const res = await api.get('/admin/reports'); setReports(res.data.reports); } 
    catch (err) { console.error(err); }
  };

  const fetchUsers = async () => {
    try { const res = await api.get('/admin/users'); setAllUsers(res.data.users); } 
    catch (err) { console.error(err); }
  };

  const removePost = async (id) => {
    if (!confirm('Remove this post? This cannot be undone.')) return;
    await api.put(`/admin/posts/${id}/remove`);
    fetchFlagged();
    fetchStats();
  };

  const approvePost = async (id) => {
    await api.put(`/admin/posts/${id}/approve`);
    fetchFlagged();
    fetchStats();
  };

  const resolveReport = async (id) => {
    await api.put(`/admin/reports/${id}/resolve`);
    fetchReports();
  };

  const setScreenTimeLimit = async (userId) => {
    const limit = prompt('Set daily screen time limit (minutes):', '120');
    if (!limit) return;
    await api.put(`/admin/users/${userId}/screen-time`, { limit_min: parseInt(limit) });
    fetchUsers();
  };

  const toggleRestrict = async (userId, current) => {
    const action = current ? 'unrestrict' : 'restrict';
    if (!confirm(`${action} this user?`)) return;
    await api.put(`/admin/users/${userId}/restrict`, { restricted: !current });
    fetchUsers();
  };

  const addFilterWord = async () => {
    if (!filterWord.trim()) return;
    await api.post('/admin/filter-words', { word: filterWord.trim() });
    setFilterWord('');
    alert('Filter word added!');
  };

  const formatTime = (d) => new Date(d).toLocaleDateString();

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  return (
    <div className="admin-page">
      <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 24 }}>🛡️ Admin Panel</h2>

      <div className="admin-tabs">
        {['stats', 'flagged', 'reports', 'users', 'filters'].map(t => (
          <button key={t} className={`admin-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'stats' && stats && (
        <>
          <div className="stats-grid">
            <div className="stat-card"><div className="number">{stats.totalUsers}</div><div className="label">Total Users</div></div>
            <div className="stat-card"><div className="number">{stats.totalPosts}</div><div className="label">Active Posts</div></div>
            <div className="stat-card"><div className="number" style={{ color: 'var(--warning)' }}>{stats.flaggedPosts}</div><div className="label">Flagged Posts</div></div>
            <div className="stat-card"><div className="number" style={{ color: 'var(--danger)' }}>{stats.totalReports}</div><div className="label">Open Reports</div></div>
            <div className="stat-card"><div className="number" style={{ color: 'var(--secondary)' }}>{stats.totalMessages}</div><div className="label">Messages</div></div>
          </div>
        </>
      )}

      {tab === 'flagged' && (
        <div className="data-table">
          <table>
            <thead>
              <tr><th>Post</th><th>Author</th><th>Reports</th><th>Date</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {flaggedPosts.map(p => (
                <tr key={p.id}>
                  <td style={{ maxWidth: 300 }}>
                    <div style={{ fontWeight: 500 }}>{p.content?.substring(0, 80)}{p.content?.length > 80 && '...'}</div>
                    {p.media_url && <span className="badge badge-flagged">📎 Media</span>}
                  </td>
                  <td>{p.username}</td>
                  <td><span className="badge badge-flagged">{p.report_count}</span></td>
                  <td>{formatTime(p.created_at)}</td>
                  <td>
                    <button className="btn-primary btn-sm" onClick={() => approvePost(p.id)} style={{ marginRight: 8 }}>✓ Approve</button>
                    <button className="btn-danger btn-sm" onClick={() => removePost(p.id)}>✕ Remove</button>
                  </td>
                </tr>
              ))}
              {flaggedPosts.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: 'var(--text-light)' }}>No flagged posts 🎉</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'reports' && (
        <div className="data-table">
          <table>
            <thead>
              <tr><th>Reporter</th><th>Post Author</th><th>Content</th><th>Reason</th><th>Action</th></tr>
            </thead>
            <tbody>
              {reports.map(r => (
                <tr key={r.id}>
                  <td>{r.reporter_name}</td>
                  <td>{r.post_author}</td>
                  <td style={{ maxWidth: 200 }}>{r.post_content?.substring(0, 60)}</td>
                  <td>{r.reason}</td>
                  <td>
                    <button className="btn-primary btn-sm" onClick={() => resolveReport(r.id)}>Resolve</button>
                  </td>
                </tr>
              ))}
              {reports.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: 'var(--text-light)' }}>No open reports 🎉</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'users' && (
        <div className="data-table">
          <table>
            <thead>
              <tr><th>Username</th><th>Role</th><th>Screen Limit</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {allUsers.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.username}</td>
                  <td><span className={`badge badge-${u.role}`}>{u.role}</span></td>
                  <td>{u.screen_time_limit_min} min/day</td>
                  <td>
                    {u.is_restricted ? <span className="badge badge-restricted">Restricted</span> : 
                     <span className="badge badge-student">Active</span>}
                  </td>
                  <td>
                    <button className="btn-secondary btn-sm" onClick={() => setScreenTimeLimit(u.id)} style={{ marginRight: 6 }}>⏱ Limit</button>
                    <button 
                      className={`btn-sm ${u.is_restricted ? 'btn-primary' : 'btn-danger'}`}
                      onClick={() => toggleRestrict(u.id, u.is_restricted)}
                    >
                      {u.is_restricted ? 'Unrestrict' : 'Restrict'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'filters' && (
        <div className="screen-time-card">
          <h3>🔇 Content Filter Words</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: '0.9rem' }}>
            Words added here will be automatically censored in posts and messages.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={filterWord}
              onChange={e => setFilterWord(e.target.value)}
              placeholder="Enter a word to filter..."
              onKeyDown={e => e.key === 'Enter' && addFilterWord()}
            />
            <button className="btn-primary" onClick={addFilterWord}>Add</button>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: 12 }}>
            💡 Default filter includes common profanity. Add more words as needed.
          </p>
        </div>
      )}
    </div>
  );
}
