/**
 * inventoryPanel — the REAL "Inventory" menu section (TOP_HUD consolidation §3.3,
 * ECONOMY_CURRENCY §5.2): the multi-currency wallet shown PROPERLY, the player's
 * owned items, and a badges summary. This replaces the menu's "coming soon"
 * placeholder — the pack is the LEDGER (the top HUD is only the glance).
 *
 * The wallet is the headline fix: instead of a cryptic floating "R 18.40", every
 * held currency renders as its premium procedural `IconRenderer` glyph (the
 * crown coin / bill / ingot — never the moon, never an emoji) + its NAME
 * ("Reales") + the grouped major total ("R 18.40"). It reuses the SAME visual
 * language as the shop/market (`currencyIconSpec`/`denominationIconSpec` +
 * `format`), so the wallet, the reward reveal, and the market all speak one
 * money grammar.
 *
 * It is a `MenuSectionView`: a factory that renders into the menu's
 * `.wp-menu-body` (a child of `.wp-overlay`, never `document.body` — the M0
 * lesson) and returns a cleanup. Live: it subscribes to the inventory store so
 * the wallet/items refresh while the menu is open. Styles live in `src/styles.css`
 * (`.wp-inv*`), the pack's single host-loaded stylesheet (no per-module injected
 * <style> that could be missed under embedding).
 *
 * Localized: every label flows through the injected `Translate` (the immersion
 * resolver / native locale picks the language); currency NAMES are localized via
 * their i18n key with the catalog English as fallback. Omit-graceful: an empty
 * wallet / empty bag / no badges each show a quiet dignified empty line, never a
 * dead-end.
 */

import type { InventoryStore } from "../economy/inventory"
import {
  getCurrency,
  format,
  topStacks,
  currencyIconSpec,
  denominationIconSpec,
  iconRenderer,
} from "../economy/currencies"
import type { IconRenderer, Translate } from "../contracts/runtime"

const LOG = "[wp/inventoryPanel]"

/** A MenuSectionView: render into `body`, return optional cleanup. */
export type MenuSectionView = (body: HTMLElement) => void | (() => void)

export interface InventoryPanelStrings {
  /** Heading over the wallet block. */
  walletHeading: string
  /** Heading over the owned-items block. */
  itemsHeading: string
  /** Heading over the badges summary block. */
  badgesHeading: string
  /** Shown when the wallet is empty. */
  walletEmpty: string
  /** Shown when the bag is empty. */
  itemsEmpty: string
  /** "{n} mastered" summary; or a generic line if no count getter. */
  badgesSummary: (mastered: number) => string
  /** Deep-link button into the full Badge Case. */
  openBadges: string
  /** "×{n}" quantity suffix for a stacked item. */
  qty: (n: number) => string
  /** The "open the wardrobe / change your look" button label. */
  openWardrobe: string
}

const DEFAULT_STRINGS: InventoryPanelStrings = {
  walletHeading: "Wallet",
  itemsHeading: "Your things",
  badgesHeading: "Badges",
  walletEmpty: "No coins yet — win a challenge to earn some.",
  itemsEmpty: "Your pack is empty for now.",
  badgesSummary: (mastered) =>
    mastered === 1 ? "1 badge mastered" : `${mastered} badges mastered`,
  openBadges: "Open the Badge Case",
  qty: (n) => `×${n}`,
  openWardrobe: "Change your look",
}

