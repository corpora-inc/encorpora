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

function play(app: HTMLElement, id: string) {
  const dispose = mountFilmPlayer(app, {
    dataUrl: `data/${encodeURIComponent(id)}.json`,
    audioUrl: `data/${encodeURIComponent(id)}.m4a`,
    backHref: location.pathname,
    backLabel: "All lessons",
  });
  window.addEventListener("pagehide", dispose, { once: true });
  return Promise.resolve();
}

const app = document.getElementById("app")!;
const id = new URLSearchParams(location.search).get("id");
(id ? play(app, id) : list(app)).catch((e) => {
  console.error(e);
  $("p", "live-error", app, `This lesson could not load: ${(e as Error).message}`);
});
