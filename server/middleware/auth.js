const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'educonnect-secret-change-in-production';

function generateToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const token = header.split(' ')[1];
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.split(' ')[1], JWT_SECRET);
    } catch { /* ignore */ }
  }
  next();
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { generateToken, authMiddleware, optionalAuth, adminOnly, JWT_SECRET };
