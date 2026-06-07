import type { Item } from "../items/itemTypes"
import { getItemDef } from "./inventory"
import type { InventoryStore } from "./inventory"

/**
 * trade — AI-mediated PLAYER-TO-PLAYER item swaps (DESIGN + local stub).
 *
 * THE SAFETY PRINCIPLE (PREMIUM_FOUNDATIONS §6, §8, §9): two real humans can
 * trade items, but they NEVER exchange raw user-generated content. A trade is a
 * structured, typed ARTIFACT built entirely from MENU CHOICES:
 *
 *     [give these owned items] + [coins] ⇄ [ask for these items] + [coins]
 *
 * There is no free-text field anywhere in a trade. The only "expressive" channel
 * is a fixed list of curated, localized canned notes ("Fair deal?", "Thank
 * you!", "Could you add one more?") — chosen, never typed. This makes the whole
 * feature safe by construction for a seven-year-old.
 *
 * WHERE THE AI SITS (the same mediated-artifact pipeline as chat, §8):
 *   1. Proposer builds a `TradeProposal` from menus (this module, locally).
 *   2. On send, the proposal rides the mediated pipeline: each device's local
 *      model (or the server moderator) validates it against policy — item ids
 *      exist, quantities are owned, the swap isn't wildly lopsided/coercive,
 *      the canned note is on the allow-list — and may attach a gentle,
 *      LOCALIZED, in-character framing for the recipient ("Marta offers her
 *      cinnamon for your coffee sack — a fair market trade!"). It can also
 *      "lessonify": surface the item NAMES in both players' target languages so
 *      the swap doubles as vocabulary.
 *   3. Recipient sees the framed, translated artifact and Accepts / Counters /
 *      Declines — again all menus.
 *   4. On mutual accept, the server applies the atomic swap (authoritative);
 *      offline, the local stub applies it directly for solo testing.
 *
 * SERVER SEAM: `TradeTransport` is the interface the Colyseus client will
 * implement (`server/` later). The local stub (`LocalTradeTransport`) loops a
 * proposal straight back to an in-process "partner" so the full UI + data model
 * + apply path can be built and tested today with zero network. Swapping in the
 * real transport changes nothing above it.
 *
 * This file is data + a local transport + the apply logic. The trade UI is a
 * mode inside the shop overlay (`shop.ts`), reusing the same grid + detail card.
 */

/* ----------------------------------------------------------------- model */

/** One side's offer: item stacks + coins. Built only from owned inventory. */
export interface TradeOffer {
  /** [itemId, qty] the player puts on the table. */
  items: Array<{ itemId: string; qty: number }>
  coins: number
}

/** The fixed, curated, localizable notes — chosen from a menu, never typed. */
export const TRADE_NOTES = [
  { id: "fair-deal", text: "Fair deal?" },
  { id: "thank-you", text: "Thank you!" },
  { id: "one-more", text: "Could you add one more?" },
  { id: "no-thanks", text: "No thank you." },
  { id: "lets-trade", text: "Let's trade!" },
  { id: "great-pleasure", text: "A pleasure doing business." },
] as const
export type TradeNoteId = (typeof TRADE_NOTES)[number]["id"]

export type TradeStatus =
  | "draft" // being assembled by the proposer
  | "proposed" // sent, awaiting the partner
  | "countered" // partner sent back a modified offer
  | "accepted" // both sides agreed; ready to apply
  | "declined"
  | "cancelled"
  | "applied" // swap executed

export interface TradeProposal {
  id: string
  /** stable player ids (branded as PlayerId at the network boundary). */
  fromPlayerId: string
  toPlayerId: string
  /** what the proposer gives. */
  offer: TradeOffer
  /** what the proposer asks for in return. */
  request: TradeOffer
  /** a chosen canned note, never free text. */
  note?: TradeNoteId
  status: TradeStatus
  /** epoch millis. */
  createdAt: number
  updatedAt: number
}

/* --------------------------------------------------------------- transport */

/**
 * The seam the real Colyseus client implements later. Everything the trade UI
 * needs to talk to "the other player" goes through here, so the UI is
 * network-agnostic.
 */
export interface TradeTransport {
  /** Send a freshly built proposal to the partner (and the moderator). */
  propose(p: TradeProposal): Promise<void>
  /** Partner accepts/declines/counters; resolves when routed. */
  respond(proposalId: string, action: "accept" | "decline", counter?: TradeProposal): Promise<void>
  /** Subscribe to inbound proposal updates (partner actions, framings). */
  onUpdate(fn: (p: TradeProposal) => void): () => void
}

/**
 * LocalTradeTransport — a zero-network stub. It plays the PARTNER locally so the
 * full propose → (auto-accept|scripted-counter) → apply loop runs in dev and in
 * the self-verify harness. Mirrors the real artifact shape exactly.
 */
export class LocalTradeTransport implements TradeTransport {
  private listeners = new Set<(p: TradeProposal) => void>()
  /** How the simulated partner responds (overridable in tests). */
  constructor(
    private partnerBehavior: "accept" | "decline" = "accept",
    private delayMs = 0,
  ) {}

  async propose(p: TradeProposal): Promise<void> {
    // Simulate the partner receiving + responding after a tick.
    const reply = (): void => {
      const next: TradeProposal = {
        ...p,
        status: this.partnerBehavior === "accept" ? "accepted" : "declined",
        updatedAt: Date.now(),
      }
      this.emit(next)
    }
    if (this.delayMs > 0) setTimeout(reply, this.delayMs)
    else reply()
  }

