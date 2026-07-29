// Where everything sits.
//
// Computed once per resize and read everywhere else, so no draw call measures
// text or does trigonometry to find out where the mat is. The proportions hold
// from a 320px phone to a landscape iPad because they are all fractions of the
// short edge, with the two things a child touches — the pedals — pinned to a
// generous absolute minimum instead.
//
// Tablet and desktop are first-class targets, not a phone layout stretched: the
// ring is allowed to become wide and shallow, and the pedal band stops growing
// once it is comfortably bigger than a hand.
//
// **The frame is not the screen.** `computeLayout` takes the safe rectangle and
// takes it as a REQUIRED argument, because this game declares
// `viewport-fit=cover` and draws its whole HUD on a canvas. `env()` is a CSS
// value a canvas cannot see, so before this the board carrying the sum was laid
// out from `h` alone and its top edge went under the notch. Making the argument
// optional would mean a future caller that forgets it still compiles and only
// fails on a device, which is the bug this signature exists to prevent.
//
// **Two corners stay clear.** The host floats an exit control over the top-left
// and the how-to-play control over the top-right, 44px each. It does not
// reserve a band and this layout must not pretend it did — reserving one costs
// a twelfth of a small phone. Instead the belt and the board are confined to
// the horizontal channel BETWEEN the two corners, `topBar`. At 320×568 that is
// 196px of the 320, and the board narrows into it rather than moving down, so
// the ring keeps every pixel of its height.

import {
  HOST_CONTROL,
  HOST_MARGIN,
  HOST_PROGRESS_H,
  type Rect,
} from "../../../../packs/shared/game-chrome/index.ts"

/** Breathing room between a HUD edge and a host control. */
const CHROME_GAP = 8

/**
 * The narrowest channel the board is still worth squeezing into.
 *
 * Above this, the belt and the board narrow and the ring keeps its full height.
 * Below it — an iPad in a narrow Split View, a phone on its side with insets on
 * both long edges — there is not enough room left between the two corners to
 * set a four-digit sum, so the whole top band drops beneath them instead and
 * takes the width back. Narrowing is the default because dropping costs the
 * ring 65px, and 65px of a 568px phone is a twelfth of the game.
 */
const MIN_CHANNEL = 180

export type Layout = {
  w: number
  h: number
  /** The safe rectangle this layout was built from. Kept for stray labels. */
  safe: Rect
  /** Bottom of the crowd, top of the ring structure. */
  horizon: number
  /** The mat, in screen space. Corners are the four ring posts. */
  matTop: number
  matBottom: number
  matLeftTop: number
  matRightTop: number
  matLeftBottom: number
  matRightBottom: number
  /** Middle of the mat, where the pin happens. */
  cx: number
  cy: number
  /** The hanging board that carries the sum. */
  boardX: number
  boardY: number
  boardW: number
  boardH: number
  /** The pedal band. Split down the middle: light plate left, heavy right. */
  padTop: number
  padH: number
  /** The belt strip along the top. */
  beltY: number
  beltH: number
  /**
   * The horizontal channel at the top that no host control covers.
   *
   * The belt is laid out inside this and the board never grows past its width.
   * Everything else — the crowd, the ring, the pedals — bleeds to the screen
   * edge, which is the whole reason `viewport-fit=cover` is set.
   */
  topBar: Rect
  /** Base size for stamped numerals. */
  unit: number
}

export function computeLayout(w: number, h: number, area: Rect): Layout {
  const short = Math.min(area.w, area.h)
  const wide = area.w / area.h > 1.35

  const beltH = Math.max(24, Math.min(44, short * 0.075))

  // The channel between the host's two 44px corners. Anything a child has to
  // READ at the top of this game lives in here.
  const rail = HOST_MARGIN + HOST_CONTROL + CHROME_GAP
  const channelW = area.w - rail * 2
  const narrow = channelW < MIN_CHANNEL
  const topY = narrow
    ? area.y + HOST_PROGRESS_H + HOST_MARGIN + HOST_CONTROL + CHROME_GAP
    : area.y

  const beltY = topY + beltH * 0.28
  const topBar: Rect = narrow
    ? { x: area.x, y: beltY, w: area.w, h: beltH }
    : { x: area.x + rail, y: beltY, w: channelW, h: beltH }

  const boardH = Math.max(56, Math.min(140, area.h * (wide ? 0.19 : 0.145)))
  const boardW = Math.min(area.w * 0.86, Math.max(220, short * 1.15), topBar.w)
  const boardY = beltY + beltH + Math.max(6, area.h * 0.018)
  // Centred in the safe area. The channel is symmetric about that centre, so a
  // board that fits the channel is centred in it too.
  const boardX = area.x + (area.w - boardW) / 2

  // The pedals get the bottom of the screen and a floor of 150px, because a
  // four-second escape is lost on a thumb that missed, not on the arithmetic.
  // The band is measured inside the safe area so the stamped numeral clears the
  // home indicator; the socket behind it still fills to the glass, in `hud.ts`.
  const padH = Math.max(150, Math.min(300, area.h * (wide ? 0.34 : 0.29)))
  const padTop = area.y + area.h - padH

  const horizon = boardY + boardH + Math.max(8, area.h * 0.02)
  const matTop = horizon + Math.max(18, area.h * 0.045)
  const matBottom = padTop - Math.max(12, area.h * 0.03)

  // The ring is drawn in a shallow one-point perspective: the far edge is
  // narrower than the near one. Just enough to sit the figures *in* something.
  const inset = Math.min(w * 0.09, 74)
  const matLeftTop = inset + (w - inset * 2) * 0.11
  const matRightTop = w - matLeftTop
  const matLeftBottom = inset * 0.42
  const matRightBottom = w - matLeftBottom

  return {
    w,
    h,
    safe: area,
    horizon,
    matTop,
    matBottom,
    matLeftTop,
    matRightTop,
    matLeftBottom,
    matRightBottom,
    cx: w / 2,
    cy: (matTop + matBottom) / 2,
    boardX,
    boardY,
    boardW,
    boardH,
    padTop,
    padH,
    beltY,
    beltH,
    topBar,
    unit: Math.max(12, short * 0.052),
  }
}

/** Half-width of the mat at a given screen y. Outside the mat, clamped. */
export function matHalfWidth(l: Layout, y: number): number {
  const t = Math.max(0, Math.min(1, (y - l.matTop) / Math.max(1, l.matBottom - l.matTop)))
  const left = l.matLeftTop + (l.matLeftBottom - l.matLeftTop) * t
  const right = l.matRightTop + (l.matRightBottom - l.matRightTop) * t
  return (right - left) / 2
}
