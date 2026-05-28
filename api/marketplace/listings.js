import { readCollection, writeCollection } from '../_lib/db.js';
export default async function handler(req, res) {
  if (req.method === 'GET') return res.json(await readCollection('marketplace.listings'));
  if (req.method === 'POST') return res.status(201).json(await writeCollection('marketplace.listings', req.body || {}));
  res.status(405).json({ error: 'Method not allowed' });
}
