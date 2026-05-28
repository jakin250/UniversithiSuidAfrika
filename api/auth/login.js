import { loginUser, setSessionCookie } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const user = await loginUser({ email, password });
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });
  res.setHeader('Set-Cookie', setSessionCookie(String(user.id)));
  res.json({ user });
}
