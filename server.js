import compression from 'compression';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import express from 'express';
import session from 'express-session';
import fs from 'fs';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 3000);
const dataDir = path.join(__dirname, 'data');
const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'app.json');
const sessionSecret = process.env.SESSION_SECRET || 'change-me-in-production';

fs.mkdirSync(dataDir, { recursive: true });

const seed = {
  users: [],
  bookstore: {
    books: [{ id: 1, title: 'Introduction to Microeconomics', author: 'N. Gregory Mankiw', price: 280, condition: 'Good', course: 'ECON101', isbn: '978-0-13-123456-7', seller: 'A. Naidoo' }],
    orders: [{ id: 1, orderId: 'ORD-TEST-1', book: { title: 'Test Book', seller: 'Tester' }, buyer: { name: 'Buyer' }, paymentMethod: 'card', amount: 100, platformFee: 10, sellerPayout: 90, status: 'payment_pending', escrowStatus: 'payment_held', orderDate: '2026-05-28T00:00:00Z', trackingId: 'TRK-TEST', createdAt: new Date().toISOString() }],
    reviews: [{ id: 1, orderId: 'ORD-TEST-1', rating: 5, reviewText: 'Great', sellerName: 'Tester', createdAt: new Date().toISOString() }],
    listings: []
  },
  marketplace: {
    listings: [{ id: 1, title: 'Calculus: Early Transcendentals', price: 320, courseCode: 'MATH 101', condition: 'Very Good', location: 'Campus Union', seller: 'Jessica Davis' }],
    messages: [{ id: 1, sellerName: 'Tester', sellerInitials: 'TE', itemTitle: 'Test Item', itemPrice: 10, orderId: 'ORD-TEST-2', text: 'Hello', amount: 10, createdAt: new Date().toISOString() }],
    orders: [],
    reviews: []
  },
  forum: {
    posts: [{ id: 1, title: 'How do I survive Quantitative Methods?', category: 'Academic Help', author: 'Student', likes: 18, comments: 4 }],
    comments: [],
    groups: [],
    messages: []
  },
  sessions: {}
};

function loadState() {
  if (!fs.existsSync(dbPath)) return structuredClone(seed);
  try {
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  } catch {
    return structuredClone(seed);
  }
}

let state = loadState();

function saveState() {
  fs.writeFileSync(dbPath, JSON.stringify(state, null, 2));
}

function ensureState() {
  state.users ||= [];
  state.bookstore ||= structuredClone(seed.bookstore);
  state.marketplace ||= structuredClone(seed.marketplace);
  state.forum ||= structuredClone(seed.forum);
  state.sessions ||= {};

  if (!state.users.length) {
    const demoPassword = bcrypt.hashSync('password123', 10);
    state.users.push(
      { id: 1, name: 'Campus Admin', email: 'admin@universithi.local', passwordHash: demoPassword, role: 'admin', createdAt: new Date().toISOString() },
      { id: 2, name: 'Student User', email: 'student@universithi.local', passwordHash: demoPassword, role: 'user', createdAt: new Date().toISOString() }
    );
  }
  saveState();
}

ensureState();

function nextId(items) {
  return items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getCookieValue(req, name) {
  const cookieHeader = req.headers.cookie || '';
  return cookieHeader.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1) || null;
}

function signSession(userId) {
  const token = `${userId}.${bcrypt.hashSync(`${userId}:${sessionSecret}`, 4).slice(0, 10)}`;
  state.sessions[token] = { userId, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 };
  saveState();
  return token;
}

function getSessionUser(req) {
  const token = getCookieValue(req, 'universithi_session');
  if (!token) return null;
  const entry = state.sessions[token];
  if (!entry || entry.expiresAt < Date.now()) return null;
  return state.users.find(user => String(user.id) === String(entry.userId)) || null;
}

function setSessionCookie(userId) {
  return `universithi_session=${signSession(userId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`;
}

function clearSessionCookie(req) {
  const token = getCookieValue(req, 'universithi_session');
  if (token) {
    delete state.sessions[token];
    saveState();
  }
  return 'universithi_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
}

function normalizeUser(user) {
  return user ? { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt } : null;
}

function responseCollection(collection) {
  return clone(collection).reverse();
}

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(session({
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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, storage: 'json-file', file: path.basename(dbPath) });
});

app.get('/api/auth/me', (req, res) => {
  res.json({ user: normalizeUser(getSessionUser(req)) });
});

