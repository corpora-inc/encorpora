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
//   * the READABLE things — the slate, the three shots, the tally — laid out
//     inside `area`, the safe rectangle, and clear of the host's two corners.
//
// The host paints an exit control top-LEFT and a how-to-play control top-RIGHT,
// 44px each, floating over the game. They do not reserve a band: reserving one
// costs a twelfth of a 568px phone and broke a sibling game's own layout. The
// promise each game makes instead is narrow and absolute — nothing a child must
// read or touch lands in those two squares. The slate is 88% of the width, so
// at most viewports it cannot pass between them; when it cannot, it goes below
// them, and that is the whole of the clamp.

import {
  exitRect,
  helpRect,
  HOST_MARGIN,
  HOST_PROGRESS_H,
  type Rect,
} from "../../../../packs/shared/game-chrome/index.ts"
import { SHOTS } from "../game/run.ts"

export type { Rect }

export type Layout = {
  readonly w: number
  readonly h: number
  /** Where the dust meets the sky. Full bleed, deliberately. */
  readonly horizon: number
  /** The slate, at rest. The statement lives here and it is the whole game. */
  readonly slate: Rect
  /** The three shots as one box: the only resource there is. */
  readonly shots: Rect
  /** Radius of one shot pip, and the spacing between their centres. */
  readonly pip: number
  readonly pipGap: number
  /** The call tally, small, in brass, above the slate. */
  readonly tally: Rect
  readonly tallyPx: number
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

  const slateW = Math.min(area.w * 0.88, 640)
  const slateH = slateW * 0.3
  const slateX = area.x + (area.w - slateW) / 2

  const pip = Math.max(3.5, h * 0.0075)
  const pipGap = pip * 3.4
  const shotsW = pipGap * (SHOTS - 1) + pip * 2
  /** From the bottom of the slate down to the centre of the pips. */
  const shotsDrop = pip * 5

  const tallyPx = Math.round(Math.max(15, h * 0.026))

  // The host's chrome, rebuilt from `area` rather than measured again, so the
  // game and the host cannot end up disagreeing about where the buttons are.
  const insets = insetsOf(w, h, area)
  const exit = exitRect(insets)
  const help = helpRect(w, insets)
  const chromeBottom = Math.max(exit.y + exit.h, help.y + help.h)
  const passesBetween =
    slateX >= exit.x + exit.w + HOST_MARGIN && slateX + slateW <= help.x - HOST_MARGIN
  const ceiling = passesBetween ? area.y : chromeBottom + HOST_MARGIN

  // Centred four tenths down the safe area — high enough that a thumb is not
  // over the statement it is about to judge.
  let slateY = Math.max(ceiling, area.y + area.h * 0.4 - slateH / 2)
  // ...and lifted back up if the shots would fall off the safe bottom. The
  // ceiling still wins: a slate under the exit button is worse than pips near
  // the home indicator, and on no shape the fleet has does it come to that.
  const overflow = slateY + slateH + shotsDrop + pip - (area.y + area.h)
  if (overflow > 0) slateY = Math.max(ceiling, slateY - overflow)

  const cx = area.x + area.w / 2
  const shotsY = slateY + slateH + shotsDrop

  // The tally sits above the slate, and gives way to it: when the slate has
  // been pushed clear of the corners there may be very little room up there,
  // and the tally is the thing that yields.
  const tallyY = Math.max(
    area.y + HOST_PROGRESS_H,
    Math.min(area.y + area.h * 0.055, slateY - tallyPx * 1.5),
  )
  // Three digits' worth, generously: this box exists to be tested against the
  // host's corners, so it errs wide.
  const tallyW = tallyPx * 3

  return {
    w,
    h,
    horizon,
    slate: { x: slateX, y: slateY, w: slateW, h: slateH },
    shots: { x: cx - shotsW / 2, y: shotsY - pip, w: shotsW, h: pip * 2 },
    pip,
    pipGap,
    tally: { x: cx - tallyW / 2, y: tallyY, w: tallyW, h: tallyPx },
    tallyPx,
  }
}
