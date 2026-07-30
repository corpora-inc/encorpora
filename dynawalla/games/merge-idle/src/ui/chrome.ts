/**
 * Where ABYSSAL BLOOM's chrome goes — as numbers, so a test can check it.
 *
 * **Why this file exists.** The reef declares `viewport-fit=cover`, which is not a
 * neutral setting: it opts the document *into* the notch, the home indicator and
 * the rounded corners. The host does NOT reserve a band for its own chrome; it
 * floats over the game and asks each game for one promise instead: nothing a child
 * must READ or TOUCH lands in the two 44px corners. (Reserving a band was tried
 * and cost 12% of a small phone's height — see
 * `packs/shared/game-chrome/hostChrome.ts`.) So the band spans the full width and
 * its gradient bleeds to both edges; it is the readout INSIDE it that is pushed
 * past both corners.
 *
 * **`env(safe-area-inset-*)` is never read here, or anywhere in this pack.** It is
 * zero inside a sandboxed pack frame, and four games in this fleet shipped with a
 * HUD under the notch because of it. The safe rectangle arrives as an argument,
 * measured once per layout by the shared chrome module, which is also what makes
 * the whole layout testable at 320x568 in node.
 *
 * ## What is up there now
 *
 * One thing: **the target**. The band used to hold an essence odometer, a
 * per-second rate, a FLOW pill and a twelve-pip magnitude meter, and the founder's
 * verdict was "the top is sort of useless too ... none of that even really makes
 * sense or seems to do anything". `core/economy.ts` argues each deletion. What
 * replaced them is the number the whole game is about, at the largest size the
 * space between the two host corners can hold, plus a hairline that fills as the
 * reef deepens and pops when the shelf grows.
 *
 * ## The band's height cannot depend on the target
 *
 * `18` and `1,024 = ▢ ÷ ▢` are very different widths, and the band's height is the
 * canvas stage's origin — so sizing the type to the *current* face would move every
 * polyp on the shelf every time the target changed. The size is therefore computed
 * for a fixed line box and the real face is fitted inside it. `chrome.test.ts`
 * asserts both halves: the band is the same height for every face, and the widest
 * face this game can produce still fits between the two host corners.
 */

import { exitRect, helpRect, type Rect } from '../../../../packs/shared/game-chrome/index.ts'

export type Insets = { top: number; right: number; bottom: number; left: number }

/** Breathing room between the host's controls and anything of ours. */
const GAP = 8

/** The band's own padding, above and below the readout. */
const BAND_TOP = 8
const BAND_BOTTOM = 8

/** The bloom hairline: how far the reef is from its next growth. */
export const METER_H = 5
const METER_GAP = 6

/** The two stage buttons: CLEAR and mute, in the corners the host does not use. */
export const STAGE_BTN = 44
const STAGE_BTN_GAP = 10

/**
 * Is the mouth a panel down the right rather than a bar along the bottom?
 *
 * Defined here, and imported by the renderer, because BOTH have to agree: the
 * renderer decides where the mouth goes and this file decides where the two buttons
 * go, and a mouth that thinks it is a bottom bar while the buttons think they are in
 * the bottom corners is a mouth with a mute button inside it. That is exactly what
 * the first version did — `layout.test.ts` failed at every landscape viewport with
 * "the mouth covers a 44px button".
 */
export function isMouthColumn(stageW: number, stageH: number): boolean {
  return stageW / Math.max(1, stageH) > 1.15
}

/**
 * Per-character advances for the target face, in units of the type size.
 *
 * Written out rather than measured, because a font measurement cannot happen in
 * node and this file's whole value is that it is checkable there. Deliberately
 * generous: over-estimating the width only ever picks a *smaller* type size, and
 * "one pixel too wide for the box" is the failure that costs a child their number.
 */
const EM_DIGIT = 0.63
const EM_SEP = 0.3
const EM_SPACE = 0.32
const EM_WIDE = 0.78

export function faceEm(face: string): number {
  let em = 0
  for (const ch of face) {
    if (ch >= '0' && ch <= '9') em += EM_DIGIT
    else if (ch === ',') em += EM_SEP
    else if (ch === ' ') em += EM_SPACE
    else em += EM_WIDE
  }
  return em
}

/**
 * The widest face this game can ever put up.
 *
 * `difficultyAt` caps the curriculum request at rung 7, whose answers are at most
 * six figures, and the roomiest form is `over`. So this string is the ceiling, and
 * it is what the type size is solved against.
 */
export const WIDEST_FACE = '999,999 = ▢ ÷ ▢'

