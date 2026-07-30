// WHERE THE READOUTS GO.
//
// MATH NINJA draws its whole HUD on the canvas — the score, the three lamps, the
// stream and favour lines, the order plate — and a canvas cannot read
// `env(safe-area-inset-*)`. The document declares `viewport-fit=cover`, which is
// not a neutral setting: it opts this game *into* the notch, the home indicator
// and the rounded corners. So `fillText` at `y = 12` landed under the notch, and
// on a device with a notch the score simply was not there.
//
// The host makes it worse in a second, independent way. It paints an exit
// control in the top-LEFT corner and a how-to-play control in the top-RIGHT,
// 44px each, and they float *over* the pack rather than reserving a band. The
// score sat under the first one and the three lamps sat under the second.
//
// This module is the one place both facts are known.
//
//   * every readout is laid out inside `area`, the safe rect;
//   * every readout starts below `chromeBottom`, so the two 44px corners stay
//     free of anything a child must read or touch.
//
// **`area` is required, not optional.** A default would compile at every call
// site that forgot it and then draw under the notch, discoverable only on a
// device with a notch in someone's hand. Making it required moves that failure
// to `tsc`.
//
// What deliberately does NOT obey any of this: the sky, the ridges, the
// canopies, the blade ribbon, the splat layer, the particles and the flying
// bodies themselves. Full-bleed art under the notch is the reason
// `viewport-fit=cover` is set at all. Only what must be READ or TOUCHED is
// pinned inside the safe rect.

import {
  chromeRects,
  hitsHostChrome,
  type Insets,
  type Rect,
} from "../../../../packs/shared/game-chrome/index.ts"

/** Air between the host's controls and the first thing this game draws. */
const CHROME_GAP = 8

/** Air between the score column and the lamps hanging opposite it. */
const COLUMN_GAP = 8

/** A lantern is drawn out to this many radii, and rides this many above centre. */
const LANTERN_EXTENT = 1.26
const LANTERN_RISE = 0.55

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

export type HudLayout = {
  readonly w: number
  readonly h: number
  /** The safe rect. Everything below is measured from its edges, not the canvas's. */
  readonly area: Rect
  readonly pad: number
  /** Type size of the score numeral; every other size is a fraction of it. */
  readonly big: number
  /** The lowest edge of the host's two corner controls. */
  readonly chromeBottom: number
  /** The first line this game may use: clear of the safe edge AND of both corners. */
  readonly top: number
  /** Top-left of the score numeral, drawn `textAlign:left textBaseline:top`. */
  readonly scoreX: number
  readonly scoreY: number
  readonly bestY: number
  /** Baseline of the multiplier line, and of the CHAIN/FAVOUR lines beside it. */
  readonly mulY: number
  /** Everything in the left column: score, BEST, and the multiplier block. */
  readonly left: Rect
  readonly lampR: number
  /** Centre of a lantern; the wire above it starts at `top`. */
  readonly lampY: number
  /** The bottom of the lamp block, where its wires and glass end. */
  readonly tickY: number
  /** The three lanterns and the air under them. */
  readonly lamps: Rect
  /** THE ORDER PLATE. The most prominent thing on the canvas. */
  readonly banner: Rect
}

/**
 * The insets that produced `area`.
 *
 * The safe rect is the only thing passed in, so the insets are recovered from
 * it rather than measured again — one source of truth per frame, and it works
 * in a test where there is no document to measure.
 */
export function insetsOf(w: number, h: number, area: Rect): Insets {
  return {
    top: area.y,
    left: area.x,
    right: Math.max(0, w - area.x - area.w),
    bottom: Math.max(0, h - area.y - area.h),
  }
}

