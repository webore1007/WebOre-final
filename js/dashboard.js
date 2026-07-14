const STATUS_LABEL = {
  new: "Received",
  in_review: "In Review",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

let selectedFeatures = [];

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function renderProjects(projects) {
  const holder = document.getElementById("projects-list");
  if (!projects.length) {
    holder.innerHTML = `<p style="margin-top:16px;color:rgba(255,255,255,.5);">You haven't submitted a request yet — start one above.</p>`;
    return;
  }
  holder.innerHTML = `<div class="request-list">${projects
    .map(
      (p) => `
    <div class="request-card glass">
      <div class="top">
        <h3>${escapeHtml(p.business_name)}</h3>
        <span class="status-badge status-${p.status}">${STATUS_LABEL[p.status] || p.status}</span>
      </div>
      <p class="request-meta">${escapeHtml(p.project_type)} · ${escapeHtml(p.budget || "—")} · ${escapeHtml(p.timeline || "—")}</p>
      ${p.description ? `<p class="request-desc">${escapeHtml(p.description)}</p>` : ""}
      ${
        p.admin_notes
          ? `<div class="request-note"><p class="label">Note from your team</p><p>${escapeHtml(p.admin_notes)}</p></div>`
          : ""
      }
      <p class="request-date">Submitted ${new Date(p.created_at).toLocaleDateString()}</p>
    </div>`
    )
    .join("")}</div>`;
}

async function loadProjects() {
  try {
    const res = await api("/projects/mine");
    renderProjects(res.projects);
  } catch {
    document.getElementById("projects-list").innerHTML =
      '<p style="margin-top:16px;color:rgba(255,255,255,.5);">Could not load your requests right now.</p>';
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireRole("customer");
  if (!user) return;

  document.getElementById("dash-welcome").textContent = `Welcome, ${user.name}`;
  loadProjects();

  const toggleBtn = document.getElementById("toggle-form-btn");
  const form = document.getElementById("project-form");
  toggleBtn.addEventListener("click", () => {
    const isHidden = form.style.display === "none";
    form.style.display = isHidden ? "grid" : "none";
    toggleBtn.textContent = isHidden ? "Close form" : "+ New website request";
  });

  document.querySelectorAll(".feature-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const feature = btn.dataset.feature;
      if (selectedFeatures.includes(feature)) {
        selectedFeatures = selectedFeatures.filter((f) => f !== feature);
        btn.classList.remove("active");
      } else {
        selectedFeatures.push(feature);
        btn.classList.add("active");
      }
    });
  });

  const projectForm = document.getElementById("project-form");
  const errorEl = document.getElementById("project-error");
  const submitBtn = document.getElementById("project-submit-btn");
  const successBadge = document.getElementById("dash-success-badge");

  projectForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.style.display = "none";
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";

    const payload = {
      business_name: projectForm.business_name.value,
      industry: projectForm.industry.value,
      project_type: projectForm.project_type.value,
      budget: projectForm.budget.value,
      timeline: projectForm.timeline.value,
      pages_needed: projectForm.pages_needed.value,
      design_style: projectForm.design_style.value,
      reference_links: projectForm.reference_links.value,
      description: projectForm.description.value,
      features: selectedFeatures,
    };

    try {
      await api("/projects", { method: "POST", body: JSON.stringify(payload) });
      projectForm.reset();
      selectedFeatures = [];
      document.querySelectorAll(".feature-toggle").forEach((b) => b.classList.remove("active"));
      projectForm.style.display = "none";
      toggleBtn.textContent = "+ New website request";
      successBadge.style.display = "inline-block";
      loadProjects();
      setTimeout(() => (successBadge.style.display = "none"), 4000);
    } catch (err) {
      errorEl.textContent = err.message || "Could not submit request.";
      errorEl.style.display = "block";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit request";
    }
  });
});
