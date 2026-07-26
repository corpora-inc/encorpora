/**
 * L1 — the far skyline, and L2 — the roofline across the street.
 *
 * **There is no mosque in the bazaar.** The founder's word is minaret-punk and
 * the silhouette is right — a tall shaft, a corbelled muqarnas balcony, a tiled
 * band, a finial — but turning a religious building into a shopfront is the
 * exact costume-box move this whole thing avoids. So the towers are
 * **observatory towers, clock towers and windcatchers**: the same regional
 * structural language, a secular function, and every one carries a working
 * instrument at its head. Which is also just better art direction, because a
 * tower with a meridian arc on top tells you what the ward does from four
 * hundred pixels away.
 */

import { frand, mix as mixSeed, idle } from "../util/rng.ts";
import { over } from "../util/color.ts";
import { drawMuqarnas } from "../geometry/muqarnas.ts";
import { archPath } from "../geometry/arch.ts";
import { patternPanel } from "../geometry/pattern.ts";
import { gearTrain, drawGear } from "../geometry/gears.ts";
import { sprite, bucket } from "./sprites.ts";
import type { Ambient } from "./daylight.ts";
import { lit, shade } from "./daylight.ts";
import type { Semantic } from "../tokens/palette.ts";
import { WARDS, type WardId } from "../tokens/palette.ts";
import type { Finial, Fold } from "../types.ts";

export interface SkyContext {
  sem: Semantic;
  am: Ambient;
  dpr: number;
  /** Haze depth 0…6 for this layer. */
  depth: number;
}

const hazeOf = (c: SkyContext): { color: string; alpha: number } => ({
  color: c.sem.haze,
  alpha: (c.am.hazeAlpha * c.depth) / 6,
});

/** A tower: shaft, tiled band, muqarnas balcony, and an instrument on top. */
export function drawTower(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  width: number,
  height: number,
  ward: WardId,
  finial: Finial,
  fold: Fold,
  seed: number,
  c: SkyContext,
  t: number,
): void {
  const key = `tower|${ward}|${finial}|${fold}|${seed & 255}|${bucket(c.am.night, 12)}|${bucket(c.am.sunAlpha, 12)}|${c.depth}`;
  const pad = width * 1.6;
  const s = sprite(key, width + pad * 2, height + width * 2.2, c.dpr, (g, w, h) => {
    const cx = w / 2;
    const by = h;
    const shaftW = width;
    const ground = c.sem.ground;
    const faceL = lit(ground, c.am, 1.05);
    const faceR = shade(ground, c.am, 0.9, c.sem.shadow);
    const band = WARDS[ward];

    // Octagonal shaft, read as three facets: a lit face, a middle, a shade.
    const x0 = cx - shaftW / 2;
    const top = by - height;
    ctx0Rect(g, x0, top, shaftW * 0.36, height, faceL);
    ctx0Rect(g, x0 + shaftW * 0.36, top, shaftW * 0.34, height, ground);
    ctx0Rect(g, x0 + shaftW * 0.7, top, shaftW * 0.3, height, faceR);

    // Facet seams.
    g.strokeStyle = c.sem.cut;
    g.lineWidth = 1;
    g.globalAlpha = 0.5;
    g.beginPath();
    for (const f of [0.36, 0.7]) {
      g.moveTo(x0 + shaftW * f + 0.5, top);
      g.lineTo(x0 + shaftW * f + 0.5, by);
    }
    g.stroke();
    g.globalAlpha = 1;

    // The tiled band at 0.62 of the height. Glaze never carries text.
    const bandY = by - height * 0.62;
    const bandH = Math.max(6, height * 0.08);
    const panel = patternPanel({
      width: shaftW,
      height: bandH,
      fold: fold === "lattice" ? "khatem8" : fold,
      edge: Math.max(6, bandH * 0.55),
      ground: c.sem.ground,
      strap: c.sem.metal,
      glaze: band.glaze,
      glazeDeep: band.glazeDeep,
      dpr: c.dpr,
    });
    g.drawImage(panel, x0, bandY, shaftW, bandH);
    g.strokeStyle = c.sem.cut;
    g.strokeRect(x0 + 0.5, bandY + 0.5, shaftW - 1, bandH - 1);

    // Slit windows below the band: an observatory needs sightlines.
    g.fillStyle = c.am.night > 0.4 ? c.sem.metalLit : shade(ground, c.am, 1.6, c.sem.shadow);
    for (let i = 0; i < 3; i++) {
      const wy = by - height * (0.2 + i * 0.12);
      g.beginPath();
      g.moveTo(cx - shaftW * 0.08, wy);
      g.lineTo(cx - shaftW * 0.08, wy - height * 0.05);
      archPath(g, cx, wy - height * 0.05, shaftW * 0.16, "equilateral");
      g.lineTo(cx + shaftW * 0.08, wy);
      g.closePath();
      g.fill();
    }

    // The corbelled balcony that carries the instrument platform.
    const balcY = by - height * 0.86;
    const balcH = height * 0.08;
    drawMuqarnas(g, {
      x: cx - shaftW * 0.78,
      y: balcY,
      width: shaftW * 1.56,
      height: balcH,
      tiers: 5,
      k0: 3,
      ground: c.sem.ground,
      sun: c.am.sunColor,
      sunAlpha: c.am.sunAlpha,
      shadow: c.sem.shadow,
      shadowAlpha: c.am.shadowAlpha,
      litEdge: c.sem.litEdge,
      cut: c.sem.cut,
    });
    ctx0Rect(g, cx - shaftW * 0.8, balcY - height * 0.02, shaftW * 1.6, height * 0.02, faceL);

    // Upper stage and the head.
    const headTop = by - height;
    ctx0Rect(g, cx - shaftW * 0.34, headTop, shaftW * 0.68, height * 0.14, ground);
    g.strokeStyle = c.sem.cut;
    g.strokeRect(cx - shaftW * 0.34 + 0.5, headTop + 0.5, shaftW * 0.68 - 1, height * 0.14);

    drawFinial(g, cx, headTop, shaftW, finial, c, seed, 0);
  });
  const sw = width + pad * 2;
  const sh = height + width * 2.2;
  ctx.drawImage(s, x - sw / 2, baseY - sh, sw, sh);

  // The one thing that must move per frame: the anemometer and the gear train.
  if (finial === "vane" || finial === "gear") {
    ctx.save();
    ctx.translate(x, baseY - height - width * 0.2);
    drawLiveFinial(ctx, width, finial, c, seed, t);
    ctx.restore();
  }
}

