/**
 * The husks: rotating octahedral cells with a numeral burning inside.
 *
 * Every candidate looks *identical* — same colour, same size, same motion.
 * There is no tell but the arithmetic. The only husk that ever looks different
 * is one the player already shot by mistake, and that one changes silhouette
 * (it grows spikes), motion (it dives) and colour together, so the mark is
 * never colour alone.
 */

import { project } from "../core/camera.ts";
import { GATE_Y, HUSK_R } from "../core/config.ts";
import { C, rgba } from "../core/palette.ts";
import { drawGlow, drawGlyph, getGlyph } from "../render/bake.ts";
import { clamp, ease } from "../render/draw.ts";
import { MEMBRANE } from "../render/ink.ts";
import { Mode, type Husk, type World } from "./world.ts";

const VERTS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 0],
  [0, 0, 1],
  [-1, 0, 0],
  [0, 0, -1],
  [0, 1.18, 0],
  [0, -1.18, 0],
];

const EDGES: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 0],
  [4, 1],
  [4, 2],
  [4, 3],
  [5, 0],
  [5, 1],
  [5, 2],
  [5, 3],
];

const sx = new Float32Array(6);
const sy = new Float32Array(6);
const ss = new Float32Array(6);

export function resetHusk(h: Husk): void {
  h.active = true;
  h.hostile = false;
  h.hp = 1;
  h.hitFlash = 0;
  h.squash = 0;
  h.age = 0;
  h.dieT = 0;
  h.shroud = 0;
  h.fireCd = 2.5;
  h.vx = 0;
  h.vy = 0;
  h.vz = 0;
  h.z = 0;
  h.radius = HUSK_R;
  h.mode = Mode.Entering;
}

export function updateHusk(world: World, h: Husk, dt: number): void {
  h.age += dt;
  h.spin += h.spinV * dt;
  h.tilt += h.tiltV * dt;
  h.hitFlash = Math.max(0, h.hitFlash - dt * 5.5);
  h.squash += (0 - h.squash) * Math.min(1, dt * 11);
  h.wob += dt;

  switch (h.mode) {
    case Mode.Entering: {
      // A spring out of the equation into formation. Slightly underdamped, so
      // the husks arrive with a flick rather than sliding to a stop.
      const targetX = h.lane + world.swingPhaseX;
      const targetY = world.formationY + h.row;
      h.vx += (targetX - h.x) * 46 * dt;
      h.vy += (targetY - h.y) * 46 * dt;
      h.vz += (0 - h.z) * 30 * dt;
      const d = Math.exp(-7.5 * dt);
      h.vx *= d;
      h.vy *= d;
      h.vz *= d;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.z += h.vz * dt;
      if (h.age > 0.62) {
        h.mode = Mode.Formation;
        h.z = 0;
      }
      break;
    }
    case Mode.Formation: {
      h.x = h.lane + world.swingPhaseX + Math.sin(h.wob * 1.7 + h.lane) * 1.7;
      h.y = world.formationY + h.row + Math.sin(h.wob * 2.3 + h.row) * 0.9;
      h.z = Math.sin(h.wob * 0.9 + h.lane * 0.1) * 5;
      if (h.shroud > 0) {
        // The shell cracks open as it descends — the closer it gets, the more
        // the player can read, which is the pressure.
        const openAt = GATE_Y + 96;
        if (h.y < openAt) h.shroud = Math.max(0, h.shroud - dt * 1.6);
      }
      break;
    }
    case Mode.Drift: {
      h.y -= 11 * dt;
      h.x = h.lane + Math.sin(h.wob * 0.8) * 4;
      h.z = Math.sin(h.wob * 0.5) * 18;
      break;
    }
    case Mode.Orbit: {
      h.orbit += dt * 0.85;
      h.x = world.boss.x + Math.cos(h.orbit) * h.orbitR;
      h.y = world.boss.y + Math.sin(h.orbit) * h.orbitR * 0.44;
      h.z = Math.sin(h.orbit) * 26;
      break;
    }
    case Mode.Hostile: {
      // It wants the ship. It accelerates, it is bad at turning, and it is loud.
      const toShip = world.ship.x - h.x;
      h.vx += clamp(toShip, -60, 60) * 1.9 * dt;
      h.vx *= Math.exp(-1.1 * dt);
      h.vy -= (46 + world.wave * 1.4) * dt;
      h.vy = Math.max(h.vy, -(72 + world.wave * 2.6));
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.z += (0 - h.z) * Math.min(1, dt * 4);
      h.spin += dt * 5;
      if (world.wave >= 7) {
        h.fireCd -= dt;
        if (h.fireCd <= 0 && h.y > GATE_Y + 24) {
          h.fireCd = 1.5 + world.rng.range(0, 1.2);
          world.fireBolt(h.x, h.y - h.radius);
        }
      }
      break;
    }
    case Mode.Dying: {
      h.dieT += dt;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.vy -= 22 * dt;
      h.spin += dt * 9;
      if (h.dieT > 0.32) h.active = false;
      break;
    }
  }
}

