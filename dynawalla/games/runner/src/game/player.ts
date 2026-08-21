import * as THREE from "three";
import type { SolidField } from "./fields.ts";
import type { GlowField } from "./fields.ts";
import type { Particles } from "./particles.ts";
import { LANE_W } from "./world.ts";
import { clamp, clamp01, easeOutQuint, approach } from "./juice.ts";

/**
 * The skiff.
 *
 * A dark faceted delta with hot edges and two thruster plumes. No face, no
 * eyes, nothing to anthropomorphise — the register is "vehicle", and a vehicle
 * can be thrown around without it reading as cruelty.
 *
 * The numbers below are the whole feel of the game:
 *
 *   LANE_TIME 0.125s  A lane change must complete inside two frames of thought.
 *                     Anything above ~0.18s and the player out-runs their own
 *                     craft at speed, which reads as unresponsive rather than
 *                     heavy.
 *   COYOTE 0.09s      You may still jump just after the deck ends.
 *   Squash and stretch on take-off and landing, because a rigid object landing
 *   has no weight.
 */

const LANE_TIME = 0.125;
const GRAV = 54;
const JUMP_V = 16.7;
const SLIDE_TIME = 0.5;
const COYOTE = 0.09;

const GHOSTS = 5;

/**
 * A six-facet dart, built by hand rather than from a primitive: a cone with
 * four radial segments looks like a squashed box from behind, and the
 * silhouette is the only thing a player ever sees of their own craft.
 *
 *   N nose (forward, -z)   T dorsal spine   L/R wingtips   B keel
 */
