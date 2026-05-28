import { readCollection } from '../_lib/db.js';
export default async function handler(_req, res) { res.json(await readCollection('bookstore.books')); }
