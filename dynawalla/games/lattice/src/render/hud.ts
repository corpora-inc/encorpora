// Where the chrome goes: the counters at the top, the banner in the middle, and
// the factor tile bar along the bottom.
//
// **Why this is a file and not four numbers inside `scene.ts`.** Two things
// float over every Dynawalla pack that the pack does not own — the host's exit
// control in the top-LEFT corner and the shared how-to-play control in the
// top-RIGHT — and this game drew `OPENED` at `x = 14, y = 12` and `BEST` at
// `w - 14, 12`, which is underneath both of them. It drew them at `y = 12` on a
// phone whose notch is 47px deep as well, so the counters were under the notch
// and under a button at the same time. A canvas cannot read `env()`; the only
// way to clear either is to be handed the numbers.
//
// **The playfield is not moved.** The sheet, the husks, the motes, the ship and
// the resonator still use the whole canvas, edge to edge and under the notch —
// that is what `viewport-fit=cover` is for, and it is why this reads as an arena
// rather than as a form. It is the counters, the banner and the tile bar — the
// things a child must READ or TOUCH — that live inside `area`.
//
// **Chrome overlays; it does not reserve a band.** Reserving the top strip
// costs 67px, which is 12% of a 568px phone. The counters simply begin below
// the two corners, and the arena carries on behind them.

import {
  HOST_CONTROL,
  HOST_MARGIN,
  HOST_PROGRESS_H,
  type Rect,
} from "../../../../packs/shared/game-chrome/index.ts"

export type { Rect }

/** Breathing room between the bottom of the host's corner controls and the counters. */
const CORNER_GAP = 8

/** The counters' inset from the safe edge, left and right. */
const SIDE = 14

export type HudLayout = {
  /** `OPENED` / `CHAIN` on the left, `BEST` on the right, the stall notice centred. */
  readonly status: {
    readonly size: number
    /** Top edge of the first row. Below both host corners, always. */
    readonly top: number
    readonly lineH: number
    readonly left: number
    readonly right: number
    readonly cx: number
  }
  /** The factor tile bar. Tapping it drops the hold, so it is a touch target. */
  readonly bar: {
    readonly size: number
    readonly gap: number
    readonly dotW: number
    /** Middle of the tile row. */
    readonly y: number
    readonly cx: number
  }
  /** `RESONANCE`, `NOT YET`, `PAUSED` — centred in the safe area, not the canvas. */
  readonly banner: { readonly cx: number; readonly cy: number }
  /** The word under the host's sheet. */
  readonly sheet: { readonly cx: number; readonly cy: number }
}

/**
 * Lay the chrome out inside `area`.
 *
 * `area` is the safe rectangle from `packs/shared/game-chrome` — the canvas
 * minus the notch, the home indicator and the rounded corners.
 *
 * It is REQUIRED, deliberately, and that is the point of this signature. Made
 * optional, a caller that forgets it still compiles and quietly draws the score
 * under the notch, and the only way anybody finds out is by holding a notched
 * phone. Required, forgetting it does not build.
 *
 * `w` is the full canvas width and is used for one thing only — the type scale,
 * which should not shrink just because a phone is held sideways and has an
 * inset down each edge.
 */
export function hudLayout(w: number, area: Rect): HudLayout {
  // The host's two 44px corners hang from the top of the safe area. Everything
  // the child reads starts underneath them.
  const cornerBottom = area.y + HOST_PROGRESS_H + HOST_MARGIN + HOST_CONTROL + CORNER_GAP
  const size = Math.max(12, Math.min(17, w / 46))
  const barSize = Math.max(26, Math.min(40, area.w / 16))

  return {
    status: {
      size,
      top: cornerBottom,
      lineH: size * 1.5,
      left: area.x + SIDE,
      right: area.x + area.w - SIDE,
      cx: area.x + area.w / 2,
    },
    bar: {
      size: barSize,
      gap: barSize * 0.22,
      dotW: barSize * 0.5,
      // Standing on the floor of the safe area rather than the floor of the
      // canvas: on a phone the floor of the canvas is the home indicator.
      y: area.y + area.h - barSize * 1.5,
      cx: area.x + area.w / 2,
    },
    banner: { cx: area.x + area.w / 2, cy: area.y + area.h * 0.46 },
    sheet: { cx: area.x + area.w / 2, cy: area.y + area.h / 2 },
  }
}
