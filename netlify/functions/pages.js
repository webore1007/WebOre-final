import { getObject, setObject, nowIso, ensureSeeded } from "./utils/store.js";
import { requireAdmin } from "./utils/auth.js";
import { json, errorResponse, parseBody, preflight, segments } from "./utils/http.js";

const ALLOWED_SLUGS = ["home", "about", "services", "contact"];

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return preflight();

  await ensureSeeded();

  const parts = segments(event, "pages"); // [] | [":slug"]
  const method = event.httpMethod;

  // GET /pages -> admin: list every editable page
  if (method === "GET" && parts.length === 0) {
    const auth = requireAdmin(event);
    if (auth.error) return auth.error;
    const pages = await getObject("pages", {});
    const list = ALLOWED_SLUGS.map((slug) => pages[slug]).filter(Boolean).sort((a, b) => a.slug.localeCompare(b.slug));
    return json(200, { pages: list });
  }

  // GET /pages/:slug -> public: one page's editable content
  if (method === "GET" && parts.length === 1) {
    if (!ALLOWED_SLUGS.includes(parts[0])) return errorResponse(404, "Unknown page.");
    const pages = await getObject("pages", {});
    const page = pages[parts[0]];
    if (!page) return errorResponse(404, "Page not found.");
    return json(200, { page });
  }

  // PATCH /pages/:slug -> admin: update a page's editable fields
  if (method === "PATCH" && parts.length === 1) {
    if (!ALLOWED_SLUGS.includes(parts[0])) return errorResponse(404, "Unknown page.");
    const auth = requireAdmin(event);
    if (auth.error) return auth.error;

    const pages = await getObject("pages", {});
    const page = pages[parts[0]];
    if (!page) return errorResponse(404, "Page not found.");

    const { title, hero_title, hero_subtitle, body_html, meta_title, meta_description } = parseBody(event);
    pages[parts[0]] = {
      ...page,
      title: title ?? page.title,
      hero_title: hero_title ?? page.hero_title,
      hero_subtitle: hero_subtitle ?? page.hero_subtitle,
      body_html: body_html ?? page.body_html,
      meta_title: meta_title ?? page.meta_title,
      meta_description: meta_description ?? page.meta_description,
      updated_at: nowIso(),
    };
    await setObject("pages", pages);
    return json(200, { page: pages[parts[0]] });
  }

  return errorResponse(404, "Not found.");
};
