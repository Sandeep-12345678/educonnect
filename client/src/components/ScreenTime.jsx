import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';

export default function ScreenTime() {
  const { socket } = useSocket();
  const [status, setStatus] = useState({ usage: 0, limit: 120, remaining: 120, exceeded: false });
  const [weekly, setWeekly] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus();
    fetchWeekly();

    // Listen for socket screen time updates
    if (socket) {
      const handler = (data) => setStatus(data);
      socket.on('screenTime:status', handler);
      socket.emit('screenTime:check');
      return () => socket.off('screenTime:status', handler);
    }
  }, [socket]);

  const fetchStatus = async () => {
    try {
      const res = await api.get('/screen-time/status');
      setStatus(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchWeekly = async () => {
    try {
      const res = await api.get('/screen-time/weekly');
      setWeekly(res.data.report || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const usagePercent = status.limit > 0 ? Math.min(100, (status.usage / status.limit) * 100) : 0;
  const barClass = usagePercent > 90 ? 'danger' : usagePercent > 70 ? 'warning' : 'safe';

  // Build weekly display (last 7 days)
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const entry = weekly.find(w => w.date === dateStr);
    days.push({
      day: dayNames[d.getDay()],
      date: dateStr,
      min: entry ? entry.total_min : 0
    });
  }
  const maxMin = Math.max(...days.map(d => d.min), status.limit, 10);

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  return (
    <div>
      <h2 style={{ marginBottom: 24, fontSize: '1.6rem', fontWeight: 700 }}>⏱️ Screen Time</h2>

      {status.exceeded && (
        <div className="screen-time-exceeded">
          <div className="icon">🌿</div>
          <h3>Screen Time Limit Reached!</h3>
          <p style={{ marginTop: 8 }}>
            You've used {status.usage} of your {status.limit} minute daily limit.
            Take a break — go outside, read a book, or chat with friends offline!
          </p>
        </div>
      )}

      <div className="screen-time-card" style={{ marginBottom: 24 }}>
        <h3>📊 Today's Usage</h3>
        
        <div className="time-bar-container">
          <div className="time-bar-label">
            <span>{status.usage} min used</span>
            <span>Limit: {status.limit} min</span>
          </div>
          <div className="time-bar">
            <div 
              className={`time-bar-fill ${barClass}`} 
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </div>

        <div className="time-stats">
          <div className="time-stat">
            <div className="value">{status.usage}</div>
            <div className="label">Minutes Used</div>
          </div>
          <div className="time-stat">
            <div className="value" style={{ color: status.remaining <= 15 ? 'var(--danger)' : 'var(--success)' }}>
              {status.remaining}
            </div>
            <div className="label">Minutes Left</div>
          </div>
          <div className="time-stat">
            <div className="value">{status.limit}</div>
            <div className="label">Daily Limit</div>
          </div>
        </div>
      </div>

      <div className="screen-time-card">
        <h3>📅 Last 7 Days</h3>
        <div className="weekly-chart">
          {days.map((d, i) => (
            <div key={i} className="weekly-bar-wrapper">
              <div 
                className={`weekly-bar ${d.min > status.limit ? 'over' : ''}`}
                style={{ height: `${(d.min / maxMin) * 100}%` }}
                title={`${d.date}: ${d.min} min`}
              />
              <div className="weekly-day">{d.day}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: '0.8rem', color: 'var(--text-light)' }}>
          {days.map((d, i) => (
            <span key={i} style={{ textAlign: 'center', width: `${100/7}%` }}>{d.min}m</span>
          ))}
        </div>
      </div>

      <div className="screen-time-card" style={{ marginTop: 24 }}>
        <h3>💡 Healthy Screen Habits</h3>
        <ul style={{ paddingLeft: 20, color: 'var(--text-secondary)', lineHeight: 2 }}>
          <li>Take a 5-minute break every 25 minutes</li>
          <li>Keep screens away 1 hour before bedtime</li>
          <li>Blink often and follow the 20-20-20 rule</li>
          <li>Get outside for at least 30 minutes daily</li>
          <li>Use night mode in the evening</li>
        </ul>
      </div>
    </div>
  );
}
