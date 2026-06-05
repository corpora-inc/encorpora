import "./npcOffer.css"
import type { Item } from "../items/itemTypes"
import { isCosmetic } from "../items/itemTypes"
import { getItemDef, type InventoryStore } from "./inventory"
import { getCurrency, formatMajor } from "./currencies"
import { relevance } from "./questItems"

/**
 * npcOffer — REAL, inventory-affecting buy / sell / trade offers an NPC presents
 * in-conversation, not just flavour talk.
 *
 * The principle (PREMIUM_FOUNDATIONS §6, kid-safe by construction): an offer is a
 * structured, DETERMINISTIC artifact — never free text, never a money-printer.
 * A special/dedicated NPC stands at an anchor and proposes a concrete deal:
 *
 *     "I'll give you my {item} for {price} coins."          (npc → player BUY)
 *     "I'll take that {item} off your hands for {price}."   (player → npc SELL)
 *     "Trade me your {give} and I'll hand you my {get}."    (item ⇄ item SWAP)
 *
 * The offer is generated DETERMINISTICALLY from a seed (the npc id × visit) so the
 * same NPC offers a stable deal each visit and the harness can assert it.
 * Accepting it mutates the LIVE `InventoryStore` atomically (debit + grant, or
 * consume + credit, or swap), then fires a juicy confirm. There is no randomness
 * at apply time and no way to go negative — `canAcceptOffer` gates the button and
 * `applyNpcOffer` re-checks ownership before mutating (no partial mutation).
 *
 * This rides the SAME deterministic affordance seam the quest engine uses
 * (npcRuntime `forcedOffer.onConfirm`): the orchestrator surfaces an offer chip,
 * tapping it opens this confirm sheet, and the player Accepts / Declines from
 * MENUS only. The NPC never "decides" the deal — it is data the orchestrator
 * composes from the npc's role + the catalog.
 */

/* ----------------------------------------------------------------- model */

export type OfferKind = "buy" | "sell" | "swap"

/** One concrete deal an NPC stands behind. Built from the catalog, never UGC. */
export interface NpcOffer {
  kind: OfferKind
  /** The NPC making the offer (display name for the sheet header). */
  npcName: string
  /** A short, in-character pitch line (localized by the caller). */
  pitch: string
  /**
   * BUY: the item the NPC sells the player (granted on accept).
   * SELL: the item the NPC buys FROM the player (consumed on accept).
   * SWAP: the item the NPC GIVES (granted on accept).
   */
  itemId: string
  /** SWAP only: the item the NPC wants in return (consumed on accept). */
  wantItemId?: string
  /** Currency id the price is denominated in (the Track's default). */
  currencyId: string
  /**
   * Price in MINOR units. BUY → player pays it; SELL → player receives it;
   * SWAP → 0 (an even item-for-item trade) unless the caller adds a sweetener.
   */
  price: number
}

/* ----------------------------------------------------------------- pricing */

/** NPC buys back from the player at this fraction of value (no printer). */
const NPC_BUY_FROM_PLAYER_FRACTION = 0.6
/** A special NPC's BUY price markup vs base value (a fair, friendly deal). */
const NPC_SELL_TO_PLAYER_MARKUP = 1.1

function priceToBuy(it: Item): number {
  return Math.max(1, Math.round(it.value * NPC_SELL_TO_PLAYER_MARKUP))
}
function priceToSell(it: Item): number {
  return Math.max(1, Math.round(it.value * NPC_BUY_FROM_PLAYER_FRACTION))
}

/* ------------------------------------------------------- deterministic gen */

