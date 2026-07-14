import { getCollection, setCollection, nextId, nowIso, ensureSeeded } from "./utils/store.js";
import { requireAdmin } from "./utils/auth.js";
import { json, noContent, errorResponse, parseBody, preflight, segments, clientIp, userAgent } from "./utils/http.js";

// Keep stored page views from growing forever.
const MAX_STORED = 20000;

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return preflight();

  await ensureSeeded();

  const parts = segments(event, "analytics"); // ["pageview"] | ["summary"]
  const method = event.httpMethod;

  // POST /analytics/pageview -> public, deliberately tiny (no cookies/fingerprinting)
  if (method === "POST" && parts[0] === "pageview") {
    const { path: pagePath, referrer } = parseBody(event);
    if (!pagePath || typeof pagePath !== "string" || pagePath.length > 300) {
      return noContent();
    }
    const views = await getCollection("page_views");
    views.unshift({
      id: await nextId("page_views"),
      path: pagePath.slice(0, 300),
      referrer: (referrer || "").slice(0, 300),
      user_agent: userAgent(event),
      ip: clientIp(event),
      created_at: nowIso(),
    });
    await setCollection("page_views", views.slice(0, MAX_STORED));
    return noContent();
  }

  // GET /analytics/summary -> admin only
  if (method === "GET" && parts[0] === "summary") {
    const auth = requireAdmin(event);
    if (auth.error) return auth.error;

    const views = await getCollection("page_views");
    const now = Date.now();
    const last7Cutoff = now - 7 * 24 * 60 * 60 * 1000;
    const last30Cutoff = now - 30 * 24 * 60 * 60 * 1000;
    const last14Cutoff = now - 14 * 24 * 60 * 60 * 1000;

    const totalViews = views.length;
    const last7 = views.filter((v) => new Date(v.created_at).getTime() >= last7Cutoff).length;
    const last30 = views.filter((v) => new Date(v.created_at).getTime() >= last30Cutoff).length;

    const last30Views = views.filter((v) => new Date(v.created_at).getTime() >= last30Cutoff);

    const pageCounts = {};
    for (const v of last30Views) pageCounts[v.path] = (pageCounts[v.path] || 0) + 1;
    const topPages = Object.entries(pageCounts)
      .map(([path, views]) => ({ path, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    const referrerCounts = {};
    for (const v of last30Views) {
      const key = v.referrer && v.referrer.trim() ? v.referrer : "Direct / unknown";
      referrerCounts[key] = (referrerCounts[key] || 0) + 1;
    }
    const topReferrers = Object.entries(referrerCounts)
      .map(([referrer, c]) => ({ referrer, c }))
      .sort((a, b) => b.c - a.c)
      .slice(0, 8);

    const last14Views = views.filter((v) => new Date(v.created_at).getTime() >= last14Cutoff);
    const dayCounts = {};
    for (const v of last14Views) {
      const day = v.created_at.slice(0, 10);
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    }
    const byDay = Object.entries(dayCounts)
      .map(([day, views]) => ({ day, views }))
      .sort((a, b) => a.day.localeCompare(b.day));

    return json(200, { totalViews, last7, last30, topPages, byDay, topReferrers });
  }

  return errorResponse(404, "Not found.");
};
