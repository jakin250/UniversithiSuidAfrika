const { kv } = require("@vercel/kv");
const { requireUser } = require("../_lib/auth");

const POSTS_KEY = "forum:posts";
const MAX_RETURN = 100;

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const raw = await kv.lrange(POSTS_KEY, 0, MAX_RETURN - 1);
      const posts = (raw || []).map((item) => (typeof item === "string" ? JSON.parse(item) : item));
      return res.status(200).json({ posts });
    }

    if (req.method === "POST") {
      const session = await requireUser(req, res);
      if (!session) return;

      const { title, body, tag, tagType } = req.body || {};
      const cleanTitle = String(title || "").trim();
      const cleanBody = String(body || "").trim();
      if (!cleanTitle || !cleanBody) return res.status(400).json({ error: "Title and body are required" });

      const post = {
        id: Date.now(),
        title: cleanTitle,
        body: cleanBody,
        tag: String(tag || "General"),
        tagType: String(tagType || "general"),
        author: `u/${session.user.name}`,
        time: new Date().toISOString(),
        votes: 1,
        comments: 0,
        userVote: 0,
      };

      await kv.lpush(POSTS_KEY, JSON.stringify(post));
      return res.status(200).json({ post });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
};

