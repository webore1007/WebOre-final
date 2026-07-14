import { getCollection, setCollection, nextId, nowIso, ensureSeeded } from "./utils/store.js";
import { requireAuth } from "./utils/auth.js";
import { json, errorResponse, parseBody, preflight, segments } from "./utils/http.js";

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return preflight();

  await ensureSeeded();

  const auth = requireAuth(event);
  if (auth.error) return auth.error;
  const user = auth.user;

  const parts = segments(event, "dashboard"); // [] | ["mine"] | [":id"] | [":id","messages"]

  // POST /dashboard  -> create a new website build request
  if (event.httpMethod === "POST" && parts.length === 0) {
    const {
      business_name,
      industry,
      project_type,
      budget,
      timeline,
      pages_needed,
      features,
      design_style,
      reference_links,
      description,
    } = parseBody(event);

    if (!business_name || !project_type) {
      return errorResponse(400, "Business name and project type are required.");
    }

    const projects = await getCollection("projects");
    const project = {
      id: await nextId("projects"),
      user_id: user.id,
      business_name,
      industry: industry || null,
      project_type,
      budget: budget || null,
      timeline: timeline || null,
      pages_needed: pages_needed || null,
      features: Array.isArray(features) ? features.join(", ") : features || null,
      design_style: design_style || null,
      reference_links: reference_links || null,
      description: description || null,
      status: "new",
      admin_notes: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    projects.push(project);
    await setCollection("projects", projects);
    return json(201, { project });
  }

  // GET /dashboard/mine -> the logged-in customer's own requests
  if (event.httpMethod === "GET" && parts.length === 1 && parts[0] === "mine") {
    const projects = await getCollection("projects");
    const mine = projects
      .filter((p) => p.user_id === user.id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return json(200, { projects: mine });
  }

  // GET /dashboard/:id -> a single project (owner or admin) + its messages
  if (event.httpMethod === "GET" && parts.length === 1) {
    const projects = await getCollection("projects");
    const project = projects.find((p) => String(p.id) === parts[0]);
    if (!project) return errorResponse(404, "Project not found.");
    if (project.user_id !== user.id && user.role !== "admin") {
      return errorResponse(403, "Not allowed.");
    }
    const allMessages = await getCollection("project_messages");
    const messages = allMessages
      .filter((m) => String(m.project_id) === String(project.id))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return json(200, { project, messages });
  }

  // POST /dashboard/:id/messages -> add a message/comment (owner or admin)
  if (event.httpMethod === "POST" && parts.length === 2 && parts[1] === "messages") {
    const projects = await getCollection("projects");
    const project = projects.find((p) => String(p.id) === parts[0]);
    if (!project) return errorResponse(404, "Project not found.");
    if (project.user_id !== user.id && user.role !== "admin") {
      return errorResponse(403, "Not allowed.");
    }

    const { body } = parseBody(event);
    if (!body || !body.trim()) return errorResponse(400, "Message cannot be empty.");

    const allMessages = await getCollection("project_messages");
    allMessages.push({
      id: await nextId("project_messages"),
      project_id: project.id,
      author_role: user.role,
      body: body.trim(),
      created_at: nowIso(),
    });
    await setCollection("project_messages", allMessages);

    project.updated_at = nowIso();
    await setCollection("projects", projects);

    const messages = allMessages
      .filter((m) => String(m.project_id) === String(project.id))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return json(201, { messages });
  }

  return errorResponse(404, "Not found.");
};
