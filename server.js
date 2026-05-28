import compression from 'compression';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import express from 'express';
import session from 'express-session';
import Database from 'better-sqlite3';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 3000);
const dataDir = path.join(__dirname, 'data');
const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'app.db');
const sessionSecret = process.env.SESSION_SECRET || 'change-me-in-production';

fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookstore_books (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  price REAL,
  condition TEXT,
  course TEXT,
  isbn TEXT,
  seller TEXT
);

CREATE TABLE IF NOT EXISTS bookstore_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL UNIQUE,
  payload TEXT NOT NULL,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookstore_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payload TEXT NOT NULL,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookstore_listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payload TEXT NOT NULL,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payload TEXT NOT NULL,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS marketplace_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payload TEXT NOT NULL,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS marketplace_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL UNIQUE,
  payload TEXT NOT NULL,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS marketplace_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payload TEXT NOT NULL,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS forum_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payload TEXT NOT NULL,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS forum_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payload TEXT NOT NULL,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS forum_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payload TEXT NOT NULL,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  expires INTEGER NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires);
`);

function loadJsonSeed(fileName, fallback) {
  const filePath = path.join(dataDir, fileName);
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function json(value) {
  return JSON.stringify(value);
}

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function firstRow(sql, params = []) {
  return db.prepare(sql).get(...params);
}

function allRows(sql, params = []) {
  return db.prepare(sql).all(...params);
}

function run(sql, params = []) {
  return db.prepare(sql).run(...params);
}

function ensureSeeded() {
  const userCount = firstRow('SELECT COUNT(*) AS count FROM users')?.count || 0;
  if (userCount === 0) {
    const demoPassword = bcrypt.hashSync('password123', 10);
    const insertUser = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');
    insertUser.run('Campus Admin', 'admin@universithi.local', demoPassword, 'admin');
    insertUser.run('Student User', 'student@universithi.local', demoPassword, 'user');
  }

  const bookstoreCount = firstRow('SELECT COUNT(*) AS count FROM bookstore_books')?.count || 0;
  if (bookstoreCount === 0) {
    const seed = loadJsonSeed('bookstore.json', { books: [], reviews: [], orders: [], listings: [] });
    const insertBook = db.prepare('INSERT INTO bookstore_books (id, title, author, price, condition, course, isbn, seller) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    for (const book of seed.books || []) {
      insertBook.run(book.id, book.title ?? '', book.author ?? '', book.price ?? null, book.condition ?? '', book.course ?? '', book.isbn ?? '', book.seller ?? '');
    }
    const insertOrder = db.prepare('INSERT INTO bookstore_orders (order_id, payload, created_by, created_at) VALUES (?, ?, ?, ?)');
    for (const order of seed.orders || []) {
      insertOrder.run(order.orderId || `ORD-${order.id}`, json(order), null, order.createdAt || new Date().toISOString());
    }
    const insertReview = db.prepare('INSERT INTO bookstore_reviews (payload, created_by, created_at) VALUES (?, ?, ?)');
    for (const review of seed.reviews || []) {
      insertReview.run(json(review), null, review.createdAt || new Date().toISOString());
    }
    const insertListing = db.prepare('INSERT INTO bookstore_listings (payload, created_by, created_at) VALUES (?, ?, ?)');
    for (const listing of seed.listings || []) {
      insertListing.run(json(listing), null, listing.createdAt || new Date().toISOString());
    }
  }

  const marketplaceCount = firstRow('SELECT COUNT(*) AS count FROM marketplace_listings')?.count || 0;
  if (marketplaceCount === 0) {
    const seed = loadJsonSeed('marketplace.json', { listings: [], messages: [], orders: [], reviews: [], users: [] });
    const insertListing = db.prepare('INSERT INTO marketplace_listings (payload, created_by, created_at) VALUES (?, ?, ?)');
    for (const listing of seed.listings || []) insertListing.run(json(listing), null, listing.createdAt || new Date().toISOString());
    const insertMessage = db.prepare('INSERT INTO marketplace_messages (payload, created_by, created_at) VALUES (?, ?, ?)');
    for (const message of seed.messages || []) insertMessage.run(json(message), null, message.createdAt || new Date().toISOString());
    const insertOrder = db.prepare('INSERT INTO marketplace_orders (order_id, payload, created_by, created_at) VALUES (?, ?, ?, ?)');
    for (const order of seed.orders || []) insertOrder.run(order.orderId || `ORD-${order.id}`, json(order), null, order.createdAt || new Date().toISOString());
    const insertReview = db.prepare('INSERT INTO marketplace_reviews (payload, created_by, created_at) VALUES (?, ?, ?)');
    for (const review of seed.reviews || []) insertReview.run(json(review), null, review.createdAt || new Date().toISOString());
  }

  const forumCount = firstRow('SELECT COUNT(*) AS count FROM forum_posts')?.count || 0;
  if (forumCount === 0) {
    const seed = loadJsonSeed('forum.json', { posts: [], comments: [], groups: [], messages: [] });
    const insertPost = db.prepare('INSERT INTO forum_posts (payload, created_by, created_at) VALUES (?, ?, ?)');
    for (const post of seed.posts || []) insertPost.run(json(post), null, post.createdAt || new Date().toISOString());
    const insertComment = db.prepare('INSERT INTO forum_comments (payload, created_by, created_at) VALUES (?, ?, ?)');
    for (const comment of seed.comments || []) insertComment.run(json(comment), null, comment.createdAt || new Date().toISOString());
    const insertGroup = db.prepare('INSERT INTO forum_groups (payload, created_by, created_at) VALUES (?, ?, ?)');
    for (const group of seed.groups || []) insertGroup.run(json(group), null, group.createdAt || new Date().toISOString());
  }
}

ensureSeeded();

class SqliteSessionStore extends session.Store {
  get(sid, callback) {
    try {
      const row = firstRow('SELECT data, expires FROM sessions WHERE sid = ?', [sid]);
      if (!row) return callback(null, null);
      if (row.expires <= Date.now()) {
        run('DELETE FROM sessions WHERE sid = ?', [sid]);
        return callback(null, null);
      }
      callback(null, JSON.parse(row.data));
    } catch (error) {
      callback(error);
    }
  }

  set(sid, sessionData, callback) {
    try {
      const expires = sessionData?.cookie?.expires ? new Date(sessionData.cookie.expires).getTime() : Date.now() + 24 * 60 * 60 * 1000;
      run(
        'INSERT INTO sessions (sid, expires, data) VALUES (?, ?, ?) ON CONFLICT(sid) DO UPDATE SET expires = excluded.expires, data = excluded.data',
        [sid, expires, JSON.stringify(sessionData)]
      );
      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }

  destroy(sid, callback) {
    try {
      run('DELETE FROM sessions WHERE sid = ?', [sid]);
      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }

  touch(sid, sessionData, callback) {
    this.set(sid, sessionData, callback);
  }
}

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(session({
  store: new SqliteSessionStore(),
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));
app.use(express.static(__dirname));

function normalizeUser(row) {
  return row ? { id: row.id, name: row.name, email: row.email, role: row.role, createdAt: row.created_at } : null;
}

function currentUser(req) {
  return req.session.user || null;
}

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Authentication required' });
  next();
}

function ordered(sql, params = []) {
  return allRows(sql, params).map(row => {
    const payload = parseJson(row.payload, {});
    return {
      ...payload,
      id: payload.id ?? row.id,
      createdAt: payload.createdAt || row.created_at
    };
  });
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, database: path.basename(dbPath), authenticated: false });
});

app.get('/api/auth/me', (req, res) => {
  res.json({ user: currentUser(req) });
});

app.post('/api/auth/register', (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!name || !email || password.length < 8) {
    return res.status(400).json({ error: 'Name, email, and password of at least 8 characters are required' });
  }
  const existing = firstRow('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) return res.status(409).json({ error: 'Email already registered' });
  const passwordHash = bcrypt.hashSync(password, 12);
  const result = run('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [name, email, passwordHash]);
  req.session.user = normalizeUser(firstRow('SELECT * FROM users WHERE id = ?', [result.lastInsertRowid]));
  res.status(201).json({ user: req.session.user });
});

app.post('/api/auth/login', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const user = firstRow('SELECT * FROM users WHERE email = ?', [email]);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  req.session.user = normalizeUser(user);
  res.json({ user: req.session.user });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/bookstore/books', (_req, res) => {
  res.json(allRows('SELECT * FROM bookstore_books ORDER BY id DESC'));
});
app.get('/api/bookstore/books/:id', (req, res) => {
  const book = firstRow('SELECT * FROM bookstore_books WHERE id = ?', [req.params.id]);
  if (!book) return res.status(404).json({ error: 'Book not found' });
  res.json(book);
});
app.get('/api/bookstore/orders', (_req, res) => {
  res.json(ordered('SELECT * FROM bookstore_orders ORDER BY id DESC'));
});
app.post('/api/bookstore/orders', (req, res) => {
  const order = { ...req.body, createdAt: new Date().toISOString() };
  const orderId = order.orderId || `ORD-${Date.now()}`;
  run(
    'INSERT INTO bookstore_orders (order_id, payload, created_by, created_at) VALUES (?, ?, ?, ?)',
    [orderId, json(order), req.session.user?.id || null, order.createdAt]
  );
  res.status(201).json({ ...order, orderId });
});
app.get('/api/bookstore/reviews', (_req, res) => {
  res.json(ordered('SELECT * FROM bookstore_reviews ORDER BY id DESC'));
});
app.post('/api/bookstore/reviews', (req, res) => {
  const review = { ...req.body, createdAt: new Date().toISOString() };
  run(
    'INSERT INTO bookstore_reviews (payload, created_by, created_at) VALUES (?, ?, ?)',
    [json(review), req.session.user?.id || null, review.createdAt]
  );
  res.status(201).json(review);
});
app.post('/api/bookstore/listings', (req, res) => {
  const listing = { ...req.body, createdAt: new Date().toISOString() };
  run(
    'INSERT INTO bookstore_listings (payload, created_by, created_at) VALUES (?, ?, ?)',
    [json(listing), req.session.user?.id || null, listing.createdAt]
  );
  res.status(201).json(listing);
});

app.get('/api/marketplace/listings', (_req, res) => {
  res.json(ordered('SELECT * FROM marketplace_listings ORDER BY id DESC'));
});
app.post('/api/marketplace/listings', (req, res) => {
  const listing = { ...req.body, createdAt: new Date().toISOString() };
  run('INSERT INTO marketplace_listings (payload, created_by, created_at) VALUES (?, ?, ?)', [json(listing), req.session.user?.id || null, listing.createdAt]);
  res.status(201).json(listing);
});
app.get('/api/marketplace/messages', (_req, res) => {
  res.json(ordered('SELECT * FROM marketplace_messages ORDER BY id DESC'));
});
app.post('/api/marketplace/messages', (req, res) => {
  const message = { ...req.body, createdAt: new Date().toISOString() };
  run('INSERT INTO marketplace_messages (payload, created_by, created_at) VALUES (?, ?, ?)', [json(message), req.session.user?.id || null, message.createdAt]);
  res.status(201).json(message);
});
app.get('/api/marketplace/orders', (_req, res) => {
  res.json(ordered('SELECT * FROM marketplace_orders ORDER BY id DESC'));
});
app.post('/api/marketplace/orders', (req, res) => {
  const order = { ...req.body, createdAt: new Date().toISOString() };
  const orderId = order.orderId || `MKT-${Date.now()}`;
  run('INSERT INTO marketplace_orders (order_id, payload, created_by, created_at) VALUES (?, ?, ?, ?)', [orderId, json(order), req.session.user?.id || null, order.createdAt]);
  res.status(201).json({ ...order, orderId });
});
app.post('/api/marketplace/reviews', (req, res) => {
  const review = { ...req.body, createdAt: new Date().toISOString() };
  run('INSERT INTO marketplace_reviews (payload, created_by, created_at) VALUES (?, ?, ?)', [json(review), req.session.user?.id || null, review.createdAt]);
  res.status(201).json(review);
});

app.get('/api/forum/posts', (_req, res) => {
  res.json(ordered('SELECT * FROM forum_posts ORDER BY id DESC'));
});
app.post('/api/forum/posts', (req, res) => {
  const post = { ...req.body, createdAt: new Date().toISOString() };
  run('INSERT INTO forum_posts (payload, created_by, created_at) VALUES (?, ?, ?)', [json(post), req.session.user?.id || null, post.createdAt]);
  res.status(201).json(post);
});
app.post('/api/forum/comments', (req, res) => {
  const comment = { ...req.body, createdAt: new Date().toISOString() };
  run('INSERT INTO forum_comments (payload, created_by, created_at) VALUES (?, ?, ?)', [json(comment), req.session.user?.id || null, comment.createdAt]);
  res.status(201).json(comment);
});
app.get('/api/forum/groups', (_req, res) => {
  res.json(ordered('SELECT * FROM forum_groups ORDER BY id DESC'));
});
app.post('/api/forum/groups', (req, res) => {
  const group = { ...req.body, createdAt: new Date().toISOString() };
  run('INSERT INTO forum_groups (payload, created_by, created_at) VALUES (?, ?, ?)', [json(group), req.session.user?.id || null, group.createdAt]);
  res.status(201).json(group);
});

app.get('/', (_req, res) => {
  res.redirect('/student-marketplace/student-marketplace-buy-sell-trade-on-campus.html');
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

function shutdown(signal) {
  console.log(`Received ${signal}, closing database.`);
  db.close();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
