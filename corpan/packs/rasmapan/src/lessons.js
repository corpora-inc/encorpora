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
// 28 canonical base-form Arabic codepoints. The DB carries
// presentation-form glyphs (U+FE-range) in the `letter` column,
// which most system Arabic TTS engines can't pronounce as
// standalone characters. We map family id → base codepoint here
// so tap-to-hear plays the speakable letter.
const BASE_LETTER_BY_FAMILY = {
  alif: "ا", baa: "ب", taa: "ت", thaa: "ث",
  jiim: "ج", Haa: "ح", khaa: "خ", daal: "د",
  dhaal: "ذ", raa: "ر", zaay: "ز", siin: "س",
  shiin: "ش", Saad: "ص", Daad: "ض", Taa: "ط",
  DHaa: "ظ", ain: "ع", ghain: "غ", faa: "ف",
  qaaf: "ق", kaaf: "ك", laam: "ل", miim: "م",
  nuun: "ن", haa: "ه", waaw: "و", yaa: "ي",
};

const queryAlphabet = async (queryPackDb) => {
  if (!queryPackDb) return [];
  // Try the new schema first (with `base_letter`); fall back to
  // legacy if a stale cached connection doesn't have that column.
  try {
    const result = await queryPackDb({
      sql:
        "SELECT id, letter, base_letter, name_en FROM arabic_letter " +
        "WHERE position = 'isolated' ORDER BY frequency DESC NULLS LAST, id",
    });
    const rows = result.rows || [];
    if (rows.length) {
      return rows.map((r) => ({
        ...r,
        speak_letter: r.base_letter || BASE_LETTER_BY_FAMILY[r.id] || r.letter,
      }));
    }
  } catch {
    /* fall through to legacy schema */
  }
  try {
    const legacy = await queryPackDb({
      sql:
        "SELECT id, letter, name_en FROM arabic_letter " +
        "WHERE position = 'isolated' ORDER BY frequency DESC NULLS LAST, id",
    });
    return (legacy.rows || []).map((r) => ({
      ...r,
      speak_letter: BASE_LETTER_BY_FAMILY[r.id] || r.letter,
    }));
  } catch {
    return [];
  }
};

// Lesson chrome strings (Back, Skip, Next, Begin, step counter)
// come from the shared rasmapan i18next namespace. Lesson body
// copy (`lesson.title` / `lesson.body_md`) still ships inside the
// pack DB per-language; we pick which language to display via
// `currentLanguage()` so it tracks the host's UI language.
import { t, currentLanguage } from "./i18n.js";

// Speak wrapper — prefers `speakConcurrent` when available, falls
// back to `speak`. Same pattern as main.js (juice-squeeze).
const makeSpeak = (hostApi) => (lang, text) => {
  if (!text) return;
  if (typeof hostApi.speakConcurrent === "function") {
    try { hostApi.speakConcurrent(lang, text); return; } catch { /* fall through */ }
  }
  try { hostApi.speak(lang, text); } catch { /* tolerated */ }
};

export class LessonRunner {
  constructor({ container, hostApi, queryPackDb, packBaseUrl, onComplete }) {
    this.container = container;
    this.hostApi = hostApi;
    this.queryPackDb = queryPackDb;
    this.packBaseUrl = packBaseUrl || "";
    this.onComplete = onComplete;
    this.lessons = [];
    this.alphabet = [];
    this.index = 0;
    this.overlay = null;
    this.speak = makeSpeak(hostApi);
  }

