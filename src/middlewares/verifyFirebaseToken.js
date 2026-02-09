const admin = require("../firebase");

module.exports = async function verifyFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Firebase token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.firebaseUser = decoded; // ✅ TRUSTED SOURCE
    next();
  } catch (err) {
    console.error("Firebase token error:", err);
    return res.status(401).json({ error: "Invalid or expired Firebase token" });
  }
};
