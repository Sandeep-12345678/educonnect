const express = require('express');
const db = require('../db');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

// Load env (in production use dotenv)
const env = process.env;

const PROVIDERS = {
  google: {
    name: 'Google',
    idField: 'google_id',
    color: '#4285F4',
    // Real verification: decode Google ID token
    async verify(token) {
      try {
        const { OAuth2Client } = require('google-auth-library');
        const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);
        const ticket = await client.verifyIdToken({
          idToken: token,
          audience: env.GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();
        return {
          provider_id: payload.sub,
          email: payload.email,
          name: payload.name || payload.email?.split('@')[0],
          picture: payload.picture || null,
          verified: payload.email_verified
        };
      } catch (e) {
        return { error: `Google verification failed: ${e.message}` };
      }
    }
  },
  github: {
    name: 'GitHub',
    idField: 'github_id',
    color: '#24292e',
    // Exchange GitHub auth code for access token, then fetch user
    async verify(code) {
      try {
        // Exchange code for access token
        const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            client_id: env.GITHUB_CLIENT_ID,
            client_secret: env.GITHUB_CLIENT_SECRET,
            code
          })
        });
        const tokenData = await tokenRes.json();
        if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

        // Fetch user info
        const userRes = await fetch('https://api.github.com/user', {
          headers: { 
            'Authorization': `Bearer ${tokenData.access_token}`,
            'User-Agent': 'EduConnect'
          }
        });
        const userData = await userRes.json();
        
        // Fetch emails
        const emailRes = await fetch('https://api.github.com/user/emails', {
          headers: { 
            'Authorization': `Bearer ${tokenData.access_token}`,
            'User-Agent': 'EduConnect'
          }
        });
        const emails = await emailRes.json();
        const primary = emails.find(e => e.primary) || emails[0];

        return {
          provider_id: String(userData.id),
          email: primary?.email || userData.email,
          name: userData.name || userData.login,
          picture: userData.avatar_url || null
        };
      } catch (e) {
        return { error: `GitHub verification failed: ${e.message}` };
      }
    }
  },
  apple: {
    name: 'Apple',
    idField: 'apple_id',
    color: '#000000',
    // Verify Apple identity token
    async verify(identityToken) {
      try {
        // In production: verify with apple-signin-auth or manually with JWKS
        // Decode the JWT to get user info (Apple signs with their private key)
        const parts = identityToken.split('.');
        if (parts.length !== 3) throw new Error('Invalid identity token');
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        
        return {
          provider_id: payload.sub,
          email: payload.email || `${payload.sub}@privaterelay.appleid.com`,
          name: payload.email?.split('@')[0] || 'Apple User',
          picture: null
        };
      } catch (e) {
        return { error: `Apple verification failed: ${e.message}` };
      }
    }
  },
  microsoft: {
    name: 'Microsoft',
    idField: 'microsoft_id',
    color: '#00A4EF',
    // Exchange Microsoft auth code for token, fetch user
    async verify(code) {
      try {
        const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: env.MICROSOFT_CLIENT_ID,
            client_secret: env.MICROSOFT_CLIENT_SECRET,
            code,
            redirect_uri: `${env.APP_URL}/auth/microsoft/callback`,
            grant_type: 'authorization_code'
          })
        });
        const tokenData = await tokenRes.json();
        if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

        // Fetch user from Microsoft Graph
        const userRes = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
        });
        const userData = await userRes.json();

        return {
          provider_id: userData.id,
          email: userData.mail || userData.userPrincipalName,
          name: userData.displayName || userData.userPrincipalName?.split('@')[0],
          picture: null
        };
      } catch (e) {
        return { error: `Microsoft verification failed: ${e.message}` };
      }
    }
  },
  discord: {
    name: 'Discord',
    idField: 'discord_id',
    color: '#5865F2',
    // Exchange Discord auth code for token, fetch user
    async verify(code) {
      try {
        const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: env.DISCORD_CLIENT_ID,
            client_secret: env.DISCORD_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: `${env.APP_URL}/auth/discord/callback`
          })
        });
        const tokenData = await tokenRes.json();
        if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

        // Fetch user info
        const userRes = await fetch('https://discord.com/api/users/@me', {
          headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
        });
        const userData = await userRes.json();

        return {
          provider_id: userData.id,
          email: userData.email || `${userData.username}@discord.user`,
          name: userData.global_name || userData.username,
          picture: userData.avatar 
            ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
            : null
        };
      } catch (e) {
        return { error: `Discord verification failed: ${e.message}` };
      }
    }
  }
};

