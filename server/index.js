const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const db = require('./db');
const { authMiddleware } = require('./middleware/auth');
const { contentFilter } = require('./middleware/contentFilter');
const { startSession, endSession, checkLimit } = require('./middleware/screenTime');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 1e7 // 10MB for socket file transfer
});

const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  message: { error: 'Too many requests, slow down!' }
});
app.use('/api', apiLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many attempts, try later' }
});

// Routes
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/oauth', require('./routes/oauth'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/screen-time', require('./routes/screenTime'));
app.use('/api/social', require('./routes/social'));
app.use('/api/verify', require('./routes/verify'));

// Serve client in production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), err => { if (err) next(); });
});

// ==================== SOCKET.IO ====================

const onlineUsers = new Map(); // socketId -> { userId, username }
const userSockets = new Map(); // userId -> Set of socketIds

io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  // Authenticate & join
  socket.on('authenticate', ({ token, userId, username }) => {
    socket.userId = userId;
    socket.username = username;
    onlineUsers.set(socket.id, { userId, username });

    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId).add(socket.id);

    startSession(userId, socket.id);

    // Join all chat rooms
    socket.join('room:general');
    socket.join('room:study-group');
    socket.join('room:hobbies');
    socket.join('room:announcements');
    socket.join(`user:${userId}`); // Private room for DMs

    // Broadcast online status
    io.emit('user:online', { userId, username, online: true });
    io.emit('online:count', onlineUsers.size);

    // Send initial screen time status
    const status = checkLimit(userId);
    socket.emit('screenTime:status', status);
  });

  // ====== Chat Messages ======

  // Room message
  socket.on('message:room', ({ room, content }, callback) => {
    if (!socket.userId) return callback?.({ error: 'Not authenticated' });
    if (isRestricted(socket.userId)) return callback?.({ error: 'Account restricted' });

    const isAdult = isAdultUser(socket.userId);
    const filtered = isAdult ? { filtered: content, flagged: false } : contentFilterContent(content);
    
    const result = db.prepare(
      'INSERT INTO messages (sender_id, room, content) VALUES (?, ?, ?)'
    ).run(socket.userId, room, filtered.filtered);

    const message = {
      id: result.lastInsertRowid,
      sender_id: socket.userId,
      sender_name: socket.username,
      room,
      content: filtered.filtered,
      created_at: new Date().toISOString()
    };

    io.to(`room:${room}`).emit('message:new', message);
    callback?.({ success: true, message });
  });

  // Direct message
  socket.on('message:dm', ({ toUserId, content }, callback) => {
    if (!socket.userId) return callback?.({ error: 'Not authenticated' });
    if (isRestricted(socket.userId)) return callback?.({ error: 'Account restricted' });

    const isAdult = isAdultUser(socket.userId);
    const filtered = isAdult ? { filtered: content, flagged: false } : contentFilterContent(content);

    const result = db.prepare(
      'INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)'
    ).run(socket.userId, toUserId, filtered.filtered);

    const message = {
      id: result.lastInsertRowid,
      sender_id: socket.userId,
      sender_name: socket.username,
      receiver_id: toUserId,
      content: filtered.filtered,
      created_at: new Date().toISOString()
    };

    // Send to both sender and receiver
    io.to(`user:${socket.userId}`).emit('message:new', message);
    io.to(`user:${toUserId}`).emit('message:new', message);
    callback?.({ success: true, message });
  });

  // ====== Typing Indicators ======

  socket.on('typing:room', ({ room }) => {
    socket.to(`room:${room}`).emit('typing:update', { 
      userId: socket.userId, username: socket.username, room 
    });
  });

  socket.on('typing:dm', ({ toUserId }) => {
    socket.to(`user:${toUserId}`).emit('typing:update', {
      userId: socket.userId, username: socket.username, dm: true
    });
  });

  // ====== Screen Time ======

  socket.on('screenTime:check', () => {
    if (!socket.userId) return;
    const status = checkLimit(socket.userId);
    socket.emit('screenTime:status', status);
    
    if (status.exceeded) {
      socket.emit('notification', {
        type: 'screen_time',
        message: `You've reached your daily limit of ${status.limit} minutes. Take a break! 🌿`
      });
    } else if (status.remaining <= 15 && status.remaining > 0) {
      socket.emit('notification', {
        type: 'screen_time_warning',
        message: `Only ${status.remaining} minutes left today. Wrap up soon! ⏰`
      });
    }
  });

  // Periodic screen time check (every 2 minutes)
  const timeCheckInterval = setInterval(() => {
    if (!socket.userId) return;
    const status = checkLimit(socket.userId);
    socket.emit('screenTime:status', status);
    
    if (status.exceeded) {
      socket.emit('notification', {
        type: 'screen_time',
        message: `Screen time limit reached (${status.limit} min). Time for a break! 🌿`
      });
    }
  }, 120000);

  // ====== Disconnect ======

  socket.on('disconnect', () => {
    clearInterval(timeCheckInterval);
    
    if (socket.userId) {
      const endResult = endSession(socket.userId);
      
      const sockets = userSockets.get(socket.userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(socket.userId);
          io.emit('user:online', { userId: socket.userId, username: socket.username, online: false });
        }
      }
    }
    
    onlineUsers.delete(socket.id);
    io.emit('online:count', onlineUsers.size);
    console.log(`[Socket] Disconnected: ${socket.id}`);
  });

  socket.on('error', (err) => {
    console.error(`[Socket] Error ${socket.id}:`, err.message);
  });
});

// ====== Helpers ======

function isRestricted(userId) {
  const user = db.prepare('SELECT is_restricted FROM users WHERE id = ?').get(userId);
  return user?.is_restricted === 1;
}

function isAdultUser(userId) {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
  return user?.role === 'verified_adult';
}

const { filterText } = require('./middleware/contentFilter');
function contentFilterContent(text) {
  return filterText(text);
}

// ====== Graceful Shutdown ======

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  for (const [userId] of onlineUsers) {
    if (userId) endSession(userId);
  }
  server.close(() => process.exit(0));
});

server.listen(PORT, () => {
  console.log(`🦞 EduConnect server running on http://localhost:${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api`);
  console.log(`   Socket.IO ready for real-time chat`);
});
