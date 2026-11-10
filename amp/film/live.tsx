/**
 * A lesson film played live: the screenplay drawn by the same stage the
 * renderer uses, clocked by the narration. No video: about 1 MB per lesson,
 * sharp at any size.
 *
 *   /?id=<template-id>   loads data/<id>.json and data/<id>.m4a beside this page
 */
import "../src/web/app/styles";
import "./film.css";
import "./live.css";
import { mountFilmPlayer } from "./player";

const $ = <T extends HTMLElement>(tag: string, cls: string, parent: HTMLElement, text = "") => {
  const e = document.createElement(tag) as T;
  e.className = cls;
  if (text) e.textContent = text;
  parent.appendChild(e);
  return e;
};
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

type Row = { id: string; title: string; seconds: number; grade?: string; strand?: string; added?: string };
/** A review of one lesson version, from data/grades.json on the review server. */
type Grade = { grade: "approved" | "rejected" | "unreviewed"; note?: string; added?: string; at: string };
type Status = "approved" | "rejected" | "unreviewed" | "new";
const STATUS_TEXT: Record<Status, string> = { approved: "Approved", rejected: "Rejected", unreviewed: "Unreviewed", new: "New version" };
const loadGrades = async (): Promise<Record<string, Grade>> => {
  try {
    const r = await fetch(`data/grades.json?t=${Date.now()}`);
    return r.ok ? await r.json() : {};
  } catch (e) {
    console.error("grades did not load", e);
    return {};
  }
};
/** A review belongs to the version it was given on. A newer cut is unreviewed again. */
const statusOf = (row: Row, g?: Grade): Status => {
  if (!g || g.grade === "unreviewed") return "unreviewed";
  if (g.added && row.added && g.added !== row.added) return "new";
  return g.grade;
};
const badge = (parent: HTMLElement, st: Status) => $("span", `live-badge is-${st}`, parent, STATUS_TEXT[st]);
const SHOWS = ["unreviewed", "approved", "rejected", "all"] as const;
type Show = (typeof SHOWS)[number];
const matches = (st: Status, show: Show) => show === "all" || (show === "unreviewed" ? st === "unreviewed" || st === "new" : st === show);
const gradeName = (g?: string) => (!g ? "" : /^\d$/.test(g) ? `Grade ${g}` : g === "K" ? "Kindergarten" : g.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()));

/** Newest first, each lesson labeled, filterable. Refreshes once a minute. */
async function feed(app: HTMLElement) {
  const params = new URLSearchParams(location.search);
  const show: Show = (SHOWS as readonly string[]).includes(params.get("show") ?? "") ? (params.get("show") as Show) : "all";
  const page = $("main", "live-index", app);
  $("h1", "", page, "Lesson films");
  const sub = $("p", "live-muted", page);
  const tabs = $("nav", "live-tabs", page);
  tabs.setAttribute("aria-label", "Show");
  const nav = $<HTMLAnchorElement>("a", "live-link", page, "Browse by grade");
  nav.href = "?view=grade";
  const box = $("div", "", page);
  const draw = async () => {
    const [lessons, grades] = await Promise.all([fetch(`data/index.json?t=${Date.now()}`).then((r) => r.json() as Promise<Row[]>), loadGrades()]);
    const st = new Map(lessons.map((l) => [l.id, statusOf(l, grades[l.id])]));
    const count = (k: Show) => lessons.filter((l) => matches(st.get(l.id)!, k)).length;
    sub.textContent = `${lessons.length} lessons: ${count("approved")} approved, ${count("rejected")} rejected, ${count("unreviewed")} to review. Newest first; refreshes every minute.`;
    tabs.replaceChildren();
    for (const k of SHOWS) {
      const a = $<HTMLAnchorElement>("a", `live-tab${k === show ? " is-on" : ""}`, tabs);
      a.href = k === "all" ? "./" : `?show=${k}`;
      if (k === show) a.setAttribute("aria-current", "page");
      $("span", "", a, k === "all" ? "All" : STATUS_TEXT[k as Status]);
      $("span", "live-tab-count", a, String(count(k)));
    }
    const sorted = lessons.filter((l) => matches(st.get(l.id)!, show)).sort((a, b) => (b.added ?? "").localeCompare(a.added ?? ""));
    box.replaceChildren();
    if (!sorted.length) $("p", "live-muted live-empty", box, show === "unreviewed" ? "Everything here has a grade." : "Nothing here yet.");
    for (const l of sorted) {
      const a = $<HTMLAnchorElement>("a", "live-card", box);
      a.href = `?id=${encodeURIComponent(l.id)}`;
      const left = $("span", "live-card-main", a);
      $("span", "live-card-title", left, l.title);
      $("span", "live-muted", left, [gradeName(l.grade), l.strand, clock(l.seconds)].filter(Boolean).join(" · "));
      badge(a, st.get(l.id)!);
    }
  };
  await draw();
  setInterval(() => draw().catch((e) => console.error("feed refresh failed", e)), 60_000);
}

