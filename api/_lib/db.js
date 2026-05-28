import { createClient } from '@libsql/client';

const seed = {
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
  }
};

let client = null;
const memory = globalThis.__universithiMemoryDb ||= structuredClone(seed);

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb() {
  if (!client && hasDatabase()) {
    client = createClient({
      url: process.env.DATABASE_URL,
      authToken: process.env.DATABASE_AUTH_TOKEN
    });
  }
  return client;
}

export async function initDb() {
  if (!hasDatabase()) return;
  const db = getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS bookstore_books (id INTEGER PRIMARY KEY, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS bookstore_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS bookstore_reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS bookstore_listings (id INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS marketplace_listings (id INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS marketplace_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS marketplace_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS marketplace_reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS forum_posts (id INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS forum_comments (id INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS forum_groups (id INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT NOT NULL, created_at TEXT NOT NULL);
  `);
}

export function storage() {
  return hasDatabase() ? 'db' : 'memory';
}

export async function readCollection(path) {
  if (!hasDatabase()) {
    const [section, key] = path.split('.');
    return memory[section][key];
  }
  const db = getDb();
  const rows = await db.execute(`SELECT payload FROM ${path.replace('.', '_')} ORDER BY id DESC`);
  return rows.rows.map(row => JSON.parse(row.payload));
}

export async function writeCollection(path, item) {
  const createdAt = item.createdAt || new Date().toISOString();
  if (!hasDatabase()) {
    const [section, key] = path.split('.');
    const payload = { ...item, createdAt };
    memory[section][key].unshift(payload);
    return payload;
  }
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO ${path.replace('.', '_')} (payload, created_at) VALUES (?, ?)`,
    args: [JSON.stringify({ ...item, createdAt }), createdAt]
  });
  return { ...item, createdAt };
}

export async function upsertUser(user) {
  if (!hasDatabase()) {
    memory.users ||= [];
    const existing = memory.users.find(current => current.email === user.email);
    if (existing) return existing;
    const inserted = { id: memory.users.length + 1, ...user, createdAt: new Date().toISOString() };
    memory.users.unshift(inserted);
    return inserted;
  }
  const db = getDb();
  await db.execute({
    sql: 'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?) ON CONFLICT(email) DO UPDATE SET name=excluded.name',
    args: [user.name, user.email, user.password_hash, user.role || 'user']
  });
  const result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [user.email] });
  return result.rows[0] || null;
}

export async function getUserByEmail(email) {
  if (!hasDatabase()) return (memory.users || []).find(user => user.email === email) || null;
  const db = getDb();
  const result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] });
  return result.rows[0] || null;
}

export async function getUserById(id) {
  if (!hasDatabase()) return (memory.users || []).find(user => String(user.id) === String(id)) || null;
  const db = getDb();
  const result = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [id] });
  return result.rows[0] || null;
}
