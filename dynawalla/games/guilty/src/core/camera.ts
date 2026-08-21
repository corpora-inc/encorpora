/**
 * A real perspective camera, projected in software onto a 2D canvas.
 *
 * Everything in the trench has a z: the plankton drift far behind the play
 * plane, husk debris is thrown *towards* the lens and grows as it comes, the
 * seabed recedes. That is what makes a fixed-position shooter feel like a place
 * rather than a chart. It costs two multiplies and a divide per point, which is
 * why it is affordable at 60fps on a tablet where a WebGL pipeline would not
 * have been worth the risk.
 *
 * Screen shake, roll and the z-punch all live on the camera, so every layer
 * inherits them for free and nothing has to remember to shake.
 */

import { CAM_Z, VIEW_HALF_H } from "./config.ts";

export type Camera = {
  x: number;
  y: number;
  z: number;
  roll: number;
  /** Additive screen-space shake, in CSS pixels. */
  shakeX: number;
  shakeY: number;
  /** Focal length in CSS pixels. */
  f: number;
  cx: number;
  cy: number;
  /** Half-width of the world the camera can see at z = 0. */
  worldHalfW: number;
  /** Half-width of the lane field. Never wider than a child's thumb reach. */
  playHalfW: number;
  cosRoll: number;
  sinRoll: number;
};

export type Projected = { x: number; y: number; s: number; ok: boolean };

export function makeCamera(): Camera {
  return {
    x: 0,
    y: 0,
    z: CAM_Z,
    roll: 0,
    shakeX: 0,
    shakeY: 0,
    f: 600,
    cx: 0,
    cy: 0,
    worldHalfW: 100,
    playHalfW: 90,
    cosRoll: 1,
    sinRoll: 0,
  };
}

/** Re-fit after a resize. `w`/`h` are CSS pixels. */
export function fitCamera(cam: Camera, w: number, h: number): void {
  cam.cx = w / 2;
  cam.cy = h / 2;
  cam.f = (h / 2) * (CAM_Z / VIEW_HALF_H);
  cam.worldHalfW = VIEW_HALF_H * (w / h);
  cam.playHalfW = Math.max(52, Math.min(168, cam.worldHalfW * 0.84));
}

export function beginFrame(cam: Camera): void {
  cam.cosRoll = Math.cos(cam.roll);
  cam.sinRoll = Math.sin(cam.roll);
}

const scratch: Projected = { x: 0, y: 0, s: 1, ok: true };

/** Projects into a shared scratch object — read it before the next call. */
export function project(cam: Camera, wx: number, wy: number, wz: number): Projected {
  const depth = cam.z - wz;
  if (depth <= 12) {
    scratch.ok = false;
    scratch.x = 0;
    scratch.y = 0;
    scratch.s = 0;
    return scratch;
  }
  const s = cam.f / depth;
  const dx = (wx - cam.x) * s;
  const dy = -(wy - cam.y) * s;
  scratch.x = cam.cx + dx * cam.cosRoll - dy * cam.sinRoll + cam.shakeX;
  scratch.y = cam.cy + dx * cam.sinRoll + dy * cam.cosRoll + cam.shakeY;
  scratch.s = s;
  scratch.ok = true;
  return scratch;
}

/** Screen x (CSS px) -> world x on the play plane. Ignores shake, so a shaking
 *  camera never fights the player's finger. */
export function screenToWorldX(cam: Camera, sx: number): number {
  const s = cam.f / cam.z;
  return cam.x + (sx - cam.cx) / s;
}

/** World units per CSS pixel at the play plane — for sizing baked sprites. */
export function planeScale(cam: Camera): number {
  return cam.f / cam.z;
}