async function list(app: HTMLElement) {
  const [lessons, grades] = await Promise.all([fetch("data/index.json").then((r) => { if (!r.ok) throw new Error("The lesson catalog is unavailable."); return r.json() as Promise<Row[]>; }), loadGrades()]);
  const page = $("main", "live-index", app);
  $("h1", "", page, "Lesson films, live");
  $("p", "live-muted", page, `${lessons.length} lessons, drawn on your screen from the screenplay and the narration. No video.`);
  const back = $<HTMLAnchorElement>("a", "live-link", page, "Newest first");
  back.href = "./";
  const order = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "algebra-1", "geometry", "algebra-2", "precalculus"];
  const rank = (g?: string) => { const i = order.indexOf(g ?? ""); return i < 0 ? 99 : i; };
  const sorted = [...lessons].sort((a, b) => rank(a.grade) - rank(b.grade) || (a.strand ?? "").localeCompare(b.strand ?? "") || a.title.localeCompare(b.title));
  let last = "";
  for (const l of sorted) {
    const head = l.grade ? (/^\d$/.test(l.grade) ? `Grade ${l.grade}` : l.grade === "K" ? "Kindergarten" : l.grade.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase())) : "Other";
    if (head !== last) { $("h2", "live-grade", page, head); last = head; }
    const a = $<HTMLAnchorElement>("a", "live-card", page);
    a.href = `?id=${encodeURIComponent(l.id)}`;
    const left = $("span", "live-card-main", a);
    $("span", "live-card-title", left, l.title);
    $("span", "live-muted", left, clock(l.seconds));
    badge(a, statusOf(l, grades[l.id]));
  }
}

