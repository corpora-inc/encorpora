/**
 * L5 — the street floor: zellij paving, the water channel, and the reflections
 * it carries at night.
 *
 * Naqsh-e Jahan has a water channel down all four sides of the square. Ours
 * runs the length of the street, and it is both the thing a child pokes and
 * the surface the lanterns land in after dusk.
 *
 * Feet polish stone, so the centre of the street is lighter and its grout is
 * darker than the edges. That one detail does more for "this is a real place"
 * than any amount of texture.
 */

import { frand, mix as mixSeed, idle, clamp } from "../util/rng.ts";
import { alpha, over } from "../util/color.ts";
import { zellijTile } from "../geometry/zellij.ts";
import type { Ambient } from "./daylight.ts";
import { shade } from "./daylight.ts";
import type { Semantic } from "../tokens/palette.ts";
import { WARDS, type WardId } from "../tokens/palette.ts";
import type { Layout } from "./layout.ts";

export interface FloorCtx {
  sem: Semantic;
  am: Ambient;
  dpr: number;
  lay: Layout;
  reduced: boolean;
  reflections: boolean;
}

let patternCanvas: HTMLCanvasElement | null = null;
let patternKey = "";

function paving(c: FloorCtx, ward: WardId, seed: number): CanvasPattern | null {
  const key = `${ward}|${Math.round(c.lay.M)}|${c.am.night > 0.5 ? "n" : "d"}|${seed & 15}`;
  if (key !== patternKey) {
    const band = WARDS[ward];
    const nextWard = WARDS[ward === "lapis" ? "madder" : "lapis"];
    patternCanvas = zellijTile({
      pitch: Math.max(13, c.lay.M * 0.065),
      block: 4,
      seed,
      grout: c.sem.cut,
      field: over(c.sem.ground, c.sem.groundShade, 0.5),
      glaze: over(band.glaze, c.sem.ground, c.am.night > 0.5 ? 0.7 : 0.6),
      glazeDeep: over(band.glazeDeep, c.sem.ground, 0.55),
      repair: over(nextWard.glaze, c.sem.ground, 0.5),
      dpr: c.dpr,
    });
    patternKey = key;
  }
  if (!patternCanvas) return null;
  const ctx = patternCanvas.getContext("2d");
  const pat = ctx ? ctx.createPattern(patternCanvas, "repeat") : null;
  // The tile is rasterised at device resolution; bring it back to CSS units.
  if (pat && c.dpr !== 1) pat.setTransform(new DOMMatrix().scale(1 / c.dpr));
  return pat;
}

export interface Reflector {
  x: number;
  w: number;
  color: string;
  lit: boolean;
}

export function drawFloor(
  ctx: CanvasRenderingContext2D,
  camX: number,
  ward: WardId,
  seed: number,
  c: FloorCtx,
  t: number,
  reflectors: Reflector[],
  ripples: { x: number; age: number }[],
): void {
  const { lay, sem, am } = c;
  const y0 = lay.floorY;
  const h = lay.h - y0;

  ctx.fillStyle = sem.ground;
  ctx.fillRect(0, y0, lay.w, h);

  // Zellij paving, squashed because you see it at a grazing angle.
  const p = paving(c, ward, seed);
  if (p) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y0, lay.w, h);
    ctx.clip();
    ctx.translate(-camX % 2048, y0);
    ctx.scale(1, 0.5);
    ctx.fillStyle = p;
    ctx.fillRect(0, 0, lay.w + 2048, h * 2 + 8);
    ctx.restore();
  }

  // Feet polish stone: the centre band is lighter, its grout darker, feathered.
  const bandTop = y0 + h * 0.22;
  const bandH = h * 0.34;
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = am.sunColor;
  ctx.fillRect(0, bandTop, lay.w, bandH);
  ctx.globalAlpha = 0.04;
  ctx.fillRect(0, bandTop - h * 0.08, lay.w, h * 0.08);
  ctx.fillRect(0, bandTop + bandH, lay.w, h * 0.08);
  ctx.restore();

  // The kerb: one lit edge, one cut line. That is all a step needs.
  ctx.fillStyle = sem.litEdge;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(0, y0, lay.w, 1);
  ctx.globalAlpha = 1;
  ctx.fillStyle = sem.cut;
  ctx.fillRect(0, y0 + 1, lay.w, 1);

  drawWater(ctx, camX, c, t, reflectors, ripples);
}

