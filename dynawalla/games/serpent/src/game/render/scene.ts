/**
 * The look: a bioluminescent abyss.
 *
 * Everything is lit from inside — the serpent glows, the plankton glow, the
 * vent rim glows — against near-black water crossed by slow shafts of light and
 * drifting marine snow. It is not a neon-vector arcade look and it is not a
 * worksheet: it is a place, and the numbers live in it.
 *
 * Two rules the art follows without exception:
 *   · An orb's appearance never tells you whether it is the right answer. The
 *     printed value is the only signal. Colour arrives *after* the bite.
 *   · Nothing means anything by colour alone. A correct bite is gold *and* a
 *     rising chime *and* growth *and* a bulge travelling down the body.
 */

import { TAU, clamp, easeOutCubic, easeOutExpo } from "../num.ts";
import { COLORS, TUNE } from "../tuning.ts";
import { bolusTintAt } from "../serpent.ts";
import { orbDrawRadius } from "../orbs.ts";
import { NO_INSETS, safeRect, type Insets } from "../../../../../packs/shared/game-chrome/index.ts";
import {
  POLYP_OUT,
  SHAKE_HEADROOM,
  arenaBoard,
  arenaFrame,
  rimEdge,
  rimPerimeter,
  sampleRim,
  topChromeBand,
  type Aspect,
  type Board,
} from "../arena.ts";
import type { World } from "../world.ts";
import { GLOW_PX, MOTE_PX, sprites } from "./sprites.ts";
import { drawLabel, labelInk, labelWidth, type LabelStyle } from "./glyphs.ts";
import { promptDrawScale, promptFit, type PromptBlock } from "./prompt.ts";
import { PK_BUBBLE, PK_MOTE, PK_SHARD } from "../fx/particles.ts";

/**
 * The frame, as the renderer sees it.
 *
 * `safe` is the rectangle inside the display cutout and the home indicator. The
 * water, the snow and the vignette ignore it and fill the whole viewport, which
 * is what `viewport-fit=cover` is for; the arena and every readout are laid out
 * inside it, because a rim a child cannot see is a wall they die on and a figure
 * under the cutout is a figure nobody reads.
 */
export type View = {
  cx: number;
  cy: number;
  scale: number;
  w: number;
  h: number;
  dpr: number;
  /** The measured safe-area insets. Everything a child reads is laid out inside them. */
  insets: Insets;
  /** The viewport minus those insets. */
  safe: { x: number; y: number; w: number; h: number };
  /**
   * The board's proportions, short half-extent normalised to 1.
   *
   * The renderer measures the frame; `mount.ts` hands this straight to the world,
   * so the shape a child steers against and the shape that is drawn are one
   * measurement and not two.
   */
  aspect: Aspect;
  /** The band across the top of the safe box the host's own chrome sits in. */
  chromeBand: number;
};

type Snow = { x: number; y: number; r: number; vy: number; vx: number; a: number; phase: number };

export type Renderer = {
  view: View;
  /**
   * `insets` is required, not optional. A defaulted safe area is a game that
   * forgets to measure one, compiles clean, and draws under the cutout — which
   * is a defect that exists only on hardware.
   */
  resize(w: number, h: number, dpr: number, insets: Insets): void;
  draw(world: World, stickAlpha: number): void;
  toWorld(clientX: number, clientY: number, rect: DOMRect): { x: number; y: number };
};

const ORB_LABEL: LabelStyle = {
  size: 20,
  fill: "#f2feff",
  outline: "rgba(2,14,22,0.92)",
  outlineWidth: 3,
  weight: 800,
  tracking: 0,
};

