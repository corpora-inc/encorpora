/** An app figure inside a film: the template's own example, or a shot's own scene. Shown as drawn, or driven by `scene` actions. Shared by the renderer and the live player. */
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import type { Action, Shot } from "./schema";
import { Figure } from "../src/web/Figure";
import { SceneSvg } from "../src/web/scene/SceneSvg";
import { layoutScene } from "../src/math/scene";
import { frameAt, missingTargets, type Step } from "../src/math/scene/timeline";

export type MountedFigure = {
  /** Draws the figure at film time t; a picture shown as drawn has none. */
  seek?: (t: number) => void;
  /** Authoring mistakes, such as a scene action naming a part the figure does not have. */
  issues: string[];
  /** Worth knowing, not wrong: crowded optional labels the layout left out. */
  notes: string[];
};

/**
 * A shot with figure {scene: ...} shows that scene; {example: true} shows the
 * template's own figure (`figure`). `scene` actions drive their parts.
 */
export function mountExample(figure: any, host: HTMLElement, shot: Shot, list: { a: Action; t0: number; dur: number }[], onUnmount?: (dispose: () => void) => void): MountedFigure {
  const own = shot.figure && "scene" in shot.figure ? shot.figure.scene : undefined;
  const fig = own ? { kind: "scene", scene: own } : figure;
  if (!fig) throw new Error("This template's example has no figure. Build one with geo, or give the shot its own scene.");
  const acts = list.flatMap((e) => (e.a.do === "scene" ? [{ ...e, actions: e.a.actions }] : []));
  const box = document.createElement("div");
  box.className = "film-real-figure";
  box.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center";
  host.appendChild(box);
  const inner = document.createElement("div");
  box.appendChild(inner);
  const r = createRoot(inner);
  onUnmount?.(() => r.unmount());
  if (fig.kind === "scene") {
    const steps: Step[] = acts.map((e) => ({ caption: " ", actions: e.actions }));
    // As in the app, the layout reserves room for every frame of the steps it is given: when the film moves parts, those are the film's.
    const moves = steps.some((s) => s.actions.some((a) => a.do === "move"));
    const layout = layoutScene(moves ? { ...fig.scene, steps } : fig.scene, { reveal: true });
    const issues = missingTargets(layout, steps).map((t) => `a scene action names "${t}", but the figure has no part by that name. List its parts with film/parts.ts.`);
    const notes = layout.dropped.length ? [`the figure leaves out crowded labels: ${layout.dropped.join(", ")}.`] : [];
    const label = own?.title ?? shot.beats[0]!.say.slice(0, 60);
    const draw = (states?: Record<string, any>) => flushSync(() => r.render(<SceneSvg layout={layout} label={label} states={states} />));
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
    const seek = (t: number) => {
      if (!steps.length) return;
      let i = -1;
      for (let k = 0; k < acts.length; k++) if (t >= acts[k]!.t0) i = k;
      const step = Math.max(0, i);
      const u = i < 0 ? 0 : Math.min(1, (t - acts[step]!.t0) / acts[step]!.dur);
      draw(frameAt(layout, steps, step, u));
      fit();
    };
    return { seek, issues, notes };
  }
  flushSync(() => r.render(<Figure figure={fig} />));
  const hit = inner.firstElementChild as HTMLElement | null;
  if (hit) {
    const b = hit.getBoundingClientRect();
    const k = Math.min(920 / Math.max(1, b.width), 900 / Math.max(1, b.height));
    inner.style.transform = `scale(${k})`;
  }
  const issues = acts.length ? [`scene actions drive a figure's named parts, but this example is a ${fig.kind} picture shown as drawn. Build the figure with geo or give the shot its own scene.`] : [];
  return { issues, notes: [] };
}
