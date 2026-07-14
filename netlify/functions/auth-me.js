import { getCollection, ensureSeeded } from "./utils/store.js";
import { requireAuth, publicUser } from "./utils/auth.js";
import { json, errorResponse, preflight } from "./utils/http.js";

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return preflight();
  if (event.httpMethod !== "GET") return errorResponse(405, "Method not allowed.");

  await ensureSeeded();

  const auth = requireAuth(event);
  if (auth.error) return auth.error;

  const users = await getCollection("users");
  const user = users.find((u) => u.id === auth.user.id);
  if (!user) return errorResponse(404, "User not found.");

  return json(200, { user: publicUser(user) });
};
