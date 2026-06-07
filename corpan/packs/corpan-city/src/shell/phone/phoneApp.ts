/**
 * phoneApp — the EXTENSIBLE app contract for the in-world Phone simulator.
 *
 * The Phone is a tiny "phone OS": a HOME SCREEN grid of app icons. Tap an icon and
 * the app slides in over a single body region; a back chevron returns home. Apps =
 * Map, Things (Inventory), Quest, Badges, Music today; Mail/Calls/etc. slot in
 * later WITHOUT touching the shell — each is just another `PhoneApp` in the array
 * `createPhoneSheet` is handed. This is the seam that keeps us off a corner.
 *
 * An app owns ONLY its body DOM + lifecycle; the shell owns the frame (home grid,
 * the app header + back nav, open/close, localization threading, the
 * no-layout-shift contract). Apps are MOUNTED when opened and UNMOUNTED when the
 * player backs out / closes the phone (mirrors the menu's `MenuSectionView`
 * re-run-on-open model), so each app reads the LIVE locale + current state every
 * time it appears.
 */

import type { I18nKey } from "../../i18n/strings"

/** A bound `t` the shell hands each app (already pinned to the live native locale). */
export type PhoneT = (key: I18nKey, params?: Record<string, string | number>) => string

/** Context the shell passes to an app on mount. */
export interface PhoneAppContext {
  /** Localize into the player's NATIVE locale (live-bound by the shell). */
  t: PhoneT
  /** Accent color (Scene.palette.accent) for app-local tinting. */
  accent?: string
  /** Go back to the phone home screen (an app's "done" action). */
  goHome: () => void
  /** Close the whole phone (resume the world). */
  closePhone: () => void
}

/** A live, mounted app instance the shell can refresh/unmount. */
export interface PhoneAppInstance {
  /** Tear down: remove DOM, drop subscriptions/listeners. Always called once. */
  dispose(): void
}

/**
 * The home-screen icon for an app. Either an HTML string (an inline SVG, or an
 * `<img>` for the brand mark) painted into the icon tile, OR a builder that
 * returns a node. The shell wraps whatever this yields in the rounded tile.
 */
export type PhoneAppIcon = string | ((accent?: string) => string | Node)

/**
 * A pluggable Phone app. `id` is the stable key (also the deep-link target);
 * `title(t)` is the localized name shown on the home label AND the app header;
 * `icon` is the home-grid glyph; `mount(body, ctx)` renders the app into the
 * shell's body region and returns an instance the shell disposes on back/close.
 */
export interface PhoneApp {
  /** Stable id (also the home-grid key + the deep-link target). */
  id: string
  /** Localized app name — the home-screen label AND the in-app header title. */
  title: (t: PhoneT) => string
  /** The home-grid icon (inline SVG string / `<img>` / a node builder). */
  icon: PhoneAppIcon
  /**
   * Optional accent for THIS app's icon tile (defaults to a neutral paper tile).
   * Lets Music carry the brand terracotta while Map/Quest stay calm, say.
   */
  tileAccent?: string
  /** Render the app into `body`; return its instance. Must be omit-graceful. */
  mount: (body: HTMLElement, ctx: PhoneAppContext) => PhoneAppInstance
}
