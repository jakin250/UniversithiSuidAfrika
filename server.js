import compression from 'compression';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';
const defaultSessionSecret = 'change-me-in-production';
const dataDir = path.join(__dirname, 'data');
const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'app.json');
const sessionSecret = process.env.SESSION_SECRET || defaultSessionSecret;
const postgresAuthUrl = [process.env.POSTGRES_URL, process.env.POSTGRES_DATABASE_URL, process.env.DATABASE_URL]
  .find(value => /^postgres(ql)?:\/\//i.test(String(value || '')));
let postgresAuthPool = null;
let postgresAuthInitError = null;

const unsafeSessionSecrets = new Set([
  defaultSessionSecret,
  'replace-with-a-long-random-secret',
  'dev-secret'
]);

if (isProduction && (unsafeSessionSecrets.has(sessionSecret) || sessionSecret.length < 32)) {
  console.error('SESSION_SECRET must be set to a strong unique value of at least 32 characters before running in production.');
  process.exit(1);
}
const allowedUniversityDomains = String(process.env.UNIVERSITY_EMAIL_DOMAINS || 'unisa.ac.za')
  .split(',')
  .map(entry => entry.trim().toLowerCase())
  .filter(Boolean);


function hasPostgresAuth() {
  return Boolean(postgresAuthUrl);
}

async function getPostgresAuthPool() {
  if (!hasPostgresAuth()) return null;
  if (!postgresAuthPool) {
    const pg = await import('pg');
    const { Pool } = pg.default || pg;
    postgresAuthPool = new Pool({
      connectionString: postgresAuthUrl,
      ssl: process.env.POSTGRES_SSL === 'false' ? false : { rejectUnauthorized: false }
    });
  }
  return postgresAuthPool;
}

function toAppUserFromPostgres(row) {
  if (!row) return null;
  return {
    id: `pg:${row.id}`,
    postgresId: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role || 'user',
    campus: row.campus || '',
    status: row.status || 'active',
    emailVerified: Boolean(row.email_verified),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at
  };
}

async function initPostgresAuth() {
  if (!hasPostgresAuth()) return;
  try {
    const pool = await getPostgresAuthPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS registered_users (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        campus TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active',
        email_verified BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await migrateJsonUsersToPostgres();
    postgresAuthInitError = null;
  } catch (error) {
    postgresAuthInitError = error;
    console.error(`PostgreSQL registered-user storage is not ready: ${error.message}`);
  }
}

async function migrateJsonUsersToPostgres() {
  if (!hasPostgresAuth() || !Array.isArray(state.users) || state.users.length === 0) return;
  const pool = await getPostgresAuthPool();
  for (const user of state.users) {
    if (!user.email || !(user.passwordHash || user.password_hash)) continue;
    await pool.query(
      `INSERT INTO registered_users (name, email, password_hash, role, campus, status, email_verified, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, NOW()), COALESCE($9::timestamptz, NOW()))
       ON CONFLICT (email) DO NOTHING`,
      [
        user.name || 'Student',
        String(user.email).toLowerCase(),
        user.passwordHash || user.password_hash,
        user.role || 'user',
        user.campus || '',
        user.status || 'active',
        user.emailVerified ?? true,
        user.createdAt || user.created_at || null,
        user.updatedAt || user.updated_at || user.createdAt || user.created_at || null
      ]
    );
  }
}

async function findPostgresUserByEmail(email) {
  if (!hasPostgresAuth()) return null;
  const pool = await getPostgresAuthPool();
  const result = await pool.query('SELECT * FROM registered_users WHERE email = $1', [String(email).toLowerCase()]);
  return toAppUserFromPostgres(result.rows[0]);
}

async function createPostgresUser({ name, email, passwordHash, campus }) {
  const pool = await getPostgresAuthPool();
  const result = await pool.query(
    `INSERT INTO registered_users (name, email, password_hash, campus)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [name, email, passwordHash, campus]
  );
  return toAppUserFromPostgres(result.rows[0]);
}

async function updatePostgresUserProfile(user, updates) {
  if (!hasPostgresAuth() || !user?.postgresId) return user;
  const pool = await getPostgresAuthPool();
  const result = await pool.query(
    `UPDATE registered_users
     SET name = COALESCE(NULLIF($2, ''), name),
         campus = COALESCE(NULLIF($3, ''), campus),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [user.postgresId, updates.name || '', updates.campus || '']
  );
  return toAppUserFromPostgres(result.rows[0]) || user;
}

function findJsonUserByEmail(email) {
  return state.users.find(entry => entry.email === email) || null;
}


function maskPath(value) {
  return value || '';
}

function checkJsonPersistence() {
  const directory = path.dirname(dbPath);
  const probePath = path.join(directory, `.write-test-${process.pid}-${Date.now()}`);
  const result = {
    path: maskPath(dbPath),
    directory,
    directoryExists: fs.existsSync(directory),
    fileExists: fs.existsSync(dbPath),
    writable: false,
    error: null
  };

  try {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(probePath, 'ok');
    fs.unlinkSync(probePath);
    result.writable = true;
  } catch (error) {
    result.error = error.message;
  }

  return result;
}

async function checkPostgresAuth() {
  if (!hasPostgresAuth()) {
    return { configured: false, connected: false, table: null, error: null };
  }
  if (postgresAuthInitError) {
    return { configured: true, connected: false, table: null, error: postgresAuthInitError.message };
  }

  try {
    const pool = await getPostgresAuthPool();
    await pool.query('SELECT 1');
    const table = await pool.query("SELECT to_regclass('public.registered_users') AS table_name");
    return {
      configured: true,
      connected: true,
      table: table.rows[0]?.table_name || null,
      error: null
    };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      table: null,
      error: error.message
    };
  }
}

async function buildReadinessPayload() {
  const jsonPersistence = checkJsonPersistence();
  const postgresAuth = await checkPostgresAuth();
  const sessionSecretConfigured = !unsafeSessionSecrets.has(sessionSecret) && sessionSecret.length >= 32;
  const recommendations = [];

  if (!sessionSecretConfigured) {
    recommendations.push('Set SESSION_SECRET to a strong unique value of at least 32 characters before production use.');
  }
  if (!jsonPersistence.writable) {
    recommendations.push(`Mount persistent storage and set DATABASE_PATH to a writable path such as /app/data/data.json. Current error: ${jsonPersistence.error || 'unknown'}`);
  }
  if (!postgresAuth.configured) {
    recommendations.push('Set DATABASE_URL, POSTGRES_URL, or POSTGRES_DATABASE_URL to store registered users in PostgreSQL.');
  } else if (!postgresAuth.connected) {
    recommendations.push(`Check the PostgreSQL connection string and credentials. Current error: ${postgresAuth.error || 'unknown'}`);
  }
  if (allowedUniversityDomains.length === 0) {
    recommendations.push('Set UNIVERSITY_EMAIL_DOMAINS to at least one allowed email domain.');
  }

  return {
    ok: jsonPersistence.writable && (!postgresAuth.configured || postgresAuth.connected),
    environment: isProduction ? 'production' : 'development',
    authStorage: hasPostgresAuth() ? 'postgres' : 'json-file',
    sessionSecret: {
      configured: sessionSecretConfigured,
      productionSafe: !isProduction || sessionSecretConfigured
    },
    universityEmailDomains: allowedUniversityDomains,
    jsonPersistence,
    postgresAuth,
    recommendations
  };
}

async function logStartupReadiness() {
  const readiness = await buildReadinessPayload();
  console.log(`Auth storage: ${readiness.authStorage}`);
  console.log(`JSON data path: ${dbPath}`);
  if (readiness.recommendations.length) {
    console.warn('Readiness recommendations:');
    for (const recommendation of readiness.recommendations) console.warn(`- ${recommendation}`);
  }
}

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const seed = {
  users: [],
  payments: [],
  bookstore: {
    books: [],
    orders: [],
    reviews: [],
    listings: [],
    messages: []
  },
  marketplace: {
    listings: [],
    messages: [],
    orders: [],
    reviews: [],
    offers: [],
    saves: []
  },
  forum: {
    posts: [],
    comments: [],
    groups: [],
    messages: [],
    saves: [],
    follows: [],
    reports: [],
    notifications: [],
    moderationLogs: []
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
  state.payments ||= [];
  state.bookstore ||= structuredClone(seed.bookstore);
  state.marketplace ||= structuredClone(seed.marketplace);
  state.forum ||= structuredClone(seed.forum);
  state.sessions ||= {};

  state.sessions = {};
  saveState();
}

ensureState();
const startupReadiness = initPostgresAuth()
  .then(logStartupReadiness)
  .catch(error => {
    console.error(`Startup readiness check failed: ${error.message}`);
  });

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

function signSession(user) {
  const sessionUser = normalizeUser(user);
  const token = `${sessionUser.id}.${crypto.randomBytes(32).toString('base64url')}`;
  state.sessions[token] = {
    userId: sessionUser.id,
    postgresId: user.postgresId || null,
    user: sessionUser,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
  };
  saveState();
  return token;
}

function buildSessionCookie(name, value, options = {}) {
  const maxAge = Number(options.maxAge || 0);
  const secure = isProduction ? '; Secure' : '';
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function getSessionUser(req) {
  const token = getCookieValue(req, 'universithi_session');
  if (!token) return null;
  const entry = state.sessions[token];
  if (!entry || entry.expiresAt < Date.now()) return null;
  if (entry.user) return { ...entry.user, postgresId: entry.postgresId || null };
  return state.users.find(user => String(user.id) === String(entry.userId)) || null;
}

function setSessionCookie(user) {
  return buildSessionCookie('universithi_session', signSession(user), { maxAge: 7 * 24 * 60 * 60 });
}

function clearSessionCookie(req) {
  const token = getCookieValue(req, 'universithi_session');
  if (token) {
    delete state.sessions[token];
    saveState();
  }
  return buildSessionCookie('universithi_session', '', { maxAge: 0 });
}

function normalizeUser(user) {
  return user ? {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    campus: user.campus || '',
    status: user.status || 'active',
    emailVerified: Boolean(user.emailVerified),
    createdAt: user.createdAt
  } : null;
}

function isAllowedUniversityEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const atIndex = normalizedEmail.lastIndexOf('@');
  if (atIndex === -1) return false;
  const domain = normalizedEmail.slice(atIndex + 1);
  if (!domain) return false;

  return allowedUniversityDomains.some(rule => {
    if (rule.startsWith('*.')) {
      const suffix = rule.slice(1);
      return domain.endsWith(suffix);
    }
    if (rule.startsWith('.')) {
      return domain.endsWith(rule);
    }
    return domain === rule;
  });
}

function pushForumNotification(notification) {
  state.forum.notifications.unshift({
    id: nextId(state.forum.notifications),
    read: false,
    createdAt: new Date().toISOString(),
    ...notification
  });
}

function formatConversationTime(value) {
  return new Date(value || Date.now()).toLocaleString('en-ZA', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function deriveInitials(name) {
  return String(name || 'MS')
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'MS';
}

function buildMarketplaceInbox(sessionUser) {
  const listingsById = new Map(state.marketplace.listings.map(listing => [String(listing.id), listing]));
  const ordersById = new Map(state.marketplace.orders.map(order => [String(order.id), order]));
  const threads = new Map();

  const ensureThread = (key, seed = {}) => {
    if (!threads.has(key)) {
      threads.set(key, {
        id: seed.id || key,
        threadId: seed.threadId || null,
        listingId: seed.listingId || null,
        orderId: seed.orderId || null,
        sellerName: seed.sellerName || 'Marketplace Seller',
        sellerInitials: seed.sellerInitials || deriveInitials(seed.sellerName || 'Marketplace Seller'),
        viewerRole: seed.viewerRole || null,
        item: seed.item || 'Marketplace listing',
        itemPrice: Number(seed.itemPrice || 0),
        lastMessage: seed.lastMessage || '',
        timestamp: seed.timestamp || '',
        unread: Boolean(seed.unread),
        online: true,
        messages: seed.messages || [],
        orderStatus: seed.orderStatus || 'pending',
        escrowAmount: seed.escrowAmount || null,
        updatedAt: seed.updatedAt || null
      });
    }
    return threads.get(key);
  };

  const isRelevant = (listing, order, message) => {
    if (!sessionUser) return true;
    const userId = String(sessionUser.id);
    const touchesListing = listing && String(listing.ownerId || '') === userId;
    const touchesOrder = order && String(order.ownerId || '') === userId;
    const touchesMessage = message && String(message.ownerId || '') === userId;
    return touchesListing || touchesOrder || touchesMessage;
  };

  const addMessage = (message) => {
    const listing = message.listingId ? listingsById.get(String(message.listingId)) : null;
    const order = message.orderId ? ordersById.get(String(message.orderId)) : null;
    if (!isRelevant(listing, order, message)) return;
    const isSellerView = Boolean(sessionUser && listing && String(listing.ownerId || '') === String(sessionUser.id));
    const threadKey = message.threadId
      ? `thread:${message.threadId}`
      : message.orderId
        ? `listing:${listing?.id || order?.listingId || message.orderId}`
        : message.listingId
          ? `listing:${message.listingId}`
          : `general:${message.id}`;
    const sellerName = isSellerView
      ? (order?.buyer?.name || order?.buyerName || message.buyerName || 'Buyer')
      : (message.sellerName || listing?.seller || order?.book?.seller || order?.sellerName || 'Marketplace Seller');
    const itemTitle = message.itemTitle
      || listing?.title
      || order?.book?.title
      || order?.itemTitle
      || 'Marketplace listing';
    const thread = ensureThread(threadKey, {
      id: threadKey,
      threadId: message.threadId || null,
      listingId: listing?.id || message.listingId || order?.listingId || null,
      orderId: order?.id || message.orderId || null,
      sellerName,
      sellerInitials: deriveInitials(sellerName),
      viewerRole: isSellerView ? 'seller' : 'buyer',
      item: itemTitle,
      itemPrice: Number(message.itemPrice || listing?.price || order?.amount || 0),
      orderStatus: message.orderStatus || order?.status || 'pending',
      escrowAmount: message.amount || listing?.price || order?.amount || null
    });
    thread.messages.push({
      sender: sessionUser
        ? (String(message.ownerId || '') === String(sessionUser.id)
          ? (thread.viewerRole || 'buyer')
          : (thread.viewerRole === 'seller' ? 'buyer' : 'seller'))
        : (message.sender || 'buyer'),
      text: message.text || '',
      time: formatConversationTime(message.createdAt),
      ownerId: message.ownerId || null,
      createdAt: message.createdAt || null
    });
    thread.lastMessage = message.text || thread.lastMessage;
    thread.timestamp = formatConversationTime(message.createdAt);
    thread.updatedAt = message.createdAt || thread.updatedAt;
    if (sessionUser && String(message.ownerId || '') !== String(sessionUser.id)) {
      thread.unread = true;
    }
  };

  state.marketplace.listings.forEach(listing => {
    if (!isRelevant(listing, null, null)) return;
    const threadKey = `listing:${listing.id}`;
    const sellerName = sessionUser && String(listing.ownerId || '') === String(sessionUser.id)
      ? 'Buyer'
      : (listing.seller || 'Marketplace Seller');
    ensureThread(threadKey, {
      id: threadKey,
      listingId: listing.id,
      sellerName,
      sellerInitials: deriveInitials(sellerName),
      viewerRole: sessionUser && String(listing.ownerId || '') === String(sessionUser.id) ? 'seller' : 'buyer',
      item: listing.title || 'Marketplace listing',
      itemPrice: Number(listing.price || 0),
      orderStatus: listing.status || 'active',
      escrowAmount: listing.price || null
    });
  });

  state.marketplace.orders.forEach(order => {
    const listing = order.listingId ? listingsById.get(String(order.listingId)) : null;
    if (!isRelevant(listing, order, null)) return;
    const threadKey = `listing:${listing?.id || order.listingId || order.id}`;
    const isSellerView = Boolean(sessionUser && listing && String(listing.ownerId || '') === String(sessionUser.id));
    const sellerName = isSellerView
      ? (order.buyer?.name || order.buyerName || 'Buyer')
      : (listing?.seller || order.sellerName || 'Marketplace Seller');
    ensureThread(threadKey, {
      id: threadKey,
      listingId: listing?.id || order.listingId || null,
      orderId: order.id,
      sellerName,
      sellerInitials: deriveInitials(sellerName),
      viewerRole: isSellerView ? 'seller' : 'buyer',
      item: listing?.title || order.itemTitle || 'Marketplace listing',
      itemPrice: Number(listing?.price || order.amount || 0),
      orderStatus: order.status || 'payment_pending',
      escrowAmount: order.amount || listing?.price || null
    });
  });

  return Array.from(threads.values()).sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0));
}

function buildBookstoreInbox(sessionUser) {
  const booksById = new Map(state.bookstore.books.map(book => [String(book.id), book]));
  const threads = new Map();

  const ensureThread = (key, seed = {}) => {
    if (!threads.has(key)) {
      threads.set(key, {
        id: seed.id || key,
        orderId: seed.orderId || null,
        bookId: seed.bookId || null,
        book: seed.book || { title: 'Book', cover: '📘' },
        withUser: seed.withUser || { name: 'Seller' },
        lastMessage: seed.lastMessage || '',
        messages: seed.messages || [],
        updatedAt: seed.updatedAt || null
      });
    }
    return threads.get(key);
  };

  const isRelevant = (order, message) => {
    if (!sessionUser) return true;
    const userId = String(sessionUser.id);
    return (order && String(order.ownerId || '') === userId) || (message && String(message.ownerId || '') === userId);
  };

  state.bookstore.orders.forEach(order => {
    const book = order.book || booksById.get(String(order.bookId || '')) || null;
    if (!isRelevant(order, null)) return;
    const isOrderOwner = sessionUser && String(order.ownerId || '') === String(sessionUser.id);
    const withUserName = isOrderOwner
      ? (book?.seller || order.seller?.name || order.sellerName || 'Seller')
      : (order.buyer?.name || order.buyerName || book?.buyer || 'Buyer');
    const key = `order:${order.id}`;
    ensureThread(key, {
      id: order.id,
      orderId: order.id,
      bookId: book?.id || order.bookId || null,
      book: book || { title: order.book?.title || 'Book', cover: order.book?.cover || '📘' },
      withUser: { name: withUserName },
      lastMessage: '',
      updatedAt: order.createdAt || null
    });
  });

  state.bookstore.messages.forEach(message => {
    const order = message.orderId ? state.bookstore.orders.find(item => String(item.id) === String(message.orderId)) : null;
    const book = order?.book || booksById.get(String(message.bookId || order?.bookId || '')) || null;
    if (!isRelevant(order, message)) return;
    const key = `order:${message.orderId || order?.id || message.bookId || 'general'}`;
    const isOrderOwner = sessionUser && order && String(order.ownerId || '') === String(sessionUser.id);
    const withUserName = isOrderOwner
      ? (book?.seller || order?.seller?.name || order?.sellerName || 'Seller')
      : (order?.buyer?.name || order?.buyerName || book?.seller || 'Buyer');
    const thread = ensureThread(key, {
      id: order?.id || message.orderId || key,
      orderId: order?.id || message.orderId || null,
      bookId: book?.id || message.bookId || null,
      book: book || { title: 'Book', cover: '📘' },
      withUser: { name: withUserName }
    });
    thread.messages.push({
      sender: sessionUser && String(message.ownerId || '') === String(sessionUser.id) ? 'me' : 'them',
      senderId: message.ownerId || 'seller',
      text: message.text || '',
      timestamp: message.createdAt || new Date().toISOString()
    });
    thread.lastMessage = message.text || thread.lastMessage;
    thread.updatedAt = message.createdAt || thread.updatedAt;
  });

  return Array.from(threads.values()).sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0));
}

