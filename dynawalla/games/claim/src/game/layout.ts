// WHERE THE FRAME ACTUALLY IS.
//
// CLAIM declares `viewport-fit=cover`, which is not a neutral setting: it opts
// the document *into* the notch, the rounded corners and the home indicator.
// The HUD is DOM, so it could claw the top back with `env(safe-area-inset-top)`
// and did — but only the top, and only for the HUD. Three things were left out:
//
//   1. **The arena.** The grid is centred in a canvas that runs to the bottom
//      and both sides of the frame. Cells are not decoration: they are the
//      ground the child drives across and the thing the fraction is measured
//      in. A row of cells under the home indicator is ground that cannot be
//      seen and cannot be cut, and an upward drag there is a system gesture.
//   2. **The sides.** `padding: ... 12px` ignores the left and right insets, so
//      in landscape the level counter sat behind the notch.
//   3. **The host's two corners.** The host floats a 44px exit control at the
//      top-left and the shared how-to-play control at the top-right, over every
//      pack. `LVL 4` was under one and the score and the LIVES were under the
//      other.
//
// **Why this file exists at all, given the HUD is CSS.** Because `env()` cannot
// be asserted. A CSS-only fix is invisible to every test in this package and is
// checked by looking at a device, which is how all three of the above shipped.
// So the numbers live here, in one pure function per surface; `Hud` publishes
// them as custom properties and the stylesheet consumes them; and
// `test/layout.test.ts` asserts the same numbers against `hitsHostChrome`.
// One source of truth, and it is the one under test.
//
// **The chrome overlays; nothing reserves a band.** Reserving the top strip
// cost 12% of a small phone's height in SKY LEDGER and broke its own layout.
// Here the clusters move INBOARD — a horizontal gutter, which costs the arena
// nothing at all — rather than downward.

import {
  exitRect,
  helpRect,
  type Insets,
  type Rect,
} from "../../../../packs/shared/game-chrome/index.ts"

/** Gap between the host's controls and anything of ours beside them. */
const CHROME_GAP = 8

/** The HUD's own padding, before any inset. Matches the original stylesheet. */
const PAD_TOP = 8
const PAD_SIDE = 12

/** The fraction bar's height and the gap above it, from the stylesheet. */
const METER_H = 20
const METER_GAP = 7

export type HudFrame = {
  /** `.cl-hud` padding. */
  padTop: number
  padLeft: number
  padRight: number
  /** Extra `.cl-top` padding that walks the clusters past the host's corners. */
  gutterLeft: number
  gutterRight: number
  /** `.cl-top` min-height, which is what puts the fraction bar below the corners. */
  topMinH: number
  /** How wide either cluster may grow. Enforced by `max-width`, not estimated. */
  clusterW: number
  /** The box the level counter may occupy. */
  left: Rect
  /** The box the score and the lives may occupy. */
  right: Rect
  /** The fraction bar. It IS the pedagogy; both of its ends must be visible. */
  meter: Rect
}

/**
 * Where the HUD's parts go, on a frame of `w` x `h` with these insets.
 *
 * `insets` is REQUIRED. Optional would mean a caller that forgets it still
 * compiles and quietly lays the score out under the host's button, discoverable
 * only on a device — which is exactly how this shipped.
 */
export function hudFrame(w: number, _h: number, insets: Insets): HudFrame {
  const padTop = PAD_TOP + insets.top
  const padLeft = PAD_SIDE + insets.left
  const padRight = PAD_SIDE + insets.right

  const exit = exitRect(insets)
  const help = helpRect(w, insets)

  // The `.cl-hud` content box: what is left after the padding.
  const innerX = padLeft
  const innerW = Math.max(1, w - padLeft - padRight)

  // Walk the top row's two clusters past the host's corners, and no further.
  const gutterLeft = Math.max(0, exit.x + exit.w + CHROME_GAP - innerX)
  const gutterRight = Math.max(0, innerX + innerW - (help.x - CHROME_GAP))

  const rowX = innerX + gutterLeft
  const rowW = Math.max(1, innerW - gutterLeft - gutterRight)

  // The fraction bar spans the full inner width, so it cannot dodge the corners
  // sideways — it has to start below them. The top row is given exactly enough
  // height to guarantee that and not a pixel more, and in practice the stacked
  // goal fraction is already taller than this, so nothing moves on most screens.
  const topMinH = Math.max(44, exit.y + exit.h + 4 - padTop)

  // A third each, so the centred goal fraction — the loudest thing on screen and
  // the whole instruction set — keeps the middle third even when the score is
  // six digits long.
  const clusterW = Math.max(40, rowW * 0.32)

  return {
    padTop,
    padLeft,
    padRight,
    gutterLeft,
    gutterRight,
    topMinH,
    clusterW,
    left: { x: rowX, y: padTop, w: clusterW, h: topMinH },
    right: { x: rowX + rowW - clusterW, y: padTop, w: clusterW, h: topMinH },
    meter: { x: innerX, y: padTop + topMinH + METER_GAP, w: innerW, h: METER_H },
  }
}

/**
 * The rectangle the arena may occupy inside the stage canvas, in canvas-local
 * CSS pixels.
 *
 * The stage sits below the HUD and is flush to the frame's left, right and
 * bottom edges — `.cl-root` is `100% x 100%`, `.cl-shake` fills it, and
 * `.cl-stage` is the flex remainder — so the stage's own unsafe margins are the
 * frame's left, right and bottom insets, and its top is already well clear of
 * the notch. That is the whole of the mapping, and it is why this takes insets
 * rather than a rect: there is no other correspondence to get wrong.
 *
 * The paper and the vignette still fill the entire canvas. Only the grid is
 * constrained, because only the grid is ground.
 */
export function arenaRect(w: number, h: number, insets: Insets): Rect {
  const x = Math.min(insets.left, w)
  return {
    x,
    y: 0,
    w: Math.max(1, w - x - Math.min(insets.right, w)),
    h: Math.max(1, h - Math.min(insets.bottom, h)),
  }
}

/** Where the mute button's 44px touch target sits, from the bottom-right. */
export function muteRect(w: number, h: number, insets: Insets): Rect {
  const side = 44
  return {
    x: w - insets.right - 10 - side,
    y: h - insets.bottom - 10 - side,
    w: side,
    h: side,
  }
}