function ctx0Rect(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
): void {
  g.fillStyle = fill;
  g.fillRect(x, y, w, h);
}

/** The static part of each instrument. */
function drawFinial(
  g: CanvasRenderingContext2D,
  cx: number,
  topY: number,
  shaftW: number,
  finial: Finial,
  c: SkyContext,
  seed: number,
  _t: number,
): void {
  const metal = c.sem.metal;
  const metalLit = c.sem.metalLit;
  const r = shaftW * 0.5;
  g.strokeStyle = metal;
  g.fillStyle = metal;
  g.lineWidth = Math.max(1.5, shaftW * 0.06);

  // Every instrument stands on a post.
  g.fillRect(cx - shaftW * 0.05, topY - r * 0.7, shaftW * 0.1, r * 0.7);

  switch (finial) {
    case "meridian": {
      // A graduated quarter-arc, read against the meridian.
      g.beginPath();
      g.arc(cx, topY - r * 0.7, r, Math.PI, Math.PI * 1.9);
      g.stroke();
      g.lineWidth = Math.max(1, shaftW * 0.03);
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI + (Math.PI * 0.9 * i) / 8;
        g.beginPath();
        g.moveTo(cx + r * Math.cos(a), topY - r * 0.7 + r * Math.sin(a));
        g.lineTo(cx + r * 1.16 * Math.cos(a), topY - r * 0.7 + r * 1.16 * Math.sin(a));
        g.stroke();
      }
      break;
    }
    case "signal": {
      // A signal lamp on a bracket. Lit at night, and only at night.
      g.fillRect(cx - shaftW * 0.3, topY - r * 0.78, shaftW * 0.6, shaftW * 0.08);
      const glow = c.am.lanternGain;
      g.fillStyle = glow > 0.2 ? over(metalLit, "#f5b94a", glow) : metal;
      g.beginPath();
      g.moveTo(cx - r * 0.32, topY - r * 0.78);
      g.lineTo(cx + r * 0.32, topY - r * 0.78);
      g.lineTo(cx + r * 0.22, topY - r * 1.36);
      g.lineTo(cx - r * 0.22, topY - r * 1.36);
      g.closePath();
      g.fill();
      break;
    }
    case "armillary": {
      // Nested rings, one tilted to the pole.
      g.lineWidth = Math.max(1.2, shaftW * 0.045);
      const cy = topY - r * 1.1;
      g.beginPath();
      g.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.ellipse(cx, cy, r * 0.72, r * 0.26, 0, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.ellipse(cx, cy, r * 0.3, r * 0.72, 0.5, 0, Math.PI * 2);
      g.stroke();
      break;
    }
    case "vane":
    case "gear": {
      // The moving instruments get only their mounting here; the live part is
      // drawn per frame so that its motion is real.
      g.fillRect(cx - shaftW * 0.06, topY - r * 1.5, shaftW * 0.12, r * 0.85);
      break;
    }
  }
  void seed;
}

