/** An app figure inside a film: the template's own example, or a shot's own scene. Shown as drawn, or driven by `scene` actions. Shared by the renderer and the live player. */
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import type { Action, Shot } from "./schema";
import { Figure } from "../src/web/Figure";
import { SceneSvg } from "../src/web/scene/SceneSvg";
import { layoutScene } from "../src/math/scene";
import { frameAt, matches, missingTargets, type Step } from "../src/math/scene/timeline";

export type MountedFigure = {
  /** Draws the figure at film time t; a picture shown as drawn has none. */
  seek?: (t: number) => void;
  /** Authoring mistakes, such as a scene action naming a part the figure does not have. */
  issues: string[];
  /** Worth knowing, not wrong: crowded optional labels the layout left out. */
  notes: string[];
};

/**
 * True when the first thing a shot does to its scene only sets it up: on the shot's first
 * cue it takes parts away, or arranges the scene in an instant (parts hidden, shown or moved
 * in no time). What was drawn before that was never meant to be seen, so the shot begins set up.
 */
export function startsCleared(list: { a: Action; t0: number; dur?: number }[]): boolean {
  const first = list.find((e) => e.a.do === "scene");
  if (!first || first.a.do !== "scene" || !first.a.actions.length) return false;
  const start = Math.min(...list.map((e) => e.t0));
  if (first.t0 > start + 0.05) return false;
  if ((first.dur ?? 1) <= 0.1) return true;
  return first.a.actions.every((x) => x.do === "disappear");
}

/**
 * A shot with figure {scene: ...} shows that scene; {example: true} shows the
 * template's own figure (`figure`). `scene` actions drive their parts.
 */
export function mountExample(figure: any, host: HTMLElement, shot: Shot, list: { a: Action; t0: number; dur: number; sceneEnds?: (number | undefined)[] }[], onUnmount?: (dispose: () => void) => void): MountedFigure {
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
    // Explicit word releases run independently of scene steps. Keep the step
    // itself so legacy highlights still release when the next scene cue starts.
    const lights = acts.flatMap((e) => e.actions.flatMap((a, k) => {
      const end = e.sceneEnds?.[k];
      return a.do === "highlight" && end !== undefined ? [{ target: a.target, t0: e.t0, end, dur: e.dur }] : [];
    }));
    const timedSteps = steps.map((s, i) => ({ ...s, actions: s.actions.filter((_, k) => acts[i]!.sceneEnds?.[k] === undefined) }));
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
    // A shot whose very first action only takes parts away begins without them:
    // drawn at progress 0 they would show until the first word and then vanish.
    const cleared = startsCleared(list);
    draw(steps.length ? frameAt(layout, timedSteps, 0, cleared ? 1 : 0) : undefined);
    fit();
    const seek = (t: number) => {
      if (!steps.length) return;
      let i = -1;
      for (let k = 0; k < acts.length; k++) if (t >= acts[k]!.t0) i = k;
      const step = Math.max(0, i);
      const u = i < 0 ? (cleared ? 1 : 0) : Math.min(1, (t - acts[step]!.t0) / acts[step]!.dur);
      const states = frameAt(layout, timedSteps, step, step === 0 && cleared ? 1 : u);
      for (const light of lights) {
        // Use the scene's existing entrance/release ramp, with the word as
        // the release cue instead of the next scene step.
        const strength = Math.max(0, Math.min(1, (t - light.t0) / light.dur, 1 - (t - light.end) / light.dur));
        if (strength <= 0) continue;
        for (const item of layout.items) if (matches(item.id, light.target)) {
          const state = states[item.id] ??= {};
          state.highlight = true;
          state.emphasis = Math.max(state.emphasis ?? 0, strength);
        }
      }
      draw(states);
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
