const { KV, requireUser } = require("./auth");

function parseItems(raw) {
  return (raw || []).map((item) => (typeof item === "string" ? JSON.parse(item) : item));
}

function makeCollectionHandler({ key, required = [], build }) {
  return async function handler(req, res) {
    try {
      if (req.method === "GET") {
        const raw = await KV.lrange(key, 0, 199);
        return res.status(200).json({ items: parseItems(raw) });
      }

      if (req.method === "POST") {
        const session = await requireUser(req, res);
        if (!session) return;

        const body = req.body || {};
        for (const field of required) {
          if (!String(body[field] || "").trim()) {
            return res.status(400).json({ error: `${field} is required` });
          }
        }

        const item = {
          id: Date.now(),
          author: session.user.name,
          authorEmail: session.user.email,
          university: session.user.university || "Student University",
          status: "active",
          createdAt: new Date().toISOString(),
          ...build(body, session),
        };

        await KV.lpush(key, JSON.stringify(item));
        return res.status(200).json({ item });
      }

      return res.status(405).json({ error: "Method not allowed" });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err?.message || "Internal server error" });
    }
  };
}

module.exports = { makeCollectionHandler };
