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
//   * the READABLE things — the slate, the three shots, the bag — laid out
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
  /**
   * The chute, immediately ABOVE the slate: where a thrown-away claim goes.
   *
   * It is deliberately adjacent to the slate rather than at the top of the frame.
   * The top of the frame is where the host paints its exit and how-to-play
   * controls, and a discard target up there would either sit under one of them or
   * force a reserved band — which costs a twelfth of a 568px phone and broke a
   * sibling game's layout. Adjacency also reads better: the gesture is a flick
   * across the thing being judged, so the two destinations belong beside it.
   */
  readonly chute: Rect
  /** The bag, below the shots: where a kept claim goes, and where the score is. */
  readonly bag: Rect
  /** Type size for the coin count on the bag. */
  readonly bagPx: number
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
  const slateX = area.x + (area.w - slateW) / 2

  const pip = Math.max(3.5, h * 0.0075)
  const pipGap = pip * 3.4
  const shotsW = pipGap * (SHOTS - 1) + pip * 2
  /** From the bottom of the slate down to the centre of the pips. */
  const shotsDrop = pip * 5

  const bagPx = Math.round(Math.max(15, h * 0.03))

  // The host's chrome, rebuilt from `area` rather than measured again, so the game
  // and the host cannot end up disagreeing about where the buttons are.
  const insets = insetsOf(w, h, area)
  const exit = exitRect(insets)
  const help = helpRect(w, insets)
  const chromeBottom = Math.max(exit.y + exit.h, help.y + help.h)
  const passesBetween =
    slateX >= exit.x + exit.w + HOST_MARGIN && slateX + slateW <= help.x - HOST_MARGIN
  const ceiling = (passesBetween ? area.y : chromeBottom + HOST_MARGIN) + HOST_PROGRESS_H

  /**
   * THE VERTICAL BUDGET, and why the slate's height is now capped by it.
   *
   * The slate is `slateW × 0.3`, and in landscape on a phone that is enormous relative
   * to the height: at 568×320 with a portrait notch the safe area is 239 px tall and an
   * uncapped slate wanted 150 of them. There was room for that when the only other
   * things were three 7 px pips; there is not now that there is a chute above and a bag
   * below, and a bag that had to ride up onto the shots to fit is a bag pointing at the
   * wrong place.
   *
   * So the slate takes at most a third of the budget and everything else is measured
   * from it. The three shares below sum to well under one, which is what makes the
   * overflow correction below always resolvable — a clamp that cannot succeed is how a
   * layout ends up outside the safe area on exactly one device shape.
   */
  const budget = Math.max(1, area.y + area.h - ceiling)
  const slateH = Math.min(slateW * 0.3, budget * 0.34)
  const gutterH = Math.max(10, slateH * 0.2)
  const bagH = Math.max(bagPx * 1.6, slateH * 0.62)
  /** Everything under the slate: the drop to the pips, the pips, and the bag. */
  const below = shotsDrop + pip * 3 + bagH

  // Centred four tenths down the safe area — high enough that a thumb is not over the
  // statement it is about to judge. The chute has to fit above it, so the roof is the
  // host's chrome plus one gutter.
  const roof = ceiling + gutterH
  let slateY = Math.max(roof, area.y + area.h * 0.4 - slateH / 2)
  // ...and lifted back up if the bag would fall off the safe bottom. The roof still
  // wins: a slate under the exit button is worse than a bag near the home indicator,
  // and with the budget above it never comes to that.
  const overflow = slateY + slateH + below - (area.y + area.h)
  if (overflow > 0) slateY = Math.max(roof, slateY - overflow)

  const cx = area.x + area.w / 2
  const shotsY = slateY + slateH + shotsDrop
  const bagW = Math.max(bagH, Math.min(slateW * 0.3, bagPx * 4))

  return {
    w,
    h,
    horizon,
    slate: { x: slateX, y: slateY, w: slateW, h: slateH },
    shots: { x: cx - shotsW / 2, y: shotsY - pip, w: shotsW, h: pip * 2 },
    pip,
    pipGap,
    chute: { x: slateX, y: Math.max(area.y, slateY - gutterH), w: slateW, h: gutterH },
    bag: { x: cx - bagW / 2, y: shotsY + pip * 3, w: bagW, h: bagH },
    bagPx,
  }
}
