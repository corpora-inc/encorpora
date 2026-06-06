/**
 * inventoryApp — the Phone's "Things" app: a thin adapter that EMBEDS the existing
 * inventory section (`createInventorySection`) verbatim. The wallet + items logic
 * is NOT duplicated here — this only slots the existing `MenuSectionView` into the
 * Phone's app-shell so the same panel the menu shows is reachable from the phone.
 */

import type { PhoneApp, PhoneAppContext, PhoneAppInstance } from "./phoneApp"
import type { MenuSectionView } from "../../inventory/inventoryPanel"

const LOG = "[wp/phone/inventoryApp]"

/** Build the Inventory ("Things") Phone app from the existing section factory. */
export function createInventoryApp(section: MenuSectionView): PhoneApp {
  return {
    id: "things",
    tabLabel: (t) => t("phone.tab.things"),
    mount(body, _ctx: PhoneAppContext): PhoneAppInstance {
      let cleanup: (() => void) | null = null
      try {
        const ret = section(body)
        cleanup = typeof ret === "function" ? ret : null
      } catch (err) {
        console.error(`${LOG} inventory section mount failed:`, err)
      }
      return {
        dispose() {
          try {
            cleanup?.()
          } catch (err) {
            console.error(`${LOG} inventory section cleanup failed:`, err)
          }
        },
      }
    },
  }
}
