/**
 * What floats OVER every game, and the small promise each game makes about it.
 *
 * A pack does not own its whole frame: the host paints an exit control and a
 * progress hairline on top of it, and the shared how-to-play control sits up
 * there too. A game that lays out as if it owned everything puts its score, its
 * timer or its only button underneath them — which the shipped "Leave" pill
 * does in several games today.
 *
 * **Why chrome overlays rather than reserving a band.** The first version of
 * this file reserved the whole top strip, 67px. On a 568px phone that is 12% of
 * the height, and it broke SKY LEDGER's own layout invariants outright — its
 * test said `the lattice cell is 15.3px — the figures collide`. Most games have
 * no such invariant and would simply have shipped colliding text. Taking a
 * twelfth of a small screen from every game, to hold two buttons, is the wrong
 * trade.
 *
 * So the chrome floats, each control carries its own scrim for contrast, and a
 * game keeps only TWO 44px CORNERS free of anything critical. Full height for
 * the playfield; a promise about two squares.
 *
 * **This is the single source of truth.** `dynawalla-app`'s `Stage.tsx` and
 * every game import these numbers, so host and pack cannot drift. If the host
 * moves its chrome it changes these constants and every game follows on the
 * next build.
 *
 *   top-left    exit ( < )          host
 *   top, full   progress hairline   host, 3px, decorative
 *   top-right   how to play ( ? )   shared chrome
 */

import { safeInsets, type Insets } from "./insets.ts"

/** The host's progress hairline, flush to the top edge. Decorative; overlap is fine. */
export const HOST_PROGRESS_H = 3

/**
 * Side of the host's square controls, and their gap from the safe edge.
 *
 * 44 is not decoration: it is the platform minimum touch target and about the
 * smallest square a seven-year-old hits reliably on a moving bus. Shrink the
 * margins if room is tight; never this.
 */
export const HOST_CONTROL = 44
export const HOST_MARGIN = 10

export type Rect = { x: number; y: number; w: number; h: number }

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

/** The square the host's exit control occupies. Top-LEFT: "back", on both platforms. */
export function exitRect(insets: Insets = safeInsets()): Rect {
  return {
    x: insets.left + HOST_MARGIN,
    y: insets.top + HOST_PROGRESS_H + HOST_MARGIN,
    w: HOST_CONTROL,
    h: HOST_CONTROL,
  }
}

/** The square the how-to-play control occupies. Top-RIGHT, opposite the exit. */
export function helpRect(w: number, insets: Insets = safeInsets()): Rect {
  return {
    x: Math.max(0, w - insets.right - HOST_MARGIN - HOST_CONTROL),
    y: insets.top + HOST_PROGRESS_H + HOST_MARGIN,
    w: HOST_CONTROL,
    h: HOST_CONTROL,
  }
}

/** Both reserved corners, for a game that wants to lay out around them. */
export function chromeRects(w: number, insets: Insets = safeInsets()): readonly Rect[] {
  return [exitRect(insets), helpRect(w, insets)]
}

/**
 * Does `rect` collide with host chrome?
 *
 * The point of this is that a game can ASSERT it in its own tests, at every
 * viewport it supports, instead of finding out on a device. Pass the bounding
 * box of anything a child must read or touch — a score, a timer, a button.
 *
 * A playfield, a background or a particle field may overlap freely and usually
 * should; that is why `viewport-fit=cover` is set at all. This is about what
 * must stay legible or tappable.
 */
export function hitsHostChrome(rect: Rect, w: number, insets: Insets = safeInsets()): boolean {
  return chromeRects(w, insets).some((c) => overlaps(rect, c))
}
