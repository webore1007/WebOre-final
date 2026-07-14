/**
 * Shared HTTP helpers for every Netlify Function in this project.
 *
 * Netlify Functions receive a plain `event` object (method, path, headers,
 * body) and must return a plain `{ statusCode, headers, body }` object —
 * there's no Express `req`/`res` here. These helpers keep that boilerplate
 * (JSON responses, CORS headers, reading the sub-path after the function
 * name) in one place instead of repeating it in every function file.
 */

// The frontend is served from the same Netlify site as the functions, so
// CORS isn't strictly required — but these headers are cheap, safe, and
// make local testing (e.g. hitting a function URL directly) painless.
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

/** Build a JSON Netlify Function response. */
export function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS, ...extraHeaders },
    body: JSON.stringify(body),
  };
}

/** A successful response with no body (e.g. after a DELETE). */
export function noContent() {
  return { statusCode: 204, headers: CORS_HEADERS, body: "" };
}

/** Standard response for a CORS preflight (OPTIONS) request. */
export function preflight() {
  return { statusCode: 204, headers: CORS_HEADERS, body: "" };
}

/** Convenience wrapper for `json(status, { error: message })`. */
export function errorResponse(statusCode, message) {
  return json(statusCode, { error: message });
}

/** Safely parse a JSON request body; returns {} if missing/invalid. */
export function parseBody(event) {
  if (!event.body) return {};
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

/**
 * Netlify invokes a function for its own path AND any sub-path beneath it
 * (e.g. a request to /.netlify/functions/admin/users/5 still invokes the
 * "admin" function), with the full path available on `event.path`. This
 * strips the "/.netlify/functions/<fnName>" prefix (and the "/api/<fnName>"
 * form used by the optional redirect in netlify.toml) so each function can
 * do simple routing based on what's left, e.g. "/users/5".
 */
export function subPath(event, fnName) {
  let p = event.path || "/";
  const prefixes = [`/.netlify/functions/${fnName}`, `/api/${fnName}`];
  for (const prefix of prefixes) {
    if (p.startsWith(prefix)) {
      p = p.slice(prefix.length);
      break;
    }
  }
  if (!p.startsWith("/")) p = `/${p}`;
  return p;
}

/** Same as subPath(), split into non-empty segments, e.g. ["users", "5"]. */
export function segments(event, fnName) {
  return subPath(event, fnName)
    .split("/")
    .filter(Boolean);
}

/** Reads the client's IP address from Netlify's forwarding headers. */
export function clientIp(event) {
  const header = event.headers?.["x-forwarded-for"] || event.headers?.["client-ip"] || "";
  return header.split(",")[0].trim();
}

/** Reads the client's User-Agent header, truncated to a sane length. */
export function userAgent(event) {
  return (event.headers?.["user-agent"] || "").slice(0, 300);
}
