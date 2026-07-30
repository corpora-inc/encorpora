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

/** Breathing room between the tile bar, the hint control and the tree above it. */
const HINT_GAP = 8

/**
 * How much of the safe height the factor tree may take.
 *
 * A third and a bit. Enough for the four rows a three-digit target's tree needs
 * and not so much that a child who asked for a hint cannot see the husk they
 * were about to shoot.
 */
const TREE_SHARE = 0.36

/**
 * The least height the tree may be given, whatever else is competing for it.
 *
 * The deepest tree in the band is `512 = 2⁹`: five rows, which at the renderer's
 * minimum node radius of 9 needs `4 × 19.5 + 18` = 96px exactly. Below that the
 * rows overlap; below 18px the row step goes negative and the tree draws upside
 * down. Ninety-six and not a round hundred, deliberately: at 1024×320 — a phone
 * held sideways — the difference is whether the ceiling or the floor wins, and
 * the ceiling winning is the outcome where the tree does not sit on the
 * counters.
 */
const TREE_MIN_H = 96

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
  /**
   * The box the factor-tree hint may grow into: standing on the hint control,
   * which stands on the tile bar, all of it inside the safe area.
   *
   * **The bottom of the arena, and that is not an accident.** `Arena.arm` seeds
   * every husk and mote with `y` between the top edge and `0.62 · height`, so
   * the lower third is the emptiest part of the field — the one band a panel
   * can occupy without hiding the thing the child is trying to shoot. It is
   * also where their eyes already are, because the tile bar is there and the
   * tree's leaves are exactly what the bar is about to fill up with.
   */
  readonly tree: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
  /**
   * The control that asks for the next piece of the tree.
   *
   * A circle, at least 44px across, at the left edge of the safe area on its own
   * row above the tile bar — clear of the bar's own tap target, which drops the
   * hold and must not be hit by a child reaching for help. It carries a drawn
   * branch rather than a word: it is a control a five-year-old meets before they
   * can read, in a pack that ships in about fifty languages.
   */
  readonly hint: { readonly cx: number; readonly cy: number; readonly r: number }
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

  // The tile bar's own row, and the top of the 44px zone that drops the hold.
  const barY = area.y + area.h - barSize * 1.5
  const barTop = barY - Math.max(22, barSize)

  // The hint control sits at the bottom-left of the tree's own band, clear of
  // the tile bar's 44px tap zone — a child reaching for help must never dump the
  // hold they have spent a minute assembling — and BESIDE the tree rather than
  // under it.
  //
  // Beside, because a phone held sideways is 390px tall and the host takes the
  // top hundred of it. Stacking the control on its own row spent sixty of the
  // remaining hundred and forty and left the tree fifty-nine pixels to draw four
  // rows in, which is a hint nobody can read. Landscape has width and no height,
  // so the control is paid for out of the width: the tree keeps a matching
  // gutter on its right, which also keeps it centred.
  const hintR = Math.max(22, Math.min(26, area.w / 14))
  const treeBottom = barTop - HINT_GAP
  // Never above the host's two corner controls. On a pane a couple of hundred
  // pixels tall the tile bar climbs high enough that the control's own row lands
  // underneath the host's exit chevron, and a hint control a child cannot press
  // because the host owns those pixels is a hint control that is not there.
  const hintCy = Math.max(cornerBottom + hintR, treeBottom - hintR)
  const hintCx = area.x + SIDE + hintR
  const gutter = hintR * 2 + HINT_GAP

  // Capped at just over a third of the safe height so the arena is still an
  // arena, and floored below the counters so it never draws through them.
  //
  // TWO counter rows reserved and not three. The third row is the stall notice,
  // and a stall is by definition an arena with no resonator on it — so there is
  // no question, no tree and nothing to reserve for. Reserving it anyway cost
  // the tree twenty-five pixels it does not have on a phone held sideways.
  const treeCeiling = cornerBottom + size * 1.5 * 2
  // Floored at `TREE_MIN_H`, and the floor wins over the ceiling.
  //
  // On a pane short enough that the counters and the tile bar meet in the middle
  // — a 1024×200 Split View slice is the shape that produced it — the ceiling
  // pushed `treeTop` *below* `treeBottom` and the box came out one pixel tall
  // with a negative row step, which draws the tree upside down through the
  // counters. Overlapping the counters slightly on a pane nothing can be read on
  // anyway is the better of the two failures, and it is a failure the renderer
  // survives.
  const treeTop = Math.min(
    treeBottom - TREE_MIN_H,
    Math.max(treeCeiling, treeBottom - area.h * TREE_SHARE),
  )

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
      y: barY,
      cx: area.x + area.w / 2,
    },
    banner: { cx: area.x + area.w / 2, cy: area.y + area.h * 0.46 },
    sheet: { cx: area.x + area.w / 2, cy: area.y + area.h / 2 },
    tree: {
      x: area.x + SIDE + gutter,
      y: treeTop,
      w: Math.max(1, area.w - (SIDE + gutter) * 2),
      h: Math.max(1, treeBottom - treeTop),
    },
    hint: { cx: hintCx, cy: hintCy, r: hintR },
  }
}
