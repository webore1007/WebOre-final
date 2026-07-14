/**
 * Shared authentication helpers, adapted from the original
 * server/middleware/auth.js — same JWT scheme, just reading the token from
 * a Netlify Function `event` instead of an Express `req`.
 */
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "webore-dev-secret-change-me";

/** Sign a 7-day JWT for a user, same payload shape as the original server. */
export function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

/** Returns the decoded token payload, or null if missing/invalid/expired. */
export function getAuthUser(event) {
  const header = event.headers?.authorization || event.headers?.Authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/**
 * Use at the top of any function that needs a logged-in user:
 *
 *   const auth = requireAuth(event);
 *   if (auth.error) return auth.error;
 *   const user = auth.user;
 */
export function requireAuth(event) {
  const user = getAuthUser(event);
  if (!user) {
    return { error: { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: "Not authenticated." }) } };
  }
  return { user };
}

/** Same as requireAuth(), but also requires role === "admin". */
export function requireAdmin(event) {
  const auth = requireAuth(event);
  if (auth.error) return auth;
  if (auth.user.role !== "admin") {
    return { error: { statusCode: 403, headers: JSON_HEADERS, body: JSON.stringify({ error: "Admins only." }) } };
  }
  return auth;
}

/** Strips the password hash / oauth internals before sending a user to the client. */
export function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    company: u.company,
    phone: u.phone,
    created_at: u.created_at,
  };
}

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};
