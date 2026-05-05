import jwt from "jsonwebtoken";
import User from "../models/User.js";

/* ------------------------------------------------------------- */
/* JWT helpers                                                    */
/* ------------------------------------------------------------- */

/**
 * Create a signed JWT for a given user.
 * Returns the token string (does not set any cookies by itself).
 */
export function issueJwt(user, { expiresIn = "7d" } = {}) {
  const id = String(user?.id || user?._id || "");
  if (!id) throw new Error("Cannot issue token: missing user id");
  return jwt.sign(
    { id, role: user?.role || undefined },
    process.env.JWT_SECRET,
    { expiresIn }
  );
}

/**
 * Set the HttpOnly auth cookie named "token".
 */
export function setAuthCookie(res, token, { days = 7 } = {}) {
  const maxAgeMs = days * 24 * 60 * 60 * 1000;
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: maxAgeMs,
    path: "/",
  });
}

/**
 * Clear the HttpOnly auth cookie.
 */
export function clearAuthCookie(res) {
  res.clearCookie("token", { path: "/" });
}

/* ------------------------------------------------------------- */
/* Strict auth: blocks if no/invalid token.                       */
/* ------------------------------------------------------------- */
export async function authRequired(req, res, next) {
  try {
    const token = readToken(req);
    if (!token)
      return res
        .status(401)
        .json({ status: "error", message: "Auth required" });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id).lean();
    if (!user)
      return res
        .status(401)
        .json({ status: "error", message: "Invalid user" });

    req.user = { ...user, id: String(user._id) };
    next();
  } catch (e) {
    return res
      .status(401)
      .json({ status: "error", message: "Invalid token" });
  }
}

/* ------------------------------------------------------------- */
/* Soft auth: attach req.user if token is present; else continue. */
/* Use on public GETs where filtering depends on viewer role.     */
/* ------------------------------------------------------------- */
export async function attachUserIfPresent(req, _res, next) {
  try {
    const token = readToken(req);
    if (!token) return next();

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id).lean();
    if (user) req.user = { ...user, id: String(user._id) };
  } catch {
    // ignore invalid token on soft auth
  }
  next();
}

/* ------------------------------------------------------------- */
/* NEW: optionalAuth                                              */
/* Allows requests with or without a token                       */
/* If token exists → attach req.user                              */
/* If no token → continue normally                                */
/* ------------------------------------------------------------- */
export async function optionalAuth(req, _res, next) {
  try {
    const token = readToken(req);
    if (!token) return next(); // no login → allow public access

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id).lean();
    if (user) req.user = { ...user, id: String(user._id) };
  } catch {
    // If token invalid → still continue (public mode)
  }
  next();
}

/* ------------------------------------------------------------- */
/* Internal: read token from cookie or Authorization header        */
/* ------------------------------------------------------------- */
function readToken(req) {
  // 1) HttpOnly cookie "token"
  if (req.cookies?.token) return req.cookies.token;

  // 2) Authorization: Bearer <token>
  const h =
    req.headers?.authorization || req.headers?.Authorization;
  if (h && typeof h === "string" && h.startsWith("Bearer "))
    return h.slice(7);

  return null;
}
