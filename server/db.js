const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'educonnect.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    google_id TEXT UNIQUE DEFAULT NULL,
    role TEXT DEFAULT 'student' CHECK(role IN ('student','verified_adult','moderator','admin')),
    avatar TEXT DEFAULT NULL,
    screen_time_limit_min INTEGER DEFAULT 120,
    is_restricted INTEGER DEFAULT 0,
    age_verified INTEGER DEFAULT 0,
    age_verification_method TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    media_url TEXT DEFAULT NULL,
    media_type TEXT DEFAULT NULL CHECK(media_type IN ('image','video',NULL)),
    is_flagged INTEGER DEFAULT 0,
    is_removed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS post_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, user_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER DEFAULT NULL,
    room TEXT DEFAULT NULL,
    content TEXT NOT NULL,
    media_url TEXT DEFAULT NULL,
    media_type TEXT DEFAULT NULL,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS screen_time_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_start DATETIME NOT NULL,
    session_end DATETIME,
    duration_min INTEGER DEFAULT 0,
    date TEXT GENERATED ALWAYS AS (date(session_start)) STORED,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS friendships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    friend_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','accepted','blocked')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, friend_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS content_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter_id INTEGER NOT NULL,
    post_id INTEGER,
    message_id INTEGER,
    reason TEXT NOT NULL,
    resolved INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS content_filter_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS social_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    platform TEXT NOT NULL CHECK(platform IN ('instagram','twitter','tiktok','youtube','snapchat','facebook','discord','twitch')),
    platform_username TEXT,
    platform_url TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','denied','revoked')),
    share_posts INTEGER DEFAULT 0,
    share_media INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, platform)
  );

  CREATE TABLE IF NOT EXISTS parental_consents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    parent_email TEXT NOT NULL,
    consent_code TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','denied')),
    platforms TEXT DEFAULT '[]',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS cross_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    platform TEXT NOT NULL,
    external_url TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','shared','failed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);
  CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room);
  CREATE INDEX IF NOT EXISTS idx_messages_users ON messages(sender_id, receiver_id);
  CREATE INDEX IF NOT EXISTS idx_screen_time_user ON screen_time_logs(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
`);

// Pre-populate filter words if table is empty
const count = db.prepare('SELECT COUNT(*) as c FROM content_filter_words').get();
if (count.c === 0) {
  const insertWord = db.prepare('INSERT OR IGNORE INTO content_filter_words (word) VALUES (?)');
  const words = [
    'fuck','shit','ass','damn','bitch','crap','dick','bastard','slut','whore',
    'piss','cunt','fag','douche','retard','nigger','kike','chink','spic',
    'kill yourself','kys','suicide','self harm'
  ];
  const insertMany = db.transaction((words) => {
    for (const w of words) insertWord.run(w);
  });
  insertMany(words);
}

module.exports = db;
