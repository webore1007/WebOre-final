import bcrypt from "bcryptjs";
import { getCollection, ensureSeeded } from "./utils/store.js";
import { signToken, publicUser } from "./utils/auth.js";
import { recordLogin } from "./utils/login-history.js";
import { json, errorResponse, parseBody, preflight } from "./utils/http.js";

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return preflight();
  if (event.httpMethod !== "POST") return errorResponse(405, "Method not allowed.");

  await ensureSeeded();

  const { email, password } = parseBody(event);
  if (!email || !password) {
    return errorResponse(400, "Email and password are required.");
  }

  const users = await getCollection("users");
  const user = users.find((u) => u.email === email.toLowerCase());

  if (!user || !user.password_hash || !bcrypt.compareSync(password, user.password_hash)) {
    await recordLogin(event, { email: email.toLowerCase(), success: false });
    return errorResponse(401, "Invalid email or password.");
  }

  await recordLogin(event, { userId: user.id, email: user.email, role: user.role, success: true });
  const token = signToken(user);
  return json(200, { token, user: publicUser(user) });
};