/** The instruments that actually turn. BZ-LAW-11 applies to the gear one. */
function drawLiveFinial(
  ctx: CanvasRenderingContext2D,
  shaftW: number,
  finial: Finial,
  c: SkyContext,
  seed: number,
  t: number,
): void {
  const r = shaftW * 0.5;
  const style = {
    metal: c.sem.metal,
    metalShade: c.sem.metalShade,
    litEdge: c.sem.litEdge,
    cut: c.sem.cut,
  };
  if (finial === "vane") {
    // Three cups on arms — an anemometer, turning with the wind.
    const spin = t * (0.9 + frand(seed) * 0.5) + idle(t, seed, 0.4);
    ctx.strokeStyle = c.sem.metal;
    ctx.fillStyle = c.sem.metal;
    ctx.lineWidth = Math.max(1.2, shaftW * 0.04);
    for (let k = 0; k < 3; k++) {
      const a = spin + (k * Math.PI * 2) / 3;
      const ex = Math.cos(a) * r * 0.8;
      const ey = Math.sin(a) * r * 0.28;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.7);
      ctx.lineTo(ex, -r * 0.7 + ey);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ex, -r * 0.7 + ey, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // A two-stage train. The follower's angle is derived from the driver's, so
    // ω_b = −ω_a·(N_a/N_b) cannot be violated.
    const gears = gearTrain(
      {
        spec: [{ teeth: 20 }, { teeth: 15, bearing: -34 }],
        module: (r * 0.055),
        origin: { x: 0, y: -r * 1.0 },
        omega: 0.55,
      },
      t,
    );
    for (const g of gears) drawGear(ctx, g, style);
  }
}

/** A double-shell dome over a caravanserai courtyard. Never over a stall. */
export function drawDome(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  d: number,
  ward: WardId,
  seed: number,
  c: SkyContext,
): void {
  const key = `dome|${ward}|${seed & 63}|${bucket(c.am.night, 12)}|${bucket(c.am.sunAlpha, 12)}|${c.depth}`;
  const rise = d * 0.72;
  const drumH = d * 0.34;
  const s = sprite(key, d * 1.3, rise + drumH + d * 0.3, c.dpr, (g, w, h) => {
    const cx = w / 2;
    const by = h;
    const band = WARDS[ward];
    // Drum with lights.
    const drumY = by - drumH;
    g.fillStyle = c.sem.ground;
    g.fillRect(cx - d / 2, drumY, d, drumH);
    g.fillStyle = shade(c.sem.ground, c.am, 1.4, c.sem.shadow);
    const lights = seed % 2 ? 8 : 12;
    for (let i = 0; i < lights; i++) {
      const lx = cx - d / 2 + ((i + 0.5) * d) / lights;
      g.beginPath();
      g.moveTo(lx - d * 0.014, drumY + drumH * 0.85);
      g.lineTo(lx - d * 0.014, drumY + drumH * 0.42);
      archPath(g, lx, drumY + drumH * 0.42, d * 0.028, "equilateral");
      g.lineTo(lx + d * 0.014, drumY + drumH * 0.85);
      g.closePath();
      g.fill();
    }
    g.strokeStyle = c.sem.cut;
    g.lineWidth = 1;
    g.strokeRect(cx - d / 2 + 0.5, drumY + 0.5, d - 1, drumH - 1);

    // Pointed outer shell, glazed.
    g.fillStyle = band.glaze;
    g.beginPath();
    g.moveTo(cx - d / 2, drumY);
    g.quadraticCurveTo(cx - d * 0.52, drumY - rise * 0.72, cx, drumY - rise);
    g.quadraticCurveTo(cx + d * 0.52, drumY - rise * 0.72, cx + d / 2, drumY);
    g.closePath();
    g.fill();
    // A lit crescent of the shell on the sun side; flat, no gradient.
    g.fillStyle = over(band.glaze, c.am.sunColor, c.am.sunAlpha * 1.3);
    g.beginPath();
    g.moveTo(cx - d / 2, drumY);
    g.quadraticCurveTo(cx - d * 0.52, drumY - rise * 0.72, cx, drumY - rise);
    g.quadraticCurveTo(cx - d * 0.2, drumY - rise * 0.6, cx - d * 0.28, drumY);
    g.closePath();
    g.fill();
    // Ribs.
    g.strokeStyle = band.glazeDeep;
    g.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
      const f = i / 6;
      g.beginPath();
      g.moveTo(cx - d / 2 + d * f, drumY);
      g.quadraticCurveTo(
        cx - d * 0.52 + d * 1.04 * f,
        drumY - rise * (0.72 + 0.3 * Math.sin(Math.PI * f)),
        cx,
        drumY - rise,
      );
      g.stroke();
    }
    // Finial.
    g.strokeStyle = c.sem.metal;
    g.lineWidth = Math.max(1.5, d * 0.02);
    g.beginPath();
    g.moveTo(cx, drumY - rise);
    g.lineTo(cx, drumY - rise - d * 0.16);
    g.stroke();
    g.fillStyle = c.sem.metal;
    g.beginPath();
    g.arc(cx, drumY - rise - d * 0.2, d * 0.045, 0, Math.PI * 2);
    g.fill();
  });
  ctx.drawImage(s, x - d * 0.65, baseY - (rise + drumH + d * 0.3), d * 1.3, rise + drumH + d * 0.3);
}

