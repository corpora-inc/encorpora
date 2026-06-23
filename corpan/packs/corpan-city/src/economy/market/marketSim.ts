import { feedMult, tickForEpoch } from "../priceSim"
import { getMarket, eventsFor, type Market, type MarketGood } from "./marketData"
import { getCurrency } from "../currencies"
import type { InventoryStore } from "../inventory"

/**
 * marketSim — the constant-spread AMM with an exogenous, simulated mid
 * (ECONOMY_CURRENCY §4.2). NOT a real order book at MVP: the player buys/sells a
 * good against the house at `mid ± spread`, always liquid, always bounded. The
 * mid walks via the shared `priceSim` (so it agrees across sessions on a day and
 * with the future server feed). Player orders nudge the price a touch (impact,
 * §4.2) and decay — bounded by `depth` so a thin market moves but can't be run.
 *
 * Buy low in one market, sell high in another (spatial arb) or across the walk
 * (temporal). Spread is the always-on sink (§7.1) → no instant arb.
 *
 * Impact is IN-MEMORY only (recomputable / server-authoritative later, §10.2);
 * positions (qty + avg cost) persist in the wallet-side store via the caller.
 */

/* -------------------------------------------------------- live good price */

/** The decayed impact state for a good (in-memory; never persisted). */
interface ImpactEntry {
  /** signed accumulated impact on feedMult. */
  value: number
  /** epoch (ms) of the last update, for decay. */
  at: number
}
const IMPACT = new Map<string, ImpactEntry>()
const IMPACT_HALF_LIFE_MS = 90_000 // impact halves every 90s

function impactKey(marketId: string, itemId: string): string {
  return `${marketId}:${itemId}`
}

function currentImpact(marketId: string, itemId: string, epochMs: number): number {
  const e = IMPACT.get(impactKey(marketId, itemId))
  if (!e) return 0
  const age = epochMs - e.at
  if (age <= 0) return e.value
  return e.value * Math.pow(0.5, age / IMPACT_HALF_LIFE_MS)
}

/**
 * Apply a bounded price impact from an order of `signedQty` (buy +, sell −).
 *
 * CRITICAL anti-arb invariant (§7.2 "no instant arb"): a single order's impact
 * must stay BELOW the market's half-spread, or a buyer could nudge the mid up
 * and immediately sell back at a profit. We scale per-unit impact small relative
 * to depth (IMPACT_PER_UNIT) so impact is slow price *pressure* accumulated over
 * many orders, never an instantaneous jump that beats the spread. The total is
 * still bounded so a thin market visibly moves on the feed but can't be run.
 */
const IMPACT_PER_UNIT = 0.0015 // multiplier added per (unit / depth)
function applyImpact(market: Market, good: MarketGood, signedQty: number, epochMs: number): void {
  const k = impactKey(market.id, good.itemId)
  const decayed = currentImpact(market.id, good.itemId, epochMs)
  // impact ∝ order size / depth, but a small coefficient keeps one order well
  // under the half-spread (e.g. depth 40, 1 unit → 0.0000375 ≪ 0.01 half-spread).
  const delta = (signedQty / good.depth) * IMPACT_PER_UNIT
  const next = Math.max(-0.25, Math.min(0.25, decayed + delta))
  IMPACT.set(k, { value: next, at: epochMs })
}

/** The live mid price (local-currency MINOR units) of a good in a market. */
export function goodMid(market: Market, good: MarketGood, epochMs = Date.now()): number {
  const evs = eventsFor("good", good.itemId)
  const walk = feedMult(`${market.id}:${good.itemId}`, tickForEpoch(epochMs), {
    volatility: good.volatility,
    events: evs,
  })
  const impact = currentImpact(market.id, good.itemId, epochMs)
  const mult = Math.max(0.1, walk + impact)
  return Math.max(1, Math.round(good.mid * mult))
}

export interface GoodQuote {
  itemId: string
  marketId: string
  currencyId: string
  mid: number
  /** what the player PAYS to buy one unit (mid + half-spread). */
  buy: number
  /** what the player RECEIVES to sell one unit (mid − half-spread). */
  sell: number
  spreadBps: number
}

/** Quote buy/sell prices for a good (per unit). */
export function quoteGood(marketId: string, itemId: string, epochMs = Date.now()): GoodQuote | null {
  const market = getMarket(marketId)
  if (!market) return null
  const good = market.goods.find((g) => g.itemId === itemId)
  if (!good) return null
  const mid = goodMid(market, good, epochMs)
  const half = market.spreadBps / 2 / 10000
  return {
    itemId,
    marketId,
    currencyId: market.localCurrency,
    mid,
    buy: Math.max(1, Math.ceil(mid * (1 + half))),
    sell: Math.max(1, Math.floor(mid * (1 - half))),
    spreadBps: market.spreadBps,
  }
}

