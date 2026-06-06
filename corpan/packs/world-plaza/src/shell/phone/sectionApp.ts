/**
 * sectionApp — a thin adapter that turns an existing menu `MenuSectionView` (Map,
 * Inventory/"Things", Quest, Badges) into a Phone `PhoneApp`. The section logic is
 * NOT duplicated: this only slots the SAME `MenuSectionView` the old menu rendered
 * into the Phone's home-grid + app-screen shell, so re-homing the menus as phone
 * apps preserves every bit of their behaviour (wallet, items, wardrobe entry,
 * quest tracker/switch, the full map, the badge case).
 *
 * Each app carries a stable id, a localized title (its `I18nKey`), and a home-grid
 * icon (an inline SVG so it crisps at any DPR + inherits the tile ink).
 */

import type { I18nKey } from "../../i18n/strings"
import type { PhoneApp, PhoneAppContext, PhoneAppIcon, PhoneAppInstance, PhoneT } from "./phoneApp"
import type { MenuSectionView } from "../menuPanel"

const LOG = "[wp/phone/sectionApp]"

/* Home-grid icons (inline SVG, stroke currentColor → inherit the tile ink). */
export const APP_ICONS = {
  // A folded map.
  map:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M9 4 3.5 6.2v13.3L9 17.3l6 2.2 5.5-2.2V4L15 6.2 9 4z"/>' +
    '<path d="M9 4v13.3"/><path d="M15 6.2v13.3"/></svg>',
  // A traveler's satchel (the retired pack button's motif, now the "Things" app).
  things:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M9 7V6a3 3 0 0 1 6 0v1"/><rect x="4" y="7" width="16" height="13" rx="3.5"/>' +
    '<path d="M4 12.5h16"/><path d="M11.5 12.5v3"/></svg>',
  // A waypoint pin (the quest objective).
  quest:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 21s7-5.5 7-11a7 7 0 0 0-14 0c0 5.5 7 11 7 11z"/>' +
    '<circle cx="12" cy="10" r="2.6"/></svg>',
  // A rosette / badge.
  badges:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="12" cy="9" r="5.2"/><path d="M8.4 13.4 7 21l5-2.4L17 21l-1.4-7.6"/></svg>',
} as const

/**
 * Wrap a `MenuSectionView` as a Phone app. `id`/`titleKey`/`icon` describe the
 * home-grid tile; the section renders into the app body unchanged.
 */
export function createSectionApp(args: {
  id: string
  titleKey: I18nKey
  icon: PhoneAppIcon
  tileAccent?: string
  section: MenuSectionView
}): PhoneApp {
  return {
    id: args.id,
    title: (t: PhoneT) => t(args.titleKey),
    icon: args.icon,
    tileAccent: args.tileAccent,
    mount(body: HTMLElement, _ctx: PhoneAppContext): PhoneAppInstance {
      let cleanup: (() => void) | null = null
      try {
        const ret = args.section(body)
        cleanup = typeof ret === "function" ? ret : null
      } catch (err) {
        console.error(`${LOG} section "${args.id}" mount failed:`, err)
      }
      return {
        dispose() {
          try {
            cleanup?.()
          } catch (err) {
            console.error(`${LOG} section "${args.id}" cleanup failed:`, err)
          }
        },
      }
    },
  }
}
