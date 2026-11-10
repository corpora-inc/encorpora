/** The template's own figure inside a film: shown as drawn, or driven by `scene` actions. Shared by the renderer and the live player. */
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import type { Shot } from "./schema";
import { Figure } from "../src/web/Figure";
import { SceneSvg } from "../src/web/scene/SceneSvg";
import { layoutScene } from "../src/math/scene";
import { frameAt, type Step } from "../src/math/scene/timeline";

/** A shot with figure {example:true} shows the template's own figure; `scene` actions drive its parts. */
export function mountExample(figure: any, host: HTMLElement, shot: Shot, list: { a: any; t0: number; dur: number }[]) {
  if (!figure) throw new Error("This template's example has no figure. Build one with geo.");
  const box = document.createElement("div");
  box.className = "film-real-figure";
  box.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center";
  host.appendChild(box);
  const inner = document.createElement("div");
  box.appendChild(inner);
  const r = createRoot(inner);
  if (figure.kind === "scene") {
    const layout = layoutScene(figure.scene, { reveal: true });
    const acts = list.filter((e) => e.a.do === "scene");
    const steps: Step[] = acts.map((e) => ({ caption: " ", actions: e.a.actions }));
    const draw = (states?: Record<string, any>) => flushSync(() => r.render(<SceneSvg layout={layout} label={shot.beats[0]!.say.slice(0, 60)} states={states} />));
    const fit = () => {
      const s = inner.querySelector("svg");
      if (!s) return;
      const k = Math.min(920 / layout.width, 900 / layout.height);
      s.setAttribute("width", String(layout.width * k));
      s.setAttribute("height", String(layout.height * k));
      s.style.maxWidth = "none";
      s.style.maxHeight = "none";
    };
    draw(steps.length ? frameAt(layout, steps, 0, 0) : undefined);
    fit();
    return (t: number) => {
      if (!steps.length) return;
      let i = -1;
      for (let k = 0; k < acts.length; k++) if (t >= acts[k]!.t0) i = k;
      const step = Math.max(0, i);
      const u = i < 0 ? 0 : Math.min(1, (t - acts[step]!.t0) / acts[step]!.dur);
      draw(frameAt(layout, steps, step, u));
      fit();
    };
  }
  flushSync(() => r.render(<Figure figure={figure} />));
  const hit = inner.firstElementChild as HTMLElement | null;
  if (hit) {
    const b = hit.getBoundingClientRect();
    const k = Math.min(920 / Math.max(1, b.width), 900 / Math.max(1, b.height));
    inner.style.transform = `scale(${k})`;
  }
  return undefined;
}
