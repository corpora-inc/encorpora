/**
 * Shop / economy QA mount — exercises the items+inventory+economy stack in
 * isolation (no 3D world, no other agents' code). Exposes a tiny `window.__wpEco`
 * test API the Playwright harness drives.
 */
import { inventory } from "../src/economy/inventory"
import { openMerchant, openShop, MERCHANTS } from "../src/economy/shop"
import { relevance, cluesFor, hasNeeded } from "../src/economy/questItems"

const root = document.getElementById("app") ?? document.body
root.style.cssText =
  "position:fixed;inset:0;background:linear-gradient(160deg,#ffe9c2,#e7c49e);font-family:ui-rounded,system-ui,sans-serif;color:#3a2a1c"

const hud = document.createElement("div")
hud.id = "wp-eco-hud"
hud.style.cssText = "position:fixed;top:10px;left:12px;font:800 15px/1.4 ui-rounded,system-ui;z-index:5"
root.append(hud)

const store = inventory()
store.reset() // start clean each harness run

function paintHud() {
  hud.innerHTML =
    `🪙 <span id="wp-coins">${store.coins()}</span> &nbsp; ` +
    `✨ <span id="wp-xp">${store.xp()}</span> &nbsp; ` +
    `🎒 <span id="wp-bag">${store.bagWithDefs().reduce((s, b) => s + b.qty, 0)}</span> &nbsp; ` +
    `👕 <span id="wp-equipped">${store.equippedLayers().map((l) => l.itemId).join(",") || "none"}</span>`
}
store.subscribe((e) => {
  if (e.type === "change") paintHud()
})
paintHud()

// Test API the Playwright harness calls.
declare global {
  interface Window {
    __wpEco?: {
      seed: () => void
      applySampleReward: () => string[]
      openShop: (preset: "grocer" | "tailor" | "cafe" | "trader", questId?: string) => void
      state: () => { coins: number; xp: number; bag: Array<{ id: string; qty: number }>; equipped: Record<string, unknown> }
      relevance: (questId: string, id: string) => string
      clues: (questId: string, step?: string) => string[]
      hasNeeded: (questId: string, step: string) => boolean
      MERCHANTS: typeof MERCHANTS
    }
  }
}

window.__wpEco = {
  seed: () => {
    store.reset()
    store.addCoins(120)
    store.addXp(40)
    store.grant("spices-cinnamon", 3)
    store.grant("coffee-sack", 1)
    store.grant("straw-hat", 1)
    paintHud()
  },
  applySampleReward: () =>
    store.applyReward({ xp: 25, coins: 30, items: ["ferry-token", "spices-cacao"] }),
  openShop: (preset, questId) => openMerchant(root, preset, { questId, playerId: "player-local" }),
  state: () => ({
    coins: store.coins(),
    xp: store.xp(),
    bag: store.bagWithDefs().map((b) => ({ id: b.def.id, qty: b.qty })),
    equipped: store.getState().equipped,
  }),
  relevance: (questId, id) => relevance(questId, id),
  clues: (questId, step) => cluesFor(store, questId, step),
  hasNeeded: (questId, step) => hasNeeded(store, questId, step),
  MERCHANTS,
}

// keep openShop import used even if harness calls only openMerchant
void openShop
