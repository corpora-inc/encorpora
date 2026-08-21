/**
 * L3 — the canopy: brick vault, skylight oculi, hanging lanterns, and the
 * shafts of light that fall through.
 *
 * The Isfahan Grand Bazaar is two kilometres of brick-vaulted street lit by
 * oculi punched through the crown of the vault. That is the whole lighting
 * model here: the street is roofed, the roof is pierced, and everything warm
 * about the picture comes down through those holes.
 *
 * Dust lives **only inside a shaft polygon** — which is both physically true
 * and the reason it costs nothing: there are never motes where you would not
 * see them.
 */

import { frand, mix as mixSeed, idle, clamp } from "../util/rng.ts";
import { alpha, over } from "../util/color.ts";
import { archPath } from "../geometry/arch.ts";
import { patternPanel } from "../geometry/pattern.ts";
import { sprite, bucket } from "./sprites.ts";
import type { Ambient } from "./daylight.ts";
import { lit, shade } from "./daylight.ts";
import type { Semantic } from "../tokens/palette.ts";
import { WARDS, type WardId, MATERIALS } from "../tokens/palette.ts";
import type { Fold } from "../types.ts";
import type { Layout } from "./layout.ts";

export interface CanopyCtx {
  sem: Semantic;
  am: Ambient;
  dpr: number;
  lay: Layout;
  reduced: boolean;
  motes: number;
}

const GLASS = [
  MATERIALS["glass-amber"],
  MATERIALS["glass-ruby"],
  MATERIALS["glass-emerald"],
  MATERIALS["glass-cobalt"],
  MATERIALS["glass-clear"],
];

/**
 * One bay of the arcade you are standing under.
 *
 * It hangs across the very top of the frame — the near edge of the vault, seen
 * from beneath — and its openings are **cut clean through**, so the sky and the
 * far towers you can see from inside this ward show in the holes. That is what
 * makes the picture read as a covered street rather than a wall with a sky
 * pasted on it, and it is where every shaft of light in the bazaar comes from.
 */
export function drawArcadeBay(
  ctx: CanvasRenderingContext2D,
  x: number,
  w: number,
  top: number,
  h: number,
  ward: WardId,
  fold: Fold,
  seed: number,
  c: CanopyCtx,
): void {
  const key = `bay2|${ward}|${fold}|${seed & 63}|${bucket(c.am.night, 12)}|${bucket(c.am.sunAlpha, 12)}`;
  const s = sprite(key, w, h, c.dpr, (g, bw, bh) => {
    const soffit = shade(c.sem.ground, c.am, 1.05, c.sem.shadow);
    const ribW = Math.max(6, bw * 0.09);

    g.fillStyle = soffit;
    g.fillRect(0, 0, bw, bh);

    // Brick coursing on the soffit, following the curve of the vault.
    g.strokeStyle = over(soffit, c.sem.cut, 0.4);
    g.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
      const y = (i / 6) * bh * 0.8;
      g.beginPath();
      g.moveTo(0, y);
      g.quadraticCurveTo(bw / 2, y - bh * 0.12, bw, y);
      g.stroke();
    }

    // Cut the opening clean through the roof.
    const ow = bw - ribW * 2;
    const oh = bh * 0.86;
    const ox = ribW;
    const oy = -bh * 0.1;
    g.save();
    g.globalCompositeOperation = "destination-out";
    g.beginPath();
    g.moveTo(ox, oy + oh);
    g.lineTo(ox, oy + oh * 0.46);
    archPath(g, ox + ow / 2, oy + oh * 0.46, ow, "equilateral");
    g.lineTo(ox + ow, oy + oh);
    g.closePath();
    g.fill();
    g.restore();

    // A pierced screen across the head of the opening: girih you see sky
    // through, which is the only honest way to use it.
    const panel = patternPanel({
      width: ow,
      height: oh * 0.52,
      fold: fold === "lattice" ? "hex6" : fold,
      edge: Math.max(11, oh * 0.2),
      ground: soffit,
      strap: over(soffit, c.sem.metalLit, 0.85),
      glaze: soffit,
      glazeDeep: soffit,
      transparent: true,
      dpr: c.dpr,
    });
    g.save();
    g.beginPath();
    g.moveTo(ox, oy + oh * 0.46);
    archPath(g, ox + ow / 2, oy + oh * 0.46, ow, "equilateral");
    g.closePath();
    g.clip();
    g.drawImage(panel, ox, oy, ow, oh * 0.52);
    g.restore();

    // The rib on each side, and a lit edge on its sun face.
    for (const rx of [0, bw - ribW]) {
      g.fillStyle = lit(c.sem.ground, c.am, 0.4);
      g.fillRect(rx, 0, ribW, bh);
      g.fillStyle = c.sem.litEdge;
      g.globalAlpha = 0.4;
      g.fillRect(rx, 0, 1, bh);
      g.globalAlpha = 1;
      g.fillStyle = c.sem.cut;
      g.fillRect(rx + ribW - 1, 0, 1, bh);
    }

    // The cornice along the lower edge, in the ward's glaze. Colour, never text.
    const band = WARDS[ward];
    const ch = Math.max(3, bh * 0.07);
    g.fillStyle = band.glaze;
    g.fillRect(0, bh - ch, bw, ch);
    g.fillStyle = band.glazeDeep;
    for (let i = 0; i * 14 < bw; i++) g.fillRect(i * 14, bh - ch, 5, ch);
    g.fillStyle = c.sem.litEdge;
    g.globalAlpha = 0.5;
    g.fillRect(0, bh - ch, bw, 1);
    g.globalAlpha = 1;
    g.fillStyle = c.sem.cut;
    g.fillRect(0, bh - 1, bw, 1);
  });
  ctx.drawImage(s, x, top, w, h);
}

