import { readCollection, writeCollection } from '../_lib/db.js';
export default async function handler(req, res) {
  if (req.method === 'GET') return res.json(await readCollection('forum.posts'));
  if (req.method === 'POST') return res.status(201).json(await writeCollection('forum.posts', req.body || {}));
  res.status(405).json({ error: 'Method not allowed' });
}
