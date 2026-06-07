import "./shop.css"
import type { Item } from "../items/itemTypes"
import { isCosmetic } from "../items/itemTypes"
import { inventory, getItemDef, type InventoryStore } from "./inventory"
import { relevance, safeToSell, type ItemRelevance } from "./questItems"
import {
  draftProposal,
  validateProposal,
  applyTradeLocally,
  LocalTradeTransport,
  type TradeProposal,
} from "./trade"

/**
 * shop — the premium commerce overlay (buy / sell / trade / equip).
 *
 * Out-of-flow from the first frame (position:fixed), compositor-only open/close
 * (opacity + transform, never layout), on-brand paper-cutout, mobile-first.
 *
 * Three tabs:
 *   - BUY    — the merchant's stock; tap an item → detail → Buy (coins flow out).
 *   - SELL   — the player's tradable bag; sell back for a fraction (coins in).
 *              quest-relevance badges: "needed here" (don't sell) / "safe to sell".
 *   - TRADE  — open a player-to-player swap (AI-mediated, menus only) via trade.ts;
 *              in standalone dev a LocalTradeTransport plays the partner.
 *   - (cosmetics in the bag also offer EQUIP, wiring the avatar.)
 *
 * The merchant + price spread + which tab to open are all caller-supplied, so a
 * café owner sells coffee and a tailor sells hats from the same component.
 */

/* ----------------------------------------------------------------- pricing */

/** Merchant sells at value; buys back at this fraction (no money printer). */
const SELL_BACK_FRACTION = 0.5

function buyPrice(it: Item, markup = 1): number {
  return Math.max(1, Math.round(it.value * markup))
}
function sellPrice(it: Item): number {
  return Math.max(1, Math.round(it.value * SELL_BACK_FRACTION))
}

/* --------------------------------------------------------- art glyph map */

/**
 * Lightweight emoji glyph for the HTML overlay (the in-world 3D cutout uses
 * cutoutArt; this overlay is DOM, so we map the `art` id to a wholesome glyph).
 * Falls back by item kind. Real atlas thumbnails slot in here later.
 */
const ART_GLYPH: Record<string, string> = {
  "prop-token": "🪙", "prop-letter": "✉️", "prop-scroll": "📜", "prop-spectacles": "👓",
  "prop-key": "🗝️", "prop-book": "📕", "prop-spice": "🌿", "prop-cloth": "🧵",
  "prop-pot": "🏺", "prop-coin": "🪙", "prop-gem": "💎", "prop-candle": "🕯️",
  "prop-pouch": "👝", "prop-sack": "🛍️", "prop-bread": "🍞", "prop-cup": "☕",
  "prop-basket": "🧺", "prop-flask": "🧴", "prop-map": "🗺️", "prop-charm": "🧿",
  "cos-hat-sun": "👒", "cos-hat-tricorn": "🎩", "cos-hat-bonnet": "👒", "cos-hat-feather": "🎩",
  "cos-top-linen": "👕", "cos-top-embroidered": "👚", "cos-top-coat": "🧥",
  "cos-shoes-leather": "👞", "cos-acc-satchel": "🎒", "cos-acc-shawl": "🧣",
  "cos-acc-quill": "🖋️", "cos-face-spectacles": "👓", "cos-aura-festival": "✨", "cos-aura-petals": "🌼",
}
function glyph(it: Item): string {
  return (
    ART_GLYPH[it.art] ??
    (it.kind === "cosmetic" ? "🎽" : it.kind === "consumable" ? "🍽️" : it.kind === "quest" ? "🔑" : "📦")
  )
}

/* ----------------------------------------------------------------- options */

export type ShopTab = "buy" | "sell" | "trade"

export interface MerchantConfig {
  /** Display name, e.g. "Marta the Grocer". */
  name: string
  /** One-line subtitle, e.g. "Spices & coffee". */
  subtitle?: string
  /** Merchant avatar glyph. */
  emoji?: string
  /** Item ids this merchant sells (defaults to a small mixed stock). */
  stock: string[]
  /** Price markup vs base value (1 = at value). */
  markup?: number
}

