const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { generateToken, authMiddleware, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

router.post('/register', (req, res) => {
  const { username, email, password } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields required' });
  }
  if (username.length < 3 || username.length > 30) {
    return res.status(400).json({ error: 'Username must be 3-30 characters' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  if (existing) {
    return res.status(409).json({ error: 'Username or email already taken' });
  }

  const password_hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)'
  ).run(username, email, password_hash);

  const user = db.prepare('SELECT id, username, email, role, age_verified FROM users WHERE id = ?').get(result.lastInsertRowid);
  const token = generateToken(user);
  res.status(201).json({ user, token });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username);
  if (!user || !user.password_hash || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials. If you signed up with Google, use the Google button.' });
  }

  if (user.is_restricted) {
    return res.status(403).json({ error: 'Account restricted. Contact an admin.' });
  }

  // Check if 2FA is enabled - require TOTP verification
  if (user.totp_enabled) {
    const jwt = require('jsonwebtoken');
    const tempToken = jwt.sign(
      { userId: user.id, type: 'totp_verify' },
      JWT_SECRET + '_totp',
      { expiresIn: '5m' }
    );
    return res.json({
      requires_2fa: true,
      temp_token: tempToken,
      message: 'Enter the 6-digit code from your authenticator app.'
    });
  }

  const token = generateToken(user);
  const { password_hash, ...safeUser } = user;
  res.json({ user: safeUser, token });
});

// Google OAuth
router.post('/google', (req, res) => {
  const { google_id, email, name, picture } = req.body;

  if (!google_id || !email) {
    return res.status(400).json({ error: 'Google ID and email required' });
  }

  // Check if user already exists with this Google ID
  let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(google_id);
  
  if (user) {
    if (user.is_restricted) {
      return res.status(403).json({ error: 'Account restricted. Contact an admin.' });
    }
    const token = generateToken(user);
    const { password_hash, ...safeUser } = user;
    return res.json({ user: safeUser, token, newUser: false });
  }

  // Check if email already registered (link accounts)
  user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (user) {
    db.prepare('UPDATE users SET google_id = ?, avatar = COALESCE(avatar, ?) WHERE id = ?')
      .run(google_id, picture, user.id);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    const token = generateToken(user);
    const { password_hash, ...safeUser } = user;
    return res.json({ user: safeUser, token, newUser: false, linked: true });
  }

  // Create new user from Google
  const baseUsername = (name || email.split('@')[0]).replace(/[^a-zA-Z0-9_]/g, '').substring(0, 25);
  let username = baseUsername;
  let counter = 1;
  while (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
    username = `${baseUsername}${counter}`;
    counter++;
  }

  const result = db.prepare(
    'INSERT INTO users (username, email, google_id, avatar) VALUES (?, ?, ?, ?)'
  ).run(username, email, google_id, picture || null);

  user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  const token = generateToken(user);
  const { password_hash, ...safeUser } = user;
  res.status(201).json({ user: safeUser, token, newUser: true });
});

router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare(
    'SELECT id, username, email, role, avatar, screen_time_limit_min, is_restricted, age_verified, google_id, created_at FROM users WHERE id = ?'
  ).get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

router.put('/me', authMiddleware, (req, res) => {
  const { avatar } = req.body;
  db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar || null, req.user.id);
  res.json({ success: true });
});

module.exports = router;
