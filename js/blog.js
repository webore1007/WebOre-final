(function () {
  const grid = document.getElementById("blog-grid");
  if (!grid) return;

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }
  function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, "&quot;");
  }

  async function load() {
    try {
      const res = await fetch(apiUrl("/blog"));
      const { posts } = await res.json();

      if (!posts || !posts.length) {
        grid.innerHTML = '<p class="admin-empty">No posts published yet — check back soon.</p>';
        return;
      }

      grid.innerHTML = posts
        .map((post) => {
          const img = post.cover_image
            ? `<img src="${escapeAttr(post.cover_image)}" alt="${escapeAttr(post.title)}" style="width:100%;border-radius:12px;aspect-ratio:16/10;object-fit:cover;" />`
            : "";
          const date = post.published_at ? new Date(post.published_at).toLocaleDateString() : "";
          return `
          <a href="blog-post.html?slug=${encodeURIComponent(post.slug)}" class="card glass" style="display:block;color:inherit;">
            ${img}
            ${date ? `<span class="eyebrow" style="margin-top:${img ? "16px" : "0"};display:block;">${date}</span>` : ""}
            <h3 style="margin-top:8px;">${escapeHtml(post.title)}</h3>
            ${post.excerpt ? `<p>${escapeHtml(post.excerpt)}</p>` : ""}
          </a>`;
        })
        .join("");
    } catch {
      grid.innerHTML = '<p class="admin-empty">Couldn\'t load the blog right now.</p>';
    }
  }

  load();
})();
