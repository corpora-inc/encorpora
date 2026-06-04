import type { WalletGlance } from "../contracts/runtime"
import type { InventoryStore } from "./inventory"
import { getCurrency, format, topStacks, denominationIconSpec, currencyIconSpec } from "./currencies"

/**
 * walletGlance — the optional HUD glance the Top-HUD (Slice 2) consumes
 * (IMPLEMENTATION_CONTRACTS Seam 3). A WHISPER of wealth: the top-held currency
 * + its abbreviated grouped major total + the physical denomination icon spec,
 * so the chrome can paint the real glyph (never the moon, never an emoji).
 *
 * Omit-graceful: returns `null` when the wallet is empty (the HUD omits the
 * wealth row entirely). Cheap — reads only the richest balance, never the whole
 * wallet's UI. Deep-links to the Wallet tab via the HUD's `openSection("wallet")`.
 */

/** Build the `walletGlance` getter bound to an inventory store. */
export function makeWalletGlance(store: () => InventoryStore): () => WalletGlance | null {
  return () => {
    const entries = store().walletEntries()
    if (!entries.length) return null
    const top = entries[0] // richest first (walletEntries sorts by units desc)
    const c = getCurrency(top.currencyId)
    if (!c) return null
    // the icon = the largest physical denomination in the top balance.
    const stacks = topStacks(c, top.units, 1)
    const icon = stacks.length ? denominationIconSpec(c, stacks[0].denom) : currencyIconSpec(c)
    return {
      topCurrency: top.currencyId,
      major: format(c, top.units, locale()),
      icon,
    }
  }
}

/** The UI locale for grouping (overridable by the immersion resolver later). */
let _locale: string | undefined
export function setWalletGlanceLocale(locale: string | undefined): void {
  _locale = locale
}
function locale(): string | undefined {
  return _locale
}
