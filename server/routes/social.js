const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const AVAILABLE_PLATFORMS = [
  { id: 'instagram', name: 'Instagram', icon: '📸', color: '#E4405F' },
  { id: 'twitter', name: 'X (Twitter)', icon: '🐦', color: '#1DA1F2' },
  { id: 'tiktok', name: 'TikTok', icon: '🎵', color: '#000000' },
  { id: 'youtube', name: 'YouTube', icon: '▶️', color: '#FF0000' },
  { id: 'snapchat', name: 'Snapchat', icon: '👻', color: '#FFFC00' },
  { id: 'facebook', name: 'Facebook', icon: '👤', color: '#1877F2' },
  { id: 'discord', name: 'Discord', icon: '🎮', color: '#5865F2' },
  { id: 'twitch', name: 'Twitch', icon: '🎬', color: '#9146FF' }
];

// ====== PARENTAL CONSENT ======

// Student requests parental consent
router.post('/consent/request', authMiddleware, (req, res) => {
  const { parent_email, platforms, notes } = req.body;
  
  if (!parent_email || !platforms || !Array.isArray(platforms) || platforms.length === 0) {
    return res.status(400).json({ error: 'Parent email and at least one platform required' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parent_email)) {
    return res.status(400).json({ error: 'Invalid parent email format' });
  }

  // Validate platforms
  const validPlatforms = AVAILABLE_PLATFORMS.map(p => p.id);
  const invalid = platforms.filter(p => !validPlatforms.includes(p));
  if (invalid.length > 0) {
    return res.status(400).json({ error: `Invalid platforms: ${invalid.join(', ')}` });
  }

  // Check for existing pending consent
  const existing = db.prepare(
    'SELECT id FROM parental_consents WHERE student_id = ? AND status = ?'
  ).get(req.user.id, 'pending');
  if (existing) {
    return res.status(409).json({ error: 'A pending consent request already exists' });
  }

  const consentCode = crypto.randomBytes(4).toString('hex').toUpperCase();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  const result = db.prepare(`
    INSERT INTO parental_consents (student_id, parent_email, consent_code, platforms, notes, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.user.id, parent_email, consentCode, JSON.stringify(platforms), notes || null, expiresAt);

  res.status(201).json({
    consent: {
      id: result.lastInsertRowid,
      consent_code: consentCode,
      parent_email,
      platforms,
      status: 'pending',
      expires_at: expiresAt
    },
    message: `Consent request sent! Share this code with your parent: ${consentCode}. ` +
             `We've also sent an email to ${parent_email} (simulated in dev).`
  });
});

// Parent approves consent (by code)
router.post('/consent/approve', (req, res) => {
  const { consent_code } = req.body;
  
  if (!consent_code) {
    return res.status(400).json({ error: 'Consent code required' });
  }

  const consent = db.prepare(
    'SELECT * FROM parental_consents WHERE consent_code = ? AND status = ?'
  ).get(consent_code.toUpperCase(), 'pending');

  if (!consent) {
    return res.status(404).json({ error: 'Invalid or expired consent code' });
  }

  if (new Date(consent.expires_at) < new Date()) {
    db.prepare('UPDATE parental_consents SET status = ? WHERE id = ?').run('denied', consent.id);
    return res.status(410).json({ error: 'Consent request has expired' });
  }

  // Approve consent and create social connections
  const platforms = JSON.parse(consent.platforms);
  
  const approveAll = db.transaction(() => {
    db.prepare('UPDATE parental_consents SET status = ? WHERE id = ?').run('approved', consent.id);

    const insertConn = db.prepare(`
      INSERT OR IGNORE INTO social_connections (user_id, platform, status)
      VALUES (?, ?, 'approved')
    `);

    for (const platform of platforms) {
      insertConn.run(consent.student_id, platform);
    }
  });

  approveAll();

  const student = db.prepare('SELECT username FROM users WHERE id = ?').get(consent.student_id);

  res.json({
    success: true,
    message: `Consent approved! ${student.username} can now connect ${platforms.length} platform(s).`,
    platforms
  });
});

// Parent denies consent
router.post('/consent/deny', (req, res) => {
  const { consent_code } = req.body;
  
  if (!consent_code) {
    return res.status(400).json({ error: 'Consent code required' });
  }

  const consent = db.prepare(
    'SELECT * FROM parental_consents WHERE consent_code = ? AND status = ?'
  ).get(consent_code.toUpperCase(), 'pending');

  if (!consent) {
    return res.status(404).json({ error: 'Invalid consent code' });
  }

  db.prepare('UPDATE parental_consents SET status = ? WHERE id = ?').run('denied', consent.id);
  res.json({ success: true, message: 'Consent denied.' });
});

// Get student's consent status
router.get('/consent/status', authMiddleware, (req, res) => {
  const consents = db.prepare(`
    SELECT * FROM parental_consents 
    WHERE student_id = ? 
    ORDER BY created_at DESC
    LIMIT 10
  `).all(req.user.id);

  res.json({ consents });
});

// ====== SOCIAL CONNECTIONS ======

