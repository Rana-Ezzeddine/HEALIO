export default function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: "Not authenticated." });
        }

        const role = req.user.role;

        if (!role || !allowedRoles.includes(role)) {
            return res.status(403).json({ message: "Access denied." });
        }

        return next();
    }
}