import { getCollection, setCollection, nextId, nowIso, ensureSeeded } from "./utils/store.js";
import { requireAdmin } from "./utils/auth.js";
import { json, errorResponse, parseBody, preflight, segments } from "./utils/http.js";

function slugify(str) {
  return (
    String(str)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || `post-${Date.now()}`
  );
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return preflight();

  await ensureSeeded();

  const parts = segments(event, "blog"); // [] | [":slug"] | ["admin"] | ["admin",":id"]
  const method = event.httpMethod;

  /* ---------- Admin (protected) ---------- */
  if (parts[0] === "admin") {
    const auth = requireAdmin(event);
    if (auth.error) return auth.error;

    const posts = await getCollection("blog_posts");

    if (method === "GET" && parts.length === 1) {
      const list = [...posts].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      return json(200, { posts: list });
    }

    if (method === "POST" && parts.length === 1) {
      const { title, excerpt, content, cover_image, status, slug: requestedSlug } = parseBody(event);
      if (!title) return errorResponse(400, "Title is required.");

      let slug = slugify(requestedSlug || title);
      if (posts.some((p) => p.slug === slug)) {
        slug = `${slug}-${Date.now().toString().slice(-5)}`;
      }

      const finalStatus = status === "published" ? "published" : "draft";
      const post = {
        id: await nextId("blog_posts"),
        title,
        slug,
        excerpt: excerpt || null,
        content: content || null,
        cover_image: cover_image || null,
        status: finalStatus,
        author_id: auth.user.id,
        created_at: nowIso(),
        updated_at: nowIso(),
        published_at: finalStatus === "published" ? nowIso() : null,
      };
      posts.push(post);
      await setCollection("blog_posts", posts);
      return json(201, { post });
    }

    if (method === "PATCH" && parts.length === 2) {
      const post = posts.find((p) => String(p.id) === parts[1]);
      if (!post) return errorResponse(404, "Post not found.");

      const { title, excerpt, content, cover_image, status } = parseBody(event);
      const nextStatus = status && ["draft", "published"].includes(status) ? status : post.status;
      const justPublished = nextStatus === "published" && post.status !== "published";

      post.title = title ?? post.title;
      post.excerpt = excerpt ?? post.excerpt;
      post.content = content ?? post.content;
      post.cover_image = cover_image ?? post.cover_image;
      post.status = nextStatus;
      post.updated_at = nowIso();
      post.published_at = justPublished ? nowIso() : post.published_at;

      await setCollection("blog_posts", posts);
      return json(200, { post });
    }

    if (method === "DELETE" && parts.length === 2) {
      const next = posts.filter((p) => String(p.id) !== parts[1]);
      await setCollection("blog_posts", next);
      return json(200, { ok: true });
    }

    return errorResponse(404, "Not found.");
  }

  /* ---------- Public ---------- */
  const posts = await getCollection("blog_posts");

  if (method === "GET" && parts.length === 0) {
    const published = posts
      .filter((p) => p.status === "published")
      .map(({ id, title, slug, excerpt, cover_image, published_at }) => ({
        id,
        title,
        slug,
        excerpt,
        cover_image,
        published_at,
      }))
      .sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
    return json(200, { posts: published });
  }

  if (method === "GET" && parts.length === 1) {
    const post = posts.find((p) => p.slug === parts[0] && p.status === "published");
    if (!post) return errorResponse(404, "Post not found.");
    return json(200, { post });
  }

  return errorResponse(404, "Not found.");
};
