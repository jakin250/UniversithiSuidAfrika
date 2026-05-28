import { registerUser, setSessionCookie } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!name || !email || password.length < 8) return res.status(400).json({ error: 'Invalid signup data' });
  const user = await registerUser({ name, email, password });
  res.setHeader('Set-Cookie', setSessionCookie(String(user.id)));
  res.status(201).json({ user });
}