function requireSessionUser(req) {
  const user = getSessionUser(req);
  if (!user) {
    return null;
  }
  return user;
}

function requireAuthenticatedUser(req, res) {
  const user = requireSessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return user;
}

function responseCollection(collection) {
  return clone(collection).reverse();
}

function makePaymentReference(type) {
  const prefix = type === 'bookstore' ? 'USB' : 'USM';
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function resolvePaymentProvider(method) {
  const normalizedMethod = String(method || 'card').toLowerCase();
  if (normalizedMethod === 'cash') return 'escrow-cash-pickup';
  if (normalizedMethod === 'bank' || normalizedMethod === 'mobile') return 'flutterwave-ready';
  return 'flutterwave-ready';
}

function createPaymentRecord({ type, order, method, amount, currency = 'ZAR' }) {
  const payment = {
    id: nextId(state.payments),
    reference: makePaymentReference(type),
    type,
    orderId: order.id,
    method,
    provider: resolvePaymentProvider(method),
    amount: Number(amount || 0),
    currency,
    status: method === 'cash' ? 'cash_on_pickup_pending' : 'escrow_held',
    escrowStatus: method === 'cash' ? 'handover_required' : 'payment_held',
    createdAt: new Date().toISOString()
  };
  state.payments.unshift(payment);
  return payment;
}

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname, {
  extensions: ['html'],
  maxAge: isProduction ? '1h' : 0
}));