/* ----------------------------------------------------------- positions / P-L */

/**
 * Per-good position: qty held + average cost (in the market's local currency
 * minor units). Avg cost lets us show unrealized P/L (a gentle numbers lesson).
 * Stored in a small map the caller persists per-Track (≤ a few KB, §10.2).
 */
export interface Position {
  itemId: string
  qty: number
  avgCost: number
}
export type Positions = Record<string, Position>

export function unrealizedPL(pos: Position, quote: GoodQuote): number {
  return (quote.sell - pos.avgCost) * pos.qty
}

/* ------------------------------------------------------------------ trading */

export interface TradeResult {
  ok: boolean
  reason?: string
  quote: GoodQuote
  /** updated position after the trade (or the unchanged one on failure). */
  position?: Position
}

/**
 * Buy `qty` units of a good against the market maker: debit the local currency
 * (buy price × qty), grant the item, update the position's avg cost, and nudge
 * the price up (impact). Atomic against the wallet balance.
 */
export function buyGood(
  store: InventoryStore,
  positions: Positions,
  marketId: string,
  itemId: string,
  qty: number,
  epochMs = Date.now(),
): TradeResult {
  const q = quoteGood(marketId, itemId, epochMs)
  if (!q) return { ok: false, reason: "unknown-good", quote: zeroQuote(marketId, itemId) }
  const n = Math.max(0, Math.floor(qty))
  if (n <= 0) return { ok: false, reason: "zero-amount", quote: q }
  const cost = q.buy * n
  if (store.balance(q.currencyId) < cost) return { ok: false, reason: "insufficient", quote: q }
  if (!store.debit(q.currencyId, cost)) return { ok: false, reason: "insufficient", quote: q }
  store.grant(itemId, n)

  const prev = positions[itemId] ?? { itemId, qty: 0, avgCost: 0 }
  const newQty = prev.qty + n
  const newAvg = newQty > 0 ? Math.round((prev.avgCost * prev.qty + q.buy * n) / newQty) : 0
  const pos: Position = { itemId, qty: newQty, avgCost: newAvg }
  positions[itemId] = pos

  const market = getMarket(marketId)
  const good = market?.goods.find((g) => g.itemId === itemId)
  if (market && good) applyImpact(market, good, n, epochMs)
  return { ok: true, quote: q, position: pos }
}

/**
 * Sell `qty` units against the market maker: consume the item, credit the local
 * currency (sell price × qty), reduce the position, nudge the price down.
 */
export function sellGood(
  store: InventoryStore,
  positions: Positions,
  marketId: string,
  itemId: string,
  qty: number,
  epochMs = Date.now(),
): TradeResult {
  const q = quoteGood(marketId, itemId, epochMs)
  if (!q) return { ok: false, reason: "unknown-good", quote: zeroQuote(marketId, itemId) }
  const n = Math.max(0, Math.floor(qty))
  if (n <= 0) return { ok: false, reason: "zero-amount", quote: q }
  if (store.qtyOf(itemId) < n) return { ok: false, reason: "insufficient-goods", quote: q }
  if (!store.consume(itemId, n)) return { ok: false, reason: "insufficient-goods", quote: q }
  store.credit(q.currencyId, q.sell * n)

  const prev = positions[itemId] ?? { itemId, qty: 0, avgCost: 0 }
  const newQty = Math.max(0, prev.qty - n)
  const pos: Position = { itemId, qty: newQty, avgCost: newQty > 0 ? prev.avgCost : 0 }
  if (newQty > 0) positions[itemId] = pos
  else delete positions[itemId]

  const market = getMarket(marketId)
  const good = market?.goods.find((g) => g.itemId === itemId)
  if (market && good) applyImpact(market, good, -n, epochMs)
  return { ok: true, quote: q, position: pos }
}

function zeroQuote(marketId: string, itemId: string): GoodQuote {
  return { itemId, marketId, currencyId: "", mid: 0, buy: 0, sell: 0, spreadBps: 0 }
}

/** Local-currency symbol for a market (for UI). */
export function marketCurrencySymbol(market: Market): string {
  return getCurrency(market.localCurrency)?.symbol ?? ""
}

/** TEST/QA: clear in-memory impact so deterministic mids reproduce. */
export function _resetImpact(): void {
  IMPACT.clear()
}
