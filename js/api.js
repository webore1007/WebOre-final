/* Small fetch wrapper + auth-token helpers. Plain JS, no build step. */

const TOKEN_KEY = "webore_token";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/**
 * Maps the site's old logical "/api/..." style paths onto the Netlify
 * Functions that now serve them (see netlify/functions/*.js). Each Express
 * route file became one Netlify Function; this table mirrors that mapping
 * so every fetch() across the site — whether it goes through api() below or
 * calls fetch() directly — ends up at the right /.netlify/functions/ URL
 * without every call site needing to know the new layout.
 *
 * Order matters: more specific patterns are listed before broader ones.
 */
const FUNCTION_ROUTES = [
  { pattern: /^\/auth\/login$/, fn: "login", strip: /^\/auth\/login/ },
  { pattern: /^\/auth\/signup$/, fn: "signup", strip: /^\/auth\/signup/ },
  { pattern: /^\/auth\/google$/, fn: "auth-google", strip: /^\/auth\/google/ },
  { pattern: /^\/auth\/facebook$/, fn: "auth-facebook", strip: /^\/auth\/facebook/ },
  { pattern: /^\/auth\/me$/, fn: "auth-me", strip: /^\/auth\/me/ },
  { pattern: /^\/contact/, fn: "contact", strip: /^\/contact/ },
  { pattern: /^\/admin\/blog/, fn: "blog", strip: /^\/admin\/blog/, keep: "/admin" },
  { pattern: /^\/admin\/media/, fn: "media", strip: /^\/admin\/media/ },
  { pattern: /^\/admin/, fn: "admin", strip: /^\/admin/ },
  { pattern: /^\/projects/, fn: "dashboard", strip: /^\/projects/ },
  { pattern: /^\/blog/, fn: "blog", strip: /^\/blog/ },
  { pattern: /^\/pages/, fn: "pages", strip: /^\/pages/ },
  { pattern: /^\/portfolio/, fn: "portfolio", strip: /^\/portfolio/ },
  { pattern: /^\/settings/, fn: "settings", strip: /^\/settings/ },
  { pattern: /^\/analytics/, fn: "analytics", strip: /^\/analytics/ },
];

/**
 * Resolves a logical path (the same paths this codebase always used, e.g.
 * "/auth/login", "/admin/projects/5", "/blog/my-post") to the real Netlify
 * Function URL that now serves it, e.g. "/.netlify/functions/login",
 * "/.netlify/functions/admin/projects/5", "/.netlify/functions/blog/my-post".
 */
function apiUrl(path) {
  const clean = path.startsWith("/") ? path : `/${path}`;
  for (const route of FUNCTION_ROUTES) {
    if (route.pattern.test(clean)) {
      const remainder = clean.replace(route.strip, "");
      const kept = route.keep ? route.keep + remainder : remainder;
      return `/.netlify/functions/${route.fn}${kept}`;
    }
  }
  // Fallback: no mapping matched — call the Netlify Function with the same
  // name as the first path segment (keeps this future-proof for any new
  // route added without also updating this table).
  return `/.netlify/functions${clean}`;
}

/**
 * @param {string} path e.g. "/auth/login"
 * @param {RequestInit & { auth?: boolean }} [options]
 */
async function api(path, options = {}) {
  const { auth = true, headers, ...rest } = options;
  const token = getToken();

  const res = await fetch(apiUrl(path), {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    throw new Error((body && body.error) || "Something went wrong. Please try again.");
  }
  return body;
}

/** Reads the current user (if a token is stored) and updates the navbar. */
async function loadCurrentUser() {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await api("/auth/me");
    return res.user;
  } catch {
    setToken(null);
    return null;
  }
}

function logoutUser() {
  setToken(null);
  window.location.href = "index.html";
}
