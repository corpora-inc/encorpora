/** What the renderer loads: the app's stylesheet, the film, and the lesson's real figure when a shot asks for it. */
import "../src/web/app/styles";
import "./film.css";
import { Film, TALL, WIDE } from "./stage";
import type { Script, Timing } from "./schema";
import { mountExample } from "./example";

declare global {
  interface Window {
    __film: { ready: Promise<void>; seek(t: number): void; moving(): [number, number][]; issues: string[]; duration: number };
  }
}
const data = (window as unknown as { __filmData: { script: Script; timing: Timing; figure?: any } }).__filmData;
const root = document.getElementById("film")!;

let film: Film;
const ready = (async () => {
  await document.fonts.ready;
  await Promise.all(["KaTeX_Main", "KaTeX_Math", "KaTeX_AMS", "KaTeX_Size1", "KaTeX_Size2"].map((f) => document.fonts.load(`40px ${f}`).catch(() => null)));
  // The frame being shot: the 16:9 film, or (--tall) a phone held upright.
  const tallFirst = (data as any).layout === "tall";
  const main = tallFirst ? TALL : WIDE, other = tallFirst ? WIDE : TALL;
  for (const el of [document.documentElement, document.body]) { el.style.width = `${main.w}px`; el.style.height = `${main.h}px`; }
  film = new Film(root, data.script, data.timing, (host, shot, list) => mountExample(data.figure, host, shot, list), { still: (data as any).still, layout: main });
  // The same lesson in the other layout, off to the side: what does not fit there is a problem too.
  const otherRoot = document.createElement("div");
  otherRoot.style.cssText = "position:absolute;left:4000px;top:0;overflow:hidden";
  document.body.appendChild(otherRoot);
  const second = new Film(otherRoot, data.script, data.timing, (host, shot, list) => mountExample(data.figure, host, shot, list), { layout: other, still: (data as any).still });
  for (const issue of second.issues) if (!film.issues.includes(issue)) film.issues.push(`${tallFirst ? "In the 16:9 film" : "On a phone held upright"}: ${issue}`);
  otherRoot.remove();
  window.__film.issues = film.issues;
  window.__film.duration = film.duration;
  film.seek(0);
})();
window.__film = {
  ready,
  seek: (t) => film.seek(t),
  moving: () => film.moving(),
  issues: [],
  duration: data.timing.duration,
};
