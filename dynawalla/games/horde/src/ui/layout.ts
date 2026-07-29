/**
 * Where the HUD sits, in numbers, and how the stylesheet learns them.
 *
 * **Why this file exists.** The host does not hand a pack the whole frame. It
 * floats a 44px back chevron over the top-LEFT corner and the how-to-play
 * button over the top-RIGHT, both painted by something that is not this game
 * and both *inside* the safe area — which is exactly where a careful HUD puts
 * things. DEEPSWARM's sound and pause buttons were at `top:10, right:10`,
 * directly under the question mark; the clock, the level and the kill count
 * were a centred row at `top:14`, straddling both corners on a 320px phone.
 *
 * Nothing reserves a band for the chrome. Reserving one costs 67px, a twelfth
 * of a 568px phone, to hold two buttons, and it broke SKY LEDGER's lattice
 * outright. The promise a game makes instead is narrow: nothing a child must
 * READ or TOUCH lands in those two squares. The swarm, the light and the
 * background still bleed to every edge, which is the whole point of
 * `viewport-fit=cover`.
 *
 * **Why the numbers live in TypeScript.** `style.css` cannot be asserted about.
 * These constants are written onto the root as custom properties at mount, the
 * stylesheet reads them through `var()`, and `hudRects` reports the same
 * geometry to the tests. One source; the CSS and the test cannot drift apart.
 */

import {
  HOST_CONTROL,
  HOST_MARGIN,
  HOST_PROGRESS_H,
  type Insets,
  type Rect,
} from "../../../../packs/shared/game-chrome/index.ts"

/**
 * How far below the safe top edge the readouts start.
 *
 * Derived from the host's own published constants rather than typed here, so
 * if the host moves its chrome this game follows on the next build.
 */
export const CHROME_TOP = HOST_PROGRESS_H + HOST_MARGIN + HOST_CONTROL + 6

/** The XP hairline: under the host's own hairline, never on top of it. */
export const XP_TOP = HOST_PROGRESS_H
export const XP_H = 7

/** The clock/level/kills row. Tallest at the largest step of its clamp. */
export const TOP_H = 44

/** Sound and pause: the game's own two buttons. */
export const ICON = 40
export const ICON_GAP = 6
export const ICON_EDGE = 10

/**
 * How far above the bottom edge the two buttons sit.
 *
 * They used to be top-right, in the host's how-to-play square. Bottom-right is
 * the one corner of this HUD that holds nothing: the weapon list is
 * bottom-left, the life bar is bottom-centre and is only 12px tall, and the
 * host paints nothing down there at all. 40 clears the life bar.
 */
export const ICON_BOTTOM = 40

/** The debug fps readout. Behind `?debug`, but it was under the chevron too. */
export const FPS_EDGE = 10

/**
 * The boxes the HUD actually occupies, so a test can assert they clear the
 * host's corners at every viewport instead of a device finding out.
 */
export function hudRects(
  w: number,
  h: number,
  insets: Insets,
): { xpbar: Rect; top: Rect; corner: Rect; fps: Rect } {
  const left = insets.left
  const right = insets.right
  const iconsW = ICON * 2 + ICON_GAP
  return {
    xpbar: { x: left, y: insets.top + XP_TOP, w: Math.max(0, w - left - right), h: XP_H },
    top: {
      x: left,
      y: insets.top + CHROME_TOP,
      w: Math.max(0, w - left - right),
      h: TOP_H,
    },
    corner: {
      x: Math.max(0, w - right - ICON_EDGE - iconsW),
      y: Math.max(0, h - insets.bottom - ICON_BOTTOM - ICON),
      w: iconsW,
      h: ICON,
    },
    fps: { x: left + FPS_EDGE, y: insets.top + CHROME_TOP, w: 170, h: 46 },
  }
}

/**
 * Hand the stylesheet the numbers above.
 *
 * `style.css` carries the same values as fallbacks so a stylesheet loaded
 * without a mounted root still looks right; these overwrite them, and these are
 * what the tests see.
 */
export function applyChromeVars(root: HTMLElement): void {
  root.style.setProperty("--hz-chrome-top", `${CHROME_TOP}px`)
  root.style.setProperty("--hz-xp-top", `${XP_TOP}px`)
  root.style.setProperty("--hz-icon", `${ICON}px`)
  root.style.setProperty("--hz-icon-gap", `${ICON_GAP}px`)
  root.style.setProperty("--hz-icon-edge", `${ICON_EDGE}px`)
  root.style.setProperty("--hz-icon-bottom", `${ICON_BOTTOM}px`)
  root.style.setProperty("--hz-fps-edge", `${FPS_EDGE}px`)
}