/**
 * A shaft of light from an oculus to the floor, with dust turning in it.
 * The shaft angle is 90° − sun azimuth, so it rakes as the day goes on.
 */
export function drawLightShaft(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  ow: number,
  floorY: number,
  seed: number,
  c: CanopyCtx,
  t: number,
  scatter: { x: number; y: number; age: number } | null,
): void {
  const drop = floorY - oy;
  const lean = Math.tan((c.am.shaftAngle * Math.PI) / 180) * drop;
  const spread = ow * 2.1;
  const g = ctx;
  const strength = clamp(c.am.sunAlpha * 0.72 * (1 - c.am.night * 0.9), 0, 0.2);
  if (strength > 0.01) {
    g.save();
    g.globalCompositeOperation = "lighter";
    g.fillStyle = alpha(c.am.sunColor, strength * 0.5);
    g.beginPath();
    g.moveTo(ox - ow / 2, oy);
    g.lineTo(ox + ow / 2, oy);
    g.lineTo(ox + lean + spread / 2, floorY);
    g.lineTo(ox + lean - spread / 2, floorY);
    g.closePath();
    g.fill();
    // A brighter core, one flat step. Two polygons, never a gradient.
    g.fillStyle = alpha(c.am.sunColor, strength * 0.45);
    g.beginPath();
    g.moveTo(ox - ow * 0.22, oy);
    g.lineTo(ox + ow * 0.22, oy);
    g.lineTo(ox + lean + spread * 0.2, floorY);
    g.lineTo(ox + lean - spread * 0.2, floorY);
    g.closePath();
    g.fill();
    g.restore();
  }

  if (c.motes <= 0) return;
  const n = Math.round(c.motes * c.am.dustGain * 0.5);
  g.save();
  g.fillStyle = alpha(c.am.sunColor, 0.85);
  for (let i = 0; i < n; i++) {
    const s = mixSeed(seed, i);
    const u = frand(s);
    // Brownian jitter plus a 6 px/s downward drift, wrapped.
    const drift = c.reduced ? 0.5 : ((frand(mixSeed(s, 1)) + t * 0.06 / 1) % 1);
    const v = drift;
    const jx = c.reduced ? 0 : idle(t, mixSeed(s, 2), 3.2);
    const jy = c.reduced ? 0 : idle(t, mixSeed(s, 3), 2.4);
    const width = ow + (spread - ow) * v;
    let px = ox + lean * v + (u - 0.5) * width + jx;
    let py = oy + drop * v + jy;
    if (scatter && scatter.age < 0.7) {
      const dx = px - scatter.x;
      const dy = py - scatter.y;
      const d = Math.hypot(dx, dy);
      if (d < 140 && d > 0.5) {
        const k = (1 - scatter.age / 0.7) * (1 - d / 140) * 40;
        px += (dx / d) * k;
        py += (dy / d) * k;
      }
    }
    const r = 0.7 + frand(mixSeed(s, 4)) * 1.1;
    g.globalAlpha = 0.35 + 0.45 * (1 - v);
    g.fillRect(px, py, r, r);
  }
  g.restore();
}

