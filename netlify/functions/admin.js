import bcrypt from "bcryptjs";
import { getCollection, setCollection, nextId, nowIso, ensureSeeded, getObject } from "./utils/store.js";
import { requireAdmin } from "./utils/auth.js";
import { json, errorResponse, parseBody, preflight, segments } from "./utils/http.js";

const VALID_ROLES = ["admin", "developer", "customer"];

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return preflight();

  await ensureSeeded();

  const auth = requireAdmin(event);
  if (auth.error) return auth.error;
  const adminUser = auth.user;

  const parts = segments(event, "admin");
  const method = event.httpMethod;

  /* ---------- Dashboard stats ---------- */
  if (method === "GET" && parts.length === 1 && parts[0] === "stats") {
    const [projects, contactMessages] = await Promise.all([
      getCollection("projects"),
      getCollection("contact_messages"),
    ]);
    const users = await getCollection("users");
    const totalUsers = users.filter((u) => u.role === "customer").length;
    const totalProjects = projects.length;
    const newProjects = projects.filter((p) => p.status === "new").length;
    const inProgress = projects.filter((p) => p.status === "in_progress").length;
    const completed = projects.filter((p) => p.status === "completed").length;
    const unreadMessages = contactMessages.filter((m) => m.status === "new").length;

    const byTypeMap = {};
    for (const p of projects) {
      byTypeMap[p.project_type] = (byTypeMap[p.project_type] || 0) + 1;
    }
    const byType = Object.entries(byTypeMap).map(([project_type, count]) => ({ project_type, count }));

    return json(200, { totalUsers, totalProjects, newProjects, inProgress, completed, unreadMessages, byType });
  }

  /* ---------- Users ---------- */
  if (parts[0] === "users") {
    const users = await getCollection("users");

    if (method === "GET" && parts.length === 1) {
      const list = users
        .map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          company: u.company,
          phone: u.phone,
          oauth_provider: u.oauth_provider,
          created_at: u.created_at,
        }))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return json(200, { users: list });
    }

    if (method === "POST" && parts.length === 1) {
      const { name, email, password, role, company, phone } = parseBody(event);
      if (!name || !email || !password) {
        return errorResponse(400, "Name, email, and password are required.");
      }
      if (password.length < 6) {
        return errorResponse(400, "Password must be at least 6 characters.");
      }
      const finalRole = VALID_ROLES.includes(role) ? role : "customer";
      const normalizedEmail = email.toLowerCase();
      if (users.some((u) => u.email === normalizedEmail)) {
        return errorResponse(409, "An account with that email already exists.");
      }

      const user = {
        id: await nextId("users"),
        name,
        email: normalizedEmail,
        password_hash: bcrypt.hashSync(password, 10),
        role: finalRole,
        company: company || null,
        phone: phone || null,
        oauth_provider: null,
        oauth_id: null,
        created_at: nowIso(),
      };
      users.push(user);
      await setCollection("users", users);
      const { password_hash, oauth_id, ...safeUser } = user;
      return json(201, { user: safeUser });
    }

    if (method === "PATCH" && parts.length === 2) {
      const user = users.find((u) => String(u.id) === parts[1]);
      if (!user) return errorResponse(404, "User not found.");

      const { name, role, company, phone } = parseBody(event);
      if (role && !VALID_ROLES.includes(role)) {
        return errorResponse(400, "Invalid role.");
      }
      if (role === "customer" && user.role === "admin" && adminUser.id === user.id) {
        return errorResponse(400, "You can't demote your own account.");
      }

      user.name = name ?? user.name;
      user.role = role ?? user.role;
      user.company = company ?? user.company;
      user.phone = phone ?? user.phone;
      await setCollection("users", users);

      const { password_hash, oauth_id, ...safeUser } = user;
      return json(200, { user: safeUser });
    }

    if (method === "DELETE" && parts.length === 2) {
      if (String(adminUser.id) === parts[1]) {
        return errorResponse(400, "You can't delete your own account.");
      }
      const next = users.filter((u) => String(u.id) !== parts[1]);
      await setCollection("users", next);
      return json(200, { ok: true });
    }
  }

  /* ---------- Project requests (admin view) ---------- */
  if (parts[0] === "projects") {
    const [projects, users] = await Promise.all([getCollection("projects"), getCollection("users")]);

    if (method === "GET" && parts.length === 1) {
      const usersById = new Map(users.map((u) => [u.id, u]));
      const list = projects
        .map((p) => {
          const owner = usersById.get(p.user_id);
          return { ...p, customer_name: owner?.name || "", customer_email: owner?.email || "" };
        })
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return json(200, { projects: list });
    }

    if (method === "PATCH" && parts.length === 2) {
      const project = projects.find((p) => String(p.id) === parts[1]);
      if (!project) return errorResponse(404, "Project not found.");

      const { status, admin_notes } = parseBody(event);
      project.status = status ?? project.status;
      project.admin_notes = admin_notes ?? project.admin_notes;
      project.updated_at = nowIso();
      await setCollection("projects", projects);
      return json(200, { project });
    }

    if (method === "DELETE" && parts.length === 2) {
      const next = projects.filter((p) => String(p.id) !== parts[1]);
      await setCollection("projects", next);
      return json(200, { ok: true });
    }
  }

  /* ---------- Contact inbox ---------- */
  if (parts[0] === "messages") {
    const messages = await getCollection("contact_messages");

    if (method === "GET" && parts.length === 1) {
      const list = [...messages].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return json(200, { messages: list });
    }

    if (method === "PATCH" && parts.length === 2) {
      const message = messages.find((m) => String(m.id) === parts[1]);
      if (!message) return errorResponse(404, "Message not found.");
      const { status } = parseBody(event);
      message.status = status || "read";
      await setCollection("contact_messages", messages);
      return json(200, { ok: true });
    }

    if (method === "DELETE" && parts.length === 2) {
      const next = messages.filter((m) => String(m.id) !== parts[1]);
      await setCollection("contact_messages", next);
      return json(200, { ok: true });
    }
  }

  /* ---------- Security ---------- */
  if (parts[0] === "security") {
    if (method === "GET" && parts[1] === "login-history") {
      const history = await getCollection("login_history");
      const list = [...history].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 200);
      return json(200, { history: list });
    }

    if (method === "POST" && parts[1] === "change-password") {
      const { currentPassword, newPassword } = parseBody(event);
      if (!newPassword || newPassword.length < 6) {
        return errorResponse(400, "New password must be at least 6 characters.");
      }
      const users = await getCollection("users");
      const user = users.find((u) => u.id === adminUser.id);
      if (!user) return errorResponse(404, "User not found.");

      if (user.password_hash) {
        if (!currentPassword || !bcrypt.compareSync(currentPassword, user.password_hash)) {
          return errorResponse(401, "Current password is incorrect.");
        }
      }
      user.password_hash = bcrypt.hashSync(newPassword, 10);
      await setCollection("users", users);
      return json(200, { ok: true });
    }

    // A full JSON export of every stored collection, standing in for the
    // old "download the SQLite file" backup — there's no single database
    // file anymore since data lives in Netlify Blobs, so a JSON dump is the
    // closest equivalent snapshot an admin can keep offline.
    if (method === "GET" && parts[1] === "backup") {
      const [
        users,
        projects,
        project_messages,
        contact_messages,
        portfolio_items,
        media,
        blog_posts,
        login_history,
        page_views,
      ] = await Promise.all([
        getCollection("users"),
        getCollection("projects"),
        getCollection("project_messages"),
        getCollection("contact_messages"),
        getCollection("portfolio_items"),
        getCollection("media"),
        getCollection("blog_posts"),
        getCollection("login_history"),
        getCollection("page_views"),
      ]);
      const [site_settings, pages] = await Promise.all([getObject("site_settings", {}), getObject("pages", {})]);

      const backup = {
        generated_at: nowIso(),
        users: users.map(({ password_hash, ...rest }) => rest),
        projects,
        project_messages,
        contact_messages,
        portfolio_items,
        media,
        blog_posts,
        login_history,
        page_views,
        site_settings,
        pages,
      };

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="webore-backup-${new Date().toISOString().slice(0, 10)}.json"`,
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify(backup, null, 2),
      };
    }
  }

  /* ---------- Deploy status (informational) ---------- */
  if (method === "GET" && parts[0] === "deploy" && parts[1] === "status") {
    return json(200, {
      commit: process.env.COMMIT_REF ? process.env.COMMIT_REF.slice(0, 7) : "unknown",
      branch: process.env.BRANCH || "unknown",
      nodeVersion: process.version,
      uptimeSeconds: Math.round(process.uptime()),
      startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
      environment: process.env.CONTEXT || process.env.NODE_ENV || "production",
    });
  }

  return errorResponse(404, "Not found.");
};
