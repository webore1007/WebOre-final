/* WebOre admin panel — plain JS, one file, section-by-section. */

const STATUS_LABEL = {
  new: "Received",
  in_review: "In Review",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}
function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}
function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString() : "—";
}
function fmtDateTime(d) {
  return d ? new Date(d).toLocaleString() : "—";
}

/* =========================================================
   Sidebar navigation
   ========================================================= */
const SECTION_LOADERS = {}; // section name -> async function, filled in below as each section is defined
const loadedOnce = new Set();

function showSection(name) {
  document.querySelectorAll(".admin-nav-item").forEach((b) => b.classList.toggle("active", b.dataset.section === name));
  document.querySelectorAll(".admin-section").forEach((s) => s.classList.toggle("active", s.id === `section-${name}`));
  window.location.hash = name;
  if (SECTION_LOADERS[name] && !loadedOnce.has(name)) {
    loadedOnce.add(name);
    SECTION_LOADERS[name]();
  }
}

function initSidebar() {
  document.querySelectorAll(".admin-nav-item").forEach((btn) => {
    btn.addEventListener("click", () => showSection(btn.dataset.section));
  });
  const initial = (window.location.hash || "").replace("#", "");
  showSection(SECTION_LOADERS[initial] ? initial : "dashboard");
}

/* =========================================================
   Dashboard
   ========================================================= */
async function loadStats() {
  try {
    const s = await api("/admin/stats");
    document.getElementById("stat-total").textContent = s.totalProjects;
    document.getElementById("stat-new").textContent = s.newProjects;
    document.getElementById("stat-progress").textContent = s.inProgress;
    document.getElementById("stat-completed").textContent = s.completed;

    const max = Math.max(1, ...s.byType.map((t) => t.count));
    document.getElementById("stat-by-type").innerHTML = s.byType
      .map(
        (t) => `
      <div class="bar-row">
        <span class="name">${escapeHtml(t.project_type)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${(t.count / max) * 100}%"></div></div>
        <span class="bar-count">${t.count}</span>
      </div>`
      )
      .join("");

    const msgCountEl = document.getElementById("nav-count-messages");
    if (s.unreadMessages > 0) {
      msgCountEl.textContent = s.unreadMessages;
      msgCountEl.style.display = "inline-block";
    } else {
      msgCountEl.style.display = "none";
    }
  } catch {
    /* stats are non-critical */
  }
}
SECTION_LOADERS.dashboard = loadStats;

/* =========================================================
   Projects (requests)
   ========================================================= */
let allRequests = [];

function renderRequests() {
  const body = document.getElementById("admin-requests-body");
  if (!allRequests.length) {
    body.innerHTML = `<tr><td colspan="6" class="admin-empty">No requests yet.</td></tr>`;
    return;
  }
  body.innerHTML = allRequests
    .map(
      (p) => `
    <tr>
      <td>${escapeHtml(p.customer_name)}<br><span style="color:rgba(255,255,255,.4);font-size:.75rem;">${escapeHtml(p.customer_email)}</span></td>
      <td>${escapeHtml(p.business_name)}</td>
      <td>${escapeHtml(p.project_type)}</td>
      <td>
        <select class="status-select" data-id="${p.id}" style="background:#000;border:1px solid rgba(255,255,255,.15);color:#fff;border-radius:8px;padding:4px 8px;font-size:.8125rem;">
          ${Object.entries(STATUS_LABEL)
            .map(([val, label]) => `<option value="${val}" ${p.status === val ? "selected" : ""}>${label}</option>`)
            .join("")}
        </select>
      </td>
      <td>${fmtDate(p.created_at)}</td>
      <td><button class="btn-mini" data-detail="${p.id}">Details</button></td>
    </tr>`
    )
    .join("");

  body.querySelectorAll(".status-select").forEach((sel) => {
    sel.addEventListener("change", async () => {
      try {
        await api(`/admin/projects/${sel.dataset.id}`, { method: "PATCH", body: JSON.stringify({ status: sel.value }) });
        const p = allRequests.find((r) => String(r.id) === sel.dataset.id);
        if (p) p.status = sel.value;
        loadStats();
      } catch (err) {
        alert(err.message || "Could not update status.");
      }
    });
  });

  body.querySelectorAll("[data-detail]").forEach((btn) => {
    btn.addEventListener("click", () => renderDetail(btn.dataset.detail));
  });
}

