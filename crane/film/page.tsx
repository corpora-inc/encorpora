/**
 * What the film renderer loads for a crane film (amp/film/make.ts --kit crane):
 * the crane app's look, the film stage, and the crane figure mount. The same
 * screenplay is checked in the other layout too: what does not fit on a phone
 * held upright is a problem in the 16:9 film's check as well.
 */
import "../../amp/film/film.css";
import "./theme.css";
import { Film, TALL, WIDE } from "../../amp/film/stage";
import type { Script, Timing } from "../../amp/film/schema";
import { mountShot } from "./shot";

declare global {
  interface Window {
    __film: { ready: Promise<void>; seek(t: number): void; moving(): [number, number][]; issues: string[]; notes: string[]; duration: number };
  }
}
const data = (window as unknown as { __filmData: { script: Script; timing: Timing; still?: number; layout?: string } }).__filmData;
const root = document.getElementById("film")!;

let film: Film;
const ready = (async () => {
  await document.fonts.ready;
  await Promise.all(
    ["600 40px 'Barlow Semi Condensed'", "700 40px 'Barlow Semi Condensed'", "400 40px Barlow", "500 40px Barlow", "600 40px Barlow", "40px KaTeX_Main", "40px KaTeX_Math"].map((f) => document.fonts.load(f).catch(() => null)),
  );
  const tallFirst = data.layout === "tall";
  const main = tallFirst ? TALL : WIDE, other = tallFirst ? WIDE : TALL;
  for (const el of [document.documentElement, document.body]) { el.style.width = `${main.w}px`; el.style.height = `${main.h}px`; }
  film = new Film(root, data.script, data.timing, (host, shot, list) => mountShot(host, shot, list), { still: data.still, layout: main });
  const otherRoot = document.createElement("div");
  otherRoot.style.cssText = "position:absolute;left:4000px;top:0;overflow:hidden";
  document.body.appendChild(otherRoot);
  const second = new Film(otherRoot, data.script, data.timing, (host, shot, list) => mountShot(host, shot, list), { layout: other, still: data.still });
  for (const issue of second.issues) if (!film.issues.includes(issue)) film.issues.push(`${tallFirst ? "In the 16:9 film" : "On a phone held upright"}: ${issue}`);
  for (const note of second.notes) if (!film.notes.includes(note)) film.notes.push(`${tallFirst ? "In the 16:9 film" : "On a phone held upright"}: ${note}`);
  otherRoot.remove();
  window.__film.issues = film.issues;
  window.__film.notes = film.notes;
  window.__film.duration = film.duration;
  film.seek(0);
})();
window.__film = {
  ready,
  seek: (t) => film.seek(t),
  moving: () => film.moving(),
  issues: [],
  notes: [],
  duration: data.timing.duration,
};