function healthPayload() {
  return {
    ok: true,
    env: isProduction ? 'production' : 'development',
    storage: hasPostgresAuth() ? 'postgres-users+json-file' : 'json-file',
    file: path.basename(dbPath),
    uptime: process.uptime()
  };
}

app.get('/api/health', (_req, res) => {
  res.json(healthPayload());
});

app.get('/healthz', (_req, res) => {
  res.json(healthPayload());
});

app.get('/api/debug/readiness', async (_req, res) => {
  const readiness = await buildReadinessPayload();
  res.status(readiness.ok ? 200 : 503).json(readiness);
});

app.get('/api/auth/domains', (_req, res) => {
  res.json({ domains: allowedUniversityDomains });
});

app.get('/api/auth/me', (req, res) => {
  res.json({ user: normalizeUser(getSessionUser(req)) });
});

app.post('/api/auth/register', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const campus = String(req.body?.campus || '').trim();
  if (!name || !email || password.length < 8) return res.status(400).json({ error: 'Invalid signup data' });
  if (!isAllowedUniversityEmail(email)) return res.status(400).json({ error: 'Please use your university email address' });
  if (hasPostgresAuth()) {
    if (await findPostgresUserByEmail(email)) return res.status(409).json({ error: 'Email already registered' });
    const user = await createPostgresUser({ name, email, campus, passwordHash: bcrypt.hashSync(password, 12) });
    res.setHeader('Set-Cookie', setSessionCookie(user));
    return res.status(201).json({ user: normalizeUser(user) });
  }
  if (state.users.some(user => user.email === email)) return res.status(409).json({ error: 'Email already registered' });
  const user = {
    id: nextId(state.users),
    name,
    email,
    passwordHash: bcrypt.hashSync(password, 12),
    role: 'user',
    campus,
    status: 'active',
    emailVerified: true,
    createdAt: new Date().toISOString()
  };
  state.users.unshift(user);
  saveState();
  res.setHeader('Set-Cookie', setSessionCookie(user));
  res.status(201).json({ user: normalizeUser(user) });
});

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const user = hasPostgresAuth() ? await findPostgresUserByEmail(email) : findJsonUserByEmail(email);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) return res.status(401).json({ error: 'Invalid email or password' });
  res.setHeader('Set-Cookie', setSessionCookie(user));
  res.json({ user: normalizeUser(user) });
});