export type Chrome = {
  w: number
  h: number
  inset: Insets
  /** The whole top band. Its gradient bleeds edge to edge, and should. */
  band: Rect
  /**
   * What the child READS up there: the target, and the bloom hairline under it.
   * Clear of both host corners at every viewport, which is the assertion in
   * `chrome.test.ts`.
   */
  readout: Rect
  /** The target's line box. Fixed height, whatever the face says. */
  face: Rect
  /** The bloom hairline. */
  meter: Rect
  /** Type size of the target, px. Solved against `WIDEST_FACE`, never the face. */
  facePx: number
  /** The canvas stage, below the band. There is no rail any more. */
  stage: Rect
  /**
   * CLEAR, in viewport coordinates. Bottom-left in portrait; in landscape it moves
   * beside the mute button on the right, because the bottom-left of a landscape
   * stage is shelf — see `isMouthColumn`.
   */
  dissolve: Rect
  /** The mute toggle, in viewport coordinates. Always the bottom-right corner. */
  mute: Rect
  /** The band's padding, for the DOM to apply verbatim. */
  bandPad: { top: number; right: number; bottom: number; left: number }
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
 * `area` is REQUIRED, deliberately. Made optional, a caller that forgets it gets a
 * HUD that quietly draws under the notch and under the host's exit control, and the
 * only way to find out is on a notched device. Required, forgetting it does not
 * compile.
 */
export function chromeLayout(w: number, h: number, area: Rect): Chrome {
  const inset = insetsOf(w, h, area)
  const exit = exitRect(inset)
  const help = helpRect(w, inset)

  // Past the chevron on the left, past the ? on the right. The band itself still
  // starts at x=0 so its gradient covers the whole top edge.
  const padLeft = exit.x + exit.w + GAP
  const padRight = Math.max(0, w - help.x) + GAP
  const padTop = inset.top + BAND_TOP
  const readoutW = Math.max(1, w - padLeft - padRight)

  // The LINE BOX, sized for legibility and not for the widest face.
  //
  // Sizing the box to `WIDEST_FACE` was tried and is wrong in the other
  // direction: on a 320px phone the room between the two host corners is 196px,
  // `999,999 = ▢ ÷ ▢` needs 8.5em of it, and `18` would then have been drawn at
  // 23px — a target a child has to lean in to read. So the box is a legible
  // height, it NEVER changes with the face, and a face too wide for it is shrunk
  // by `faceSizeFor` inside it. Fixed box, fitted type: the stage's origin cannot
  // move and every face is as large as it can be.
  //
  // On a short glass the cap is lower: a phone held sideways has width to spare
  // and no height at all, and a 64px target there costs the reef the room it
  // needs to draw a legible shelf.
  const cap = h < 480 ? 34 : h < 700 ? 48 : 62
  const facePx = Math.floor(clamp(20, cap, readoutW * 0.22))
  const readoutH = facePx + METER_GAP + METER_H
  const bandH = padTop + readoutH + BAND_BOTTOM
  const stageH = Math.max(1, h - bandH)

  const btnY = h - inset.bottom - STAGE_BTN_GAP - STAGE_BTN
  // In portrait the mouth is a bar across the bottom, so the buttons take the two
  // corners beside it. In landscape the mouth is a column down the RIGHT, and a
  // button in the bottom-left would sit on top of the shelf — so both go to the
  // bottom right, inside the column's own footprint, and the column is shortened by
  // `MOUTH_END_PAD` to make room.
  const column = isMouthColumn(w, stageH)
  const rightX = w - inset.right - STAGE_BTN_GAP - STAGE_BTN
  const dissolveX = column ? rightX - STAGE_BTN - STAGE_BTN_GAP : inset.left + STAGE_BTN_GAP
  return {
    w,
    h,
    inset,
    band: { x: 0, y: 0, w, h: bandH },
    readout: { x: padLeft, y: padTop, w: readoutW, h: readoutH },
    face: { x: padLeft, y: padTop, w: readoutW, h: facePx },
    meter: { x: padLeft, y: padTop + facePx + METER_GAP, w: readoutW, h: METER_H },
    facePx,
    stage: { x: 0, y: bandH, w, h: stageH },
    dissolve: { x: dissolveX, y: btnY, w: STAGE_BTN, h: STAGE_BTN },
    mute: { x: rightX, y: btnY, w: STAGE_BTN, h: STAGE_BTN },
    bandPad: { top: padTop, right: padRight, bottom: BAND_BOTTOM, left: padLeft },
  }
}

/**
 * The type size to draw `face` at, inside the fixed line box.
 *
 * Never larger than the box, so the band's height — and therefore the stage's
 * origin, and therefore every polyp on the shelf — is unaffected by what the
 * target says. `band.test.ts` asserts both halves: the box does not move, and the
 * widest face this game can produce still fits between the two host corners.
 */
export function faceSizeFor(c: Chrome, face: string): number {
  const em = faceEm(face)
  if (em <= 0) return c.facePx
  return Math.max(9, Math.floor(Math.min(c.facePx, c.readout.w / em)))
}

/**
 * The safe rectangle *inside the canvas stage*, in the stage's own coordinates.
 *
 * The stage is full-bleed on purpose — the water, the light shafts and every
 * particle should run under the rounded corners, which is the entire reason `cover`
 * is set. What must stay inside this rect is the shelf and the mouth: the numerals
 * a child reads and the socket they drop into.
 *
 * The band above already carries the notch, so there is no top inset left to pay.
 * The BOTTOM one survives now that the action rail is gone — the rail used to carry
 * the home indicator and there is no rail — and so does the strip the two stage
 * buttons sit in, because the mouth is a drop target and a polyp let go over
 * DISSOLVE must not go down the mouth.
 */
export function stageAreaFor(c: Chrome, stageW: number, stageH: number): Rect {
  return {
    x: c.inset.left,
    y: 0,
    w: Math.max(1, stageW - c.inset.left - c.inset.right),
    h: Math.max(1, stageH - c.inset.bottom),
  }
}

/**
 * How much of the mouth's long axis the two stage buttons take.
 *
 * The mouth is a DROP TARGET, so a polyp let go over CLEAR must not go down it.
 * Reserving the whole button row across the whole width would cost 54px of shelf for
 * two squares, so the MOUTH gives the room up instead and the buttons keep their
 * corners: in portrait this is taken off each end of the bar, and in landscape off
 * the bottom of the column. `layout.test.ts` asserts the three never overlap, at
 * every viewport and every shelf the reef can grow into.
 */
export const MOUTH_END_PAD = STAGE_BTN + STAGE_BTN_GAP * 2

