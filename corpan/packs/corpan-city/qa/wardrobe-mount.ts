/**
 * wardrobe harness — mount the in-game WARDROBE standalone with a few owned
 * cosmetics so the 3D portrait, the deduped "None" rows, and the premium finery
 * section can be inspected/screenshotted. Exposes `window.__wpWardrobe` so a
 * playwright driver can drive chip taps and read state.
 */
import { openWardrobe } from "../src/economy/wardrobe"
import { createInventory } from "../src/economy/inventory"
import { dressToAvatar, defaultDress } from "../src/onboarding/onboarding"

const overlay = document.getElementById("overlay") as HTMLElement

const store = createInventory({ namespace: "wardrobe-harness" })
// grant a spread of finery so the treasury section is populated.
for (const id of ["straw-hat", "traveler-coat", "woolen-shawl", "festival-aura", "spectacles-round"]) {
  store.grant(id, 1)
}

const avatar = dressToAvatar({ ...defaultDress(), topId: "top-tunic", topTint: "#c0532f" })

openWardrobe({
  container: overlay,
  avatar,
  store,
  accent: "#e8b54a",
  onApply: (a) => {
    ;(window as unknown as { __wpApplied?: unknown }).__wpApplied = a
    console.log("[harness] applied", JSON.stringify(a))
  },
  onBuyMore: () => console.log("[harness] buy more"),
})

;(window as unknown as { __wpWardrobeReady?: boolean }).__wpWardrobeReady = true
