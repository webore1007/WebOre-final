/* ---------- background particles (deterministic, matches old design) ----------
   Full count on desktop; a lighter count on phones, where each animated,
   glowing particle is relatively expensive for the GPU to composite every
   frame — this is one of a few targeted mobile performance fixes (see also
   css/style.css's "Mobile performance" section at the bottom). Nothing
   about how it looks changes, just how many are drawn on small screens. */
function initParticles() {
  const holder = document.querySelector(".bg-particles");
  if (!holder) return;
  const isSmallScreen = window.matchMedia("(max-width: 860px)").matches;
  const count = isSmallScreen ? 12 : 36;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const seed = (i * 137.5) % 100;
    const left = (seed * 3.7) % 100;
    const top = (seed * 5.3 + i * 7) % 100;
    const duration = 6 + (i % 7);
    const delay = (i % 10) * 0.6;
    const size = 2 + (i % 3);
    const span = document.createElement("span");
    span.className = "bg-particle";
    span.style.left = left + "%";
    span.style.top = top + "%";
    span.style.animationDuration = duration + "s";
    span.style.animationDelay = delay + "s";
    span.style.width = size + "px";
    span.style.height = size + "px";
    frag.appendChild(span);
  }
  holder.appendChild(frag);
}

/* ---------- mobile nav ---------- */
function initMobileMenu() {
  const btn = document.querySelector(".mobile-menu-btn");
  const menu = document.querySelector(".mobile-menu");
  if (!btn || !menu) return;
  const closeBtn = menu.querySelector(".close-btn");
  btn.addEventListener("click", () => menu.classList.add("show"));
  if (closeBtn) closeBtn.addEventListener("click", () => menu.classList.remove("show"));
  menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => menu.classList.remove("show")));
}

