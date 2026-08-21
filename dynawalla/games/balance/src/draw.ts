// The Brass Observatory.
//
// Deep indigo dark, one warm shaft of light with dust in it, and a machined
// brass balance standing on cut stone. Everything metal is drawn with a
// five-stop gradient (shadow, body, specular streak, body, shadow) because that
// single trick is what separates "a shape filled with gold" from "a turned
// cylinder". Objects are drawn in local space so every gradient can be cached:
// the whole scene creates zero gradients per frame after the first.
//
// Canvas 2D only, deliberately. ADR-0004 puts the art direction in 2D and rules
// out a 3D renderer on the reference tablet; the dimensionality here is all
// gradients, ellipses and contact shadows.

import type { Frac } from "./frac.ts";
import { toNumber } from "./frac.ts";
import type { Layout } from "./layout.ts";
import {
  armDistance,
  beamPoint,
  rackSlot,
  MAX_PEG,
  NUMERAL_FACE,
  fittedNumeralPx,
  idealNumeralPx,
  stackedNumeralPx,
} from "./layout.ts";
import {
  BALLOON_BODY,
  BRASS_BODY,
  BRASS_HI,
  BRASS_LO,
  BRASS_MID,
  BRASS_TOP,
  COPPER,
  balloonGround,
  haloFor,
  inkFor,
  weightGround,
  type CrateState,
} from "./ink.ts";
import type { Beam, Body } from "./sim.ts";
import { dishCentre } from "./sim.ts";
import type { PuzzleSpec, Side } from "./puzzle.ts";
import type { Camera, Particles } from "./juice.ts";
import { clamp01, easeOutCubic, easeOutQuint, easeOutBack } from "./ease.ts";

const BG_SCALE = 0.5;

/**
 * Paint a gradient from a stop list in `ink.ts`.
 *
 * The point of the indirection is that the legibility test measures those same
 * arrays. A numeral's contrast is a claim about the surface under it, so the
 * surface a test believes in and the surface the canvas paints have to be one
 * object — otherwise the first person to warm up the brass silently invalidates
 * every number in the table without a single test going red.
 */
function stops(
  gr: CanvasGradient,
  list: ReadonlyArray<readonly [number, string]>,
): CanvasGradient {
  for (const [at, colour] of list) gr.addColorStop(at, colour);
  return gr;
}

/**
 * The ink a numeral on plain brass is engraved in, and the halo behind it.
 *
 * Derived once, from the brass itself, rather than typed in. What was typed in
 * was `#ffeec4`, which measures **1.03:1** against the specular streak of the
 * disc it is engraved on — the numeral and the brass being, to a reader, the same
 * colour. See the header of `ink.ts`.
 */
export const WEIGHT_INK = inkFor(weightGround());
export const BALLOON_INK = inkFor(balloonGround());

/**
 * Which of the three things a crate window can be showing.
 *
 * Pulled out of the draw call so the legibility test can drive the same three
 * states the renderer does, off the same predicate. A test that re-derived
 * "wrong beats declared" by hand would keep passing after somebody swapped the
 * order here, which is the whole failure it exists to catch.
 */
export function crateState(v: Pick<ViewState, "wrong" | "declared">): CrateState {
  if (v.wrong > 0) return v.declared ? "rejected" : "rejectedEmpty";
  return v.declared ? "declared" : "unknown";
}

/**
 * The verdigris a rejected value is written in — lifted from `C.verdigris`.
 *
 * The frame around a rejected crate stays `#5fae95`; the numeral inside it does
 * not. Verdigris is the one ink in this pack whose luminance sits in the middle
 * (0.349), which is the worst place to be: too dark to separate from mist-lit
 * glass, too light for the dark halo to carry it. Measured against the darkest
 * ground a crate label reaches — mist over `#0f1a20`, the `rejectedEmpty` state
 * — `#5fae95` and its halo come to **2.82:1**, under the non-text bar.
 *
 * `#7fccb3` is the same hue at luminance 0.510 and measures 3.39:1 there. It is
 * still unmistakably cold copper-oxide rather than the celebration gold, which
 * is the whole job the colour is doing.
 */
const VERDIGRIS_INK = "#7fccb3";

/**
 * The ink a crate's label is written in. Unlike the brass and the balloon these
 * colours carry meaning and are not free to be derived — a rejected value goes
 * cold copper-oxide and never warm, so the colour agrees with the slam and the
 * returned weight rather than contradicting them. What IS derived is the halo
 * behind them, and `legibility.test.ts` measures all four states against the
 * window, the specular arc, the rim, the iron and the banding.
 */
export function crateInk(state: CrateState): string {
  if (state === "rejected" || state === "rejectedEmpty") return VERDIGRIS_INK;
  return state === "declared" ? C.gold : "#cfe3ea";
}

export const SERIF =
  '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, "Times New Roman", serif';

const C = {
  night0: "#070a11",
  night1: "#101725",
  night2: "#18213247",
  brassDark: "#3a2a0e",
  // The brass lives in `ink.ts`, which is where its contrast is measured. Two
  // copies of `#f7e6b4` meant the disc could be warmed up without the column it
  // stands on following, and without the legibility table noticing either.
  brassMid: BRASS_MID,
  brassHi: BRASS_HI,
  brassLo: BRASS_LO,
  ivory: "#f2e9d8",
  ink: "#1a1207",
  iron0: "#161b22",
  iron1: "#2b333d",
  iron2: "#0d1116",
  stone0: "#2a2c33",
  stone1: "#171a20",
  stone2: "#3a3d46",
  gold: "#ffd07a",
  copper: COPPER,
  verdigris: "#5fae95",
  glass: "#8fb6c9",
};