const PROMPT_LABEL: LabelStyle = {
  size: 200,
  fill: "#a9f4ff",
  outline: "rgba(0,0,0,0)",
  outlineWidth: 0,
  weight: 800,
  tracking: 2,
};

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("no 2d context");
  const g: CanvasRenderingContext2D = ctx;
  const sp = sprites();

  const view: View = {
    cx: 0,
    cy: 0,
    scale: 1,
    w: 1,
    h: 1,
    dpr: 1,
    insets: NO_INSETS,
    safe: { x: 0, y: 0, w: 1, h: 1 },
    aspect: { x: 1, y: 1 },
    chromeBand: 0,
  };
  let bg: HTMLCanvasElement | null = null;
  const snowFar: Snow[] = [];
  const snowNear: Snow[] = [];
  let shownPrompt = "";
  let promptT = 1;
  let lastTime = 0;

  /**
   * The fitted condition, and the block the previous one was fitted to.
   *
   * Cached because a fit is a binary search over a measurement and neither belongs
   * in a frame, and because the outgoing condition has to keep the size it was
   * fitted at while it blows away — re-fitting it against the new arena would make
   * the departing string jump before it faded.
   *
   * The key carries the arena radius rounded to a whole pixel, so the block is
   * re-laid-out a handful of times as the vent closes rather than 60 times a
   * second, and never at all on a screen that is not moving.
   */
  let promptBlock: PromptBlock | null = null;
  let promptKey = "";
  let outgoingBlock: PromptBlock | null = null;
  /** The last condition we shouted about, so the shout is once and not per frame. */
  let promptComplaint = "";

  function fittedPrompt(text: string, arenaR: number): PromptBlock {
    // Every input the fit reads is in the key, `view.safe.h` included: on a wide,
    // short viewport the height is what binds a three-line block, and it can change
    // while `view.scale` and `view.safe.w` do not.
    const key = `${text}|${Math.round(arenaR * view.scale)}|${Math.round(view.safe.w)}|${Math.round(view.safe.h)}`;
    if (promptBlock && promptKey === key) return promptBlock;
    const block = promptFit(text, view.safe, view.scale, arenaR, (line, size) =>
      labelInk(line, { ...PROMPT_LABEL, size }),
    );
    if (!block.fits && promptComplaint !== text) {
      promptComplaint = text;
      // Never silent. A condition that cannot be drawn at the legibility floor is
      // a row this pack should not have been served, and the only way anyone finds
      // out is if it says so.
      console.error(
        `[serpent] the condition "${text}" does not fit the vent at the legibility ` +
          `floor: ${block.lines.length} line(s) of ${block.size.toFixed(0)}px need ` +
          `${block.w.toFixed(0)}x${block.h.toFixed(0)}px and the disc is ` +
          `${(arenaR * view.scale * 2).toFixed(0)}px across. It is drawn anyway, cramped.`,
      );
    }
    promptKey = key;
    promptBlock = block;
    return block;
  }

  /** One condition, one pass, `block.size` already decided. */
  function drawPromptBlock(
    block: PromptBlock,
    x: number,
    y: number,
    scale: number,
    alpha: number,
  ): void {
    const style: LabelStyle = { ...PROMPT_LABEL, size: block.size };
    for (let i = 0; i < block.lines.length; i++) {
      drawLabel(g, block.lines[i] as string, style, x, y + (block.offsets[i] as number) * scale, view.dpr, scale, alpha);
    }
  }

  /**
   * The most rim samples ever taken, and the buffers they land in.
   *
   * Allocated once: `drawRim` runs every frame and the walk must not allocate.
   */
  const RIM_SAMPLES = 200;
  const rimX = new Float32Array(RIM_SAMPLES);
  const rimY = new Float32Array(RIM_SAMPLES);
  const rimNX = new Float32Array(RIM_SAMPLES);
  const rimNY = new Float32Array(RIM_SAMPLES);

  // Scratch buffers for the body outline. Allocated once.
  const nx = new Float32Array(TUNE.maxSegments + 2);
  const ny = new Float32Array(TUNE.maxSegments + 2);
  const bx = new Float32Array(TUNE.maxSegments + 2);
  const by = new Float32Array(TUNE.maxSegments + 2);
  const swim = new Float32Array(TUNE.maxSegments + 2);

  function buildBackground(): void {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.floor(view.w * view.dpr));
    c.height = Math.max(1, Math.floor(view.h * view.dpr));
    const bgx = c.getContext("2d");
    if (!bgx) return;
    bgx.scale(view.dpr, view.dpr);

    const top = bgx.createLinearGradient(0, 0, 0, view.h);
    top.addColorStop(0, COLORS.deepTop);
    top.addColorStop(0.55, COLORS.deepBottom);
    top.addColorStop(1, COLORS.abyss);
    bgx.fillStyle = top;
    bgx.fillRect(0, 0, view.w, view.h);

    const pool = bgx.createRadialGradient(view.cx, view.cy, 0, view.cx, view.cy, view.scale * 1.9);
    pool.addColorStop(0, "rgba(24,92,116,0.34)");
    pool.addColorStop(0.5, "rgba(10,48,66,0.16)");
    pool.addColorStop(1, "rgba(0,0,0,0)");
    bgx.fillStyle = pool;
    bgx.fillRect(0, 0, view.w, view.h);

    const vig = bgx.createRadialGradient(view.cx, view.cy, view.scale * 0.9, view.cx, view.cy, view.scale * 2.4);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.72)");
    bgx.fillStyle = vig;
    bgx.fillRect(0, 0, view.w, view.h);

    bg = c;
  }

  function seedSnow(): void {
    snowFar.length = 0;
    snowNear.length = 0;
    const area = (view.w * view.h) / (900 * 700);
    const far = Math.round(clamp(120 * area, 40, 190));
    const near = Math.round(clamp(34 * area, 12, 56));
    for (let i = 0; i < far; i++) {
      snowFar.push({
        x: Math.random() * view.w,
        y: Math.random() * view.h,
        r: 0.6 + Math.random() * 1.5,
        vy: 3 + Math.random() * 8,
        vx: -3 + Math.random() * 6,
        a: 0.1 + Math.random() * 0.24,
        phase: Math.random() * TAU,
      });
    }
    for (let i = 0; i < near; i++) {
      snowNear.push({
        x: Math.random() * view.w,
        y: Math.random() * view.h,
        r: 1.6 + Math.random() * 3.4,
        vy: 9 + Math.random() * 16,
        vx: -7 + Math.random() * 14,
        a: 0.06 + Math.random() * 0.14,
        phase: Math.random() * TAU,
      });
    }
  }

  function resize(w: number, h: number, dpr: number, insets: Insets): void {
    const safe = safeRect(w, h, insets);
    view.w = w;
    view.h = h;
    view.dpr = dpr;
    view.insets = insets;
    view.safe = safe;
    // The board takes every pixel that is not the cutout and not the host's own
    // two buttons. `arena.ts` solves the frame — the rim's ink is reserved in
    // pixels and nothing else is held back — and the shape it returns is handed
    // to the simulation by `mount.ts`, so the wall that is drawn and the wall a
    // child dies against are one measurement.
    const band = topChromeBand(w, safe.y, safe.h, insets);
    const frame = arenaFrame(safe.w, safe.h, band);
    view.chromeBand = band;
    view.aspect = frame.aspect;
    view.cx = safe.x + frame.cx;
    view.cy = safe.y + frame.cy;
    view.scale = frame.scale;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    buildBackground();
    seedSnow();
  }

  function stepSnow(list: Snow[], dt: number, drift: number): void {
    for (const s of list) {
      s.y += s.vy * dt;
      s.x += (s.vx + Math.sin(s.phase + s.y * 0.01) * drift) * dt;
      if (s.y > view.h + 6) {
        s.y = -6;
        s.x = Math.random() * view.w;
      }
      if (s.x < -8) s.x = view.w + 8;
      if (s.x > view.w + 8) s.x = -8;
    }
  }

  function drawSnow(list: Snow[], boost: number): void {
    g.globalCompositeOperation = "lighter";
    for (const s of list) {
      const d = sp.mote[4];
      if (!d) continue;
      const size = s.r * 4 * (1 + boost);
      g.globalAlpha = s.a * (1 + boost * 0.6);
      g.drawImage(d, s.x - size / 2, s.y - size / 2, size, size);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  function draw(w: World, stickAlpha: number): void {
    const dt = lastTime === 0 ? 0.016 : clamp(w.cam.t - lastTime, 0, 0.05);
    lastTime = w.cam.t;

    const cam = w.cam;
    const S = view.scale * cam.zoom;
    // The board is fitted flush to the safe box, so the shake that translates it
    // is bounded rather than free — see SHAKE_HEADROOM. Everything survivable is
    // already under the bound; only the death slam is trimmed, and it keeps its
    // hitstop, its slow-motion, its flash and its debris.
    const ox = view.cx + clamp(cam.shakeX, -SHAKE_HEADROOM, SHAKE_HEADROOM) * view.scale;
    const oy = view.cy + clamp(cam.shakeY, -SHAKE_HEADROOM, SHAKE_HEADROOM) * view.scale;
    const X = (x: number): number => ox + x * S;
    const Y = (y: number): number => oy + y * S;

    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    if (bg) g.drawImage(bg, 0, 0, view.w, view.h);

    // --- shafts of light -------------------------------------------------
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 4; i++) {
      const t = w.cam.t * 0.05 + i * 2.1;
      const x = view.w * (0.18 + 0.23 * i) + Math.sin(t) * view.w * 0.06;
      const rot = Math.sin(t * 0.7) * 0.09 + 0.1;
      const hh = view.h * 1.35;
      const ww = view.w * (0.34 + 0.08 * Math.sin(t * 1.3));
      g.save();
      g.translate(x, -view.h * 0.16);
      g.rotate(rot);
      g.globalAlpha = 0.2 + 0.08 * Math.sin(t * 0.9);
      g.drawImage(sp.ray, -ww / 2, 0, ww, hh);
      g.restore();
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";

    const boostGlow = w.serpent.boostBlend;
    if (!w.reduced) {
      stepSnow(snowFar, dt, 4);
      stepSnow(snowNear, dt, 9);
    }
    drawSnow(snowFar, 0);

    // --- the arena floor --------------------------------------------------
    const board = arenaBoard(w.arenaR, { x: w.aspectX, y: w.aspectY });
    const aX = board.a * S;
    const aY = board.b * S;
    const aR = board.r * S;
    g.save();
    rimPath(X(0), Y(0), aX, aY, aR);
    g.clip();

    // A flat wash first, so the board is lit floor all the way into its corners.
    // A radial gradient alone is a round pool of light, and a rectangular board
    // lit by one has four dark corners — which is most of what the founder was
    // reading as "not the whole screen".
    g.fillStyle = "rgba(9,46,72,0.42)";
    g.fillRect(X(0) - aX, Y(0) - aY, aX * 2, aY * 2);

    const lit = Math.min(aX, aY) * 1.25;
    const floor = g.createRadialGradient(X(0), Y(0), 0, X(0), Y(0), lit);
    floor.addColorStop(0, "rgba(34,124,150,0.52)");
    floor.addColorStop(0.5, "rgba(14,72,104,0.3)");
    floor.addColorStop(1, "rgba(6,36,62,0)");
    g.fillStyle = floor;
    g.fillRect(X(0) - aX, Y(0) - aY, aX * 2, aY * 2);

    // The vent itself: a slow amber heart. Teal water against a warm centre is
    // the only complementary pair in the palette, and without it the whole
    // screen is one hue and reads flat however bright you make it.
    const ventGlow = sp.glow[0];
    if (ventGlow) {
      const k = 1.15 + 0.05 * Math.sin(w.cam.t * 0.55);
      const vw = Math.min(aX, aY) * k * 1.4;
      const vh = vw;
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = 0.13 + 0.03 * Math.sin(w.cam.t * 0.8) + w.depthPulse * 0.16;
      g.drawImage(ventGlow, X(0) - vw / 2, Y(0) - vh / 2, vw, vh);
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
    }

    // --- the condition, written on the water ------------------------------
    //
    // Measured, broken and floored — see `prompt.ts`. The fit is handed
    // `w.arenaR` and `view.scale` and deliberately NOT `cam.zoom`: the budget
    // carries the spring's undershoot as a margin, because a fit recomputed on a
    // spring is a fit that jitters.
    if (w.prompt !== shownPrompt) {
      outgoingBlock = promptBlock;
      shownPrompt = w.prompt;
      promptT = 0;
    }
    promptT = Math.min(1, promptT + dt * 1.9);
    const block = fittedPrompt(shownPrompt, w.arenaR);
    // Additive, so the condition is *light in the water* — it can never read as
    // a dark smudge whatever is behind it, and the serpent swims through it.
    g.globalCompositeOperation = "lighter";
    const pop = promptDrawScale(promptT, w.cam.t);
    if (outgoingBlock && promptT < 1) {
      const k = easeOutCubic(promptT);
      drawPromptBlock(outgoingBlock, X(0), Y(0), (1 + k * 0.55) * pop.breathe, (1 - k) * 0.2);
    }
    const inA = Math.min(1, promptT * 2.2);
    drawPromptBlock(block, X(0), Y(0), pop.halo, 0.1 * inA);
    drawPromptBlock(block, X(0), Y(0), pop.core, 0.26 * inA);
    g.globalCompositeOperation = "source-over";
    g.restore();

    // --- shockwaves -------------------------------------------------------
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < w.rings.count; i++) {
      const life = (w.rings.life[i] as number) / (w.rings.maxLife[i] as number);
      const k = easeOutExpo(1 - life);
      const r = ((w.rings.from[i] as number) + ((w.rings.to[i] as number) - (w.rings.from[i] as number)) * k) * S;
      const img = sp.softRing[w.rings.color[i] as number];
      if (!img || r <= 0) continue;
      const size = r * 2 * 1.28;
      g.globalAlpha = life * life * 0.9;
      g.drawImage(img, X(w.rings.x[i] as number) - size / 2, Y(w.rings.y[i] as number) - size / 2, size, size);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";

    // --- orbs -------------------------------------------------------------
    const orbLabelSize = Math.max(11, view.scale * 0.082);
    const orbStyle: LabelStyle = { ...ORB_LABEL, size: orbLabelSize };
    for (const o of w.orbs) {
      const r = orbDrawRadius(o) * S;
      if (r <= 0.4) continue;
      const px = X(o.x);
      const py = Y(o.y);
      const bob = Math.sin(o.phase * 1.6) * r * 0.08;

      g.globalCompositeOperation = "lighter";
      const glow = sp.glow[o.hunter ? 5 : 4];
      if (glow) {
        const gs = r * 4.4;
        g.globalAlpha = 0.34 + 0.12 * Math.sin(o.phase * 2.1);
        g.drawImage(glow, px - gs / 2, py + bob - gs / 2, gs, gs);
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";

      g.save();
      g.translate(px, py + bob);
      g.rotate(Math.sin(o.phase * 0.9) * 0.14 + (o.hunter ? o.phase * 0.6 : 0));
      const bs = r * 3.3;
      g.drawImage(o.hunter ? sp.hunter : sp.bell, -bs / 2, -bs / 2, bs, bs);
      g.restore();

      // The numeral has to live *inside* the bell, so it is fitted to it. An
      // expression loses its spaces on the way to the screen — `7+5` reads as
      // fast as `7 + 5` and takes 30% less width on a 40px creature.
      const shown = o.label.replace(/ /g, "");
      const fit = Math.min(1, (r * 1.72) / labelWidth(shown, orbStyle, view.dpr));
      drawLabel(g, shown, orbStyle, px, py + bob, view.dpr, o.scale * cam.zoom * fit, Math.min(1, o.scale * 1.4));
    }

    // --- the serpent ------------------------------------------------------
    drawSerpent(w, X, Y, S);

    // --- particles --------------------------------------------------------
    const p = w.particles;
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < p.count; i++) {
      const life = (p.life[i] as number) / (p.maxLife[i] as number);
      const kind = p.kind[i] as number;
      const col = p.color[i] as number;
      const img = kind === PK_SHARD ? sp.shard[col] : kind === PK_BUBBLE ? sp.bubble : sp.mote[col];
      if (!img) continue;
      const grow = kind === PK_MOTE ? 1 + (1 - life) * 1.4 : 1;
      const size = (p.size[i] as number) * S * (kind === PK_SHARD ? 5 : 4.2) * grow;
      g.globalAlpha = kind === PK_MOTE ? life * life * 0.85 : Math.min(1, life * 1.6);
      const px = X(p.x[i] as number);
      const py = Y(p.y[i] as number);
      if (kind === PK_SHARD) {
        g.save();
        g.translate(px, py);
        g.rotate(p.rot[i] as number);
        g.drawImage(img, -size / 2, (-size / 2) * 0.35, size, size * 0.35);
        g.restore();
      } else {
        g.drawImage(img, px - size / 2, py - size / 2, size, size);
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";

    // --- the vent rim -----------------------------------------------------
    drawRim(w, X, Y, S, aX, aY, aR);

    // --- floating score ---------------------------------------------------
    const floatStyle: LabelStyle = {
      size: Math.max(13, view.scale * 0.075),
      fill: "#ffffff",
      outline: "rgba(2,12,20,0.85)",
      outlineWidth: 3,
      weight: 800,
      tracking: 0,
    };
    for (const f of w.floaters) {
      const k = 1 - f.life / f.maxLife;
      const style2: LabelStyle = {
        ...floatStyle,
        fill: f.tone === 0 ? COLORS.good : f.tone === 1 ? COLORS.bad : COLORS.ink,
      };
      drawLabel(g, f.text, style2, X(f.x), Y(f.y), view.dpr, 0.8 + easeOutCubic(k) * 0.5, 1 - k * k);
    }

    drawSnow(snowNear, boostGlow * 0.8);
    void stickAlpha;

    if (cam.flashAlpha > 0.004) {
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = cam.flashAlpha;
      g.fillStyle = cam.flashColor;
      g.fillRect(0, 0, view.w, view.h);
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
    }
  }

  function drawSerpent(w: World, X: (x: number) => number, Y: (y: number) => number, S: number): void {
    const s = w.serpent;
    const n = s.bodyCount;
    if (n < 2) return;
    const fade = w.phase === "dead" ? clamp(1 - w.deathT * 1.6, 0, 1) : 1;
    if (fade <= 0.01) return;

    // Per-point normals, computed once and reused by every pass.
    //
    // The body is also displaced sideways by a travelling sine — an eel swims,
    // it does not slide along a rail, and following the recorded path exactly
    // is what made this read as a dropped ribbon. The amplitude grows toward
    // the tail (the head leads, the tail whips) and speeds up when boosting.
    // Purely cosmetic: collision still uses the true path, so what you can hit
    // is never what you can see wobbling.
    const swimAmp = TUNE.bodyRadius * (w.reduced ? 0.12 : 0.42);
    const swimPhase = w.cam.t * (5.4 + s.boostBlend * 4.5);
    for (let i = 0; i < n; i++) {
      const a = i === 0 ? 0 : i - 1;
      const b = i === n - 1 ? n - 1 : i + 1;
      const dx = (s.bodyX[b] as number) - (s.bodyX[a] as number);
      const dy = (s.bodyY[b] as number) - (s.bodyY[a] as number);
      const d = Math.hypot(dx, dy) || 1;
      nx[i] = -dy / d;
      ny[i] = dx / d;
      const grow = Math.min(1, i / 12);
      swim[i] = Math.sin(i * 0.34 - swimPhase) * swimAmp * grow;
      bx[i] = (s.bodyX[i] as number) + (nx[i] as number) * (swim[i] as number);
      by[i] = (s.bodyY[i] as number) + (ny[i] as number) * (swim[i] as number);
    }

    const outline = (k: number): void => {
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const r = (s.bodyR[i] as number) * k;
        const px = X((bx[i] as number) + (nx[i] as number) * r);
        const py = Y((by[i] as number) + (ny[i] as number) * r);
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      // A round cap so the tail is a stub, not a knife edge.
      const tr = (s.bodyR[n - 1] as number) * k * S;
      g.arc(
        X(bx[n - 1] as number),
        Y(by[n - 1] as number),
        tr,
        Math.atan2(ny[n - 1] as number, nx[n - 1] as number),
        Math.atan2(-(ny[n - 1] as number), -(nx[n - 1] as number)),
        true,
      );
      for (let i = n - 1; i >= 0; i--) {
        const r = (s.bodyR[i] as number) * k;
        g.lineTo(X((bx[i] as number) - (nx[i] as number) * r), Y((by[i] as number) - (ny[i] as number) * r));
      }
      g.closePath();
    };

    // Bloom under the body — tight, or it stacks into a nebula.
    g.globalCompositeOperation = "lighter";
    const glow = sp.glow[2];
    if (glow) {
      const step = n > 110 ? 4 : 3;
      for (let i = 0; i < n; i += step) {
        const size = (s.bodyR[i] as number) * S * 4.6;
        g.globalAlpha = 0.1 * fade * (1 + s.boostBlend * 0.9);
        g.drawImage(glow, X(bx[i] as number) - size / 2, Y(by[i] as number) - size / 2, size, size);
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";

    g.globalAlpha = fade;
    outline(1);
    g.fillStyle = "#02181f";
    g.fill();

    outline(0.82);
    g.fillStyle = "#0b5f7a";
    g.fill();

    outline(0.56);
    g.fillStyle = "#159fc0";
    g.fill();

    // A narrow brilliant filament, not a wash — the light is *inside* the animal.
    g.globalCompositeOperation = "lighter";
    outline(0.24);
    g.fillStyle = `rgba(126,255,236,${0.85 + s.boostBlend * 0.15})`;
    g.fill();
    g.globalCompositeOperation = "source-over";

    // Counting bands: every fifth segment is marked, so the body is a number
    // line you can read at a glance.
    g.globalCompositeOperation = "lighter";
    for (let i = 5; i < n; i += 5) {
      const r = (s.bodyR[i] as number) * S;
      const px = X(bx[i] as number);
      const py = Y(by[i] as number);
      const big = i % 25 === 0;
      const back = i + 2 < n ? i + 2 : i;
      const ax = X(bx[back] as number) - px;
      const ay = Y(by[back] as number) - py;
      const al = Math.hypot(ax, ay) || 1;
      g.globalAlpha = (big ? 0.55 : 0.3) * fade;
      g.strokeStyle = big ? "#ffffff" : COLORS.lantern;
      g.lineWidth = Math.max(1, r * (big ? 0.4 : 0.24));
      g.lineJoin = "round";
      g.beginPath();
      g.moveTo(px + (nx[i] as number) * r * 0.72, py + (ny[i] as number) * r * 0.72);
      g.lineTo(px + (ax / al) * r * 0.5, py + (ay / al) * r * 0.5);
      g.lineTo(px - (nx[i] as number) * r * 0.72, py - (ny[i] as number) * r * 0.72);
      g.stroke();
    }

    // A wrong bite travels down the body as a violet swelling.
    for (let i = 0; i < n; i += 2) {
      const tint = bolusTintAt(s, i);
      if (tint < 0.05) continue;
      const size = (s.bodyR[i] as number) * S * 5;
      const img = sp.glow[1];
      if (!img) continue;
      g.globalAlpha = tint * 0.55 * fade;
      g.drawImage(img, X(bx[i] as number) - size / 2, Y(by[i] as number) - size / 2, size, size);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";

    // --- head
    const hx = X(s.x);
    const hy = Y(s.y);
    const hr = TUNE.headRadius * S;
    const stretch = 1 + s.boostBlend * 0.24;
    const squash = 1 - s.boostBlend * 0.12;

    g.save();
    g.translate(hx, hy);
    g.rotate(s.heading);
    g.globalAlpha = fade;

    // lantern stalk
    g.strokeStyle = "#0d7590";
    g.lineWidth = Math.max(1.4, hr * 0.22);
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(-hr * 0.1, -hr * 0.5);
    g.quadraticCurveTo(hr * 1.1, -hr * 1.7, hr * 2.1, -hr * 0.75);
    g.stroke();

    g.fillStyle = "#05303f";
    g.beginPath();
    g.ellipse(0, 0, hr * 1.34 * stretch, hr * 1.02 * squash, 0, 0, TAU);
    g.fill();
    g.fillStyle = "#0f8aa6";
    g.beginPath();
    g.ellipse(hr * 0.06, 0, hr * 1.1 * stretch, hr * 0.78 * squash, 0, 0, TAU);
    g.fill();

    // jaw — opens on the frame a bite lands
    const fresh = freshBolus(w);
    if (fresh > 0.02) {
      g.fillStyle = "rgba(2,12,20,0.85)";
      g.beginPath();
      g.moveTo(hr * 0.35, 0);
      g.arc(hr * 0.35, 0, hr * 1.05, -0.5 * fresh, 0.5 * fresh);
      g.closePath();
      g.fill();
    }

    g.globalCompositeOperation = "lighter";
    g.fillStyle = COLORS.serpentCore;
    for (const side of [-1, 1]) {
      g.beginPath();
      g.ellipse(hr * 0.42, side * hr * 0.42, hr * 0.2, hr * 0.16, 0, 0, TAU);
      g.fill();
    }
    const lantern = sp.glow[4];
    if (lantern) {
      const ls = hr * (7 + Math.sin(w.cam.t * 2.3) * 0.5);
      g.globalAlpha = 0.5 * fade;
      g.drawImage(lantern, hr * 2.1 - ls / 2, -hr * 0.75 - ls / 2, ls, ls);
      g.globalAlpha = fade;
    }
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(hr * 2.1, -hr * 0.75, hr * 0.3, 0, TAU);
    g.fill();
    g.globalCompositeOperation = "source-over";
    g.restore();

    // --- shield
    if (s.shield || w.shieldPulse > 0.02) {
      const alpha = s.shield ? 0.5 + 0.2 * Math.sin(w.cam.t * 3.4) : w.shieldPulse;
      g.globalCompositeOperation = "lighter";
      g.strokeStyle = COLORS.lantern;
      g.globalAlpha = alpha * fade;
      g.lineWidth = Math.max(1.2, hr * 0.14);
      g.beginPath();
      g.arc(hx, hy, hr * 2.3, 0, TAU);
      g.stroke();
      const spark = sp.mote[4];
      if (spark && s.shield) {
        for (let i = 0; i < 3; i++) {
          const a = s.shieldSpin + (i / 3) * TAU;
          const size = hr * 1.5;
          g.globalAlpha = fade * 0.9;
          g.drawImage(
            spark,
            hx + Math.cos(a) * hr * 2.3 - size / 2,
            hy + Math.sin(a) * hr * 2.3 - size / 2,
            size,
            size,
          );
        }
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
    }
    g.globalAlpha = 1;
  }

  function freshBolus(w: World): number {
    const s = w.serpent;
    let best = 0;
    for (let b = 0; b < s.bolusCount; b++) {
      const v = 1 - clamp((s.bolusS[b] as number) / 0.09, 0, 1);
      if (v > best) best = v;
    }
    return best;
  }

  /**
   * The rim, as a path: four straight runs and four quarter-circles.
   *
   * Built with `arcTo` rather than `roundRect` — the shipping surface is a
   * WKWebView whose version is the OS's, not the app's, and a board that vanishes
   * on an older iPad because a path method was missing is not a trade worth
   * making for four fewer lines.
   */
  function rimPath(cx: number, cy: number, aX: number, aY: number, r: number): void {
    const l = cx - aX;
    const rt = cx + aX;
    const t = cy - aY;
    const b = cy + aY;
    const k = Math.max(0, Math.min(r, Math.min(aX, aY)));
    g.beginPath();
    g.moveTo(l + k, t);
    g.lineTo(rt - k, t);
    g.arcTo(rt, t, rt, t + k, k);
    g.lineTo(rt, b - k);
    g.arcTo(rt, b, rt - k, b, k);
    g.lineTo(l + k, b);
    g.arcTo(l, b, l, b - k, k);
    g.lineTo(l, t + k);
    g.arcTo(l, t, l + k, t, k);
    g.closePath();
  }

  function drawRim(
    w: World,
    X: (x: number) => number,
    Y: (y: number) => number,
    S: number,
    aX: number,
    aY: number,
    aR: number,
  ): void {
    const cx = X(0);
    const cy = Y(0);
    const board: Board = arenaBoard(w.arenaR, { x: w.aspectX, y: w.aspectY });

    g.globalCompositeOperation = "lighter";
    const halo = sp.softRing[w.grazeGlow > 0.4 ? 5 : 2];
    if (halo) {
      const hw = aX * 2 * 1.16;
      const hh = aY * 2 * 1.16;
      g.globalAlpha = 0.4 + w.grazeGlow * 0.4 + w.depthPulse * 0.3;
      g.drawImage(halo, cx - hw / 2, cy - hh / 2, hw, hh);
    }

    // One sample every ~22 device-independent pixels of rim, so a corner is smooth
    // on a tablet and the count does not run away on one. Sampled by ARC LENGTH:
    // an angular walk would bunch the samples into the corners and make the graze
    // glow crawl as the serpent rounded one.
    const perimeterPx = rimPerimeter(board) * S;
    const segs = Math.max(72, Math.min(RIM_SAMPLES, Math.round(perimeterPx / 22)));
    sampleRim(board, segs, rimX, rimY, rimNX, rimNY);

    // The hot patch follows the serpent along the WALL, by distance to the head's
    // own point on the rim. There is no angle on a rounded rect to compare against,
    // and this is the thing the angle was standing in for anyway.
    const hot = rimEdge(board, w.serpent.x, w.serpent.y);
    const span = w.arenaR * 0.55;

    g.lineCap = "butt";
    for (let i = 0; i < segs; i++) {
      const j = (i + 1) % segs;
      const mx = ((rimX[i] as number) + (rimX[j] as number)) / 2;
      const my = ((rimY[i] as number) + (rimY[j] as number)) / 2;
      const heat = w.grazeGlow * clamp(1 - Math.hypot(mx - hot.x, my - hot.y) / span, 0, 1);
      const pulse = 0.72 + 0.16 * Math.sin(w.cam.t * 1.7 + i * 0.4) + w.depthPulse * 0.4;
      g.globalAlpha = clamp(pulse * (0.7 + heat), 0, 1);
      g.strokeStyle = heat > 0.05 ? COLORS.rimHot : COLORS.rim;
      g.lineWidth = Math.max(2.5, S * (0.014 + heat * 0.016));
      g.beginPath();
      g.moveTo(X(rimX[i] as number), Y(rimY[i] as number));
      g.lineTo(X(rimX[j] as number), Y(rimY[j] as number));
      g.stroke();
    }

    // A thin white-hot lip just inside, so the edge is a hard line the eye can
    // trust rather than a soft glow you can misjudge at speed. One path for the
    // whole rim: a hairline has nowhere to put a shimmer, and this is the pass
    // that has to read as a LINE against a screen edge.
    const inset = S * 0.011;
    g.globalAlpha = clamp(0.6 + w.depthPulse * 0.3, 0, 1);
    g.strokeStyle = "#d6fbff";
    g.lineWidth = Math.max(1, S * 0.005);
    rimPath(cx, cy, Math.max(1, aX - inset), Math.max(1, aY - inset), Math.max(0, aR - inset));
    g.stroke();

    // Polyps: a living edge rather than a drawn line. They ride POLYP_OUT outside
    // the rim, which is the outward ink `arena.ts` reserves room for.
    const polyps = Math.min(56, Math.max(28, Math.round(segs / 3)));
    const dot = sp.mote[4];
    if (dot) {
      for (let i = 0; i < polyps; i++) {
        const k = Math.floor((i / polyps) * segs);
        const wob = POLYP_OUT * w.arenaR * (0.5 + 0.5 * Math.sin(w.cam.t * 1.3 + i));
        const size = S * 0.016 * (1 + 0.4 * Math.sin(w.cam.t * 2 + i * 1.7));
        const px = X((rimX[k] as number) + (rimNX[k] as number) * wob);
        const py = Y((rimY[k] as number) + (rimNY[k] as number) * wob);
        g.globalAlpha = 0.5;
        g.drawImage(dot, px - size / 2, py - size / 2, size, size);
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  function toWorld(clientX: number, clientY: number, rect: DOMRect): { x: number; y: number } {
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return { x: (sx - view.cx) / view.scale, y: (sy - view.cy) / view.scale };
  }

  return { view, resize, draw, toWorld };
}

export const spriteSizes = { GLOW_PX, MOTE_PX };
