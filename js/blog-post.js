(function () {
  const holder = document.getElementById("post-content");
  if (!holder) return;

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function paragraphs(text) {
    return String(text || "")
      .split(/\n{2,}/)
      .map((p) => `<p style="margin-top:16px;line-height:1.8;color:rgba(255,255,255,.75);">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
      .join("");
  }

  async function load() {
    const slug = new URLSearchParams(window.location.search).get("slug");
    if (!slug) {
      holder.innerHTML = '<p class="admin-empty">No post specified.</p>';
      return;
    }
    try {
      const res = await fetch(apiUrl(`/blog/${encodeURIComponent(slug)}`));
      if (!res.ok) throw new Error("not found");
      const { post } = await res.json();

      document.title = `${post.title} — WebOre`;
      const date = post.published_at ? new Date(post.published_at).toLocaleDateString() : "";
      const img = post.cover_image
        ? `<img src="${escapeHtml(post.cover_image)}" alt="${escapeHtml(post.title)}" style="width:100%;border-radius:16px;margin-top:24px;aspect-ratio:16/9;object-fit:cover;" />`
        : "";

      holder.innerHTML = `
        ${date ? `<span class="eyebrow" style="display:block;">${date}</span>` : ""}
        <h1 class="gradient-text" style="margin-top:12px;font-size:2.25rem;line-height:1.15;">${escapeHtml(post.title)}</h1>
        ${img}
        ${paragraphs(post.content)}
      `;
    } catch {
      holder.innerHTML = '<p class="admin-empty">That post couldn\'t be found — it may have been unpublished.</p>';
    }
  }

  load();
})();
