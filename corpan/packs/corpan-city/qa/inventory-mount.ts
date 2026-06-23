/**
 * inventory harness — mount the Inventory section inside a real .wp-menu-body
 * scroll region (framed like .wp-menu-panel) so the horizontal-scroll bug
 * (WALLET/YOUR THINGS/BADGES left edges clipping when scrolled right) is
 * reproducible/verifiable. Styles come from the pack's own stylesheet.
 */
import "../src/styles.css"
import { createInventorySection } from "../src/inventory/inventoryPanel"
import { createInventory } from "../src/economy/inventory"

const body = document.getElementById("body") as HTMLElement

const store = createInventory({ namespace: "inv-harness" })
// fund a multi-currency wallet + a spread of items so all three blocks fill out.
store.applyReward({ currencies: { "gold-real": 1840, "jpy-yen": 320, "usd-cent": 950 }, xp: 40 })
for (const id of ["straw-hat", "traveler-coat", "woolen-shawl", "festival-aura", "spectacles-round", "satchel-courier"]) {
  store.grant(id, 1)
}

const section = createInventorySection({
  store,
  accent: "#c46b4a",
  locale: "en",
  masteredCount: () => 3,
  openBadges: () => console.log("[harness] open badges"),
  openWardrobe: () => console.log("[harness] open wardrobe"),
})
section(body)

;(window as unknown as { __wpInvReady?: boolean }).__wpInvReady = true
