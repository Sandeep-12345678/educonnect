const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authMiddleware, optionalAuth, adminOnly } = require('../middleware/auth');
const { contentFilter } = require('../middleware/contentFilter');

const router = express.Router();

// Multer setup
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const videoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
  const allowed = [...imageTypes, ...videoTypes];
  
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only images (JPEG, PNG, GIF, WebP) and videos (MP4, WebM) are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB max
});

// Create post
router.post('/', authMiddleware, upload.single('media'), contentFilter, (req, res) => {
  const { content } = req.body;
  
  if (!content || content.trim().length === 0) {
    return res.status(400).json({ error: 'Content is required' });
  }
  if (content.length > 2000) {
    return res.status(400).json({ error: 'Content too long (max 2000 chars)' });
  }

  let mediaUrl = null;
  let mediaType = null;
  
  if (req.file) {
    mediaUrl = `/uploads/${req.file.filename}`;
    mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
  }

  const result = db.prepare(
    'INSERT INTO posts (user_id, content, media_url, media_type, is_flagged) VALUES (?, ?, ?, ?, ?)'
  ).run(req.user.id, content, mediaUrl, mediaType, req.contentFlagged ? 1 : 0);

  const post = db.prepare(`
    SELECT p.*, u.username, u.avatar,
           (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as like_count,
           (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
    FROM posts p JOIN users u ON p.user_id = u.id
    WHERE p.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ post });
});

// Get feed (paginated, newest first)
router.get('/', optionalAuth, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const offset = (page - 1) * limit;

  const posts = db.prepare(`
    SELECT p.*, u.username, u.avatar,
           (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as like_count,
           (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
    FROM posts p JOIN users u ON p.user_id = u.id
    WHERE p.is_removed = 0
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);

  const total = db.prepare('SELECT COUNT(*) as c FROM posts WHERE is_removed = 0').get().c;

  res.json({ posts, page, totalPages: Math.ceil(total / limit), total });
});

// Get single post with comments
router.get('/:id', optionalAuth, (req, res) => {
  const post = db.prepare(`
    SELECT p.*, u.username, u.avatar,
           (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as like_count
    FROM posts p JOIN users u ON p.user_id = u.id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!post || post.is_removed) {
    return res.status(404).json({ error: 'Post not found' });
  }

  const comments = db.prepare(`
    SELECT c.*, u.username, u.avatar
    FROM comments c JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
    LIMIT 100
  `).all(req.params.id);

  res.json({ post, comments });
});

// Like/unlike post
router.post('/:id/like', authMiddleware, (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;

  const post = db.prepare('SELECT id FROM posts WHERE id = ? AND is_removed = 0').get(postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const existing = db.prepare('SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?').get(postId, userId);
  
  if (existing) {
    db.prepare('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?').run(postId, userId);
    res.json({ liked: false });
  } else {
    db.prepare('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)').run(postId, userId);
    res.json({ liked: true });
  }
});

// Add comment
router.post('/:id/comments', authMiddleware, contentFilter, (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Comment cannot be empty' });
  }

  const post = db.prepare('SELECT id FROM posts WHERE id = ? AND is_removed = 0').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const result = db.prepare(
    'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)'
  ).run(req.params.id, req.user.id, content);

  const comment = db.prepare(`
    SELECT c.*, u.username, u.avatar
    FROM comments c JOIN users u ON c.user_id = u.id
    WHERE c.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ comment });
});

// Delete own post
router.delete('/:id', authMiddleware, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized' });
  }
  db.prepare('UPDATE posts SET is_removed = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Report a post
router.post('/:id/report', authMiddleware, (req, res) => {
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ error: 'Reason required' });

  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  db.prepare('INSERT INTO content_reports (reporter_id, post_id, reason) VALUES (?, ?, ?)')
    .run(req.user.id, req.params.id, reason);

  // Auto-flag if reported multiple times
  const reportCount = db.prepare('SELECT COUNT(*) as c FROM content_reports WHERE post_id = ? AND resolved = 0').get(req.params.id).c;
  if (reportCount >= 3) {
    db.prepare('UPDATE posts SET is_flagged = 1 WHERE id = ?').run(req.params.id);
  }

  res.json({ success: true });
});

module.exports = router;
