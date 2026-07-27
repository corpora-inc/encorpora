/**
 * The camera and the time base — where most of the "feel" actually lives.
 *
 * Four techniques from Vlambeer's *Art of Screenshake*, kept honest:
 *   · trauma-based shake — shake = trauma², decaying linearly, so small hits
 *     barely register and big ones slam. Squaring is what stops the screen
 *     jittering constantly.
 *   · hitstop — the *world* freezes for a few frames on impact while the
 *     presentation keeps running. The single cheapest way to make a hit land.
 *   · camera punch — a spring on zoom, not a lerp, so it overshoots and settles.
 *   · slow motion — reserved for the two moments that deserve it.
 *
 * Reduced motion collapses shake, punch and slow-mo to nothing. Hitstop stays
 * (at 60%): it is felt as responsiveness, not seen as movement.
 */

import { TUNE } from "../tuning.ts";
import { clamp, noise1 } from "../num.ts";

export type Camera = {
  trauma: number;
  shakeX: number;
  shakeY: number;
  zoom: number;
  punch: number;
  punchVel: number;
  /** Multiplier applied to simulation dt. 1 = normal. */
  timeScale: number;
  slowmoLeft: number;
  slowmoTotal: number;
  slowmoScale: number;
  hitstopLeft: number;
  flashAlpha: number;
  flashColor: string;
  flashCooldown: number;
  reduced: boolean;
  t: number;
};

export function createCamera(reduced: boolean): Camera {
  return {
    trauma: 0,
    shakeX: 0,
    shakeY: 0,
    zoom: 1,
    punch: 0,
    punchVel: 0,
    timeScale: 1,
    slowmoLeft: 0,
    slowmoTotal: 0,
    slowmoScale: 1,
    hitstopLeft: 0,
    flashAlpha: 0,
    flashColor: "#ffffff",
    flashCooldown: 0,
    reduced,
    t: 0,
  };
}

export function addTrauma(cam: Camera, amount: number): void {
  if (cam.reduced) return;
  cam.trauma = clamp(cam.trauma + amount, 0, 1);
}

export function punch(cam: Camera, amount: number): void {
  if (cam.reduced) return;
  cam.punchVel += amount;
}

export function hitstop(cam: Camera, ms: number): void {
  const scaled = cam.reduced ? ms * 0.6 : ms;
  cam.hitstopLeft = Math.max(cam.hitstopLeft, scaled / 1000);
}

export function slowmo(cam: Camera, seconds: number, scale: number): void {
  if (cam.reduced) return;
  cam.slowmoLeft = Math.max(cam.slowmoLeft, seconds);
  cam.slowmoTotal = Math.max(cam.slowmoTotal, seconds);
  cam.slowmoScale = scale;
}

/**
 * A full-screen tint. Hard-limited for photosensitivity: never more than one
 * every 340ms, never above 0.22 alpha, never white-on-black. This is a
 * children's product and three flashes a second is the published ceiling.
 */
export function flash(cam: Camera, color: string, alpha: number): void {
  if (cam.reduced) return;
  if (cam.flashCooldown > 0) return;
  cam.flashColor = color;
  cam.flashAlpha = Math.min(alpha, TUNE.flashMaxAlpha);
  cam.flashCooldown = TUNE.flashCooldown;
}

/** Advance presentation state. Always called with *real* dt, never scaled. */
export function updateCamera(cam: Camera, dt: number): void {
  cam.t += dt;

  if (cam.hitstopLeft > 0) cam.hitstopLeft = Math.max(0, cam.hitstopLeft - dt);

  if (cam.slowmoLeft > 0) {
    cam.slowmoLeft = Math.max(0, cam.slowmoLeft - dt);
    const k = cam.slowmoTotal > 0 ? cam.slowmoLeft / cam.slowmoTotal : 0;
    // Ease back to real time rather than snapping, or the return reads as a lag spike.
    cam.timeScale = cam.slowmoScale + (1 - cam.slowmoScale) * (1 - k) ** 2;
  } else {
    cam.timeScale = 1;
  }

  cam.trauma = Math.max(0, cam.trauma - TUNE.traumaDecay * dt);
  const shake = cam.trauma * cam.trauma * TUNE.shakeMax;
  cam.shakeX = shake * noise1(cam.t * 22, 1.7);
  cam.shakeY = shake * noise1(cam.t * 22, 9.3);

  // Critically-damped-ish spring on zoom.
  const stiffness = 190;
  const damping = 19;
  cam.punchVel += -stiffness * cam.punch * dt - damping * cam.punchVel * dt;
  cam.punch += cam.punchVel * dt;
  cam.zoom = 1 + cam.punch;

  if (cam.flashCooldown > 0) cam.flashCooldown = Math.max(0, cam.flashCooldown - dt);
  if (cam.flashAlpha > 0) cam.flashAlpha = Math.max(0, cam.flashAlpha - dt * 3.4);
}

/** Simulation dt for this frame: zero during hitstop, scaled during slow-mo. */
export function simDelta(cam: Camera, dt: number): number {
  if (cam.hitstopLeft > 0) return 0;
  return dt * cam.timeScale;
}
