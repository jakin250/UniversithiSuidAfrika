import { requireUser } from '../_lib/auth.js';

export default async function handler(req, res) {
  const user = await requireUser(req);
  res.json({ user });
}
