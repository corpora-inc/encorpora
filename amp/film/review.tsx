/**
 * Founder review desk. The film plays in the existing live player, embedded
 * same-origin, so this page can read the playback time and seek without
 * editing the player. Grade controls inside the player are hidden.
 *
 *   review.html?id=<film>&list=lab|prod|one
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

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const roundT = (s: number) => Math.round(s * 100) / 100;

const params = new URLSearchParams(location.search);
const id = params.get("id") ?? "";
const app = document.getElementById("app")!;

function themeNow() {
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

type LiveApi = { time?: () => number; seek?: (t: number) => void; audio?: HTMLAudioElement };
type LiveWindow = Window & { __live?: LiveApi };

function bridge(frame: HTMLIFrameElement) {
  const win = frame.contentWindow as LiveWindow | null;
  const doc = frame.contentDocument;
  if (!win || !doc) return null;
  const scrub = doc.querySelector<HTMLInputElement>("input.live-scrub, input[aria-label='Position']");
  const audio = doc.querySelector("audio") ?? win.__live?.audio ?? null;
  const api = win.__live;
  return {
    time() {
      if (api?.time) return api.time();
      if (scrub) return Number(scrub.value) || 0;
      return audio?.currentTime || 0;
    },
    seek(t: number) {
      if (api?.seek) {
        api.seek(t);
        return;
      }
      if (scrub) {
        scrub.value = String(t);
        scrub.dispatchEvent(new Event("input", { bubbles: true }));
        scrub.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }
      if (audio) audio.currentTime = t;
    },
  };
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

if (!/^[a-z0-9-]+$/.test(id)) {
  const page = $("main", "panel empty", app);
  $("h1", "panel-title", page, "This review link needs a film.");
  const back = $<HTMLAnchorElement>("a", "", page, "All films");
  back.href = "./";
} else {
  void openReview(id);
}

async function openReview(filmId: string) {
  const review: Review = { score: null, summary: "", notes: [] };
  let draftT: number | null = null;
  let ready = false;
  let listName = params.get("list") ?? "";
  if (!["lab", "prod", "one"].includes(listName)) {
    const ref = document.referrer;
    listName = ref.includes("lab.html") ? "lab" : ref.includes("one.html") ? "one" : ref.includes("prod.html") ? "prod" : "";
  }

  const root = $("div", "review", app);
  const slot = $("div", "player-slot", root);
  const frame = $<HTMLIFrameElement>("iframe", "", slot);
  frame.title = "Lesson film";
  frame.src = `index.html?id=${encodeURIComponent(filmId)}`;
  const panel = $("div", "panel", root);

  const pin = () => {
    const vv = window.visualViewport;
    if (!vv) return;
    root.style.top = `${vv.offsetTop}px`;
    root.style.height = `${vv.height}px`;
  };
  window.visualViewport?.addEventListener("resize", pin);
  window.visualViewport?.addEventListener("scroll", pin);
  pin();

  const applyTheme = () => {
    document.documentElement.dataset.theme = themeNow();
    syncTheme(frame);
  };
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
  frame.addEventListener("load", () => syncTheme(frame));

  const head = $("div", "panel-head", panel);
  const titles = $("div", "panel-titles", head);
  const kicker = $("p", "panel-kicker", titles);
  const back = $<HTMLAnchorElement>("a", "", kicker, "All films");
  back.href = "./";
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

  const notesLabel = $<HTMLLabelElement>("label", "block-label", panel, "Notes");
  notesLabel.htmlFor = "note-draft";
  const draft = $("div", "draft", panel);
  const box = $<HTMLTextAreaElement>("textarea", "field", draft);
  box.id = "note-draft";
  box.placeholder = "Type while it plays. Enter saves this moment.";
  box.rows = 2;
  box.maxLength = 2000;
  box.disabled = true;
  const add = $<HTMLButtonElement>("button", "btn btn-add", draft, "Add");
  add.type = "button";
  add.disabled = true;
  const stamp = $("p", "stamp", panel, "");

  const list = $<HTMLUListElement>("ul", "notes", panel);

  const summaryLabel = $<HTMLLabelElement>("label", "block-label", panel, "Overall note");
  summaryLabel.htmlFor = "summary";
  const summary = $<HTMLTextAreaElement>("textarea", "field summary", panel);
  summary.id = "summary";
  summary.placeholder = "Optional. One note for the whole film.";
  summary.rows = 3;
  summary.maxLength = 4000;
  summary.disabled = true;

  const saveLine = $("div", "save-line", panel);
  saveLine.setAttribute("role", "status");
  const saveText = $("span", "save-text", saveLine, "");
  saveText.setAttribute("aria-live", "polite");
  const retry = $<HTMLButtonElement>("button", "btn save-retry", saveLine, "Retry");
  retry.type = "button";
  retry.hidden = true;

  const player = () => bridge(frame);
  const readTime = () => player()?.time() ?? 0;

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

  const showStamp = () => {
    stamp.textContent = draftT === null || !box.value ? "" : `At ${clock(draftT)}`;
  };

  let flight = false;
  let again = false;

  const setStatus = (state: "saving" | "saved" | "error" | "idle") => {
    saveLine.classList.toggle("is-bad", state === "error");
    retry.hidden = state !== "error";
    saveText.textContent = state === "saving" ? "Saving" : state === "saved" ? "Saved" : state === "error" ? "Could not save." : "";
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

  const renderNotes = () => {
    list.replaceChildren();
    for (const [index, note] of review.notes.entries()) {
      const li = $<HTMLLIElement>("li", "note", list);
      const time = $<HTMLButtonElement>("button", "note-time", li, clock(note.t));
      time.type = "button";
      time.dataset.t = String(note.t);
      time.setAttribute("aria-label", `Play from ${clock(note.t)}`);
      time.onclick = () => player()?.seek(note.t);
      const edit = $<HTMLButtonElement>("button", "btn btn-quiet note-edit", li, "Edit");
      edit.type = "button";
      const del = $<HTMLButtonElement>("button", "btn btn-quiet note-delete", li, "Delete");
      del.type = "button";
      const text = $("p", "note-text", li, note.text);
      edit.onclick = () => {
        const field = $<HTMLTextAreaElement>("textarea", "field note-edit-field", li);
        field.value = note.text;
        field.maxLength = 2000;
        text.replaceWith(field);
        field.focus();
        edit.textContent = "Save";
        del.textContent = "Cancel";
        const finish = (keep: boolean) => {
          if (keep) {
            const trimmed = field.value.trim();
            if (!trimmed) review.notes.splice(index, 1);
            else review.notes[index] = { ...note, text: trimmed };
            void flush();
          }
          renderNotes();
        };
        edit.onclick = () => finish(true);
        del.onclick = () => finish(false);
        field.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
            e.preventDefault();
            finish(true);
          } else if (e.key === "Escape") {
            e.preventDefault();
            finish(false);
          }
        });
      };
      del.onclick = () => {
        review.notes.splice(index, 1);
        renderNotes();
        void flush();
      };
    }
  };

  const commitDraft = () => {
    const text = box.value.trim();
    if (!text) return;
    const t = roundT(draftT ?? readTime());
    review.notes.push({ t, text });
    review.notes.sort((a, b) => a.t - b.t);
    box.value = "";
    draftT = null;
    showStamp();
    renderNotes();
    void flush();
  };

  box.addEventListener("beforeinput", () => {
    if (draftT === null) draftT = readTime();
  });
  box.addEventListener("input", () => {
    if (!box.value) draftT = null;
    showStamp();
  });
  box.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      commitDraft();
    }
  });
  add.onclick = () => commitDraft();

  let summaryTimer = 0;
  summary.addEventListener("input", () => {
    review.summary = summary.value;
    window.clearTimeout(summaryTimer);
    summaryTimer = window.setTimeout(() => void flush(), 400);
  });

  paintScore();

  const names = listName ? [listName] : ["prod", "lab", "one"];
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
  if (listName) {
    back.href = `${listName}.html`;
    back.textContent = listName === "lab" ? "Model comparison" : listName === "one" ? "One at a time" : "Lesson films";
  }
  review.added = row?.added ?? "";

  const stored = savedAll[filmId];
  const fresh = stored && (!review.added || !stored.added || stored.added === review.added);
  if (fresh && stored) {
    review.score = typeof stored.score === "number" ? stored.score : null;
    review.summary = stored.summary ?? "";
    review.notes = Array.isArray(stored.notes) ? stored.notes.filter((n: Note) => n && typeof n.t === "number" && typeof n.text === "string") : [];
    summary.value = review.summary;
    paintScore();
    renderNotes();
  }
  ready = true;
  box.disabled = false;
  add.disabled = false;
  summary.disabled = false;

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
    next.disabled = !target;
    next.textContent = "Next film";
    next.onclick = () => {
      if (target) location.href = `review.html?id=${encodeURIComponent(target)}&list=${encodeURIComponent(listName)}`;
    };
  };
  armNext();
}
