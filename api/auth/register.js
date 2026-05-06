const { isStudentEmail, normalizeEmail, getUserByEmail, createUser, createSession } = require("../_lib/auth");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { email, password, name } = req.body || {};
    const normalized = normalizeEmail(email);

    if (!isStudentEmail(normalized)) return res.status(400).json({ error: "Valid student email required" });
    if (!password || String(password).length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

    const existing = await getUserByEmail(normalized);
    if (existing) return res.status(409).json({ error: "Account already exists. Please sign in." });

    const user = await createUser({ email: normalized, password, name });
    const token = await createSession(user);

    return res.status(200).json({ token, user: { id: user.id, email: user.email, name: user.name, university: user.university, verified: user.verified } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
};
