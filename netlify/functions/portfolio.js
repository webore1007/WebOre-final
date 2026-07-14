import { getCollection, setCollection, nextId, ensureSeeded } from "./utils/store.js";
import { requireAdmin } from "./utils/auth.js";
import { json, errorResponse, parseBody, preflight, segments } from "./utils/http.js";

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return preflight();

  await ensureSeeded();

  const parts = segments(event, "portfolio"); // [] | [":id"]
  const method = event.httpMethod;

  // GET /portfolio -> public: everyone can see the portfolio
  if (method === "GET" && parts.length === 0) {
    const items = await getCollection("portfolio_items");
    const sorted = [...items].sort(
      (a, b) => a.sort_order - b.sort_order || new Date(b.created_at) - new Date(a.created_at)
    );
    return json(200, { items: sorted });
  }

  // Everything else is admin-only.
  const auth = requireAdmin(event);
  if (auth.error) return auth.error;

  const items = await getCollection("portfolio_items");

  if (method === "POST" && parts.length === 0) {
    const { title, description, image_url, project_url, category, featured, sort_order } = parseBody(event);
    if (!title) return errorResponse(400, "Title is required.");

    const item = {
      id: await nextId("portfolio_items"),
      title,
      description: description || null,
      image_url: image_url || null,
      project_url: project_url || null,
      category: category || null,
      featured: featured ? 1 : 0,
      sort_order: Number.isFinite(Number(sort_order)) ? Number(sort_order) : 0,
      created_at: new Date().toISOString(),
    };
    items.push(item);
    await setCollection("portfolio_items", items);
    return json(201, { item });
  }

  if (method === "PATCH" && parts.length === 1) {
    const item = items.find((p) => String(p.id) === parts[0]);
    if (!item) return errorResponse(404, "Portfolio item not found.");

    const { title, description, image_url, project_url, category, featured, sort_order } = parseBody(event);
    item.title = title ?? item.title;
    item.description = description ?? item.description;
    item.image_url = image_url ?? item.image_url;
    item.project_url = project_url ?? item.project_url;
    item.category = category ?? item.category;
    item.featured = featured != null ? (featured ? 1 : 0) : item.featured;
    item.sort_order = sort_order != null && Number.isFinite(Number(sort_order)) ? Number(sort_order) : item.sort_order;

    await setCollection("portfolio_items", items);
    return json(200, { item });
  }

  if (method === "DELETE" && parts.length === 1) {
    const next = items.filter((p) => String(p.id) !== parts[0]);
    await setCollection("portfolio_items", next);
    return json(200, { ok: true });
  }

  return errorResponse(404, "Not found.");
};