/** Fake-3D wireframe + membrane + billboarded numeral. */
export function drawHusk(world: World, h: Husk): void {
  const { cam, batch, ctx } = world;
  const dying = h.mode === Mode.Dying;
  // `dieT` starts negative for the innocents caught in a shockwave — they hold
  // full size until the wave reaches them. Clamping is what keeps that from
  // inflating them instead.
  const collapse = dying ? ease.outCubic(clamp(h.dieT / 0.32, 0, 1)) : 0;
  const born = h.mode === Mode.Entering ? ease.outBack(clamp(h.age / 0.45, 0, 1)) : 1;
  const r = h.radius * born * (1 - collapse * 0.85) * (1 + h.squash * 0.55);
  const ry = r * (1 - h.squash * 0.75);
  if (r <= 0.2) return;

  const cos = Math.cos(h.spin);
  const sin = Math.sin(h.spin);
  const cosT = Math.cos(h.tilt);
  const sinT = Math.sin(h.tilt);

  for (let i = 0; i < 6; i++) {
    const v = VERTS[i];
    let vx = v[0] * r;
    const vyRaw = v[1] * ry;
    let vz = v[2] * r;
    // Rotate about Y, then about X.
    const rx = vx * cos - vz * sin;
    const rz = vx * sin + vz * cos;
    const vy = vyRaw * cosT - rz * sinT;
    vz = vyRaw * sinT + rz * cosT;
    vx = rx;
    const p = project(cam, h.x + vx, h.y + vy, h.z + vz);
    sx[i] = p.x;
    sy[i] = p.y;
    ss[i] = p.s;
  }

  const centre = project(cam, h.x, h.y, h.z);
  const cxp = centre.x;
  const cyp = centre.y;
  const scale = centre.s;

  const hostile = h.hostile;
  const edge = hostile ? C.hostile : C.cyan;
  const flash = h.hitFlash;
  const alpha = (1 - collapse) * (h.mode === Mode.Entering ? clamp(h.age / 0.18, 0, 1) : 1);

  // Membrane — a dark skin over the equator quad. It is not decoration: it
  // gives the numeral an opaque backing so a bright bloom behind the husk can
  // never wash the digit out.
  if (!dying) {
    ctx.beginPath();
    ctx.moveTo(sx[0], sy[0]);
    ctx.lineTo(sx[1], sy[1]);
    ctx.lineTo(sx[2], sy[2]);
    ctx.lineTo(sx[3], sy[3]);
    ctx.closePath();
    ctx.fillStyle = rgba(MEMBRANE, 0.72 * alpha);
    ctx.fill();
    if (world.quality > 0.7) {
      ctx.fillStyle = rgba(hostile ? C.hostileDeep : C.cyanDeep, (0.34 + flash * 0.4) * alpha);
      ctx.fill();
    }
  }

  const width = Math.max(0.9, 1.5 * scale * (1 + flash * 1.6));
  for (const e of EDGES) {
    batch.push(
      sx[e[0]],
      sy[e[0]],
      sx[e[1]],
      sy[e[1]],
      flash > 0.35 ? C.white : edge,
      width,
      alpha * (0.72 + flash * 0.28),
    );
  }

  if (hostile) {
    // Spikes: the silhouette changes, not just the colour.
    for (let i = 0; i < 4; i++) {
      const jitter = 1.55 + Math.sin(world.time * 22 + i) * 0.12;
      const px = cxp + (sx[i] - cxp) * jitter;
      const py = cyp + (sy[i] - cyp) * jitter;
      batch.push(sx[i], sy[i], px, py, C.hostile, width * 1.1, alpha);
    }
  }

  ctx.globalCompositeOperation = "lighter";
  drawGlow(ctx, hostile ? C.hostile : C.cyan, cxp, cyp, r * scale * 2.2, (0.1 + flash * 0.45) * alpha);
  if (flash > 0.02) drawGlow(ctx, C.white, cxp, cyp, r * scale * 1.9 * flash, flash * 0.45);
  ctx.globalCompositeOperation = "source-over";

  if (!dying) {
    const shut = h.shroud > 0;
    if (shut) {
      // A shut shell: a second skin inside the cell, and the numeral behind it
      // churning through digits. It is unreadable on purpose and it *looks*
      // unreadable — a dim digit alone would just look like a dim digit.
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        const mx = cxp + (sx[i] - cxp) * 0.62;
        const my = cyp + (sy[i] - cyp) * 0.62;
        const nx = cxp + (sx[j] - cxp) * 0.62;
        const ny = cyp + (sy[j] - cyp) * 0.62;
        batch.push(mx, my, nx, ny, C.cyan, width * 0.8, alpha * 0.65);
      }
    }
    const label = shut ? scrambled(world, h) : h.label;
    const glyph = getGlyph(label, hostile ? C.hostile : C.cyan, 800);
    // Fit a three-digit answer inside the cell instead of letting it spill.
    //
    // The drawn ink is `(inkW + 2 × rimW) × size / 92` now that a numeral
    // carries a counter-ink rim, and the budget counts the rim. It moved from
    // 1.55 half-widths to 1.7 for exactly that reason: the LETTERFORMS come out
    // the size they always were — 1.55/110 and 1.7/120.6 agree to four decimal
    // places on a two-digit label — and the extra 0.15 is the ring around them.
    // Shrinking the digits to make room for the thing that was added to make
    // them legible would have been a strange way to answer the brief.
    const maxInk = r * scale * (shut ? 1.1 : 1.7);
    const ink = glyph.inkW + glyph.rimW * 2;
    const size = Math.min(r * scale * (shut ? 0.9 : 1.5), (maxInk * 92) / ink);
    drawGlyph(ctx, glyph, cxp, cyp, size, alpha * (shut ? 0.32 : 1));
  }
}

const DIGITS = "0123456789";
function scrambled(world: World, h: Husk): string {
  const n = Math.max(1, h.label.length);
  const tick = Math.floor(world.time * 14 + h.lane);
  let out = "";
  for (let i = 0; i < n; i++) out += DIGITS[(tick * 7 + i * 3) % 10];
  return out;
}