app.post('/api/auth/register', (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!name || !email || password.length < 8) return res.status(400).json({ error: 'Invalid signup data' });
  if (state.users.some(user => user.email === email)) return res.status(409).json({ error: 'Email already registered' });
  const user = {
    id: nextId(state.users),
    name,
    email,
    passwordHash: bcrypt.hashSync(password, 12),
    role: 'user',
    createdAt: new Date().toISOString()
  };
  state.users.unshift(user);
  saveState();
  res.setHeader('Set-Cookie', setSessionCookie(user.id));
  res.status(201).json({ user: normalizeUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const user = state.users.find(entry => entry.email === email);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) return res.status(401).json({ error: 'Invalid email or password' });
  res.setHeader('Set-Cookie', setSessionCookie(user.id));
  res.json({ user: normalizeUser(user) });
});

app.post('/api/auth/logout', (req, res) => {
  res.setHeader('Set-Cookie', clearSessionCookie(req));
  res.json({ ok: true });
});

app.get('/api/bookstore/books', (_req, res) => res.json(responseCollection(state.bookstore.books)));
app.get('/api/bookstore/books/:id', (req, res) => {
  const book = state.bookstore.books.find(item => String(item.id) === String(req.params.id));
  if (!book) return res.status(404).json({ error: 'Book not found' });
  res.json(book);
});
app.get('/api/bookstore/orders', (_req, res) => res.json(responseCollection(state.bookstore.orders)));
app.post('/api/bookstore/orders', (req, res) => {
  const order = { id: nextId(state.bookstore.orders), ...req.body, createdAt: new Date().toISOString() };
  state.bookstore.orders.unshift(order);
  saveState();
  res.status(201).json(order);
});
app.get('/api/bookstore/reviews', (_req, res) => res.json(responseCollection(state.bookstore.reviews)));
app.post('/api/bookstore/reviews', (req, res) => {
  const review = { id: nextId(state.bookstore.reviews), ...req.body, createdAt: new Date().toISOString() };
  state.bookstore.reviews.unshift(review);
  saveState();
  res.status(201).json(review);
});
app.post('/api/bookstore/listings', (req, res) => {
  const listing = { id: nextId(state.bookstore.listings), ...req.body, createdAt: new Date().toISOString() };
  state.bookstore.listings.unshift(listing);
  saveState();
  res.status(201).json(listing);
});

app.get('/api/marketplace/listings', (_req, res) => res.json(responseCollection(state.marketplace.listings)));
app.post('/api/marketplace/listings', (req, res) => {
  const listing = { id: nextId(state.marketplace.listings), ...req.body, createdAt: new Date().toISOString() };
  state.marketplace.listings.unshift(listing);
  saveState();
  res.status(201).json(listing);
});
app.get('/api/marketplace/messages', (_req, res) => res.json(responseCollection(state.marketplace.messages)));
app.post('/api/marketplace/messages', (req, res) => {
  const message = { id: nextId(state.marketplace.messages), ...req.body, createdAt: new Date().toISOString() };
  state.marketplace.messages.unshift(message);
  saveState();
  res.status(201).json(message);
});
app.get('/api/marketplace/orders', (_req, res) => res.json(responseCollection(state.marketplace.orders)));
app.post('/api/marketplace/orders', (req, res) => {
  const order = { id: nextId(state.marketplace.orders), ...req.body, createdAt: new Date().toISOString() };
  state.marketplace.orders.unshift(order);
  saveState();
  res.status(201).json(order);
});
app.post('/api/marketplace/reviews', (req, res) => {
  const review = { id: nextId(state.marketplace.reviews), ...req.body, createdAt: new Date().toISOString() };
  state.marketplace.reviews.unshift(review);
  saveState();
  res.status(201).json(review);
});

app.get('/api/forum/posts', (_req, res) => res.json(responseCollection(state.forum.posts)));
app.post('/api/forum/posts', (req, res) => {
  const post = { id: nextId(state.forum.posts), ...req.body, createdAt: new Date().toISOString() };
  state.forum.posts.unshift(post);
  saveState();
  res.status(201).json(post);
});
app.post('/api/forum/comments', (req, res) => {
  const comment = { id: nextId(state.forum.comments), ...req.body, createdAt: new Date().toISOString() };
  state.forum.comments.unshift(comment);
  saveState();
  res.status(201).json(comment);
});
app.get('/api/forum/groups', (_req, res) => res.json(responseCollection(state.forum.groups)));
app.post('/api/forum/groups', (req, res) => {
  const group = { id: nextId(state.forum.groups), ...req.body, createdAt: new Date().toISOString() };
  state.forum.groups.unshift(group);
  saveState();
  res.status(201).json(group);
});

app.get('/', (_req, res) => {
  res.redirect('/student-marketplace/student-marketplace-buy-sell-trade-on-campus.html');
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
});
