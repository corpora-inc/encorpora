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
import { APP_ICON_SVGS } from "./appIcons"

const LOG = "[wp/phone/sectionApp]"

/* Home-grid icons — the BEAUTIFUL filled-squircle jewel tiles (PHONE_DESIGN §5.2),
   each a self-contained gradient SVG (built in `appIcons.ts`). The line-glyph era
   is retired; these read as real iOS app icons. (Music carries the brand mark via
   `corpanMarkTile()` in `musicApp.ts`.) */
export const APP_ICONS = APP_ICON_SVGS

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