app.post('/api/auth/logout', (req, res) => {
  res.setHeader('Set-Cookie', clearSessionCookie(req));
  res.json({ ok: true });
});

app.get('/api/profile', (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  res.json({
    user: normalizeUser(user),
    profile: {
      campus: user.campus || '',
      status: user.status || 'active',
      emailVerified: Boolean(user.emailVerified)
    }
  });
});

app.patch('/api/profile', async (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  const campus = String(req.body?.campus || '').trim();
  const displayName = String(req.body?.name || '').trim();
  if (hasPostgresAuth() && user.postgresId) {
    const updatedUser = await updatePostgresUserProfile(user, { name: displayName, campus });
    const token = getCookieValue(req, 'universithi_session');
    if (token && state.sessions[token]) {
      state.sessions[token].postgresId = updatedUser.postgresId || state.sessions[token].postgresId || null;
      state.sessions[token].user = normalizeUser(updatedUser);
      saveState();
    }
    return res.json({
      user: normalizeUser(updatedUser),
      profile: {
        campus: updatedUser.campus || '',
        status: updatedUser.status || 'active',
        emailVerified: Boolean(updatedUser.emailVerified)
      }
    });
  }
  const currentUserIndex = state.users.findIndex(entry => String(entry.id) === String(user.id));
  if (currentUserIndex === -1) return res.status(404).json({ error: 'User not found' });
  state.users[currentUserIndex] = {
    ...state.users[currentUserIndex],
    name: displayName || state.users[currentUserIndex].name,
    campus: campus || state.users[currentUserIndex].campus || '',
    updatedAt: new Date().toISOString()
  };
  saveState();
  res.json({
    user: normalizeUser(state.users[currentUserIndex]),
    profile: {
      campus: state.users[currentUserIndex].campus || '',
      status: state.users[currentUserIndex].status || 'active',
      emailVerified: Boolean(state.users[currentUserIndex].emailVerified)
    }
  });
});

