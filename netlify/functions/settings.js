import { getObject, setObject, ensureSeeded } from "./utils/store.js";
import { requireAdmin } from "./utils/auth.js";
import { json, errorResponse, parseBody, preflight, segments } from "./utils/http.js";

// Keys any visitor's browser is allowed to see (needed to render the public
// site: OAuth client IDs, contact info, social links, SEO defaults, etc.)
// Anything else (admin-only) never leaves the function.
const PUBLIC_KEYS = [
  "site_name",
  "tagline",
  "contact_email",
  "contact_phone",
  "social_twitter",
  "social_instagram",
  "social_linkedin",
  "social_github",
  "seo_default_title",
  "seo_default_description",
  "maintenance_mode",
  "maintenance_message",
  "google_client_id",
  "facebook_app_id",
  "ga_measurement_id",
];

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return preflight();

  await ensureSeeded();

  const parts = segments(event, "settings"); // [] | ["public"]
  const method = event.httpMethod;

  // GET /settings/public -> the safe subset, no auth required
  if (method === "GET" && parts.length === 1 && parts[0] === "public") {
    const all = await getObject("site_settings", {});
    const out = {};
    for (const k of PUBLIC_KEYS) out[k] = all[k] ?? "";
    return json(200, { settings: out });
  }

  // GET /settings -> admin: full settings object
  if (method === "GET" && parts.length === 0) {
    const auth = requireAdmin(event);
    if (auth.error) return auth.error;
    const all = await getObject("site_settings", {});
    return json(200, { settings: all });
  }

  // PATCH /settings -> admin: update one or more settings at once
  if (method === "PATCH" && parts.length === 0) {
    const auth = requireAdmin(event);
    if (auth.error) return auth.error;

    const body = parseBody(event);
    const all = await getObject("site_settings", {});
    for (const [key, value] of Object.entries(body)) {
      all[key] = value == null ? "" : String(value);
    }
    await setObject("site_settings", all);
    return json(200, { settings: all });
  }

  return errorResponse(404, "Not found.");
};
