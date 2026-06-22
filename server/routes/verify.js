const express = require('express');
const db = require('../db');
const { authMiddleware, generateToken } = require('../middleware/auth');

const router = express.Router();

// Request age verification
router.post('/verify', authMiddleware, (req, res) => {
  const { method, self_declared_age } = req.body;

  if (!method || !self_declared_age) {
    return res.status(400).json({ error: 'Verification method and age required' });
  }

  const age = parseInt(self_declared_age);
  if (isNaN(age) || age < 13) {
    return res.status(400).json({ error: 'Must be at least 13 years old' });
  }

  if (age < 18) {
    return res.status(400).json({ 
      error: 'You must be 18+ for adult features. Student mode is active.',
      restricted: true
    });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // In production: integrate with a real age verification service
  // like Amazon Rekognition, Yoti, or Veriff
  // For now: simulated verification with a success rate based on age declaration

  const verificationSuccessful = age >= 18;

  if (verificationSuccessful) {
    // Upgrade user to verified adult
    db.prepare(`
      UPDATE users 
      SET age_verified = 1, 
          role = 'verified_adult',
          screen_time_limit_min = 0,
          age_verification_method = ?
      WHERE id = ?
    `).run(method, req.user.id);

    // Auto-approve all social connections for verified adults
    db.prepare(`
      UPDATE social_connections 
      SET status = 'approved' 
      WHERE user_id = ? AND status = 'pending'
    `).run(req.user.id);

    // Auto-approve all pending parental consents
    const pendingConsents = db.prepare(
      'SELECT id FROM parental_consents WHERE student_id = ? AND status = ?'
    ).all(req.user.id, 'pending');

    for (const c of pendingConsents) {
      const consent = db.prepare('SELECT * FROM parental_consents WHERE id = ?').get(c.id);
      const platforms = JSON.parse(consent.platforms || '[]');
      for (const platform of platforms) {
        db.prepare(`
          INSERT OR IGNORE INTO social_connections (user_id, platform, status)
          VALUES (?, ?, 'approved')
        `).run(req.user.id, platform);
      }
      db.prepare('UPDATE parental_consents SET status = ? WHERE id = ?').run('approved', c.id);
    }

    const updatedUser = db.prepare(
      'SELECT id, username, email, role, age_verified, screen_time_limit_min FROM users WHERE id = ?'
    ).get(req.user.id);

    const token = generateToken(updatedUser);

    return res.json({
      success: true,
      verified: true,
      user: updatedUser,
      token,
      message: '🎉 Age verified! You now have access to all adult features: unlimited screen time, all social media platforms, and unrestricted content.'
    });
  }

  res.json({
    success: false,
    verified: false,
    message: 'Verification failed. Please try again.'
  });
});

// Check verification status
router.get('/status', authMiddleware, (req, res) => {
  const user = db.prepare(
    'SELECT age_verified, role, screen_time_limit_min, age_verification_method FROM users WHERE id = ?'
  ).get(req.user.id);

  res.json({
    age_verified: !!user.age_verified,
    is_adult: user.role === 'verified_adult',
    screen_time_limit: user.screen_time_limit_min,
    method: user.age_verification_method
  });
});

// Revoke verification (admin or self)
router.post('/revoke', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.prepare(`
    UPDATE users 
    SET age_verified = 0, role = 'student', screen_time_limit_min = 120, age_verification_method = NULL
    WHERE id = ?
  `).run(req.user.id);

  res.json({ success: true, message: 'Verification revoked. Student mode restored.' });
});

module.exports = router;
