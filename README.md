# 🦞 EduConnect — Student-Friendly Social Platform

A safe, moderated social media platform designed for students with built-in screen time tracking and content restrictions.

## Features

| Feature | Description |
|---|---|
| 📝 **Social Feed** | Create posts with text, images, and video. Like, comment, and share. |
| 💬 **Real-time Chat** | Group chat rooms + private DMs with typing indicators. |
| 📷 **Photo Sharing** | Upload images (JPEG, PNG, GIF, WebP). |
| 🎬 **Video Sharing** | Upload videos (MP4, WebM, MOV). Max 100MB. |
| ⏱️ **Screen Time Tracking** | Automatic session logging, daily limits, weekly reports, break reminders. |
| 🛡️ **Content Moderation** | Profanity filter, flagged posts, reporting system, admin panel. |
| 👥 **Role-based Access** | Students, Moderators, and Admins with different permissions. |
| 📊 **Admin Dashboard** | Stats, user management, filter word management, report resolution. |

## Tech Stack

- **Frontend:** React 18, React Router, Socket.IO Client, Vite
- **Backend:** Node.js, Express, Socket.IO
- **Database:** SQLite (better-sqlite3 — zero config)
- **Auth:** JWT (bcryptjs for password hashing)
- **Uploads:** Multer

## 🚀 Deploy to Render (Free — One Click)

**Only Render is needed.** The Express server serves both the API and the React frontend.

### Option 1: Auto-detect (render.yaml)

1. Push the project to a GitHub repo
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your repo — it auto-detects `render.yaml`
4. Deploy! 🎉

### Option 2: Manual setup

1. On [Render](https://render.com): New → Web Service → connect repo
2. Settings:
   - **Runtime:** Node
   - **Build Command:** `cd client && npm install && npm run build && cd ../server && npm install`
   - **Start Command:** `cd server && node index.js`
   - **Port:** `10000`
3. Add env var: `JWT_SECRET` (auto-generated)
4. Deploy!

Render's free tier gives you:
- ✅ HTTPS auto-provisioned
- ✅ Auto-deploy on git push
- ✅ 750 hours/month free
- ✅ Persistent disk for SQLite (within reason)

> ⚠️ Free tier spins down after 15 min of inactivity (cold start on next request).
> For always-on, upgrade to Render's $7/mo plan or use a cron pinger.

### Production hardening (before going live)

1. Change `JWT_SECRET` to a strong random value
2. Set up a proper database (PostgreSQL on Render is free for 90 days)
3. Add rate limiting via Render's proxy or Cloudflare
4. Configure CORS to your actual domain

```bash
# Terminal 1: Start the server
cd server
npm install
npm start          # Runs on http://localhost:3001

# Terminal 2: Start the client
cd client
npm install
npm run dev        # Runs on http://localhost:5173
```

Or run in production mode:

```bash
cd client && npm run build
cd ../server && npm start
# Visit http://localhost:3001
```

## Default Limits

- **Screen time:** 120 minutes/day per student (configurable by admin)
- **Post length:** 2000 characters max
- **File upload:** 100MB max
- **Content filter:** Profanity auto-censored
- **Auto-flagging:** 3+ reports flags a post automatically

## Project Structure

```
educonnect/
├── server/
│   ├── index.js              # Express + Socket.IO server
│   ├── db.js                 # SQLite schema & init
│   ├── middleware/
│   │   ├── auth.js           # JWT authentication
│   │   ├── contentFilter.js  # Profanity filter
│   │   └── screenTime.js     # Screen time tracking
│   ├── routes/
│   │   ├── auth.js           # Register/login/me
│   │   ├── posts.js          # CRUD, likes, comments, reports
│   │   ├── chat.js           # Chat history API
│   │   ├── admin.js          # Moderation endpoints
│   │   └── screenTime.js     # Usage status API
│   └── uploads/              # User-uploaded media
├── client/
│   └── src/
│       ├── App.jsx           # Router setup
│       ├── context/
│       │   ├── AuthContext.jsx
│       │   └── SocketContext.jsx
│       └── components/
│           ├── Feed.jsx      # Social feed + post creation
│           ├── Chat.jsx      # Real-time chat
│           ├── ScreenTime.jsx
│           ├── AdminPanel.jsx
│           ├── Login.jsx
│           ├── Register.jsx
│           └── Navbar.jsx
└── README.md
```

## API Endpoints

### Auth
- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Log in
- `GET /api/auth/me` — Current user

### Posts
- `GET /api/posts` — Feed (paginated)
- `POST /api/posts` — Create post (multipart)
- `GET /api/posts/:id` — Post with comments
- `POST /api/posts/:id/like` — Toggle like
- `POST /api/posts/:id/comments` — Add comment
- `POST /api/posts/:id/report` — Report post
- `DELETE /api/posts/:id` — Remove own post

### Chat
- `GET /api/chat/dm/:userId` — DM history
- `GET /api/chat/room/:room` — Room history
- `GET /api/chat/conversations` — DM list
- `GET /api/chat/users` — User directory
- `GET /api/chat/rooms` — Room list

### Screen Time
- `GET /api/screen-time/status` — Today's usage
- `GET /api/screen-time/weekly` — 7-day report

### Admin (moderator+)
- `GET /api/admin/stats` — Dashboard
- `GET /api/admin/flagged` — Flagged posts
- `GET /api/admin/reports` — Open reports
- `GET /api/admin/users` — All users
- `PUT /api/admin/posts/:id/remove` — Remove post
- `PUT /api/admin/posts/:id/approve` — Approve post
- `PUT /api/admin/users/:id/screen-time` — Set limit
- `PUT /api/admin/users/:id/restrict` — Restrict user
- `POST /api/admin/filter-words` — Add filter word

## Socket.IO Events

| Event | Direction | Description |
|---|---|---|
| `authenticate` | Client → Server | Join with JWT |
| `message:room` | Client → Server | Send room message |
| `message:dm` | Client → Server | Send direct message |
| `typing:room` / `typing:dm` | Client → Server | Typing indicator |
| `message:new` | Server → Client | New message received |
| `user:online` | Server → Client | User online/offline |
| `screenTime:status` | Server → Client | Usage update |
| `screenTime:check` | Client → Server | Request status |
| `notification` | Server → Client | System notification |

## Security Features

- **Rate limiting:** 200 req/15min on API, 20 req/15min on auth
- **JWT tokens:** 24h expiry
- **Password hashing:** bcryptjs (10 rounds)
- **File type validation:** Whitelist-based image/video only
- **Content filtering:** Regex-based profanity filter with word boundary matching
- **User restriction:** Admins can freeze accounts
- **Auto-flagging:** Posts get flagged after 3+ reports