export type ViewState = {
  L: Layout;
  beam: Beam;
  spec: PuzzleSpec;
  bodies: Body[];
  drag: Body | null;
  dragX: number;
  dragY: number;
  hover: string | null;
  cam: Camera;
  particles: Particles;
  motes: Float32Array;
  time: number;
  solvedTotal: number;
  gems: number;
  solveT: number;
  wrong: number;
  declared: Frac | null;
  idle: number;
  reduced: boolean;
  audioOn: boolean;
  intro: number;
  banner: { text: string; sub: string; t: number } | null;
  rackHop: Float32Array;
  /** rack index the keyboard is on, or -1 when the keyboard is not in use */
  kbFocus: number;
  /** bodies fade out as they turn to light at the end of a solve */
  bodyFade: number;
  netFloat: number;
};

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement | null = null;
  private grads = new Map<string, CanvasGradient>();
  private bgKey = "";
  w = 0;
  h = 0;
  dpr = 1;

  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const c = canvas.getContext("2d", { alpha: false });
    if (!c) throw new Error("2d context unavailable");
    this.ctx = c;
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.grads.clear();
    this.bg = null;
    this.bgKey = "";
  }

  private grad(
    key: string,
    make: (ctx: CanvasRenderingContext2D) => CanvasGradient,
  ): CanvasGradient {
    let g = this.grads.get(key);
    if (!g) {
      g = make(this.ctx);
      this.grads.set(key, g);
    }
    return g;
  }

  // ------------------------------------------------------------- background

  private buildBackground(L: Layout, rings: number): void {
    const key = `${L.w}x${L.h}:${rings}`;
    if (this.bgKey === key && this.bg) return;
    this.bgKey = key;
    // Half resolution: this layer is nebula, vignette and soft rings, none of
    // which carry an edge. Rebuilding it costs a quarter as much fill, and it
    // is the only per-solve allocation in the renderer.
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(L.w * BG_SCALE));
    c.height = Math.max(1, Math.round(L.h * BG_SCALE));
    const g = c.getContext("2d");
    if (!g) return;
    g.scale(BG_SCALE, BG_SCALE);

    const sky = g.createLinearGradient(0, 0, L.w * 0.35, L.h);
    sky.addColorStop(0, "#0c1220");
    sky.addColorStop(0.45, "#0a0e18");
    sky.addColorStop(1, C.night0);
    g.fillStyle = sky;
    g.fillRect(0, 0, L.w, L.h);

    // stars, seeded so they never crawl
    let s = 987654321;
    const rnd = (): number => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
    for (let i = 0; i < 150; i++) {
      const x = rnd() * L.w;
      const y = rnd() * L.h * 0.8;
      const a = 0.05 + rnd() * 0.35;
      const r = 0.7 + rnd() * 1.8;
      g.fillStyle = `rgba(200,218,255,${a.toFixed(3)})`;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }

    // the orrery: concentric rings behind the apparatus, one lit per solve
    const cx = L.pivot.x;
    const cy = L.pivot.y + L.arm * 0.16;
    const step = Math.max(26, Math.min(L.w, L.h) * 0.055);
    const total = 16;
    for (let i = total - 1; i >= 0; i--) {
      const rx = step * (i + 2.2);
      const ry = rx * 0.42;
      const lit = i < rings;
      g.save();
      g.translate(cx, cy);
      g.beginPath();
      g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      if (lit) {
        g.strokeStyle = `rgba(255,196,110,${(0.30 - i * 0.008).toFixed(3)})`;
        g.lineWidth = 1.6;
        g.shadowColor = "rgba(255,180,90,0.55)";
        g.shadowBlur = 14;
      } else {
        g.strokeStyle = `rgba(130,155,195,0.055)`;
        g.lineWidth = 1;
      }
      g.stroke();
      g.restore();

      if (lit) {
        const ang = i * 0.7 + 0.4;
        const bx = cx + Math.cos(ang) * rx;
        const by = cy + Math.sin(ang) * ry;
        const rg = g.createRadialGradient(bx, by, 0, bx, by, 9);
        rg.addColorStop(0, "rgba(255,226,170,0.95)");
        rg.addColorStop(1, "rgba(255,170,80,0)");
        g.fillStyle = rg;
        g.beginPath();
        g.arc(bx, by, 9, 0, Math.PI * 2);
        g.fill();
      }
    }

    // warm floor bounce
    const floor = g.createLinearGradient(0, L.h * 0.55, 0, L.h);
    floor.addColorStop(0, "rgba(60,40,18,0)");
    floor.addColorStop(1, "rgba(88,58,24,0.34)");
    g.fillStyle = floor;
    g.fillRect(0, L.h * 0.55, L.w, L.h * 0.45);

    // vignette
    const vg = g.createRadialGradient(
      L.w * 0.5,
      L.h * 0.42,
      Math.min(L.w, L.h) * 0.18,
      L.w * 0.5,
      L.h * 0.5,
      Math.max(L.w, L.h) * 0.78,
    );
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.72)");
    g.fillStyle = vg;
    g.fillRect(0, 0, L.w, L.h);

    this.bg = c;
  }

  // -------------------------------------------------------------- main draw

  draw(v: ViewState): void {
    const ctx = this.ctx;
    const L = v.L;
    this.buildBackground(L, Math.min(16, v.solvedTotal));

    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.clearRect(0, 0, L.w, L.h);

    if (this.bg) ctx.drawImage(this.bg, 0, 0, L.w, L.h);
    else {
      ctx.fillStyle = C.night0;
      ctx.fillRect(0, 0, L.w, L.h);
    }

    // camera
    ctx.save();
    ctx.translate(L.w / 2 + v.cam.offsetX, L.h / 2 + v.cam.offsetY);
    ctx.rotate(v.cam.rot);
    ctx.scale(v.cam.zoom, v.cam.zoom);
    ctx.translate(-L.w / 2, -L.h / 2);

    this.lightShaft(L, v);
    this.dust(L, v);

    const introEase = easeOutBack(clamp01(v.intro), 1.2);
    ctx.save();
    if (v.intro < 1) {
      ctx.globalAlpha = clamp01(v.intro * 1.6);
      ctx.translate(0, (1 - introEase) * -L.h * 0.12);
    }

    this.plinth(L, v);
    this.column(L, v);
    this.beamAssembly(L, v);
    this.dropZones(L, v);

    // bodies, back to front: crates first so weights pile in front of them
    ctx.save();
    if (v.bodyFade < 1) ctx.globalAlpha *= v.bodyFade;
    for (const b of v.bodies) if (b.state !== "gone" && b.crate) this.body(L, v, b);
    for (const b of v.bodies) if (b.state !== "gone" && !b.crate) this.body(L, v, b);
    ctx.restore();

    this.rack(L, v);
    ctx.restore();

    if (v.drag) this.body(L, v, v.drag, true);

    this.particles(v);
    this.solveBloom(L, v);
    ctx.restore(); // camera

    this.hud(L, v);
    this.banner(L, v);

    if (v.cam.flashAlpha > 0.001) {
      ctx.fillStyle = `rgba(255,236,200,${v.cam.flashAlpha.toFixed(3)})`;
      ctx.fillRect(0, 0, L.w, L.h);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------ environment

  private lightShaft(L: Layout, v: ViewState): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    // The gradient runs perpendicular to the beam axis so BOTH edges feather
    // out. A shaft with a hard edge reads as a polygon, which is the tell.
    const dirX = L.w * 0.29;
    const dirY = L.h;
    const len = Math.hypot(dirX, dirY) || 1;
    const px = dirY / len;
    const py = -dirX / len;
    const half = L.w * 0.32;
    const mx = L.w * 0.375;
    const my = L.h * 0.5;
    const g = this.grad("shaft", (c) => {
      const gr = c.createLinearGradient(
        mx - px * half,
        my - py * half,
        mx + px * half,
        my + py * half,
      );
      gr.addColorStop(0, "rgba(255,206,140,0)");
      gr.addColorStop(0.34, "rgba(255,216,160,0.10)");
      gr.addColorStop(0.52, "rgba(255,222,170,0.13)");
      gr.addColorStop(0.72, "rgba(255,204,132,0.07)");
      gr.addColorStop(1, "rgba(255,190,110,0)");
      return gr;
    });
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(mx - px * half - dirX * 1.4, my - py * half - dirY * 1.4);
    ctx.lineTo(mx + px * half - dirX * 1.4, my + py * half - dirY * 1.4);
    ctx.lineTo(mx + px * half + dirX * 1.4, my + py * half + dirY * 1.4);
    ctx.lineTo(mx - px * half + dirX * 1.4, my - py * half + dirY * 1.4);
    ctx.closePath();
    ctx.fill();
    const pulse = 0.5 + 0.5 * Math.sin(v.time * 0.6);
    ctx.globalAlpha = 0.4 + pulse * 0.18;
    ctx.fill();
    ctx.restore();
  }

  private dust(L: Layout, v: ViewState): void {
    const ctx = this.ctx;
    const m = v.motes;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < m.length; i += 4) {
      const x = m[i] * L.w;
      const y = m[i + 1] * L.h;
      const r = m[i + 2];
      const a = m[i + 3];
      ctx.fillStyle = `rgba(255,226,178,${(a * 0.5).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------- apparatus

  private plinth(L: Layout, v: ViewState): void {
    const ctx = this.ctx;
    const p = L.plinth;
    const r = Math.min(10, p.h * 0.18);

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 10;
    const g = this.grad(`plinth${p.w}x${p.h}`, (c) => {
      const gr = c.createLinearGradient(p.x, p.y, p.x + p.w * 0.7, p.y + p.h);
      gr.addColorStop(0, "#4b463f");
      gr.addColorStop(0.1, C.stone2);
      gr.addColorStop(0.4, C.stone0);
      gr.addColorStop(1, "#12141a");
      return gr;
    });
    ctx.fillStyle = g;
    roundRect(ctx, p.x, p.y, p.w, p.h, r);
    ctx.fill();
    ctx.restore();

    // chamfered top edge catching the shaft, and a cut reveal below it
    ctx.strokeStyle = "rgba(255,222,170,0.4)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(p.x + r, p.y + 0.9);
    ctx.lineTo(p.x + p.w - r, p.y + 0.9);
    ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x + r, p.y + p.h * 0.16);
    ctx.lineTo(p.x + p.w - r, p.y + p.h * 0.16);
    ctx.stroke();
    // brass inlay strip framing the engraving
    ctx.strokeStyle = "rgba(198,158,84,0.28)";
    ctx.lineWidth = Math.max(1, L.u);
    roundRect(
      ctx,
      p.x + p.w * 0.045,
      p.y + p.h * 0.22,
      p.w * 0.91,
      p.h * 0.66,
      4,
    );
    ctx.stroke();

    // the engraved statement — this is the prompt, and it is part of the object
    const size = L.promptSize;
    ctx.font = `500 ${size}px ${SERIF}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h * 0.54;
    const text = v.spec.prompt;

    let scale = 1;
    const maxW = p.w * 0.88;
    const wpx = ctx.measureText(text).width;
    if (wpx > maxW) scale = maxW / wpx;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.fillText(text, 0, 1.5);
    ctx.fillStyle = "rgba(255,226,180,0.10)";
    ctx.fillText(text, 0, -1.6);
    const solveGlow = v.solveT > 0 ? easeOutCubic(clamp01(v.solveT * 1.6)) : 0;
    ctx.fillStyle =
      solveGlow > 0
        ? `rgba(255,222,158,${0.7 + solveGlow * 0.3})`
        : "rgba(228,206,164,0.82)";
    if (solveGlow > 0) {
      ctx.shadowColor = "rgba(255,190,110,0.9)";
      ctx.shadowBlur = 22 * solveGlow;
    }
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  private column(L: Layout, v: ViewState): void {
    const ctx = this.ctx;
    const topY = L.pivot.y;
    const botY = L.plinth.y + 2;
    const wTop = L.weightR * 0.44;
    const wBot = L.weightR * 0.95;
    const g = this.grad(`col${wBot}`, (c) => {
      const gr = c.createLinearGradient(L.pivot.x - wBot, 0, L.pivot.x + wBot, 0);
      gr.addColorStop(0, C.brassDark);
      gr.addColorStop(0.22, C.brassLo);
      gr.addColorStop(0.42, C.brassHi);
      gr.addColorStop(0.62, C.brassMid);
      gr.addColorStop(1, "#241a06");
      return gr;
    });
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(L.pivot.x - wTop, topY);
    ctx.lineTo(L.pivot.x + wTop, topY);
    ctx.lineTo(L.pivot.x + wBot, botY);
    ctx.lineTo(L.pivot.x - wBot, botY);
    ctx.closePath();
    ctx.fill();

    // collars
    for (const f of [0.22, 0.62]) {
      const y = topY + (botY - topY) * f;
      const half = wTop + (wBot - wTop) * f + L.weightR * 0.16;
      ctx.fillStyle = g;
      roundRect(ctx, L.pivot.x - half, y - L.weightR * 0.15, half * 2, L.weightR * 0.3, 3);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    void v;
  }

  private beamAssembly(L: Layout, v: ViewState): void {
    const ctx = this.ctx;
    const beam = v.beam;
    const mode = v.spec.mode;

    // reference rule behind the beam: the level the arm is trying to find
    ctx.save();
    ctx.strokeStyle = "rgba(150,180,220,0.10)";
    ctx.setLineDash([6, 9]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(L.pivot.x - L.arm * 1.16, L.pivot.y);
    ctx.lineTo(L.pivot.x + L.arm * 1.16, L.pivot.y);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(L.pivot.x, L.pivot.y);
    ctx.rotate(beam.theta);

    const th = L.weightR * 0.38;
    const g = this.grad(`arm${th}`, (c) => {
      const gr = c.createLinearGradient(0, -th, 0, th);
      gr.addColorStop(0, "#2c1f08");
      gr.addColorStop(0.2, C.brassLo);
      gr.addColorStop(0.42, C.brassHi);
      gr.addColorStop(0.6, C.brassMid);
      gr.addColorStop(1, "#241a06");
      return gr;
    });
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-L.arm, -th * 0.62);
    ctx.lineTo(-L.arm * 0.2, -th);
    ctx.lineTo(L.arm * 0.2, -th);
    ctx.lineTo(L.arm, -th * 0.62);
    ctx.lineTo(L.arm, th * 0.62);
    ctx.lineTo(L.arm * 0.2, th);
    ctx.lineTo(-L.arm * 0.2, th);
    ctx.lineTo(-L.arm, th * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // solve: the arm itself becomes the upper bar of an equals sign
    if (v.solveT > 0) {
      const a = Math.sin(clamp01(v.solveT) * Math.PI) ;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = `rgba(255,222,160,${(a * 0.5).toFixed(3)})`;
      ctx.shadowColor = "rgba(255,200,120,0.9)";
      ctx.shadowBlur = 26 * a;
      roundRect(ctx, -L.arm, -th * 0.55, L.arm * 2, th * 1.1, th * 0.5);
      ctx.fill();
      ctx.restore();
    }

    if (mode === "beam") {
      // numbered pegs: distance is now part of the arithmetic
      for (const side of [-1, 1] as Side[]) {
        for (let d = 1; d <= MAX_PEG; d++) {
          const x = side * armDistance(L, "beam", d);
          const isTarget =
            v.spec.hangSlot && v.spec.hangSlot.side === side && v.spec.hangSlot.peg === d;
          ctx.fillStyle = isTarget ? C.gold : "rgba(30,22,8,0.85)";
          ctx.beginPath();
          ctx.arc(x, 0, th * 0.34, 0, Math.PI * 2);
          ctx.fill();
          if (isTarget) {
            const p = 0.5 + 0.5 * Math.sin(v.time * 4);
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.strokeStyle = `rgba(255,208,122,${(0.4 + p * 0.55).toFixed(2)})`;
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            ctx.arc(x, 0, th * (1.05 + p * 0.6), 0, Math.PI * 2);
            ctx.stroke();
            // an empty hook, waiting
            ctx.strokeStyle = `rgba(255,214,140,${(0.3 + p * 0.35).toFixed(2)})`;
            ctx.setLineDash([4, 5]);
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(x, th);
            ctx.lineTo(x, th + L.weightR * 1.1);
            ctx.stroke();
            ctx.restore();
          }
          // peg numerals read against brass AND against the night sky
          ctx.font = `600 ${(th * 1.05).toFixed(1)}px ${SERIF}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "rgba(0,0,0,0.7)";
          ctx.fillText(String(d), x, -th * 1.7 + 1.2);
          ctx.fillStyle = isTarget ? C.gold : "rgba(238,222,186,0.82)";
          ctx.fillText(String(d), x, -th * 1.7);
        }
      }
    }
    ctx.restore();

    // the pivot: knurled knob with a jewel
    const kr = L.weightR * 0.72;
    ctx.save();
    ctx.translate(L.pivot.x, L.pivot.y);
    const kg = this.grad(`knob${kr}`, (c) => {
      const gr = c.createRadialGradient(-kr * 0.4, -kr * 0.5, kr * 0.1, 0, 0, kr);
      gr.addColorStop(0, C.brassHi);
      gr.addColorStop(0.5, C.brassMid);
      gr.addColorStop(1, "#201704");
      return gr;
    });
    ctx.fillStyle = kg;
    ctx.beginPath();
    ctx.arc(0, 0, kr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + beam.theta * 0.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * kr * 0.62, Math.sin(a) * kr * 0.62);
      ctx.lineTo(Math.cos(a) * kr * 0.97, Math.sin(a) * kr * 0.97);
      ctx.stroke();
    }
    const jewel = this.grad(`jewel${kr}`, (c) => {
      const gr = c.createRadialGradient(0, -kr * 0.1, 0, 0, 0, kr * 0.36);
      gr.addColorStop(0, "#fff3d0");
      gr.addColorStop(0.5, "#e0a94a");
      gr.addColorStop(1, "#5a3a0c");
      return gr;
    });
    ctx.fillStyle = jewel;
    ctx.beginPath();
    ctx.arc(0, 0, kr * 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // safety pin: holds the arm level while a crate is sealed
    if (beam.pinOut < 0.99) {
      const out = beam.pinOut;
      const px = L.pivot.x + kr * 1.5 + out * L.weightR * 1.6;
      ctx.save();
      ctx.fillStyle = this.grad(`pin${L.weightR}`, (c) => {
        const gr = c.createLinearGradient(0, -3, 0, 3);
        gr.addColorStop(0, "#8f8f96");
        gr.addColorStop(0.4, "#e9ecf2");
        gr.addColorStop(1, "#4a4d55");
        return gr;
      });
      ctx.translate(px, L.pivot.y);
      roundRect(ctx, -L.weightR * 1.1, -2.4, L.weightR * 1.6, 4.8, 2);
      ctx.fill();
      ctx.restore();
    }

    // the pointer: swings against an engraved arc and exaggerates small error
    const needleLen = L.weightR * 1.5;
    ctx.save();
    ctx.translate(L.pivot.x, L.pivot.y);
    ctx.strokeStyle = "rgba(150,180,220,0.14)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, needleLen * 1.12, Math.PI * 0.36, Math.PI * 0.64);
    ctx.stroke();
    for (let i = -2; i <= 2; i++) {
      const a = Math.PI * 0.5 + i * 0.055;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * needleLen * 1.04, Math.sin(a) * needleLen * 1.04);
      ctx.lineTo(Math.cos(a) * needleLen * 1.2, Math.sin(a) * needleLen * 1.2);
      ctx.strokeStyle = i === 0 ? "rgba(255,214,150,0.5)" : "rgba(150,180,220,0.2)";
      ctx.stroke();
    }
    ctx.rotate(clampNum(beam.theta * 2.6, -0.42, 0.42));
    ctx.fillStyle = v.solveT > 0 ? C.gold : "#d9c9a4";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-2.2, needleLen * 0.4);
    ctx.lineTo(0, needleLen);
    ctx.lineTo(2.2, needleLen * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (mode === "pans") {
      for (const side of [-1, 1] as Side[]) this.dish(L, v, side);
    } else {
      this.hangers(L, v);
    }
  }

  /** Brass eyes and short chains: on the pegged arm a weight must read as HUNG. */
  private hangers(L: Layout, v: ViewState): void {
    const ctx = this.ctx;
    for (const b of v.bodies) {
      if (b.state !== "seated" && b.state !== "fly") continue;
      const p = beamPoint(L, v.beam.theta, b.side, armDistance(L, "beam", b.peg));
      const topY = b.y - L.weightR * 0.55;
      ctx.save();
      ctx.strokeStyle = "rgba(226,198,140,0.85)";
      ctx.lineWidth = Math.max(1.6, L.u * 2);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(b.x, topY);
      ctx.stroke();
      // links, so the chain has a gauge
      const n = 4;
      for (let i = 1; i <= n; i++) {
        const t = i / (n + 1);
        const lx = p.x + (b.x - p.x) * t;
        const ly = p.y + (topY - p.y) * t;
        ctx.strokeStyle = "rgba(255,236,192,0.55)";
        ctx.lineWidth = Math.max(1, L.u);
        ctx.beginPath();
        ctx.ellipse(lx, ly, L.weightR * 0.1, L.weightR * 0.17, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      // the eye at the peg
      ctx.strokeStyle = "rgba(255,232,180,0.95)";
      ctx.lineWidth = Math.max(1.6, L.u * 2.2);
      ctx.beginPath();
      ctx.arc(p.x, p.y, L.weightR * 0.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private dish(L: Layout, v: ViewState, side: Side): void {
    const ctx = this.ctx;
    const anchor = beamPoint(L, v.beam.theta, side, L.arm);
    const d = dishCentre(L, v.beam, side);

    // three suspension cords
    ctx.strokeStyle = "rgba(230,205,150,0.5)";
    ctx.lineWidth = Math.max(1, L.u * 1.2);
    for (const f of [-0.44, 0, 0.44]) {
      const ex = d.x + Math.cos(d.phi) * L.dishW * 0.5 * f;
      const ey = d.y + Math.sin(d.phi) * L.dishW * 0.5 * f;
      ctx.beginPath();
      ctx.moveTo(anchor.x, anchor.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.phi);
    const w = L.dishW;
    const hh = L.dishH;
    const g = this.grad(`dish${w}`, (c) => {
      const gr = c.createLinearGradient(0, -hh, 0, hh * 2.4);
      gr.addColorStop(0, "#6b5220");
      gr.addColorStop(0.3, C.brassMid);
      gr.addColorStop(0.55, C.brassHi);
      gr.addColorStop(0.8, "#8a6a28");
      gr.addColorStop(1, "#2b1f08");
      return gr;
    });
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, hh / 2, 0, Math.PI, Math.PI * 2);
    ctx.bezierCurveTo(w / 2, hh * 1.9, -w / 2, hh * 1.9, -w / 2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // inner well
    ctx.fillStyle = this.grad(`dishin${w}`, (c) => {
      const gr = c.createLinearGradient(0, -hh / 2, 0, hh / 2);
      gr.addColorStop(0, "#2e2208");
      gr.addColorStop(1, "#7c5f24");
      return gr;
    });
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2 - 2, hh / 2 - 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,232,180,0.45)";
    ctx.lineWidth = Math.max(1, L.u);
    ctx.stroke();
    ctx.restore();
  }

  // ---------------------------------------------------------------- objects

  private body(L: Layout, v: ViewState, b: Body, dragging = false): void {
    const ctx = this.ctx;
    const r = b.crate ? L.crateR : L.weightR;
    ctx.save();
    ctx.translate(b.x, b.y);

    if (dragging || b.state === "fly") {
      // contact shadow on the floor tells you how high you are holding it
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(6, r * 1.9, r * 0.9, r * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.rotate(b.rot);
    const sx = 1 + b.sq;
    const sy = 1 - b.sq;
    ctx.scale(sx, sy);

    if (b.crate) this.crate(L, v, b, r);
    else if (b.balloon) this.balloon(L, v, b, r);
    else this.weight(v, b, r, dragging);
    ctx.restore();
  }

  private weight(v: ViewState, b: Body, r: number, dragging: boolean): void {
    const ctx = this.ctx;
    const h = r * 1.02;
    const ry = r * 0.34;

    if (b.glow > 0.01 || dragging) {
      const a = dragging ? 0.5 : b.glow * 0.55;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const gg = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 2.1);
      gg.addColorStop(0, `rgba(255,214,150,${(a * 0.5).toFixed(3)})`);
      gg.addColorStop(1, "rgba(255,180,90,0)");
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(0, 0, r * 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // body
    const g = this.grad(`wbody${r.toFixed(1)}`, (c) =>
      stops(c.createLinearGradient(-r, 0, r, 0), BRASS_BODY),
    );
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-r, -h / 2);
    ctx.lineTo(r, -h / 2);
    ctx.lineTo(r, h / 2 - ry * 0.2);
    ctx.ellipse(0, h / 2 - ry * 0.2, r, ry, 0, 0, Math.PI);
    ctx.lineTo(-r, -h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // top face
    const tg = this.grad(`wtop${r.toFixed(1)}`, (c) =>
      stops(c.createLinearGradient(-r, -h / 2 - ry, r, -h / 2 + ry), BRASS_TOP),
    );
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.ellipse(0, -h / 2, r, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,244,214,0.6)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, -h / 2, r * 0.62, ry * 0.62, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(60,42,10,0.4)";
    ctx.stroke();

    // A weight the player put there is not riveted down: it wears a bright
    // collar, so "mine, and I can take it back" is visible without a word.
    if (!b.fixed && b.state === "seated") {
      ctx.strokeStyle = "rgba(255,240,206,0.5)";
      ctx.lineWidth = Math.max(1.2, r * 0.055);
      ctx.beginPath();
      ctx.ellipse(0, h * 0.2, r * 0.99, ry * 0.99, 0, 0, Math.PI);
      ctx.stroke();
    }

    // knurl band
    ctx.strokeStyle = "rgba(50,34,8,0.28)";
    for (let i = -5; i <= 5; i++) {
      const x = (i / 5) * r * 0.86;
      ctx.beginPath();
      ctx.moveTo(x, -h / 2 + ry * 0.7);
      ctx.lineTo(x, -h / 2 + ry * 1.5);
      ctx.stroke();
    }

    this.numeral(toKeyDisplay(b.value), 0, h * 0.06, r, v, WEIGHT_INK);
  }

  private balloon(L: Layout, v: ViewState, b: Body, r: number): void {
    const ctx = this.ctx;
    const bob = Math.sin(b.bob) * r * 0.07;
    ctx.save();
    ctx.translate(0, -r * 0.55 + bob);

    // tether, down to whatever it is straining against
    ctx.strokeStyle = "rgba(240,220,190,0.55)";
    ctx.lineWidth = Math.max(1, L.u);
    ctx.beginPath();
    ctx.moveTo(0, r * 1.05);
    ctx.quadraticCurveTo(r * 0.3, r * 1.9, -r * 0.08, r * 2.65);
    ctx.stroke();

    const g = this.grad(`balloon${r.toFixed(1)}`, (c) =>
      stops(c.createRadialGradient(-r * 0.35, -r * 0.5, r * 0.08, 0, 0, r * 1.35), BALLOON_BODY),
    );
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 12;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.94, r * 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // neck
    ctx.fillStyle = "#8c4a22";
    ctx.beginPath();
    ctx.moveTo(-r * 0.16, r * 1.02);
    ctx.lineTo(r * 0.16, r * 1.02);
    ctx.lineTo(0, r * 1.26);
    ctx.closePath();
    ctx.fill();

    // foil highlight
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(255,240,220,0.25)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.34, -r * 0.44, r * 0.26, r * 0.42, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    this.numeral(toKeyDisplay(b.value), 0, r * 0.08, r * 0.94, v, BALLOON_INK);
    ctx.restore();
  }

  private crate(L: Layout, v: ViewState, b: Body, r: number): void {
    const ctx = this.ctx;
    const w = r * 1.9;
    const h = r * 1.72;
    const g = this.grad(`crate${r.toFixed(1)}`, (c) => {
      const gr = c.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
      gr.addColorStop(0, C.iron1);
      gr.addColorStop(0.35, C.iron0);
      gr.addColorStop(1, C.iron2);
      return gr;
    });
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = g;
    roundRect(ctx, -w / 2, -h / 2, w, h, r * 0.18);
    ctx.fill();
    ctx.restore();

    // brass banding + rivets
    ctx.strokeStyle = "rgba(198,158,84,0.75)";
    ctx.lineWidth = Math.max(1.4, L.u * 1.6);
    roundRect(ctx, -w / 2 + 3, -h / 2 + 3, w - 6, h - 6, r * 0.14);
    ctx.stroke();
    ctx.fillStyle = "#d8b877";
    for (const [rx, ry] of [
      [-w / 2 + 6, -h / 2 + 6],
      [w / 2 - 6, -h / 2 + 6],
      [-w / 2 + 6, h / 2 - 6],
      [w / 2 - 6, h / 2 - 6],
    ]) {
      ctx.beginPath();
      ctx.arc(rx, ry, Math.max(1.4, r * 0.075), 0, Math.PI * 2);
      ctx.fill();
    }

    // window
    const wr = r * 0.62;
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, wr, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = v.declared ? "#2c2412" : "#0f1a20";
    ctx.fillRect(-wr, -wr, wr * 2, wr * 2);
    if (!v.declared || v.wrong > 0) {
      // mist: the unknown, visibly unresolved
      for (let i = 0; i < 4; i++) {
        const a = v.time * (0.4 + i * 0.13) + i * 1.7;
        ctx.fillStyle = `rgba(120,170,190,${0.10 + i * 0.03})`;
        ctx.beginPath();
        ctx.ellipse(
          Math.cos(a) * wr * 0.35,
          Math.sin(a * 1.3) * wr * 0.3,
          wr * (0.55 + 0.1 * Math.sin(a * 2)),
          wr * 0.36,
          a,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    } else {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const gg = ctx.createRadialGradient(0, 0, 0, 0, 0, wr);
      gg.addColorStop(0, "rgba(255,214,140,0.5)");
      gg.addColorStop(1, "rgba(255,170,80,0)");
      ctx.fillStyle = gg;
      ctx.fillRect(-wr, -wr, wr * 2, wr * 2);
      ctx.restore();
    }
    ctx.restore();

    // glass rim
    ctx.strokeStyle = "rgba(214,178,104,0.9)";
    ctx.lineWidth = Math.max(1.4, L.u * 1.8);
    ctx.beginPath();
    ctx.arc(0, 0, wr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, wr * 0.82, Math.PI * 1.05, Math.PI * 1.5);
    ctx.stroke();
    ctx.restore();

    const label = v.declared ? toKeyDisplay(v.declared) : "x";
    this.numeral(label, 0, 0, wr * 1.45, v, crateInk(crateState(v)), true);

    if (v.wrong > 0) {
      ctx.save();
      ctx.globalAlpha = clamp01(v.wrong);
      ctx.strokeStyle = C.verdigris;
      ctx.lineWidth = 3;
      roundRect(ctx, -w / 2, -h / 2, w, h, r * 0.18);
      ctx.stroke();
      ctx.restore();
    }
    void b;
  }

  /** Engraved numerals, including stacked fractions. */
  private numeral(
    label: string,
    x: number,
    y: number,
    r: number,
    v: ViewState,
    color: string,
    glow = false,
  ): void {
    const ctx = this.ctx;
    const slash = label.indexOf("/");
    // The counter-ink, derived from the ink, which was derived from the surface.
    // See the header of `ink.ts`: there is provably no single colour that reads
    // against all of the brass, so the numeral is drawn as a pair.
    const halo = haloFor(color);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (slash > 0) {
      const n = label.slice(0, slash);
      const d = label.slice(slash + 1);
      const s = stackedNumeralPx(r);
      // Was `r * 0.12`. The bigger rows plus their halos put the denominator's
      // descender 0.03px past the brass belly on a 320×568 phone — measured, by
      // the assertion in `legibility.test.ts` that now guards it — so the whole
      // stack sits a little higher. The top face it was dropping clear of is a
      // surface the halo is measured against now anyway.
      const yy = y + r * 0.09;
      ctx.font = `600 ${s.toFixed(1)}px ${SERIF}`;
      // Pushed apart from 0.52/0.54: at the bigger type both rows carry a halo,
      // and at the old spacing the numerator's halo and the bar's halo closed to
      // within half a pixel and read as one dark mass with a hairline in it.
      engrave(ctx, n, x, yy - s * 0.58, color, glow, s, halo);
      engrave(ctx, d, x, yy + s * 0.6, color, glow, s, halo);
      // The bar carries the same pair. A hairline in the ink alone disappears
      // into the specular streak exactly as the digits did, and a vanished bar
      // turns 1/2 into two stacked numbers.
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x - s * 0.44, yy);
      ctx.lineTo(x + s * 0.44, yy);
      ctx.strokeStyle = halo;
      ctx.lineWidth = Math.max(1, r * 0.055) + haloWidth(s);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, r * 0.055);
      ctx.stroke();
      ctx.lineCap = "butt";
    } else {
      // Fitted, not guessed. The old line picked `r * 0.78` for anything two
      // digits or wider and drew centred, so `4232831450` — which the shipped
      // top rung really does produce — laid about four disc-widths of ink across
      // its neighbours on the rail. `NUMERAL_FACE` is the flat between the
      // knurled rims; the type shrinks until the measured ink fits inside it and
      // stops at `NUMERAL_MIN_PX`, the legibility floor. A numeral that would
      // still not fit at the floor never reaches here: `numeralCapacity` refuses
      // the board upstream. The clamp is the backstop for that promise, not the
      // mechanism, and it is the one that guarantees no overrun on any device.
      const digits = label.replace("−", "").replace("-", "").length;
      const ideal = idealNumeralPx(r, digits);
      ctx.font = `600 ${ideal.toFixed(1)}px ${SERIF}`;
      const s = fittedNumeralPx(ideal, ctx.measureText(label).width, r * NUMERAL_FACE);
      if (s !== ideal) ctx.font = `600 ${s.toFixed(1)}px ${SERIF}`;
      engrave(ctx, label, x, y, color, glow, s, halo);
    }
    void v;
  }

  // ------------------------------------------------------------- drop zones

  private dropZones(L: Layout, v: ViewState): void {
    const active = v.drag !== null;
    const idlePulse = v.idle > 1 ? clamp01((v.idle - 1) / 1.2) : 0;
    if (!active && idlePulse <= 0) return;
    if (v.spec.kind === "fill" && v.spec.fillSide !== null) {
      const d = dishCentre(L, v.beam, v.spec.fillSide);
      const hot = v.hover === "dish";
      this.zoneRing(d.x, d.y, L.dishW * 0.62, v.time, hot ? 1 : active ? 0.6 : idlePulse * 0.4);
    } else if (v.spec.kind === "declare") {
      for (const b of v.bodies) {
        if (!b.crate) continue;
        const hot = v.hover === "crate";
        this.zoneRing(b.x, b.y, L.crateR * 1.5, v.time, hot ? 1 : active ? 0.6 : idlePulse * 0.4);
      }
    } else if (v.spec.kind === "hang" && v.spec.hangSlot) {
      const p = beamPoint(
        L,
        v.beam.theta,
        v.spec.hangSlot.side,
        armDistance(L, "beam", v.spec.hangSlot.peg),
      );
      const hot = v.hover === "peg";
      this.zoneRing(
        p.x,
        p.y + L.weightR * 1.55,
        L.weightR * 1.5,
        v.time,
        hot ? 1 : active ? 0.6 : idlePulse * 0.4,
      );
    }
  }

  private zoneRing(x: number, y: number, r: number, time: number, strength: number): void {
    if (strength <= 0.01) return;
    const ctx = this.ctx;
    const p = 0.5 + 0.5 * Math.sin(time * 3.4);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(255,206,128,${(0.22 + 0.4 * strength * p).toFixed(3)})`;
    ctx.lineWidth = 2 + strength * 2;
    ctx.setLineDash([r * 0.28, r * 0.2]);
    ctx.lineDashOffset = -time * 26;
    ctx.beginPath();
    ctx.arc(x, y, r * (1 + p * 0.045), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------------ rack

  private rack(L: Layout, v: ViewState): void {
    const ctx = this.ctx;
    const n = v.spec.rack.length;

    // the rail
    for (let row = 0; row < L.rack.rows; row++) {
      const y = L.rack.y + row * L.rack.slotH + L.rack.slotH * 0.5 + L.weightR * 1.05;
      const inRow = row === L.rack.rows - 1 ? n - L.rack.cols * row : L.rack.cols;
      const wRail = inRow * L.rack.slotW;
      ctx.save();
      const g = this.grad(`rail${wRail.toFixed(0)}`, (c) => {
        const gr = c.createLinearGradient(0, y - 5, 0, y + 9);
        gr.addColorStop(0, "#5b4422");
        gr.addColorStop(0.3, "#4a3623");
        gr.addColorStop(1, "#1d140c");
        return gr;
      });
      ctx.fillStyle = g;
      roundRect(ctx, L.w / 2 - wRail / 2, y - 4, wRail, 10, 4);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,214,160,0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(L.w / 2 - wRail / 2 + 4, y - 3.4);
      ctx.lineTo(L.w / 2 + wRail / 2 - 4, y - 3.4);
      ctx.stroke();
      ctx.restore();
    }

    for (let i = 0; i < n; i++) {
      const p = rackSlot(L, i, n);
      if (i === v.kbFocus) {
        ctx.save();
        ctx.strokeStyle = "rgba(255,214,150,0.85)";
        ctx.lineWidth = 2;
        roundRect(
          ctx,
          p.x - L.rack.slotW * 0.44,
          p.y - L.rack.slotH * 0.42,
          L.rack.slotW * 0.88,
          L.rack.slotH * 0.84,
          6,
        );
        ctx.stroke();
        ctx.restore();
      }
      const hop = v.rackHop[i] ?? 0;
      const dummy: Body = {
        ...RACK_PROTO,
        value: v.spec.rack[i],
        balloon: toNumber(v.spec.rack[i]) < 0,
        x: p.x,
        y: p.y - hop * L.weightR * 0.5,
        sq: -hop * 0.12,
        glow: hop * 0.8,
      };
      this.body(L, v, dummy);
    }
  }

  // ------------------------------------------------------------------ juice

  private particles(v: ViewState): void {
    const ctx = this.ctx;
    const P = v.particles;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < P.life.length; i++) {
      const l = P.life[i];
      if (l <= 0) continue;
      const k = l / P.maxLife[i];
      const s = P.size[i];
      const x = P.x[i];
      const y = P.y[i];
      const hue = P.hue[i];
      switch (P.kind[i]) {
        case 0: // dust
          ctx.fillStyle = `rgba(214,190,150,${(k * 0.28).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(x, y, s * (1.6 - k * 0.6), 0, Math.PI * 2);
          ctx.fill();
          break;
        case 1: // spark streak
          ctx.strokeStyle = `hsla(${hue},95%,${60 + k * 30}%,${k.toFixed(3)})`;
          ctx.lineWidth = s * 0.5;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - P.vx[i] * 0.016, y - P.vy[i] * 0.016);
          ctx.stroke();
          break;
        case 2: {
          // gold mote with a soft halo
          const a = k * k;
          ctx.fillStyle = `hsla(${hue},100%,72%,${(a * 0.95).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(x, y, s * (0.5 + k * 0.6), 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `hsla(${hue},100%,60%,${(a * 0.22).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(x, y, s * 2.4, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        default: {
          // brass shard
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(P.rot[i]);
          ctx.fillStyle = `hsla(${hue},70%,${45 + k * 35}%,${k.toFixed(3)})`;
          ctx.fillRect(-s * 0.5, -s * 0.22, s, s * 0.44);
          ctx.restore();
        }
      }
    }
    ctx.restore();
  }

  private solveBloom(L: Layout, v: ViewState): void {
    if (v.solveT <= 0 || v.solveT >= 1) return;
    const ctx = this.ctx;
    const t = v.solveT;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    // two expanding rings from the pivot
    for (let i = 0; i < 2; i++) {
      const tt = clamp01((t - i * 0.12) / 0.75);
      if (tt <= 0) continue;
      const e = easeOutQuint(tt);
      const r = e * Math.max(L.w, L.h) * (0.42 + i * 0.16);
      ctx.strokeStyle = `rgba(255,214,150,${((1 - tt) * 0.5).toFixed(3)})`;
      ctx.lineWidth = (1 - tt) * 9 + 1;
      ctx.beginPath();
      ctx.ellipse(L.pivot.x, L.pivot.y, r, r * 0.62, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // the lower bar of the equals sign: the beam finally has a partner
    const barA = Math.sin(clamp01(t * 1.25) * Math.PI);
    const th = L.weightR * 0.38;
    // clear the hanging weights on the pegged arm, hug the beam on the dishes
    const gap = v.spec.mode === "beam" ? L.weightR * 3.1 : th * 2.4;
    ctx.fillStyle = `rgba(255,224,168,${(barA * 0.55).toFixed(3)})`;
    ctx.shadowColor = "rgba(255,196,110,0.9)";
    ctx.shadowBlur = 24 * barA;
    roundRect(
      ctx,
      L.pivot.x - L.arm * (0.4 + 0.6 * easeOutCubic(clamp01(t * 2))),
      L.pivot.y + gap,
      L.arm * 2 * (0.4 + 0.6 * easeOutCubic(clamp01(t * 2))),
      th * 1.1,
      th * 0.55,
    );
    ctx.fill();
    ctx.restore();
  }

  // ------------------------------------------------------------------- hud

  private hud(L: Layout, v: ViewState): void {
    const ctx = this.ctx;
    // The stack starts where the layout put it, under the host's exit control.
    // It used to start at the padded corner, which is exactly where the host
    // paints "back" — the movement name was behind a button on every device.
    const s = L.hudSize;
    const hx = L.hud.x;
    const hy = L.hud.y;

    ctx.save();
    ctx.font = `600 ${s}px ${SERIF}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(226,206,168,0.62)";
    const title = v.spec.movementName.toUpperCase();
    let x = hx;
    for (const ch of title) {
      ctx.fillText(ch, x, hy);
      x += ctx.measureText(ch).width + s * 0.16;
    }

    // progress through the movement
    const dotY = hy + s * 1.9;
    for (let i = 0; i < 5; i++) {
      const done = i < v.solvedTotal % 5 || (v.solvedTotal > 0 && v.solvedTotal % 5 === 0 && false);
      ctx.beginPath();
      ctx.arc(hx + 4 + i * s * 0.85, dotY + 3, 3, 0, Math.PI * 2);
      ctx.fillStyle = done ? "rgba(255,208,122,0.9)" : "rgba(200,190,170,0.2)";
      ctx.fill();
    }

    // gems for clean solves
    for (let i = 0; i < Math.min(v.gems, 12); i++) {
      const gx = hx + 4 + i * s * 0.8;
      const gy = dotY + s * 1.5;
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = "rgba(255,200,120,0.85)";
      ctx.fillRect(-3, -3, 6, 6);
      ctx.restore();
    }

    // sound toggle, under the host's how-to-play control for the same reason
    const bx = L.sound.x;
    const by = L.sound.y;
    ctx.strokeStyle = v.audioOn ? "rgba(240,214,160,0.75)" : "rgba(180,170,150,0.32)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(bx - 8, by - 3);
    ctx.lineTo(bx - 4, by - 3);
    ctx.lineTo(bx, by - 8);
    ctx.lineTo(bx, by + 8);
    ctx.lineTo(bx - 4, by + 3);
    ctx.lineTo(bx - 8, by + 3);
    ctx.closePath();
    ctx.stroke();
    if (v.audioOn) {
      ctx.beginPath();
      ctx.arc(bx + 2, by, 5, -0.9, 0.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(bx + 2, by, 9, -0.9, 0.9);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(bx + 3, by - 5);
      ctx.lineTo(bx + 11, by + 5);
      ctx.moveTo(bx + 11, by - 5);
      ctx.lineTo(bx + 3, by + 5);
      ctx.stroke();
    }
    ctx.restore();
  }

  private banner(L: Layout, v: ViewState): void {
    if (!v.banner) return;
    const ctx = this.ctx;
    const t = v.banner.t;
    const inA = clamp01(t / 0.25);
    const outA = 1 - clamp01((t - 0.75) / 0.25);
    const a = Math.min(inA, outA);
    if (a <= 0) return;
    const y = L.h * 0.4;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const s = Math.min(L.w / 12, 46);
    ctx.font = `600 ${s}px ${SERIF}`;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillText(v.banner.text, L.w / 2, y + 2);
    ctx.fillStyle = "rgba(255,224,170,0.95)";
    ctx.shadowColor = "rgba(255,190,110,0.7)";
    ctx.shadowBlur = 22;
    ctx.fillText(v.banner.text, L.w / 2, y);
    ctx.shadowBlur = 0;
    if (v.banner.sub) {
      ctx.font = `500 ${s * 0.36}px ${SERIF}`;
      ctx.fillStyle = "rgba(226,206,168,0.7)";
      let x = L.w / 2 - measureTracked(ctx, v.banner.sub, s * 0.14) / 2;
      for (const ch of v.banner.sub.toUpperCase()) {
        ctx.textAlign = "left";
        ctx.fillText(ch, x, y + s * 0.85);
        x += ctx.measureText(ch).width + s * 0.14;
      }
    }
    ctx.restore();
  }
}

const RACK_PROTO: Body = {
  id: "proto",
  value: { n: 1, d: 1 },
  balloon: false,
  crate: false,
  fixed: false,
  state: "rack",
  side: 1,
  peg: 3,
  slot: 0,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  sq: 0,
  sqVel: 0,
  rot: 0,
  rotVel: 0,
  trot: 0,
  t: 0,
  dur: 0,
  fx: 0,
  fy: 0,
  tx: 0,
  ty: 0,
  arc: 0,
  glow: 0,
  seatedAt: 0,
  bob: 0,
};

function measureTracked(ctx: CanvasRenderingContext2D, s: string, track: number): number {
  let w = 0;
  for (const ch of s.toUpperCase()) w += ctx.measureText(ch).width + track;
  return w;
}

/**
 * How wide the halo behind a numeral of `px` type is, in pixels.
 *
 * A stroke is centred on the outline, so half of this lies outside the glyph —
 * `px * 0.075` — and half lies inside, where the fill immediately paints over it.
 * The stems therefore keep their full weight and only the outside is gained,
 * which is the whole reason the halo is stroked before the fill and not after.
 *
 * 0.15em is a working span rather than a maximum, and the counters — the holes in
 * 0, 6, 8 and 9 — are the constraint in the other direction, because nothing
 * fills those back in. At the pack's 15px floor the halo closes in by 1.13px on
 * each side of a counter roughly 4px wide, which leaves it open; at twice this
 * width it would shut. `legibility.test.ts` holds both ends.
 */
export function haloWidth(px: number): number {
  return Math.max(2, px * 0.15);
}

/**
 * A numeral, cut into whatever it is lying on.
 *
 * Three passes, and each one is load-bearing:
 *
 *   1. the halo, offset down — the shadow that makes the digit read as *struck
 *      into* the brass rather than painted onto it. This is what the old single
 *      `rgba(28,18,4,0.85)` copy was doing, and it is the only part of the old
 *      version that was doing anything for contrast: one direction out of four.
 *   2. the halo, on the glyph's own centre — the ring. This is the new part. It
 *      is what makes the contrast claim in `ink.ts` true in every direction
 *      rather than only below the glyph.
 *   3. the ink.
 */
export function engrave(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  glow: boolean,
  px: number,
  halo: string,
): void {
  const w = haloWidth(px);
  ctx.save();
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.strokeStyle = halo;
  ctx.lineWidth = w;
  ctx.strokeText(text, x, y + Math.max(1, px * 0.06));
  ctx.strokeText(text, x, y);
  ctx.restore();
  if (glow) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  } else {
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }
}

function toKeyDisplay(f: Frac): string {
  const s = f.d === 1 ? String(f.n) : `${f.n}/${f.d}`;
  return s.replace("-", "−");
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function clampNum(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
