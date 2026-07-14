/* ---------- Homepage hero mini-form ----------
   Previously this only showed a fake "Sent" state locally and never
   actually reached the server — nothing was ever recorded. It now
   really submits to /api/contact, same as the full contact page. */
(function initHeroInquiry() {
  const form = document.getElementById("hero-inquiry-form");
  if (!form) return;
  const input = document.getElementById("hero-inquiry-input");
  const btn = document.getElementById("hero-inquiry-btn");
  const label = document.getElementById("hero-inquiry-btn-label");
  const note = document.getElementById("hero-inquiry-note");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const value = input.value.trim();
    if (!value || btn.disabled) return;

    btn.disabled = true;
    input.disabled = true;
    label.textContent = "Sending…";
    note.textContent = "";

    try {
      await api("/contact", {
        method: "POST",
        auth: false,
        body: JSON.stringify({
          name: "Website visitor",
          email: "not-provided@webore.inquiry",
          subject: "Homepage quick inquiry",
          message: value,
        }),
      });
      label.textContent = "Sent";
      note.textContent = "Thanks — we'll be in touch soon. For a faster reply, use the contact page.";
      setTimeout(() => {
        label.textContent = "Let's Build";
        btn.disabled = false;
        input.disabled = false;
        input.value = "";
        note.textContent = "";
      }, 3200);
    } catch (err) {
      label.textContent = "Let's Build";
      btn.disabled = false;
      input.disabled = false;
      note.textContent = err.message || "Could not send — please try the contact page.";
    }
  });
})();

/* ---------- Full contact page form ---------- */
(function initContactForm() {
  const form = document.getElementById("contact-form");
  if (!form) return;
  const submitBtn = document.getElementById("contact-submit-btn");
  const errorEl = document.getElementById("contact-error");
  const successEl = document.getElementById("contact-success");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.style.display = "none";
    successEl.style.display = "none";
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";

    const payload = {
      name: form.name.value,
      email: form.email.value,
      subject: form.subject.value,
      message: form.message.value,
    };

    try {
      await api("/contact", { method: "POST", auth: false, body: JSON.stringify(payload) });
      successEl.style.display = "block";
      form.reset();
    } catch (err) {
      errorEl.textContent = err.message || "Could not send your message.";
      errorEl.style.display = "block";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Send message";
    }
  });
})();
