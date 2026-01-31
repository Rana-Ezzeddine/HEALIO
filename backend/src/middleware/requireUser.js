function requireUser(req, res, next) {
  const userId = req.header("x-user-id");
  if (!userId) return res.status(401).json({ message: "Missing x-user-id header" });

  req.userId = userId;
  next();
}

module.exports = requireUser;