import { z } from "zod"
import { PlayerId, QuestId } from "./ids"
import { ChallengeToolId } from "./challengeTool"
import { AvatarSpec } from "./identity"

/**
 * XP is earned from language actions. Discriminated on `kind`. Offline events
 * are signed and reconciled server-side (anti-cheat); abusive/rejected
 * interactions earn nothing.
 */
export const XpEvent = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("challenge"), toolId: ChallengeToolId, amount: z.number() }),
  z.object({ kind: z.literal("pronunciation"), amount: z.number() }),
  z.object({ kind: z.literal("coop"), amount: z.number() }),
  z.object({ kind: z.literal("questStep"), questId: QuestId, amount: z.number() }),
  z.object({ kind: z.literal("daily"), amount: z.number() }),
])
export type XpEvent = z.infer<typeof XpEvent>

export const InventoryState = z.object({
  coins: z.number().int().nonnegative(),
  owned: z.array(z.string()),
  equipped: AvatarSpec,
})
export type InventoryState = z.infer<typeof InventoryState>

export const EconomyTransaction = z.object({
  id: z.string().min(1),
  playerId: PlayerId,
  t: z.number(),
  delta: z.object({
    xp: z.number().optional(),
    coins: z.number().optional(),
    /** Multi-currency delta (minor units). Additive; coexists with legacy `coins`. */
    currency: z.record(z.string(), z.number().int()).optional(),
  }),
  grant: z.array(z.string()).optional(),
  reason: z.string(),
  /** HMAC over the canonical payload for offline reconciliation. */
  sig: z.string().optional(),
})
export type EconomyTransaction = z.infer<typeof EconomyTransaction>

/* ================================================================== *
 * Multi-currency economy (ECONOMY_CURRENCY.md). ADDITIVE: the legacy
 * scalar `coins` above stays valid; the new runtime reads `Wallet`.
 * Currency DEFINITIONS, goods, markets, reward tables are GLOBAL
 * catalog data (CDN-driven, one library shared by all Tracks). Only
 * BALANCES/positions/offers/history are per-Track (namespaced by
 * `trackNamespace(id)`). The "moon coin" dies — `coin-base` exists only
 * for migration and is never rendered with the moon glyph again.
 * ================================================================== */

/** Stable kebab currency id, e.g. "gold-real", "mxn-peso", "jpy-yen". */
export const CurrencyId = z.string().min(1).brand("CurrencyId")
export type CurrencyId = z.infer<typeof CurrencyId>

/**
 * A wallet: currencyId → integer count of that currency's SMALLEST
 * denomination (its "minor unit", like cents). Integers ONLY — no floats in
 * balances ever (avoids drift, makes anti-cheat hashing exact). Nonnegative.
 *
 *   { "gold-real": 1840, "mxn-peso": 5000, "jpy-yen": 220 }
 *
 * Note: keyed by raw string because Zod records can't key by a branded string;
 * treat the keys AS `CurrencyId` at the type boundary (`as CurrencyId`).
 */
export const Wallet = z.record(z.string(), z.number().int().nonnegative())
export type Wallet = z.infer<typeof Wallet>

/**
 * Procedural icon spec for a currency or denomination (kill the moon). NOT a
 * static PNG — ships ~12+ distinct currency icons with zero binary assets, and
 * re-tints per denomination. Drawn by the shared `IconRenderer`
 * (`src/contracts/runtime.ts`) so currencies, badges, and items look consistent.
 */
export const CurrencyArt = z.object({
  shape: z.enum([
    "coin-round",
    "coin-square-hole",
    "bill-rect",
    "ingot-bar",
    "note-stack",
    "shell",
    "gem-faceted",
    "pouch",
  ]),
  /** small emblem id drawn on the face: "castle","quetzal","eagle","chrysanthemum",… */
  motif: z.string(),
  metal: z.enum(["gold", "silver", "copper", "bronze", "patina"]).optional(),
  /** for bills: engraved guilloche line motif + base hue. */
  paper: z.object({ hue: z.string(), guilloche: z.boolean() }).optional(),
  /** the paper band on a note-stack. */
  bandColor: z.string().optional(),
})
export type CurrencyArt = z.infer<typeof CurrencyArt>