function renderDetail(id) {
  const p = allRequests.find((r) => String(r.id) === String(id));
  const holder = document.getElementById("admin-request-detail");
  if (!p) {
    holder.innerHTML = "";
    return;
  }
  holder.innerHTML = `
    <div class="request-card glass" style="margin-top:20px;">
      <div class="top">
        <h3>${escapeHtml(p.business_name)} — ${escapeHtml(p.customer_name)}</h3>
        <span class="status-badge status-${p.status}">${STATUS_LABEL[p.status] || p.status}</span>
      </div>
      <p class="request-meta">${escapeHtml(p.project_type)} · ${escapeHtml(p.budget || "—")} · ${escapeHtml(p.timeline || "—")} · ${escapeHtml(p.design_style || "—")}</p>
      ${p.pages_needed ? `<p class="request-desc"><strong>Pages:</strong> ${escapeHtml(p.pages_needed)}</p>` : ""}
      ${p.features ? `<p class="request-desc"><strong>Features:</strong> ${escapeHtml(p.features)}</p>` : ""}
      ${p.reference_links ? `<p class="request-desc"><strong>References:</strong> ${escapeHtml(p.reference_links)}</p>` : ""}
      ${p.description ? `<p class="request-desc">${escapeHtml(p.description)}</p>` : ""}
      <div class="note-row">
        <input type="text" id="admin-note-input" placeholder="Add a note visible to the client…" value="${escapeAttr(p.admin_notes || "")}" />
        <button class="btn-mini" id="admin-note-save">Save note</button>
        <button class="btn-mini danger" id="admin-request-delete">Delete request</button>
      </div>
    </div>`;

  document.getElementById("admin-note-save").addEventListener("click", async () => {
    const val = document.getElementById("admin-note-input").value;
    try {
      await api(`/admin/projects/${p.id}`, { method: "PATCH", body: JSON.stringify({ admin_notes: val }) });
      p.admin_notes = val;
    } catch (err) {
      alert(err.message || "Could not save note.");
    }
  });

  document.getElementById("admin-request-delete").addEventListener("click", async () => {
    if (!confirm("Delete this request permanently?")) return;
    try {
      await api(`/admin/projects/${p.id}`, { method: "DELETE" });
      allRequests = allRequests.filter((r) => r.id !== p.id);
      renderRequests();
      holder.innerHTML = "";
      loadStats();
    } catch (err) {
      alert(err.message || "Could not delete request.");
    }
  });
}

async function loadRequests() {
  try {
    const res = await api("/admin/projects");
    allRequests = res.projects;
    renderRequests();
  } catch {
    document.getElementById("admin-requests-body").innerHTML = '<tr><td colspan="6" class="admin-empty">Could not load requests.</td></tr>';
  }
}
SECTION_LOADERS.projects = loadRequests;

/* =========================================================
   Users
   ========================================================= */
