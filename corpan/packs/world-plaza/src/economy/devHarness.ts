/**
 * devHarness — a standalone verify harness for the Economy slice (E0+E1). Boots
 * a `.wp-overlay`, rolls a scene-appropriate reward, shows the smorgasbord
 * reward reveal (stacks of physical bills/coins/ingots — the moon is DEAD), and
 * exposes hooks so a headless screenshot run can drive it. Dev-only; never
 * shipped (imported solely by econ-harness.html).
 */
import { createInventory } from "./inventory"
import { rollForScene } from "./rewards"
import { showRewardReveal } from "./rewardReveal"
import { openMarketFloor } from "./market/marketFloor"
import { defaultCurrencyForScene } from "./currencies"

const root = document.getElementById("corpan-game-root")
if (root) {
  const overlay = document.createElement("div")
  overlay.className = "wp-overlay"
  overlay.style.cssText = "position:absolute;inset:0;"
  root.append(overlay)

  const defaultCurrency = defaultCurrencyForScene({ place: "antigua-guatemala", era: "colonial-1770" })
  const inv = createInventory({ defaultCurrency })
  // seed a varied wallet so the wallet glance + exchange have something to show
  inv.credit("gold-real", 1840)
  inv.credit("jpy-yen", 50000)
  inv.credit("mxn-peso", 12000)

  // roll a deterministic, scene-appropriate smorgasbord (perfect score)
  const reward = rollForScene({
    sceneKeys: ["antigua-guatemala", "colonial-1770", "antigua"],
    defaultCurrency,
    score: 1,
    seed: "verify-demo",
    xp: 40,
  })
  // also stuff in a couple more currencies so the reveal shows a full spread
  reward.currency = { ...reward.currency, "jpy-yen": 12000, "silver-tael": 30 }
  reward.items = ["spices-cacao"]
  inv.applyReward(reward)

  const api = {
    showReward: () =>
      showRewardReveal(overlay, { reward, newItems: ["spices-cacao"], dismissMs: 0, locale: "en-US" }),
    openMarket: (tab: "ticker" | "market" | "exchange" = "ticker") =>
      openMarketFloor(overlay, { store: inv, sceneKeys: ["antigua"], tab, locale: "en-US" }),
  }
  ;(window as unknown as { __wpEcon?: typeof api }).__wpEcon = api

  // auto-show the reward reveal on boot for the default screenshot
  api.showReward()
}
