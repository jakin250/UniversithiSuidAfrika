import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getUserByEmail, getUserById, upsertUser } from './db.js';

const cookieName = 'universithi_session';

function secret() {
  return process.env.SESSION_SECRET || 'dev-secret';
}

function sign(value) {
  const signature = crypto.createHmac('sha256', secret()).update(value).digest('base64url');
  return `${value}.${signature}`;
}

function verify(token) {
  if (!token) return null;
  const [value, signature] = token.split('.');
  if (!value || !signature) return null;
  const expected = crypto.createHmac('sha256', secret()).update(value).digest('base64url');
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return null;
  if (!crypto.timingSafeEqual(left, right)) return null;
  return value;
}

export function setSessionCookie(userId) {
  return `${cookieName}=${sign(String(userId))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`;
}

export function clearSessionCookie() {
  return `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function requireUser(req) {
  const cookieHeader = req.headers.cookie || '';
  const token = cookieHeader
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
  const userId = verify(token);
  if (!userId) return null;
  const user = await getUserById(userId);
  if (!user) return null;
  return normalizeUser(user);
}

export function normalizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || 'user',
    createdAt: user.created_at || user.createdAt
  };
}

export async function registerUser({ name, email, password }) {
  const password_hash = bcrypt.hashSync(password, 12);
  const user = await upsertUser({ name, email, password_hash, role: 'user' });
  return normalizeUser(user);
}

export async function loginUser({ email, password }) {
  const user = await getUserByEmail(email);
  if (!user) return null;
  const storedHash = user.password_hash || user.passwordHash;
  if (!bcrypt.compareSync(password, storedHash)) return null;
  return normalizeUser(user);
}
