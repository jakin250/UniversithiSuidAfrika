import { storage } from './_lib/db.js';

export default function handler(_req, res) {
  res.status(200).json({ ok: true, storage: storage() });
}
