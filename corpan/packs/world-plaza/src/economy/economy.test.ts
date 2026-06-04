import { describe, it, expect, beforeEach } from "vitest"
import type { CurrencyId } from "@world-plaza/contracts"
import {
  getCurrency,
  decompose,
  format,
  defaultCurrencyForScene,
  allCurrencies,
  DEFAULT_CURRENCY_ID,
} from "./currencies"
import { feedMult, maxDev, TICKS_PER_DAY, priceHistory } from "./priceSim"
import { midRate, quote, applyExchange, simRateSource } from "./exchange"
import { rollReward, getRewardTable, seededRng } from "./rewards"
import { createInventory } from "./inventory"
import { quoteGood, buyGood, sellGood, goodMid, _resetImpact } from "./market/marketSim"
import { getMarket, eventsFor } from "./market/marketData"

/* ---- a synchronous in-memory localStorage shim for the node test env ---- */
class MemStorage {
  private m = new Map<string, string>()
  getItem(k: string) {
    return this.m.has(k) ? (this.m.get(k) as string) : null
  }
  setItem(k: string, v: string) {
    this.m.set(k, v)
  }
  removeItem(k: string) {
    this.m.delete(k)
  }
  clear() {
    this.m.clear()
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null
  }
  get length() {
    return this.m.size
  }
}
beforeEach(() => {
  ;(globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage()
  ;(globalThis as unknown as { DOMException: typeof Error }).DOMException ??= Error as never
  _resetImpact()
})

/* ============================================================ catalog */

describe("currency catalog", () => {
  it("loads ~12 currencies plus the legacy coin-base", () => {
    expect(allCurrencies().length).toBeGreaterThanOrEqual(12)
    expect(getCurrency("coin-base")).toBeDefined()
    // coin-base is excluded from the live (rewardable) set
    expect(allCurrencies().some((c) => c.id === "coin-base")).toBe(false)
  })
  it("the default currency is gold-real with a 1:1 legacy value", () => {
    expect(DEFAULT_CURRENCY_ID).toBe("gold-real")
    expect(getCurrency("coin-base")!.baseValue).toBeCloseTo(getCurrency("gold-real")!.baseValue, 10)
  })
})

/* ====================================================== make-change */

describe("decompose (make-change)", () => {
  it("greedy-decomposes weimar marks into the right notes", () => {
    const c = getCurrency("weimar-mark")!
    const { stacks, remainder } = decompose(c, 1_012_345)
    // 1×1,000,000 + 1×10,000 + 23×100 = 1,012,300 leaving 45 remainder
    const byId = Object.fromEntries(stacks.map((s) => [s.denom.id, s.count]))
    expect(byId["mark-1000000"]).toBe(1)
    expect(byId["mark-10000"]).toBe(1)
    expect(byId["mark-100"]).toBe(23)
    expect(remainder).toBe(45)
  })
  it("decomposes reales into pieces of eight + small coins (no value lost)", () => {
    const c = getCurrency("gold-real")!
    const units = 3200 + 800 + 200 + 100 // escudo + 8real + 2real + 1real
    const { stacks, remainder } = decompose(c, units)
    const total = stacks.reduce((s, st) => s + st.denom.units * st.count, 0) + remainder
    expect(total).toBe(units)
    expect(remainder).toBe(0)
  })
  it("never produces a negative remainder and conserves units exactly", () => {
    const c = getCurrency("jpy-yen")!
    for (const u of [0, 1, 7, 12345, 99999]) {
      const { stacks, remainder } = decompose(c, u)
      const total = stacks.reduce((s, st) => s + st.denom.units * st.count, 0) + remainder
      expect(total).toBe(u)
      expect(remainder).toBeGreaterThanOrEqual(0)
    }
  })
})

/* ====================================================== formatting */

describe("format (grouped major units, no float drift)", () => {
  it("formats reales with two fraction digits", () => {
    const c = getCurrency("gold-real")!
    expect(format(c, 1840, "en-US")).toBe("R 18.40")
  })
  it("formats yen as a grouped indivisible integer", () => {
    const c = getCurrency("jpy-yen")!
    expect(format(c, 50000, "en-US")).toBe("¥ 50,000")
  })
})

/* ================================================ scene default currency */

describe("defaultCurrencyForScene", () => {
  it("picks the colonial real for Antigua", () => {
    expect(defaultCurrencyForScene({ place: "antigua-guatemala", era: "colonial-1770" })).toBe("gold-real")
  })
  it("picks yen for Tokyo", () => {
    expect(defaultCurrencyForScene({ place: "tokyo", tags: ["modern"] })).toBe("jpy-yen")
  })
  it("falls back to the catalog default when nothing matches", () => {
    expect(defaultCurrencyForScene({ place: "atlantis" })).toBe(DEFAULT_CURRENCY_ID)
  })
})

/* ===================================================== wallet math */

describe("wallet (integer-only, no drift)", () => {
  it("credits/debits exactly and refuses overdraw", () => {
    const inv = createInventory()
    inv.credit("gold-real", 1000)
    inv.credit("jpy-yen", 250)
    expect(inv.balance("gold-real")).toBe(1000)
    expect(inv.debit("gold-real", 400)).toBe(true)
    expect(inv.balance("gold-real")).toBe(600)
    expect(inv.debit("gold-real", 10000)).toBe(false) // insufficient → no-op
    expect(inv.balance("gold-real")).toBe(600)
    expect(inv.walletEntries().map((e) => e.currencyId)).toEqual(["gold-real", "jpy-yen"])
  })
  it("coins()/addCoins/spendCoins map to the default currency (back-compat)", () => {
    const inv = createInventory()
    inv.addCoins(500)
    expect(inv.coins()).toBe(500)
    expect(inv.balance("gold-real")).toBe(500)
    expect(inv.spendCoins(200)).toBe(true)
    expect(inv.coins()).toBe(300)
    expect(inv.spendCoins(9999)).toBe(false)
  })
  it("applyReward ingests a multi-currency smorgasbord + legacy coins", () => {
    const inv = createInventory()
    inv.applyReward({ xp: 10, currency: { "gold-real": 240, "jpy-yen": 30 }, coins: 60 })
    expect(inv.balance("gold-real")).toBe(300) // 240 + 60 legacy → default
    expect(inv.balance("jpy-yen")).toBe(30)
    expect(inv.xp()).toBe(10)
  })
  it("drops unknown currencies from a reward with a warn (no crash)", () => {
    const inv = createInventory()
    inv.applyReward({ currency: { "not-a-currency": 100, "gold-real": 5 } })
    expect(inv.balance("not-a-currency")).toBe(0)
    expect(inv.balance("gold-real")).toBe(5)
  })
})

/* =============================================== legacy migration */

describe("legacy wp:economy:v1 migration", () => {
  it("migrates a scalar coins save 1:1 into the default currency", () => {
    localStorage.setItem(
      "wp:economy:v1",
      JSON.stringify({ v: 1, c: 1234, x: 7, b: [], e: {} }),
    )
    const inv = createInventory()
    expect(inv.balance("gold-real")).toBe(1234)
    expect(inv.coins()).toBe(1234)
    expect(inv.xp()).toBe(7)
  })
  it("round-trips a v2 wallet save without loss", () => {
    const a = createInventory()
    a.credit("gold-real", 888)
    a.credit("mxn-peso", 5000)
    const b = createInventory()
    expect(b.balance("gold-real")).toBe(888)
    expect(b.balance("mxn-peso")).toBe(5000)
  })
})

/* ===================================================== reward roll */

describe("rollReward (deterministic smorgasbord)", () => {
  it("rolls a reproducible multi-currency purse from a table", () => {
    const table = getRewardTable("antigua-market-tier1")!
    const a = rollReward(table, { score: 1, seed: "fixed", defaultCurrency: "gold-real" as CurrencyId })
    const b = rollReward(table, { score: 1, seed: "fixed", defaultCurrency: "gold-real" as CurrencyId })
    expect(a).toEqual(b) // deterministic for a fixed seed
    expect(a.currency!["gold-real"]).toBeGreaterThan(0) // default always lands
    // default currency gets the largest share
    const top = Object.entries(a.currency!).sort((x, y) => y[1] - x[1])[0][0]
    expect(["gold-real"]).toContain(top)
  })
  it("score curve scales the payout (floor < perfect)", () => {
    const table = getRewardTable("antigua-market-tier1")!
    const low = rollReward(table, { score: 0, seed: "s", defaultCurrency: "gold-real" as CurrencyId })
    const high = rollReward(table, { score: 1, seed: "s", defaultCurrency: "gold-real" as CurrencyId })
    const sum = (r: typeof low) => Object.values(r.currency!).reduce((a, b) => a + b, 0)
    expect(sum(high)).toBeGreaterThan(sum(low))
  })
  it("seededRng is deterministic + bounded [0,1)", () => {
    const r = seededRng("abc")
    const vals = Array.from({ length: 5 }, () => r())
    const r2 = seededRng("abc")
    expect(Array.from({ length: 5 }, () => r2())).toEqual(vals)
    for (const v of vals) expect(v).toBeGreaterThanOrEqual(0), expect(v).toBeLessThan(1)
  })
})

/* ================================================ price sim bounds */

describe("priceSim", () => {
  it("is deterministic for a given (id, tick)", () => {
    const p = { volatility: 0.5 }
    expect(feedMult("gold-real", 1000, p)).toBe(feedMult("gold-real", 1000, p))
  })
  it("never exceeds the volatility-scaled clamp band (no runaway)", () => {
    for (const vol of [0.1, 0.5, 0.95]) {
      const dev = maxDev(vol)
      for (let t = 0; t < 5000; t += 37) {
        const m = feedMult("weimar-mark", t, { volatility: vol })
        expect(m).toBeGreaterThanOrEqual(1 - dev - 1e-9)
        expect(m).toBeLessThanOrEqual(1 + dev + 1e-9)
      }
    }
  })
  it("mean-reverts: long-run average stays near 1.0", () => {
    let sum = 0
    const n = 2000
    for (let i = 0; i < n; i++) sum += feedMult("jpy-yen", i * 17, { volatility: 0.3 })
    const mean = sum / n
    expect(Math.abs(mean - 1)).toBeLessThan(0.12)
  })
  it("zero volatility → flat 1.0", () => {
    expect(feedMult("coin-base", 99999, { volatility: 0 })).toBe(1)
  })
  it("event shocks decay back to baseline", () => {
    const ev = { id: "e", target: { kind: "currency" as const, id: "gold-real" }, every: 1, offset: 0, magnitude: 0.5, decayTicks: 100 }
    const atFire = feedMult("gold-real", 0, { volatility: 0.2, events: [ev] })
    const afterDecay = feedMult("gold-real", TICKS_PER_DAY - 1, { volatility: 0.2, events: [ev] })
    // shock present near a fire day's start, gone by end of day
    expect(atFire).toBeGreaterThan(afterDecay - 0.001)
  })
  it("priceHistory returns the requested length", () => {
    expect(priceHistory("gold-real", 5000, 16, { volatility: 0.3 })).toHaveLength(16)
  })
})

/* ===================================================== exchange */

describe("exchange (common-unit pivot + spread)", () => {
  const src = simRateSource([], 0)
  const T = 1_700_000_000_000 // fixed epoch for determinism

  it("rate(A→B) pivots through baseValue (rate(A→B) = 1/rate(B→A))", () => {
    const ab = midRate("gold-real", "jpy-yen", src, T)
    const ba = midRate("jpy-yen", "gold-real", src, T)
    expect(ab * ba).toBeCloseTo(1, 6)
  })
  it("a real buys many yen (value scale is interesting)", () => {
    const r = midRate("gold-real", "jpy-yen", src, T)
    expect(r).toBeGreaterThan(1) // 1 minor real >> 1 yen
  })
  it("round-trip A→B→A is LOSSY (spread sink, no money printer)", () => {
    const inv = createInventory()
    inv.credit("gold-real", 100000)
    const start = inv.balance("gold-real")
    const e1 = applyExchange(inv, "gold-real", "jpy-yen", 100000, src, { spreadBps: 250, epochMs: T })
    expect(e1.ok).toBe(true)
    const got = inv.balance("jpy-yen")
    const e2 = applyExchange(inv, "jpy-yen", "gold-real", got, src, { spreadBps: 250, epochMs: T })
    expect(e2.ok).toBe(true)
    expect(inv.balance("gold-real")).toBeLessThan(start) // always returns less
  })
  it("quote getUnits is floored to an integer", () => {
    const q = quote("gold-real", "jpy-yen", 137, src, { spreadBps: 250, epochMs: T })
    expect(Number.isInteger(q.getUnits)).toBe(true)
  })
  it("refuses an exchange the wallet can't fund", () => {
    const inv = createInventory()
    inv.credit("gold-real", 10)
    const r = applyExchange(inv, "gold-real", "jpy-yen", 1000, src, { epochMs: T })
    expect(r.ok).toBe(false)
    expect(r.reason).toBe("insufficient")
  })
})

/* ===================================================== market sim */

describe("market sim (AMM mid ± spread, bounded)", () => {
  const T = 1_700_000_000_000

  it("buy price > mid > sell price (the spread)", () => {
    const m = getMarket("antigua-market")!
    const q = quoteGood(m.id, "spices-cinnamon", T)!
    expect(q.buy).toBeGreaterThan(q.mid)
    expect(q.sell).toBeLessThan(q.mid)
  })
  it("a market round-trip (buy then sell) is lossy", () => {
    _resetImpact()
    const inv = createInventory()
    inv.credit("gold-real", 1_000_000)
    const positions = {}
    const start = inv.balance("gold-real")
    expect(buyGood(inv, positions, "antigua-market", "spices-cinnamon", 1, T).ok).toBe(true)
    expect(sellGood(inv, positions, "antigua-market", "spices-cinnamon", 1, T).ok).toBe(true)
    expect(inv.balance("gold-real")).toBeLessThan(start)
  })
  it("buying nudges the price up (bounded impact)", () => {
    _resetImpact()
    const inv = createInventory()
    inv.credit("gold-real", 10_000_000)
    const before = goodMid(getMarket("antigua-market")!, getMarket("antigua-market")!.goods[0], T)
    buyGood(inv, {}, "antigua-market", getMarket("antigua-market")!.goods[0].itemId, 20, T)
    const after = goodMid(getMarket("antigua-market")!, getMarket("antigua-market")!.goods[0], T)
    expect(after).toBeGreaterThanOrEqual(before)
  })
  it("tracks position avg cost + sells from the bag only", () => {
    _resetImpact()
    const inv = createInventory()
    inv.credit("gold-real", 1_000_000)
    const positions = {}
    buyGood(inv, positions, "antigua-market", "spices-cinnamon", 3, T)
    expect(inv.qtyOf("spices-cinnamon")).toBe(3)
    // can't sell more than held
    expect(sellGood(inv, positions, "antigua-market", "spices-cinnamon", 5, T).ok).toBe(false)
    expect(sellGood(inv, positions, "antigua-market", "spices-cinnamon", 3, T).ok).toBe(true)
    expect(inv.qtyOf("spices-cinnamon")).toBe(0)
  })
  it("good mid stays bounded by its volatility band over time", () => {
    const m = getMarket("antigua-market")!
    const g = m.goods.find((x) => x.itemId === "spices-cacao")!
    const evs = eventsFor("good", g.itemId)
    void evs
    let min = Infinity
    let max = -Infinity
    for (let t = 0; t < 4000; t += 29) {
      const mid = goodMid(m, g, t * 10000)
      min = Math.min(min, mid)
      max = Math.max(max, mid)
    }
    // never collapses to 0 or explodes
    expect(min).toBeGreaterThan(0)
    expect(max / Math.max(1, min)).toBeLessThan(20)
  })
})
