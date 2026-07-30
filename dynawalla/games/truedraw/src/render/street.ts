// Where the readable things stand.
//
// THE TRUE DRAW is drawn entirely on a canvas, and a canvas cannot read
// `env(safe-area-inset-*)`. The pack declares `viewport-fit=cover`, which is a
// deliberate choice — the dust, the street, the caller, the crowd and the haze
// SHOULD run under the notch and past the rounded corners, because a world that
// stops short of the glass is not a world. But the slate is not the world. The
// slate carries `47 + 25 = 62`, and a statement a child cannot read is a wrong
// call they did not make.
//
// So this module splits the frame in two:
//
//   * the WORLD — horizon, sky, dust, figures — laid out on the full canvas;
//   * the READABLE things — the chute, the slate, the three shots, the hoard —
//     laid out inside `area`, the safe rectangle, and clear of the host's two
//     corners.
//
// ── WHAT CHANGED, AND WHY (the founder's playtest) ──────────────────────────
//
// "Too much blank space. the cache/keep score/pile could be locked to the bottom
// of the screen and the discard target to the top."
//
// He was reading the layout exactly right. The old street measured EVERYTHING
// from the slate: the chute sat one gutter above it, the shots one drop below,
// the hoard below those — and then the layout simply stopped, wherever it
// happened to stop. On a 320×568 phone with a notch that left a 163 px band of
// nothing between the hoard and the bottom of the glass: 39% of the playable
// column, dead. The game looked like a widget floating in a dark room.
//
// It is now laid out from BOTH ENDS INWARD.
//
//   * `ceiling` — the first row the game owns, immediately under the host's two
//     44 px corner controls and its progress hairline. The CHUTE is pinned there.
//   * `floor` — the last row the game owns, clear of the bottom inset AND of
//     `GESTURE_STRIP`. The HOARD is pinned there, with the shots just above it.
//   * the slate is centred in what is left, and it is much bigger than it was,
//     because the space between the two destinations is the space it is thrown
//     across.
//
// `street.test.ts` asserts the pinning, the clearances and — the one that would
// have caught the shipped defect — that no single gap in the column is more than
// a fifth of it.
//
// ── THE HOST'S CHROME OVERLAYS; IT DOES NOT RESERVE ─────────────────────────
//
// The host paints an exit control top-LEFT and a how-to-play control top-RIGHT,
// 44 px each, floating over the game. They do not reserve a band: reserving one
// costs a twelfth of a 568 px phone and broke a sibling game's own layout. The
// promise each game makes instead is narrow and absolute — nothing a child must
// read or touch lands in those two squares. The chute is now pinned BELOW both
// of them rather than trying to thread between them, which is the only placement
// that is correct at every width.

import {
  exitRect,
  helpRect,
  HOST_MARGIN,
  HOST_PROGRESS_H,
  type Rect,
} from "../../../../packs/shared/game-chrome/index.ts"
import { SHOTS } from "../game/run.ts"

export type { Rect }

/**
 * The band at the bottom of the glass the SYSTEM swipes in from.
 *
 * Android's gesture strip reports a bottom inset of ZERO on many devices — it is
 * an overlay, not a cutout — so a layout that trusted `insets.bottom` alone would
 * put the hoard directly under the back-swipe on exactly the phones that use it.
 * 24 px is the precedent set by `games/runner/src/game/chrome.ts` and
 * `games/pulse/src/render/chrome.ts`, and it is deliberately the same number in
 * all three.
 */
export const GESTURE_STRIP = 24

/** Share of the safe width the slate takes, and the ceiling on it for tablets. */
const SLATE_WIDTH_SHARE = 0.92
const SLATE_MAX_W = 720

/**
 * The slate's height as a share of its own width, and the share of the middle
 * field it is allowed to fill.
 *
 * The leftover is the RUNWAY — the room the slate travels through under a finger.
 * It does not need to be the whole throw: the slate is allowed to travel over the
 * chute and into the hoard, and past the commit line it is gone anyway. So the
 * runway is a margin, not a reservation, and the slate takes most of the field.
 */
const SLATE_ASPECT = 0.5
const SLATE_FIELD_SHARE = 0.8

/** The chute at the top: share of the playable column, and its bounds. */
const CHUTE_SHARE = 0.18
const CHUTE_MIN = 36
const CHUTE_MAX = 140

/** The hoard at the bottom: share of the playable column, and its bounds. */
const HOARD_SHARE = 0.22
const HOARD_MIN = 40
const HOARD_MAX = 190