async function loadUsers() {
  const body = document.getElementById("admin-users-body");
  try {
    const res = await api("/admin/users");
    if (!res.users.length) {
      body.innerHTML = '<tr><td colspan="5" class="admin-empty">No users yet.</td></tr>';
      return;
    }
    body.innerHTML = res.users
      .map(
        (u) => `
      <tr>
        <td>${escapeHtml(u.name)}</td>
        <td>${escapeHtml(u.email)}${u.oauth_provider ? ` <span style="color:rgba(255,255,255,.4);font-size:.75rem;">(${escapeHtml(u.oauth_provider)})</span>` : ""}</td>
        <td>
          <select class="role-select" data-id="${u.id}" style="background:#000;border:1px solid rgba(255,255,255,.15);color:#fff;border-radius:8px;padding:4px 8px;font-size:.8125rem;">
            <option value="customer" ${u.role === "customer" ? "selected" : ""}>Client</option>
            <option value="developer" ${u.role === "developer" ? "selected" : ""}>Developer</option>
            <option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin</option>
          </select>
        </td>
        <td>${fmtDate(u.created_at)}</td>
        <td><button class="btn-mini danger" data-user-delete="${u.id}">Delete</button></td>
      </tr>`
      )
      .join("");

    body.querySelectorAll(".role-select").forEach((sel) => {
      sel.addEventListener("change", async () => {
        try {
          await api(`/admin/users/${sel.dataset.id}`, { method: "PATCH", body: JSON.stringify({ role: sel.value }) });
        } catch (err) {
          alert(err.message || "Could not update role.");
          loadUsers();
        }
      });
    });
    body.querySelectorAll("[data-user-delete]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this user permanently?")) return;
        try {
          await api(`/admin/users/${btn.dataset.userDelete}`, { method: "DELETE" });
          loadUsers();
        } catch (err) {
          alert(err.message || "Could not delete user.");
        }
      });
    });
  } catch {
    body.innerHTML = '<tr><td colspan="5" class="admin-empty">Could not load users.</td></tr>';
  }
}
SECTION_LOADERS.users = loadUsers;

function initUserForm() {
  const addBtn = document.getElementById("user-add-btn");
  const card = document.getElementById("user-form-card");
  const form = document.getElementById("user-form");
  const cancelBtn = document.getElementById("user-form-cancel");

  addBtn.addEventListener("click", () => {
    card.style.display = card.style.display === "none" ? "block" : "none";
  });
  cancelBtn.addEventListener("click", () => {
    form.reset();
    card.style.display = "none";
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    try {
      await api("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          name: fd.get("name"),
          email: fd.get("email"),
          password: fd.get("password"),
          role: fd.get("role"),
          company: fd.get("company"),
          phone: fd.get("phone"),
        }),
      });
      form.reset();
      card.style.display = "none";
      loadUsers();
    } catch (err) {
      alert(err.message || "Could not create user.");
    }
  });
}

/* =========================================================
   Pages
   ========================================================= */
let currentPageSlug = "home";
async function loadPageForm(slug) {
  const form = document.getElementById("page-form");
  const status = document.getElementById("page-save-status");
  status.textContent = "";
  try {
    const res = await api(`/pages/${slug}`);
    form.slug.value = slug;
    form.hero_title.value = res.page.hero_title || "";
    form.hero_subtitle.value = res.page.hero_subtitle || "";
    form.meta_title.value = res.page.meta_title || "";
    form.meta_description.value = res.page.meta_description || "";
  } catch {
    status.textContent = "Could not load this page.";
  }
}
SECTION_LOADERS.pages = () => loadPageForm(currentPageSlug);

function initPagesSection() {
  document.querySelectorAll("#page-tabs .tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#page-tabs .tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentPageSlug = btn.dataset.page;
      loadPageForm(currentPageSlug);
    });
  });

  document.getElementById("page-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const status = document.getElementById("page-save-status");
    status.textContent = "Saving…";
    try {
      await api(`/pages/${form.slug.value}`, {
        method: "PATCH",
        body: JSON.stringify({
          hero_title: form.hero_title.value,
          hero_subtitle: form.hero_subtitle.value,
          meta_title: form.meta_title.value,
          meta_description: form.meta_description.value,
        }),
      });
      status.textContent = "Saved.";
      setTimeout(() => (status.textContent = ""), 2000);
    } catch (err) {
      status.textContent = err.message || "Could not save.";
    }
  });
}

/* =========================================================
   Portfolio
   ========================================================= */
let allPortfolio = [];

