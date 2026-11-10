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
import { Film, TALL, WIDE, type Layout } from "./stage";
import type { Script, Timing } from "./schema";
import { mountExample } from "./example";

type Lesson = { id: string; title: string; script: Script; timing: Timing; figure: unknown };

const $ = <T extends HTMLElement>(tag: string, cls: string, parent: HTMLElement, text = "") => {
  const e = document.createElement(tag) as T;
  e.className = cls;
  if (text) e.textContent = text;
  parent.appendChild(e);
  return e;
};
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

type Row = { id: string; title: string; seconds: number; grade?: string; strand?: string; added?: string };
async function list(app: HTMLElement) {
  const lessons = await fetch("data/index.json").then((r) => { if (!r.ok) throw new Error("The lesson catalog is unavailable."); return r.json() as Promise<Row[]>; });
  const page = $("main", "live-index", app);
  $("h1", "", page, "Lesson films, live");
  $("p", "live-muted", page, `${lessons.length} lessons, drawn on your screen from the screenplay and the narration. No video.`);
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
  }
}

async function play(app: HTMLElement, id: string) {
  const shell = $("div", "live", app);
  const frame = $("div", "live-frame", shell);
  const scale = $("div", "live-scale", frame);
  const root = $("div", "", scale);
  root.id = "film";
  const cover = $<HTMLButtonElement>("button", "live-cover", frame);
  cover.setAttribute("aria-label", "Play");
  const bar = $("div", "live-bar", shell);
  const toggle = $<HTMLButtonElement>("button", "live-toggle", bar);
  toggle.setAttribute("aria-label", "Play");
  const scrub = $<HTMLInputElement>("input", "live-scrub", bar);
  scrub.type = "range";
  scrub.min = "0";
  scrub.step = "0.01";
  scrub.setAttribute("aria-label", "Position");
  const time = $("span", "live-time", bar, "0:00");
  const tools = $("div", "live-tools", bar);
  const speedWrap = $("div", "live-speed-wrap", tools);
  const speedBtn = $<HTMLButtonElement>("button", "live-speed", speedWrap, "1×");
  speedBtn.setAttribute("aria-label", "Playback speed");
  speedBtn.setAttribute("aria-haspopup", "menu");
  speedBtn.setAttribute("aria-expanded", "false");
  const speedMenu = $("div", "live-speed-menu", speedWrap);
  speedMenu.setAttribute("role", "menu");
  const back = $<HTMLAnchorElement>("a", "live-back", tools, "All");
  back.href = location.pathname;
  const toast = $("div", "live-toast", shell);
  toast.setAttribute("role", "status");

  const [lesson] = await Promise.all([
    fetch(`data/${encodeURIComponent(id)}.json`).then((r) => {
      if (!r.ok) throw new Error(`No lesson ${id}`);
      return r.json() as Promise<Lesson>;
    }),
    document.fonts.ready,
  ]);
  await Promise.all(["KaTeX_Main", "KaTeX_Math", "KaTeX_AMS", "KaTeX_Size1", "KaTeX_Size2"].map((f) => document.fonts.load(`40px ${f}`).catch(() => null)));
  document.title = lesson.title;
  // Before the first play: the lesson's name and length behind the play mark, never an empty frame.
  const poster = $("div", "live-poster", frame);
  $("h1", "live-poster-title", poster, lesson.title);
  $("p", "live-poster-meta", poster, clock(lesson.timing.duration));
  frame.insertBefore(poster, cover);
  const audio = new Audio(`data/${encodeURIComponent(id)}.m4a`);
  audio.preload = "auto";
  // A screen taller than wide gets the upright layout: figure on top, board below.
  let film!: Film, layout: Layout | undefined, t = 0, dragging = false;
  const fit = () => {
    const L = layout!, k = Math.min(frame.clientWidth / L.w, frame.clientHeight / L.h);
    scale.style.transform = `translate(${(frame.clientWidth - L.w * k) / 2}px, ${(frame.clientHeight - L.h * k) / 2}px) scale(${k})`;
  };
  const build = () => {
    const L = frame.clientHeight > frame.clientWidth ? TALL : WIDE;
    if (L === layout) return fit();
    layout = L;
    // laid out at full size, where the board measures itself; scaled after
    scale.style.transform = "none";
    scale.style.width = `${L.w}px`;
    scale.style.height = `${L.h}px`;
    root.replaceChildren();
    film = new Film(root, lesson.script, lesson.timing, (host, shot, l) => mountExample(lesson.figure, host, shot, l) as any, { checks: false, layout: L });
    fit();
    film.seek(t);
  };
  build();
  new ResizeObserver(build).observe(frame);
  const duration = film.duration;
  scrub.max = String(duration);

  const draw = (at: number) => {
    t = Math.max(0, Math.min(duration, at));
    film.seek(t);
    if (!dragging) scrub.value = String(t);
    scrub.style.setProperty("--live-done", `${(t / duration) * 100}%`);
    time.textContent = `${clock(t)} / ${clock(duration)}`;
    // the title card is only for the very start: scrubbing or playing past it shows the lesson
    shell.classList.toggle("moved", t > 0.05);
  };
  const state = () => {
    const on = !audio.paused && !audio.ended;
    if (on) shell.classList.add("started");
    if (audio.ended) shell.classList.remove("started");
    shell.classList.toggle("playing", on);
    toggle.setAttribute("aria-label", on ? "Pause" : "Play");
    cover.setAttribute("aria-label", on ? "Pause" : "Play");
  };
  // The narration is the clock: every frame draws the film at the audio's time.
  const tick = () => {
    if (!audio.paused) draw(audio.currentTime);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  const flip = () => {
    if (audio.ended || t >= duration - 0.05) audio.currentTime = 0;
    if (audio.paused) audio.play().catch(() => { toast.textContent = "Playback could not start. Try Play again."; toast.classList.add("is-on"); }); else audio.pause();
  };
  // Speed: the film is clocked by the audio, so the picture follows the playback rate.
  const RATES = [0.75, 1, 1.25, 1.5, 2];
  const label = (r: number) => `${r}×`;
  let rate = 1;
  try { const saved = Number(localStorage.getItem("live-speed")); if (RATES.includes(saved)) rate = saved; } catch { /* storage unavailable */ }
  const setRate = (r: number) => {
    rate = r;
    audio.playbackRate = r;
    audio.preservesPitch = true;
    speedBtn.textContent = label(r);
    for (const b of speedMenu.querySelectorAll<HTMLButtonElement>("button")) b.setAttribute("aria-checked", String(Number(b.dataset.rate) === r));
    try { localStorage.setItem("live-speed", String(r)); } catch { /* storage unavailable */ }
  };
  for (const r of RATES) {
    const b = $<HTMLButtonElement>("button", "live-speed-option", speedMenu, label(r));
    b.dataset.rate = String(r);
    b.setAttribute("role", "menuitemradio");
    b.onclick = () => { setRate(r); speedWrap.classList.remove("is-open"); speedBtn.setAttribute("aria-expanded", "false"); speedBtn.focus(); };
  }
  setRate(rate);
  speedBtn.onclick = () => {
    const open = !speedWrap.classList.contains("is-open");
    speedWrap.classList.toggle("is-open", open);
    speedBtn.setAttribute("aria-expanded", String(open));
  };
  document.addEventListener("pointerdown", (e) => {
    if (!speedWrap.contains(e.target as Node)) { speedWrap.classList.remove("is-open"); speedBtn.setAttribute("aria-expanded", "false"); }
  });
  speedWrap.addEventListener("keydown", (e) => { if (e.key === "Escape") { speedWrap.classList.remove("is-open"); speedBtn.setAttribute("aria-expanded", "false"); speedBtn.focus(); } });
  toggle.onclick = flip;
  cover.onclick = flip;
  audio.onplay = audio.onpause = audio.onended = state;
  scrub.oninput = () => { dragging = true; audio.currentTime = Number(scrub.value); draw(Number(scrub.value)); };
  scrub.onchange = () => { dragging = false; };
  document.addEventListener("keydown", (e) => {
    if ((e.target as HTMLElement).closest?.("textarea, input, button")) return;
    if (e.key === " ") { e.preventDefault(); flip(); }
  });
  // While playing, the controls fade after a moment without a touch; any touch brings them back.
  let idle = 0;
  const wake = () => {
    shell.classList.remove("idle");
    clearTimeout(idle);
    idle = window.setTimeout(() => shell.classList.add("idle"), 2500);
  };
  for (const ev of ["pointerdown", "pointermove", "keydown"]) shell.addEventListener(ev, wake);

  draw(0);
  state();
  shell.classList.add("ready");
}

const app = document.getElementById("app")!;
const id = new URLSearchParams(location.search).get("id");
(id ? play(app, id) : list(app)).catch((e) => {
  console.error(e);
  $("p", "live-error", app, `This lesson could not load: ${(e as Error).message}`);
});