/** The breathing room between the four stacked things. */
const GAP_SHARE = 0.045
const GAP_MIN = 8
const GAP_MAX = 28

export type Layout = {
  readonly w: number
  readonly h: number
  /** Where the dust meets the sky. Full bleed, deliberately. */
  readonly horizon: number
  /**
   * The first row the game owns: under the host's corner controls and hairline.
   * Exported so a test asserts the pinning against the number the game used.
   */
  readonly ceiling: number
  /** The last row the game owns: clear of the bottom inset and the gesture strip. */
  readonly floor: number
  /** The slate, at rest. The statement lives here and it is the whole game. */
  readonly slate: Rect
  /** The three shots as one box: the only resource there is. */
  readonly shots: Rect
  /** Radius of one shot pip, and the spacing between their centres. */
  readonly pip: number
  readonly pipGap: number
  /**
   * THE CHUTE, pinned to the TOP of the playable column: where a claim you do
   * not believe is thrown. It carries the `≠` mark, and that mark is the whole
   * of the instructions.
   */
  readonly chute: Rect
  /**
   * THE HOARD, pinned to the BOTTOM: the keep pile, the coin count, and the
   * score. It carries the `=` mark.
   */
  readonly bag: Rect
  /** Type size for the coin count on the hoard. */
  readonly bagPx: number
  /**
   * ── THE FOUR BANDS THAT MAKE THE TWO DESTINATIONS READABLE ────────────────
   *
   * Each destination carries two things: the CHEVRONS that light under a
   * committing finger, and the MARK that says which answer it is — `≠` above,
   * `=` below.
   *
   * They are separate rectangles rather than two fractions inside one because
   * the hoard is 190 px tall on an iPad and 40 px tall on a 568×320 phone with a
   * portrait notch, and "put the mark in the middle of the chevrons" is legible
   * at one of those and a smudge at the other. Computed here, asserted by
   * `street.test.ts`, and read by `scene.ts` — no arithmetic in the drawing code.
   */
  readonly chuteFlow: Rect
  readonly chuteMark: Rect
  readonly hoardFlow: Rect
  readonly hoardMark: Rect
  /** Type size for the two destination marks. Fits the SMALLER of the two bands. */
  readonly markPx: number
  /** Where the lip of the pile is ruled, and where the coin count sits on it. */
  readonly lipY: number
  readonly countY: number
  /** The top of the card stack, and one card's thickness. */
  readonly pileY: number
  readonly cardH: number
}

