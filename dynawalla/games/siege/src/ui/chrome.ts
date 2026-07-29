/**
 * The room the host leaves SIEGE, and what the pack promises about it.
 *
 * SIEGE was one of the seven games that already read `env(safe-area-inset-*)`,
 * which turned out to be the half-fix it usually is: `.sg-top` honoured
 * `--top` and `.sg-anvil` honoured `--bottom`, and **neither side was touched
 * at all**. `viewport-fit=cover` opts a document into the rounded corners and
 * the display cutout on every edge, not just the one that is obvious in
 * portrait. Held sideways the ember count and the sound switch sat under the
 * cutout, which is a currency a child cannot read and a control they cannot
 * press.
 *
 * The second encroachment is the host's own chrome: an exit control over the
 * top-LEFT 44px corner and a how-to-play control over the top-RIGHT one. SIEGE's
 * status bar runs the full width of exactly that row. The ember count was under
 * the first control and the sound switch under the second.
 *
 * **The chrome overlays; nothing reserves a band.** The status bar keeps its
 * height, the board keeps its size, the forge behind them still reaches the
 * glass. What changes is that the bar's *contents* start after the left control
 * and stop before the right one — and, because that bar was already over-full
 * on a small phone and silently clipping its own switches off the right edge,
 * the three chips move down to the anvil where there is room for them.
 *
 * Everything here is arithmetic over a viewport and a set of insets, so
 * `chrome.test.ts` can assert it at every shape the fleet has rather than the
 * bug being found on a device.
 */

import {
  HOST_CONTROL,
  HOST_MARGIN,
  safeRect,
  type Insets,
  type Rect,
} from "../../../../packs/shared/game-chrome/index.ts";
import { BOARD } from "../game/constants.ts";

/**
 * How much room a host control needs at its own end of the status bar.
 *
 * The control's margin plus the control. Derived from the shared constants
 * rather than typed out, so if the host moves its chrome this pack follows on
 * the next build instead of drifting away from it.
 */
export const CORNER_CLEAR = HOST_MARGIN + HOST_CONTROL;

/** The status bar's own margin from whatever edge it ends up against. */
export const BAR_PAD = 10;

/**
 * The box the status bar's contents may use.
 *
 * `insets` is required, not defaulted. An optional safe area is a game that
 * forgets to pass one, compiles clean, and puts its currency under a button —
 * a defect that exists only on hardware, which is the worst place to find one.
 */
export function topBarContent(w: number, h: number, insets: Insets): Rect {
  const safe = safeRect(w, h, insets);
  const x = safe.x + CORNER_CLEAR;
  const right = safe.x + safe.w - CORNER_CLEAR;
  return {
    x,
    y: safe.y,
    w: Math.max(0, right - x),
    // The bar is a row of ~34px controls with 8px of air above and below. Its
    // height is unchanged by any of this; only its width is given up.
    h: 50,
  };
}

/**
 * The narrowest the bar's contents can be squeezed and still say anything.
 *
 * Four figures — embers, damage per second, wave, incoming hit points — and a
 * strip of core pips. Below this the bar is not compact, it is broken, and the
 * three chips that used to live here have to be somewhere else. They are: they
 * are in the anvil.
 */
export const TOP_BAR_MIN = 196;

/**
 * The playfield's letterbox, inside the side insets.
 *
 * The board is a square fitted to the shorter axis and centred, so on most
 * shapes it never reaches the cutout on its own. "Most" is not "every", and a
 * socket under a rounded corner is a tower a child cannot build, so the fit is
 * done inside the safe box rather than inside the element.
 *
 * The board element's own background still bleeds to the glass. That is the
 * point of `cover` and it should stay.
 */
export function boardSafe(w: number, h: number, insets: Insets): Rect {
  return {
    x: Math.min(insets.left, w),
    y: 0,
    w: Math.max(0, w - Math.min(insets.left, w) - Math.min(insets.right, w)),
    h,
  };
}

/**
 * The CSS the stylesheet cannot express on its own.
 *
 * `styles.css` uses `env()` directly wherever it can — that is exact, it needs
 * no JavaScript, and it survives a rotation without a listener. The one thing it
 * cannot do is know how wide a host control is, so that number is written in
 * from here as a custom property and every rule that needs it reads
 * `var(--sg-corner)`.
 */
export function chromeVars(): string {
  return `.sg{--sg-corner:${CORNER_CLEAR}px;--sg-bar-pad:${BAR_PAD}px}`;
}

/** What `computeView` hands the renderer. Declared here so the fit can be tested. */
export type BoardFit = { w: number; h: number; dpr: number; scale: number; ox: number; oy: number };

/**
 * Fit the square board into its element, inside the safe box.
 *
 * The fit lives here rather than in `draw.ts` for one blunt reason: `draw.ts`
 * pulls in `particles.ts`, whose `const enum` node's strip-only TypeScript
 * loader refuses outright, so nothing that imports the renderer can be reached
 * from a test. Geometry that cannot be tested is geometry that is wrong on a
 * device, which is exactly the class of bug this file exists for.
 */
export function fitBoard(
  cssW: number,
  cssH: number,
  dpr: number,
  safe: Rect,
): BoardFit {
  const pad = 6;
  const bw = Math.max(1, safe.w - pad * 2);
  const bh = Math.max(1, safe.h - pad * 2);
  const scale = Math.min(bw / BOARD, bh / BOARD);
  return {
    w: cssW,
    h: cssH,
    dpr,
    scale,
    ox: safe.x + (safe.w - BOARD * scale) / 2,
    oy: safe.y + (safe.h - BOARD * scale) / 2,
  };
}