  _assetUrl(rel) {
    if (!rel) return "";
    if (/^https?:/.test(rel) || rel.startsWith("data:")) return rel;
    const base = this.packBaseUrl.endsWith("/")
      ? this.packBaseUrl
      : `${this.packBaseUrl}/`;
    return `${base}assets/styles/${rel}`;
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

  // Pull the localized field out of `lesson.i18n[<lang>]` when
  // present; fall back to the field's bare value (legacy
  // English-only) on the lesson record. The active language tracks
  // host i18next via `currentLanguage()`, so changing the user's
  // primary in corpan immediately picks up a matching variant.
  _localized(lesson, field) {
    const langs = Object.keys(lesson.i18n || {});
    if (langs.length) {
      const cur = currentLanguage();
      // Direct match.
      if (lesson.i18n[cur] && lesson.i18n[cur][field] != null) {
        return lesson.i18n[cur][field];
      }
      // Locale-base fallback ("ko-polite" → "ko").
      const base = cur.split("-")[0];
      if (lesson.i18n[base] && lesson.i18n[base][field] != null) {
        return lesson.i18n[base][field];
      }
      // English fallback.
      if (lesson.i18n.en && lesson.i18n.en[field] != null) {
        return lesson.i18n.en[field];
      }
    }
    return lesson[field];
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

    const title = this._localized(lesson, "title") || "";
    const body_md = this._localized(lesson, "body_md") || "";
    const highlightCaption = this._localized(lesson, "highlight_caption") || "";

    let extra = "";
    if (lesson.highlight_ar) {
      extra += `
        <div class="lesson-highlight">${escapeHtml(lesson.highlight_ar)}</div>
        ${highlightCaption ? `<div class="lesson-caption">${escapeHtml(highlightCaption)}</div>` : ""}
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
          // data-speak uses the base codepoint (speakable by TTS);
          // visible text remains the display glyph (which may be a
          // presentation form). For most Arabic-isolated forms the
          // two are the same character.
          return `<button class="lesson-tap-letter" data-speak="${escapeHtml(row.speak_letter || row.letter)}" data-name="${escapeHtml(row.name_en)}" title="${escapeHtml(row.name_en)}" type="button">${escapeHtml(row.letter)}</button>`;
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
    // Calligraphic-style lesson — show the Arabic style name + a sample
    // panel (image when the pack ships one, otherwise the "بسم الله"
    // text in Amiri). Used by lessons 7–10 (naskh/thuluth/diwani/kufic).
    if (lesson.type === "style") {
      const sample = lesson.sample_image
        ? `<div class="lesson-style-sample"><img class="lesson-style-sample-img" src="${escapeHtml(this._assetUrl(lesson.sample_image))}" alt="" loading="lazy" /></div>`
        : `<div class="lesson-style-sample lesson-style-sample-text" lang="ar">بسم الله</div>`;
      const nameAr = lesson.name_ar
        ? `<div class="lesson-style-name-ar" lang="ar">${escapeHtml(lesson.name_ar)}</div>`
        : "";
      extra += `${nameAr}${sample}`;
    }

    const stepLabel = t("lesson.step", {
      n: this.index + 1,
      total: this.lessons.length,
    });
    const backLabel = t("lesson.back");
    const skipLabel = t("lesson.skip");
    const nextLabel = isLast ? t("lesson.begin") : t("lesson.next");

    this.overlay.innerHTML = `
      <div class="lesson-card">
        <div class="lesson-step">${escapeHtml(stepLabel)}</div>
        <h2 class="lesson-title">${escapeHtml(title)}</h2>
        <div class="lesson-body">${renderMd(body_md)}</div>
        ${extra}
        <div class="lesson-progress-dots">${dots}</div>
        <div class="lesson-actions">
          <button class="lesson-btn is-secondary" data-act="back" type="button" ${this.index === 0 ? "disabled" : ""}>${escapeHtml(backLabel)}</button>
          <button class="lesson-btn is-ghost" data-act="skip" type="button">${escapeHtml(skipLabel)}</button>
          <button class="lesson-btn" data-act="next" type="button">${escapeHtml(nextLabel)}</button>
        </div>
      </div>
    `;

    this.overlay.querySelectorAll("[data-speak]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const text = btn.getAttribute("data-speak") || "";
        if (!text) return;
        this.speak("ar", text);
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
      .addEventListener("click", () => this._advance(1));

    this._wireSwipe();
  }

  // Advance the lesson by ±1 and persist progress. Used by both the
  // Next/Back buttons and the swipe handler so all three flow through
  // identical state.
  _advance(delta) {
    const target = this.index + delta;
    if (target < 0) return;
    this.index = target;
    writeProgress(this.index);
    if (this.index >= this.lessons.length) {
      this._finish();
    } else {
      this._render();
    }
  }

  // Touch/pointer swipe on the lesson card. Horizontal drag past
  // ~48px (and dominant over vertical movement) calls _advance. We
  // wire to the card rather than the overlay so vertical scrolling
  // inside long lesson bodies still works on the surrounding
  // scrollable area. In RTL primary languages we could swap the
  // direction, but the dots / buttons already convey direction; we
  // keep "swipe left = next" universally so muscle memory carries
  // between the chrome arrows and the gesture.
  _wireSwipe() {
    const card = this.overlay.querySelector(".lesson-card");
    if (!card) return;
    let startX = 0;
    let startY = 0;
    let tracking = false;
    let pointerId = null;
    const THRESHOLD = 48;

    const onDown = (e) => {
      // Ignore drags that start on a button — those have their own
      // click handler and shouldn't be hijacked into a swipe.
      if (e.target.closest("button, a, input, textarea, select")) return;
      tracking = true;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
    };
    const onUp = (e) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) < THRESHOLD) return;
      if (Math.abs(dy) > Math.abs(dx)) return;
      if (dx < 0) this._advance(1);
      else this._advance(-1);
    };
    const onCancel = () => { tracking = false; };

    card.addEventListener("pointerdown", onDown);
    card.addEventListener("pointerup", onUp);
    card.addEventListener("pointercancel", onCancel);
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