function renderPortfolioAdmin() {
  const grid = document.getElementById("portfolio-admin-grid");
  if (!allPortfolio.length) {
    grid.innerHTML = '<p class="admin-empty">No portfolio items yet.</p>';
    return;
  }
  grid.innerHTML = allPortfolio
    .map(
      (item) => `
    <div class="card glass">
      ${item.image_url ? `<img src="${escapeAttr(item.image_url)}" style="width:100%;border-radius:12px;aspect-ratio:16/10;object-fit:cover;" />` : ""}
      <h3 style="margin-top:12px;">${escapeHtml(item.title)}${item.featured ? ' <span class="status-badge status-published">Featured</span>' : ""}</h3>
      <p>${escapeHtml(item.category || "—")}</p>
      <div style="margin-top:12px;display:flex;gap:8px;">
        <button class="btn-mini" data-portfolio-edit="${item.id}">Edit</button>
        <button class="btn-mini danger" data-portfolio-delete="${item.id}">Delete</button>
      </div>
    </div>`
    )
    .join("");

  grid.querySelectorAll("[data-portfolio-edit]").forEach((btn) => {
    btn.addEventListener("click", () => openPortfolioForm(btn.dataset.portfolioEdit));
  });
  grid.querySelectorAll("[data-portfolio-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this portfolio item?")) return;
      try {
        await api(`/portfolio/${btn.dataset.portfolioDelete}`, { method: "DELETE" });
        loadPortfolio();
      } catch (err) {
        alert(err.message || "Could not delete item.");
      }
    });
  });
}

async function loadPortfolio() {
  const grid = document.getElementById("portfolio-admin-grid");
  try {
    const res = await api("/portfolio");
    allPortfolio = res.items;
    renderPortfolioAdmin();
  } catch {
    grid.innerHTML = '<p class="admin-empty">Could not load portfolio.</p>';
  }
}
SECTION_LOADERS.portfolio = loadPortfolio;

function openPortfolioForm(id) {
  const card = document.getElementById("portfolio-form-card");
  const form = document.getElementById("portfolio-form");
  const title = document.getElementById("portfolio-form-title");
  form.reset();
  if (id) {
    const item = allPortfolio.find((p) => String(p.id) === String(id));
    if (!item) return;
    title.textContent = "Edit portfolio item";
    form.id.value = item.id;
    form.title.value = item.title || "";
    form.category.value = item.category || "";
    form.description.value = item.description || "";
    form.image_url.value = item.image_url || "";
    form.project_url.value = item.project_url || "";
    form.sort_order.value = item.sort_order || 0;
    form.featured.checked = !!item.featured;
  } else {
    title.textContent = "New portfolio item";
    form.id.value = "";
  }
  card.style.display = "block";
}

