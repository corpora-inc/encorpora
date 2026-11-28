/**
 * The crane lesson films for review: a list, and each film at its own path
 * (`<base>/<film-id>/`), played live by the lesson-film player with the crane
 * figures and the crane app's look. The data is what export-live writes:
 * `<base>/data/index.json`, `<id>.json` and `<id>.m4a`.
 *
 *   npx vite build --config ../crane/film/review/vite.config.ts --outDir <dir> --base /lesson-films/crane/   (from amp/)
 */
import "../../../amp/film/film.css";
import "../../../amp/film/live.css";
import "../theme.css";
import "./review.css";
import { mountFilmPlayer, filmClock } from "../../../amp/film/player";
import { mountShot } from "../shot";

type Row = { id: string; title: string; seconds: number; skill?: string; added?: string };
const BASE = import.meta.env.BASE_URL;
const $ = <T extends HTMLElement>(tag: string, cls: string, parent: HTMLElement, text = "") => {
  const e = document.createElement(tag) as T;
  e.className = cls;
  if (text) e.textContent = text;
  parent.appendChild(e);
  return e;
};

async function list(app: HTMLElement) {
  const r = await fetch(`${BASE}data/index.json`, { cache: "no-store" });
  if (!r.ok) throw new Error("the film list is unavailable");
  const rows = ((await r.json()) as Row[]).sort((a, b) => (b.added ?? "").localeCompare(a.added ?? ""));
  const page = $("main", "cr-index", app);
  $("p", "cr-kicker", page, "Crane exam prep");
  $("h1", "cr-title", page, "Lesson films");
  for (const row of rows) {
    const a = $<HTMLAnchorElement>("a", "cr-card", page);
    a.href = `${BASE}${encodeURIComponent(row.id)}/`;
    $("span", "cr-card-title", a, row.title);
    $("span", "cr-card-meta", a, [row.skill, filmClock(row.seconds)].filter(Boolean).join(" · "));
  }
  if (!rows.length) $("p", "cr-empty", page, "No films yet.");
}

function play(app: HTMLElement, id: string) {
  const dispose = mountFilmPlayer(app, {
    dataUrl: `${BASE}data/${encodeURIComponent(id)}.json`,
    audioUrl: `${BASE}data/${encodeURIComponent(id)}.m4a`,
    backHref: BASE,
    backLabel: "All films",
    fullscreen: true,
    mountFigure: (_figure, host, shot, actions) => mountShot(host, shot, actions),
  });
  window.addEventListener("pagehide", (event) => { if (!event.persisted) dispose(); });
}

const app = document.getElementById("app")!;
const rest = location.pathname.startsWith(BASE) ? location.pathname.slice(BASE.length) : "";
const id = decodeURIComponent(rest.replace(/\/(index\.html)?$/, ""));
if (id) play(app, id);
else list(app).catch((e) => {
  console.error("crane film list failed", e);
  $("p", "cr-error", app, `The films could not load: ${(e as Error).message}. Reload to try again.`);
});
