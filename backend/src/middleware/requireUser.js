import jwt from "jsonwebtoken";
import User from "../models/User.js";

export default async function requireUser(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing Authorization header." });
  }

  const token = header.slice(7).trim();
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await User.findByPk(payload.sub, {
      attributes: ["id", "role", "isVerified"],
    });
    if (!user) {
      return res.status(401).json({ message: "User not found. Please log in again." });
    }

    req.user = { id: user.id, role: user.role, isVerified: user.isVerified };
    return next();
  } catch (err) {
    if (err?.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Session expired. Please log in again." });
    }
    return res.status(401).json({ message: "Invalid token. Please log in again." });
  }
};