/** The insets `area` was cut from. Exact: `safeRect` is the only thing that cuts it. */
function insetsOf(w: number, h: number, area: Rect): {
  top: number
  right: number
  bottom: number
  left: number
} {
  return {
    top: area.y,
    left: area.x,
    right: Math.max(0, w - area.x - area.w),
    bottom: Math.max(0, h - area.y - area.h),
  }
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

/**
 * The street, at `w` x `h`, with `area` as the region a child may be asked to
 * read.
 *
 * `area` is REQUIRED, and that is the point of this signature. Made optional it
 * would default to the full canvas, a caller that forgot it would compile
 * cleanly, and the only way anyone would find out is a child on a notched phone
 * being asked to judge a sum whose last digit is behind the camera. Required,
 * forgetting it is a type error.
 */
export function layoutFor(w: number, h: number, area: Rect): Layout {
  // The world. Not derived from `area`: the ground is supposed to reach the
  // bottom of the glass, under the home indicator, and the sky the top.
  const horizon = h * 0.6

  // The host's chrome, rebuilt from `area` rather than measured again, so the game
  // and the host cannot end up disagreeing about where the buttons are.
  const insets = insetsOf(w, h, area)
  const exit = exitRect(insets)
  const help = helpRect(w, insets)
  const chromeBottom = Math.max(exit.y + exit.h, help.y + help.h)

  /** The two ends of the column the game owns. Everything else is measured off them. */
  const ceiling = Math.max(area.y + HOST_PROGRESS_H, chromeBottom + HOST_MARGIN)
  const floor = Math.min(area.y + area.h, h - GESTURE_STRIP)
  const field = Math.max(1, floor - ceiling)

  const gap = clamp(field * GAP_SHARE, GAP_MIN, GAP_MAX)
  const bagPx = Math.round(Math.max(15, h * 0.03))
  const pip = Math.max(3.5, h * 0.0075)
  const pipGap = pip * 3.4
  const shotsW = pipGap * (SHOTS - 1) + pip * 2

  const chuteH = clamp(field * CHUTE_SHARE, CHUTE_MIN, CHUTE_MAX)
  const bagH = clamp(field * HOARD_SHARE, Math.max(HOARD_MIN, bagPx * 2.2), HOARD_MAX)

  // ── pinned to the bottom ──────────────────────────────────────────────────
  const bagY = floor - bagH
  const shotsCentre = bagY - gap - pip
  const shotsY = shotsCentre - pip

  // ── pinned to the top ─────────────────────────────────────────────────────
  const chuteY = ceiling

  // ── and the slate takes the middle ────────────────────────────────────────
  const slateW = Math.min(area.w * SLATE_WIDTH_SHARE, SLATE_MAX_W)
  const slateX = area.x + (area.w - slateW) / 2
  const fieldTop = chuteY + chuteH + gap
  const fieldBottom = shotsY - gap
  const middle = Math.max(1, fieldBottom - fieldTop)
  const slateH = Math.min(slateW * SLATE_ASPECT, middle * SLATE_FIELD_SHARE)
  const slateY = fieldTop + (middle - slateH) / 2

  const cx = area.x + area.w / 2
  const bagW = Math.max(bagH, Math.min(area.w * 0.62, bagPx * 7))
  const bagX = cx - bagW / 2

  // ── inside the two destinations ───────────────────────────────────────────
  //
  // The chevrons go on the side nearest the SLATE, because that is the way the
  // card is travelling; the mark goes beyond them, at the far end, where nothing
  // is drawn over it. On the hoard that leaves the lip, the count and the card
  // stack below, in that order, each in its own band.
  const chuteFlow = { x: slateX, y: chuteY + chuteH * 0.46, w: slateW, h: chuteH * 0.54 }
  const chuteMark = { x: slateX, y: chuteY, w: slateW, h: chuteH * 0.42 }
  const hoardFlow = { x: bagX, y: bagY, w: bagW, h: bagH * 0.2 }
  const hoardMark = { x: bagX, y: bagY + bagH * 0.22, w: bagW, h: bagH * 0.2 }

  return {
    w,
    h,
    horizon,
    ceiling,
    floor,
    slate: { x: slateX, y: slateY, w: slateW, h: slateH },
    shots: { x: cx - shotsW / 2, y: shotsY, w: shotsW, h: pip * 2 },
    pip,
    pipGap,
    chute: { x: slateX, y: chuteY, w: slateW, h: chuteH },
    bag: { x: bagX, y: bagY, w: bagW, h: bagH },
    bagPx,
    chuteFlow,
    chuteMark,
    hoardFlow,
    hoardMark,
    // 1.2 rather than 1.0 because a mark is two rules and a slash — it occupies
    // about three quarters of its nominal size, not all of it.
    markPx: Math.round(clamp(Math.min(chuteMark.h, hoardMark.h) * 1.2, 11, 40)),
    lipY: bagY + bagH * 0.46,
    countY: bagY + bagH * 0.62,
    pileY: bagY + bagH * 0.72,
    cardH: Math.max(1.5, bagH * 0.022),
  }
}

/**
 * The stacked things, top to bottom, as the test reads them.
 *
 * Exported because "nothing overlaps and no band is dead" is a claim about the
 * ORDER as much as about the boxes, and a test that re-derived the order would be
 * asserting its own opinion of it.
 */
export function columnOf(l: Layout): readonly (readonly [string, Rect])[] {
  return [
    ["the chute", l.chute],
    ["the slate", l.slate],
    ["the shots", l.shots],
    ["the hoard", l.bag],
  ]
}

/**
 * How much of the playable column is used, and the largest single band of
 * nothing left in it.
 *
 * This is the founder's complaint, as two numbers. Before the layout was pinned,
 * a 320×568 phone with a notch showed `covered 0.39, deadest 0.39` — a third of
 * the column occupied and a third of it dead in one continuous strip below the
 * hoard.
 */
export function densityOf(l: Layout): { covered: number; deadest: number } {
  const field = Math.max(1, l.floor - l.ceiling)
  let covered = 0
  let deadest = 0
  let cursor = l.ceiling
  for (const [, box] of columnOf(l)) {
    deadest = Math.max(deadest, box.y - cursor)
    covered += box.h
    cursor = Math.max(cursor, box.y + box.h)
  }
  deadest = Math.max(deadest, l.floor - cursor)
  return { covered: covered / field, deadest: deadest / field }
}