export function skiffGeometry(): THREE.BufferGeometry {
  const N = [0, 0.1, -1.8];
  const T = [0, 0.62, 0.5];
  const L = [-1.1, 0, 1.2];
  const R = [1.1, 0, 1.2];
  const B = [0, -0.3, 0.4];
  const tris = [
    N, L, T, // upper left
    N, T, R, // upper right
    N, B, L, // lower left
    N, R, B, // lower right
    T, L, R, // transom, upper
    B, R, L, // transom, lower
  ];
  const pos = new Float32Array(tris.length * 3);
  for (let i = 0; i < tris.length; i++) {
    pos[i * 3] = tris[i][0];
    pos[i * 3 + 1] = tris[i][1];
    pos[i * 3 + 2] = tris[i][2];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export class Player {
  lane = 1;
  x = 0;
  y = 0;
  vy = 0;
  grounded = true;
  slideT = 0;
  invuln = 0;
  roll = 0;
  /** Lateral velocity in units/s; drives lean, camera and the graze test. */
  vx = 0;

  private fromX = 0;
  private toX = 0;
  private laneT = 1;
  private airborneFor = 0;
  private squash = 0;
  private hist: Float32Array = new Float32Array(GHOSTS * 4);
  private histHead = 0;
  private histAcc = 0;
  private thrustAcc = 0;
  hitFlash = 0;

  reset(): void {
    this.lane = 1;
    this.x = this.fromX = this.toX = 0;
    this.laneT = 1;
    this.y = 0;
    this.vy = 0;
    this.vx = 0;
    this.grounded = true;
    this.slideT = 0;
    this.invuln = 0;
    this.roll = 0;
    this.squash = 0;
    this.hitFlash = 0;
    this.hist.fill(0);
  }

  get sliding(): boolean {
    return this.slideT > 0;
  }
  get airborne(): boolean {
    return this.y > 0.08;
  }
  /** Half-height of the collision box; sliding halves it. */
  get hitHalfH(): number {
    return this.sliding ? 0.42 : 0.95;
  }

  moveLane(dir: -1 | 1): boolean {
    const next = clamp(this.lane + dir, 0, 2);
    if (next === this.lane) return false;
    this.lane = next;
    this.fromX = this.x;
    this.toX = (next - 1) * LANE_W;
    this.laneT = 0;
    return true;
  }

  jump(): boolean {
    if (!this.grounded && this.airborneFor > COYOTE) return false;
    this.vy = JUMP_V;
    this.grounded = false;
    this.airborneFor = COYOTE + 1;
    this.slideT = 0;
    this.squash = -0.55;
    return true;
  }

  slide(): boolean {
    if (this.slideT > 0.1) return false;
    this.slideT = SLIDE_TIME;
    if (this.airborne) {
      // Slam down: a down-swipe in the air should end the jump, not queue.
      this.vy = Math.min(this.vy, -18);
    }
    this.squash = 0.4;
    return true;
  }

  /** Knock-back on a wrong gate or a hazard: a visible, physical stumble. */
  stumble(): void {
    this.squash = 0.85;
    this.hitFlash = 1;
    this.vy = Math.max(this.vy, 4.5);
    this.grounded = false;
  }

  update(dt: number, hasDeck: boolean, reduced: boolean): void {
    const prevX = this.x;

    if (this.laneT < 1) {
      this.laneT = Math.min(1, this.laneT + dt / LANE_TIME);
      this.x = this.fromX + (this.toX - this.fromX) * easeOutQuint(this.laneT);
    } else {
      this.x = this.toX;
    }
    this.vx = dt > 0 ? (this.x - prevX) / dt : 0;

    if (this.slideT > 0) this.slideT = Math.max(0, this.slideT - dt);

    this.vy -= GRAV * dt;
    this.y += this.vy * dt;
    if (!hasDeck && this.y < -4) {
      // Fell through a pit. The caller reads `y < -4` as a hazard hit and
      // resets; nothing to do here but keep falling so it looks like falling.
    } else if (this.y <= 0 && hasDeck) {
      if (!this.grounded && this.vy < -6) this.squash = clamp01(-this.vy / 26) * 0.9;
      this.y = 0;
      this.vy = 0;
      this.grounded = true;
      this.airborneFor = 0;
    } else if (this.y > 0) {
      this.grounded = false;
    }
    if (!this.grounded) this.airborneFor += dt;

    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt * 2.2);
    this.squash = approach(this.squash, 0, 11, dt);

    const targetRoll = reduced ? 0 : clamp(-this.vx * 0.022, -0.5, 0.5);
    this.roll = approach(this.roll, targetRoll, 16, dt);

    // Ghost trail sampling.
    this.histAcc += dt;
    while (this.histAcc >= 0.024) {
      this.histAcc -= 0.024;
      const i = (this.histHead = (this.histHead + 1) % GHOSTS) * 4;
      this.hist[i] = this.x;
      this.hist[i + 1] = this.y;
      this.hist[i + 2] = this.roll;
      this.hist[i + 3] = 1;
    }
  }

  emitThrust(dt: number, parts: Particles, speed01: number, r: number, g: number, b: number, quality: number): void {
    this.thrustAcc += dt * (34 + speed01 * 90) * quality;
    while (this.thrustAcc >= 1) {
      this.thrustAcc -= 1;
      const side = Math.random() < 0.5 ? -0.52 : 0.52;
      parts.puff(
        this.x + side, this.y + 0.28, 1.35,
        (Math.random() - 0.5) * 2.5, (Math.random() - 0.2) * 2.2, 16 + Math.random() * 22,
        0.28 + Math.random() * 0.22,
        0.34 + Math.random() * 0.3, 1.6,
        r, g, b, 1.5,
      );
    }
  }

  draw(
    field: SolidField, boxField: SolidField, glow: GlowField,
    r: number, g: number, b: number,
    hotR: number, hotG: number, hotB: number,
    reduced: boolean,
  ): void {
    const sq = this.squash;
    const sy = 1 - sq * 0.55;
    const sx = 1 + sq * 0.4;
    const hurt = this.hitFlash;
    const cr = r + (1 - r) * hurt;
    const cg = g * (1 - hurt * 0.75);
    const cb = b * (1 - hurt * 0.75);

    // Blink on invulnerability. Never colour alone: the skiff also shrinks to a
    // wire outline, which reads at any contrast.
    const blink = this.invuln > 0 ? (Math.sin(this.invuln * 34) > -0.2 ? 1 : 0.28) : 1;

    if (!reduced) {
      for (let i = 1; i <= GHOSTS; i++) {
        const idx = ((this.histHead - i + GHOSTS * 2) % GHOSTS) * 4;
        if (this.hist[idx + 3] === 0) continue;
        const f = (1 - i / (GHOSTS + 1)) * 0.16 * blink;
        field.add(
          this.hist[idx], 0.72 + this.hist[idx + 1], 0.35 + i * 0.5,
          sx * (1 - i * 0.06), sy * (1 - i * 0.06), 1 - i * 0.04,
          0,
          cr, cg, cb, 0.15, f,
        );
      }
    }

    field.add(this.x, 0.72 + this.y, 0, sx, sy, 1, 0, cr, cg, cb, 1.5 + hurt * 3, blink);

    // Nacelles + the underglow strip.
    const nz = 1.15;
    boxField.add(this.x - 0.62, 0.62 + this.y, nz, 0.34, 0.3, 0.7, 0, hotR, hotG, hotB, 2.4, blink);
    boxField.add(this.x + 0.62, 0.62 + this.y, nz, 0.34, 0.3, 0.7, 0, hotR, hotG, hotB, 2.4, blink);
    boxField.add(this.x, 0.34 + this.y, 0.25, 1.5, 0.1, 2.1, 0, cr, cg, cb, 2.0, blink * 0.9);

    // Thruster cones and a contact glow on the deck.
    glow.add(this.x - 0.62, 0.62 + this.y, nz + 0.5, 1.15, 0.8 * blink, 1, 0, hotR, hotG, hotB);
    glow.add(this.x + 0.62, 0.62 + this.y, nz + 0.5, 1.15, 0.8 * blink, 1, 0, hotR, hotG, hotB);
    const alt = clamp01(1 - this.y / 4);
    glow.add(this.x, 0.05, 0.2, 3.4 + alt * 1.2, 0.34 * alt * blink, 0.42, 0, r, g, b);
    if (hurt > 0.02) {
      glow.add(this.x, 0.9 + this.y, 0.2, 5 + hurt * 5, hurt * 0.9, 1, 1, 1, 0.25, 0.3);
    }
  }
}
