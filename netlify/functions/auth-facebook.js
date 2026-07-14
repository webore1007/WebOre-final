import { ensureSeeded } from "./utils/store.js";
import { signToken, publicUser } from "./utils/auth.js";
import { findOrCreateOauthUser } from "./utils/oauth.js";
import { recordLogin } from "./utils/login-history.js";
import { json, errorResponse, parseBody, preflight } from "./utils/http.js";

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return preflight();
  if (event.httpMethod !== "POST") return errorResponse(405, "Method not allowed.");

  await ensureSeeded();

  const { accessToken } = parseBody(event);
  if (!accessToken) return errorResponse(400, "Missing Facebook access token.");

  try {
    const profileRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(accessToken)}`
    );
    if (!profileRes.ok) throw new Error("invalid token");
    const profile = await profileRes.json();
    if (!profile.id) throw new Error("invalid profile");

    const user = await findOrCreateOauthUser({
      provider: "facebook",
      oauthId: profile.id,
      email: profile.email,
      name: profile.name,
    });

    await recordLogin(event, { userId: user.id, email: user.email, role: user.role, success: true });
    const token = signToken(user);
    return json(200, { token, user: publicUser(user) });
  } catch {
    return errorResponse(401, "Could not verify Facebook sign-in. Please try again.");
  }
};
