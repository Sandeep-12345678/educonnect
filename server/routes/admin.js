const express = require('express');
const db = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Get all flagged posts
router.get('/flagged', authMiddleware, adminOnly, (req, res) => {
  const posts = db.prepare(`
    SELECT p.*, u.username, u.avatar,
           (SELECT COUNT(*) FROM content_reports WHERE post_id = p.id AND resolved = 0) as report_count
    FROM posts p JOIN users u ON p.user_id = u.id
    WHERE p.is_flagged = 1 AND p.is_removed = 0
    ORDER BY p.created_at DESC
  `).all();
  res.json({ posts });
});

// Get all reports
router.get('/reports', authMiddleware, adminOnly, (req, res) => {
  const reports = db.prepare(`
    SELECT cr.*, u1.username as reporter_name, u2.username as post_author,
           p.content as post_content, p.media_url
    FROM content_reports cr
    JOIN users u1 ON cr.reporter_id = u1.id
    LEFT JOIN posts p ON cr.post_id = p.id
    LEFT JOIN users u2 ON p.user_id = u2.id
    WHERE cr.resolved = 0
    ORDER BY cr.created_at DESC
  `).all();
  res.json({ reports });
});

// Remove a post (admin)
router.put('/posts/:id/remove', authMiddleware, adminOnly, (req, res) => {
  db.prepare('UPDATE posts SET is_removed = 1, is_flagged = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Approve a post (unflag)
router.put('/posts/:id/approve', authMiddleware, adminOnly, (req, res) => {
  db.prepare('UPDATE posts SET is_flagged = 0 WHERE id = ?').run(req.params.id);
  db.prepare('UPDATE content_reports SET resolved = 1 WHERE post_id = ?').run(req.params.id);
  res.json({ success: true });
});

// Resolve a report
router.put('/reports/:id/resolve', authMiddleware, adminOnly, (req, res) => {
  db.prepare('UPDATE content_reports SET resolved = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Set user screen time limit (admin)
router.put('/users/:id/screen-time', authMiddleware, adminOnly, (req, res) => {
  const { limit_min } = req.body;
  if (!limit_min || limit_min < 0) {
    return res.status(400).json({ error: 'Valid limit required' });
  }
  db.prepare('UPDATE users SET screen_time_limit_min = ? WHERE id = ?').run(limit_min, req.params.id);
  res.json({ success: true });
});

// Restrict/unrestrict a user
router.put('/users/:id/restrict', authMiddleware, adminOnly, (req, res) => {
  const { restricted } = req.body;
  db.prepare('UPDATE users SET is_restricted = ? WHERE id = ?').run(restricted ? 1 : 0, req.params.id);
  res.json({ success: true });
});

// Add filter word
router.post('/filter-words', authMiddleware, adminOnly, (req, res) => {
  const { word } = req.body;
  if (!word) return res.status(400).json({ error: 'Word required' });
  db.prepare('INSERT OR IGNORE INTO content_filter_words (word) VALUES (?)').run(word.toLowerCase());
  res.json({ success: true });
});

// Remove filter word
router.delete('/filter-words/:word', authMiddleware, adminOnly, (req, res) => {
  db.prepare('DELETE FROM content_filter_words WHERE word = ?').run(req.params.word.toLowerCase());
  res.json({ success: true });
});

// Get all users (admin)
router.get('/users', authMiddleware, adminOnly, (req, res) => {
  const users = db.prepare(`
    SELECT id, username, email, role, screen_time_limit_min, is_restricted, created_at FROM users
    ORDER BY created_at DESC
  `).all();
  res.json({ users });
});

// Dashboard stats
router.get('/stats', authMiddleware, adminOnly, (req, res) => {
  const stats = {
    totalUsers: db.prepare('SELECT COUNT(*) as c FROM users').get().c,
    totalPosts: db.prepare('SELECT COUNT(*) as c FROM posts WHERE is_removed = 0').get().c,
    totalReports: db.prepare('SELECT COUNT(*) as c FROM content_reports WHERE resolved = 0').get().c,
    flaggedPosts: db.prepare('SELECT COUNT(*) as c FROM posts WHERE is_flagged = 1 AND is_removed = 0').get().c,
    totalMessages: db.prepare('SELECT COUNT(*) as c FROM messages').get().c
  };
  res.json({ stats });
});

module.exports = router;