/** A plain roof block: what fills between the landmarks. */
export function drawRoofBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  w: number,
  h: number,
  seed: number,
  c: SkyContext,
  detail: boolean,
): void {
  const key = `roof|${seed & 1023}|${detail ? 1 : 0}|${bucket(c.am.night, 12)}|${bucket(c.am.sunAlpha, 12)}|${c.depth}`;
  const s = sprite(key, w, h + w * 0.3, c.dpr, (g, cw, ch) => {
    const by = ch;
    const top = by - h;
    const face = lit(c.sem.ground, c.am, 0.7);
    g.fillStyle = face;
    g.fillRect(0, top, cw, h);
    g.fillStyle = shade(c.sem.ground, c.am, 0.9, c.sem.shadow);
    g.fillRect(cw * 0.76, top, cw * 0.24, h);
    // Parapet with a crenellated cap: the roofline is never a plain rectangle.
    g.fillStyle = shade(c.sem.ground, c.am, 0.6, c.sem.shadow);
    g.fillRect(0, top, cw, Math.max(3, h * 0.06));
    const merlons = Math.max(3, Math.round(cw / 14));
    g.fillStyle = face;
    for (let i = 0; i < merlons; i++) {
      const mx = (i * cw) / merlons;
      g.fillRect(mx + 1, top - h * 0.05, cw / merlons - 3, h * 0.05);
    }
    if (detail) {
      // Windows, and a wind-catcher scoop on some blocks.
      const cols = Math.max(2, Math.round(cw / 46));
      const rows = Math.max(1, Math.min(3, Math.round(h / 78)));
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const wx = ((i + 0.5) * cw) / cols;
          const wy = top + h * 0.16 + (j * h * 0.52) / rows;
          const nightLit = c.am.lanternGain > 0.3 && frand(mixSeed(seed, i * 31 + j)) < 0.55;
          g.fillStyle = nightLit
            ? over(c.sem.metalLit, "#f5b94a", 0.5)
            : shade(c.sem.ground, c.am, 1.8, c.sem.shadow);
          const ww = Math.min(20, cw / cols - 8);
          g.beginPath();
          g.moveTo(wx - ww / 2, wy + ww);
          g.lineTo(wx - ww / 2, wy);
          archPath(g, wx, wy, ww, "equilateral");
          g.lineTo(wx + ww / 2, wy + ww);
          g.closePath();
          g.fill();
          // Painted shutters, folded back. Colour where a wall would be blank.
          if (frand(mixSeed(seed, 900 + i * 7 + j)) < 0.5) {
            const sc = [
              "#23356b",
              "#a33a2c",
              "#24603e",
              "#d19a24",
            ][Math.floor(frand(mixSeed(seed, i * 13 + j)) * 4)]!;
            g.fillStyle = over(sc, c.am.sunColor, c.am.sunAlpha * 1.2);
            g.fillRect(wx - ww * 0.78, wy, ww * 0.24, ww * 0.9);
            g.fillRect(wx + ww * 0.54, wy, ww * 0.24, ww * 0.9);
          }
        }
      }
      if (seed % 3 === 0) {
        g.fillStyle = face;
        g.fillRect(cw * 0.62, top - h * 0.22, cw * 0.2, h * 0.22);
        g.fillStyle = shade(c.sem.ground, c.am, 1.5, c.sem.shadow);
        for (let i = 0; i < 3; i++) {
          g.fillRect(cw * 0.63 + i * cw * 0.06, top - h * 0.2, cw * 0.025, h * 0.16);
        }
      }
    }
    g.strokeStyle = c.sem.cut;
    g.lineWidth = 1;
    g.globalAlpha = 0.6;
    g.beginPath();
    g.moveTo(cw - 0.5, top);
    g.lineTo(cw - 0.5, by);
    g.stroke();
    g.globalAlpha = 1;
  });
  ctx.drawImage(s, x, baseY - (h + w * 0.3), w, h + w * 0.3);
}

/** Aerial perspective. Composite, never blur. BZ-LAW-6. */
export function applyHaze(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  c: SkyContext,
): void {
  const { color, alpha: a } = hazeOf(c);
  if (a <= 0.005) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}
