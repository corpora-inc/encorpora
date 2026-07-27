/**
 * Wiring: canvas, loop, lifecycle.
 *
 * The simulation runs on a fixed 1/120s step with an accumulator so that
 * collision and turn rate are frame-rate independent; presentation runs on the
 * real clock so shake, bloom and slow-motion keep moving during hitstop — which
 * is the entire point of hitstop.
 */

import type { Host, Mounted } from "../contract.ts";
import { createAudio } from "./audio.ts";
import { createInput } from "./input.ts";
import { simDelta, updateCamera } from "./fx/camera.ts";
import { createRenderer, type View } from "./render/scene.ts";
import { drawHud } from "./render/hud.ts";
import { confirmPressed, createWorld, stepWorld, type World } from "./world.ts";
import { clamp } from "./num.ts";

const FIXED = 1 / 120;
const MAX_STEPS = 6;

export type SerpentHandle = Mounted & {
  /** Test and tooling seam. Not used by the game itself. */
  world: World;
  view: View;
  canvas: HTMLCanvasElement;
  fps(): number;
};

export function mountSerpent(el: HTMLElement, host: Host): SerpentHandle {
  const canvas = document.createElement("canvas");
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.touchAction = "none";
  canvas.style.background = "#01060c";
  el.appendChild(canvas);

  const reduced = host.prefersReducedMotion();
  const audio = createAudio();
  const renderer = createRenderer(canvas);
  const world = createWorld(host, audio, reduced);

  let lastTapX = 0;
  let lastTapY = 0;
  const onTap = (e: PointerEvent): void => {
    const rect = canvas.getBoundingClientRect();
    lastTapX = e.clientX - rect.left;
    lastTapY = e.clientY - rect.top;
  };
  canvas.addEventListener("pointerdown", onTap);

  const input = createInput(canvas, {
    toWorld: (x, y) => renderer.toWorld(x, y, canvas.getBoundingClientRect()),
    headAt: () => ({ x: world.serpent.x, y: world.serpent.y }),
  });

  function layout(): void {
    const rect = el.getBoundingClientRect();
    const w = Math.max(200, Math.round(rect.width || window.innerWidth));
    const h = Math.max(200, Math.round(rect.height || window.innerHeight));
    renderer.resize(w, h, Math.min(window.devicePixelRatio || 1, 2.5));
  }
  layout();

  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => layout()) : null;
  ro?.observe(el);
  window.addEventListener("resize", layout);
  window.addEventListener("orientationchange", layout);

  const onVisibility = (): void => {
    if (document.hidden) {
      if (world.phase === "play") world.paused = true;
      audio.ambient(false);
      audio.setBoost(false);
    } else {
      audio.ambient(world.phase !== "attract");
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  // --- frame timing
  let raf = 0;
  let last = 0;
  let acc = 0;
  const times: number[] = [];
  let fps = 60;
  let frameMs = 0;
  let worstMs = 0;
  let showDebug = false;
  let disposed = false;

  function soundHit(x: number, y: number): boolean {
    const v = renderer.view;
    const u = Math.min(v.w, v.h);
    const pad = Math.max(14, u * 0.045);
    const sr = Math.max(13, u * 0.032);
    const cx = v.w - pad - sr;
    const cy = v.h - pad - sr;
    const box = Math.max(24, sr * 1.9);
    return Math.abs(x - cx) < box && Math.abs(y - cy) < box;
  }

  function frame(t: number): void {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const start = performance.now();
    if (last === 0) last = t;
    const rawDt = clamp((t - last) / 1000, 0, 0.05);
    last = t;

    if (input.takeMute()) audio.setEnabled(!audio.enabled);
    if (input.takeDebug()) showDebug = !showDebug;
    if (input.takePause() && world.phase === "play") world.paused = !world.paused;
    if (input.takeConfirm()) {
      if (soundHit(lastTapX, lastTapY)) {
        audio.setEnabled(!audio.enabled);
        if (audio.enabled) audio.ambient(world.phase !== "attract");
      } else if (world.paused) {
        world.paused = false;
      } else {
        audio.resume();
        confirmPressed(world);
      }
    }

    updateCamera(world.cam, rawDt);
    const sd = world.paused ? 0 : simDelta(world.cam, rawDt);
    acc += sd;
    let steps = 0;
    while (acc >= FIXED && steps < MAX_STEPS) {
      stepWorld(world, FIXED, { heading: input.heading, boost: input.boost });
      acc -= FIXED;
      steps++;
    }
    if (steps === MAX_STEPS) acc = 0;

    renderer.draw(world, 0);
    drawHud(canvas.getContext("2d") as CanvasRenderingContext2D, renderer.view, world, {
      pointer: input.pointer,
      usingTouch: input.usingTouch,
      soundOn: audio.enabled,
      showDebug,
      fps,
      frameMs,
      worstMs,
    });

    const cost = performance.now() - start;
    frameMs = frameMs * 0.9 + cost * 0.1;
    times.push(rawDt);
    if (times.length > 90) times.shift();
    if (times.length > 10) {
      const sum = times.reduce((a, b) => a + b, 0);
      fps = times.length / sum;
    }
    if (world.phase === "play" && world.runTime > 1.5) worstMs = Math.max(worstMs, cost);
  }
  raf = requestAnimationFrame(frame);

  return {
    world,
    view: renderer.view,
    canvas,
    fps: () => fps,
    unmount(): void {
      disposed = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", layout);
      window.removeEventListener("orientationchange", layout);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onTap);
      input.dispose();
      audio.dispose();
      canvas.remove();
    },
  };
}
