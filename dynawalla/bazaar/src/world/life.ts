/**
 * The crowd, the cats, the pigeons, the porters and the smoke.
 *
 * If you finish with effort left, spend all of it here. A bazaar with no people
 * in it is an architectural rendering, and an architectural rendering is
 * exactly the "beautifully made instrument" failure. Warmth is the product.
 *
 * BZ-LAW-12 — nothing that responds to idle touch may grant anything. The cat
 * wakes, the pigeons flush, the dust scatters, the water rings. No progress, no
 * currency, no points, no tone, no "+1". A world that responds without
 * rewarding is what makes it feel real; a world that rewards fiddling is a slot
 * machine, and this is a children's product.
 *
 * BZ-LAW-9 — this layer is `pointer-events: none`, always. A cat that blocks a
 * stall is the single most infuriating bug this design can produce.
 */

import { frand, mix as mixSeed, idle, clamp, lerp } from "../util/rng.ts";
import { alpha, over } from "../util/color.ts";
import { MATERIALS } from "../tokens/palette.ts";
import type { Semantic } from "../tokens/palette.ts";
import type { Ambient } from "./daylight.ts";

const ROBES = [
  MATERIALS["bone-100"],
  MATERIALS["indigo-800"],
  MATERIALS["madder-600"],
  MATERIALS["sabz-700"],
  MATERIALS["ochre-500"],
  MATERIALS["aubergine-800"],
  MATERIALS["sandstone-200"],
  MATERIALS["turquoise-700"],
];

export interface LifeCtx {
  sem: Semantic;
  am: Ambient;
  /** Aerial perspective depth for this lane, 0…6. */
  depth: number;
  reduced: boolean;
}

interface Walker {
  x: number;
  v: number;
  lane: number;
  scale: number;
  robe: number;
  phase: number;
  load: boolean;
}

/**
 * A pool of figures walking the street. Bounded, recycled, and never allocated
 * inside a frame.
 */
export class Crowd {
  private pool: Walker[] = [];
  private seeded = false;

  private count: number;

  constructor(count: number) {
    this.count = count;
  }

  setCount(n: number): void {
    if (n === this.count) return;
    this.count = n;
    this.seeded = false;
  }

  private spawn(centre: number, span: number): void {
    this.pool = [];
    for (let i = 0; i < this.count; i++) {
      const s = mixSeed(i, 0x51fa);
      this.pool.push({
        x: centre - span / 2 + frand(s) * span,
        v: (frand(mixSeed(s, 1)) < 0.5 ? -1 : 1) * (14 + frand(mixSeed(s, 2)) * 26),
        lane: frand(mixSeed(s, 3)) < 0.62 ? 0 : 1,
        scale: 0.82 + frand(mixSeed(s, 4)) * 0.4,
        robe: Math.floor(frand(mixSeed(s, 5)) * ROBES.length),
        phase: frand(mixSeed(s, 6)) * 100,
        load: frand(mixSeed(s, 7)) < 0.22,
      });
    }
    this.seeded = true;
  }

  /** `centre` and `span` are in world space; walkers recycle across the span. */
  update(dt: number, centre: number, span: number): void {
    if (!this.seeded) this.spawn(centre, span);
    const lo = centre - span / 2;
    const hi = centre + span / 2;
    for (const w of this.pool) {
      w.x += w.v * dt;
      if (w.x < lo) w.x = hi;
      else if (w.x > hi) w.x = lo;
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    project: (worldX: number) => number,
    viewW: number,
    baseY: number,
    unit: number,
    c: LifeCtx,
    t: number,
  ): void {
    if (!this.seeded) return;
    const haze = (c.am.hazeAlpha * c.depth) / 6;
    for (const w of this.pool) {
      const x = project(w.x);
      if (x < -80 || x > viewW + 80) continue;
      const y = baseY + (1 - w.lane) * unit * 0.14;
      const s = unit * w.scale * (w.lane ? 1 : 0.88);
      drawFigure(ctx, x, y, s, ROBES[w.robe]!, w.phase, t, c, haze, w.load, w.v < 0);
    }
  }
}

/**
 * A figure: a robe, a head, a suggestion of arms, and a walk. No face — the
 * bazaar's people are silhouettes at this distance, which is truthful about
 * how far away they are and sidesteps the uncanny-mascot failure entirely.
 */
function drawFigure(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  robe: string,
  phase: number,
  t: number,
  c: LifeCtx,
  haze: number,
  load: boolean,
  facingLeft: boolean,
): void {
  const bob = c.reduced ? 0 : Math.sin(t * 4.4 + phase) * h * 0.012;
  const sway = c.reduced ? 0 : Math.sin(t * 2.2 + phase) * 0.06;
  const body = over(over(robe, c.sem.shadow, c.am.shadowAlpha * 0.5), c.sem.haze, haze);
  const litSide = over(body, c.am.sunColor, c.am.sunAlpha * 0.5);
  const w = h * 0.3;
  const top = y - h + bob;

  ctx.save();
  ctx.translate(x, 0);
  ctx.rotate(sway * 0.06);

  // Robe: wider at the hem, because cloth falls.
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-w * 0.34, top + h * 0.22);
  ctx.quadraticCurveTo(-w * 0.62, top + h * 0.7, -w * 0.7, y + bob);
  ctx.lineTo(w * 0.7, y + bob);
  ctx.quadraticCurveTo(w * 0.62, top + h * 0.7, w * 0.34, top + h * 0.22);
  ctx.closePath();
  ctx.fill();

