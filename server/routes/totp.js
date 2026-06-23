const express = require('express');
const { generateSecret, generateSync, verifySync, generateURI } = require('otplib');
const QRCode = require('qrcode');
const db = require('../db');
const { authMiddleware, generateToken } = require('../middleware/auth');

const router = express.Router();

// Generate TOTP secret and QR for setup
router.post('/setup', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, username, totp_enabled FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.totp_enabled) return res.status(409).json({ error: '2FA is already enabled. Disable it first to re-configure.' });

  const secret = generateSecret();
  const otpauthUrl = generateURI({ 
    issuer: 'EduConnect', 
    label: user.username, 
    secret 
  });

  // Store secret temporarily (unverified)
  db.prepare('UPDATE users SET totp_secret = ? WHERE id = ?').run(secret, req.user.id);

  QRCode.toDataURL(otpauthUrl, (err, qrDataUrl) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to generate QR code' });
    }

    res.json({
      secret,
      otpauth_url: otpauthUrl,
      qr_code: qrDataUrl,
      message: 'Scan the QR code with your authenticator app (Google Authenticator, Authy, 1Password, etc.)'
    });
  });
});

// Verify TOTP and enable 2FA
router.post('/enable', authMiddleware, (req, res) => {
  const { code } = req.body;
  if (!code || code.length !== 6) {
    return res.status(400).json({ error: 'Valid 6-digit code required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!user.totp_secret) return res.status(400).json({ error: 'Set up 2FA first via /totp/setup' });

  const isValid = verifySync({ token: code, secret: user.totp_secret });
  if (!isValid) {
    return res.status(400).json({ error: 'Invalid code. Make sure your device time is synced.' });
  }

  db.prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?').run(req.user.id);

  res.json({
    success: true,
    message: '🔐 Two-Factor Authentication enabled! Your account is now more secure.',
    backup_codes: generateBackupCodes(user.id)
  });
});

// Disable TOTP
router.post('/disable', authMiddleware, (req, res) => {
  const { code, password } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Require either TOTP code or password to disable
  if (user.totp_enabled) {
    if (code) {
      const isValid = verifySync({ token: code, secret: user.totp_secret });
      if (!isValid) return res.status(400).json({ error: 'Invalid 2FA code' });
    } else if (password) {
      const bcrypt = require('bcryptjs');
      if (!user.password_hash || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(400).json({ error: 'Invalid password' });
      }
    } else {
      return res.status(400).json({ error: 'Provide 2FA code or password to disable' });
    }
  }

  db.prepare('UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?').run(req.user.id);
  db.prepare('DELETE FROM totp_backup_codes WHERE user_id = ?').run(req.user.id);

  res.json({ success: true, message: '2FA disabled.' });
});

// Get TOTP status
router.get('/status', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT totp_enabled FROM users WHERE id = ?').get(req.user.id);
  res.json({ enabled: !!user?.totp_enabled });
});

// Verify TOTP during login (returns real token)
router.post('/verify', (req, res) => {
  const { temp_token, code, backup_code } = req.body;

  if (!temp_token) return res.status(400).json({ error: 'Temporary token required' });

  let payload;
  try {
    const jwt = require('jsonwebtoken');
    payload = jwt.verify(temp_token, require('../middleware/auth').JWT_SECRET + '_totp');
  } catch {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Check backup code first
  if (backup_code) {
    const valid = db.prepare(
      'SELECT id FROM totp_backup_codes WHERE user_id = ? AND code = ? AND used = 0'
    ).get(user.id, backup_code.toUpperCase());
    
    if (!valid) {
      return res.status(400).json({ error: 'Invalid or already used backup code' });
    }
    
    db.prepare('UPDATE totp_backup_codes SET used = 1, used_at = CURRENT_TIMESTAMP WHERE id = ?').run(valid.id);
  } else {
    // Verify TOTP code
    if (!code || code.length !== 6) {
      return res.status(400).json({ error: '6-digit code required' });
    }

    const isValid = verifySync({ token: code, secret: user.totp_secret });
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid 2FA code. Check your authenticator app.' });
    }
  }

  const token = generateToken(user);
  const { password_hash, totp_secret, ...safeUser } = user;
  res.json({ user: safeUser, token, verified: true });
});

// Get backup codes
router.get('/backup-codes', authMiddleware, (req, res) => {
  const codes = db.prepare(
    'SELECT code, used, used_at FROM totp_backup_codes WHERE user_id = ? ORDER BY id'
  ).all(req.user.id);

  if (codes.length === 0) {
    return res.json({ codes: [], message: 'No backup codes generated. Enable 2FA to generate codes.' });
  }

  res.json({ codes });
});

// Regenerate backup codes
router.post('/backup-codes/regenerate', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT totp_enabled FROM users WHERE id = ?').get(req.user.id);
  if (!user?.totp_enabled) {
    return res.status(400).json({ error: '2FA must be enabled to generate backup codes' });
  }

  db.prepare('DELETE FROM totp_backup_codes WHERE user_id = ?').run(req.user.id);
  const codes = generateBackupCodes(req.user.id);
  res.json({ codes });
});

// ====== Helpers ======

function generateBackupCodes(userId) {
  const crypto = require('crypto');
  const codes = [];
  for (let i = 0; i < 8; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8-char
    codes.push(code);
    db.prepare('INSERT INTO totp_backup_codes (user_id, code) VALUES (?, ?)').run(userId, code);
  }
  return codes;
}

module.exports = router;