export interface InventoryPanelOptions {
  /** The active Track's inventory store (wallet + bag + equipped). */
  store: InventoryStore
  /** Accent color (Scene.palette.accent) so the panel tints with the world. */
  accent?: string
  /**
   * UI locale for currency grouping ("R 18.40") + i18n. A getter form is read
   * LIVE on each mount, so an immersion flip re-localizes the wallet instantly in
   * place (the section's `MenuSectionView` re-runs on each open).
   */
  locale?: string | (() => string)
  /** The procedural icon renderer (defaults to the active economy renderer). */
  renderer?: IconRenderer
  /** Localized copy. */
  strings?: Partial<InventoryPanelStrings>
  /** The i18n seam (currency names + labels render in `lang`). */
  t?: Translate
  /** Locale for `t(key, lang)` — getter form is read live (see `locale`). */
  lang?: string | (() => string)
  /** Mastered-badge count for the summary (omit → no count). */
  masteredCount?: () => number
  /** Deep-link into the full Badge Case (orchestrator: `shell.openSection("badges")`). */
  openBadges?: () => void
  /**
   * Open the in-game WARDROBE (re-dress / equip bought bling). When provided, the
   * items block shows a "Change your look" button — the dedicated re-entry control
   * the economy slice wires to `economy.openWardrobe`. Omit → no button.
   */
  openWardrobe?: () => void
}

/**
 * Build the Inventory section factory. Returns a `MenuSectionView` the
 * orchestrator hands to `createShell({ sections: { inventory } })`.
 */
export function createInventorySection(opts: InventoryPanelOptions): MenuSectionView {
  return (body) => mountInventoryPanel(body, opts)
}

