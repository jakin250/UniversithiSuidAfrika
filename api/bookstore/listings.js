const { kv } = require("@vercel/kv");
const { requireUser } = require("../_lib/auth");

const LISTINGS_KEY = "bookstore:listings";
const MAX_RETURN = 100;

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    const raw = await kv.lrange(LISTINGS_KEY, 0, MAX_RETURN - 1);
    const listings = (raw || []).map((item) => (typeof item === "string" ? JSON.parse(item) : item));
    return res.status(200).json({ listings });
  }

  if (req.method === "POST") {
    const session = await requireUser(req, res);
    if (!session) return;

    const b = req.body || {};
    const title = String(b.title || "").trim();
    const author = String(b.author || "").trim();
    const price = Number(b.price || 0);

    if (!title || !author || !Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ error: "Title, author, and price are required" });
    }

    const listing = {
      id: Date.now(),
      title,
      author,
      isbn: String(b.isbn || "N/A").trim() || "N/A",
      category: String(b.category || "General").trim() || "General",
      condition: String(b.condition || "good").trim() || "good",
      conditionLabel: String(b.conditionLabel || "").trim() || "Good",
      price,
      originalPrice: Number(b.originalPrice || price),
      imageUrl: String(b.imageUrl || "").trim(),
      seller: session.user.name,
      location: String(b.location || "Campus").trim() || "Campus",
      description: String(b.description || "").trim(),
      createdAt: new Date().toISOString(),
    };

    await kv.lpush(LISTINGS_KEY, JSON.stringify(listing));
    return res.status(200).json({ listing });
  }

  return res.status(405).json({ error: "Method not allowed" });
};

