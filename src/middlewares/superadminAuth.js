const jwt = require("jsonwebtoken");

function superadminAuth(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  jwt.verify(token, process.env.ACCESS_TOKEN_SUPER, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });

    // req.user = decoded; // optional
    next();
  });
}

module.exports = superadminAuth;
