/**
 * Data layer for WebOre, backed by Netlify Blobs.
 *
 * The original backend used `node:sqlite` writing to a local `webore.db`
 * file. That does not work on Netlify Functions: each invocation can run in
 * a fresh, isolated, read-only-except-/tmp container, and /tmp itself isn't
 * shared or persisted between invocations — so a file-based database would
 * silently lose data. Netlify Blobs is Netlify's own built-in key/value
 * store (no external database service needed, still "just Netlify"), so
 * it's used here as a drop-in replacement for the SQLite file.
 *
 * Every "table" from the old schema becomes a JSON array stored under one
 * blob key (e.g. "users" -> array of user objects). Reads/writes are
 * whole-collection (read the array, modify it in memory, write it back) —
 * simple and easy to reason about at this app's scale. `nextId()` mimics
 * SQLite's AUTOINCREMENT with a small counters object.
 */
import { getStore } from "@netlify/blobs";
import bcrypt from "bcryptjs";

const STORE_NAME = "webore-data";

function store() {
  // consistency: "strong" avoids reading stale data right after a write,
  // which matters here since a single admin action often writes then
  // immediately re-reads (e.g. update a project, then return it).
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

export function nowIso() {
  return new Date().toISOString();
}

/** Read a collection (array). Returns [] if it doesn't exist yet. */
export async function getCollection(name) {
  const data = await store().get(name, { type: "json" });
  return Array.isArray(data) ? data : [];
}

/** Overwrite a collection (array) in full. */
export async function setCollection(name, arr) {
  await store().setJSON(name, arr);
}

/** Read a plain object blob (used for settings/pages/counters). */
export async function getObject(name, fallback = {}) {
  const data = await store().get(name, { type: "json" });
  return data && typeof data === "object" && !Array.isArray(data) ? data : fallback;
}

/** Overwrite an object blob in full. */
export async function setObject(name, obj) {
  await store().setJSON(name, obj);
}

/** Mimics SQLite's AUTOINCREMENT: returns the next integer id for a collection. */
export async function nextId(collectionName) {
  const counters = await getObject("meta/counters", {});
  const next = (counters[collectionName] || 0) + 1;
  counters[collectionName] = next;
  await setObject("meta/counters", counters);
  return next;
}

/** Store raw bytes (used for uploaded media files) with a content-type. */
export async function setBlobFile(key, buffer, contentType) {
  await store().set(key, buffer, { metadata: { contentType } });
}

/** Read raw bytes + metadata back for an uploaded file. */
export async function getBlobFile(key) {
  const entry = await store().getWithMetadata(key, { type: "arrayBuffer" });
  if (!entry) return null;
  return { data: Buffer.from(entry.data), contentType: entry.metadata?.contentType || "application/octet-stream" };
}

/** Delete a stored file's bytes. */
export async function deleteBlobFile(key) {
  await store().delete(key);
}

/* ---------- first-run seeding (mirrors the old db.js defaults) ---------- */

const DEFAULT_SETTINGS = {
  site_name: "WebOre",
  tagline: "Building Your Digital Presence",
  contact_email: "webore1007@gmail.com",
  contact_phone: "",
  social_twitter: "",
  social_instagram: "",
  social_linkedin: "",
  social_github: "",
  seo_default_title: "WebOre — Building Your Digital Presence",
  seo_default_description: "Websites and digital products, designed and built end to end.",
  maintenance_mode: "0",
  maintenance_message: "We're doing a bit of maintenance. Back shortly.",
  google_client_id: "",
  facebook_app_id: "",
  ga_measurement_id: "",
};

const DEFAULT_PAGES = {
  home: {
    title: "Home",
    hero_title: "WebOre",
    hero_subtitle: "Building Your Digital Presence.",
    meta_title: "WebOre — Building Your Digital Presence",
    meta_description: "Websites and digital products, designed and built end to end.",
  },
  about: {
    title: "About",
    hero_title: "Craft, restraint, precision",
    hero_subtitle:
      "WebOre is a studio for teams who care about the details. We design and build websites the way we'd want ours built — considered, fast, and honest about what it takes to get there.",
    meta_title: "About — WebOre",
    meta_description: "Learn how WebOre designs and builds websites end to end.",
  },
  services: {
    title: "Services",
    hero_title: "What we build",
    hero_subtitle:
      "Websites, digital products, and brand experiences — designed and engineered with the same craftsmanship, end to end.",
    meta_title: "Services — WebOre",
    meta_description: "WebOre's website and digital product packages and pricing.",
  },
  contact: {
    title: "Contact",
    hero_title: "Let's talk",
    hero_subtitle:
      "Tell us about your project and we'll get back to you within one business day — or create an account for a more detailed brief and request tracking.",
    meta_title: "Contact — WebOre",
    meta_description: "Get in touch with WebOre to start your project.",
  },
};

// Cached per warm function instance so repeat invocations in the same
// container don't re-check the flag every time; the "meta/seed-flag" blob
// makes the actual seeding idempotent across cold starts / instances too.
let seedPromise = null;

/** Runs once ever (across the whole site): seeds the admin user, default
 *  settings, and default page content if they don't already exist. Safe to
 *  call at the top of every function — it's a no-op after the first run. */
export async function ensureSeeded() {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    const flag = await getObject("meta/seed-flag", { done: false });
    if (flag.done) return;

    const users = await getCollection("users");
    if (!users.some((u) => u.email === "admin@webore.com")) {
      const id = await nextId("users");
      users.push({
        id,
        name: "WebOre Admin",
        email: "admin@webore.com",
        password_hash: bcrypt.hashSync("Admin@123", 10),
        role: "admin",
        company: "WebOre",
        phone: null,
        oauth_provider: null,
        oauth_id: null,
        created_at: nowIso(),
      });
      await setCollection("users", users);
      // Only ever printed to the function logs, never shown on the public site.
      console.log("Seeded default admin -> admin@webore.com / Admin@123 (change this after first login)");
    }

    const settings = await getObject("site_settings", {});
    let settingsChanged = false;
    const defaultsWithEnv = {
      ...DEFAULT_SETTINGS,
      google_client_id: process.env.GOOGLE_CLIENT_ID || "",
      facebook_app_id: process.env.FACEBOOK_APP_ID || "",
    };
    for (const [key, value] of Object.entries(defaultsWithEnv)) {
      if (!(key in settings)) {
        settings[key] = value;
        settingsChanged = true;
      }
    }
    if (settingsChanged) await setObject("site_settings", settings);

    const pages = await getObject("pages", {});
    let pagesChanged = false;
    for (const [slug, p] of Object.entries(DEFAULT_PAGES)) {
      if (!pages[slug]) {
        pages[slug] = { slug, body_html: "", updated_at: nowIso(), ...p };
        pagesChanged = true;
      }
    }
    if (pagesChanged) await setObject("pages", pages);

    await setObject("meta/seed-flag", { done: true });
  })();
  return seedPromise;
}

export { DEFAULT_SETTINGS, DEFAULT_PAGES };
