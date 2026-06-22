const db = require('../db');

// Track active sessions in memory
const activeSessions = new Map(); // userId -> { startTime, socketId, warned }

function startSession(userId, socketId) {
  // End any existing session
  endSession(userId);
  
  const session = {
    startTime: new Date().toISOString(),
    socketId,
    warned: false
  };
  
  db.prepare(`
    INSERT INTO screen_time_logs (user_id, session_start) VALUES (?, ?)
  `).run(userId, session.startTime);
  
  activeSessions.set(userId, session);
  return session;
}

function endSession(userId) {
  const session = activeSessions.get(userId);
  if (!session) return null;
  
  const now = new Date().toISOString();
  const startTime = new Date(session.startTime);
  const durationMin = Math.round((new Date(now) - startTime) / 60000);
  
  db.prepare(`
    UPDATE screen_time_logs 
    SET session_end = ?, duration_min = ? 
    WHERE user_id = ? AND session_start = ?
  `).run(now, durationMin, userId, session.startTime);
  
  activeSessions.delete(userId);
  return { durationMin };
}

function getTodayUsage(userId) {
  const today = new Date().toISOString().split('T')[0];
  const result = db.prepare(`
    SELECT COALESCE(SUM(duration_min), 0) as total 
    FROM screen_time_logs 
    WHERE user_id = ? AND date = ?
  `).get(userId, today);
  
  // Add current session if active
  const session = activeSessions.get(userId);
  let currentMin = 0;
  if (session) {
    currentMin = Math.round((Date.now() - new Date(session.startTime).getTime()) / 60000);
  }
  
  return result.total + currentMin;
}

function checkLimit(userId) {
  const user = db.prepare('SELECT screen_time_limit_min, role FROM users WHERE id = ?').get(userId);
  if (!user) return { exceeded: false, usage: 0, limit: 0 };
  
  // Verified adults have unlimited screen time
  if (user.role === 'verified_adult') {
    return { exceeded: false, usage: 0, limit: Infinity, remaining: Infinity, is_adult: true };
  }
  
  const usage = getTodayUsage(userId);
  const limit = user.screen_time_limit_min;
  const exceeded = usage >= limit;
  
  return { exceeded, usage, limit, remaining: Math.max(0, limit - usage) };
}

function getWeeklyReport(userId) {
  const report = db.prepare(`
    SELECT date, SUM(duration_min) as total_min
    FROM screen_time_logs
    WHERE user_id = ? AND date >= date('now', '-7 days')
    GROUP BY date
    ORDER BY date DESC
  `).all(userId);
  return report;
}

function getAllUsersScreenTime() {
  return db.prepare(`
    SELECT u.id, u.username, u.screen_time_limit_min as limit_min,
           COALESCE(SUM(st.duration_min), 0) as today_min
    FROM users u
    LEFT JOIN screen_time_logs st ON u.id = st.user_id AND st.date = date('now')
    GROUP BY u.id
    ORDER BY today_min DESC
  `).all();
}

module.exports = {
  startSession, endSession, getTodayUsage, checkLimit, 
  getWeeklyReport, getAllUsersScreenTime, activeSessions
};
