const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');

const router = express.Router();

// Generate 6-digit code
function generateCode() {
  return crypto.randomInt(100000, 999999).toString();
}

// ====== SEND VERIFICATION CODE ======

// Send email login/reset code
router.post('/send-email', (req, res) => {
  const { email, type } = req.body; // type: 'login' or 'reset'
  
  if (!email) return res.status(400).json({ error: 'Email required' });
  if (!['login', 'reset'].includes(type)) return res.status(400).json({ error: 'Type must be login or reset' });

  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  
  if (type === 'login' && !user) {
    return res.status(404).json({ error: 'No account found with that email' });
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

  db.prepare(`
    INSERT INTO verification_codes (user_id, email, code, type, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(user?.id || null, email, code, `email_${type}`, expiresAt);

  // In production: send real email via SendGrid/Mailgun
  // For demo: log the code
  console.log(`[EMAIL CODE] ${email} → ${code} (type: ${type})`);

  res.json({
    success: true,
    message: `Verification code sent to ${email}`,
    expires_in_minutes: 10,
    // Demo only: include code in response (remove in production)
    demo_code: code
  });
});

// Send phone verification code
router.post('/send-phone', (req, res) => {
  const { phone, userId } = req.body;

  if (!phone) return res.status(400).json({ error: 'Phone number required' });
  
  // Basic phone validation
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  if (!/^\+?[1-9]\d{7,14}$/.test(cleanPhone)) {
    return res.status(400).json({ error: 'Invalid phone number format (e.g., +1234567890)' });
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO verification_codes (user_id, phone, code, type, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId || null, cleanPhone, code, userId ? 'phone_verify' : 'phone_login', expiresAt);

  console.log(`[SMS CODE] ${cleanPhone} → ${code}`);

  res.json({
    success: true,
    message: `Verification code sent to ${cleanPhone}`,
    expires_in_minutes: 10,
    demo_code: code
  });
});

// ====== VERIFY CODE ======

// Verify email code for login
router.post('/verify-email-login', (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) return res.status(400).json({ error: 'Email and code required' });

  const record = db.prepare(`
    SELECT * FROM verification_codes 
    WHERE email = ? AND code = ? AND type = 'email_login' AND used = 0
    ORDER BY created_at DESC LIMIT 1
  `).get(email, code);

  if (!record) return res.status(400).json({ error: 'Invalid or expired code' });
  if (new Date(record.expires_at) < new Date()) return res.status(400).json({ error: 'Code expired. Request a new one.' });

  db.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').run(record.id);

  // Find or create user
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    // Create account with email login
    const username = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
    const finalUsername = makeUniqueUsername(username);
    const result = db.prepare(
      'INSERT INTO users (username, email) VALUES (?, ?)'
    ).run(finalUsername, email);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  }

  const jwt = require('jsonwebtoken');
  const { JWT_SECRET } = require('../middleware/auth');
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  const { password_hash, totp_secret, ...safeUser } = user;

  res.json({ user: safeUser, token, method: 'email' });
});

// Verify phone code for login
router.post('/verify-phone-login', (req, res) => {
  const { phone, code } = req.body;

  if (!phone || !code) return res.status(400).json({ error: 'Phone and code required' });

  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  const record = db.prepare(`
    SELECT * FROM verification_codes 
    WHERE phone = ? AND code = ? AND type = 'phone_login' AND used = 0
    ORDER BY created_at DESC LIMIT 1
  `).get(cleanPhone, code);

  if (!record) return res.status(400).json({ error: 'Invalid or expired code' });
  if (new Date(record.expires_at) < new Date()) return res.status(400).json({ error: 'Code expired' });

  db.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').run(record.id);

  // Try to find user by phone
  let user = db.prepare('SELECT * FROM users WHERE phone = ? AND phone_verified = 1').get(cleanPhone);
  
  if (!user) {
    // Check if record has user_id
    if (record.user_id) {
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(record.user_id);
    }
    if (!user) {
      return res.status(404).json({ error: 'No verified account linked to this phone. Add phone in settings first.' });
    }
  }

  const jwt = require('jsonwebtoken');
  const { JWT_SECRET } = require('../middleware/auth');
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  const { password_hash, totp_secret, ...safeUser } = user;

  res.json({ user: safeUser, token, method: 'phone' });
});

// ====== PASSWORD RESET ======

// Reset password with email code
router.post('/reset-password', (req, res) => {
  const { email, code, new_password } = req.body;

  if (!email || !code || !new_password) return res.status(400).json({ error: 'Email, code, and new password required' });
  if (new_password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const record = db.prepare(`
    SELECT * FROM verification_codes 
    WHERE email = ? AND code = ? AND type = 'email_reset' AND used = 0
    ORDER BY created_at DESC LIMIT 1
  `).get(email, code);

  if (!record) return res.status(400).json({ error: 'Invalid or expired reset code' });
  if (new Date(record.expires_at) < new Date()) return res.status(400).json({ error: 'Code expired' });

  db.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').run(record.id);

  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, record.user_id);

  res.json({ success: true, message: 'Password reset successfully! You can now log in.' });
});

// ====== PHONE MANAGEMENT ======

// Add/verify phone for logged-in user
router.post('/verify-phone', require('../middleware/auth').authMiddleware, (req, res) => {
  const { phone, code } = req.body;

  if (!phone || !code) return res.status(400).json({ error: 'Phone and code required' });

  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  const record = db.prepare(`
    SELECT * FROM verification_codes 
    WHERE phone = ? AND code = ? AND type = 'phone_verify' AND used = 0 AND user_id = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(cleanPhone, code, req.user.id);

  if (!record) return res.status(400).json({ error: 'Invalid or expired code' });
  if (new Date(record.expires_at) < new Date()) return res.status(400).json({ error: 'Code expired' });

  db.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').run(record.id);
  db.prepare('UPDATE users SET phone = ?, phone_verified = 1 WHERE id = ?').run(cleanPhone, req.user.id);

  res.json({ success: true, message: 'Phone verified! You can now log in with SMS codes.' });
});

// ====== HELPERS ======

function makeUniqueUsername(base) {
  let username = base.substring(0, 25) || 'user';
  let counter = 1;
  while (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
    username = `${base.substring(0, 22)}${counter}`;
    counter++;
  }
  return username;
}

module.exports = router;
