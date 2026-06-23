const express = require('express');
const db = require('../db');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

const PROVIDERS = {
  google: {
    name: 'Google',
    idField: 'google_id',
    icon: '🔵',
    color: '#4285F4'
  },
  github: {
    name: 'GitHub',
    idField: 'github_id',
    icon: '🐙',
    color: '#333333'
  },
  apple: {
    name: 'Apple',
    idField: 'apple_id',
    icon: '🍎',
    color: '#000000'
  },
  microsoft: {
    name: 'Microsoft',
    idField: 'microsoft_id',
    icon: '🪟',
    color: '#00A4EF'
  },
  discord: {
    name: 'Discord',
    idField: 'discord_id',
    icon: '🎮',
    color: '#5865F2'
  }
};

// Unified OAuth endpoint
router.post('/', (req, res) => {
  const { provider, provider_id, email, name, picture } = req.body;

  if (!provider || !provider_id || !email) {
    return res.status(400).json({ error: 'Provider, provider_id, and email required' });
  }

  const providerConfig = PROVIDERS[provider];
  if (!providerConfig) {
    return res.status(400).json({ 
      error: `Unsupported provider: ${provider}. Supported: ${Object.keys(PROVIDERS).join(', ')}` 
    });
  }

  const { idField } = providerConfig;

  // Check if user exists with this provider ID
  let user = db.prepare(`SELECT * FROM users WHERE ${idField} = ?`).get(provider_id);
  
  if (user) {
    if (user.is_restricted) {
      return res.status(403).json({ error: 'Account restricted. Contact an admin.' });
    }
    const token = generateToken(user);
    const { password_hash, ...safeUser } = user;
    return res.json({ user: safeUser, token, newUser: false, provider });
  }

  // Check if email already exists (link accounts)
  user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (user) {
    db.prepare(`UPDATE users SET ${idField} = ?, avatar = COALESCE(avatar, ?) WHERE id = ?`)
      .run(provider_id, picture, user.id);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    if (user.is_restricted) {
      return res.status(403).json({ error: 'Account restricted. Contact an admin.' });
    }
    const token = generateToken(user);
    const { password_hash, ...safeUser } = user;
    return res.json({ user: safeUser, token, newUser: false, linked: true, provider });
  }

  // Create new user
  const baseUsername = (name || email.split('@')[0]).replace(/[^a-zA-Z0-9_]/g, '').substring(0, 25);
  let username = baseUsername;
  let counter = 1;
  while (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
    username = `${baseUsername}${counter}`;
    counter++;
  }

  const result = db.prepare(
    `INSERT INTO users (username, email, ${idField}, avatar) VALUES (?, ?, ?, ?)`
  ).run(username, email, provider_id, picture || null);

  user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  const token = generateToken(user);
  const { password_hash, ...safeUser } = user;
  res.status(201).json({ user: safeUser, token, newUser: true, provider });
});

// Get available OAuth providers
router.get('/providers', (req, res) => {
  const providers = Object.entries(PROVIDERS).map(([id, config]) => ({
    id,
    name: config.name,
    icon: config.icon,
    color: config.color
  }));
  res.json({ providers });
});

// Link additional provider to existing account
router.post('/link', require('../middleware/auth').authMiddleware, (req, res) => {
  const { provider, provider_id } = req.body;

  if (!provider || !provider_id) {
    return res.status(400).json({ error: 'Provider and provider_id required' });
  }

  const providerConfig = PROVIDERS[provider];
  if (!providerConfig) {
    return res.status(400).json({ error: `Unsupported provider: ${provider}` });
  }

  // Check if this provider ID is already linked to another account
  const existing = db.prepare(
    `SELECT id FROM users WHERE ${providerConfig.idField} = ? AND id != ?`
  ).get(provider_id, req.user.id);
  
  if (existing) {
    return res.status(409).json({ error: `This ${providerConfig.name} account is already linked to another user.` });
  }

  db.prepare(`UPDATE users SET ${providerConfig.idField} = ? WHERE id = ?`)
    .run(provider_id, req.user.id);

  res.json({ success: true, message: `${providerConfig.name} account linked successfully!` });
});

// Unlink a provider
router.delete('/unlink/:provider', require('../middleware/auth').authMiddleware, (req, res) => {
  const { provider } = req.params;
  const providerConfig = PROVIDERS[provider];

  if (!providerConfig) {
    return res.status(400).json({ error: `Unsupported provider: ${provider}` });
  }

  // Don't allow unlinking if it's the only auth method
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Count auth methods
  let authMethods = 0;
  if (user.password_hash) authMethods++;
  for (const p of Object.values(PROVIDERS)) {
    if (user[p.idField]) authMethods++;
  }

  // This provider counts as one if it's set
  const hasThisProvider = !!user[providerConfig.idField];
  const remainingMethods = authMethods - (hasThisProvider ? 1 : 0);

  if (hasThisProvider && remainingMethods === 0) {
    return res.status(400).json({ 
      error: `Cannot unlink ${providerConfig.name} — it's your only login method. Add a password or another provider first.` 
    });
  }

  db.prepare(`UPDATE users SET ${providerConfig.idField} = NULL WHERE id = ?`).run(req.user.id);
  res.json({ success: true, message: `${providerConfig.name} unlinked.` });
});

// Get user's linked providers
router.get('/linked', require('../middleware/auth').authMiddleware, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const linked = [];
  if (user.password_hash) linked.push('password');
  
  for (const [id, config] of Object.entries(PROVIDERS)) {
    if (user[config.idField]) linked.push(id);
  }

  res.json({ linked });
});

module.exports = router;
module.exports.PROVIDERS = PROVIDERS;
