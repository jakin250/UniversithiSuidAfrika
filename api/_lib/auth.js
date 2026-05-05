const bcrypt = require("bcryptjs");
const { nanoid } = require("nanoid");
const { kv } = require("@vercel/kv");

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isStudentEmail(email) {
  const value = normalizeEmail(email);
  return /@[^@]+\.(ac\.za|edu|edu\.za)$/i.test(value);
}

function getToken(req) {
  return req.headers["x-session-token"] || "";
}

async function createSession(user) {
  const token = nanoid(32);
  await kv.set(`session:${token}`, { id: user.id, email: user.email, name: user.name }, { ex: SESSION_TTL_SECONDS });
  return token;
}

async function getSession(req) {
  const token = getToken(req);
  if (!token) return null;
  const session = await kv.get(`session:${token}`);
  if (!session) return null;
  return { token, user: session };
}

async function requireUser(req, res) {
  const session = await getSession(req);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return session;
}

async function getUserByEmail(email) {
  const key = `user:${normalizeEmail(email)}`;
  return kv.get(key);
}

async function createUser({ email, password }) {
  const normalized = normalizeEmail(email);
  const passHash = await bcrypt.hash(String(password), 10);
  const user = {
    id: nanoid(16),
    email: normalized,
    name: normalized.split("@")[0],
    passHash,
    createdAt: Date.now(),
  };
  await kv.set(`user:${normalized}`, user);
  return user;
}

async function verifyPassword(user, password) {
  if (!user?.passHash) return false;
  return bcrypt.compare(String(password || ""), user.passHash);
}

module.exports = {
  normalizeEmail,
  isStudentEmail,
  createSession,
  getSession,
  requireUser,
  getUserByEmail,
  createUser,
  verifyPassword,
};