function initPortfolioForm() {
  document.getElementById("portfolio-add-btn").addEventListener("click", () => openPortfolioForm(null));
  document.getElementById("portfolio-form-cancel").addEventListener("click", () => {
    document.getElementById("portfolio-form-card").style.display = "none";
  });
  document.getElementById("portfolio-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const payload = {
      title: form.title.value,
      category: form.category.value,
      description: form.description.value,
      image_url: form.image_url.value,
      project_url: form.project_url.value,
      sort_order: Number(form.sort_order.value) || 0,
      featured: form.featured.checked,
    };
    try {
      if (form.id.value) {
        await api(`/portfolio/${form.id.value}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await api("/portfolio", { method: "POST", body: JSON.stringify(payload) });
      }
      document.getElementById("portfolio-form-card").style.display = "none";
      loadPortfolio();
    } catch (err) {
      alert(err.message || "Could not save item.");
    }
  });
}

/* =========================================================
   Messages
   ========================================================= */
async function loadMessages() {
  const body = document.getElementById("admin-messages-body");
  try {
    const res = await api("/admin/messages");
    if (!res.messages.length) {
      body.innerHTML = `<tr><td colspan="5" class="admin-empty">No messages yet.</td></tr>`;
      return;
    }
    body.innerHTML = res.messages
      .map(
        (m) => `
      <tr>
        <td>${escapeHtml(m.name)}<br><span style="color:rgba(255,255,255,.4);font-size:.75rem;">${escapeHtml(m.email)}</span></td>
        <td>${escapeHtml(m.subject || "—")}</td>
        <td style="max-width:320px;">${escapeHtml(m.message)}</td>
        <td>${fmtDate(m.created_at)}</td>
        <td><button class="btn-mini danger" data-msg-delete="${m.id}">Delete</button></td>
      </tr>`
      )
      .join("");

    body.querySelectorAll("[data-msg-delete]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await api(`/admin/messages/${btn.dataset.msgDelete}`, { method: "DELETE" });
          loadMessages();
          loadStats();
        } catch (err) {
          alert(err.message || "Could not delete message.");
        }
      });
    });
  } catch {
    body.innerHTML = '<tr><td colspan="5" class="admin-empty">Could not load messages.</td></tr>';
  }
}
SECTION_LOADERS.messages = loadMessages;

/* =========================================================
   Media
   ========================================================= */
function mediaTileMarkup(item) {
  const isImage = (item.mime_type || "").startsWith("image/");
  const isVideo = (item.mime_type || "").startsWith("video/");
  const preview = isImage
    ? `<img src="${escapeAttr(item.url)}" alt="${escapeAttr(item.original_name)}" />`
    : isVideo
    ? `<video src="${escapeAttr(item.url)}" muted></video>`
    : `<span class="file-icon">📄</span>`;
  return `
    <div class="media-tile">
      ${preview}
      <button class="media-remove" data-media-delete="${item.id}" title="Delete">✕</button>
      <div class="media-name">${escapeHtml(item.original_name || item.filename)}</div>
    </div>`;
}

async function loadMedia() {
  const grid = document.getElementById("media-grid");
  try {
    const res = await api("/admin/media");
    if (!res.items.length) {
      grid.innerHTML = '<p class="admin-empty">No files uploaded yet.</p>';
      return;
    }
    grid.innerHTML = res.items.map(mediaTileMarkup).join("");
    grid.querySelectorAll("[data-media-delete]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this file?")) return;
        try {
          await api(`/admin/media/${btn.dataset.mediaDelete}`, { method: "DELETE" });
          loadMedia();
        } catch (err) {
          alert(err.message || "Could not delete file.");
        }
      });
    });
  } catch {
    grid.innerHTML = '<p class="admin-empty">Could not load media.</p>';
  }
}
SECTION_LOADERS.media = loadMedia;

function initMediaUpload() {
  const input = document.getElementById("media-upload-input");
  const status = document.getElementById("media-upload-status");
  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;
    status.textContent = `Uploading ${file.name}…`;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const token = getToken();
      const res = await fetch(apiUrl("/admin/media/upload"), {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error((body && body.error) || "Upload failed.");
      status.textContent = "Uploaded.";
      loadMedia();
    } catch (err) {
      status.textContent = err.message || "Upload failed.";
    } finally {
      input.value = "";
      setTimeout(() => (status.textContent = ""), 3000);
    }
  });
}

/* =========================================================
   Blog
   ========================================================= */
let allBlogPosts = [];

function renderBlogAdmin() {
  const body = document.getElementById("admin-blog-body");
  if (!allBlogPosts.length) {
    body.innerHTML = '<tr><td colspan="4" class="admin-empty">No posts yet.</td></tr>';
    return;
  }
  body.innerHTML = allBlogPosts
    .map(
      (post) => `
    <tr>
      <td>${escapeHtml(post.title)}</td>
      <td><span class="status-badge status-${post.status}">${post.status === "published" ? "Published" : "Draft"}</span></td>
      <td>${fmtDate(post.updated_at)}</td>
      <td>
        <button class="btn-mini" data-blog-edit="${post.id}">Edit</button>
        <button class="btn-mini danger" data-blog-delete="${post.id}">Delete</button>
      </td>
    </tr>`
    )
    .join("");

  body.querySelectorAll("[data-blog-edit]").forEach((btn) => {
    btn.addEventListener("click", () => openBlogForm(btn.dataset.blogEdit));
  });
  body.querySelectorAll("[data-blog-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this post permanently?")) return;
      try {
        await api(`/admin/blog/${btn.dataset.blogDelete}`, { method: "DELETE" });
        loadBlog();
      } catch (err) {
        alert(err.message || "Could not delete post.");
      }
    });
  });
}

async function loadBlog() {
  const body = document.getElementById("admin-blog-body");
  try {
    const res = await api("/admin/blog");
    allBlogPosts = res.posts;
    renderBlogAdmin();
  } catch {
    body.innerHTML = '<tr><td colspan="4" class="admin-empty">Could not load posts.</td></tr>';
  }
}
SECTION_LOADERS.blog = loadBlog;

function openBlogForm(id) {
  const card = document.getElementById("blog-form-card");
  const form = document.getElementById("blog-form");
  const title = document.getElementById("blog-form-title");
  form.reset();
  if (id) {
    const post = allBlogPosts.find((p) => String(p.id) === String(id));
    if (!post) return;
    title.textContent = "Edit post";
    form.id.value = post.id;
    form.title.value = post.title || "";
    form.excerpt.value = post.excerpt || "";
    form.cover_image.value = post.cover_image || "";
    form.content.value = post.content || "";
  } else {
    title.textContent = "New post";
    form.id.value = "";
  }
  card.style.display = "block";
}

function initBlogForm() {
  document.getElementById("blog-add-btn").addEventListener("click", () => openBlogForm(null));
  document.getElementById("blog-form-cancel").addEventListener("click", () => {
    document.getElementById("blog-form-card").style.display = "none";
  });

  let clickedPublish = "0";
  document.getElementById("blog-form").querySelectorAll("button[data-publish]").forEach((btn) => {
    btn.addEventListener("click", () => (clickedPublish = btn.dataset.publish));
  });

  document.getElementById("blog-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const payload = {
      title: form.title.value,
      excerpt: form.excerpt.value,
      cover_image: form.cover_image.value,
      content: form.content.value,
      status: clickedPublish === "1" ? "published" : "draft",
    };
    try {
      if (form.id.value) {
        await api(`/admin/blog/${form.id.value}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await api("/admin/blog", { method: "POST", body: JSON.stringify(payload) });
      }
      document.getElementById("blog-form-card").style.display = "none";
      loadBlog();
    } catch (err) {
      alert(err.message || "Could not save post.");
    }
  });
}