async function play(app: HTMLElement, id: string) {
  const dispose = mountFilmPlayer(app, {
    dataUrl: `data/${encodeURIComponent(id)}.json`,
    audioUrl: `data/${encodeURIComponent(id)}.m4a`,
    backHref: location.pathname,
    backLabel: "All",
    fullscreen: false,
  });
  window.addEventListener("pagehide", dispose, { once: true });
  // Review actions surround the shared player; learner routes never mount them.
  const shell = app.querySelector<HTMLElement>(".live")!;
  const controls = shell.querySelector<HTMLElement>(".live-tools")!;
  const audio = shell.querySelector<HTMLAudioElement>("audio")!;
  const back = controls.querySelector(".live-back")!;
  const approve = $<HTMLButtonElement>("button", "live-grade-btn is-approve", controls);
  approve.setAttribute("aria-label", "Approve");
  const reject = $<HTMLButtonElement>("button", "live-grade-btn is-reject", controls);
  reject.setAttribute("aria-label", "Reject");
  approve.disabled = reject.disabled = true;
  controls.insertBefore(approve, back);
  controls.insertBefore(reject, back);
  const toast = $("div", "live-toast", shell);
  toast.setAttribute("role", "status");
  // Review: approve or reject this version, with an optional note. The review server stores it.
  const [rows, grades] = await Promise.all([fetch(`data/index.json?t=${Date.now()}`).then((r) => r.json() as Promise<Row[]>).catch(() => [] as Row[]), loadGrades()]);
  const row = rows.find((r) => r.id === id);
  let mine = grades[id];
  const paint = () => {
    const st = row ? statusOf(row, mine) : "unreviewed";
    approve.classList.toggle("is-on", st === "approved");
    reject.classList.toggle("is-on", st === "rejected");
    approve.setAttribute("aria-pressed", String(st === "approved"));
    reject.setAttribute("aria-pressed", String(st === "rejected"));
  };
  paint();
  let toastTimer = 0;
  const say = (text: string, bad = false) => {
    toast.textContent = text;
    toast.classList.toggle("is-bad", bad);
    toast.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-on"), bad ? 6000 : 2200);
  };
  const sheet = $("div", "live-sheet", shell);
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  const card = $("form", "live-sheet-card", sheet);
  const heading = $("h2", "live-sheet-title", card);
  heading.id = "live-sheet-title";
  sheet.setAttribute("aria-labelledby", heading.id);
  const note = $<HTMLTextAreaElement>("textarea", "live-sheet-note", card);
  note.rows = 4;
  note.setAttribute("aria-label", "Note");
  const actions = $("div", "live-sheet-actions", card);
  const clear = $<HTMLButtonElement>("button", "live-sheet-clear", actions, "Clear grade");
  clear.type = "button";
  const cancel = $<HTMLButtonElement>("button", "live-sheet-cancel", actions, "Cancel");
  cancel.type = "button";
  const save = $<HTMLButtonElement>("button", "live-sheet-save", actions, "Save");
  save.type = "submit";
  let pending: Grade["grade"] = "approved";
  const close = () => { sheet.classList.remove("is-on"); };
  const open = (g: "approved" | "rejected") => {
    pending = g;
    audio.pause();
    heading.textContent = g === "approved" ? "Approve this lesson" : "Reject this lesson";
    note.placeholder = g === "approved" ? "Note (optional)" : "What should change? (optional)";
    note.value = mine && mine.grade === g ? mine.note ?? "" : "";
    save.textContent = g === "approved" ? "Approve" : "Reject";
    save.classList.toggle("is-reject", g === "rejected");
    clear.style.visibility = mine && mine.grade !== "unreviewed" ? "visible" : "hidden";
    sheet.classList.add("is-on");
    note.focus();
  };
  const send = async (grade: Grade["grade"]) => {
    save.disabled = clear.disabled = true;
    try {
      const r = await fetch("grade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, grade, note: grade === "unreviewed" ? "" : note.value.trim(), added: row?.added ?? "" }) });
      const out = await r.json();
      if (!r.ok) throw new Error(out.error ?? `status ${r.status}`);
      mine = out;
      paint();
      close();
      say(grade === "approved" ? "Approved" : grade === "rejected" ? "Rejected" : "Marked unreviewed");
    } catch (e) {
      console.error("review not saved", e);
      say(`Not saved: ${(e as Error).message}. Check the connection and try again.`, true);
    } finally {
      save.disabled = clear.disabled = false;
    }
  };
  approve.onclick = () => open("approved");
  reject.onclick = () => open("rejected");
  cancel.onclick = close;
  clear.onclick = () => send("unreviewed");
  card.onsubmit = (e) => { e.preventDefault(); send(pending); };
  sheet.onclick = (e) => { if (e.target === sheet) close(); };
  sheet.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); e.stopPropagation(); });
  approve.disabled = reject.disabled = false;

  if (row) document.title = row.title;
}

const app = document.getElementById("app")!;
const id = new URLSearchParams(location.search).get("id");
const view = new URLSearchParams(location.search).get("view");
(id ? play(app, id) : view === "grade" ? list(app) : feed(app)).catch((e) => {
  console.error(e);
  $("p", "live-error", app, `This lesson could not load: ${(e as Error).message}`);
});
