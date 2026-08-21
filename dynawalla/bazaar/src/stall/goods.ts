/**
 * The goods on the sill.
 *
 * Three to seven real objects from that game, laid out on the stone counter: a
 * die, a fraction bar, a balance weight, a coin, a coil of rope, a gear blank.
 * This is where a stall gets its individual character *without* the frame
 * styling the preview (BZ-LAW-1), and it is the single biggest contributor to
 * "this is a marketplace, not a menu".
 *
 * Every object is drawn with the same three-facet vocabulary as the stonework:
 * a lit face, a body, a cut line. No gradients, no glow, no drop shadows.
 */

import { frand, mix as mixSeed } from "../util/rng.ts";
import { over } from "../util/color.ts";
import { MATERIALS } from "../tokens/palette.ts";
import type { Semantic } from "../tokens/palette.ts";
import type { Craft } from "../types.ts";

export interface GoodsCtx {
  sem: Semantic;
  sunColor: string;
  sunAlpha: number;
  shadowAlpha: number;
}

const M = MATERIALS;

/** Lay 3–7 goods along a sill of width `w`, standing on `baseY`. */
export function drawGoods(
  g: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  w: number,
  unit: number,
  craft: Craft,
  seed: number,
  c: GoodsCtx,
  accretion: number,
): void {
  const n = 3 + Math.floor(frand(seed) * 5);
  const slots: number[] = [];
  for (let i = 0; i < n; i++) {
    slots.push(x + w * (0.08 + (0.84 * (i + 0.5)) / n) + (frand(mixSeed(seed, i)) - 0.5) * w * 0.04);
  }
  for (let i = 0; i < n; i++) {
    const sx = slots[i]!;
    const s = mixSeed(seed, i * 17 + 5);
    drawOne(g, sx, baseY, unit * (0.7 + frand(s) * 0.5), craft, i, s, c);
  }
  // Physical accretion: what the child has built here, and it stays (P-04).
  if (accretion > 0.01) drawAccretion(g, x, baseY, w, unit, craft, accretion, seed, c);
}

function facet(base: string, c: GoodsCtx): { face: string; body: string; cut: string } {
  return {
    face: over(base, c.sunColor, c.sunAlpha * 1.2),
    body: base,
    cut: over(base, c.sem.shadow, c.shadowAlpha * 1.2),
  };
}

