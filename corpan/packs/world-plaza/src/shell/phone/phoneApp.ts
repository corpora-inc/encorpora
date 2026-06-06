/**
 * phoneApp — the EXTENSIBLE app-shell contract for the in-world Phone.
 *
 * The Phone is a tiny "phone OS": a frame (header + tab strip + a single body
 * region) that hosts pluggable APPS. Inventory ("Things") and Music/Radio ship
 * first; Mail, Calls, and a Quest app can slot in later WITHOUT touching the
 * shell — each is just another `PhoneApp` in the array `createPhoneSheet` is
 * handed. This is the seam that keeps us from painting into a corner.
 *
 * An app owns ONLY its body DOM + lifecycle; the shell owns the frame, the tab
 * strip, open/close, localization threading, and the no-layout-shift contract.
 * Apps are MOUNTED on open and UNMOUNTED on close/tab-switch (mirrors the menu's
 * `MenuSectionView` re-run-on-open model), so each app reads the LIVE locale +
 * current state every time it appears.
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
  /** Close the whole phone (e.g. an app's "done" action). */
  closePhone: () => void
}

/** A live, mounted app instance the shell can refresh/unmount. */
export interface PhoneAppInstance {
  /** Tear down: remove DOM, drop subscriptions/listeners. Always called once. */
  dispose(): void
}

/**
 * A pluggable Phone app. `id` is the stable tab key; `tabLabel(t)` is the
 * localized tab text; `mount(body, ctx)` renders into the shell's body region
 * and returns an instance the shell disposes on close/switch.
 */
export interface PhoneApp {
  /** Stable id (also the tab's key + the deep-link target). */
  id: string
  /** Localized short tab label (e.g. "Things", "Music"). */
  tabLabel: (t: PhoneT) => string
  /** Render the app into `body`; return its instance. Must be omit-graceful. */
  mount: (body: HTMLElement, ctx: PhoneAppContext) => PhoneAppInstance
}