// ====== OAuth Code Exchange ======
// Frontend redirects → callback page → this endpoint exchanges code for real token
router.post('/callback/:provider', async (req, res) => {
  const { provider } = req.params;
  const { code } = req.body;

  const config = PROVIDERS[provider];
  if (!config) {
    return res.status(400).json({ error: `Unsupported provider: ${provider}` });
  }

  if (!code) {
    return res.status(400).json({ error: 'Authorization code required' });
  }

  // Check if credentials are configured
  const credKey = `${provider.toUpperCase()}_CLIENT_ID`;
  if (!env[credKey]) {
    return res.status(500).json({ 
      error: `${config.name} OAuth not configured. Add ${credKey} to .env`,
      needs_config: true
    });
  }

  const result = await config.verify(code);
  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  // Find or create user
  const { provider_id, email, name, picture } = result;
  const { idField } = config;

  let user = db.prepare(`SELECT * FROM users WHERE ${idField} = ?`).get(provider_id);
  
  if (user) {
    if (user.is_restricted) {
      return res.status(403).json({ error: 'Account restricted. Contact an admin.' });
    }
    const token = generateToken(user);
    const { password_hash, totp_secret, ...safeUser } = user;
    return res.json({ user: safeUser, token, newUser: false, provider });
  }

  // Check email link
  if (email) {
    user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (user) {
      db.prepare(`UPDATE users SET ${idField} = ?, avatar = COALESCE(avatar, ?) WHERE id = ?`)
        .run(provider_id, picture, user.id);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
      const token = generateToken(user);
      const { password_hash, totp_secret, ...safeUser } = user;
      return res.json({ user: safeUser, token, newUser: false, linked: true, provider });
    }
  }

  // Create new user
  const baseUsername = (name || (email || '').split('@')[0] || provider).replace(/[^a-zA-Z0-9_]/g, '').substring(0, 25);
  let username = baseUsername;
  let counter = 1;
  while (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
    username = `${baseUsername}${counter}`;
    counter++;
  }

  const result2 = db.prepare(
    `INSERT INTO users (username, email, ${idField}, avatar) VALUES (?, ?, ?, ?)`
  ).run(username, email, provider_id, picture || null);

  user = db.prepare('SELECT * FROM users WHERE id = ?').get(result2.lastInsertRowid);
  const token = generateToken(user);
  const { password_hash, totp_secret, ...safeUser } = user;
  res.status(201).json({ user: safeUser, token, newUser: true, provider });
});

// ====== Get OAuth URLs for redirect flow ======
router.get('/url/:provider', (req, res) => {
  const { provider } = req.params;
  const appUrl = env.APP_URL || 'http://localhost:5173';

  const urls = {
    google: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${env.GOOGLE_CLIENT_ID}&redirect_uri=${appUrl}/auth/google/callback&response_type=code&scope=openid%20profile%20email&access_type=offline&prompt=consent`,
    github: `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&redirect_uri=${appUrl}/auth/github/callback&scope=user:email`,
    microsoft: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${env.MICROSOFT_CLIENT_ID}&redirect_uri=${appUrl}/auth/microsoft/callback&response_type=code&scope=user.read%20openid%20profile%20email`,
    discord: `https://discord.com/api/oauth2/authorize?client_id=${env.DISCORD_CLIENT_ID}&redirect_uri=${appUrl}/auth/discord/callback&response_type=code&scope=identify%20email`
  };

  const url = urls[provider];
  if (!url) return res.status(400).json({ error: `No redirect URL for ${provider}` });

  res.json({ url });
});

