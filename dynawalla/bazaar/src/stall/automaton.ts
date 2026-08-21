/**
 * The shopkeeper automaton.
 *
 * Brass, faceless, one moving part, standing at the left jamb. It performs the
 * **mechanism of its own mathematics**: the tilers' automaton lays a tessera
 * every 4.2 s; the clockmakers' turns a two-ratio gear train; the weighers'
 * tips a balance beam. al-Jazari, not a mascot.
 *
 * No face. This avoids the uncanny-mascot failure and the figurative-
 * representation question in one move, and it is also what al-Jazari's own
 * drawings look like: a mechanism with a suggested head and a job to do.
 *
 * It turns to look at where you touched — once, 420 ms, then back to idle. It
 * grants nothing for it (BZ-LAW-12).
 */

import { idle, clamp, lerp } from "../util/rng.ts";
import { over } from "../util/color.ts";
import { gearTrain, drawGear } from "../geometry/gears.ts";
import type { Semantic } from "../tokens/palette.ts";
import type { Craft } from "../types.ts";

export interface AutomatonCtx {
  sem: Semantic;
  sunColor: string;
  sunAlpha: number;
  shadowAlpha: number;
  reduced: boolean;
}

/**
 * `look` is −1…1: which way the head is turned. `attention` decays 1→0 over
 * 420 ms after a touch.
 */