function mountInventoryPanel(body: HTMLElement, opts: InventoryPanelOptions): () => void {
  const strings: InventoryPanelStrings = { ...DEFAULT_STRINGS, ...(opts.strings ?? {}) }
  const renderer = opts.renderer ?? iconRenderer()
  // Resolve the (possibly lazy) locale ONCE per mount — the section re-mounts on
  // each menu open, so a getter reads the LIVE UI locale (re-localizes on an
  // immersion flip in place).
  const resolve = (v: string | (() => string) | undefined): string | undefined =>
    typeof v === "function" ? v() : v
  const locale = resolve(opts.locale)
  const tr = (key: string, fallback: string): string => {
    if (!opts.t) return fallback
    const lang = resolve(opts.lang) ?? locale ?? "en"
    const out = opts.t(key, lang)
    return out && out !== key ? out : fallback
  }

  const root = document.createElement("div")
  root.className = "wp-inv"
  if (opts.accent) root.style.setProperty("--wp-inv-accent", opts.accent)
  body.appendChild(root)

  function heading(text: string): HTMLElement {
    const h = document.createElement("div")
    h.className = "wp-inv-heading"
    h.textContent = text
    return h
  }

  function emptyLine(text: string): HTMLElement {
    const e = document.createElement("div")
    e.className = "wp-inv-empty"
    e.textContent = text
    return e
  }

  function renderWallet(): HTMLElement {
    const block = document.createElement("section")
    block.className = "wp-inv-block wp-inv-wallet"
    block.appendChild(heading(strings.walletHeading))

    let entries: Array<{ currencyId: string; units: number }> = []
    try {
      entries = opts.store.walletEntries()
    } catch (err) {
      console.error(`${LOG} walletEntries threw:`, err)
    }

    if (!entries.length) {
      block.appendChild(emptyLine(strings.walletEmpty))
      return block
    }

    const list = document.createElement("div")
    list.className = "wp-inv-currencies"
    for (const { currencyId, units } of entries) {
      const c = getCurrency(currencyId)
      if (!c) continue
      const row = document.createElement("div")
      row.className = "wp-inv-currency"

      // The premium glyph — the largest physical denomination in this balance.
      const stacks = topStacks(c, units, 1)
      const spec = stacks.length ? denominationIconSpec(c, stacks[0].denom) : currencyIconSpec(c)
      const icon = renderer.renderIcon(spec, { size: 44 })
      icon.className = "wp-inv-currency-icon"
      icon.style.width = "38px"
      icon.style.height = "38px"
      row.appendChild(icon)

      const text = document.createElement("div")
      text.className = "wp-inv-currency-text"
      const name = document.createElement("div")
      name.className = "wp-inv-currency-name"
      // "R" becomes "Reales": the localized currency NAME, not the bare symbol.
      name.textContent = tr(`wp.currency.${c.id}`, c.name)
      const amount = document.createElement("div")
      amount.className = "wp-inv-currency-amount"
      amount.textContent = format(c, units, locale)
      text.append(name, amount)
      row.appendChild(text)

      list.appendChild(row)
    }
    block.appendChild(list)
    return block
  }

  /** The dedicated WARDROBE re-entry control (re-dress / equip bought bling). */
  function wardrobeButton(): HTMLElement | null {
    if (!opts.openWardrobe) return null
    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = "wp-inv-link wp-inv-wardrobe-btn"
    btn.textContent = `👗 ${strings.openWardrobe} ▸`
    btn.addEventListener("click", () => {
      try {
        opts.openWardrobe?.()
      } catch (err) {
        console.error(`${LOG} openWardrobe threw:`, err)
      }
    })
    return btn
  }

  function renderItems(): HTMLElement {
    const block = document.createElement("section")
    block.className = "wp-inv-block wp-inv-items"
    block.appendChild(heading(strings.itemsHeading))

    let bag: Array<{ def: { id: string; name: string; description?: string }; qty: number }> = []
    try {
      bag = opts.store.bagWithDefs()
    } catch (err) {
      console.error(`${LOG} bagWithDefs threw:`, err)
    }

    if (!bag.length) {
      block.appendChild(emptyLine(strings.itemsEmpty))
      const wb = wardrobeButton()
      if (wb) block.appendChild(wb)
      return block
    }

    const grid = document.createElement("div")
    grid.className = "wp-inv-grid"
    for (const { def, qty } of bag) {
      const cell = document.createElement("div")
      cell.className = "wp-inv-cell"
      cell.title = def.description ?? def.name

      const face = document.createElement("div")
      face.className = "wp-inv-cell-face"
      face.setAttribute("aria-hidden", "true")
      // Initial of the item as a quiet monogram (items render their own art
      // in-world; the bag is a dignified label grid, not a second art pipeline).
      face.textContent = (def.name || def.id).trim().charAt(0).toUpperCase()
      cell.appendChild(face)

      const label = document.createElement("div")
      label.className = "wp-inv-cell-name"
      label.textContent = def.name
      cell.appendChild(label)

      if (qty > 1) {
        const q = document.createElement("div")
        q.className = "wp-inv-cell-qty"
        q.textContent = strings.qty(qty)
        cell.appendChild(q)
      }
      grid.appendChild(cell)
    }
    block.appendChild(grid)
    const wb = wardrobeButton()
    if (wb) block.appendChild(wb)
    return block
  }

  function renderBadges(): HTMLElement | null {
    if (!opts.masteredCount && !opts.openBadges) return null
    const block = document.createElement("section")
    block.className = "wp-inv-block wp-inv-badges"
    block.appendChild(heading(strings.badgesHeading))

    let mastered = 0
    try {
      mastered = opts.masteredCount ? opts.masteredCount() : 0
    } catch (err) {
      console.error(`${LOG} masteredCount threw:`, err)
    }

    const line = document.createElement("div")
    line.className = "wp-inv-badges-line"
    line.textContent = strings.badgesSummary(mastered)
    block.appendChild(line)

    if (opts.openBadges) {
      const btn = document.createElement("button")
      btn.type = "button"
      btn.className = "wp-inv-link"
      btn.textContent = `${strings.openBadges} ▸`
      btn.addEventListener("click", () => {
        try {
          opts.openBadges?.()
        } catch (err) {
          console.error(`${LOG} openBadges threw:`, err)
        }
      })
      block.appendChild(btn)
    }
    return block
  }

  function render(): void {
    try {
      root.replaceChildren()
      root.appendChild(renderWallet())
      root.appendChild(renderItems())
      const badges = renderBadges()
      if (badges) root.appendChild(badges)
    } catch (err) {
      console.error(`${LOG} render failed:`, err)
    }
  }

  render()
  // Live: refresh the wallet/items while the menu is open.
  let unsub: () => void = () => {}
  try {
    unsub = opts.store.subscribe(() => render())
  } catch (err) {
    console.error(`${LOG} subscribe failed:`, err)
  }

  return () => {
    try {
      unsub()
      root.remove()
    } catch (err) {
      console.error(`${LOG} cleanup failed:`, err)
    }
  }
}
