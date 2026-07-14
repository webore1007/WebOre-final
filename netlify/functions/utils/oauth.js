/**
 * Finds an existing user for a social sign-in, links a matching
 * email/password account, or creates a brand new user — same logic as
 * findOrCreateOauthUser() in the original server/routes/auth.js.
 */
import { getCollection, setCollection, nextId, nowIso } from "./store.js";

export async function findOrCreateOauthUser({ provider, oauthId, email, name }) {
  const normalizedEmail = (email || "").toLowerCase();
  const users = await getCollection("users");

  let user = users.find((u) => u.oauth_provider === provider && u.oauth_id === oauthId);
  if (user) return user;

  if (normalizedEmail) {
    user = users.find((u) => u.email === normalizedEmail);
  }

  if (user) {
    user.oauth_provider = provider;
    user.oauth_id = oauthId;
    await setCollection("users", users);
    return user;
  }

  const newUser = {
    id: await nextId("users"),
    name: name || "New user",
    email: normalizedEmail || `${provider}_${oauthId}@no-email.webore`,
    password_hash: null,
    role: "customer",
    company: null,
    phone: null,
    oauth_provider: provider,
    oauth_id: oauthId,
    created_at: nowIso(),
  };
  users.push(newUser);
  await setCollection("users", users);
  return newUser;
}