/** A hanging lantern: pierced brass, coloured glass, a real pendulum. */
export function drawLantern(
  ctx: CanvasRenderingContext2D,
  x: number,
  topY: number,
  size: number,
  seed: number,
  c: CanopyCtx,
  t: number,
  kick = 0,
): void {
  const chain = size * (1.1 + frand(seed) * 1.5);
  // T = 2π√(L/g), scaled to a 2.4 s swing; amplitude 1.5°, gusts to 4°.
  const swing = c.reduced
    ? 0
    : (idle(t / 2.4, seed, 1.5) + kick) * (Math.PI / 180);
  const g = ctx;
  const cx = x + Math.sin(swing) * chain;
  const cy = topY + Math.cos(swing) * chain;

  g.strokeStyle = c.sem.metalShade;
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(x, topY);
  g.lineTo(cx, cy);
  g.stroke();

  const glass = GLASS[seed % GLASS.length]!;
  const gain = c.am.lanternGain;
  const body = sprite(
    `lantern|${seed % GLASS.length}|${Math.round(size)}|${bucket(gain, 10)}|${bucket(c.am.night, 8)}`,
    size * 1.2,
    size * 1.9,
    c.dpr,
    (h, lw) => {
      const lx = lw / 2;
      // Cap and hanging ring.
      h.strokeStyle = c.sem.metal;
      h.lineWidth = 1.5;
      h.beginPath();
      h.arc(lx, size * 0.12, size * 0.09, 0, Math.PI * 2);
      h.stroke();
      // The glass body, an eight-sided lamp.
      const bodyTop = size * 0.28;
      const bodyH = size * 1.0;
      const bw = size * 0.7;
      h.fillStyle = gain > 0.05 ? over(glass, "#ffe9bc", 0.35 * gain) : over(glass, c.sem.ground, 0.5);
      h.beginPath();
      h.moveTo(lx - bw / 2, bodyTop + bodyH * 0.2);
      h.lineTo(lx - bw * 0.32, bodyTop);
      h.lineTo(lx + bw * 0.32, bodyTop);
      h.lineTo(lx + bw / 2, bodyTop + bodyH * 0.2);
      h.lineTo(lx + bw * 0.4, bodyTop + bodyH);
      h.lineTo(lx - bw * 0.4, bodyTop + bodyH);
      h.closePath();
      h.fill();
      // Pierced brass strapping — the piercing is what the light comes through.
      h.strokeStyle = c.sem.metal;
      h.lineWidth = Math.max(1, size * 0.045);
      h.stroke();
      h.beginPath();
      for (let i = 1; i < 4; i++) {
        const yy = bodyTop + (bodyH * i) / 4;
        h.moveTo(lx - bw * 0.44, yy);
        h.lineTo(lx + bw * 0.44, yy);
      }
      h.lineWidth = 1;
      h.stroke();
      // The flame, and only when it is lit.
      if (gain > 0.15) {
        h.fillStyle = alpha("#fff3d6", 0.9);
        h.beginPath();
        h.ellipse(lx, bodyTop + bodyH * 0.62, size * 0.075, size * 0.13, 0, 0, Math.PI * 2);
        h.fill();
      }
      // A brass tassel below.
      h.strokeStyle = c.sem.metal;
      h.lineWidth = 1.5;
      h.beginPath();
      h.moveTo(lx, bodyTop + bodyH);
      h.lineTo(lx, bodyTop + bodyH + size * 0.2);
      h.stroke();
      h.fillStyle = c.sem.metal;
      h.beginPath();
      h.arc(lx, bodyTop + bodyH + size * 0.24, size * 0.055, 0, Math.PI * 2);
      h.fill();
    },
  );
  g.save();
  g.translate(cx, cy);
  g.rotate(swing);
  g.drawImage(body, -size * 0.6, 0, size * 1.2, size * 1.9);
  g.restore();

  // The pool of light it throws. One additive ellipse, capped — never a glow
  // stack, and never more than 3 % luminance of flicker (BZ-12).
  if (gain > 0.1) {
    const flick = c.reduced ? 0 : 1 + idle(t, mixSeed(seed, 9), 0.03);
    g.save();
    g.globalCompositeOperation = "lighter";
    g.fillStyle = alpha("#f5b94a", 0.06 * gain * flick);
    g.beginPath();
    g.ellipse(cx, cy + size * 0.8, size * 1.6, size * 1.15, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
}

/** The brass sound-valve on a canopy strut. The only sound control there is. */
export function drawValve(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  open: boolean,
  c: CanopyCtx,
): void {
  const g = ctx;
  g.strokeStyle = c.sem.metalShade;
  g.lineWidth = Math.max(2, size * 0.16);
  g.beginPath();
  g.moveTo(x - size, y);
  g.lineTo(x + size, y);
  g.stroke();
  g.fillStyle = c.sem.metal;
  g.beginPath();
  g.arc(x, y, size * 0.52, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = c.sem.cut;
  g.lineWidth = 1;
  g.stroke();
  // The handle: across the pipe when open, along it when shut. A shape, not
  // a colour, and not a word.
  g.strokeStyle = c.sem.litEdge;
  g.lineWidth = Math.max(2, size * 0.18);
  g.beginPath();
  if (open) {
    g.moveTo(x, y - size * 0.72);
    g.lineTo(x, y + size * 0.72);
  } else {
    g.moveTo(x - size * 0.72, y);
    g.lineTo(x + size * 0.72, y);
  }
  g.stroke();
}
