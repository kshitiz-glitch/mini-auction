// backend/src/auth.js
import jwt from "jsonwebtoken";

/**
 * Create a JWT for a user record
 */
export function signToken(user, secret, expiresIn = "2h") {
  const payload = { id: user.id, handle: user.handle };
  return jwt.sign(payload, secret, { expiresIn });
}

/**
 * Best-effort auth: if Authorization: Bearer <token> is present,
 * verify it and set req.user; otherwise continue unauthenticated.
 */
export function authenticate(secret) {
  return (req, _res, next) => {
    try {
      const hdr = req.headers.authorization || req.headers.Authorization;
      if (!hdr || !hdr.startsWith("Bearer ")) return next();
      const token = hdr.slice("Bearer ".length).trim();
      const payload = jwt.verify(token, secret);
      req.user = { id: payload.id, handle: payload.handle };
    } catch {
      // ignore invalid/expired token; route guards will enforce when needed
    }
    next();
  };
}

/**
 * Hard auth: require a logged-in user (req.user must be set).
 */
export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  next();
}