function drawOne(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  u: number,
  craft: Craft,
  i: number,
  seed: number,
  c: GoodsCtx,
): void {
  switch (craft) {
    case "balance": {
      // Stone weights, in a graduated set. They are a number line you can lift.
      const k = 0.5 + (i % 3) * 0.28;
      const f = facet(M["sandstone-400"], c);
      g.fillStyle = f.body;
      g.beginPath();
      g.moveTo(x - u * 0.3 * k, y);
      g.lineTo(x - u * 0.2 * k, y - u * 0.52 * k);
      g.lineTo(x + u * 0.2 * k, y - u * 0.52 * k);
      g.lineTo(x + u * 0.3 * k, y);
      g.closePath();
      g.fill();
      g.fillStyle = f.face;
      g.fillRect(x - u * 0.2 * k, y - u * 0.56 * k, u * 0.4 * k, u * 0.05);
      g.strokeStyle = c.sem.metal;
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(x, y - u * 0.6 * k, u * 0.1 * k, Math.PI, 0);
      g.stroke();
      break;
    }
    case "coin": {
      // Stacks of coin. Place value, in brass.
      const h = 1 + (i % 4);
      const f = facet(M["brass-400"], c);
      for (let k = 0; k < h; k++) {
        g.fillStyle = k === h - 1 ? f.face : f.body;
        g.beginPath();
        g.ellipse(x, y - k * u * 0.09, u * 0.24, u * 0.09, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = f.cut;
        g.lineWidth = 1;
        g.stroke();
      }
      break;
    }
    case "tessera": {
      // Cut tiles, glazed, waiting to be set. And a chisel.
      const glaze = [M["turquoise-500"], M["lapis-700"], M["saffron-400"], M["madder-600"]][i % 4]!;
      if (i % 4 === 3) {
        g.fillStyle = M["walnut-600"];
        g.fillRect(x - u * 0.04, y - u * 0.5, u * 0.08, u * 0.5);
        g.fillStyle = c.sem.metal;
        g.fillRect(x - u * 0.05, y - u * 0.62, u * 0.1, u * 0.14);
      } else {
        g.save();
        g.translate(x, y - u * 0.1);
        g.rotate(frand(seed) * 0.7 - 0.35);
        g.fillStyle = glaze;
        g.fillRect(-u * 0.16, -u * 0.16, u * 0.32, u * 0.32);
        g.fillStyle = over(glaze, c.sunColor, c.sunAlpha * 1.4);
        g.fillRect(-u * 0.16, -u * 0.16, u * 0.32, u * 0.05);
        g.strokeStyle = c.sem.cut;
        g.lineWidth = 1;
        g.strokeRect(-u * 0.16, -u * 0.16, u * 0.32, u * 0.32);
        g.restore();
      }
      break;
    }
    case "rope": {
      // Coils of rope, laid in fathoms.
      const f = facet(M["bone-100"], c);
      g.strokeStyle = f.body;
      g.lineWidth = Math.max(1.5, u * 0.07);
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.ellipse(x, y - u * 0.06 - k * u * 0.08, u * 0.26 - k * u * 0.04, u * 0.09, 0, 0, Math.PI * 2);
        g.stroke();
      }
      g.strokeStyle = f.face;
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(x, y - u * 0.22, u * 0.18, u * 0.07, 0, Math.PI, Math.PI * 2);
      g.stroke();
      break;
    }
    case "astrolabe": {
      // A small brass instrument: mater, rete, alidade.
      const f = facet(M["brass-400"], c);
      g.fillStyle = f.body;
      g.beginPath();
      g.arc(x, y - u * 0.3, u * 0.26, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = f.cut;
      g.lineWidth = 1;
      g.stroke();
      g.strokeStyle = f.face;
      g.beginPath();
      g.arc(x, y - u * 0.3, u * 0.17, 0, Math.PI * 2);
      g.moveTo(x - u * 0.24, y - u * 0.3);
      g.lineTo(x + u * 0.24, y - u * 0.3);
      g.stroke();
      g.fillStyle = f.body;
      g.fillRect(x - u * 0.05, y - u * 0.06, u * 0.1, u * 0.06);
      break;
    }
    case "water": {
      // Jugs and a bowl: rate and proportion you can pour.
      const f = facet(M["terracotta-600"], c);
      g.fillStyle = f.body;
      g.beginPath();
      g.moveTo(x - u * 0.18, y);
      g.quadraticCurveTo(x - u * 0.26, y - u * 0.3, x - u * 0.1, y - u * 0.42);
      g.lineTo(x + u * 0.1, y - u * 0.42);
      g.quadraticCurveTo(x + u * 0.26, y - u * 0.3, x + u * 0.18, y);
      g.closePath();
      g.fill();
      g.fillStyle = f.face;
      g.fillRect(x - u * 0.1, y - u * 0.46, u * 0.2, u * 0.05);
      g.strokeStyle = f.cut;
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(x + u * 0.2, y - u * 0.24, u * 0.1, -1.2, 1.2);
      g.stroke();
      break;
    }
    case "vat": {
      // Dye pots. Ratio, in madder and indigo and weld.
      const dye = [M["indigo-800"], M["madder-600"], M["sabz-700"], M["ochre-500"]][i % 4]!;
      const f = facet(M["mudbrick-500"], c);
      g.fillStyle = f.body;
      g.beginPath();
      g.moveTo(x - u * 0.22, y);
      g.lineTo(x - u * 0.26, y - u * 0.36);
      g.lineTo(x + u * 0.26, y - u * 0.36);
      g.lineTo(x + u * 0.22, y);
      g.closePath();
      g.fill();
      g.fillStyle = dye;
      g.beginPath();
      g.ellipse(x, y - u * 0.36, u * 0.26, u * 0.08, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = over(dye, c.sunColor, c.sunAlpha * 1.6);
      g.beginPath();
      g.ellipse(x - u * 0.08, y - u * 0.37, u * 0.08, u * 0.03, 0, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case "kite": {
      // A frame, a sail, a spool. Symmetry you can hold.
      if (i % 3 === 2) {
        g.fillStyle = M["walnut-600"];
        g.fillRect(x - u * 0.05, y - u * 0.3, u * 0.1, u * 0.3);
        g.strokeStyle = M["bone-100"];
        g.lineWidth = Math.max(1.5, u * 0.06);
        g.beginPath();
        g.ellipse(x, y - u * 0.18, u * 0.11, u * 0.09, 0, 0, Math.PI * 2);
        g.stroke();
      } else {
        const sail = [M["saffron-400"], M["turquoise-500"]][i % 2]!;
        g.save();
        g.translate(x, y - u * 0.3);
        g.rotate(frand(seed) * 0.5 - 0.25);
        g.fillStyle = sail;
        g.beginPath();
        g.moveTo(0, -u * 0.3);
        g.lineTo(u * 0.2, 0);
        g.lineTo(0, u * 0.3);
        g.lineTo(-u * 0.2, 0);
        g.closePath();
        g.fill();
        g.strokeStyle = M["walnut-600"];
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(0, -u * 0.3);
        g.lineTo(0, u * 0.3);
        g.moveTo(-u * 0.2, 0);
        g.lineTo(u * 0.2, 0);
        g.stroke();
        g.restore();
      }
      break;
    }
    case "gears": {
      // Gear blanks and a coiled spring. Factors, in brass.
      const f = facet(M["brass-400"], c);
      const teeth = [8, 12, 15, 20][i % 4]!;
      g.fillStyle = f.body;
      const r = u * 0.24;
      g.beginPath();
      for (let k = 0; k < teeth; k++) {
        const a0 = (k / teeth) * Math.PI * 2;
        const a1 = ((k + 0.5) / teeth) * Math.PI * 2;
        g.lineTo(x + r * Math.cos(a0), y - u * 0.26 + r * Math.sin(a0));
        g.lineTo(x + r * 1.16 * Math.cos(a1), y - u * 0.26 + r * 1.16 * Math.sin(a1));
      }
      g.closePath();
      g.fill();
      g.fillStyle = f.cut;
      g.beginPath();
      g.arc(x, y - u * 0.26, r * 0.24, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case "mill": {
      // Sacks and a measure. Division, and what is left over.
      const f = facet(M["bone-100"], c);
      g.fillStyle = f.body;
      g.beginPath();
      g.moveTo(x - u * 0.2, y);
      g.quadraticCurveTo(x - u * 0.26, y - u * 0.34, x - u * 0.08, y - u * 0.42);
      g.quadraticCurveTo(x, y - u * 0.5, x + u * 0.08, y - u * 0.42);
      g.quadraticCurveTo(x + u * 0.26, y - u * 0.34, x + u * 0.2, y);
      g.closePath();
      g.fill();
      g.fillStyle = f.face;
      g.beginPath();
      g.moveTo(x - u * 0.08, y - u * 0.42);
      g.quadraticCurveTo(x, y - u * 0.5, x + u * 0.08, y - u * 0.42);
      g.quadraticCurveTo(x, y - u * 0.38, x - u * 0.08, y - u * 0.42);
      g.closePath();
      g.fill();
      g.strokeStyle = f.cut;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x - u * 0.14, y - u * 0.18);
      g.lineTo(x + u * 0.14, y - u * 0.18);
      g.stroke();
      break;
    }
  }
}

/**
 * §8.5 — each game is endless, and the stall shows it. Depth is physical
 * accretion at the stall itself: your tesserae set into the floor, your rope
 * coiled higher, your gear train grown another stage. Never a number, never a
 * percentage, never regressing.
 */
function drawAccretion(
  g: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  w: number,
  u: number,
  craft: Craft,
  a: number,
  seed: number,
  c: GoodsCtx,
): void {
  const n = Math.round(a * 14);
  for (let i = 0; i < n; i++) {
    const s = mixSeed(seed ^ 0x7f, i);
    const px = x + w * (0.06 + frand(s) * 0.88);
    const py = baseY + u * 0.5 + frand(mixSeed(s, 1)) * u * 0.35;
    switch (craft) {
      case "tessera": {
        const glaze = [M["turquoise-500"], M["lapis-700"], M["saffron-400"]][i % 3]!;
        g.fillStyle = glaze;
        g.fillRect(px - u * 0.09, py, u * 0.18, u * 0.11);
        g.strokeStyle = c.sem.cut;
        g.lineWidth = 1;
        g.strokeRect(px - u * 0.09, py, u * 0.18, u * 0.11);
        break;
      }
      case "rope": {
        g.strokeStyle = M["bone-100"];
        g.lineWidth = Math.max(1, u * 0.05);
        g.beginPath();
        g.ellipse(px, py, u * 0.13, u * 0.05, 0, 0, Math.PI * 2);
        g.stroke();
        break;
      }
      default: {
        g.fillStyle = over(c.sem.metal, c.sem.ground, 0.2);
        g.beginPath();
        g.arc(px, py, u * 0.05, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
}
