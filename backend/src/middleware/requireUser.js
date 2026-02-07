const jwt = require("jsonwebtoken");

module.exports = function requireUser(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing Authorization header." });
  }

  const token = header.slice(7).trim();
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = { id: payload.sub, role: payload.role, isVerified: payload.isVerified };
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
};