  // The sun side of the robe.
  ctx.fillStyle = litSide;
  ctx.beginPath();
  ctx.moveTo(-w * 0.34, top + h * 0.22);
  ctx.quadraticCurveTo(-w * 0.62, top + h * 0.7, -w * 0.7, y + bob);
  ctx.lineTo(-w * 0.24, y + bob);
  ctx.quadraticCurveTo(-w * 0.16, top + h * 0.6, -w * 0.1, top + h * 0.22);
  ctx.closePath();
  ctx.fill();

  // Head and headcloth.
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, top + h * 0.13, h * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = over(body, c.sem.litEdge, 0.25);
  ctx.beginPath();
  ctx.ellipse(0, top + h * 0.08, h * 0.12, h * 0.055, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  // A load on the head or shoulder: this is a market, people are carrying.
  if (load) {
    ctx.fillStyle = over(MATERIALS["mudbrick-500"], c.sem.haze, haze);
    ctx.fillRect(-h * 0.15, top - h * 0.06, h * 0.3, h * 0.09);
    ctx.fillStyle = over(MATERIALS["brass-600"], c.sem.haze, haze);
    ctx.fillRect(-h * 0.15, top - h * 0.06, h * 0.3, 1.5);
  }

  // A walking stick or a swinging hand, so the silhouette is not symmetrical.
  ctx.strokeStyle = body;
  ctx.lineWidth = Math.max(1, h * 0.035);
  ctx.beginPath();
  const armSwing = c.reduced ? 0 : Math.sin(t * 4.4 + phase) * h * 0.06;
  const dir = facingLeft ? -1 : 1;
  ctx.moveTo(dir * w * 0.3, top + h * 0.28);
  ctx.lineTo(dir * w * 0.42 + armSwing, top + h * 0.56);
  ctx.stroke();
  ctx.restore();
}

/** A cat. It sleeps; it wakes if you touch near it; it never follows you. */
export function drawCat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  awake: number,
  c: LifeCtx,
  t: number,
  seed: number,
): void {
  const body = over(MATERIALS["copper-400"], c.sem.shadow, c.am.shadowAlpha * 0.6);
  const stretch = clamp(awake, 0, 1);
  const s = size;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = body;
  // Curled asleep; stretching when woken. One shape, two poses.
  const bodyH = lerp(s * 0.42, s * 0.34, stretch);
  const bodyW = lerp(s * 0.9, s * 1.25, stretch);
  ctx.beginPath();
  ctx.ellipse(0, -bodyH * 0.5, bodyW / 2, bodyH / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head.
  const hx = lerp(-bodyW * 0.3, -bodyW * 0.46, stretch);
  ctx.beginPath();
  ctx.arc(hx, -bodyH * (0.62 + stretch * 0.5), s * 0.17, 0, Math.PI * 2);
  ctx.fill();
  // Ears.
  ctx.beginPath();
  ctx.moveTo(hx - s * 0.14, -bodyH * (0.62 + stretch * 0.5) - s * 0.1);
  ctx.lineTo(hx - s * 0.06, -bodyH * (0.62 + stretch * 0.5) - s * 0.27);
  ctx.lineTo(hx + s * 0.02, -bodyH * (0.62 + stretch * 0.5) - s * 0.1);
  ctx.closePath();
  ctx.fill();
  // Tail, which is the only part that moves when it is asleep.
  const flick = c.reduced ? 0 : idle(t, seed, 1) * (0.2 + stretch * 0.8);
  ctx.strokeStyle = body;
  ctx.lineWidth = Math.max(1.5, s * 0.09);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(bodyW * 0.42, -bodyH * 0.5);
  ctx.quadraticCurveTo(
    bodyW * 0.75,
    -bodyH * (0.5 + flick * 0.5),
    bodyW * 0.6,
    -bodyH * (1.1 + flick),
  );
  ctx.stroke();
  ctx.restore();
}

/** Two pigeons, at most. They flush when the street moves fast past them. */
export function drawPigeon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  flying: number,
  c: LifeCtx,
  t: number,
  seed: number,
): void {
  const body = over(MATERIALS["sandstone-400"], c.sem.shadow, c.am.shadowAlpha * 0.8);
  ctx.save();
  ctx.translate(x, y - flying * size * 5);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.55, size * 0.36, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-size * 0.45, -size * 0.3, size * 0.22, 0, Math.PI * 2);
  ctx.fill();
  if (flying > 0.01 && !c.reduced) {
    const flap = Math.sin(t * 18 + seed) * size * 0.7;
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.1);
    ctx.lineTo(size * 0.2, -size * 0.1 - flap);
    ctx.lineTo(-size * 0.3, -size * 0.1 - flap * 0.7);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** A porter's cart crossing the foreground. */
