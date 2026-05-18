/**
 * Rasmapan — onboarding lessons renderer.
 *
 * Reads `arabic_lesson` rows from the pack DB and renders them as a
 * full-screen overlay of cards. Each card has Next/Back/Skip
 * controls. Progress persists in localStorage; finishing the last
 * lesson dismisses the overlay and signals to main.js to start
 * practice mode.
 */

const PROGRESS_KEY = "rasmapan:lesson-progress-v1";
const SKIP_KEY = "rasmapan:lessons-skipped-v1";

const escapeHtml = (s) =>
  String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Tiny markdown subset: paragraphs (blank-line separated), **bold**,
// *italic*, and `code`. Enough for the lesson bodies.
const renderMd = (text) => {
  if (!text) return "";
  const paragraphs = String(text).split(/\n\n+/);
  return paragraphs
    .map((p) => {
      let html = escapeHtml(p.trim());
      html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      html = html.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
      html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
      // Unordered lists: lines starting with "- ".
      if (/^- /m.test(html)) {
        const lines = html.split(/\n/);
        const out = [];
        let inList = false;
        for (const line of lines) {
          if (line.startsWith("- ")) {
            if (!inList) {
              out.push("<ul>");
              inList = true;
            }
            out.push(`<li>${line.slice(2)}</li>`);
          } else {
            if (inList) {
              out.push("</ul>");
              inList = false;
            }
            if (line.trim()) out.push(line);
          }
        }
        if (inList) out.push("</ul>");
        html = out.join("\n");
      }
      return `<p>${html}</p>`;
    })
    .join("");
};

const readProgress = () => {
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (!raw) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
};

const writeProgress = (n) => {
  try {
    window.localStorage.setItem(PROGRESS_KEY, String(n));
  } catch {
    /* ignore */
  }
};

const readSkipped = () => {
  try {
    return window.localStorage.getItem(SKIP_KEY) === "1";
  } catch {
    return false;
  }
};

const writeSkipped = (flag) => {
  try {
    window.localStorage.setItem(SKIP_KEY, flag ? "1" : "0");
  } catch {
    /* ignore */
  }
};

// Read alphabet glyphs from `arabic_letter` in family order — used by
// the lesson 2 abjad grid.
const queryAlphabet = async (queryPackDb) => {
  if (!queryPackDb) return [];
  try {
    const result = await queryPackDb({
      sql:
        "SELECT id, letter, name_en FROM arabic_letter " +
        "WHERE position = 'isolated' ORDER BY frequency DESC NULLS LAST, id",
    });
    return result.rows || [];
  } catch {
    return [];
  }
};

export class LessonRunner {
  constructor({ container, hostApi, queryPackDb, onComplete }) {
    this.container = container;
    this.hostApi = hostApi;
    this.queryPackDb = queryPackDb;
    this.onComplete = onComplete;
    this.lessons = [];
    this.alphabet = [];
    this.index = 0;
    this.overlay = null;
  }

  async load() {
    const result = await this.queryPackDb({
      sql:
        "SELECT id, ord, type, content_json FROM arabic_lesson " +
        "ORDER BY ord ASC",
    });
    this.lessons = (result.rows || []).map((row) => {
      let content = {};
      try {
        content = JSON.parse(row.content_json || "{}");
      } catch {
        /* ignore */
      }
      return {
        id: row.id,
        ord: row.ord,
        type: row.type,
        ...content,
      };
    });
    this.alphabet = await queryAlphabet(this.queryPackDb);
  }

  shouldShow() {
    if (readSkipped()) return false;
    if (!this.lessons.length) return false;
    return readProgress() < this.lessons.length;
  }

  start() {
    this.index = Math.min(readProgress(), this.lessons.length - 1);
    if (this.index < 0) this.index = 0;
    this._render();
  }