  async respond(proposalId: string, action: "accept" | "decline"): Promise<void> {
    // Our local partner already decided in `propose`; this path is for when WE
    // are the recipient of a partner-initiated proposal (symmetry).
    void proposalId
    void action
  }

  onUpdate(fn: (p: TradeProposal) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(p: TradeProposal) {
    for (const fn of this.listeners) {
      try {
        fn(p)
      } catch (err) {
        console.error("[wp/trade] transport listener threw:", err)
      }
    }
  }
}

/* ----------------------------------------------------------------- builder */

let _seq = 0
const mintId = () => `trade-${Date.now().toString(36)}-${(_seq++).toString(36)}`

/** Start a draft proposal from this player to a partner. */
export function draftProposal(fromPlayerId: string, toPlayerId: string): TradeProposal {
  const now = Date.now()
  return {
    id: mintId(),
    fromPlayerId,
    toPlayerId,
    offer: { items: [], coins: 0 },
    request: { items: [], coins: 0 },
    status: "draft",
    createdAt: now,
    updatedAt: now,
  }
}

/* --------------------------------------------------------------- validation */

export interface TradeValidation {
  ok: boolean
  /** machine-readable reasons (localized in UI), never raw text from a user. */
  reasons: string[]
}

/**
 * Local policy check before a proposal can be sent. The same predicate runs on
 * the server as the authoritative gate. Catches: unknown items, items the
 * proposer doesn't actually own, empty trades, and grossly lopsided swaps
 * (a coarse anti-coercion heuristic, refined server-side).
 */
export function validateProposal(store: InventoryStore, p: TradeProposal): TradeValidation {
  const reasons: string[] = []

  const sideEmpty = (o: TradeOffer) => o.items.length === 0 && o.coins <= 0
  if (sideEmpty(p.offer) && sideEmpty(p.request)) reasons.push("trade-empty")

  // Proposer must own everything they offer.
  for (const { itemId, qty } of p.offer.items) {
    const def = getItemDef(itemId)
    if (!def) reasons.push(`unknown-item:${itemId}`)
    else if (!def.tradable) reasons.push(`untradable:${itemId}`)
    else if (store.qtyOf(itemId) < qty) reasons.push(`insufficient:${itemId}`)
  }
  if (p.offer.coins > store.coins()) reasons.push("insufficient-coins")

  // Requested items must at least exist + be tradable.
  for (const { itemId } of p.request.items) {
    const def = getItemDef(itemId)
    if (!def) reasons.push(`unknown-item:${itemId}`)
    else if (!def.tradable) reasons.push(`untradable:${itemId}`)
  }

  // Coarse fairness guard (anti-coercion). Value the two sides; flag if one side
  // is worth >8x the other (kid-safety: stop "give me everything for nothing").
  const v = (o: TradeOffer) =>
    o.coins + o.items.reduce((s, { itemId, qty }) => s + (getItemDef(itemId)?.value ?? 0) * qty, 0)
  const a = v(p.offer)
  const b = v(p.request)
  const hi = Math.max(a, b)
  const lo = Math.min(a, b)
  if (hi > 0 && lo > 0 && hi / lo > 8) reasons.push("lopsided")

  return { ok: reasons.length === 0, reasons }
}

/**
 * Apply an ACCEPTED trade to the local player's inventory. (The full bilateral
 * swap is the server's job; locally we apply OUR side: remove what we gave, add
 * what we received, settle coins.) Idempotent-guarded by status.
 */
export function applyTradeLocally(store: InventoryStore, p: TradeProposal, asSide: "from" | "to"): boolean {
  if (p.status !== "accepted") {
    console.warn(`[wp/trade] applyTradeLocally on non-accepted proposal ${p.id} (${p.status})`)
    return false
  }
  const give = asSide === "from" ? p.offer : p.request
  const get = asSide === "from" ? p.request : p.offer

  // Re-validate ownership at apply time (state may have changed).
  for (const { itemId, qty } of give.items) {
    if (store.qtyOf(itemId) < qty) {
      console.error(`[wp/trade] cannot apply: missing ${qty}× ${itemId}`)
      return false
    }
  }
  if (give.coins > store.coins()) {
    console.error("[wp/trade] cannot apply: insufficient coins")
    return false
  }

  for (const { itemId, qty } of give.items) store.consume(itemId, qty)
  if (give.coins > 0) store.spendCoins(give.coins)
  for (const { itemId, qty } of get.items) store.grant(itemId, qty)
  if (get.coins > 0) store.addCoins(get.coins)
  return true
}

/* ----------------------------------------------------------- lessonify seam */

/**
 * The mediated "lessonify" hook the AI fills in later: given a proposal, surface
 * each traded item's name in both players' target languages so the swap teaches
 * vocabulary. Local stub returns English names; the server/local-model attaches
 * real translations. Pure read of the catalog — no UGC.
 */
export function lessonifyTradeItems(p: TradeProposal): Array<{ itemId: string; name: string; def?: Item }> {
  const ids = [...p.offer.items, ...p.request.items].map((x) => x.itemId)
  return [...new Set(ids)].map((itemId) => {
    const def = getItemDef(itemId)
    return { itemId, name: def?.name ?? itemId, def }
  })
}