/** A tiny FNV-ish hash → a stable non-negative int from a seed string. */
function seedHash(seed: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

/** Pick a stable element of `arr` for a seed (empty → undefined). */
function pick<T>(arr: T[], seed: string): T | undefined {
  if (!arr.length) return undefined
  return arr[seedHash(seed) % arr.length]
}

export interface OfferGenInput {
  /** Stable NPC id (drives the deterministic deal). */
  npcId: string
  /** Display name for the sheet. */
  npcName: string
  /** The visit counter (so the deal can rotate, still deterministic). */
  visit?: number
  /** The Track default currency the price is quoted in. */
  currencyId: string
  /** The item ids this NPC is willing to deal in (the merchant's stock). */
  stock: string[]
  /** Live inventory (to bias toward a SELL when the player holds stock). */
  store: InventoryStore
  /** Active quest id, so a SELL never targets a quest-critical item. */
  questId?: string
  /** Localized pitch lines keyed by kind (caller supplies; English default). */
  pitches?: Partial<Record<OfferKind, (item: string, price: string) => string>>
}

const DEFAULT_PITCH: Record<OfferKind, (item: string, price: string) => string> = {
  buy: (item, price) => `I can let you have my ${item} for ${price}. Interested?`,
  sell: (item, price) => `That ${item} of yours — I'll give you ${price} for it.`,
  swap: (item) => `Trade you my ${item} for one of yours — a fair swap?`,
}

/**
 * Deterministically resolve THE standing offer for an NPC. Returns null when the
 * NPC has nothing sensible to deal (empty stock / no tradable item). Bias:
 *   - if the player holds a tradable, junk-for-this-quest item the NPC wants →
 *     a SELL offer (turn clutter into coins);
 *   - else if the NPC has a tradable item the player can plausibly acquire → BUY;
 *   - else a SWAP of an owned item for the NPC's item.
 * The choice is stable for a given (npcId, visit) seed.
 */
export function resolveNpcOffer(input: OfferGenInput): NpcOffer | null {
  const seed = `${input.npcId}|${input.visit ?? 0}`
  const pitchFor = (k: OfferKind, item: string, price: string): string =>
    (input.pitches?.[k] ?? DEFAULT_PITCH[k])(item, price)

  const stockDefs = input.stock
    .map(getItemDef)
    .filter((d): d is Item => !!d && d.tradable && d.value > 0)
  if (!stockDefs.length) return null

  // SELL bias: a tradable bag item that is JUNK for the active quest (safe to
  // sell) — turn clutter into coins. Never targets a quest-critical key.
  const sellable = input.store
    .bagWithDefs()
    .map((b) => b.def)
    .filter(
      (d) =>
        d.tradable &&
        d.value > 0 &&
        d.kind !== "quest" &&
        (!input.questId || relevance(input.questId, d) === "junk"),
    )
  if (sellable.length) {
    const want = pick(sellable, seed + "|sell")!
    const price = priceToSell(want)
    return {
      kind: "sell",
      npcName: input.npcName,
      pitch: pitchFor("sell", want.name, fmtPrice(price, input.currencyId)),
      itemId: want.id,
      currencyId: input.currencyId,
      price,
    }
  }

  // BUY: the NPC offers an item from stock the player does not already own
  // (non-stackable) — a fresh acquisition.
  const buyable = stockDefs.filter((d) => d.stackable || input.store.qtyOf(d.id) === 0)
  if (buyable.length) {
    const give = pick(buyable, seed + "|buy")!
    const price = priceToBuy(give)
    return {
      kind: "buy",
      npcName: input.npcName,
      pitch: pitchFor("buy", give.name, fmtPrice(price, input.currencyId)),
      itemId: give.id,
      currencyId: input.currencyId,
      price,
    }
  }

  // SWAP fallback: trade an owned tradable item for one of the NPC's.
  const owned = input.store
    .bagWithDefs()
    .map((b) => b.def)
    .filter((d) => d.tradable && d.kind !== "quest")
  if (owned.length) {
    const get = pick(stockDefs, seed + "|swapget")!
    const give = pick(owned, seed + "|swapgive")!
    if (give.id !== get.id) {
      return {
        kind: "swap",
        npcName: input.npcName,
        pitch: pitchFor("swap", get.name, ""),
        itemId: get.id,
        wantItemId: give.id,
        currencyId: input.currencyId,
        price: 0,
      }
    }
  }
  return null
}

/** Grouped major price WITHOUT the symbol (the symbol rides alongside in the UI). */
function fmtPrice(minor: number, currencyId: string): string {
  const c = getCurrency(currencyId)
  if (!c) return String(minor)
  return formatMajor(c, minor)
}

/* ----------------------------------------------------------------- apply */

export interface OfferApplyResult {
  ok: boolean
  /** machine-readable reason on failure (localized in UI). */
  reason?: "insufficient-funds" | "missing-item" | "owned" | "unknown-item"
}

/** Can the player accept this offer right now? (gates the Accept button). */
export function canAcceptOffer(store: InventoryStore, offer: NpcOffer): OfferApplyResult {
  const it = getItemDef(offer.itemId)
  if (!it) return { ok: false, reason: "unknown-item" }
  switch (offer.kind) {
    case "buy":
      if (!it.stackable && store.qtyOf(it.id) > 0) return { ok: false, reason: "owned" }
      if (store.balance(offer.currencyId) < offer.price) return { ok: false, reason: "insufficient-funds" }
      return { ok: true }
    case "sell":
      if (store.qtyOf(it.id) <= 0) return { ok: false, reason: "missing-item" }
      return { ok: true }
    case "swap": {
      if (!offer.wantItemId) return { ok: false, reason: "missing-item" }
      if (store.qtyOf(offer.wantItemId) <= 0) return { ok: false, reason: "missing-item" }
      if (!it.stackable && store.qtyOf(it.id) > 0) return { ok: false, reason: "owned" }
      return { ok: true }
    }
  }
}

/**
 * Apply an accepted offer to the LIVE inventory, atomically. Re-checks the gate
 * first (state may have changed between presentation and accept), then mutates:
 *   BUY  → debit price, grant item.
 *   SELL → consume item, credit price.
 *   SWAP → consume wanted item, grant offered item (+ optional coin sweetener).
 * Returns the result; on any failure it makes NO partial mutation.
 */
export function applyNpcOffer(store: InventoryStore, offer: NpcOffer): OfferApplyResult {
  const gate = canAcceptOffer(store, offer)
  if (!gate.ok) return gate

  switch (offer.kind) {
    case "buy": {
      if (offer.price > 0 && !store.debit(offer.currencyId, offer.price)) {
        return { ok: false, reason: "insufficient-funds" }
      }
      store.grant(offer.itemId, 1)
      return { ok: true }
    }
    case "sell": {
      if (!store.consume(offer.itemId, 1)) return { ok: false, reason: "missing-item" }
      if (offer.price > 0) store.credit(offer.currencyId, offer.price)
      return { ok: true }
    }
    case "swap": {
      if (!offer.wantItemId) return { ok: false, reason: "missing-item" }
      if (!store.consume(offer.wantItemId, 1)) return { ok: false, reason: "missing-item" }
      store.grant(offer.itemId, 1)
      if (offer.price > 0) store.credit(offer.currencyId, offer.price)
      return { ok: true }
    }
  }
}

/* ----------------------------------------------------------------- glyph */

function offerGlyph(it: Item | undefined): string {
  if (!it) return "📦"
  return isCosmetic(it)
    ? "🎽"
    : it.kind === "consumable"
      ? "🍽️"
      : it.kind === "quest"
        ? "🔑"
        : "📦"
}

/* ----------------------------------------------------------------- present */

export interface OfferStrings {
  /** Sheet title, e.g. "An offer". */
  title: string
  accept: string
  decline: string
  /** Footer line shown on the appropriate gate failure. */
  cantAfford: string
  alreadyOwned: string
}

const DEFAULT_OFFER_STRINGS: OfferStrings = {
  title: "An offer",
  accept: "It's a deal",
  decline: "No thanks",
  cantAfford: "You can't afford this yet.",
  alreadyOwned: "You already have one.",
}

export interface PresentOfferOptions {
  offer: NpcOffer
  store: InventoryStore
  /** mount target — MUST be inside `.wp-overlay`, never document.body. */
  container: HTMLElement
  accent?: string
  strings?: Partial<OfferStrings>
  /** Fired after the player accepts AND the deal applies successfully. */
  onAccepted?: (offer: NpcOffer) => void
  /** Fired on decline / dismiss. */
  onDeclined?: () => void
}

export interface OfferHandle {
  close(): void
}

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

/**
 * Present the offer as a juicy in-pack confirm sheet (NEVER window.confirm — it
 * silently no-ops in the Tauri WebView). Accept applies the deal; both Accept and
 * Decline resolve once and tear down with a compositor-only fade.
 */
export function presentNpcOffer(opts: PresentOfferOptions): OfferHandle {
  const strings: OfferStrings = { ...DEFAULT_OFFER_STRINGS, ...(opts.strings ?? {}) }
  const { offer, store } = opts
  const it = getItemDef(offer.itemId)
  const wantIt = offer.wantItemId ? getItemDef(offer.wantItemId) : undefined

  const root = el("div", "wp-offer")
  if (opts.accent) root.style.setProperty("--wp-offer-accent", opts.accent)
  root.setAttribute("role", "dialog")
  root.setAttribute("aria-label", strings.title)
  const scrim = el("div", "wp-offer-scrim")
  const sheet = el("div", "wp-offer-sheet")
  root.append(scrim, sheet)

  let settled = false
  const close = (accepted: boolean) => {
    if (settled) return
    settled = true
    root.classList.remove("wp-offer--in")
    window.removeEventListener("keydown", onKey)
    const done = () => {
      root.remove()
      if (accepted) opts.onAccepted?.(offer)
      else opts.onDeclined?.()
    }
    root.addEventListener("transitionend", done, { once: true })
    window.setTimeout(done, 320)
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") close(false)
  }
  window.addEventListener("keydown", onKey)
  scrim.addEventListener("click", () => close(false))

  // header
  sheet.append(el("div", "wp-offer-eyebrow", `${offer.npcName} · ${strings.title}`))
  sheet.append(el("p", "wp-offer-pitch", offer.pitch))

  // the deal visual: give ⇄ get
  const deal = el("div", "wp-offer-deal")
  const chip = (item: Item | undefined, sub: string, kind: "give" | "get") => {
    const c = el("div", `wp-offer-chip wp-offer-chip--${kind}`)
    c.append(el("div", `wp-offer-art wp-offer-art--${item?.rarity ?? "common"}`, offerGlyph(item)))
    c.append(el("div", "wp-offer-chip-name", item?.name ?? sub))
    if (sub) c.append(el("div", "wp-offer-chip-sub", sub))
    return c
  }

  if (offer.kind === "buy") {
    deal.append(chip(it, priceLabel(offer), "get"))
  } else if (offer.kind === "sell") {
    deal.append(chip(it, priceLabel(offer), "give"))
  } else {
    deal.append(chip(wantIt, "", "give"))
    deal.append(el("div", "wp-offer-arrow", "⇄"))
    deal.append(chip(it, "", "get"))
  }
  sheet.append(deal)

  const gate = canAcceptOffer(store, offer)
  const note = el("div", "wp-offer-note")
  if (!gate.ok) {
    note.textContent =
      gate.reason === "insufficient-funds"
        ? strings.cantAfford
        : gate.reason === "owned"
          ? strings.alreadyOwned
          : ""
  }
  if (note.textContent) sheet.append(note)

  const row = el("div", "wp-offer-actions")
  const decline = el("button", "wp-offer-btn wp-offer-btn--ghost", strings.decline)
  decline.addEventListener("click", () => close(false))
  const accept = el("button", "wp-offer-btn wp-offer-btn--accept", strings.accept) as HTMLButtonElement
  accept.disabled = !gate.ok
  accept.addEventListener("click", () => {
    const res = applyNpcOffer(store, offer)
    if (!res.ok) {
      // Re-check failed (state changed) — surface it noisily, do not pretend.
      console.warn("[wp/npcOffer] apply failed:", res.reason)
      note.textContent =
        res.reason === "insufficient-funds" ? strings.cantAfford : strings.alreadyOwned
      if (!note.parentElement) sheet.insertBefore(note, row)
      accept.disabled = true
      return
    }
    close(true)
  })
  row.append(decline, accept)
  sheet.append(row)

  opts.container.append(root)
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add("wp-offer--in")))

  return { close: () => close(false) }

  function priceLabel(o: NpcOffer): string {
    return `${fmtPrice(o.price, o.currencyId)} ${currencySymbol(o.currencyId)}`.trim()
  }
}

function currencySymbol(currencyId: string): string {
  return getCurrency(currencyId)?.symbol ?? ""
}