function drawWater(
  ctx: CanvasRenderingContext2D,
  camX: number,
  c: FloorCtx,
  t: number,
  reflectors: Reflector[],
  ripples: { x: number; age: number }[],
): void {
  const { lay, sem, am } = c;
  const wy = lay.floorY + (lay.h - lay.floorY) * 0.68;
  const wh = Math.max(11, (lay.h - lay.floorY) * 0.22);

  // The channel is cut into the paving: a lip, a reveal, then water.
  ctx.fillStyle = shade(sem.ground, am, 1.5, sem.shadow);
  ctx.fillRect(0, wy - 3, lay.w, wh + 6);
  ctx.fillStyle = sem.water;
  ctx.fillRect(0, wy, lay.w, wh);

  // Reflections: flipped, low, wobbled. The downsample IS the blur — there is
  // no `filter: blur` anywhere in the bazaar (BZ-LAW-6).
  if (c.reflections) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, wy, lay.w, wh);
    ctx.clip();
    for (const r of reflectors) {
      const wob = c.reduced ? 0 : idle(t, mixSeed(Math.round(r.x), 7), 2);
      ctx.globalAlpha = r.lit ? 0.4 : 0.22;
      ctx.fillStyle = r.color;
      ctx.fillRect(r.x + wob, wy, r.w, wh);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Two travelling sine bands and a scatter of specular dashes.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, wy, lay.w, wh);
  ctx.clip();
  const v = c.reduced ? 0 : t * 11;
  ctx.strokeStyle = alpha(sem.litEdge, 0.28);
  ctx.lineWidth = 1;
  for (const [lam, amp, ph] of [
    [34, 1.6, 0],
    [51, 2.4, 1.7],
  ] as const) {
    ctx.beginPath();
    for (let x = -2; x <= lay.w + 2; x += 4) {
      const y = wy + wh * 0.42 + Math.sin((x + v + camX * 0.1) / lam + ph) * amp;
      if (x < 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.fillStyle = alpha(sem.litEdge, 0.55);
  const specN = Math.round(lay.w / 46);
  for (let i = 0; i < specN; i++) {
    const s = mixSeed(i, 0x3f7a);
    const x = ((frand(s) * lay.w + (c.reduced ? 0 : t * 9)) % (lay.w + 20)) - 10;
    const y = wy + wh * (0.22 + frand(mixSeed(s, 1)) * 0.6);
    ctx.fillRect(x, y, 3, 1);
  }

  // Ripples where a child has touched the water.
  ctx.strokeStyle = alpha(sem.litEdge, 0.4);
  for (const rp of ripples) {
    const a = clamp(1 - rp.age / 1.1, 0, 1);
    if (a <= 0) continue;
    const rad = 90 * (1 - a);
    ctx.globalAlpha = a * 0.5;
    ctx.beginPath();
    ctx.ellipse(rp.x, wy + wh * 0.5, rad, rad * 0.28, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  ctx.fillStyle = sem.litEdge;
  ctx.globalAlpha = 0.35;
  ctx.fillRect(0, wy - 3, lay.w, 1);
  ctx.globalAlpha = 1;
}

/**
 * The shadow a stall throws onto the pavement. Transmitted skylight, not black,
 * and a hard edge — the sun in a covered bazaar comes through an oculus, which
 * casts a sharp shadow.
 */
export function drawStallShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  w: number,
  c: FloorCtx,
): void {
  const { lay, sem, am } = c;
  const lean = Math.tan((am.shaftAngle * Math.PI) / 180) * (lay.h - lay.floorY) * 0.9;
  ctx.save();
  ctx.globalAlpha = am.shadowAlpha * 0.75;
  ctx.fillStyle = sem.shadow;
  ctx.beginPath();
  ctx.moveTo(x, lay.floorY);
  ctx.lineTo(x + w, lay.floorY);
  ctx.lineTo(x + w + lean, lay.h);
  ctx.lineTo(x + lean, lay.h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Where a shaft of light lands. The warmest thing in the picture. */
export function drawSunPool(
  ctx: CanvasRenderingContext2D,
  x: number,
  w: number,
  c: FloorCtx,
): void {
  const { lay, am } = c;
  if (am.sunAlpha < 0.02 || am.night > 0.9) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = alpha(am.sunColor, am.sunAlpha * 0.5 * (1 - am.night));
  ctx.beginPath();
  ctx.moveTo(x - w / 2, lay.floorY);
  ctx.lineTo(x + w / 2, lay.floorY);
  ctx.lineTo(x + w * 0.78, lay.h);
  ctx.lineTo(x - w * 0.78, lay.h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
