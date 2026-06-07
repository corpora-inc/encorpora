import "./exchange.css"
import type { WalletGlance } from "../contracts/runtime"
import type { InventoryStore, Reward } from "./inventory"
import { inventory } from "./inventory"
import { getCurrency, format, currencyIconSpec, denominationIconSpec, topStacks, iconRenderer } from "./currencies"
import { makeWalletGlance, setWalletGlanceLocale } from "./walletGlance"
import { showRewardReveal } from "./rewardReveal"
import { openMarketFloor, type MarketFloorOptions } from "./market/marketFloor"

/**
 * economyHud — the THIN integration facade the orchestrator (`game.ts`) wires in
 * with a handful of lines, keeping the four-slice merge surface tiny. It bundles
 * the three things game.ts needs from the Economy slice:
 *
 *   1. a compact in-overlay WALLET readout (replaces the `🪙 N` coin HUD) — the
 *      Track's 1–3 richest currencies as physical glyph + grouped major total,
 *   2. `glance()` — the `walletGlance` getter the Top-HUD (Slice 2) consumes,
 *   3. `revealReward(reward, newItems)` — the smorgasbord reveal (kills the moon),
 *   4. `openMarket(...)` — the in-overlay market/exchange surface for an NPC.
 *
 * Everything mounts INSIDE the passed overlay (`.wp-overlay`), never document.body.
 * Until Slice 2's HUD lands, the compact readout keeps a wealth indicator on
 * screen; once the HUD consumes `glance()`, game.ts can drop the readout.
 */

export interface EconomyHudOptions {
  /** the `.wp-overlay` element (NEVER document.body). */
  overlay: HTMLElement
  /** the active Track's inventory store (defaults to the singleton). */
  store?: InventoryStore
  /** scene place/era/tags → the local market + reward scope. */
  sceneKeys?: Array<string | undefined>
  /** UI locale (the Track's native; immersion resolver picks the side). */
  locale?: string
  /**
   * SUPPRESS the standalone wallet readout (TOP_HUD consolidation): once the
   * Status Capsule is the single wallet display (it reads `glance()`), the
   * floating "R 18.40" chip is redundant clutter. With this set, the facade
   * mounts NO readout DOM at all — `glance()`/`revealReward(...)`/`openMarket(...)`
   * are unaffected. Defaults to false (legacy: the compact chip is shown).
   */
  suppressReadout?: boolean
}

export interface EconomyHud {
  /** the `walletGlance` getter for HudGlances (Slice 2). null when empty. */
  glance(): () => WalletGlance | null
  /** show the smorgasbord reward reveal (call from the challenge-win path). */
  revealReward(reward: Reward, newItems?: string[]): void
  /** open the in-overlay market/exchange surface (e.g. from a market NPC). */
  openMarket(opts?: Partial<MarketFloorOptions>): { close(): void }
  /** dispose the compact readout + subscriptions. */
  dispose(): void
}

function el(tag: string, cls?: string): HTMLElement {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  return n
}

export function createEconomyHud(opts: EconomyHudOptions): EconomyHud {
  const store = opts.store ?? inventory()
  setWalletGlanceLocale(opts.locale)
  const glanceFn = makeWalletGlance(() => store)

  // The compact wallet readout (top-right), replacing `.wp-coinhud`'s coin half.
  // SUPPRESSED in the consolidated HUD: the Status Capsule is the single wallet
  // display (via `glance()`), so we mount no floating chip — `glance()` /
  // `revealReward` / `openMarket` still work, the cryptic "R 18.40" is gone.
  const suppress = opts.suppressReadout === true
  const readout = suppress ? null : el("div", "wp-walletbar")
  if (readout) {
    readout.style.cssText =
      "position:absolute;top:env(safe-area-inset-top,8px);right:10px;display:flex;gap:8px;align-items:center;z-index:55;pointer-events:none;"
    opts.overlay.append(readout)
  }

  const renderReadout = () => {
    if (!readout) return
    readout.replaceChildren()
    const entries = store.walletEntries().slice(0, 3)
    for (const { currencyId, units } of entries) {
      const c = getCurrency(currencyId)
      if (!c) continue
      const chip = el("div", "wp-walletbar-chip")
      chip.style.cssText =
        "display:flex;align-items:center;gap:5px;background:rgba(40,26,14,0.42);color:#fff7ea;border-radius:14px;padding:3px 9px 3px 4px;font:700 13px ui-rounded,system-ui,sans-serif;"
      const stacks = topStacks(c, units, 1)
      const spec = stacks.length ? denominationIconSpec(c, stacks[0].denom) : currencyIconSpec(c)
      const icon = iconRenderer().renderIcon(spec, { size: 22 })
      icon.style.cssText = "width:22px;height:22px;display:block;"
      chip.append(icon)
      const amt = document.createElement("span")
      amt.textContent = format(c, units, opts.locale)
      chip.append(amt)
      readout.append(chip)
    }
  }
  renderReadout()
  const unsub = readout ? store.subscribe(renderReadout) : () => {}

  return {
    glance: () => glanceFn,
    revealReward: (reward, newItems) =>
      void showRewardReveal(opts.overlay, { reward, newItems, locale: opts.locale }),
    openMarket: (extra) =>
      openMarketFloor(opts.overlay, {
        store,
        sceneKeys: opts.sceneKeys,
        locale: opts.locale,
        ...extra,
      }),
    dispose: () => {
      unsub()
      readout?.remove()
    },
  }
}
