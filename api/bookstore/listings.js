import { writeCollection } from '../_lib/db.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  res.status(201).json(await writeCollection('bookstore.listings', req.body || {}));
}
