/**
 * Where the HUD sits, in numbers, and how the stylesheet learns them.
 *
 * **What this is for.** The host does not hand a pack the whole frame. It
 * floats a 44px back chevron over the top-LEFT corner and the how-to-play
 * button over the top-RIGHT, and both of those live *inside* the safe area,
 * which is exactly where a careful HUD puts things. POLARITY's HUD is careful
 * — `.pol-hud` pads all four edges with `env()` and always did — and that is
 * precisely why it collided: the score and the chain multiplier sat in the
 * chevron's square, the shield pips and the STRATUM label sat under the
 * question mark, and the game's own sound and pause buttons were pinned to the
 * how-to-play button's exact coordinates.
 *
 * **Why no band is reserved.** Reserving the top strip costs 67px — a twelfth
 * of a 568px phone — to hold two buttons, and it broke SKY LEDGER's lattice
 * outright. So the chrome floats and a game keeps only TWO 44px corners free of
 * anything a child must read or touch. The starfield, the ship and every bullet
 * still bleed to the edges, which is what `viewport-fit=cover` is for.
 *
 * **Why the numbers live here.** `ui/styles.css` is a static file and cannot be
 * asserted about. These constants are written onto the root as custom
 * properties at mount, the stylesheet reads them through `var()`, and
 * `hudRects` reports the same geometry to the tests. One source.
 *
 * **And why the SAFE AREA is one of those numbers now.** `.pol-hud` padded all
 * four edges with `env(safe-area-inset-*)` and had done since the first commit —
 * and every one of those rules resolved to zero on a device. A pack runs in an
 * iframe sandboxed `allow-scripts` with no `allow-same-origin`, and
 * `env(safe-area-inset-*)` belongs to the TOP-LEVEL browsing context, so a
 * cross-origin child reads all four as 0. `max(10px, env(...))` is 10px on every
 * phone ever made, and `hudRects` below was reporting a padding the stylesheet
 * never produced: the tests proved a HUD nobody shipped. SIEGE had exactly this
 * and the founder found it, with the score painted under an Android clock.
 *
 * So `applySafeVars` publishes the host's measurement as four more custom
 * properties and the stylesheet reads `var(--pol-safe-*, env(...))` — the
 * `env()` kept only as the fallback for a dev browser tab, where there is no
 * host and where it is right.
 */

import {
  HOST_CONTROL,
  HOST_MARGIN,
  HOST_PROGRESS_H,
  publishSafeVars,
  safeInsets,
  type Insets,
  type Rect,
  type StyleTarget,
} from "../../../../packs/shared/game-chrome/index.ts";

/**
 * How far below the safe top edge the register's top row starts.
 *
 * Derived from the host's own published constants rather than typed here, so if
 * the host moves its chrome this game follows on the next build.
 */
export const CHROME_TOP = HOST_PROGRESS_H + HOST_MARGIN + HOST_CONTROL + 6;

/** The HUD's gap from every safe edge, unchanged from the original stylesheet. */
export const HUD_EDGE = 10;

/** Sound and pause: the game's own two buttons. */
export const MINI = 34;
export const MINI_GAP = 8;

/**
 * How far in from the safe right edge those two buttons start.
 *
 * They used to be at `right: max(10px, env())` — the how-to-play button's
 * square, exactly. They now sit BESIDE it rather than under it, which keeps
 * them where a player already looks for them and leaves at least 10px of air
 * between the game's chrome and the host's at every inset.
 */
export const MINI_RIGHT = HOST_CONTROL + HOST_MARGIN * 2;

/** The top row: score over chain on the left, gauge centred, pips right. */
export const TOP_H = 96;

/** The two touch pads, from the stylesheet's `clamp(64px, 19vw, 108px)`. */
export const padSize = (w: number): number => Math.min(108, Math.max(64, w * 0.19));

/**
 * The boxes the HUD occupies, so a test can assert they clear the host's two
 * corners at every viewport instead of a device finding out.
 */
export function hudRects(
  w: number,
  h: number,
  insets: Insets,
): { top: Rect; mini: Rect; padFlip: Rect; padVent: Rect } {
  const padL = Math.max(HUD_EDGE, insets.left);
  const padR = Math.max(HUD_EDGE, insets.right);
  const padB = Math.max(HUD_EDGE, insets.bottom);
  const padT = insets.top + CHROME_TOP;
  const pad = padSize(w);
  const miniW = MINI * 2 + MINI_GAP;
  return {
    top: { x: padL, y: padT, w: Math.max(0, w - padL - padR), h: TOP_H },
    mini: {
      x: Math.max(0, w - padR - MINI_RIGHT - miniW),
      y: Math.max(HUD_EDGE, insets.top),
      w: miniW,
      h: MINI,
    },
    padFlip: { x: padL, y: h - padB - pad, w: pad, h: pad },
    padVent: { x: Math.max(0, w - padR - pad), y: h - padB - pad, w: pad, h: pad },
  };
}

/**
 * Hand the stylesheet the numbers above.
 *
 * `styles.css` carries the same values as fallbacks, so a stylesheet loaded
 * without a mounted root still looks right; these overwrite them, and these are
 * what the tests read.
 */
export function applyChromeVars(root: HTMLElement): void {
  root.style.setProperty("--pol-chrome-top", `${CHROME_TOP}px`);
  root.style.setProperty("--pol-mini-right", `${MINI_RIGHT}px`);
}

/** The namespace the four published safe-area lengths live under. */
export const SAFE_PREFIX = "--pol-safe-";

/** One safe edge, as a length `styles.css` can do arithmetic with. */
export const cssSafe = (side: "top" | "right" | "bottom" | "left"): string =>
  `var(${SAFE_PREFIX}${side}, env(safe-area-inset-${side}, 0px))`;

/**
 * Hand the stylesheet the safe area, from the host's own measurement.
 *
 * Separate from `applyChromeVars` because the two have different lifetimes: the
 * host's control size is fixed for the life of the pack, the safe area changes
 * on every rotation and again when a tablet is resized in Split View. This is
 * called at mount and on every resize; it is idempotent, so nothing is written
 * when the numbers have not moved.
 *
 * @returns whether anything changed.
 */
export function applySafeVars(
  root: StyleTarget,
  insets: Insets = safeInsets(),
  previous?: Insets | null,
): boolean {
  return publishSafeVars(root, SAFE_PREFIX, insets, previous);
}
