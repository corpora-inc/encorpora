import type { CurrencyId } from "@corpan-city/contracts"
import { getCurrency } from "./currencies"
import { feedMult, tickForEpoch, type PriceEvent } from "./priceSim"
import type { InventoryStore } from "./inventory"

/**
 * exchange — currency A → currency B at a live, spread-taxed rate (the NPC
 * money-changer / "cambio" stall, ECONOMY_CURRENCY §3). Works fully offline:
 * the rate pivots through each currency's COMMON-UNIT value (`baseValue`)
 * modulated by the shared deterministic price sim, so solo play has a living,
 * reproducible rate. The spread is the always-on money sink that makes round
 * trips lossy → no infinite-money loop (§3.4, §7.2).
 *
 * The E2 server feed will SUPERSEDE the offline `feedMult` (authoritative
 * reconciliation) — that seam is `RateSource` below; offline uses `simRateSource`.
 */

/* ------------------------------------------------------------- price source */

/**
 * Where the live price multiplier for a currency comes from. Offline = the
 * shared sim (`simRateSource`); online (E2) = the server feed. Same interface
 * both sides, so swapping is a zero-call-site change (§3.3 discipline).
 */
export interface RateSource {
  /** feedMult for a currency at the given epoch (ms). ~1.0, bounded by volatility. */
  currencyMult(currencyId: string, epochMs: number): number
}

/** The offline deterministic rate source (the shared price sim). */
export function simRateSource(events: PriceEvent[] = [], seed = 0): RateSource {
  return {
    currencyMult(currencyId, epochMs) {
      const c = getCurrency(currencyId)
      if (!c) return 1
      const evs = events.filter((e) => e.target.kind === "currency" && e.target.id === currencyId)
      return feedMult(currencyId, tickForEpoch(epochMs), { volatility: c.volatility, events: evs, seed })
    },
  }
}

/* ------------------------------------------------------------------- pricing */

/** The live per-MINOR-unit Common-Unit price of a currency. */
export function price(currencyId: string, src: RateSource, epochMs: number): number {
  const c = getCurrency(currencyId)
  if (!c) return 0
  return c.baseValue * src.currencyMult(currencyId, epochMs)
}

/**
 * The MID rate from→to: how many MINOR units of `to` one MINOR unit of `from`
 * is worth, before spread. `rate = price(from) / price(to)` (§3.2).
 */
export function midRate(from: string, to: string, src: RateSource, epochMs: number): number {
  const pf = price(from, src, epochMs)
  const pt = price(to, src, epochMs)
  if (pf <= 0 || pt <= 0) return 0
  return pf / pt
}

export interface FxQuote {
  from: CurrencyId
  to: CurrencyId
  /** mid rate (minor `to` per minor `from`). */
  mid: number
  /** effective rate AFTER the changer's spread (what the player actually gets). */
  effective: number
  spreadBps: number
  /** how many minor units of `from` the player gives. */
  giveUnits: number
  /** how many minor units of `to` the player receives (floored to integer). */
  getUnits: number
  epochMs: number
}

/**
 * Quote an exchange of `giveUnits` of `from` into `to` at the changer's spread.
 * The changer "buys low": the player receives the mid amount minus the spread
 * (the house keeps `spreadBps`). Returns 0 `getUnits` if either currency is
 * unknown or the amount is non-positive.
 */
export function quote(
  from: string,
  to: string,
  giveUnits: number,
  src: RateSource,
  opts: { spreadBps?: number; epochMs?: number } = {},
): FxQuote {
  const epochMs = opts.epochMs ?? Date.now()
  const spreadBps = Math.max(0, opts.spreadBps ?? 250)
  const mid = midRate(from, to, src, epochMs)
  const effective = mid * (1 - spreadBps / 10000)
  const give = Math.max(0, Math.floor(giveUnits))
  const getUnits = Math.floor(give * effective)
  return {
    from: from as CurrencyId,
    to: to as CurrencyId,
    mid,
    effective,
    spreadBps,
    giveUnits: give,
    getUnits,
    epochMs,
  }
}

/* ------------------------------------------------------------------ applying */

export interface ExchangeResult {
  ok: boolean
  reason?: string
  quote: FxQuote
}

/**
 * Apply a money-changer exchange to the local wallet: debit `from`, credit `to`
 * at the quoted effective rate. Re-quotes at apply time so a stale UI quote
 * can't be exploited. Atomic: debits only if the credit amount is positive and
 * the balance suffices.
 */
export function applyExchange(
  store: InventoryStore,
  from: string,
  to: string,
  giveUnits: number,
  src: RateSource,
  opts: { spreadBps?: number; epochMs?: number } = {},
): ExchangeResult {
  const q = quote(from, to, giveUnits, src, opts)
  if (from === to) return { ok: false, reason: "same-currency", quote: q }
  if (!getCurrency(from) || !getCurrency(to)) return { ok: false, reason: "unknown-currency", quote: q }
  if (q.giveUnits <= 0) return { ok: false, reason: "zero-amount", quote: q }
  if (q.getUnits <= 0) return { ok: false, reason: "below-minimum", quote: q }
  if (store.balance(from) < q.giveUnits) return { ok: false, reason: "insufficient", quote: q }

  if (!store.debit(from, q.giveUnits)) return { ok: false, reason: "insufficient", quote: q }
  store.credit(to, q.getUnits)
  return { ok: true, quote: q }
}

/* ----------------------------------------------------- FX board (rate matrix) */

/** A row of the FX board: mid + effective rate between two held currencies. */
export interface FxBoardCell {
  from: CurrencyId
  to: CurrencyId
  mid: number
  effective: number
}

/**
 * Build a rate matrix between a set of currencies (e.g. the ones the player
 * holds). Diagonal omitted. For the §4.5 FX board.
 */
export function fxBoard(
  currencyIds: string[],
  src: RateSource,
  opts: { spreadBps?: number; epochMs?: number } = {},
): FxBoardCell[] {
  const epochMs = opts.epochMs ?? Date.now()
  const spreadBps = opts.spreadBps ?? 250
  const cells: FxBoardCell[] = []
  for (const from of currencyIds) {
    for (const to of currencyIds) {
      if (from === to) continue
      const mid = midRate(from, to, src, epochMs)
      cells.push({
        from: from as CurrencyId,
        to: to as CurrencyId,
        mid,
        effective: mid * (1 - spreadBps / 10000),
      })
    }
  }
  return cells
}