app.get('/api/bookstore/books', (req, res) => {
  const sessionUser = req.query.mine === '1' ? requireAuthenticatedUser(req, res) : requireSessionUser(req);
  if (req.query.mine === '1' && !sessionUser) return;
  const books = req.query.mine === '1'
    ? state.bookstore.books.filter(book => sessionUser && String(book.ownerId) === String(sessionUser.id))
    : state.bookstore.books.filter(book => book.status !== 'draft');
  res.json(responseCollection(books));
});
app.post('/api/bookstore/books', (req, res) => {
  const sessionUser = requireAuthenticatedUser(req, res);
  if (!sessionUser) return;
  const title = String(req.body?.title || '').trim();
  const author = String(req.body?.author || '').trim();
  const price = Number(req.body?.price || 0);
  const condition = String(req.body?.condition || '').trim();
  if (!title || !author || !Number.isFinite(price) || price < 0 || !condition) {
    return res.status(400).json({ error: 'Invalid book data' });
  }
  const book = {
    id: nextId(state.bookstore.books),
    ...req.body,
    ownerId: sessionUser.id,
    seller: sessionUser.name,
    status: String(req.body?.status || 'active'),
    createdAt: new Date().toISOString()
  };
  state.bookstore.books.unshift(book);
  saveState();
  res.status(201).json(book);
});
app.get('/api/bookstore/books/:id', (req, res) => {
  const book = state.bookstore.books.find(item => String(item.id) === String(req.params.id));
  if (!book) return res.status(404).json({ error: 'Book not found' });
  if (book.status === 'draft') {
    const sessionUser = requireSessionUser(req);
    if (!sessionUser || String(book.ownerId) !== String(sessionUser.id)) {
      return res.status(404).json({ error: 'Book not found' });
    }
  }
  res.json(book);
});
app.patch('/api/bookstore/books/:id', (req, res) => {
  const sessionUser = requireAuthenticatedUser(req, res);
  if (!sessionUser) return;
  const index = state.bookstore.books.findIndex(item => String(item.id) === String(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'Book not found' });
  if (String(state.bookstore.books[index].ownerId) !== String(sessionUser.id)) {
    return res.status(403).json({ error: 'You can only update your own listing' });
  }
  const allowed = ['title', 'author', 'edition', 'isbn', 'courseCode', 'price', 'retailPrice', 'condition', 'description', 'exchange', 'wantedBooks', 'exchangeTerms', 'status'];
  const updates = Object.fromEntries(allowed.filter(key => req.body?.[key] !== undefined).map(key => [key, req.body[key]]));
  if (updates.price !== undefined && (!Number.isFinite(Number(updates.price)) || Number(updates.price) < 0)) {
    return res.status(400).json({ error: 'Price must be a positive number' });
  }
  if (updates.price !== undefined) updates.price = Number(updates.price);
  state.bookstore.books[index] = { ...state.bookstore.books[index], ...updates, updatedAt: new Date().toISOString() };
  saveState();
  res.json(state.bookstore.books[index]);
});
app.delete('/api/bookstore/books/:id', (req, res) => {
  const sessionUser = requireAuthenticatedUser(req, res);
  if (!sessionUser) return;
  const index = state.bookstore.books.findIndex(item => String(item.id) === String(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'Book not found' });
  if (String(state.bookstore.books[index].ownerId) !== String(sessionUser.id)) {
    return res.status(403).json({ error: 'You can only delete your own listing' });
  }
  const [deleted] = state.bookstore.books.splice(index, 1);
  saveState();
  res.json({ deleted: true, id: deleted.id });
});
app.get('/api/bookstore/orders', (_req, res) => res.json(responseCollection(state.bookstore.orders)));
app.post('/api/bookstore/orders', (req, res) => {
  const sessionUser = requireAuthenticatedUser(req, res);
  if (!sessionUser) return;
  const amount = Number(req.body?.amount || req.body?.total || 0);
  const paymentMethod = String(req.body?.paymentMethod || 'card');
  const order = {
    id: nextId(state.bookstore.orders),
    ...req.body,
    ownerId: sessionUser?.id || null,
    amount,
    paymentMethod,
    status: req.body?.status || 'payment_pending',
    escrowStatus: req.body?.escrowStatus || 'payment_held',
    createdAt: new Date().toISOString()
  };
  const payment = createPaymentRecord({ type: 'bookstore', order, method: paymentMethod, amount, currency: 'ZAR' });
  order.paymentReference = payment.reference;
  order.paymentProvider = payment.provider;
  order.escrowStatus = payment.escrowStatus;
  state.bookstore.orders.unshift(order);
  saveState();
  res.status(201).json(order);
});
app.get('/api/bookstore/reviews', (_req, res) => res.json(responseCollection(state.bookstore.reviews)));
app.get('/api/bookstore/messages', (_req, res) => res.json(responseCollection(state.bookstore.messages)));
app.post('/api/bookstore/messages', (req, res) => {
  const sessionUser = requireAuthenticatedUser(req, res);
  if (!sessionUser) return;
  const message = {
    id: nextId(state.bookstore.messages),
    ...req.body,
    ownerId: sessionUser.id,
    status: 'sent',
    createdAt: new Date().toISOString()
  };
  state.bookstore.messages.unshift(message);
  saveState();
  res.status(201).json(message);
});
app.get('/api/bookstore/inbox', (req, res) => {
  const sessionUser = requireSessionUser(req);
  res.json(responseCollection(buildBookstoreInbox(sessionUser)));
});
app.post('/api/bookstore/reviews', (req, res) => {
  const sessionUser = requireAuthenticatedUser(req, res);
  if (!sessionUser) return;
  const review = {
    id: nextId(state.bookstore.reviews),
    ...req.body,
    ownerId: sessionUser?.id || null,
    status: 'published',
    createdAt: new Date().toISOString()
  };
  state.bookstore.reviews.unshift(review);
  saveState();
  res.status(201).json(review);
});
app.post('/api/bookstore/listings', (req, res) => {
  const sessionUser = requireAuthenticatedUser(req, res);
  if (!sessionUser) return;
  const listing = {
    id: nextId(state.bookstore.listings),
    ...req.body,
    ownerId: sessionUser?.id || null,
    status: req.body?.status || 'active',
    createdAt: new Date().toISOString()
  };
  state.bookstore.listings.unshift(listing);
  saveState();
  res.status(201).json(listing);
});