export interface ShopOptions {
  merchant: MerchantConfig
  /** The active quest, for relevance badges + "safe to sell" hints. */
  questId?: string
  /** Start tab. */
  tab?: ShopTab
  store?: InventoryStore
  /** local player id for trade drafts. */
  playerId?: string
  /** Called after the overlay closes. */
  onClose?: () => void
}

export interface ShopHandle {
  close(): void
}

/* ----------------------------------------------------------------- el util */

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (text != null) n.textContent = text
  return n
}

/* ----------------------------------------------------------------- mount */

export function openShop(container: HTMLElement, opts: ShopOptions): ShopHandle {
  const store = opts.store ?? inventory()
  const playerId = opts.playerId ?? "player-local"
  let tab: ShopTab = opts.tab ?? "buy"
  let selectedId: string | null = null

  const root = el("div", "wp-shop")
  root.setAttribute("role", "dialog")
  root.setAttribute("aria-label", `${opts.merchant.name} — shop`)

  const scrim = el("div", "wp-shop-scrim")
  const sheet = el("div", "wp-shop-sheet")
  root.append(scrim, sheet)

  const toast = el("div", "wp-shop-toast")
  sheet.append(toast)
  let toastTimer: number | undefined
  const showToast = (msg: string) => {
    toast.textContent = msg
    toast.classList.add("wp-shop-toast--show")
    window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => toast.classList.remove("wp-shop-toast--show"), 1400)
  }

  /* header */
  const head = el("div", "wp-shop-head")
  const merch = el("div", "wp-shop-merchant")
  const avatar = el("div", "wp-shop-merchant-avatar", opts.merchant.emoji ?? "🧑‍🌾")
  const merchText = el("div")
  merchText.append(
    el("div", "wp-shop-merchant-name", opts.merchant.name),
    el("div", "wp-shop-merchant-sub", opts.merchant.subtitle ?? "Goods & wares"),
  )
  merch.append(avatar, merchText)
  const wallet = el("div", "wp-shop-wallet")
  const walletCoin = el("span", "wp-shop-coin", "🪙")
  const walletAmt = el("span")
  wallet.append(walletCoin, walletAmt)
  head.append(merch, wallet)

  const closeBtn = el("button", "wp-shop-close", "✕")
  closeBtn.setAttribute("aria-label", "Close")
  sheet.append(head, closeBtn)

  /* tabs */
  const tabsRow = el("div", "wp-shop-tabs")
  const tabDefs: Array<[ShopTab, string]> = [
    ["buy", "Buy"],
    ["sell", "Sell"],
    ["trade", "Trade"],
  ]
  const tabBtns = new Map<ShopTab, HTMLButtonElement>()
  for (const [id, label] of tabDefs) {
    const b = el("button", "wp-shop-tab", label)
    b.addEventListener("click", () => {
      tab = id
      selectedId = null
      render()
    })
    tabBtns.set(id, b)
    tabsRow.append(b)
  }
  sheet.append(tabsRow)

  /* body (grid) + detail */
  const body = el("div", "wp-shop-body")
  const grid = el("div", "wp-shop-grid")
  body.append(grid)
  const detailWrap = el("div")
  sheet.append(body, detailWrap)

  /* ---- renderers ---- */

  function cell(it: Item, opts2: { qty?: number; badge?: ItemRelevance | "sell"; price?: number }): HTMLElement {
    const c = el("div", "wp-shop-cell")
    if (it.id === selectedId) c.classList.add("wp-shop-cell--sel")
    const art = el("div", `wp-shop-art wp-shop-art--${it.rarity}`, glyph(it))
    c.append(art)
    if (opts2.qty && opts2.qty > 1) c.append(el("div", "wp-shop-qty", `×${opts2.qty}`))
    if (opts2.badge === "required" || opts2.badge === "useful") {
      c.append(el("div", "wp-shop-badge wp-shop-badge--need", opts2.badge === "required" ? "NEEDED" : "USEFUL"))
    } else if (opts2.badge === "sell") {
      c.append(el("div", "wp-shop-badge wp-shop-badge--sell", "SELL OK"))
    }
    c.append(el("div", "wp-shop-cell-name", it.name))
    if (opts2.price != null) {
      const foot = el("div", "wp-shop-cell-foot")
      foot.append(el("span", "wp-shop-coin", "🪙"), el("span", undefined, String(opts2.price)))
      c.append(foot)
    }
    c.addEventListener("click", () => {
      selectedId = it.id
      render()
    })
    return c
  }

  function renderDetail() {
    detailWrap.replaceChildren()
    if (!selectedId) return
    const it = getItemDef(selectedId)
    if (!it) return

    const detail = el("div", "wp-shop-detail")
    detail.append(el("div", "wp-shop-detail-art", glyph(it)))
    const main = el("div", "wp-shop-detail-main")
    main.append(
      el("div", "wp-shop-detail-name", it.name),
      el("div", "wp-shop-detail-kind", `${it.kind} · ${it.rarity}`),
      el("div", "wp-shop-detail-desc", it.description),
    )
    detail.append(main)
    detailWrap.append(detail)

    const actions = el("div", "wp-shop-actions")

    if (tab === "buy") {
      const price = buyPrice(it, opts.merchant.markup ?? 1)
      const buy = el("button", "wp-shop-btn wp-shop-btn--buy", `Buy · ${price} 🪙`) as HTMLButtonElement
      const owned = store.qtyOf(it.id)
      const cannotAfford = store.coins() < price
      const ownNonStackable = !it.stackable && owned > 0
      buy.disabled = cannotAfford || ownNonStackable
      if (ownNonStackable) buy.textContent = "Owned"
      else if (cannotAfford) buy.textContent = `Need ${price} 🪙`
      buy.addEventListener("click", () => {
        if (!store.spendCoins(price)) return showToast("Not enough coins")
        store.grant(it.id, 1)
        showToast(`Bought ${it.name}`)
        render()
      })
      actions.append(buy)
    } else if (tab === "sell") {
      const owned = store.qtyOf(it.id)
      const price = sellPrice(it)
      const sell = el("button", "wp-shop-btn wp-shop-btn--sell", `Sell · ${price} 🪙`) as HTMLButtonElement
      sell.disabled = owned <= 0 || !it.tradable
      if (!it.tradable) sell.textContent = "Cannot sell"
      else if (owned <= 0) sell.textContent = "None to sell"
      sell.addEventListener("click", () => {
        if (!store.consume(it.id, 1)) return showToast("Nothing to sell")
        store.addCoins(price)
        showToast(`Sold ${it.name} (+${price} 🪙)`)
        if (store.qtyOf(it.id) <= 0) selectedId = null
        render()
      })
      actions.append(sell)
    } else if (tab === "trade") {
      // Trade tab: propose THIS owned item in exchange for the merchant's stock
      // first item (a simple, safe, menu-only demo of the mediated pipeline).
      const tradeBtn = el("button", "wp-shop-btn wp-shop-btn--buy", "Propose trade") as HTMLButtonElement
      tradeBtn.addEventListener("click", () => void proposeTrade(it))
      actions.append(tradeBtn)
    }

    // EQUIP for owned cosmetics (any tab).
    if (isCosmetic(it) && store.has(it.id)) {
      const equipped = store.getState().equipped[it.slot]?.itemId === it.id
      const eq = el("button", "wp-shop-btn wp-shop-btn--equip", equipped ? "Unequip" : "Equip") as HTMLButtonElement
      eq.addEventListener("click", () => {
        if (equipped) store.unequip(it.slot)
        else store.equip(it.id, it.tints?.[0])
        showToast(equipped ? `Took off ${it.name}` : `Wearing ${it.name}`)
        render()
      })
      actions.append(eq)
    }

    if (actions.childElementCount) detailWrap.append(actions)
  }

  async function proposeTrade(give: Item) {
    const wantId = opts.merchant.stock.find((id) => {
      const d = getItemDef(id)
      return d && d.tradable
    })
    if (!wantId) return showToast("Nothing to trade for")
    const proposal: TradeProposal = {
      ...draftProposal(playerId, "partner-local"),
      offer: { items: [{ itemId: give.id, qty: 1 }], coins: 0 },
      request: { items: [{ itemId: wantId, qty: 1 }], coins: 0 },
      note: "fair-deal",
      status: "proposed",
    }
    const check = validateProposal(store, proposal)
    if (!check.ok) return showToast(`Trade not allowed (${check.reasons[0]})`)

    const transport = new LocalTradeTransport("accept")
    const off = transport.onUpdate((p) => {
      if (p.status === "accepted") {
        if (applyTradeLocally(store, p, "from")) showToast("Trade accepted!")
        else showToast("Trade could not complete")
        render()
      } else if (p.status === "declined") {
        showToast("Partner declined")
      }
      off()
    })
    await transport.propose(proposal)
  }

  function render() {
    walletAmt.textContent = String(store.coins())
    for (const [id, b] of tabBtns) b.classList.toggle("wp-shop-tab--on", id === tab)
    grid.replaceChildren()

    if (tab === "buy") {
      const stock = opts.merchant.stock.map(getItemDef).filter((x): x is Item => !!x)
      if (!stock.length) grid.append(el("div", "wp-shop-empty", "The merchant has nothing today."))
      for (const it of stock) {
        const badge = opts.questId ? relevance(opts.questId, it) : undefined
        grid.append(cell(it, { price: buyPrice(it, opts.merchant.markup ?? 1), badge: badge === "junk" ? undefined : badge }))
      }
    } else {
      // sell + trade both show the player's bag
      const bag = store.bagWithDefs()
      if (!bag.length) grid.append(el("div", "wp-shop-empty", "Your bag is empty."))
      for (const { def, qty } of bag) {
        let badge: ItemRelevance | "sell" | undefined
        if (opts.questId) {
          const rel = relevance(opts.questId, def)
          if (rel !== "junk") badge = rel
          else if (tab === "sell" && safeToSell(opts.questId, def)) badge = "sell"
        }
        grid.append(cell(def, { qty, badge, price: tab === "sell" ? sellPrice(def) : undefined }))
      }
    }
    renderDetail()
  }

  /* ---- lifecycle ---- */
  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    root.classList.remove("wp-shop--in")
    unsub()
    window.removeEventListener("keydown", onKey)
    window.clearTimeout(toastTimer)
    const done = () => {
      root.remove()
      opts.onClose?.()
    }
    root.addEventListener("transitionend", done, { once: true })
    window.setTimeout(done, 360) // fallback if transitionend doesn't fire
  }
  closeBtn.addEventListener("click", close)
  scrim.addEventListener("click", close)
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") close()
  }
  window.addEventListener("keydown", onKey)

  // live-update wallet/bag when the inventory changes elsewhere.
  const unsub = store.subscribe(() => {
    if (!closed) render()
  })

  container.append(root)
  render()
  // next frame → compositor-only fade/rise in (no layout shift)
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add("wp-shop--in")))

  return { close }
}