/* =========================================================
   Analytics
   ========================================================= */
async function loadAnalytics() {
  try {
    const res = await api("/analytics/summary");
    document.getElementById("an-total").textContent = res.totalViews;
    document.getElementById("an-7").textContent = res.last7;
    document.getElementById("an-30").textContent = res.last30;

    const maxPage = Math.max(1, ...res.topPages.map((p) => p.views));
    document.getElementById("an-top-pages").innerHTML =
      res.topPages
        .map(
          (p) => `
      <div class="bar-row">
        <span class="name" style="width:180px;text-transform:none;">${escapeHtml(p.path)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${(p.views / maxPage) * 100}%"></div></div>
        <span class="bar-count">${p.views}</span>
      </div>`
        )
        .join("") || '<p class="admin-empty">No traffic recorded yet.</p>';

    const maxRef = Math.max(1, ...res.topReferrers.map((r) => r.c));
    document.getElementById("an-referrers").innerHTML =
      res.topReferrers
        .map(
          (r) => `
      <div class="bar-row">
        <span class="name" style="width:180px;text-transform:none;">${escapeHtml(r.referrer)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${(r.c / maxRef) * 100}%"></div></div>
        <span class="bar-count">${r.c}</span>
      </div>`
        )
        .join("") || '<p class="admin-empty">No referrer data yet.</p>';
  } catch {
    /* non-critical */
  }
}
SECTION_LOADERS.analytics = loadAnalytics;