app.get('/api/marketplace/listings', (_req, res) => res.json(responseCollection(state.marketplace.listings)));
app.post('/api/marketplace/listings', (req, res) => {
  const sessionUser = requireAuthenticatedUser(req, res);
  if (!sessionUser) return;
  const listing = {
    id: nextId(state.marketplace.listings),
    ...req.body,
    ownerId: sessionUser?.id || null,
    seller: String(req.body?.seller || '').trim() && String(req.body?.seller || '').trim().toLowerCase() !== 'you'
      ? req.body.seller
      : sessionUser.name,
    status: req.body?.status || 'active',
    createdAt: new Date().toISOString()
  };
  state.marketplace.listings.unshift(listing);
  saveState();
  res.status(201).json(listing);
});
app.get('/api/marketplace/messages', (_req, res) => res.json(responseCollection(state.marketplace.messages)));
app.post('/api/marketplace/messages', (req, res) => {
  const sessionUser = requireAuthenticatedUser(req, res);
  if (!sessionUser) return;
  const message = {
    id: nextId(state.marketplace.messages),
    ...req.body,
    ownerId: sessionUser?.id || null,
    status: 'sent',
    createdAt: new Date().toISOString()
  };
  state.marketplace.messages.unshift(message);
  saveState();
  res.status(201).json(message);
});
app.get('/api/marketplace/inbox', (req, res) => {
  const sessionUser = requireSessionUser(req);
  res.json(responseCollection(buildMarketplaceInbox(sessionUser)));
});
app.get('/api/marketplace/orders', (_req, res) => res.json(responseCollection(state.marketplace.orders)));
app.post('/api/marketplace/orders', (req, res) => {
  const sessionUser = requireAuthenticatedUser(req, res);
  if (!sessionUser) return;
  const amount = Number(req.body?.amount || req.body?.total || 0);
  const paymentMethod = String(req.body?.paymentMethod || 'card');
  const order = {
    id: nextId(state.marketplace.orders),
    ...req.body,
    ownerId: sessionUser?.id || null,
    amount,
    paymentMethod,
    status: req.body?.status || 'payment_pending',
    escrowStatus: req.body?.escrowStatus || 'payment_held',
    createdAt: new Date().toISOString()
  };
  const payment = createPaymentRecord({ type: 'marketplace', order, method: paymentMethod, amount, currency: 'ZAR' });
  order.paymentReference = payment.reference;
  order.paymentProvider = payment.provider;
  order.escrowStatus = payment.escrowStatus;
  state.marketplace.orders.unshift(order);
  saveState();
  res.status(201).json(order);
});

app.get('/api/payments', (req, res) => {
  const sessionUser = requireSessionUser(req);
  if (!sessionUser) return res.json([]);
  const userOrders = new Set([
    ...state.marketplace.orders.filter(order => String(order.ownerId || '') === String(sessionUser.id)).map(order => `marketplace:${order.id}`),
    ...state.bookstore.orders.filter(order => String(order.ownerId || '') === String(sessionUser.id)).map(order => `bookstore:${order.id}`)
  ]);
  const payments = state.payments.filter(payment => userOrders.has(`${payment.type}:${payment.orderId}`));
  res.json(responseCollection(payments));
});

