/**
 * Where ABYSSAL BLOOM's chrome goes — as numbers, so a test can check it.
 *
 * **Why this file exists.** The reef declares `viewport-fit=cover`, which is not
 * a neutral setting: it opts the document *into* the notch, the home indicator
 * and the rounded corners. Until now the essence odometer sat at `top: 8px`,
 * `left: 12px` of the glass, which on a notched phone is underneath the notch
 * and underneath the host's exit chevron — and the pips sat at the far right,
 * underneath the how-to-play control. The two things a child reads constantly
 * were the two things covered up.
 *
 * The host does NOT reserve a band for its chrome; it floats over the game and
 * asks each game for one promise instead: nothing a child must READ or TOUCH
 * lands in the two 44px corners. (Reserving a band was tried and cost 12% of a
 * small phone's height — see `packs/shared/game-chrome/hostChrome.ts`.) So the
 * band still spans the full width and its gradient still bleeds to both edges;
 * it is the readout INSIDE it that is pushed past both corners.
 *
 * Everything here is pure arithmetic: no DOM, no `env()`, no measuring. The
 * safe rectangle arrives as an argument, which is what makes the whole layout
 * testable at 320x568 in node.
 */

import { exitRect, helpRect, type Rect } from '../../../../packs/shared/game-chrome/index.ts'

export type Insets = { top: number; right: number; bottom: number; left: number }

/** Breathing room between the host's controls and anything of ours. */
const GAP = 8

/** The band's own padding, above and below the readout. */
const BAND_TOP = 8
const BAND_BOTTOM = 6

/**
 * The two fixed lines of the readout, in px, locked by `line-height` in the
 * HUD's stylesheet. Fixed on purpose: the band's height is the stage's origin,
 * and a stage origin that depends on a font metric is a stage origin that moves
 * when the platform font does.
 */
const CAP_H = 11
const RATE_H = 14
/** `.ab-essence` is a 1px-gap column of three rows. */
const ROW_GAP = 1

/** The mute button, and its gap from the stage's top-right corner. */
const MUTE = 30
const MUTE_GAP = 8

/** The action rail: one row of buttons, its gaps and its padding. */
const RAIL_BTN = 46
const RAIL_GAP = 6
const RAIL_TOP = 6
const RAIL_BOTTOM = 10
/** Above this width the rail is four across instead of two; matches the CSS. */
const RAIL_WIDE = 620

export type Chrome = {
  w: number
  h: number
  inset: Insets
  /** The whole top band. Its gradient bleeds edge to edge, and should. */
  band: Rect
  /**
   * What the child READS up there: the essence odometer, the rate, the flow
   * pill and the magnitude pips. Clear of both host corners at every viewport,
   * which is the assertion in `chrome.test.ts`.
   */
  readout: Rect
  /** Digit height of the odometer, px. */
  odoPx: number
  /** The mute button, in viewport coordinates. */
  mute: Rect
  /** The canvas stage, between the band and the rail. */
  stage: Rect
  /**
   * The action rail, at the height it takes with the four standing buttons.
   * DISSOLVE appears only on a crowded shelf and adds a row; the DOM measures
   * that for itself, and only this nominal height is ever laid out against.
   */
  rail: Rect
  /** The band's padding, for the DOM to apply verbatim. */
  bandPad: { top: number; right: number; bottom: number; left: number }
  /** The rail's padding — this is where the home indicator is kept out. */
  railPad: { top: number; right: number; bottom: number; left: number }
}

/**
 * Recover the insets from a safe rectangle.
 *
 * The rest of the game only ever holds the safe rect, and `exitRect`/`helpRect`
 * want insets. Deriving them here means one measurement, taken once per layout,
 * flows through everything — instead of a second `safeInsets()` call that could
 * disagree with the first across a rotation.
 */
export function insetsOf(w: number, h: number, area: Rect): Insets {
  return {
    top: Math.max(0, area.y),
    left: Math.max(0, area.x),
    right: Math.max(0, w - area.x - area.w),
    bottom: Math.max(0, h - area.y - area.h),
  }
}

const clamp = (lo: number, hi: number, v: number): number => Math.max(lo, Math.min(hi, v))

/**
 * The whole frame, from the glass size and the safe rectangle.
 *
 * `area` is REQUIRED, deliberately — the same call the pilot game makes. Made
 * optional, a caller that forgets it gets a HUD that quietly draws under the
 * notch and under the host's exit control, and the only way to find out is on a
 * notched device. Required, forgetting it does not compile.
 */
export function chromeLayout(w: number, h: number, area: Rect): Chrome {
  const inset = insetsOf(w, h, area)
  const exit = exitRect(inset)
  const help = helpRect(w, inset)

  // Past the chevron on the left, past the ? on the right. The band itself
  // still starts at x=0 so its gradient covers the whole top edge.
  const padLeft = exit.x + exit.w + GAP
  const padRight = Math.max(0, w - help.x) + GAP
  const padTop = inset.top + BAND_TOP
  const readoutW = Math.max(1, w - padLeft - padRight)

  const odoPx = Math.round(clamp(26, 48, readoutW * 0.14))
  const readoutH = CAP_H + ROW_GAP + odoPx + ROW_GAP + RATE_H
  const bandH = padTop + readoutH + BAND_BOTTOM

  const rows = w >= RAIL_WIDE ? 1 : 2
  const railH = RAIL_TOP + rows * RAIL_BTN + (rows - 1) * RAIL_GAP + RAIL_BOTTOM + inset.bottom
  const stageH = Math.max(1, h - bandH - railH)

  return {
    w,
    h,
    inset,
    band: { x: 0, y: 0, w, h: bandH },
    readout: { x: padLeft, y: padTop, w: readoutW, h: readoutH },
    odoPx,
    mute: { x: w - inset.right - MUTE_GAP - MUTE, y: bandH + MUTE_GAP, w: MUTE, h: MUTE },
    stage: { x: 0, y: bandH, w, h: stageH },
    rail: { x: 0, y: bandH + stageH, w, h: railH },
    bandPad: { top: padTop, right: padRight, bottom: BAND_BOTTOM, left: padLeft },
    railPad: {
      top: RAIL_TOP,
      right: RAIL_BOTTOM + inset.right,
      bottom: RAIL_BOTTOM + inset.bottom,
      left: RAIL_BOTTOM + inset.left,
    },
  }
}

/**
 * The safe rectangle *inside the canvas stage*, in the stage's own coordinates.
 *
 * The stage is full-bleed on purpose — the water, the light shafts and every
 * particle should run under the rounded corners, which is the entire reason
 * `cover` is set. What must stay inside this rect is the shelf and the vents:
 * the numerals a child reads and the mouths they drop into.
 *
 * There is no top or bottom inset left to pay: the band above already carries
 * the notch and the rail below already carries the home indicator. Only the
 * left and right ones survive, and in landscape they are the whole problem —
 * the vent column sits hard against the right edge, which on a phone held wide
 * is exactly where the sensor housing is.
 */
export function stageAreaFor(c: Chrome, stageW: number, stageH: number): Rect {
  return {
    x: c.inset.left,
    y: 0,
    w: Math.max(1, stageW - c.inset.left - c.inset.right),
    h: Math.max(1, stageH),
  }
}
