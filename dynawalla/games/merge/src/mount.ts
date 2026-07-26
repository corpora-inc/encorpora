import type { Host, FocusableHost } from "./contract.ts";
import { Game } from "./game.ts";
import { Renderer } from "./render.ts";
import { bindInput } from "./input.ts";
import { computeLayout, type Layout } from "./layout.ts";

export type MountOptions = {
  seed?: string;
  debug?: boolean;
  /**
   * Playtest hook. Hands back the live game plus a manual stepper so a harness
   * can drive exact moments — a nine-chain, a breach, a resonance — instead of
   * hoping to stumble into them. Never used by the real host.
   */
  onReady?(probe: { game: Game; step(dtMs: number, frames?: number): void }): void;
};

/**
 * Mount FUSE into an element.
 *
 * One canvas, one RAF loop, no DOM churn per frame. The frame budget is
 * measured continuously and the particle budget follows it, so a slower tablet
 * loses sparks rather than frames.
 */
export function mount(el: HTMLElement, host: Host, opts: MountOptions = {}): { unmount(): void } {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none";
  canvas.setAttribute("role", "img");
  canvas.setAttribute(
    "aria-label",
    "FUSE. Drop numbered chips into the well. Touching chips that add up to the key number fuse.",
  );
  el.style.position = el.style.position || "relative";
  el.appendChild(canvas);

  const g = canvas.getContext("2d", { alpha: false }) as CanvasRenderingContext2D;
  const game = new Game(host as FocusableHost, opts.seed);
  const renderer = new Renderer();
  renderer.debug = !!opts.debug;

  let layout: Layout | null = null;
  let raf = 0;
  let last = performance.now();
  let acc = 0;
  const frameTimes: number[] = [];

  const resize = () => {
    const w = Math.max(1, el.clientWidth || window.innerWidth);
    const h = Math.max(1, el.clientHeight || window.innerHeight);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    layout = computeLayout(w, h, dpr);
    game.layout = layout;
    renderer.resize(layout);
  };
  resize();

  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  ro?.observe(el);
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", resize);

  const onVis = () => {
    game.paused = document.hidden;
    if (!document.hidden) last = performance.now();
  };
  document.addEventListener("visibilitychange", onVis);

  const motionQuery =
    typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  const onMotion = () => {
    game.cam.reduced = host.prefersReducedMotion();
  };
  motionQuery?.addEventListener?.("change", onMotion);

  const input = bindInput(canvas, game, () => layout);

  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1; // a backgrounded tab must not teleport the well

    frameTimes.push(dt);
    if (frameTimes.length > 45) frameTimes.shift();
    acc += dt;
    if (acc > 0.35 && frameTimes.length > 10) {
      acc = 0;
      const mean = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      game.fps = 1 / Math.max(0.0005, mean);
      // Spend the budget on sparks only while there is budget to spend.
      game.parts.budget = game.fps < 42 ? 0.35 : game.fps < 52 ? 0.65 : 1;
      if (game.cam.reduced) game.parts.budget = Math.min(game.parts.budget, 0.25);
    }

    game.update(dt, now);
    if (layout) renderer.draw(g, game, layout, now / 1000);
  };
  raf = requestAnimationFrame(loop);

  opts.onReady?.({
    game,
    step(dtMs: number, frames = 1) {
      const wasPaused = game.paused;
      game.paused = false;
      for (let i = 0; i < frames; i++) {
        const t = performance.now();
        game.update(dtMs / 1000, t);
        if (layout) renderer.draw(g, game, layout, t / 1000);
      }
      game.paused = wasPaused;
    },
  });

  return {
    unmount() {
      cancelAnimationFrame(raf);
      input.dispose();
      ro?.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
      document.removeEventListener("visibilitychange", onVis);
      motionQuery?.removeEventListener?.("change", onMotion);
      canvas.remove();
    },
  };
}