app.post('/api/payments/checkout', (req, res) => {
  const sessionUser = requireAuthenticatedUser(req, res);
  if (!sessionUser) return;
  const type = String(req.body?.type || '').trim().toLowerCase();
  const paymentMethod = String(req.body?.paymentMethod || 'card').trim().toLowerCase();
  if (!['marketplace', 'bookstore'].includes(type)) {
    return res.status(400).json({ error: 'Checkout type must be marketplace or bookstore' });
  }

  const amount = Number(req.body?.amount || req.body?.total || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Checkout amount must be greater than zero' });
  }

  const orderCollection = type === 'bookstore' ? state.bookstore.orders : state.marketplace.orders;
  const order = {
    id: nextId(orderCollection),
    ...(req.body?.order || {}),
    ownerId: sessionUser.id,
    buyer: {
      name: sessionUser.name,
      email: sessionUser.email,
      ...(req.body?.buyer || {})
    },
    amount,
    paymentMethod,
    status: paymentMethod === 'cash' ? 'handover_pending' : 'payment_pending',
    escrowStatus: paymentMethod === 'cash' ? 'handover_required' : 'payment_held',
    createdAt: new Date().toISOString()
  };
  const payment = createPaymentRecord({
    type,
    order,
    method: paymentMethod,
    amount,
    currency: String(req.body?.currency || 'ZAR').toUpperCase()
  });
  order.paymentReference = payment.reference;
  order.paymentProvider = payment.provider;
  order.escrowStatus = payment.escrowStatus;
  orderCollection.unshift(order);
  saveState();
  res.status(201).json({ order, payment });
});
app.get('/api/marketplace/offers', (_req, res) => res.json(responseCollection(state.marketplace.offers)));
app.post('/api/marketplace/offers', (req, res) => {
  const sessionUser = requireAuthenticatedUser(req, res);
  if (!sessionUser) return;
  const offer = {
    id: nextId(state.marketplace.offers),
    listingId: req.body?.listingId || null,
    amount: Number(req.body?.amount || 0),
    message: String(req.body?.message || ''),
    ownerId: sessionUser.id,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  state.marketplace.offers.unshift(offer);
  saveState();
  res.status(201).json(offer);
});
app.get('/api/marketplace/saves', (_req, res) => res.json(responseCollection(state.marketplace.saves)));
app.post('/api/marketplace/saves', (req, res) => {
  const sessionUser = requireAuthenticatedUser(req, res);
  if (!sessionUser) return;
  const save = {
    id: nextId(state.marketplace.saves),
    listingId: req.body?.listingId || null,
    ownerId: sessionUser.id,
    status: 'saved',
    createdAt: new Date().toISOString()
  };
  state.marketplace.saves.unshift(save);
  saveState();
  res.status(201).json(save);
});
app.post('/api/marketplace/reviews', (req, res) => {
  const sessionUser = requireAuthenticatedUser(req, res);
  if (!sessionUser) return;
  const review = {
    id: nextId(state.marketplace.reviews),
    ...req.body,
    ownerId: sessionUser?.id || null,
    status: 'published',
    createdAt: new Date().toISOString()
  };
  state.marketplace.reviews.unshift(review);
  saveState();
  res.status(201).json(review);
});

app.get('/api/forum/posts', (_req, res) => res.json(responseCollection(state.forum.posts)));
app.get('/api/forum/posts/:id', (req, res) => {
  const post = state.forum.posts.find(item => String(item.id) === String(req.params.id));
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json(post);
});
app.post('/api/forum/posts', (req, res) => {
  const sessionUser = requireAuthenticatedUser(req, res);
  if (!sessionUser) return;
  const post = {
    id: nextId(state.forum.posts),
    ...req.body,
    ownerId: sessionUser?.id || null,
    author: sessionUser ? sessionUser.name : (req.body?.author || 'Anonymous'),
    status: 'published',
    createdAt: new Date().toISOString()
  };
  state.forum.posts.unshift(post);
  if (String(post.category || '').toLowerCase().includes('announcement')) {
    state.users.forEach(user => {
      if (String(user.id) === String(sessionUser.id)) return;
      pushForumNotification({
        type: 'announcement',
        title: `New announcement in ${post.category || 'Forum'}`,
        message: `${sessionUser.name} posted: ${post.title || 'Untitled post'}`,
        postId: post.id,
        userId: user.id
      });
    });
  }
  saveState();
  res.status(201).json(post);
});
app.post('/api/forum/comments', (req, res) => {
  const sessionUser = requireAuthenticatedUser(req, res);
  if (!sessionUser) return;
  const comment = {
    id: nextId(state.forum.comments),
    ...req.body,
    postId: req.body?.postId || null,
    ownerId: sessionUser?.id || null,
    author: sessionUser ? sessionUser.name : (req.body?.author || 'Anonymous'),
    status: 'published',
    createdAt: new Date().toISOString()
  };
  state.forum.comments.unshift(comment);
  const parentPost = state.forum.posts.find(item => String(item.id) === String(comment.postId));
  if (parentPost && String(parentPost.ownerId || '') !== String(sessionUser.id)) {
    pushForumNotification({
      type: 'reply',
      title: 'New reply to your post',
      message: `${sessionUser.name} replied to "${parentPost.title || 'your post'}"`,
      postId: parentPost.id,
      userId: parentPost.ownerId || null
    });
  }
  const mentionMatches = String(comment.body || '').match(/@([A-Za-z0-9_.-]+)/g) || [];
  const mentionedKeys = new Set(mentionMatches.map(entry => entry.slice(1).toLowerCase()));
  state.users.forEach(user => {
    if (String(user.id) === String(sessionUser.id)) return;
    const candidates = [
      String(user.name || '').toLowerCase().replace(/\s+/g, ''),
      String(user.email || '').split('@')[0].toLowerCase()
    ];
    if (!candidates.some(candidate => mentionedKeys.has(candidate))) return;
    pushForumNotification({
      type: 'mention',
      title: 'You were mentioned',
      message: `${sessionUser.name} mentioned you in a comment.`,
      postId: comment.postId,
      userId: user.id
    });
  });
  saveState();
  res.status(201).json(comment);
});
app.post('/api/forum/posts/:id/upvote', (req, res) => {
  const sessionUser = requireAuthenticatedUser(req, res);
  if (!sessionUser) return;
  const post = state.forum.posts.find(item => String(item.id) === String(req.params.id));
  if (!post) return res.status(404).json({ error: 'Post not found' });
  post.votes = Number(post.votes || 0) + 1;
  if (String(post.ownerId || '') !== String(sessionUser.id)) {
    pushForumNotification({
      type: 'upvote',
      title: 'Your post got an upvote',
      message: `${sessionUser.name} upvoted "${post.title || 'your post'}"`,
      postId: post.id,
      userId: post.ownerId || null
    });
  }
  saveState();
  res.json(post);
});
app.post('/api/forum/comments/:id/upvote', (req, res) => {
  const sessionUser = requireAuthenticatedUser(req, res);
  if (!sessionUser) return;
  const comment = state.forum.comments.find(item => String(item.id) === String(req.params.id));
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  comment.votes = Number(comment.votes || 0) + 1;
  if (String(comment.ownerId || '') !== String(sessionUser.id)) {
    pushForumNotification({
      type: 'upvote',
      title: 'Your comment got an upvote',
      message: `${sessionUser.name} upvoted a comment you wrote.`,
      postId: comment.postId,
      userId: comment.ownerId || null
    });
  }
  saveState();
  res.json(comment);
});
app.get('/api/forum/comments', (_req, res) => res.json(responseCollection(state.forum.comments)));
app.get('/api/forum/groups', (_req, res) => res.json(responseCollection(state.forum.groups)));
app.post('/api/forum/groups', (req, res) => {
  const sessionUser = requireAuthenticatedUser(req, res);
  if (!sessionUser) return;
  const group = {
    id: nextId(state.forum.groups),
    ...req.body,
    ownerId: sessionUser?.id || null,
    status: 'active',
    createdAt: new Date().toISOString()
  };
  state.forum.groups.unshift(group);
  saveState();
  res.status(201).json(group);
});
app.post('/api/forum/saves', (req, res) => {
  const sessionUser = requireAuthenticatedUser(req, res);
  if (!sessionUser) return;
  const save = {
    id: nextId(state.forum.saves),
    postId: req.body?.postId || null,
    ownerId: sessionUser.id,
    status: 'saved',
    createdAt: new Date().toISOString()
  };
  state.forum.saves.unshift(save);
  saveState();
  res.status(201).json(save);
});
app.post('/api/forum/follows', (req, res) => {
  const sessionUser = requireAuthenticatedUser(req, res);
  if (!sessionUser) return;
  const follow = {
    id: nextId(state.forum.follows),
    postId: req.body?.postId || null,
    ownerId: sessionUser.id,
    status: 'following',
    createdAt: new Date().toISOString()
  };
  state.forum.follows.unshift(follow);
  saveState();
  res.status(201).json(follow);
});
app.post('/api/forum/reports', (req, res) => {
  const sessionUser = requireAuthenticatedUser(req, res);
  if (!sessionUser) return;
  const report = {
    id: nextId(state.forum.reports),
    postId: req.body?.postId || null,
    reason: String(req.body?.reason || 'spam'),
    ownerId: sessionUser.id,
    status: 'open',
    createdAt: new Date().toISOString()
  };
  state.forum.reports.unshift(report);
  pushForumNotification({
    type: 'report',
    title: 'New report submitted',
    message: `${sessionUser.name} reported a ${report.reason.toLowerCase()} issue.`,
    postId: report.postId || null
  });
  saveState();
  res.status(201).json(report);
});
app.get('/api/forum/reports', (_req, res) => res.json(responseCollection(state.forum.reports)));
app.post('/api/forum/reports/:id/resolve', (req, res) => {
  const report = state.forum.reports.find(item => String(item.id) === String(req.params.id));
  if (!report) return res.status(404).json({ error: 'Report not found' });
  report.status = 'resolved';
  report.resolution = String(req.body?.resolution || 'resolved');
  report.resolvedAt = new Date().toISOString();
  state.forum.moderationLogs.unshift({
    id: nextId(state.forum.moderationLogs),
    action: `Report #${report.id} resolved`,
    moderator: String(req.body?.moderator || 'Moderator'),
    timestamp: new Date().toISOString()
  });
  saveState();
  res.json(report);
});
app.post('/api/forum/reports/:id/remove', (req, res) => {
  const report = state.forum.reports.find(item => String(item.id) === String(req.params.id));
  if (!report) return res.status(404).json({ error: 'Report not found' });
  report.status = 'resolved';
  report.resolution = 'removed';
  report.resolvedAt = new Date().toISOString();
  state.forum.moderationLogs.unshift({
    id: nextId(state.forum.moderationLogs),
    action: `Content removed for report #${report.id}`,
    moderator: String(req.body?.moderator || 'Moderator'),
    timestamp: new Date().toISOString()
  });
  saveState();
  res.json(report);
});
app.post('/api/forum/reports/:id/warn', (req, res) => {
  const report = state.forum.reports.find(item => String(item.id) === String(req.params.id));
  if (!report) return res.status(404).json({ error: 'Report not found' });
  state.forum.moderationLogs.unshift({
    id: nextId(state.forum.moderationLogs),
    action: `Warning sent for report #${report.id}`,
    moderator: String(req.body?.moderator || 'Moderator'),
    timestamp: new Date().toISOString()
  });
  saveState();
  res.json({ ok: true });
});
app.get('/api/forum/moderation-logs', (_req, res) => res.json(responseCollection(state.forum.moderationLogs)));
app.get('/api/forum/notifications', (req, res) => {
  const sessionUser = requireSessionUser(req);
  const notifications = state.forum.notifications.filter(notification => !notification.userId || !sessionUser || String(notification.userId) === String(sessionUser.id));
  res.json(responseCollection(notifications));
});
app.post('/api/forum/notifications/read-all', (req, res) => {
  const sessionUser = requireSessionUser(req);
  state.forum.notifications = state.forum.notifications.map(notification => {
    if (!notification.userId || !sessionUser || String(notification.userId) === String(sessionUser.id)) {
      return { ...notification, read: true };
    }
    return notification;
  });
  saveState();
  res.json({ ok: true });
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
});
