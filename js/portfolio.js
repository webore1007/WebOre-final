(function () {
  const grid = document.getElementById("portfolio-grid");
  if (!grid) return;

  async function load() {
    try {
      const res = await fetch(apiUrl("/portfolio"));
      const { items } = await res.json();

      if (!items || !items.length) {
        grid.innerHTML =
          '<p class="admin-empty">Nothing published yet — check back soon.</p>';
        return;
      }

      grid.innerHTML = items
        .map((item) => {
          const img = item.image_url
            ? `<img src="${escapeAttr(item.image_url)}" alt="${escapeAttr(item.title)}" style="width:100%;border-radius:12px;aspect-ratio:16/10;object-fit:cover;" />`
            : "";
          const link = item.project_url
            ? `<a href="${escapeAttr(item.project_url)}" target="_blank" rel="noopener" style="margin-top:12px;display:inline-block;font-size:.8125rem;color:rgba(255,255,255,.8);">Visit site →</a>`
            : "";
          return `
          <div class="card glass">
            ${img}
            ${item.category ? `<span class="eyebrow" style="margin-top:${img ? "16px" : "0"};display:block;">${escapeHtml(item.category)}</span>` : ""}
            <h3 style="margin-top:8px;">${escapeHtml(item.title)}</h3>
            ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}
            ${link}
          </div>`;
        })
        .join("");
    } catch {
      grid.innerHTML = '<p class="admin-empty">Couldn\'t load the portfolio right now.</p>';
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }
  function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, "&quot;");
  }

  load();
})();
