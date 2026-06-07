import { z } from "zod"
import type { PriceEvent } from "../priceSim"
import marketsJson from "../../../content/economy/markets.json"
import eventsJson from "../../../content/economy/events.json"

/**
 * marketData — load + validate the market / goods / events catalog
 * (ECONOMY_CURRENCY §4). GLOBAL CDN-driven data; only the player's positions
 * are per-Track. Unknown rows drop with a warn (forward-compat).
 */

/* --------------------------------------------------------------- schemas */

const MarketGood = z.object({
  itemId: z.string().min(1),
  /** mid price in the market's local-currency MINOR units. */
  mid: z.number().positive(),
  volatility: z.number().min(0).max(1),
  /** liquidity depth — bigger = less price impact per order. */
  depth: z.number().positive().default(20),
})
export type MarketGood = z.infer<typeof MarketGood>

const Market = z.object({
  id: z.string().min(1),
  name: z.string(),
  localCurrency: z.string().min(1),
  spreadBps: z.number().nonnegative().default(200),
  sceneTags: z.array(z.string()).optional(),
  goods: z.array(MarketGood),
})
export type Market = z.infer<typeof Market>

const MarketsShape = z.object({
  version: z.number().optional(),
  exchange: z
    .object({
      defaultSpreadBps: z.number().nonnegative().optional(),
      minSpreadBps: z.number().nonnegative().optional(),
      maxSpreadBps: z.number().nonnegative().optional(),
    })
    .optional(),
  markets: z.array(z.unknown()),
})

const EventRow = z.object({
  id: z.string().min(1),
  target: z.object({ kind: z.enum(["good", "currency"]), id: z.string().min(1) }),
  every: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  magnitude: z.number(),
  decayTicks: z.number().int().positive(),
  headlineKey: z.string().optional(),
  headline: z.string().optional(),
})
export type MarketEvent = z.infer<typeof EventRow>

const EventsShape = z.object({ version: z.number().optional(), events: z.array(z.unknown()) })

/* --------------------------------------------------------------- loaders */

function loadMarkets(raw: unknown): { markets: Market[]; defaultSpreadBps: number } {
  const markets: Market[] = []
  const parsed = MarketsShape.safeParse(raw)
  if (!parsed.success) {
    console.error("[wp/economy/market] markets.json malformed", parsed.error)
    return { markets, defaultSpreadBps: 250 }
  }
  for (const row of parsed.data.markets) {
    const r = Market.safeParse(row)
    if (r.success) markets.push(r.data)
    else console.warn("[wp/economy/market] dropping invalid market:", (row as { id?: string })?.id, r.error.issues[0]?.message)
  }
  return { markets, defaultSpreadBps: parsed.data.exchange?.defaultSpreadBps ?? 250 }
}

function loadEvents(raw: unknown): MarketEvent[] {
  const out: MarketEvent[] = []
  const parsed = EventsShape.safeParse(raw)
  if (!parsed.success) {
    console.error("[wp/economy/market] events.json malformed", parsed.error)
    return out
  }
  for (const row of parsed.data.events) {
    const r = EventRow.safeParse(row)
    if (r.success) out.push(r.data)
    else console.warn("[wp/economy/market] dropping invalid event:", (row as { id?: string })?.id, r.error.issues[0]?.message)
  }
  return out
}

const { markets: MARKETS, defaultSpreadBps: DEFAULT_SPREAD_BPS } = loadMarkets(marketsJson)
const MARKETS_BY_ID = new Map(MARKETS.map((m) => [m.id, m]))
const EVENTS = loadEvents(eventsJson)

export const EXCHANGE_DEFAULT_SPREAD_BPS = DEFAULT_SPREAD_BPS

export function getMarket(id: string): Market | undefined {
  return MARKETS_BY_ID.get(id)
}
export function allMarkets(): Market[] {
  return MARKETS.slice()
}
/** The market a scene/place should open by default (first tag match). */
export function marketForScene(keys: Array<string | undefined>): Market | undefined {
  const hay = new Set(keys.filter(Boolean).map((s) => String(s).toLowerCase()))
  for (const m of MARKETS) {
    if ((m.sceneTags ?? []).some((t) => hay.has(t.toLowerCase()))) return m
  }
  return MARKETS[0]
}

/** All market events (for the sim + the ticker headlines). */
export function allEvents(): MarketEvent[] {
  return EVENTS.slice()
}
/** Events targeting a specific series id, as priceSim `PriceEvent`s. */
export function eventsFor(kind: "good" | "currency", id: string): PriceEvent[] {
  return EVENTS.filter((e) => e.target.kind === kind && e.target.id === id)
}
