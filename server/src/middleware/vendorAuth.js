// middleware/auth.js
import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // e.g. { sub: userId, email, role, ... }
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid token" });
  }
}
