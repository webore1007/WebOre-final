import { getCollection, setCollection, nextId, nowIso, ensureSeeded } from "./utils/store.js";
import { json, errorResponse, parseBody, preflight } from "./utils/http.js";

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return preflight();
  if (event.httpMethod !== "POST") return errorResponse(405, "Method not allowed.");

  await ensureSeeded();

  const { name, email, subject, message } = parseBody(event);
  if (!name || !email || !message) {
    return errorResponse(400, "Name, email, and message are required.");
  }

  const messages = await getCollection("contact_messages");
  messages.unshift({
    id: await nextId("contact_messages"),
    name,
    email,
    subject: subject || null,
    message,
    status: "new",
    created_at: nowIso(),
  });
  await setCollection("contact_messages", messages);

  return json(201, { ok: true });
};