// Get available platforms
router.get('/platforms', authMiddleware, (req, res) => {
  const isAdult = req.user.role === 'verified_adult';
  
  const connections = db.prepare(
    'SELECT platform, status FROM social_connections WHERE user_id = ?'
  ).all(req.user.id);
  
  const connectedMap = {};
  connections.forEach(c => { connectedMap[c.platform] = c.status; });

  const platforms = AVAILABLE_PLATFORMS.map(p => ({
    ...p,
    connected: !!connectedMap[p.id] || isAdult,
    status: connectedMap[p.id] || (isAdult ? 'approved' : null),
    auto_approved: isAdult && !connectedMap[p.id]
  }));

  res.json({ platforms, is_adult: isAdult });
});

// Get user's connections
router.get('/connections', authMiddleware, (req, res) => {
  const connections = db.prepare(`
    SELECT * FROM social_connections WHERE user_id = ? AND status = 'approved'
  `).all(req.user.id);

  const platforms = AVAILABLE_PLATFORMS.reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {});

  const result = connections.map(c => ({
    ...c,
    platform_info: platforms[c.platform] || null
  }));

  res.json({ connections: result });
});

// Update connection (username, sharing settings)
router.put('/connections/:platform', authMiddleware, (req, res) => {
  const { platform_username, platform_url, share_posts, share_media } = req.body;
  const platform = req.params.platform;

  const validPlatforms = AVAILABLE_PLATFORMS.map(p => p.id);
  if (!validPlatforms.includes(platform)) {
    return res.status(400).json({ error: 'Invalid platform' });
  }

  const existing = db.prepare(
    'SELECT * FROM social_connections WHERE user_id = ? AND platform = ? AND status = ?'
  ).get(req.user.id, platform, 'approved');

  if (!existing) {
    return res.status(404).json({ error: 'Connection not found or not approved' });
  }

  db.prepare(`
    UPDATE social_connections 
    SET platform_username = ?, platform_url = ?, share_posts = ?, share_media = ?
    WHERE id = ?
  `).run(
    platform_username || existing.platform_username,
    platform_url || existing.platform_url,
    share_posts !== undefined ? (share_posts ? 1 : 0) : existing.share_posts,
    share_media !== undefined ? (share_media ? 1 : 0) : existing.share_media,
    existing.id
  );

  res.json({ success: true });
});

// Disconnect a platform
router.delete('/connections/:platform', authMiddleware, (req, res) => {
  const platform = req.params.platform;
  
  db.prepare(
    "UPDATE social_connections SET status = 'revoked' WHERE user_id = ? AND platform = ?"
  ).run(req.user.id, platform);

  res.json({ success: true });
});

// ====== CROSS-POSTING ======

// Cross-post to connected platforms
router.post('/cross-post/:postId', authMiddleware, (req, res) => {
  const { platforms } = req.body;
  const postId = req.params.postId;

  const post = db.prepare('SELECT * FROM posts WHERE id = ? AND user_id = ? AND is_removed = 0')
    .get(postId, req.user.id);
  
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
    return res.status(400).json({ error: 'At least one platform required' });
  }

  // Check which platforms are approved for sharing
  const connections = db.prepare(`
    SELECT platform FROM social_connections 
    WHERE user_id = ? AND status = 'approved' AND share_posts = 1 AND platform IN (${platforms.map(() => '?').join(',')})
  `).all(req.user.id, ...platforms);

  const shareablePlatforms = connections.map(c => c.platform);
  
  if (shareablePlatforms.length === 0) {
    return res.status(400).json({ 
      error: 'No approved platforms with sharing enabled. Connect and enable sharing first.' 
    });
  }

  // Create cross-post records
  const insertCrossPost = db.prepare(`
    INSERT INTO cross_posts (post_id, user_id, platform, status)
    VALUES (?, ?, ?, 'pending')
  `);

  const results = [];
  for (const platform of shareablePlatforms) {
    const result = insertCrossPost.run(postId, req.user.id, platform);
    results.push({
      platform,
      id: result.lastInsertRowid,
      status: 'pending',
      note: `Post queued for ${platform}. ` +
            `In production, this would trigger the ${platform} API. ` +
            `Add your ${platform} API keys in .env to enable actual cross-posting.`
    });
  }

  const skipped = platforms.filter(p => !shareablePlatforms.includes(p));

  res.json({
    shared: results,
    skipped: skipped.map(p => ({ platform: p, reason: 'Not connected or sharing disabled' })),
    message: results.length > 0 
      ? `Post shared to ${results.length} platform(s)! ${skipped.length > 0 ? `${skipped.length} skipped.` : ''}`
      : 'Could not share to any platform.'
  });
});

// Get cross-post history
router.get('/cross-posts', authMiddleware, (req, res) => {
  const posts = db.prepare(`
    SELECT cp.*, p.content, p.media_url
    FROM cross_posts cp
    JOIN posts p ON cp.post_id = p.id
    WHERE cp.user_id = ?
    ORDER BY cp.created_at DESC
    LIMIT 50
  `).all(req.user.id);

  res.json({ cross_posts: posts });
});

module.exports = router;
