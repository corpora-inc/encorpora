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

export type Layout = {
  w: number
  h: number
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
  /** Base size for stamped numerals. */
  unit: number
}

export function computeLayout(w: number, h: number): Layout {
  const short = Math.min(w, h)
  const wide = w / h > 1.35

  const beltH = Math.max(24, Math.min(44, short * 0.075))
  const beltY = beltH * 0.28

  const boardH = Math.max(56, Math.min(140, h * (wide ? 0.19 : 0.145)))
  const boardW = Math.min(w * 0.86, Math.max(220, short * 1.15))
  const boardY = beltY + beltH + Math.max(6, h * 0.018)
  const boardX = (w - boardW) / 2

  // The pedals get the bottom of the screen and a floor of 150px, because a
  // four-second escape is lost on a thumb that missed, not on the arithmetic.
  const padH = Math.max(150, Math.min(300, h * (wide ? 0.34 : 0.29)))
  const padTop = h - padH

  const horizon = boardY + boardH + Math.max(8, h * 0.02)
  const matTop = horizon + Math.max(18, h * 0.045)
  const matBottom = padTop - Math.max(12, h * 0.03)

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