/* ------------------------------------------------------- merchant presets */

/**
 * Convenience presets so a game.ts NPC can open a themed shop in one call.
 * `openMerchant(container, "grocer")` etc.
 */
export const MERCHANTS: Record<string, MerchantConfig> = {
  grocer: {
    name: "Marta the Grocer",
    subtitle: "Spices, coffee & market goods",
    emoji: "🧺",
    stock: ["spices-cinnamon", "spices-cacao", "coffee-sack", "fruit-basket", "fresh-bread", "salt-pouch", "clay-pot"],
  },
  tailor: {
    name: "Don Felipe, Tailor",
    subtitle: "Hats, coats & fine cloth",
    emoji: "🧵",
    stock: ["straw-hat", "tricorn-hat", "bonnet-lace", "linen-shirt", "embroidered-blouse", "traveler-coat", "woolen-shawl", "leather-shoes"],
  },
  cafe: {
    name: "Café Owner",
    subtitle: "Coffee & sweets",
    emoji: "☕",
    stock: ["cup-of-coffee", "herbal-tea", "fresh-bread", "fruit-basket"],
  },
  trader: {
    name: "Wandering Trader",
    subtitle: "Curios & rare finds",
    emoji: "🎒",
    stock: ["map-scrap", "lucky-charm", "silver-coin-old", "jade-bead", "feathered-cap", "candle-beeswax"],
  },
}

export function openMerchant(
  container: HTMLElement,
  preset: keyof typeof MERCHANTS,
  extra?: Partial<ShopOptions>,
): ShopHandle {
  return openShop(container, { merchant: MERCHANTS[preset], ...extra })
}
