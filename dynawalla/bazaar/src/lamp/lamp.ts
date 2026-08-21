/**
 * The Lamplighter's Lamp — a pierced-brass hanging lantern with coloured glass.
 *
 * It reads at a glance on **four independent carriers**, three of which are not
 * colour, because a design that says "the amber one means you are nearly out"
 * has told a colour-blind child nothing:
 *
 *   1. oil level     a vertical position in a glass window   — POSITION
 *   2. flame         absent by day, lit at dusk               — SHAPE
 *   3. gnomon shadow a brass pointer across an engraved arc   — ROTATION
 *   4. glass warmth  clear → amber → deep amber               — colour, last
 *
 * The subscriber's lamp is a *different lamp*: pierced brass with coloured
 * glass instead of plain, full and lit at all times. Not "a restriction
 * removed" — a second, better time of day opened.
 */

import { alpha, over } from "../util/color.ts";
import { idle } from "../util/rng.ts";
import { archPath } from "../geometry/arch.ts";
import { MATERIALS, type Semantic } from "../tokens/palette.ts";
import type { Ambient } from "../world/daylight.ts";
import type { LampReading } from "./state.ts";

export interface LampDraw {
  sem: Semantic;
  am: Ambient;
  reading: LampReading;
  subscribed: boolean;
  reduced: boolean;
  t: number;
}

export function drawLamp(g: CanvasRenderingContext2D, w: number, h: number, o: LampDraw): void {
  const { sem, am, reading } = o;
  const cx = w / 2;
  const metal = sem.metal;
  const metalShade = sem.metalShade;
  const lit = sem.litEdge;

  g.clearRect(0, 0, w, h);

  // The chain from the canopy, and the smallest possible swing.
  const swing = o.reduced ? 0 : idle(o.t / 2.4, 991, 0.9) * (Math.PI / 180);
  g.strokeStyle = metalShade;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(cx, 0);
  g.lineTo(cx + Math.sin(swing) * h * 0.2, h * 0.16);
  g.stroke();

  g.save();
  g.translate(cx + Math.sin(swing) * h * 0.2, h * 0.16);
  g.rotate(swing);

  const bw = w * 0.62;
  const bh = h * 0.46;

  // Crown.
  g.fillStyle = metal;
  g.beginPath();
  g.moveTo(-bw * 0.2, 0);
  g.lineTo(bw * 0.2, 0);
  g.lineTo(bw * 0.42, bh * 0.16);
  g.lineTo(-bw * 0.42, bh * 0.16);
  g.closePath();
  g.fill();

  // The glass body, in an arched brass frame. Warmth is the fourth carrier.
  const warm = 1 - reading.oil;
  const glassBase = o.subscribed ? MATERIALS["glass-amber"] : MATERIALS["glass-clear"];
  // Warmth is the FOURTH carrier and the least load-bearing: clear → amber →
  // deep amber, never a red alarm. Nothing in the lamp is ever alarming.
  const glass = over(glassBase, MATERIALS["glass-amber"], warm * 0.7);
  const bodyTop = bh * 0.16;
  const bodyH = bh * 0.82;

  g.save();
  g.beginPath();
  g.moveTo(-bw * 0.4, bodyTop + bodyH);
  g.lineTo(-bw * 0.4, bodyTop + bodyH * 0.42);
  archPath(g, 0, bodyTop + bodyH * 0.42, bw * 0.8, "drop");
  g.lineTo(bw * 0.4, bodyTop + bodyH);
  g.closePath();
  g.clip();

  g.fillStyle = over(glass, sem.ground, 0.45);
  g.fillRect(-bw / 2, bodyTop, bw, bodyH);

  // 1 — OIL. A level in a glass window; it falls, and position is the carrier.
  const oilTop = bodyTop + bodyH * (0.12 + 0.8 * (1 - reading.oil));
  g.fillStyle = over(glass, MATERIALS["glass-amber"], 0.6);
  g.fillRect(-bw / 2, oilTop, bw, bodyTop + bodyH - oilTop);
  g.fillStyle = alpha(lit, 0.6);
  g.fillRect(-bw / 2, oilTop, bw, 1.5);

  // 2 — FLAME. Absent by day; lit at dusk. A shape, present or not.
  if (reading.lit) {
    const flick = o.reduced ? 1 : 1 + idle(o.t, 71, 0.05);
    g.fillStyle = alpha("#fff3d6", 0.95);
    g.beginPath();
    g.ellipse(0, oilTop - bodyH * 0.1 * flick, bw * 0.08, bodyH * 0.14 * flick, 0, 0, Math.PI * 2);
    g.fill();
    g.save();
    g.globalCompositeOperation = "lighter";
    g.fillStyle = alpha(MATERIALS["lantern"], 0.35);
    g.beginPath();
    g.arc(0, oilTop - bodyH * 0.1, bw * 0.4, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  g.restore();

  // Pierced brass strapping over the glass — the piercing is the lamp.
  g.strokeStyle = metal;
  g.lineWidth = Math.max(2, w * 0.035);
  g.beginPath();
  g.moveTo(-bw * 0.4, bodyTop + bodyH);
  g.lineTo(-bw * 0.4, bodyTop + bodyH * 0.42);
  archPath(g, 0, bodyTop + bodyH * 0.42, bw * 0.8, "drop");
  g.lineTo(bw * 0.4, bodyTop + bodyH);
  g.stroke();
  g.lineWidth = 1.4;
  g.beginPath();
  for (let i = 1; i < 5; i++) {
    const y = bodyTop + (bodyH * i) / 5;
    g.moveTo(-bw * 0.4, y);
    g.lineTo(bw * 0.4, y);
  }
  for (const x of [-bw * 0.16, bw * 0.16]) {
    g.moveTo(x, bodyTop + bodyH * 0.1);
    g.lineTo(x, bodyTop + bodyH);
  }
  g.stroke();

  // The subscriber's lamp has coloured glass set into the piercing.
  if (o.subscribed) {
    const cols = [MATERIALS["glass-ruby"], MATERIALS["glass-emerald"], MATERIALS["glass-cobalt"]];
    for (let i = 0; i < 3; i++) {
      g.fillStyle = alpha(cols[i]!, 0.75);
      g.beginPath();
      g.arc(-bw * 0.16 + i * bw * 0.16, bodyTop + bodyH * 0.62, bw * 0.055, 0, Math.PI * 2);
      g.fill();
    }
  }

  // The base, with 3 — the GNOMON and its engraved arc. Rotation, and it is
  // the fastest of the four to read.
  const baseY = bodyTop + bodyH + bh * 0.04;
  g.fillStyle = metal;
  g.fillRect(-bw * 0.46, baseY, bw * 0.92, bh * 0.09);
  g.fillStyle = lit;
  g.fillRect(-bw * 0.46, baseY, bw * 0.92, 1);

  const arcY = baseY + bh * 0.09;
  const arcR = bw * 0.42;
  g.strokeStyle = metalShade;
  g.lineWidth = 1.2;
  g.beginPath();
  g.arc(0, arcY, arcR, Math.PI, Math.PI * 2);
  g.stroke();
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI + (Math.PI * i) / 6;
    g.beginPath();
    g.moveTo(Math.cos(a) * arcR * 0.86, arcY + Math.sin(a) * arcR * 0.86);
    g.lineTo(Math.cos(a) * arcR, arcY + Math.sin(a) * arcR);
    g.stroke();
  }
  // The pointer, and the shadow it throws across the graduations.
  const ga = Math.PI + (reading.gnomon * Math.PI) / 180 / (150 / 180);
  g.strokeStyle = alpha(sem.shadow, 0.75);
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, arcY);
  g.lineTo(Math.cos(ga) * arcR * 0.92, arcY + Math.sin(ga) * arcR * 0.92);
  g.stroke();
  g.strokeStyle = metal;
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(0, arcY);
  g.lineTo(0, arcY - bh * 0.14);
  g.stroke();
  g.fillStyle = metal;
  g.beginPath();
  g.arc(0, arcY, 2.5, 0, Math.PI * 2);
  g.fill();

  g.restore();
  void am;
}

