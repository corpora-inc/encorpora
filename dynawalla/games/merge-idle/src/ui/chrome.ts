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

/** The action rail: its button, its gaps and its padding. */
const RAIL_BTN = 46
const RAIL_GAP = 6
const RAIL_TOP = 6
const RAIL_BOTTOM = 10
/** Above this width the rail is five across instead of three. */
const RAIL_WIDE = 620
/**
 * ...and below this height it is five across too, whatever the width.
 *
 * A small phone held sideways has about 320px of glass. Two rows of buttons
 * take 52px of it, and once the band and the vent strip have taken theirs the
 * shelf is left with too little to draw a legible 5x6 on — `layout.test.ts`
 * says so out loud. Height is the scarce axis there and width is not, so the
 * rail spends the width instead.
 */
const RAIL_SHORT = 480
/**
 * Every action the rail can EVER show, including the ones a child has not
 * unlocked yet.
 *
 * DISSOLVE used to be `visible: false` until the shelf filled up, and a
 * `display:none` button takes no grid cell — so the rail was two rows, then
 * three, and the whole reef jumped upward the moment the shelf filled. A
 * control appearing must never reflow the playfield, so the slot is counted
 * here whether or not the button is usable yet, the grid is three across
 * (five on a wide screen) so five buttons still make two rows (one), and the
 * button is merely `disabled` until it works — the same greyed-out idiom
 * UPWELL already uses when a child cannot afford it, which has the side
 * benefit of advertising that DISSOLVE exists at all.
 */
export const RAIL_SLOTS = 5

/** How many buttons the rail puts on a row. Applied to the grid by `hud.ts`. */
function railColumns(w: number, h: number): number {
  return w >= RAIL_WIDE || h < RAIL_SHORT ? 5 : 3
}

/**
 * Font size of a button's label, px.
 *
 * Derived here rather than from a `@media` rule, because a media query
 * resolves against the VIEWPORT while everything else in this file resolves
 * against the element the pack was given — and in Split View those are not the
 * same number.
 */
function railLabelPx(w: number): number {
  return w >= RAIL_WIDE ? 11 : 10
}

/** `.ab-btn` horizontal padding, matching the stylesheet. */
const BTN_PAD_X = 6

/**
 * The width of one rail button, and the width of the text INSIDE it.
 *
 * Narrowing the rail from two columns to three is what keeps five buttons in
 * two rows and stops the reef jumping. It also makes each button narrower, and
 * `OVERCHARGE` is a long word — so the room for it is arithmetic here and
 * asserted in `band.test.ts` rather than discovered on a device.
 */
export function railButtonText(c: Chrome): number {
  const inner = c.w - c.railPad.left - c.railPad.right
  const cols = c.railCols
  return Math.max(0, (inner - RAIL_GAP * (cols - 1)) / cols - BTN_PAD_X * 2)
}

/**
 * How tall the rail is with `buttons` of them showing.
 *
 * Exported so the reflow rule can be MEASURED: `band.test.ts` lays the stage
 * out at four buttons and at five and asserts the shelf does not move. The
 * layout itself only ever asks for `RAIL_SLOTS`.
 */
export function railHeight(w: number, h: number, insetBottom: number, buttons: number): number {
  const rows = Math.max(1, Math.ceil(buttons / railColumns(w, h)))
  return RAIL_TOP + rows * RAIL_BTN + (rows - 1) * RAIL_GAP + RAIL_BOTTOM + insetBottom
}

/* ------------------------------------------------------------------ readout */

/**
 * Column widths inside the odometer, in units of the digit height.
 *
 * These are applied verbatim as inline `width`s by `hud.ts`, so the odometer's
 * width is arithmetic rather than a font measurement — which is what lets the
 * check below be a test instead of a screenshot.
 */
export const DIGIT_EM = 0.63
export const SEP_EM = 0.3
export const UNIT_EM = 0.62

/**
 * The magnitude meter, as a fixed two-row grid rather than a `flex-wrap` that
 * breaks wherever it happens to run out of room. Twelve pips wrapped by
 * `max-width:44%` left ONE orphan dot on a second row, hanging under the right
 * end of the meter, which is exactly what a child sees as "broken".
 */
export const PIPS_PER_ROW = 6
export const PIP = 7
export const PIP_GAP = 3
const PIPS_W = PIPS_PER_ROW * PIP + (PIPS_PER_ROW - 1) * PIP_GAP

/**
 * The FLOW pill, at the width `×9.9 FLOW` takes: nine characters at 10px and a
 * 900 weight, plus 7px of padding and a 1px border on each side. It lives in
 * the right-hand column and NOT on the rate line — sharing that line is what
 * squeezed `▲ 899 / sec` onto two rows.
 */