// ====== Google One-Tap / Token Verification ======
router.post('/google/verify', async (req, res) => {
  const { credential } = req.body; // Google's ID token (JWT)

  if (!credential) {
    return res.status(400).json({ error: 'Google credential required' });
  }

  if (!env.GOOGLE_CLIENT_ID) {
    return res.status(500).json({ error: 'Google OAuth not configured' });
  }

  try {
    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();

    if (!payload.email_verified) {
      return res.status(400).json({ error: 'Email not verified by Google' });
    }

    finishOAuthLogin(res, 'google', 'google_id', {
      provider_id: payload.sub,
      email: payload.email,
      name: payload.name || payload.email?.split('@')[0],
      picture: payload.picture || null
    });
  } catch (e) {
    res.status(400).json({ error: `Google verification failed: ${e.message}` });
  }
});

// ====== Apple ID Token Verification ======
router.post('/apple/verify', (req, res) => {
  const { identityToken, user: appleUser } = req.body;

  if (!identityToken && !appleUser) {
    return res.status(400).json({ error: 'Apple identity token required' });
  }

  try {
    const parts = (identityToken || '').split('.');
    let payload = {};
    if (parts.length === 3) {
      payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    }

    finishOAuthLogin(res, 'apple', 'apple_id', {
      provider_id: payload.sub || appleUser || `apple_${Date.now()}`,
      email: payload.email || `${payload.sub || 'user'}@privaterelay.appleid.com`,
      name: payload.email?.split('@')[0] || 'Apple User',
      picture: null
    });
  } catch (e) {
    res.status(400).json({ error: `Apple verification failed: ${e.message}` });
  }
});

// ====== Provider info ======
router.get('/providers', (req, res) => {
  const providers = Object.entries(PROVIDERS).map(([id, config]) => ({
    id,
    name: config.name,
    color: config.color,
    configured: !!env[`${id.toUpperCase()}_CLIENT_ID`],
    // Google uses One-Tap (in-page), others use redirect
    flow: id === 'google' ? 'onetap' : id === 'apple' ? 'popup' : 'redirect'
  }));
  res.json({ providers });
});

// ====== Linked providers for a user ======
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

// ====== Unlink provider ======
router.delete('/unlink/:provider', require('../middleware/auth').authMiddleware, (req, res) => {
  const { provider } = req.params;
  const config = PROVIDERS[provider];
  if (!config) return res.status(400).json({ error: `Unsupported: ${provider}` });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  
  let methods = user.password_hash ? 1 : 0;
  for (const [id, c] of Object.entries(PROVIDERS)) {
    if (user[c.idField]) methods++;
  }
  if (user[config.idField] && methods <= 1) {
    return res.status(400).json({ error: `Cannot unlink — only auth method` });
  }

  db.prepare(`UPDATE users SET ${config.idField} = NULL WHERE id = ?`).run(req.user.id);
  res.json({ success: true });
});

// ====== Helper ======
function finishOAuthLogin(res, provider, idField, { provider_id, email, name, picture }) {
  let user = db.prepare(`SELECT * FROM users WHERE ${idField} = ?`).get(provider_id);
  
  if (user) {
    if (user.is_restricted) {
      return res.status(403).json({ error: 'Account restricted.' });
    }
    const token = generateToken(user);
    const { password_hash, totp_secret, ...safeUser } = user;
    return res.json({ user: safeUser, token, newUser: false, provider });
  }

  if (email) {
    user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (user) {
      db.prepare(`UPDATE users SET ${idField} = ?, avatar = COALESCE(avatar, ?) WHERE id = ?`)
        .run(provider_id, picture, user.id);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
      const token = generateToken(user);
      const { password_hash, totp_secret, ...safeUser } = user;
      return res.json({ user: safeUser, token, newUser: false, linked: true, provider });
    }
  }

  const baseUsername = (name || email?.split('@')[0] || provider).replace(/[^a-zA-Z0-9_]/g, '').substring(0, 25);
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
  const { password_hash, totp_secret, ...safeUser } = user;
  res.status(201).json({ user: safeUser, token, newUser: true, provider });
}

module.exports = router;
module.exports.PROVIDERS = PROVIDERS;