/**
 * The lamplighter automaton, standing beside the unlit lamp holding a taper.
 * **This is the entire monetisation surface in the bazaar.** One object, never
 * modal, never animated to attract attention, never during play, and it is
 * simply always there — it does not appear because the day ended.
 */
export function drawLamplighter(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  sem: Semantic,
  am: Ambient,
  reduced: boolean,
  t: number,
): void {
  g.clearRect(0, 0, w, h);
  const metal = sem.metal;
  const face = over(metal, am.sunColor, am.sunAlpha * 1.2);
  const cut = over(metal, sem.shadow, am.shadowAlpha * 1.3);
  const cx = w / 2;
  const base = h;
  const bh = h * 0.86;
  const bw = w * 0.5;

  // Plinth, column, head — the same automaton vocabulary as a shopkeeper.
  g.fillStyle = cut;
  g.fillRect(cx - bw * 0.6, base - h * 0.05, bw * 1.2, h * 0.05);
  g.fillStyle = metal;
  g.beginPath();
  g.moveTo(cx - bw * 0.42, base - h * 0.05);
  g.lineTo(cx - bw * 0.3, base - bh * 0.72);
  g.lineTo(cx + bw * 0.3, base - bh * 0.72);
  g.lineTo(cx + bw * 0.42, base - h * 0.05);
  g.closePath();
  g.fill();
  g.fillStyle = face;
  g.beginPath();
  g.moveTo(cx - bw * 0.42, base - h * 0.05);
  g.lineTo(cx - bw * 0.3, base - bh * 0.72);
  g.lineTo(cx - bw * 0.12, base - bh * 0.72);
  g.lineTo(cx - bw * 0.2, base - h * 0.05);
  g.closePath();
  g.fill();
  g.fillStyle = metal;
  g.beginPath();
  g.ellipse(cx, base - bh * 0.82, bw * 0.3, h * 0.09, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = cut;
  g.fillRect(cx - bw * 0.22, base - bh * 0.83, bw * 0.44, 2);

  // The taper it holds. It is alight, because a lamplighter's taper is.
  g.strokeStyle = metal;
  g.lineWidth = Math.max(2, w * 0.05);
  g.beginPath();
  g.moveTo(cx + bw * 0.28, base - bh * 0.6);
  g.lineTo(cx + bw * 0.72, base - bh * 0.84);
  g.stroke();
  const flick = reduced ? 1 : 1 + idle(t, 313, 0.06);
  g.fillStyle = alpha("#fff3d6", 0.95);
  g.beginPath();
  g.ellipse(cx + bw * 0.76, base - bh * 0.9, w * 0.035, h * 0.035 * flick, 0, 0, Math.PI * 2);
  g.fill();
  g.save();
  g.globalCompositeOperation = "lighter";
  g.fillStyle = alpha(MATERIALS["lantern"], 0.22);
  g.beginPath();
  g.arc(cx + bw * 0.76, base - bh * 0.9, w * 0.24, 0, Math.PI * 2);
  g.fill();
  g.restore();
}
