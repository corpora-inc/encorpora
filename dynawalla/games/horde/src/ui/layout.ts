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
 *
 * ── The insets were zero the whole time ─────────────────────────────────────
 *
 * That promise was false in the shipped app, and the tests could not see it.
 * Every offset above is measured from the SAFE edge, and the stylesheet spelled
 * that `env(safe-area-inset-top)` — but a pack runs in an iframe sandboxed
 * `allow-scripts` with no `allow-same-origin`, and `env(safe-area-inset-*)` is a
 * property of the TOP-LEVEL browsing context. A cross-origin child resolves all
 * four to **zero**. (`packs/shared/game-chrome/insets.ts` says so in as many
 * words; nothing in this game had read it.)
 *
 * So on a notched phone the host's back chevron sat at y = 47 + 3 + 10 = 60 and
 * the clock row that `hudRects` placed at y = 47 + 63 = 110 was actually painted
 * at y = 63 — inside the chevron's square. The clock, the level, the kill count
 * and the fps readout were all under host chrome on exactly the devices the
 * insets exist for, while `layout.test.ts` passed, because the test was handed
 * real insets and the browser was not.
 *
 * The host measures the real values and publishes them; `safeInsets()` returns
 * those when they are there and falls back to the probe. `applyChromeVars`
 * writes them onto the root as `--hz-safe-*` and every rule in `style.css` reads
 * `var(--hz-safe-top, env(safe-area-inset-top))` — the `env()` staying on as the
 * fallback for `npm run dev`, where the game is top-level and `env()` is real.
 * `watchChromeVars` keeps them current across a rotation.
 */

import {
  HOST_CONTROL,
  HOST_MARGIN,
  HOST_PROGRESS_H,
  NO_INSETS,
  onInsetsChange,
  safeInsets,
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
 * The life bar.
 *
 * A founder playtest asked "should it show the health somewhere?" — which is
 * the question you ask about a readout you did not find. There was one, and it
 * was a 12px hairline with 10px near-black lettering inside it, 16px off the
 * bottom of the frame. Two things were wrong with that and only one of them was
 * taste: at 12px tall it read as decoration, and 16px from the bottom on a
 * phone with a 34px home indicator meant it was UNDER the home indicator,
 * because the inset it was measured from was resolving to zero (see above).
 *
 * It stays where it is — bottom-centre is the only place on this HUD with
 * nothing else in it, and it is where a survivor's health belongs — but it is
 * tall enough to see and it clears the indicator.
 */
export const LIFE_H = 22
export const LIFE_BOTTOM = 18
export const LIFE_MAX_W = 380

/**
 * The boxes the HUD actually occupies, so a test can assert they clear the
 * host's corners at every viewport instead of a device finding out.
 */
export function hudRects(
  w: number,
  h: number,
  insets: Insets,
): { xpbar: Rect; top: Rect; corner: Rect; fps: Rect; life: Rect } {
  const left = insets.left
  const right = insets.right
  const iconsW = ICON * 2 + ICON_GAP
  const lifeW = Math.min(LIFE_MAX_W, w * 0.62)
  return {
    life: {
      x: (w - lifeW) / 2,
      y: h - insets.bottom - LIFE_BOTTOM - LIFE_H,
      w: lifeW,
      h: LIFE_H,
    },
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
export function applyChromeVars(root: HTMLElement, insets: Insets = safeInsets()): void {
  root.style.setProperty("--hz-chrome-top", `${CHROME_TOP}px`)
  root.style.setProperty("--hz-xp-top", `${XP_TOP}px`)
  root.style.setProperty("--hz-icon", `${ICON}px`)
  root.style.setProperty("--hz-icon-gap", `${ICON_GAP}px`)
  root.style.setProperty("--hz-icon-edge", `${ICON_EDGE}px`)
  root.style.setProperty("--hz-icon-bottom", `${ICON_BOTTOM}px`)
  root.style.setProperty("--hz-fps-edge", `${FPS_EDGE}px`)
  root.style.setProperty("--hz-life-h", `${LIFE_H}px`)
  root.style.setProperty("--hz-life-bottom", `${LIFE_BOTTOM}px`)
  applySafeVars(root, insets)
}

/**
 * The safe area, as four custom properties `style.css` can do arithmetic with.
 *
 * Zeros are written explicitly rather than left unset: `var(--hz-safe-top, …)`
 * falls back to `env()` only when the property is ABSENT, and inside the app
 * `env()` is the wrong answer even when the real inset is 0.
 */
export function applySafeVars(root: HTMLElement, insets: Insets = safeInsets()): void {
  const i = insets ?? NO_INSETS
  root.style.setProperty("--hz-safe-top", `${Math.max(0, i.top)}px`)
  root.style.setProperty("--hz-safe-right", `${Math.max(0, i.right)}px`)
  root.style.setProperty("--hz-safe-bottom", `${Math.max(0, i.bottom)}px`)
  root.style.setProperty("--hz-safe-left", `${Math.max(0, i.left)}px`)
}

/**
 * Keep them current. Rotation swaps top/bottom with left/right, and a HUD that
 * read the insets once at mount is correct until the child turns the tablet.
 *
 * @returns an unsubscribe. `Overlay.destroy` calls it.
 */
export function watchChromeVars(root: HTMLElement): () => void {
  applySafeVars(root)
  return onInsetsChange((insets) => applySafeVars(root, insets))
}
