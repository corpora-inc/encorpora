/**
 * Founder review desk. The film plays in the existing live player, embedded
 * same-origin. Grade controls inside the player are hidden.
 *
 * One score and one feedback box. The box is the review summary. Timestamped
 * notes already stored stay in the saved review and are not shown or edited.
 *
 *   review.html?id=<film>&list=lab|prod|one|line
 *
 * There is one review queue, the page one level above this one. Every way out
 * of a review leads there, and a link that lost its film opens it.
 */
import "../src/web/ui/tokens.css";
import "./review.css";

type Note = { t: number; text: string };
type Review = { score: number | null; summary: string; notes: Note[]; added?: string };
type Row = { id: string; title?: string; added?: string };

const $ = <T extends HTMLElement>(tag: string, cls: string, parent: HTMLElement, text = "") => {
  const e = document.createElement(tag) as T;
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  parent.appendChild(e);
  return e;
};

const QUEUE = "../";
const params = new URLSearchParams(location.search);
const id = params.get("id") ?? "";
const app = document.getElementById("app")!;

function themeNow() {
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function hideGrades(doc: Document) {
  if (doc.getElementById("review-quiet")) return;
  const style = doc.createElement("style");
  style.id = "review-quiet";
  style.textContent = ".live-grade-btn,.live-sheet,.live-sheet-card{display:none!important}";
  (doc.head ?? doc.documentElement).appendChild(style);
}

function syncTheme(frame: HTMLIFrameElement) {
  const doc = frame.contentDocument;
  if (!doc) return;
  doc.documentElement.dataset.theme = document.documentElement.dataset.theme || themeNow();
  hideGrades(doc);
}

async function loadList(name: string): Promise<Row[]> {
  if (!name) return [];
  try {
    const res = await fetch(`${name}.html`);
    if (!res.ok) return [];
    const html = await res.text();
    const embedded = html.match(/const films=(\[[\s\S]*?\]);/);
    if (embedded) {
      const rows = JSON.parse(embedded[1]) as Row[];
      if (Array.isArray(rows)) return rows.filter((r) => r && typeof r.id === "string");
    }
    return [...html.matchAll(/data-film="([a-z0-9-]+)"/g)].map((m) => ({ id: m[1] }));
  } catch {
    return [];
  }
}

function hasScore(entry: Review | undefined, added: string | undefined) {
  if (!entry || typeof entry.score !== "number") return false;
  if (added && entry.added && entry.added !== added) return false;
  return true;
}

function keptNotes(raw: unknown): Note[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((n): n is Note => !!n && typeof n.t === "number" && typeof n.text === "string");
}

if (!/^[a-z0-9-]+$/.test(id)) {
  location.replace(QUEUE);
} else {
  void openReview(id);
}

async function openReview(filmId: string) {
  const review: Review = { score: null, summary: "", notes: [] };
  let ready = false;
  let listName = params.get("list") ?? "";
  if (!["lab", "prod", "one", "line"].includes(listName)) {
    const ref = document.referrer;
    listName = ref.includes("line.html") ? "line" : ref.includes("lab.html") ? "lab" : ref.includes("one.html") ? "one" : ref.includes("prod.html") ? "prod" : "";
  }

  const root = $("div", "review", app);
  const slot = $("div", "player-slot", root);
  // The button lives in its own row above the picture, never over it.
  const tools = $("div", "film-tools", slot);
  const full = $<HTMLButtonElement>("button", "btn film-full", tools, "Full screen");
  full.type = "button";
  const frame = $<HTMLIFrameElement>("iframe", "", slot);
  frame.title = "Lesson film";
  frame.src = `index.html?id=${encodeURIComponent(filmId)}`;
  const panel = $("div", "panel", root);

  const phone = () => matchMedia("(max-width: 767px)").matches;
  const filled = () => slot.classList.contains("is-fill");
  const covering = () => document.fullscreenElement === slot || filled();

  const paintFull = () => {
    const on = covering();
    full.textContent = on ? "Exit" : "Full screen";
    full.setAttribute("aria-pressed", String(on));
    full.setAttribute("aria-label", on ? "Exit full screen" : "Full screen");
  };

  // The tall stage is 1080×1920. The slot is that frame at the screen's width, plus the player's own bar.
  // Fit on the next frame so the width has settled after a viewport change.
  let barWatch: ResizeObserver | undefined;
  let fitQueued = false;
  const fitPhone = () => {
    if (fitQueued) return;
    fitQueued = true;
    requestAnimationFrame(() => {
      fitQueued = false;
      if (!phone() || covering()) {
        slot.style.height = "";
        return;
      }
      const width = slot.clientWidth;
      if (width < 1) return;
      const bar = frame.contentDocument?.querySelector(".live-bar");
      const measured = bar ? bar.getBoundingClientRect().height : 0;
      const barH = measured > 1 ? Math.ceil(measured) : 160;
      const next = Math.ceil(width * (1920 / 1080) + barH + tools.getBoundingClientRect().height);
      const cur = parseFloat(slot.style.height);
      if (!Number.isFinite(cur) || Math.abs(cur - next) > 1) slot.style.height = `${next}px`;
    });
  };
  const watchBar = () => {
    barWatch?.disconnect();
    const bar = frame.contentDocument?.querySelector(".live-bar");
    if (bar) {
      barWatch = new ResizeObserver(() => fitPhone());
      barWatch.observe(bar);
    }
    fitPhone();
  };

  const pin = () => {
    // On a phone the film keeps its width-based size and the note scrolls under it.
    if (phone()) {
      root.style.top = "";
      root.style.height = "";
      fitPhone();
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;
    root.style.top = `${vv.offsetTop}px`;
    root.style.height = `${vv.height}px`;
  };
  window.visualViewport?.addEventListener("resize", pin);
  window.visualViewport?.addEventListener("scroll", pin);
  window.addEventListener("resize", pin);
  frame.addEventListener("load", watchBar);
  pin();

  const enterFallback = () => {
    slot.classList.add("is-fill");
    slot.style.height = "";
    paintFull();
  };
  const leaveCover = () => {
    slot.classList.remove("is-fill");
    paintFull();
    fitPhone();
  };
  full.onclick = () => {
    if (document.fullscreenElement === slot) {
      void document.exitFullscreen();
      return;
    }
    if (filled()) {
      leaveCover();
      return;
    }
    const open = slot.requestFullscreen?.bind(slot);
    if (!open) {
      enterFallback();
      return;
    }
    slot.style.height = "";
    void open().then(paintFull).catch(() => enterFallback());
  };
  document.addEventListener("fullscreenchange", () => {
    if (document.fullscreenElement === slot) {
      slot.style.height = "";
      paintFull();
      return;
    }
    leaveCover();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && filled()) leaveCover();
  });
  paintFull();

  const applyTheme = () => {
    document.documentElement.dataset.theme = themeNow();
    syncTheme(frame);
  };
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
  frame.addEventListener("load", () => syncTheme(frame));

  const head = $("div", "panel-head", panel);
  const titles = $("div", "panel-titles", head);
  const kicker = $("p", "panel-kicker", titles);
  const back = $<HTMLAnchorElement>("a", "", kicker, "Review queue");
  back.href = QUEUE;
  const title = $("h1", "panel-title", titles, "Lesson film");
  const next = $<HTMLButtonElement>("button", "btn btn-next", head, "Next film");
  next.type = "button";
  next.disabled = true;

  const score = $("div", "score", panel);
  score.dataset.set = "false";
  const scoreHead = $("div", "score-head", score);
  $("span", "score-kicker", scoreHead, "Score");
  const scoreNum = $("span", "score-num", scoreHead, "5");
  const caption = $("p", "score-caption", score, "Not scored");
  const slider = $("div", "score-slider", score);
  slider.tabIndex = 0;
  slider.setAttribute("role", "slider");
  slider.setAttribute("aria-label", "Score from 1 to 10");
  slider.setAttribute("aria-valuemin", "1");
  slider.setAttribute("aria-valuemax", "10");
  slider.setAttribute("aria-valuetext", "Not scored, shown at 5");
  const track = $("div", "score-track", slider);
  const fill = $("div", "score-fill", track);
  const thumb = $("div", "score-thumb", track);
  const ends = $("div", "score-ends", score);
  $("span", "", ends, "1");
  $("span", "", ends, "10");

  const feedback = $("div", "feedback", panel);
  const feedbackLabel = $<HTMLLabelElement>("label", "block-label", feedback, "Feedback");
  feedbackLabel.htmlFor = "feedback";
  const box = $<HTMLTextAreaElement>("textarea", "field", feedback);
  box.id = "feedback";
  box.placeholder = "Anything you notice. A timestamp is fine if it helps.";
  box.rows = 8;
  box.maxLength = 4000;
  box.disabled = true;

  const saveLine = $("div", "save-line", panel);
  saveLine.setAttribute("role", "status");
  const saveText = $("span", "save-text", saveLine, "");
  saveText.setAttribute("aria-live", "polite");
  const retry = $<HTMLButtonElement>("button", "btn save-retry", saveLine, "Retry");
  retry.type = "button";
  retry.hidden = true;

  const paintScore = () => {
    const set = typeof review.score === "number";
    const shown = set ? review.score! : 5;
    score.dataset.set = String(set);
    scoreNum.textContent = String(shown);
    caption.textContent = set ? "\u00a0" : "Not scored";
    const at = (shown - 1) / 9;
    fill.style.width = `${at * 100}%`;
    thumb.style.left = `${at * 100}%`;
    if (set) {
      slider.setAttribute("aria-valuenow", String(shown));
      slider.setAttribute("aria-valuetext", String(shown));
    } else {
      slider.removeAttribute("aria-valuenow");
      slider.setAttribute("aria-valuetext", "Not scored, shown at 5");
    }
  };

  let flight = false;
  let again = false;

  const setStatus = (state: "saving" | "saved" | "error" | "idle") => {
    saveLine.classList.toggle("is-bad", state === "error");
    retry.hidden = state !== "error";
    saveText.textContent = state === "saving" ? "Saving" : state === "saved" ? "Saved" : state === "error" ? "Could not save." : "\u00a0";
  };

  async function flush() {
    if (flight) {
      again = true;
      return;
    }
    flight = true;
    again = false;
    setStatus("saving");
    const body = { id: filmId, score: review.score, summary: review.summary, notes: review.notes, added: review.added ?? "" };
    try {
      const res = await fetch("review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await res.text());
      if (!again) setStatus("saved");
    } catch {
      setStatus("error");
    } finally {
      flight = false;
      if (again) void flush();
    }
  }
  retry.onclick = () => void flush();

  let scoreTimer = 0;
  const setScore = (n: number, save: boolean) => {
    if (!ready) return;
    const nextScore = Math.min(10, Math.max(1, Math.round(n)));
    const changed = review.score !== nextScore;
    review.score = nextScore;
    paintScore();
    if (!changed) {
      if (save) void flush();
      return;
    }
    if (!save) {
      window.clearTimeout(scoreTimer);
      scoreTimer = window.setTimeout(() => void flush(), 120);
      return;
    }
    window.clearTimeout(scoreTimer);
    void flush();
  };

  const valueFrom = (clientX: number) => {
    const rect = track.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width || 1);
    return 1 + (x / (rect.width || 1)) * 9;
  };
  let dragging = false;
  slider.addEventListener("pointerdown", (e) => {
    dragging = true;
    slider.setPointerCapture(e.pointerId);
    setScore(valueFrom(e.clientX), false);
  });
  slider.addEventListener("pointermove", (e) => {
    if (dragging) setScore(valueFrom(e.clientX), false);
  });
  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    if (!ready) return;
    window.clearTimeout(scoreTimer);
    void flush();
  };
  slider.addEventListener("pointerup", endDrag);
  slider.addEventListener("pointercancel", endDrag);
  slider.addEventListener("keydown", (e) => {
    const cur = review.score ?? 5;
    const step: Record<string, number> = { ArrowRight: cur + 1, ArrowUp: cur + 1, ArrowLeft: cur - 1, ArrowDown: cur - 1, Home: 1, End: 10 };
    if (e.key in step) {
      e.preventDefault();
      setScore(step[e.key], true);
    }
  });

  let textTimer = 0;
  box.addEventListener("input", () => {
    review.summary = box.value;
    window.clearTimeout(textTimer);
    textTimer = window.setTimeout(() => {
      textTimer = 0;
      void flush();
    }, 400);
  });
  box.addEventListener("blur", () => {
    if (!textTimer) return;
    window.clearTimeout(textTimer);
    textTimer = 0;
    void flush();
  });

  paintScore();
  setStatus("idle");

  const names = listName ? [listName] : ["prod", "lab", "one", "line"];
  const noReviews: Record<string, Review> = {};
  const [loaded, catalog, savedAll] = await Promise.all([
    Promise.all(names.map(async (name) => ({ name, rows: await loadList(name) }))),
    fetch("data/index.json").then((r) => (r.ok ? (r.json() as Promise<Row[]>) : [])).catch(() => [] as Row[]),
    fetch("review").then((r) => (r.ok ? (r.json() as Promise<Record<string, Review>>) : noReviews)).catch(() => noReviews),
  ]);

  let rows: Row[] = [];
  if (listName) rows = loaded[0]?.rows ?? [];
  else {
    const hit = loaded.find((list) => list.rows.some((row) => row.id === filmId));
    if (hit) {
      listName = hit.name;
      rows = hit.rows;
    }
  }
  const row = rows.find((r) => r.id === filmId) ?? catalog.find((r) => r.id === filmId);
  if (row?.title) {
    title.textContent = row.title;
    document.title = `Review · ${row.title}`;
  }
  review.added = row?.added ?? "";

  const stored = savedAll[filmId];
  const fresh = stored && (!review.added || !stored.added || stored.added === review.added);
  if (fresh && stored) {
    review.score = typeof stored.score === "number" ? stored.score : null;
    review.summary = stored.summary ?? "";
    review.notes = keptNotes(stored.notes);
    box.value = review.summary;
    paintScore();
  }
  ready = true;
  box.disabled = false;

  const goNext = () => {
    if (!rows.length) return null;
    const start = Math.max(0, rows.findIndex((r) => r.id === filmId));
    for (let i = 1; i <= rows.length; i++) {
      const candidate = rows[(start + i) % rows.length];
      if (candidate.id === filmId) continue;
      const entry = savedAll[candidate.id];
      if (!hasScore(entry, candidate.added)) return candidate.id;
    }
    return null;
  };
  const armNext = () => {
    const target = goNext();
    next.disabled = false;
    next.textContent = target ? "Next film" : "Back to the queue";
    next.onclick = () => {
      location.href = target ? `review.html?id=${encodeURIComponent(target)}&list=${encodeURIComponent(listName)}` : QUEUE;
    };
  };
  armNext();
}
