import bcrypt from "bcryptjs";
import { getCollection, setCollection, nextId, nowIso, ensureSeeded } from "./utils/store.js";
import { signToken, publicUser } from "./utils/auth.js";
import { json, errorResponse, parseBody, preflight } from "./utils/http.js";

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return preflight();
  if (event.httpMethod !== "POST") return errorResponse(405, "Method not allowed.");

  await ensureSeeded();

  const { name, email, password, company, phone } = parseBody(event);

  if (!name || !email || !password) {
    return errorResponse(400, "Name, email, and password are required.");
  }
  if (password.length < 6) {
    return errorResponse(400, "Password must be at least 6 characters.");
  }

  const users = await getCollection("users");
  const normalizedEmail = email.toLowerCase();
  if (users.some((u) => u.email === normalizedEmail)) {
    return errorResponse(409, "An account with that email already exists.");
  }

  const user = {
    id: await nextId("users"),
    name,
    email: normalizedEmail,
    password_hash: bcrypt.hashSync(password, 10),
    role: "customer",
    company: company || null,
    phone: phone || null,
    oauth_provider: null,
    oauth_id: null,
    created_at: nowIso(),
  };
  users.push(user);
  await setCollection("users", users);

  const token = signToken(user);
  return json(201, { token, user: publicUser(user) });
};
