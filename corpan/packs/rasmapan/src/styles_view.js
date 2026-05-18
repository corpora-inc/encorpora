/**
 * Rasmapan — Styles mode renderer.
 *
 * Renders the four calligraphic-style cards (Naskh, Thuluth, Diwani,
 * Kufic). Read-only; no tracing. Each card shows the style name in
 * English and Arabic, a sample (image if the pack ships one,
 * otherwise text rendered in Amiri), and a short description.
 *
 * Named `styles_view.js` rather than `styles.js` to avoid colliding
 * with the CSS file.
 */

const escapeHtml = (s) =>
  String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const renderMd = (text) => {
  if (!text) return "";
  const paragraphs = String(text).split(/\n\n+/);
  return paragraphs
    .map((p) => {
      let html = escapeHtml(p.trim());
      html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      html = html.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
      html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
      return `<p>${html}</p>`;
    })
    .join("");
};

const SAMPLE_TEXT = "بسم الله";  // "In the name of God" — a phrase
// rendered in every calligraphic style. For v0.1.0 every style card
// shows it in Amiri (the font we ship); future versions can swap in
// per-style fonts or real public-domain images via `sample_image`.

export class StylesView {
  constructor({ container, hostApi, queryPackDb, packBaseUrl }) {
    this.container = container;
    this.hostApi = hostApi;
    this.queryPackDb = queryPackDb;
    this.packBaseUrl = packBaseUrl || "";
    this.rendered = false;
  }

  async render() {
    let rows = [];
    try {
      const res = await this.queryPackDb({
        sql:
          "SELECT id, ord, name_en, name_ar, sample_image, description_md " +
          "FROM arabic_style ORDER BY ord ASC",
      });
      rows = res.rows || [];
    } catch {
      rows = [];
    }

    const cardsHtml = rows
      .map((row) => {
        const sample = row.sample_image
          ? `<div class="sample-image"><img class="sample-image-img" src="${escapeHtml(this._assetUrl(row.sample_image))}" alt="${escapeHtml(row.name_en)} sample" loading="lazy" /></div>`
          : `<div class="sample-text" lang="ar">${escapeHtml(SAMPLE_TEXT)}</div>`;
        return `
          <article class="style-card">
            <header class="style-header">
              <span class="style-name-en">${escapeHtml(row.name_en)}</span>
              <span class="style-name-ar" lang="ar">${escapeHtml(row.name_ar || "")}</span>
            </header>
            ${sample}
            <div class="style-body">${renderMd(row.description_md || "")}</div>
          </article>
        `;
      })
      .join("");

    this.container.innerHTML = `<div class="style-cards">${cardsHtml}</div>`;
    this.rendered = true;
  }

  _assetUrl(rel) {
    if (!rel) return "";
    if (/^https?:/.test(rel) || rel.startsWith("data:")) return rel;
    const base = this.packBaseUrl.endsWith("/")
      ? this.packBaseUrl
      : `${this.packBaseUrl}/`;
    return `${base}assets/styles/${rel}`;
  }
}