const FLOW_W = 74

/** The gap between the essence column and the pips/FLOW column beside it. */
const COL_GAP = 10
/** The right-hand column: FLOW above, the pip meter below. */
const SIDE_W = Math.max(PIPS_W, FLOW_W)

/** The longest rate line the game can emit: `▲ 999.9Qi / sec`. */
const RATE_CHARS = 15
/** A deliberately fat per-character advance for the rate line's font. */
const RATE_EM = 0.66

/**
 * How wide `text` is in the odometer, in px.
 *
 * Digits are fixed-width columns; a comma or a decimal point is narrow; the
 * magnitude suffix (`K`, `Qa`, …) is a letter. Nothing here measures a font,
 * which is the point.
 */
export function odoWidth(text: string, px: number): number {
  let em = 0
  for (const ch of text) {
    if (ch >= '0' && ch <= '9') em += DIGIT_EM
    else if (ch === ',' || ch === '.') em += SEP_EM
    else em += UNIT_EM
  }
  return em * px
}

/**
 * The widest string `fmtCompact` can ever hand the odometer, in units of the
 * digit height: `999.9Qa` — four digits, a point and a two-letter unit.
 *
 * Below 100,000 the formatter uses grouped digits, and `99,999` is 3.45em,
 * narrower. The odometer's size is capped so that this fits the essence column
 * at every viewport, because the alternative is what shipped: the digit
 * columns are `overflow:hidden` flex items, whose automatic minimum size is
 * therefore ZERO, so when the odometer overflowed they collapsed to nothing
 * while the comma and the `K` — which are not `overflow:hidden`, and so cannot
 * shrink below their content — survived. The child saw `.K`, and could not
 * read their own score.
 */
export const ODO_MAX_EM = 4 * DIGIT_EM + SEP_EM + 2 * UNIT_EM

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
  /** The left column of the readout: the ESSENCE cap, the odometer, the rate. */
  essence: Rect
  /** The right column: the FLOW pill above, the magnitude meter below. */
  side: Rect
  /** Digit height of the odometer, px. */
  odoPx: number
  /** Font size of the rate line, px — sized so it cannot wrap. */
  ratePx: number
  /** How many buttons the action rail puts on a row. */
  railCols: number
  /** Font size of a rail button's label, px. */
  railLabelPx: number
  /** The mute button, in viewport coordinates. */
  mute: Rect
  /** The canvas stage, between the band and the rail. */
  stage: Rect
  /**
   * The action rail, at the height it takes with every slot filled — which is
   * always, now. Nothing in the rail is conditionally present, so this height
   * is the real one and the stage below it never moves.
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

  // The odometer does NOT get the whole band. It gets the left column, and it
  // is sized so its widest possible string fits that column — see ODO_MAX_EM.
  const sideW = Math.min(SIDE_W, Math.max(0, readoutW - COL_GAP - 90))
  const essenceW = Math.max(1, readoutW - COL_GAP - sideW)
  // On a short glass the odometer is capped harder. A phone held sideways has
  // width to spare and no height at all, and a 48px score there costs the reef
  // the room it needs to draw a legible shelf — `layout.test.ts` fails outright
  // without this. Height is the scarce axis; spend it where the game is.
  //
  // FLOOR, not round: rounding up is how a number that "just fits" the
  // arithmetic ends up one pixel too wide for the box on the glass.
  const odoMax = h < RAIL_SHORT ? 34 : 48
  const odoPx = Math.floor(clamp(22, odoMax, Math.min(essenceW * 0.26, essenceW / ODO_MAX_EM)))
  const ratePx = Math.floor(clamp(9, 12, essenceW / (RATE_CHARS * RATE_EM)))
  const readoutH = CAP_H + ROW_GAP + odoPx + ROW_GAP + RATE_H
  const bandH = padTop + readoutH + BAND_BOTTOM

  const railCols = railColumns(w, h)
  const railH = railHeight(w, h, inset.bottom, RAIL_SLOTS)
  const stageH = Math.max(1, h - bandH - railH)

  return {
    w,
    h,
    inset,
    band: { x: 0, y: 0, w, h: bandH },
    readout: { x: padLeft, y: padTop, w: readoutW, h: readoutH },
    essence: { x: padLeft, y: padTop, w: essenceW, h: readoutH },
    side: { x: padLeft + essenceW + COL_GAP, y: padTop, w: sideW, h: readoutH },
    odoPx,
    ratePx,
    railCols,
    railLabelPx: railLabelPx(w),
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
