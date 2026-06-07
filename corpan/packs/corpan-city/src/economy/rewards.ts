import { z } from "zod"
import { RewardTable, type Wallet, type CurrencyId } from "@corpan-city/contracts"
import { getCurrency, isLiveCurrency, DEFAULT_CURRENCY_ID } from "./currencies"
import type { Reward } from "./inventory"
import rewardTablesJson from "../../content/economy/rewardTables.json"

/**
 * rewards — roll a concrete multi-currency `Reward` (the smorgasbord) from a
 * data-driven `RewardTable` (ECONOMY_CURRENCY §2.2), deterministically seeded so
 * it's reproducible for anti-cheat. The default Track currency always gets the
 * largest share so progression feels grounded; the spread is what turns "+50
 * coins" into a fistful of yen AND a real or two.
 *
 * Rolling, per §2.2:
 *   1. budget = base × scoreCurve(score)   (in COMMON UNITS)
 *   2. split budget across `mix` by normalized weight (honoring min/maxShare)
 *   3. convert each currency's CU share → minor units via its baseValue
 *   4. roll `bonus` (chance-gated flat drops) and `itemDrops`
 *
 * Pure functions + a catalog loader. No DOM, no storage.
 */

/* --------------------------------------------------------------- load tables */

const TablesShape = z.object({
  version: z.number().optional(),
  sceneDefaults: z.record(z.string(), z.string()).optional(),
  tables: z.array(z.unknown()),
})

function loadTables(raw: unknown): { tables: Map<string, RewardTable>; sceneDefaults: Record<string, string> } {
  const tables = new Map<string, RewardTable>()
  const parsed = TablesShape.safeParse(raw)
  if (!parsed.success) {
    console.error("[wp/economy/rewards] rewardTables.json malformed — no tables", parsed.error)
    return { tables, sceneDefaults: {} }
  }
  for (const row of parsed.data.tables) {
    const r = RewardTable.safeParse(row)
    if (r.success) tables.set(r.data.id, r.data)
    else
      console.warn(
        "[wp/economy/rewards] dropping invalid reward table:",
        (row as { id?: string })?.id ?? "<no id>",
        r.error.issues[0]?.message,
      )
  }
  return { tables, sceneDefaults: parsed.data.sceneDefaults ?? {} }
}

const { tables: TABLES, sceneDefaults: SCENE_DEFAULTS } = loadTables(rewardTablesJson)

/** Look up a reward table by id. */
export function getRewardTable(id: string): RewardTable | undefined {
  return TABLES.get(id)
}

/** The reward-table id a scene/place should use by default (or undefined). */
export function rewardTableForScene(keys: Array<string | undefined>): string | undefined {
  for (const k of keys) {
    if (k && SCENE_DEFAULTS[k]) return SCENE_DEFAULTS[k]
  }
  return undefined
}

/* ------------------------------------------------------------------ seeding */

/** A tiny deterministic PRNG (mulberry32) from a string seed. */
export function seededRng(seed: string): () => number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193) >>> 0
  let a = h >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ------------------------------------------------------------------ rolling */

export interface RollOptions {
  /** 0..1 challenge score → score-curve multiplier. Default 1 (perfect). */
  score?: number
  /** the Track's default currency (gets the largest share). */
  defaultCurrency?: CurrencyId
  /** a deterministic seed string (e.g. `${questId}:${stepId}:${nonce}`). */
  seed?: string
}

/** Evaluate the score curve: linear floor→perfect over score∈[0,1]. */
function scoreMult(curve: { floor: number; perfect: number }, score: number): number {
  const s = Math.min(1, Math.max(0, score))
  return curve.floor + (curve.perfect - curve.floor) * s
}

/** CU budget → minor units of a currency (round to integer). */
function cuToMinor(cu: number, currencyId: string): number {
  const c = getCurrency(currencyId)
  if (!c || c.baseValue <= 0) return 0
  return Math.max(0, Math.round(cu / c.baseValue))
}

/**
 * Roll a concrete multi-currency `Reward` from a table. Deterministic for a
 * given (table, options) — the same seed always produces the same purse.
 */
export function rollReward(table: RewardTable, opts: RollOptions = {}): Reward {
  const score = opts.score ?? 1
  const defaultCurrency = opts.defaultCurrency ?? DEFAULT_CURRENCY_ID
  const rng = seededRng(opts.seed ?? `${table.id}:${score}`)

  const budget = table.base * scoreMult(table.scoreCurve, score)
  const currency: Wallet = {}

  // Filter to live, known currencies; sum weights (default currency wins ties).
  const mix = table.mix.filter((m) => isLiveCurrency(m.currency))
  const totalWeight = mix.reduce((s, m) => s + m.weight, 0)
  if (totalWeight > 0) {
    for (const m of mix) {
      let share = m.weight / totalWeight
      if (m.minShare != null) share = Math.max(share, m.minShare)
      if (m.maxShare != null) share = Math.min(share, m.maxShare)
      const minor = cuToMinor(budget * share, m.currency)
      if (minor > 0) currency[m.currency] = (currency[m.currency] ?? 0) + minor
    }
  }

  // Guarantee SOMETHING in the default currency so progression always lands.
  if (!currency[defaultCurrency]) {
    const minor = cuToMinor(budget * 0.5, defaultCurrency)
    if (minor > 0) currency[defaultCurrency] = minor
  }

  // Bonus drops (the "ooh, a piece of eight!" moment).
  for (const b of table.bonus ?? []) {
    if (!isLiveCurrency(b.currency)) continue
    if (rng() < b.chance) currency[b.currency] = (currency[b.currency] ?? 0) + b.units
  }

  // Item drops piggyback the items[] path.
  const items: string[] = []
  for (const d of table.itemDrops ?? []) {
    if (rng() < d.chance) items.push(d.itemId)
  }

  const reward: Reward = { currency }
  if (items.length) reward.items = items
  return reward
}

/**
 * Convenience: roll the table that fits a scene (by place/era/tags), falling
 * back to a synthesized default-currency-only table so a reward always lands
 * even with no authored table for the scene.
 */
export function rollForScene(
  opts: RollOptions & { sceneKeys?: Array<string | undefined>; xp?: number },
): Reward {
  const tableId = rewardTableForScene(opts.sceneKeys ?? [])
  const table = (tableId && getRewardTable(tableId)) || synthDefaultTable(opts.defaultCurrency)
  const reward = rollReward(table, opts)
  if (opts.xp) reward.xp = opts.xp
  return reward
}

/** A minimal table that pays only the default currency (last-resort fallback). */
function synthDefaultTable(defaultCurrency?: CurrencyId): RewardTable {
  const dc = (defaultCurrency ?? DEFAULT_CURRENCY_ID) as CurrencyId
  return {
    id: `synth:${dc}`,
    base: 10,
    mix: [{ currency: dc, weight: 1, minShare: 1 }],
    scoreCurve: { floor: 0.5, perfect: 1.5 },
  }
}