export function drawAutomaton(
  g: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  h: number,
  craft: Craft,
  seed: number,
  t: number,
  c: AutomatonCtx,
  look: number,
  attention: number,
): void {
  const metal = c.sem.metal;
  const face = over(metal, c.sunColor, c.sunAlpha * 1.3);
  const cut = over(metal, c.sem.shadow, c.shadowAlpha * 1.4);
  const w = h * 0.34;
  const top = baseY - h;
  const breathe = c.reduced ? 0 : idle(t, seed, h * 0.006);

  g.save();
  g.translate(x, breathe);

  // Plinth.
  g.fillStyle = cut;
  g.fillRect(-w * 0.62, baseY - h * 0.05, w * 1.24, h * 0.05);
  g.fillStyle = face;
  g.fillRect(-w * 0.62, baseY - h * 0.06, w * 1.24, h * 0.012);

  // Column body, three facets, with a visible escapement window.
  g.fillStyle = metal;
  g.beginPath();
  g.moveTo(-w * 0.42, baseY - h * 0.05);
  g.lineTo(-w * 0.3, top + h * 0.26);
  g.lineTo(w * 0.3, top + h * 0.26);
  g.lineTo(w * 0.42, baseY - h * 0.05);
  g.closePath();
  g.fill();
  g.fillStyle = face;
  g.beginPath();
  g.moveTo(-w * 0.42, baseY - h * 0.05);
  g.lineTo(-w * 0.3, top + h * 0.26);
  g.lineTo(-w * 0.12, top + h * 0.26);
  g.lineTo(-w * 0.2, baseY - h * 0.05);
  g.closePath();
  g.fill();

  // The window into the works: a small escapement wheel, always turning.
  const wx = w * 0.06;
  const wy = baseY - h * 0.42;
  g.fillStyle = cut;
  g.beginPath();
  g.arc(wx, wy, h * 0.09, 0, Math.PI * 2);
  g.fill();
  const esc = gearTrain(
    { spec: [{ teeth: 12 }, { teeth: 9, bearing: 200 }], module: h * 0.012, origin: { x: wx, y: wy }, omega: 0.7 },
    c.reduced ? 0 : t,
  );
  for (const gear of esc) {
    drawGear(g, gear, { metal: face, metalShade: metal, litEdge: c.sem.litEdge, cut });
  }

  // Head: a brass drum with a lamp slit. It turns to look, and it has no face.
  const turn = lerp(0, look * 0.5, clamp(attention, 0, 1));
  g.save();
  g.translate(0, top + h * 0.14);
  g.rotate(turn * 0.35);
  g.fillStyle = metal;
  g.beginPath();
  g.ellipse(0, 0, w * 0.3, h * 0.13, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = face;
  g.beginPath();
  g.ellipse(-w * 0.08, -h * 0.02, w * 0.16, h * 0.08, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = cut;
  g.fillRect(-w * 0.22 + turn * w * 0.2, -h * 0.02, w * 0.44, h * 0.018);
  // A little finial, because everything here has one.
  g.strokeStyle = metal;
  g.lineWidth = Math.max(1.2, h * 0.014);
  g.beginPath();
  g.moveTo(0, -h * 0.13);
  g.lineTo(0, -h * 0.2);
  g.stroke();
  g.restore();

  drawTool(g, w, h, top, baseY, craft, t, c, metal, face, cut);
  g.restore();
}

/** The one moving part, and it does the quarter's own mathematics. */
function drawTool(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  top: number,
  baseY: number,
  craft: Craft,
  t: number,
  c: AutomatonCtx,
  metal: string,
  face: string,
  cut: string,
): void {
  const armY = top + h * 0.34;
  const tt = c.reduced ? 0 : t;
  g.strokeStyle = metal;
  g.lineWidth = Math.max(1.5, h * 0.03);
  g.lineCap = "round";

  switch (craft) {
    case "balance": {
      // A beam that tips towards equality and settles.
      const tip = Math.sin(tt * 0.8) * 0.22 * Math.exp(-((tt * 0.8) % 6.28) * 0.12);
      g.save();
      g.translate(w * 0.55, armY);
      g.rotate(tip);
      g.beginPath();
      g.moveTo(-w * 0.5, 0);
      g.lineTo(w * 0.5, 0);
      g.stroke();
      g.fillStyle = face;
      for (const px of [-w * 0.5, w * 0.5]) {
        g.beginPath();
        g.moveTo(px - w * 0.16, h * 0.04);
        g.lineTo(px + w * 0.16, h * 0.04);
        g.lineTo(px + w * 0.1, h * 0.13);
        g.lineTo(px - w * 0.1, h * 0.13);
        g.closePath();
        g.fill();
      }
      g.restore();
      break;
    }
    case "coin": {
      // A coin flipped from the fingertip and caught. Every 2.4 s.
      const u = (tt % 2.4) / 2.4;
      const fly = Math.sin(u * Math.PI);
      g.beginPath();
      g.moveTo(w * 0.3, armY);
      g.lineTo(w * 0.72, armY + h * 0.04);
      g.stroke();
      g.fillStyle = face;
      g.beginPath();
      g.ellipse(w * 0.75, armY - fly * h * 0.3, h * 0.045, h * 0.045 * Math.abs(Math.cos(u * 9)), 0, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case "tessera": {
      // Lays a tessera every 4.2 s, and the row it has laid stays.
      const u = (tt % 4.2) / 4.2;
      const reach = Math.sin(Math.min(1, u * 1.6) * Math.PI);
      g.beginPath();
      g.moveTo(w * 0.3, armY);
      g.lineTo(w * 0.5 + reach * w * 0.5, armY + h * 0.12 + reach * h * 0.1);
      g.stroke();
      g.fillStyle = "#17868c";
      const laid = Math.floor((tt / 4.2) % 6);
      for (let i = 0; i <= laid; i++) {
        g.fillRect(w * 0.55 + i * h * 0.07, baseY - h * 0.1, h * 0.06, h * 0.06);
      }
      g.fillStyle = face;
      g.fillRect(w * 0.5 + reach * w * 0.5 - h * 0.03, armY + h * 0.12 + reach * h * 0.1, h * 0.06, h * 0.05);
      break;
    }
    case "rope": {
      // Winds a coil; the coil grows and resets.
      const spin = tt * 2.2;
      g.beginPath();
      g.moveTo(w * 0.3, armY);
      g.lineTo(w * 0.66, armY + h * 0.06);
      g.stroke();
      g.strokeStyle = "#e6dcc4";
      g.lineWidth = Math.max(1.2, h * 0.02);
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.ellipse(
          w * 0.7,
          armY + h * 0.1 + i * h * 0.03,
          h * 0.09,
          h * 0.035,
          Math.sin(spin + i) * 0.2,
          0,
          Math.PI * 2,
        );
        g.stroke();
      }
      break;
    }
    case "astrolabe": {
      // Rotates a rete against a graduated limb.
      const a = tt * 0.5;
      g.beginPath();
      g.moveTo(w * 0.3, armY);
      g.lineTo(w * 0.62, armY);
      g.stroke();
      const cx = w * 0.78;
      const cy = armY;
      g.fillStyle = metal;
      g.beginPath();
      g.arc(cx, cy, h * 0.12, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = face;
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(cx, cy, h * 0.085, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * h * 0.11, cy + Math.sin(a) * h * 0.11);
      g.lineTo(cx - Math.cos(a) * h * 0.11, cy - Math.sin(a) * h * 0.11);
      g.stroke();
      break;
    }
    case "water": {
      // A scoop wheel. Water in, water out, at a rate.
      const a = tt * 1.1;
      const cx = w * 0.74;
      const cy = armY + h * 0.08;
      g.strokeStyle = metal;
      g.lineWidth = Math.max(1.2, h * 0.022);
      g.beginPath();
      g.arc(cx, cy, h * 0.15, 0, Math.PI * 2);
      g.stroke();
      for (let i = 0; i < 6; i++) {
        const k = a + (i * Math.PI) / 3;
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx + Math.cos(k) * h * 0.15, cy + Math.sin(k) * h * 0.15);
        g.stroke();
        g.fillStyle = i % 2 ? face : "#4e8fa0";
        g.beginPath();
        g.arc(cx + Math.cos(k) * h * 0.15, cy + Math.sin(k) * h * 0.15, h * 0.03, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case "vat": {
      // Dips a stirring stick; the colour on it deepens and clears.
      const dip = (Math.sin(tt * 0.9) + 1) / 2;
      g.beginPath();
      g.moveTo(w * 0.3, armY);
      g.lineTo(w * 0.68, armY + h * 0.05 + dip * h * 0.12);
      g.stroke();
      g.fillStyle = "#23356b";
      g.beginPath();
      g.ellipse(w * 0.78, baseY - h * 0.12, h * 0.11, h * 0.04, 0, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case "kite": {
      // Raises a kite frame into the draught and lowers it.
      const rise = (Math.sin(tt * 0.6) + 1) / 2;
      g.beginPath();
      g.moveTo(w * 0.3, armY);
      g.lineTo(w * 0.6, armY - rise * h * 0.16);
      g.stroke();
      g.save();
      g.translate(w * 0.78, armY - h * 0.1 - rise * h * 0.3);
      g.rotate(Math.sin(tt) * 0.2);
      g.fillStyle = "#e8b93f";
      g.beginPath();
      g.moveTo(0, -h * 0.12);
      g.lineTo(h * 0.08, 0);
      g.lineTo(0, h * 0.12);
      g.lineTo(-h * 0.08, 0);
      g.closePath();
      g.fill();
      g.restore();
      break;
    }
    case "gears": {
      // A real two-ratio train. Its teeth and its speeds agree (BZ-LAW-11).
      const gears = gearTrain(
        {
          spec: [{ teeth: 24 }, { teeth: 18, bearing: -20 }, { teeth: 12, bearing: 40 }],
          module: h * 0.014,
          origin: { x: w * 0.72, y: armY + h * 0.05 },
          omega: 0.5,
        },
        tt,
      );
      for (const gear of gears) {
        drawGear(g, gear, { metal: face, metalShade: metal, litEdge: c.sem.litEdge, cut });
      }
      break;
    }
    case "mill": {
      // Turns a quern, and grain falls through.
      const a = tt * 1.4;
      const cx = w * 0.74;
      const cy = armY + h * 0.14;
      g.fillStyle = "#b99c6e";
      g.beginPath();
      g.ellipse(cx, cy, h * 0.16, h * 0.06, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = cut;
      g.lineWidth = 1.2;
      for (let i = 0; i < 6; i++) {
        const k = a + (i * Math.PI) / 3;
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx + Math.cos(k) * h * 0.16, cy + Math.sin(k) * h * 0.06);
        g.stroke();
      }
      g.fillStyle = face;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * h * 0.14, cy + Math.sin(a) * h * 0.05);
      g.lineTo(cx + Math.cos(a) * h * 0.14, cy + Math.sin(a) * h * 0.05 - h * 0.1);
      g.stroke();
      break;
    }
  }
}
