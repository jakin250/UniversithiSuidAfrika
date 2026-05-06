const { isStudentEmail, normalizeEmail, getUserByEmail, verifyPassword, createSession } = require("../_lib/auth");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { email, password } = req.body || {};
    const normalized = normalizeEmail(email);

    if (!isStudentEmail(normalized)) return res.status(400).json({ error: "Valid student email required" });
    if (!password) return res.status(400).json({ error: "Password is required" });

    const user = await getUserByEmail(normalized);
    if (!user) return res.status(404).json({ error: "Account not found. Please register." });

    const ok = await verifyPassword(user, password);
    if (!ok) return res.status(401).json({ error: "Invalid email or password" });

    const token = await createSession(user);
    return res.status(200).json({ token, user: { id: user.id, email: user.email, name: user.name, university: user.university, verified: user.verified } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
};
