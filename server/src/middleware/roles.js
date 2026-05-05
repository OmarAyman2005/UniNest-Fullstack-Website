// server/src/middleware/role.js
export const requireRole = (...roles) => (req, res, next) => {
  try {
    const role = req.user?.role;
    if (!role || !roles.includes(role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  } catch (e) {
    return res.status(403).json({ message: "Forbidden" });
  }
};
