/**
 * Where the screen-space chrome is allowed to sit.
 *
 * SERPENT draws its entire HUD on the canvas, and a canvas cannot read
 * `env(safe-area-inset-*)` — that is a CSS value, and `fillText` at `y = 24` has
 * never heard of it. `pack.html` declares `viewport-fit=cover`, which is not a
 * neutral setting: it opts the document *into* the display cutout, the home
 * indicator and the rounded corners. So the depth readout went under the cutout
 * and the sound switch — a control, one a child taps — went under the home
 * indicator.
 *
 * On top of that the host paints an exit control over the top-left 44px corner
 * and a how-to-play control over the top-right one. The depth was in the first
 * and the combo gauge in the second.
 *
 * **The chrome overlays; it does not reserve a band.** The water, the snow, the
 * vignette and the arena all still fill the frame. Only the four readouts move,
 * and they move by the smallest amount that clears a 44px square.
 *
 * Everything here is pure arithmetic over a viewport and a set of insets, which
 * is the point: `chrome.test.ts` can assert it at every shape the fleet has
 * instead of the bug being found on a device.
 */

import {
  HOST_CONTROL,
  HOST_MARGIN,
  HOST_PROGRESS_H,
  safeRect,
  type Insets,
  type Rect,
} from "../../../../../packs/shared/game-chrome/index.ts";

/** Clear air between the bottom of a host control and the readout under it. */
const GAP = 6;

/**
 * How far below the top safe edge the two top-corner readouts start.
 *
 * The hairline, the control's margin, the control, and a gap — derived from the
 * shared constants rather than typed out, so if the host moves its chrome this
 * pack follows on the next build instead of drifting away from it.
 */
export const READOUT_CLEAR = HOST_PROGRESS_H + HOST_MARGIN + HOST_CONTROL + GAP;

export type HudLayout = {
  /** The rectangle inside the insets. The playfield may leave it; readouts may not. */
  safe: Rect;
  /** The HUD's own margin from the safe edge. */
  pad: number;
  /** Type size of the depth figure, and of the small length figure under it. */
  depthSize: number;
  lengthSize: number;
  /** Left edge and baseline of the depth marker's triangle. */
  depthX: number;
  depthY: number;
  /** Type size of the score, and the centre it is set on. */
  scoreSize: number;
  scoreX: number;
  scoreY: number;
  /** The combo gauge: centre and radius. */
  gaugeX: number;
  gaugeY: number;
  gaugeR: number;
  /** The sound switch: centre and radius. It is a control, so it is also a target. */
  soundX: number;
  soundY: number;
  soundR: number;
  /** Baseline of the lowest debug line. */
  debugBottom: number;
};

/**
 * The whole HUD, as numbers.
 *
 * `insets` is a required argument on purpose. An optional safe area is a game
 * that forgets to pass one, compiles clean, and draws its score under the
 * cutout — a defect that only exists on hardware, which is the worst place to
 * discover anything.
 */
export function hudLayout(w: number, h: number, insets: Insets): HudLayout {
  const safe = safeRect(w, h, insets);
  // The type scale keys off the short side of the SAFE box, not the viewport:
  // in landscape the cutout takes 94px off the width, and sizing off a width
  // the game cannot use makes the figures overhang the part it can.
  const u = Math.max(1, Math.min(safe.w, safe.h));
  const pad = Math.max(14, u * 0.045);

  const depthSize = Math.max(24, u * 0.062);
  const tri = depthSize * 0.3;
  const scoreSize = Math.max(26, u * 0.075);
  const gaugeR = Math.max(15, u * 0.042);
  const soundR = Math.max(13, u * 0.032);

  // The two top corners belong to the host. The depth and the gauge drop under
  // them; the score sits between them and keeps its own top margin, because the
  // middle of the top edge is the one part of it nothing is painted over.
  const top = safe.y + READOUT_CLEAR;

  return {
    safe,
    pad,
    depthSize,
    lengthSize: Math.max(11, u * 0.028),
    depthX: safe.x + pad + tri * 0.6,
    // The figures are set with `textBaseline = "middle"`, so half the ink is
    // ABOVE this line. Dropping the centre by the control's height would still
    // have left the top of the numeral inside the corner on a tablet, where the
    // type scale is largest — which is exactly how this was found.
    depthY: top + depthSize * 0.6,
    scoreSize,
    scoreX: safe.x + safe.w / 2,
    scoreY: safe.y + pad + scoreSize * 0.6,
    gaugeX: safe.x + safe.w - pad - gaugeR,
    // Measured to the SHIELD ring, which is drawn at 1.5x the gauge's radius.
    // Clearing the control by the gauge alone left the shield poking up into
    // the corner, and the shield is the one thing on that dial a child watches
    // for — it is the reward for six right answers in a row.
    gaugeY: top + gaugeR * 1.5,
    gaugeR,
    soundX: safe.x + safe.w - pad - soundR,
    soundY: safe.y + safe.h - pad - soundR,
    soundR,
    debugBottom: safe.y + safe.h - pad,
  };
}

/**
 * The square the sound switch answers taps in.
 *
 * Shared by the renderer and by `mount.ts`'s hit test, which used to carry its
 * own copy of the same four expressions. Two copies of a control's position is
 * one copy too many: they drifted the moment either moved.
 */
export function soundTarget(l: HudLayout): Rect {
  const box = Math.max(24, l.soundR * 1.9);
  return { x: l.soundX - box, y: l.soundY - box, w: box * 2, h: box * 2 };
}

/**
 * The box the depth readout's ink occupies.
 *
 * Both figures are set `textBaseline = "middle"` and `textAlign = "center"`, so
 * the ink straddles the baseline rather than sitting on it. Getting that
 * backwards is how a readout ends up half a numeral inside a button.
 */
export function depthTarget(l: HudLayout): Rect {
  const left = l.depthX - l.depthSize * 0.2;
  // The marker, the gap, and up to four figures of depth at roughly 0.6em each.
  const right = l.depthX + l.depthSize * (0.48 + 0.22 + 1.2);
  const top = l.depthY - l.depthSize * 0.6;
  const bottom = l.depthY + l.depthSize * 0.72 + l.lengthSize * 0.6;
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** The box the combo gauge occupies, including the shield ring outside it. */
export function gaugeTarget(l: HudLayout): Rect {
  const r = l.gaugeR * 1.5;
  return { x: l.gaugeX - r, y: l.gaugeY - r, w: r * 2, h: r * 2 };
}

/** The box the score and the best-so-far line occupy, for tests. */
export function scoreTarget(l: HudLayout): Rect {
  // Six figures is more score than a run produces, which is what a clearance
  // box wants to be: wider than the thing it stands for.
  const w = l.scoreSize * 3.6;
  const top = l.scoreY - l.scoreSize * 0.6;
  const bottom = l.scoreY + l.scoreSize * 0.68 + l.scoreSize * 0.35;
  return { x: l.scoreX - w / 2, y: top, w, h: bottom - top };
}
