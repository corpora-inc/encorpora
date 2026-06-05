import { z } from "zod"
import { CosmeticSlot, Rarity } from "@world-plaza/contracts"

/**
 * itemTypes — the first-class **Item** model for World Plaza.
 *
 * "Item" is the unit the whole economy turns on: challenges award them, NPCs
 * buy/sell/trade them, quests need them (a ferry token is precious on the
 * Guadalajara route and junk elsewhere), and players swap them through
 * AI-mediated menus. An Item is data-only + serializable so it can live in a
 * JSON catalog, cross the (future) trade wire, and render with the same
 * paper-cutout art language as everything else.
 *
 * Relationship to the contracts:
 *   - This module OWNS the Item schema (kept out of @world-plaza/contracts to
 *     avoid a collision with the parallel challenges agent). Contracts still own
 *     the avatar/cosmetic vocabulary; we REUSE `CosmeticSlot` + `Rarity` so a
 *     cosmetic Item maps cleanly onto an `AvatarLayer`/`CosmeticItem`.
 *   - A `kind: "cosmetic"` Item with a `slot` is the inventory-facing twin of a
 *     `CosmeticItem`; `cosmeticToAvatarLayer()` produces the `AvatarLayer` the
 *     character system equips.
 *
 * Validate-able: every catalog row is parsed through `Item` at load; a malformed
 * item can never reach the inventory, shop, or trade UIs.
 */

/* ----------------------------------------------------------------- kinds */

/**
 * The four kinds, each with a distinct gameplay role:
 *   - cosmetic    — wearable; maps to an avatar layer (the marquee reward).
 *   - consumable  — used up for an effect (a coffee that refills a "stamina"
 *                   meter, a map that reveals a district). One-shot.
 *   - quest       — a key/clue that satisfies a quest requirement. Often junk
 *                   outside its quest; that asymmetry is the whole spice.
 *   - trade-good  — bought low / sold high; the raw currency of commerce and
 *                   player-to-player swaps. Carries the clearest `value`.
 */
export const ItemKind = z.enum(["cosmetic", "consumable", "quest", "trade-good"])
export type ItemKind = z.infer<typeof ItemKind>

/* ----------------------------------------------------------------- schema */

export const Item = z
  .object({
    /** Stable catalog id, e.g. "ferry-token", "straw-hat". Lowercase-kebab. */
    id: z.string().min(1),
    /** Localizable display name. (i18n keys layer on later; plain text now.) */
    name: z.string().min(1),
    /**
     * Cutout art id — the `placeholder:*` tail resolved by `cutoutArt.cutoutDraw`
     * (e.g. "prop-token", "cos-hat-sun"). Decouples the item from any one atlas.
     */
    art: z.string().min(1),
    kind: ItemKind,
    /** Only meaningful for `kind: "cosmetic"`; which avatar slot it fills. */
    slot: CosmeticSlot.optional(),
    /** Reuses the contract rarity vocabulary (common|rare|epic|seasonal). */
    rarity: Rarity,
    /**
     * Base worth in coins. Shops derive buy/sell around this (see shop.ts).
     * `0` = priceless/untradeable (most pure quest keys).
     */
    value: z.number().int().nonnegative(),
    /** One-line flavour shown in the item detail card. Kid-safe, wholesome. */
    description: z.string().min(1),
    /**
     * Free-form tags for quest-relevance + shop filtering + clues, e.g.
     * ["travel","ferry","docks"]. `questItems.ts` matches on these.
     */
    tags: z.array(z.string()).default([]),
    /** Default cosmetic tint swatches the dress-up/shop can offer (cosmetics only). */
    tints: z.array(z.string()).optional(),
    /** Can this item be sold/traded? Defaults true; quest keys are often false. */
    tradable: z.boolean().default(true),
    /** Stackable trade-goods/consumables; cosmetics/quest keys are unique (false). */
    stackable: z.boolean().default(false),
  })
  .superRefine((it, ctx) => {
    if (it.kind === "cosmetic" && !it.slot) {
      ctx.addIssue({
        code: "custom",
        message: `cosmetic item "${it.id}" must declare a slot`,
        path: ["slot"],
      })
    }
  })
export type Item = z.infer<typeof Item>

export const ItemCatalog = z.object({
  _doc: z.string().optional(),
  items: z.array(Item),
})
export type ItemCatalog = z.infer<typeof ItemCatalog>

/* --------------------------------------------------------------- helpers */

/** Strict parse one item (throws on invalid). */
export const parseItem = (v: unknown): Item => Item.parse(v)

/** Parse a whole catalog file; throws with a clear path on the first bad row. */
export function parseItemCatalog(v: unknown): Item[] {
  return ItemCatalog.parse(v).items
}

/**
 * Index a catalog by id for O(1) lookup. Dedupes (last wins) and warns loudly on
 * a collision — project rule: noisy, not silent.
 */
export function indexItems(items: Item[]): Map<string, Item> {
  const map = new Map<string, Item>()
  for (const it of items) {
    if (map.has(it.id)) {
      console.warn(`[wp/items] duplicate item id "${it.id}" — last definition wins`)
    }
    map.set(it.id, it)
  }
  return map
}

/** Type guard: is this a wearable cosmetic Item? */
export function isCosmetic(it: Item): it is Item & { slot: NonNullable<Item["slot"]> } {
  return it.kind === "cosmetic" && it.slot != null
}

/**
 * Project a cosmetic Item onto the contract `AvatarLayer` shape the character
 * system equips. Returns null for non-cosmetics. (Kept structural — we import
 * the type-only shape to avoid a runtime contracts dependency here.)
 */
export function cosmeticToAvatarLayer(
  it: Item,
  tint?: string,
): { slot: NonNullable<Item["slot"]>; itemId: string; tint?: string } | null {
  if (!isCosmetic(it)) return null
  return { slot: it.slot, itemId: it.id, tint: tint ?? it.tints?.[0] }
}

/* ------------------------------------------------------------ value curve */

/**
 * The rarity → value band (coins). Catalog authors pick a concrete `value`
 * inside its band; the band documents intent and powers a dev lint
 * (`assertValueInBand`). Curve is deliberately gentle: a kid earning ~10 coins a
 * challenge can afford a common hat in a couple of plays, an epic in a week.
 */
export const RARITY_VALUE_BAND: Record<z.infer<typeof Rarity>, [number, number]> = {
  common: [1, 30],
  rare: [25, 120],
  epic: [100, 400],
  seasonal: [150, 600],
}

/** Dev lint: is the value inside its rarity band? (Quest keys with value 0 are exempt.) */
export function isValueInBand(it: Item): boolean {
  if (it.value === 0) return true
  const [lo, hi] = RARITY_VALUE_BAND[it.rarity]
  return it.value >= lo && it.value <= hi
}
