const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { generateToken, authMiddleware } = require('../middleware/auth');

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

  const user = db.prepare('SELECT id, username, email, role FROM users WHERE id = ?').get(result.lastInsertRowid);
  const token = generateToken(user);
  res.status(201).json({ user, token });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = generateToken(user);
  const { password_hash, ...safeUser } = user;
  res.json({ user: safeUser, token });
});

router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare(
    'SELECT id, username, email, role, avatar, screen_time_limit_min, is_restricted, created_at FROM users WHERE id = ?'
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
