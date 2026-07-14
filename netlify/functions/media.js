import { getCollection, setCollection, nextId, nowIso, ensureSeeded, setBlobFile, deleteBlobFile } from "./utils/store.js";
import { requireAdmin } from "./utils/auth.js";
import { json, errorResponse, preflight, segments } from "./utils/http.js";
import { parseMultipart, bodyToBuffer } from "./utils/multipart.js";

const ALLOWED_MIME = /^(image\/(png|jpe?g|gif|webp|svg\+xml)|video\/(mp4|webm|quicktime)|application\/pdf)$/;
const MAX_SIZE = 25 * 1024 * 1024; // 25MB

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return preflight();

  await ensureSeeded();

  const auth = requireAdmin(event);
  if (auth.error) return auth.error;

  const parts = segments(event, "media"); // [] | ["upload"] | [":id"]
  const method = event.httpMethod;

  // GET /media -> list uploaded files
  if (method === "GET" && parts.length === 0) {
    const items = await getCollection("media");
    const sorted = [...items].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return json(200, { items: sorted });
  }

  // POST /media/upload -> parse the multipart body and store the file
  if (method === "POST" && parts.length === 1 && parts[0] === "upload") {
    const contentType = event.headers?.["content-type"] || event.headers?.["Content-Type"] || "";
    const buffer = bodyToBuffer(event);

    if (buffer.length > MAX_SIZE) {
      return errorResponse(400, "File is too large (25MB max).");
    }

    const parsed = parseMultipart(buffer, contentType);
    const filePart = parsed.find((p) => p.name === "file" && p.filename);
    if (!filePart) return errorResponse(400, "No file received.");

    if (!ALLOWED_MIME.test(filePart.type || "")) {
      return errorResponse(400, "Unsupported file type.");
    }
    if (filePart.data.length > MAX_SIZE) {
      return errorResponse(400, "File is too large (25MB max).");
    }

    const ext = (filePart.filename.match(/\.[a-zA-Z0-9]+$/) || [""])[0].toLowerCase();
    const safeBase = filePart.filename
      .replace(ext, "")
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .slice(0, 60);
    const filename = `${Date.now()}-${safeBase}${ext}`;

    await setBlobFile(`uploads/${filename}`, filePart.data, filePart.type);

    const items = await getCollection("media");
    const item = {
      id: await nextId("media"),
      filename,
      original_name: filePart.filename,
      url: `/uploads/${filename}`,
      mime_type: filePart.type,
      size: filePart.data.length,
      uploaded_by: auth.user.id,
      created_at: nowIso(),
    };
    items.push(item);
    await setCollection("media", items);

    return json(201, { item });
  }

  // DELETE /media/:id -> remove the stored file + its record
  if (method === "DELETE" && parts.length === 1) {
    const items = await getCollection("media");
    const item = items.find((m) => String(m.id) === parts[0]);
    if (!item) return errorResponse(404, "File not found.");

    await deleteBlobFile(`uploads/${item.filename}`);
    const next = items.filter((m) => String(m.id) !== parts[0]);
    await setCollection("media", next);
    return json(200, { ok: true });
  }

  return errorResponse(404, "Not found.");
};
