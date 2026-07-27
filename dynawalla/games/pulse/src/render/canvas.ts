/**
 * Canvas plumbing.
 *
 * Two surfaces:
 *  - `main`  — full device-pixel resolution, everything crisp.
 *  - `trail` — HALF resolution, never cleared, only faded. Every glowing thing is
 *    also drawn here additively, so it smears into a phosphor trail for free, and
 *    upscaling a half-res buffer *is* the blur that makes the bloom. Full-res
 *    feedback is the single easiest way to lose a tablet's fill rate; half-res costs
 *    a quarter of it and looks better.
 *
 * Device pixel ratio is capped at 2. A 3× phone gains nothing visible here and pays
 * 2.25× the fill.
 */

export type Surfaces = {
  main: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  trail: HTMLCanvasElement;
  tctx: CanvasRenderingContext2D;
  scratchA: HTMLCanvasElement;
  sctxA: CanvasRenderingContext2D;
  scratchB: HTMLCanvasElement;
  sctxB: CanvasRenderingContext2D;
  /** CSS pixels. */
  w: number;
  h: number;
  dpr: number;
  /** Trail-buffer scale relative to CSS pixels. */
  tscale: number;
  resize(): boolean;
  dispose(): void;
};

const MAX_DPR = 2;

function make(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  const x = c.getContext("2d", { alpha: true, desynchronized: true });
  if (!x) throw new Error("pulse: 2d context unavailable");
  return [c, x];
}

export function createSurfaces(host: HTMLElement): Surfaces {
  const [main, ctx] = make();
  main.className = "pulse-canvas";
  host.appendChild(main);
  const [trail, tctx] = make();
  const [scratchA, sctxA] = make();
  const [scratchB, sctxB] = make();

  const s: Surfaces = {
    main,
    ctx,
    trail,
    tctx,
    scratchA,
    sctxA,
    scratchB,
    sctxB,
    w: 0,
    h: 0,
    dpr: 1,
    tscale: 0.5,
    resize() {
      const rect = host.getBoundingClientRect();
      const w = Math.max(320, Math.round(rect.width || window.innerWidth));
      const h = Math.max(320, Math.round(rect.height || window.innerHeight));
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      if (w === s.w && h === s.h && dpr === s.dpr) return false;
      s.w = w;
      s.h = h;
      s.dpr = dpr;
      main.width = Math.round(w * dpr);
      main.height = Math.round(h * dpr);
      main.style.width = `${w}px`;
      main.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const tw = Math.max(2, Math.round(w * s.tscale));
      const th = Math.max(2, Math.round(h * s.tscale));
      for (const [c, x] of [
        [trail, tctx],
        [scratchA, sctxA],
        [scratchB, sctxB],
      ] as const) {
        c.width = tw;
        c.height = th;
        x.setTransform(s.tscale, 0, 0, s.tscale, 0, 0);
      }
      tctx.clearRect(0, 0, w, h);
      return true;
    },
    dispose() {
      main.remove();
    },
  };
  s.resize();
  return s;
}