/* ---------- navbar auth state ---------- */
async function initNavAuth() {
  const actions = document.getElementById("nav-actions");
  if (!actions) return;
  const user = await loadCurrentUser();

  if (user) {
    const dashHref = user.role === "admin" ? "admin.html" : "dashboard.html";
    const dashLabel = user.role === "admin" ? "Admin" : "Dashboard";
    actions.innerHTML = `
      <a href="${dashHref}" class="nav-login-link" style="display:inline">${dashLabel}</a>
      <span class="loggedin-name">Hi, ${escapeHtml(user.name.split(" ")[0])}</span>
      <button class="btn btn-pill btn-sm glass-pill" id="nav-logout-btn">Log out</button>
    `;
    document.getElementById("nav-logout-btn").addEventListener("click", logoutUser);
  } else {
    actions.innerHTML = `
      <a href="login.html" class="nav-login-link">Log in</a>
      <a href="signup.html" class="btn btn-pill btn-sm glass-pill">Start Project</a>
    `;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------- footer year ---------- */
function initFooterYear() {
  const el = document.getElementById("footer-year");
  if (el) el.textContent = new Date().getFullYear();
}

/* =========================================================
   Cookie consent
   Stores: { essential: true, analytics: bool, preferences: bool, decided: true }
   ========================================================= */
const COOKIE_KEY = "webore_cookie_consent";

function getConsent() {
  try {
    const raw = localStorage.getItem(COOKIE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveConsent(consent) {
  localStorage.setItem(COOKIE_KEY, JSON.stringify({ essential: true, decided: true, ...consent }));
  applyConsent();
}

function applyConsent() {
  const consent = getConsent();
  if (consent && consent.analytics) sendPageview();
  document.dispatchEvent(new CustomEvent("webore:consent-updated", { detail: consent }));
}

/* ---------- lightweight first-party analytics (Analytics tab in admin) ---------- */
let pageviewSent = false;
function sendPageview() {
  if (pageviewSent) return;
  pageviewSent = true;
  fetch(apiUrl("/analytics/pageview"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: window.location.pathname, referrer: document.referrer || "" }),
    keepalive: true,
  }).catch(() => {});
}

/* ---------- pull public site settings (site name, socials, maintenance) ----------
   Lets the Settings tab in the admin panel update contact info / social links /
   OAuth client IDs across the whole site without editing any files. */
async function loadPublicSettings() {
  try {
    const res = await fetch(apiUrl("/settings/public"));
    if (!res.ok) return;
    const { settings } = await res.json();
    window.WEBORE_SETTINGS = settings;

    document.querySelectorAll("[data-settings-email]").forEach((el) => {
      if (settings.contact_email) el.textContent = settings.contact_email;
    });
    document.querySelectorAll("[data-settings-phone]").forEach((el) => {
      if (settings.contact_phone) el.textContent = settings.contact_phone;
    });

    // Runtime OAuth client IDs (falls back to js/config.js if the admin hasn't set these yet).
    if (settings.google_client_id) window.GOOGLE_CLIENT_ID = settings.google_client_id;
    if (settings.facebook_app_id) window.FACEBOOK_APP_ID = settings.facebook_app_id;
    document.dispatchEvent(new CustomEvent("webore:settings-loaded", { detail: settings }));
  } catch {
    /* public site still works fine with the static defaults if this fails */
  }
}

function initCookieConsent() {
  const banner = document.getElementById("cookie-banner");
  const modalOverlay = document.getElementById("cookie-modal-overlay");
  if (!banner) return;

  const consent = getConsent();
  if (!consent || !consent.decided) {
    banner.classList.add("show");
  }

  const acceptAllBtn = document.getElementById("cookie-accept-all");
  const rejectBtn = document.getElementById("cookie-reject");
  const manageBtn = document.getElementById("cookie-manage");
  const closeModalBtn = document.getElementById("cookie-modal-close");
  const saveModalBtn = document.getElementById("cookie-modal-save");
  const analyticsToggle = document.getElementById("cookie-toggle-analytics");
  const preferencesToggle = document.getElementById("cookie-toggle-preferences");

  if (acceptAllBtn) {
    acceptAllBtn.addEventListener("click", () => {
      saveConsent({ analytics: true, preferences: true });
      banner.classList.remove("show");
    });
  }
  if (rejectBtn) {
    rejectBtn.addEventListener("click", () => {
      saveConsent({ analytics: false, preferences: false });
      banner.classList.remove("show");
    });
  }
  if (manageBtn && modalOverlay) {
    manageBtn.addEventListener("click", () => {
      const current = getConsent() || {};
      if (analyticsToggle) analyticsToggle.checked = !!current.analytics;
      if (preferencesToggle) preferencesToggle.checked = !!current.preferences;
      modalOverlay.classList.add("show");
    });
  }
  if (closeModalBtn && modalOverlay) {
    closeModalBtn.addEventListener("click", () => modalOverlay.classList.remove("show"));
  }
  if (saveModalBtn && modalOverlay) {
    saveModalBtn.addEventListener("click", () => {
      saveConsent({
        analytics: analyticsToggle ? analyticsToggle.checked : false,
        preferences: preferencesToggle ? preferencesToggle.checked : false,
      });
      modalOverlay.classList.remove("show");
      banner.classList.remove("show");
    });
  }

  applyConsent();
}

/* ---------- Pages CMS: overlay admin-edited hero copy on load ----------
   Home/About/Services/Contact carry a data-page-slug on <main> and
   data-cms="hero_title" / "hero_subtitle" on the elements to fill in. */
async function loadPageContent() {
  const main = document.querySelector("main[data-page-slug]");
  if (!main) return;
  const slug = main.dataset.pageSlug;
  try {
    const res = await fetch(apiUrl(`/pages/${slug}`));
    if (!res.ok) return;
    const { page } = await res.json();
    if (!page) return;
    document.querySelectorAll("[data-cms='hero_title']").forEach((el) => {
      if (page.hero_title) el.textContent = page.hero_title;
    });
    document.querySelectorAll("[data-cms='hero_subtitle']").forEach((el) => {
      if (page.hero_subtitle) el.textContent = page.hero_subtitle;
    });
    if (page.meta_title) document.title = page.meta_title;
    if (page.meta_description) {
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "description";
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", page.meta_description);
    }
  } catch {
    /* the page still renders fine with its built-in copy if this fails */
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initParticles();
  initMobileMenu();
  initNavAuth();
  initFooterYear();
  initCookieConsent();
  loadPublicSettings();
  loadPageContent();
});
