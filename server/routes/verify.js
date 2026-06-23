const express = require('express');
const db = require('../db');
const { authMiddleware, generateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/verify', authMiddleware, (req, res) => {
  const { method, self_declared_age } = req.body;
  if (!method || !self_declared_age) return res.status(400).json({ error: 'Method and age required' });
  const age = parseInt(self_declared_age);
  if (isNaN(age) || age < 13) return res.status(400).json({ error: 'Must be 13+' });
  if (age < 18) return res.status(400).json({ error: 'Adult features require 18+. Student mode remains active.', restricted: true });

  db.prepare(`
    UPDATE users SET age_verified=1, role='verified_adult', screen_time_limit_min=0, age_verification_method=?
    WHERE id=?
  `).run(method, req.user.id);

  db.prepare("UPDATE social_connections SET status='approved' WHERE user_id=? AND status='pending'").run(req.user.id);
  
  const user = db.prepare('SELECT id,username,email,role,age_verified,screen_time_limit_min FROM users WHERE id=?').get(req.user.id);
  const token = generateToken(user);
  res.json({ success:true, verified:true, user, token, message:'Adult features unlocked!' });
});

router.get('/status', authMiddleware, (req, res) => {
  const u = db.prepare('SELECT age_verified,role,screen_time_limit_min FROM users WHERE id=?').get(req.user.id);
  res.json({ age_verified:!!u.age_verified, is_adult:u.role==='verified_adult', screen_time_limit:u.screen_time_limit_min });
});

module.exports = router;
