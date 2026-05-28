import { readCollection } from '../../_lib/db.js';

export default async function handler(req, res) {
  const books = await readCollection('bookstore.books');
  const book = books.find(item => String(item.id) === String(req.query.id));
  if (!book) return res.status(404).json({ error: 'Book not found' });
  res.json(book);
}
