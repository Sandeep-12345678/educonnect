const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Get chat history with a user
router.get('/dm/:userId', authMiddleware, (req, res) => {
  const otherId = parseInt(req.params.userId);
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const offset = (page - 1) * limit;

  const messages = db.prepare(`
    SELECT m.*, s.username as sender_name, s.avatar as sender_avatar
    FROM messages m JOIN users s ON m.sender_id = s.id
    WHERE (m.sender_id = ? AND m.receiver_id = ?)
       OR (m.sender_id = ? AND m.receiver_id = ?)
    ORDER BY m.created_at DESC
    LIMIT ? OFFSET ?
  `).all(req.user.id, otherId, otherId, req.user.id, limit, offset);

  // Mark as read
  db.prepare(`
    UPDATE messages SET is_read = 1 
    WHERE receiver_id = ? AND sender_id = ? AND is_read = 0
  `).run(req.user.id, otherId);

  res.json({ messages: messages.reverse() });
});

// Get room chat history
router.get('/room/:room', authMiddleware, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const offset = (page - 1) * limit;

  const messages = db.prepare(`
    SELECT m.*, u.username as sender_name, u.avatar as sender_avatar
    FROM messages m JOIN users u ON m.sender_id = u.id
    WHERE m.room = ?
    ORDER BY m.created_at DESC
    LIMIT ? OFFSET ?
  `).all(req.params.room, limit, offset);

  res.json({ messages: messages.reverse() });
});

// Get list of DM conversations
router.get('/conversations', authMiddleware, (req, res) => {
  const conversations = db.prepare(`
    SELECT 
      CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END as user_id,
      u.username, u.avatar,
      MAX(m.created_at) as last_message_time,
      (SELECT content FROM messages m2 
       WHERE (m2.sender_id = m.sender_id AND m2.receiver_id = m.receiver_id)
          OR (m2.sender_id = m.receiver_id AND m2.receiver_id = m.sender_id)
       ORDER BY m2.created_at DESC LIMIT 1) as last_message,
      (SELECT COUNT(*) FROM messages m3 
       WHERE m3.receiver_id = ? AND m3.sender_id = CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END) as unread
    FROM messages m
    JOIN users u ON u.id = CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END
    WHERE (m.sender_id = ? OR m.receiver_id = ?) AND m.room IS NULL
    GROUP BY user_id
    ORDER BY last_message_time DESC
  `).all(req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id);

  res.json({ conversations });
});

// Get all users for new chats
router.get('/users', authMiddleware, (req, res) => {
  const search = req.query.search || '';
  const users = db.prepare(`
    SELECT id, username, avatar, role FROM users 
    WHERE id != ? AND username LIKE ?
    LIMIT 30
  `).all(req.user.id, `%${search}%`);
  res.json({ users });
});

// Get available chat rooms
router.get('/rooms', authMiddleware, (req, res) => {
  const rooms = [
    { id: 'general', name: 'General', description: 'Everyone is welcome!' },
    { id: 'study-group', name: 'Study Group', description: 'Homework help & study tips' },
    { id: 'hobbies', name: 'Hobbies & Interests', description: 'Share what you love' },
    { id: 'announcements', name: 'Announcements', description: 'Official updates' }
  ];
  res.json({ rooms });
});

module.exports = router;