export function drawPorter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  c: LifeCtx,
  t: number,
): void {
  const wood = over(MATERIALS["bronze-700"], c.sem.shadow, c.am.shadowAlpha * 0.4);
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = wood;
  ctx.fillRect(-h * 0.7, -h * 0.5, h * 1.4, h * 0.16);
  // Sacks piled on it — real goods, not crates with an X on them.
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = over(
      [MATERIALS["bone-100"], MATERIALS["sandstone-200"], MATERIALS["mudbrick-500"]][i]!,
      c.sem.shadow,
      c.am.shadowAlpha * 0.5,
    );
    ctx.beginPath();
    ctx.ellipse(-h * 0.4 + i * h * 0.4, -h * 0.66, h * 0.22, h * 0.19, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Wheels, and they actually turn with the travel.
  ctx.fillStyle = wood;
  for (const wx of [-h * 0.44, h * 0.44]) {
    ctx.beginPath();
    ctx.arc(wx, -h * 0.18, h * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = c.sem.metalShade;
    ctx.lineWidth = 1.5;
    const a = c.reduced ? 0 : t * 3;
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const ang = a + (k * Math.PI) / 2;
      ctx.moveTo(wx, -h * 0.18);
      ctx.lineTo(wx + Math.cos(ang) * h * 0.17, -h * 0.18 + Math.sin(ang) * h * 0.17);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Steam from a samovar: five circles, an envelope, and no particle system. */
export function drawSteam(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  seed: number,
  c: LifeCtx,
  t: number,
): void {
  ctx.save();
  for (let i = 0; i < 5; i++) {
    const s = mixSeed(seed, i);
    const period = 2.6;
    const u = ((t + frand(s) * period) % period) / period;
    const r = 4 + u * 18;
    const a = 0.35 * (1 - u);
    if (a <= 0.01) continue;
    ctx.globalAlpha = a;
    ctx.fillStyle = c.am.night > 0.5 ? c.sem.groundLit : c.sem.litEdge;
    ctx.beginPath();
    ctx.arc(x + (frand(mixSeed(s, 1)) - 0.5) * 12, y - u * 46, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * A carpet drifting across. This is the loading state for a game, and the
 * fast-travel affordance between wards. It is not decoration.
 */
export function drawCarpet(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  c: LifeCtx,
  t: number,
  seed: number,
): void {
  const h = w * 0.14;
  const wave = c.reduced ? 0 : 1;
  ctx.save();
  ctx.translate(x, y);
  const stripes = 7;
  for (let i = 0; i < stripes; i++) {
    const f = i / stripes;
    const col = [
      MATERIALS["madder-600"],
      MATERIALS["indigo-800"],
      MATERIALS["saffron-400"],
      MATERIALS["sabz-700"],
    ][i % 4]!;
    ctx.fillStyle = over(col, c.sem.shadow, c.am.shadowAlpha * 0.35);
    ctx.beginPath();
    for (let k = 0; k <= 10; k++) {
      const kx = -w / 2 + (w * k) / 10;
      const ky = Math.sin(k * 0.8 + t * 2.2 + seed) * h * 0.42 * wave;
      if (k === 0) ctx.moveTo(kx, ky + f * h);
      else ctx.lineTo(kx, ky + f * h);
    }
    for (let k = 10; k >= 0; k--) {
      const kx = -w / 2 + (w * k) / 10;
      const ky = Math.sin(k * 0.8 + t * 2.2 + seed) * h * 0.42 * wave;
      ctx.lineTo(kx, ky + (f + 1 / stripes) * h);
    }
    ctx.closePath();
    ctx.fill();
  }
  // Fringe.
  ctx.strokeStyle = alpha(MATERIALS["bone-100"], 0.7);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 0; k < 12; k++) {
    const kx = -w / 2 + (w * k) / 11;
    const ky = Math.sin(k * 0.8 + t * 2.2 + seed) * h * 0.42 * wave;
    ctx.moveTo(kx, ky + h);
    ctx.lineTo(kx, ky + h + 5);
  }
  ctx.stroke();
  ctx.restore();
}