/* =========================================================
   Settings
   ========================================================= */
async function loadSettings() {
  const form = document.getElementById("settings-form");
  try {
    const res = await api("/settings");
    const s = res.settings;
    Object.keys(s).forEach((key) => {
      const el = form.elements.namedItem(key);
      if (!el) return;
      if (el.type === "checkbox") el.checked = s[key] === "1";
      else el.value = s[key] || "";
    });
  } catch {
    /* leave defaults blank if this fails */
  }
}
SECTION_LOADERS.settings = loadSettings;

function initSettingsForm() {
  document.getElementById("settings-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const status = document.getElementById("settings-save-status");
    status.textContent = "Saving…";
    const fd = new FormData(form);
    const payload = {};
    fd.forEach((value, key) => (payload[key] = value));
    payload.maintenance_mode = document.getElementById("maintenance-toggle").checked ? "1" : "0";
    try {
      await api("/settings", { method: "PATCH", body: JSON.stringify(payload) });
      status.textContent = "Saved.";
      setTimeout(() => (status.textContent = ""), 2000);
    } catch (err) {
      status.textContent = err.message || "Could not save settings.";
    }
  });
}

/* =========================================================
   Security
   ========================================================= */
async function loadSecurity() {
  const body = document.getElementById("login-history-body");
  try {
    const res = await api("/admin/security/login-history");
    if (!res.history.length) {
      body.innerHTML = '<tr><td colspan="5" class="admin-empty">No login activity yet.</td></tr>';
      return;
    }
    body.innerHTML = res.history
      .map(
        (h) => `
      <tr>
        <td>${escapeHtml(h.email || "—")}</td>
        <td>${escapeHtml(h.role || "—")}</td>
        <td><span class="status-badge status-${h.success ? "completed" : "cancelled"}">${h.success ? "Success" : "Failed"}</span></td>
        <td>${escapeHtml(h.ip || "—")}</td>
        <td>${fmtDateTime(h.created_at)}</td>
      </tr>`
      )
      .join("");
  } catch {
    body.innerHTML = '<tr><td colspan="5" class="admin-empty">Could not load login history.</td></tr>';
  }

  const backupLink = document.getElementById("backup-download-link");
  backupLink.href = apiUrl("/admin/security/backup");
  backupLink.onclick = async (e) => {
    e.preventDefault();
    try {
      const token = getToken();
      const res = await fetch(apiUrl("/admin/security/backup"), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Could not download backup.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `webore-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || "Could not download backup.");
    }
  };
}
SECTION_LOADERS.security = loadSecurity;

function initPasswordForm() {
  document.getElementById("password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const status = document.getElementById("password-status");
    status.textContent = "Saving…";
    try {
      await api("/admin/security/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: form.currentPassword.value, newPassword: form.newPassword.value }),
      });
      status.textContent = "Password updated.";
      form.reset();
    } catch (err) {
      status.textContent = err.message || "Could not update password.";
    }
  });
}

/* =========================================================
   Deploy
   ========================================================= */
function fmtUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

async function loadDeploy() {
  try {
    const res = await api("/admin/deploy/status");
    document.getElementById("deploy-commit").textContent = res.commit;
    document.getElementById("deploy-branch").textContent = res.branch;
    document.getElementById("deploy-node").textContent = res.nodeVersion;
    document.getElementById("deploy-uptime").textContent = fmtUptime(res.uptimeSeconds);
  } catch {
    /* non-critical */
  }
}
SECTION_LOADERS.deploy = loadDeploy;

/* =========================================================
   Boot
   ========================================================= */
document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireRole("admin");
  if (!user) return;

  initSidebar();
  initUserForm();
  initPagesSection();
  initPortfolioForm();
  initMediaUpload();
  initBlogForm();
  initSettingsForm();
  initPasswordForm();
});
