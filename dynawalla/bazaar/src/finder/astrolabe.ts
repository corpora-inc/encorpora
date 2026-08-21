/**
 * The finder is an instrument.
 *
 * The astrolabe's **rete** is literally an index of positions, so search here
 * is not a text field and a results list — it is the instrument used correctly.
 * Rotate the rete: each star-pointer indexes a ward. The alidade indexes a
 * quarter within it. Release, and the street flies there on a carpet.
 *
 * BZ-LAW-17 — there is no grid view, no "all games", no search box, no filter
 * chips. A grid of every game is precisely "a list that ended".
 *
 * Reachable and operable from the keyboard as a `slider`, with a visible focus
 * ring, because a power tool nobody can reach is not a power tool.
 */

import { alpha } from "../util/color.ts";
import { MATERIALS, type Semantic } from "../tokens/palette.ts";
import type { Ambient } from "../world/daylight.ts";

const TAU = Math.PI * 2;

export function drawAstrolabe(
  g: CanvasRenderingContext2D,
  size: number,
  angle: number,
  wards: number,
  sem: Semantic,
  am: Ambient,
  active: boolean,
): void {
  const r = size / 2 - 2;
  const cx = size / 2;
  const cy = size / 2;
  g.clearRect(0, 0, size, size);

  // Mater and limb: the body, and the graduated rim it is read against.
  g.fillStyle = sem.metalShade;
  g.beginPath();
  g.arc(cx, cy, r, 0, TAU);
  g.fill();
  g.fillStyle = sem.metal;
  g.beginPath();
  g.arc(cx, cy, r * 0.92, 0, TAU);
  g.fill();
  g.strokeStyle = alpha(sem.cut, 0.8);
  g.lineWidth = 1;
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * TAU;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92);
    g.lineTo(cx + Math.cos(a) * r * (i % 3 === 0 ? 0.8 : 0.86), cy + Math.sin(a) * r * (i % 3 === 0 ? 0.8 : 0.86));
    g.stroke();
  }

  // Tympan: the almucantars, the stereographic net you read a position on.
  g.strokeStyle = alpha(sem.metalShade, 0.85);
  for (let i = 1; i <= 4; i++) {
    g.beginPath();
    g.arc(cx, cy - r * 0.06 * i, r * 0.72 - r * 0.14 * i, 0, TAU);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(cx - r * 0.8, cy);
  g.lineTo(cx + r * 0.8, cy);
  g.moveTo(cx, cy - r * 0.8);
  g.lineTo(cx, cy + r * 0.8);
  g.stroke();

  // Rete: the pierced index. One star-pointer per ward.
  g.save();
  g.translate(cx, cy);
  g.rotate(angle);
  g.strokeStyle = sem.metalLit;
  g.lineWidth = Math.max(1.5, size * 0.018);
  g.beginPath();
  g.arc(0, 0, r * 0.56, 0, TAU);
  g.stroke();
  for (let i = 0; i < wards; i++) {
    const a = (i / wards) * TAU;
    const px = Math.cos(a) * r * 0.74;
    const py = Math.sin(a) * r * 0.74;
    g.beginPath();
    g.moveTo(Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4);
    g.lineTo(px, py);
    g.stroke();
    g.fillStyle = MATERIALS["glass-clear"];
    g.beginPath();
    for (let k = 0; k < 8; k++) {
      const sa = a + (k / 8) * TAU;
      const rr = k % 2 === 0 ? size * 0.05 : size * 0.02;
      const x = px + Math.cos(sa) * rr;
      const y = py + Math.sin(sa) * rr;
      if (k === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
    g.fill();
  }
  g.restore();

  // Alidade: the sight bar across the face.
  g.save();
  g.translate(cx, cy);
  g.rotate(angle * 2.4);
  g.strokeStyle = sem.litEdge;
  g.lineWidth = Math.max(2, size * 0.025);
  g.beginPath();
  g.moveTo(-r * 0.86, 0);
  g.lineTo(r * 0.86, 0);
  g.stroke();
  g.fillStyle = sem.metal;
  for (const sx of [-r * 0.7, r * 0.7]) {
    g.fillRect(sx - size * 0.02, -size * 0.05, size * 0.04, size * 0.1);
  }
  g.restore();

  // Pin.
  g.fillStyle = sem.metalShade;
  g.beginPath();
  g.arc(cx, cy, size * 0.035, 0, TAU);
  g.fill();

  if (active) {
    g.strokeStyle = sem.focus;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, r + 1, 0, TAU);
    g.stroke();
  }
  void am;
}
