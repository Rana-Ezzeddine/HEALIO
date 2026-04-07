export default function requireAdmin(req, res, next) {
  if (req.user?.role === "admin") {
    return next();
  }

  return res.status(403).json({
    code: "ADMIN_ACCESS_REQUIRED",
    message: "Admin access is required for this action.",
  });
}
