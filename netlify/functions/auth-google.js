import { getObject, ensureSeeded } from "./utils/store.js";
import { signToken, publicUser } from "./utils/auth.js";
import { findOrCreateOauthUser } from "./utils/oauth.js";
import { recordLogin } from "./utils/login-history.js";
import { json, errorResponse, parseBody, preflight } from "./utils/http.js";

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return preflight();
  if (event.httpMethod !== "POST") return errorResponse(405, "Method not allowed.");

  await ensureSeeded();

  const { credential } = parseBody(event);
  if (!credential) return errorResponse(400, "Missing Google credential.");

  try {
    // Lightweight verification via Google's tokeninfo endpoint — no extra
    // dependency needed, same approach the original server used.
    const verifyRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );
    if (!verifyRes.ok) throw new Error("invalid token");
    const payload = await verifyRes.json();

    const settings = await getObject("site_settings", {});
    const expectedClientId = settings.google_client_id || process.env.GOOGLE_CLIENT_ID;
    if (expectedClientId && payload.aud !== expectedClientId) {
      return errorResponse(401, "Google sign-in is not configured for this site.");
    }
    if (!["accounts.google.com", "https://accounts.google.com"].includes(payload.iss)) {
      throw new Error("invalid issuer");
    }

    const user = await findOrCreateOauthUser({
      provider: "google",
      oauthId: payload.sub,
      email: payload.email,
      name: payload.name,
    });

    await recordLogin(event, { userId: user.id, email: user.email, role: user.role, success: true });
    const token = signToken(user);
    return json(200, { token, user: publicUser(user) });
  } catch {
    return errorResponse(401, "Could not verify Google sign-in. Please try again.");
  }
};
