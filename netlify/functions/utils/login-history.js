/**
 * Records an entry in the shared login_history collection. Used by
 * login.js, auth-google.js, and auth-facebook.js so all three sign-in
 * paths show up together in Admin → Security, exactly like the original
 * server/routes/auth.js's logLogin() helper did for all of them.
 */
import { getCollection, setCollection, nextId, nowIso } from "./store.js";
import { clientIp, userAgent } from "./http.js";

// Keep the stored history from growing forever; the admin UI only ever
// shows the latest 200 anyway (same limit the original SQL query used).
const MAX_STORED = 1000;

export async function recordLogin(event, { userId, email, role, success }) {
  try {
    const history = await getCollection("login_history");
    const id = await nextId("login_history");
    history.unshift({
      id,
      user_id: userId || null,
      email: email || null,
      role: role || null,
      success: success ? 1 : 0,
      ip: clientIp(event),
      user_agent: userAgent(event),
      created_at: nowIso(),
    });
    await setCollection("login_history", history.slice(0, MAX_STORED));
  } catch {
    // Login history is best-effort only — never block a login over it.
  }
}