  _render() {
    if (!this.overlay) {
      this.overlay = document.createElement("div");
      this.overlay.className = "lesson-overlay";
      this.container.appendChild(this.overlay);
    }
    const lesson = this.lessons[this.index];
    if (!lesson) {
      this._finish();
      return;
    }
    const isLast = this.index === this.lessons.length - 1;
    const dots = this.lessons
      .map((_, i) => {
        const cls = i < this.index ? "is-done" : i === this.index ? "is-active" : "";
        return `<span class="${cls}"></span>`;
      })
      .join("");

    let extra = "";
    if (lesson.highlight_ar) {
      extra += `
        <div class="lesson-highlight">${escapeHtml(lesson.highlight_ar)}</div>
        ${lesson.highlight_caption ? `<div class="lesson-caption">${escapeHtml(lesson.highlight_caption)}</div>` : ""}
      `;
    }
    if (lesson.show_alphabet_grid && this.alphabet.length) {
      const cells = this.alphabet
        .map(
          (row) =>
            `<div class="alphabet-letter" lang="ar"><span>${escapeHtml(row.letter)}</span><span class="letter-name">${escapeHtml(row.name_en)}</span></div>`,
        )
        .join("");
      extra += `<div class="alphabet-grid">${cells}</div>`;
    }
    if (Array.isArray(lesson.tap_to_hear) && lesson.tap_to_hear.length) {
      const buttons = lesson.tap_to_hear
        .map(
          (g) =>
            `<button class="lesson-tap-letter" data-speak="${escapeHtml(g)}" type="button">${escapeHtml(g)}</button>`,
        )
        .join("");
      extra += `<div class="lesson-tap-row">${buttons}</div>`;
    }
    if (Array.isArray(lesson.tap_letters) && lesson.tap_letters.length) {
      const map = new Map(this.alphabet.map((r) => [r.id, r]));
      const buttons = lesson.tap_letters
        .map((id) => {
          const row = map.get(id);
          if (!row) return "";
          return `<button class="lesson-tap-letter" data-speak="${escapeHtml(row.letter)}" data-name="${escapeHtml(row.name_en)}" title="${escapeHtml(row.name_en)}" type="button">${escapeHtml(row.letter)}</button>`;
        })
        .join("");
      extra += `<div class="lesson-tap-row">${buttons}</div>`;
    }
    if (lesson.letter_id && this.alphabet.length) {
      const row = this.alphabet.find((r) => r.id === lesson.letter_id);
      if (row) {
        extra += `<div class="lesson-letter-display" lang="ar">${escapeHtml(row.letter)}</div>`;
      }
    }

    this.overlay.innerHTML = `
      <div class="lesson-card">
        <div class="lesson-step">Step ${this.index + 1} of ${this.lessons.length}</div>
        <h2 class="lesson-title">${escapeHtml(lesson.title || "")}</h2>
        <div class="lesson-body">${renderMd(lesson.body_md || "")}</div>
        ${extra}
        <div class="lesson-progress-dots">${dots}</div>
        <div class="lesson-actions">
          <button class="lesson-btn is-secondary" data-act="back" type="button" ${this.index === 0 ? "disabled" : ""}>Back</button>
          <button class="lesson-btn is-ghost" data-act="skip" type="button">Skip intro</button>
          <button class="lesson-btn" data-act="next" type="button">${isLast ? "Begin" : "Next"}</button>
        </div>
      </div>
    `;

    this.overlay.querySelectorAll("[data-speak]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const text = btn.getAttribute("data-speak") || "";
        const name = btn.getAttribute("data-name") || "";
        if (!text) return;
        try {
          this.hostApi.speak("ar", text);
        } catch {
          /* TTS failure tolerated. */
        }
        // Brief visual confirmation that the tap registered.
        btn.style.transform = "scale(1.08)";
        setTimeout(() => {
          btn.style.transform = "";
        }, 180);
      });
    });

    this.overlay
      .querySelector('[data-act="back"]')
      .addEventListener("click", () => {
        this.index = Math.max(0, this.index - 1);
        writeProgress(this.index);
        this._render();
      });
    this.overlay
      .querySelector('[data-act="skip"]')
      .addEventListener("click", () => {
        writeSkipped(true);
        writeProgress(this.lessons.length);
        this._finish();
      });
    this.overlay
      .querySelector('[data-act="next"]')
      .addEventListener("click", () => {
        this.index += 1;
        writeProgress(this.index);
        if (this.index >= this.lessons.length) {
          this._finish();
        } else {
          this._render();
        }
      });
  }

  _finish() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    // If lesson 6 has a letter_id, pass it back so main.js can preload it.
    const last = this.lessons[this.lessons.length - 1] || {};
    const initialLetter = last.letter_id || null;
    writeProgress(this.lessons.length);
    if (typeof this.onComplete === "function") {
      try {
        this.onComplete({ initialLetter });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[rasmapan] lesson onComplete failed", err);
      }
    }
  }
}

export const resetLessonProgress = () => {
  writeProgress(0);
  writeSkipped(false);
};