/** Everything the HUD needs, solved once per resize. `area` is required. */
export function hudLayout(w: number, h: number, area: Rect): HudLayout {
  const insets = insetsOf(w, h, area)
  const chromeBottom = chromeRects(w, insets).reduce((m, r) => Math.max(m, r.y + r.h), 0)

  const pad = Math.max(12, w * 0.022)
  const big = Math.max(24, Math.min(46, w * 0.042))
  // The band the host floats over is not reserved for the *playfield* — fruit
  // still flies through it, which is the whole point. It is reserved only for
  // the handful of glyphs a child reads, and those move down by 50-odd pixels.
  const top = Math.max(area.y + pad, chromeBottom + CHROME_GAP)

  const scoreX = area.x + pad
  const bestY = top + big * 1.05
  const mulY = top + big * 1.55

  const lampR = Math.max(9, Math.min(15, w * 0.014))
  // 1.9 and not 1.2: the wire above a lantern is part of the lantern, and
  // hanging it from the centre put the wire back inside the help control.
  const lampY = top + lampR * 1.9
  const tickY = lampY + lampR * 1.7
  const lampCentre = (i: number): number => area.x + area.w - pad - lampR - i * (lampR * 2.9)
  const lampRight = lampCentre(0) + lampR
  const lampLeft = lampCentre(2) - lampR
  const lamps: Rect = {
    x: lampLeft,
    y: top,
    w: lampRight - lampLeft,
    h: tickY + 3.5 - top,
  }

  // The lamps are anchored to the right edge; the score column reads from the
  // left and takes what is LEFT OVER rather than a fixed share of the width. A
  // fixed 62% share and a right-anchored lamp block met in the middle the
  // moment the safe rect got narrow — a phone held wide gives up 118px of its
  // width to two rounded corners, and an iPad Split View pane is narrower
  // still.
  const left: Rect = {
    // Four ems, because that is what the widest line actually measures: a
    // six-digit score is 3.6em in this face, and `×36 · FAVOUR 3` comes out
    // at about 3.8em. Six was a guess and it made the column claim a third of
    // an iPad, which pushed the question banner off the top row for no reason.
    x: scoreX,
    y: top,
    w: Math.max(0, Math.min(big * 4, lampLeft - COLUMN_GAP - scoreX)),
    // The multiplier block runs to mulY plus three lines of `big * 0.34`.
    h: big * 2.6,
  }

  const bw = Math.min(area.w * 0.9, 460)
  const bh = Math.max(42, Math.min(74, h * 0.085))
  // The banner wants the top row, centred, where it reads best.
  const banner: Rect = {
    x: area.x + (area.w - bw) / 2,
    y: area.y + pad * 0.7,
    w: bw,
    h: bh,
  }
  // …and gives it up if the top row is taken, by the host's corner controls, by
  // the score column or by the lamps. This used to be the breakpoint `w < 620`,
  // which is a guess about width standing in for a fact about occupancy: it was
  // wrong for a wide screen whose *safe* rect is narrow, and it stayed wrong
  // once the readouts moved down out of the host's chrome. Three overlap tests
  // cost nothing and cannot be wrong.
  if (
    hitsHostChrome(banner, w, insets) ||
    overlaps(banner, left) ||
    overlaps(banner, lamps)
  ) {
    banner.y = Math.max(left.y + left.h, lamps.y + lamps.h) + 4
  }

  return {
    w,
    h,
    area,
    pad,
    big,
    chromeBottom,
    top,
    scoreX,
    scoreY: top,
    bestY,
    mulY,
    left,
    lampR,
    lampY,
    tickY,
    lamps,
    banner,
  }
}

/** Centre x of lamp `i`, counting right to left from the safe right edge. */
export function lampX(l: HudLayout, i: number): number {
  return l.area.x + l.area.w - l.pad - l.lampR - i * (l.lampR * 2.9)
}

export type CandidateRow = {
  readonly r: number
  readonly cx: number
  readonly cy: number
  readonly gap: number
  readonly span: number
  /** Everything the row occupies, lantern art included. */
  readonly box: Rect
}

/**
 * Where the answer lanterns hang.
 *
 * These are the one thing in this game that is both READ and TOUCHED — they are
 * the answer input — so they get the strictest treatment of anything here. Two
 * separate failures are prevented:
 *
 *   1. the row is solved inside `area`, so the fourth lantern cannot end up
 *      under a rounded corner or off the edge of a 320px screen;
 *   2. the row can never rise into the host's two corners. It was close enough
 *      to matter — on a 300px-tall viewport the top of a lantern landed at
 *      59.8px against a corner ending at 57px, and adding a 47px notch inset
 *      put it 44px underneath the exit control.
 */
export function candidateRow(l: HudLayout, n: number, fromX: number, fromY: number): CandidateRow {
  const { h, area } = l
  const spans = Math.max(1, n - 1)
  // The width budget comes first and the radius bends to it. Clamping the
  // radius afterwards is what once pushed the fourth candidate off a 320px
  // screen, where it could never be cut.
  const rPref = Math.max(20, Math.min(h * 0.062, h * 0.05))
  const rFit = area.w / (2.75 * spans + 2.8)
  const r = Math.max(14, Math.min(rPref, rFit))
  const gap = Math.min(r * 3.4, (area.w - r * 2.8) / spans)
  const span = gap * Math.max(0, n - 1)
  const margin = r * 1.4

  const loX = area.x + margin + span / 2
  const hiX = area.x + area.w - margin - span / 2
  const cx = Math.max(loX, Math.min(Math.max(loX, hiX), fromX))

  // Two ceilings, and the row obeys the lower of the screen. The host's corners
  // are one. The question banner is the other: on a narrow screen the banner
  // hangs under the readout row, and a lantern row that starts at 0.32h lands
  // straight on top of it — the child cannot re-read the sum they are being
  // asked, which is the one thing the banner exists for.
  const loY = Math.max(
    h * 0.32,
    l.chromeBottom + (LANTERN_EXTENT + LANTERN_RISE) * r + CHROME_GAP,
    l.banner.y + l.banner.h + (LANTERN_EXTENT + LANTERN_RISE) * r + CHROME_GAP,
  )
  const cy = Math.max(loY, Math.min(h * 0.54, fromY))

  const reach = r * LANTERN_EXTENT
  return {
    r,
    cx,
    cy,
    gap,
    span,
    box: {
      x: cx - span / 2 - reach,
      y: cy - r * LANTERN_RISE - reach,
      w: span + reach * 2,
      h: r * LANTERN_RISE + reach * 2,
    },
  }
}

/** Home position of candidate `i` of `n`: a shallow arc, high in the middle. */
export function candidateHome(row: CandidateRow, i: number, n: number): { x: number; y: number } {
  const f = i / Math.max(1, n - 1) - 0.5
  return {
    x: row.cx + f * row.span,
    y: row.cy - Math.cos(f * Math.PI) * row.r * LANTERN_RISE,
  }
}