/** One physical denomination of a currency (drives "make change" + art). */
export const Denomination = z.object({
  id: z.string().min(1), // "real-1", "real-8" (a "piece of eight"), "bill-100"
  label: z.string(), // "1 real", "8 reales", "100 mark" (localizable, i18n key)
  units: z.number().int().positive(), // value in MINOR units (e.g. 800 for 8 reales)
  form: z.enum(["coin", "bill", "ingot", "note-stack", "pouch", "gem"]),
  art: CurrencyArt,
})
export type Denomination = z.infer<typeof Denomination>

/** A currency definition (catalog data — the heart of "data-driven"). */
export const Currency = z.object({
  id: CurrencyId, // "gold-real"
  name: z.string(), // "Spanish Real" (localizable — i18n key with EN default)
  symbol: z.string(), // "₧","¥","₩","€" — short ticker glyph (Unicode, locale-neutral)
  minorPerMajor: z.number().int().positive(), // 100 (100 cents = 1 real); 1 = indivisible
  denominations: z.array(Denomination), // ordered small→large
  era: z.string().optional(), // "colonial-1770"
  place: z.string().optional(), // "antigua-guatemala"
  sceneTags: z.array(z.string()).optional(), // which Scenes mint it natively
  family: z.enum(["metal", "coin", "note", "ingot", "token", "shell", "gem"]),
  baseValue: z.number(), // reference value in the COMMON UNIT (hidden numéraire)
  volatility: z.number().min(0).max(1), // 0..1 — how much its rate drifts
  rarity: z.enum(["common", "rare", "epic", "seasonal"]),
  art: CurrencyArt, // premium icon (NOT a moon)
  paletteHint: z.string().optional(), // base hue for the auto-generated icon
})
export type Currency = z.infer<typeof Currency>

/**
 * A reward grant: the smorgasbord that replaces the single `coins` scalar. A
 * single challenge can grant SEVERAL currencies at once (+ xp + item ids). The
 * legacy scalar `coins` stays readable for one version (mapped on read to the
 * Track's default currency). `applyReward` ingests this.
 */
export const RewardGrant = z.object({
  xp: z.number().nonnegative().optional(),
  currency: Wallet.optional(), // { "gold-real": 240, "jpy-yen": 30 } — replaces coins
  items: z.array(z.string()).optional(), // opaque Item ids (granted by id)
  /** legacy: a scalar coin grant, mapped to the default currency on read. */
  coins: z.number().int().nonnegative().optional(),
})
export type RewardGrant = z.infer<typeof RewardGrant>

/**
 * A reward TABLE (catalog data, per Scene/quest/challenge-tier): describes what
 * KINDS of money a win pays. The runtime rolls a concrete `Wallet` from it
 * deterministically-seeded (reproducible for anti-cheat). The default Track
 * currency always gets the largest share so progression feels grounded; the
 * spread is what makes a reward a smorgasbord (not "+50 coins").
 */
export const RewardTable = z.object({
  id: z.string().min(1), // "antigua-market-tier1"
  base: z.number().positive(), // baseline payout in COMMON UNITS
  /** weighted mix of currencies this context pays; weights sum-normalized. */
  mix: z.array(
    z.object({
      currency: CurrencyId,
      weight: z.number().nonnegative(),
      minShare: z.number().min(0).max(1).optional(),
      maxShare: z.number().min(0).max(1).optional(),
    }),
  ),
  /** multiplier by challenge difficulty/score band, e.g. 0.5 floor → 1.5 perfect. */
  scoreCurve: z.object({ floor: z.number(), perfect: z.number() }),
  /** chance to also drop a bonus currency (the "ooh, a piece of eight!" moment). */
  bonus: z
    .array(z.object({ currency: CurrencyId, chance: z.number().min(0).max(1), units: z.number().int().positive() }))
    .optional(),
  /** optional item drops piggyback the existing items[] reward path. */
  itemDrops: z.array(z.object({ itemId: z.string().min(1), chance: z.number().min(0).max(1) })).optional(),
})
export type RewardTable = z.infer<typeof RewardTable>
