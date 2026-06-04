import {
  Item,
  parseItemCatalog,
  indexItems,
  isCosmetic,
  cosmeticToAvatarLayer,
} from "../items/itemTypes"
import type { Wallet, CurrencyId } from "@world-plaza/contracts"
import type { TrackStore, TrackStoreBinding } from "../contracts/runtime"
import { DEFAULT_CURRENCY_ID, getCurrency } from "./currencies"
import catalogJson from "../../content/items/catalog.json"

/**
 * inventory — the player's WALLET + item bag + equipped cosmetics, with a
 * compact, quota-safe persistence layer and a tiny event bus.
 *
 * THE MOON IS DEAD (ECONOMY_CURRENCY §1.1): the scalar `coins` is gone; the
 * player holds a multi-currency `Wallet = Record<CurrencyId, minorUnits>` of
 * integers. The default-currency total is still surfaced as `coins()` /
 * `addCoins` / `spendCoins` so game.ts's current HUD + challenge rewards + the
 * shop + trade keep working UNCHANGED until the HUD slice retires the readout.
 *
 * PER-TRACK (IMPLEMENTATION_CONTRACTS Seam 1): the store is parameterized by a
 * `{ namespace, store }` binding — it keys its record `${namespace}:economy` in
 * the injected `TrackStore` (IndexedDB, quota-safe). With no binding it falls
 * back to a synchronous localStorage store under the legacy `wp:economy:v1` key
 * AND migrates that legacy scalar 1:1 into the default currency (no value lost).
 *
 * STORAGE: the persisted record is DELIBERATELY tiny — wallet as [id,units]
 * pairs + a list of owned item ids + the equipped layer ids. We do NOT persist
 * item DEFINITIONS (those live in the bundled catalog, re-indexed at boot).
 */

/* --------------------------------------------------------------- catalog */

const CATALOG: Item[] = parseItemCatalog(catalogJson)
const CATALOG_BY_ID: Map<string, Item> = indexItems(CATALOG)

/** Look up an item definition by id (from the bundled catalog). */
export function getItemDef(id: string): Item | undefined {
  return CATALOG_BY_ID.get(id)
}

/** All known item definitions (for the shop's merchant stock, dev tools). */
export function allItemDefs(): Item[] {
  return CATALOG.slice()
}

/* ----------------------------------------------------------------- types */

/**
 * What a challenge/quest hands us. The multi-currency `currency` map is the
 * smorgasbord; the legacy scalar `coins` is mapped on read to the default
 * currency so old challenge code keeps working untouched (ECONOMY_CURRENCY §9).
 */
export interface Reward {
  xp?: number
  /** multi-currency grant (minor units), e.g. { "gold-real": 240, "jpy-yen": 30 }. */
  currency?: Wallet
  /** legacy: a scalar coin grant, mapped to the default currency on read. */
  coins?: number
  /** item ids to grant (looked up in the catalog). */
  items?: string[]
}

/** An owned stack: an item id + how many (cosmetics/quest keys are always 1). */
export interface OwnedStack {
  id: string
  qty: number
}

/** equipped[slot] = { itemId, tint? } — the avatar's worn cosmetics. */
export type Equipped = Record<string, { itemId: string; tint?: string }>

/** The full live economy state. */
export interface EconomyState {
  /** multi-currency balances (minor units, integer, nonnegative). */
  wallet: Wallet
  xp: number
  /** ordered for stable UI; keyed access via `stackOf`. */
  bag: OwnedStack[]
  equipped: Equipped
}

export type EconomyEvent =
  | { type: "reward"; reward: Reward; newItems: string[] }
  /** a currency balance changed. `coins`/`delta` keep the legacy default-currency view. */
  | { type: "currency"; currencyId: CurrencyId; delta: number; balance: number; coins: number }
  /** legacy alias kept for existing subscribers (default-currency total). */
  | { type: "coins"; delta: number; coins: number }
  | { type: "xp"; delta: number; xp: number }
  | { type: "grant"; id: string; qty: number }
  | { type: "consume"; id: string; qty: number }
  | { type: "equip"; slot: string; itemId: string; tint?: string }
  | { type: "unequip"; slot: string }
  | { type: "change" } // coarse "something changed" for simple subscribers

/* ------------------------------------------------------------- persistence */

const LEGACY_KEY = "wp:economy:v1"
const STORE_VERSION = 2 as const

/** The compact on-disk shape (v2). Wallet as [id,units] pairs. */
interface PersistedEconomyV2 {
  v: typeof STORE_VERSION
  /** wallet as [currencyId, minorUnits] pairs (compact). */
  w: [string, number][]
  x: number // xp
  b: [string, number][] // bag as [id, qty] pairs
  e: Equipped // equipped layers
}

function emptyState(): EconomyState {
  return { wallet: {}, xp: 0, bag: [], equipped: {} }
}

/** Sanitize a raw persisted record (any version) into live state. */
function reviveState(raw: unknown, defaultCurrency: CurrencyId): EconomyState {
  const empty = emptyState()
  if (!raw || typeof raw !== "object") return empty
  const p = raw as {
    v?: number
    c?: number
    w?: [string, number][]
    x?: number
    b?: [string, number][]
    e?: Equipped
  }

  const bag = (p.b ?? [])
    .filter(([id]) => CATALOG_BY_ID.has(id))
    .map(([id, qty]) => ({ id, qty: Math.max(1, qty | 0) }))
  const equipped: Equipped = {}
  for (const [slot, layer] of Object.entries(p.e ?? {})) {
    if (layer && CATALOG_BY_ID.has(layer.itemId)) equipped[slot] = layer
  }
  const xp = Math.max(0, (p.x ?? 0) | 0)

  let wallet: Wallet = {}
  if (p.v === 1 || (typeof p.c === "number" && !p.w)) {
    // MIGRATION (§9): legacy scalar coins → default currency, 1:1 (coin-base &
    // the default share baseValue, so no value is lost). The moon never returns.
    const coins = Math.max(0, (p.c ?? 0) | 0)
    if (coins > 0) wallet[defaultCurrency] = coins
    console.info(
      `[wp/economy] migrated legacy coins (${coins}) → ${defaultCurrency} (1:1, no value lost)`,
    )
  } else {
    for (const [id, units] of p.w ?? []) {
      if (!getCurrency(id)) {
        console.warn(`[wp/economy] dropping unknown currency "${id}" from save`)
        continue
      }
      const u = Math.max(0, Math.floor(units))
      if (u > 0) wallet[id] = (wallet[id] ?? 0) + u
    }
  }
  return { wallet, xp, bag, equipped }
}

function serialize(s: EconomyState): PersistedEconomyV2 {
  return {
    v: STORE_VERSION,
    w: Object.entries(s.wallet)
      .filter(([, u]) => u > 0)
      .map(([id, u]) => [id, u] as [string, number]),
    x: s.xp,
    b: s.bag.map((st) => [st.id, st.qty] as [string, number]),
    e: s.equipped,
  }
}

/* -------------------------------------------- synchronous localStorage store */

/**
 * A synchronous localStorage-backed store used when no `TrackStore` binding is
 * injected (single-Track standalone dev / the legacy global path). Mirrors the
 * stub in IMPLEMENTATION_CONTRACTS Seam 1 but stays SYNC so the inventory can
 * load its initial state at construction without an await (the real per-Track
 * IndexedDB store loads via `hydrate()` instead — see below).
 */
function syncLocalRead(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch (err) {
    console.warn("[wp/economy] could not read economy state:", err)
    return null
  }
}

function isQuotaError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED")
  )
}

function syncLocalWrite(key: string, value: PersistedEconomyV2): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return
  } catch (err) {
    if (!isQuotaError(err)) {
      console.error("[wp/economy] persist failed (non-quota):", err)
      return
    }
    console.error(
      "[wp/economy] localStorage quota exceeded persisting economy — trimming consumables and retrying once",
      err,
    )
    try {
      const trimmed: PersistedEconomyV2 = {
        ...value,
        b: value.b.map(([id, qty]) => {
          const def = CATALOG_BY_ID.get(id)
          return def?.kind === "consumable" ? [id, Math.min(qty, 1)] : [id, qty]
        }),
      }
      localStorage.setItem(key, JSON.stringify(trimmed))
    } catch (err2) {
      console.error(
        "[wp/economy] economy still over quota after trim — keeping in-memory only this session",
        err2,
      )
    }
  }
}

/* --------------------------------------------------------------- the store */

export interface InventoryStore {
  getState(): Readonly<EconomyState>

  /* ---- wallet (multi-currency) ---- */
  /** The full wallet (minor units per currency). */
  wallet(): Readonly<Wallet>
  /** Balance (minor units) of a currency (0 if none). */
  balance(currencyId: string): number
  /** Credit a currency (minor units). */
  credit(currencyId: string, units: number): void
  /** Debit a currency; returns false (no-op) if insufficient. */
  debit(currencyId: string, units: number): boolean
  /** Non-zero balances as [currencyId, units], richest first. */
  walletEntries(): Array<{ currencyId: CurrencyId; units: number }>
  /** The Track's default currency id (from its active Scene). */
  defaultCurrency(): CurrencyId

  /* ---- legacy default-currency view (back-compat — HUD/shop/trade) ---- */
  /** Default-currency total (minor units). Keeps the current coin HUD working. */
  coins(): number
  addCoins(delta: number): void
  /** Spend default-currency; returns false (no-op) if insufficient. */
  spendCoins(amount: number): boolean

  xp(): number
  /** total quantity of an owned item (0 if none). */
  qtyOf(id: string): number
  has(id: string): boolean
  hasAll(ids: string[]): boolean
  bagWithDefs(): Array<{ def: Item; qty: number }>
  equippedLayers(): Array<{ slot: string; itemId: string; tint?: string }>

  /** Ingest a challenge/quest reward (xp + currency/coins + items). Returns granted ids. */
  applyReward(reward: Reward): string[]
  addXp(delta: number): void
  grant(id: string, qty?: number): void
  consume(id: string, qty?: number): boolean
  equip(itemId: string, tint?: string): boolean
  unequip(slot: string): void

  subscribe(fn: (e: EconomyEvent) => void): () => void
  reset(): void
}

export interface InventoryOptions {
  /** per-Track namespaced async store (Seam 1). Omit → legacy localStorage. */
  binding?: TrackStoreBinding
  /** the Track's default currency (from its Scene). Omit → catalog default. */
  defaultCurrency?: CurrencyId
}

export function createInventory(opts: InventoryOptions = {}): InventoryStore {
  const defaultCurrency: CurrencyId = opts.defaultCurrency ?? DEFAULT_CURRENCY_ID
  const binding = opts.binding
  const key = binding ? `${binding.namespace}:economy` : LEGACY_KEY
  const asyncStore: TrackStore | null = binding?.store ?? null

  // Initial load: legacy/sync path can read synchronously; the async per-Track
  // store hydrates after construction (state starts empty, then fills + emits).
  let state: EconomyState = asyncStore
    ? emptyState()
    : reviveState(syncLocalRead(key), defaultCurrency)

  const listeners = new Set<(e: EconomyEvent) => void>()

  const emit = (e: EconomyEvent) => {
    for (const fn of listeners) {
      try {
        fn(e)
      } catch (err) {
        console.error("[wp/economy] subscriber threw:", err)
      }
    }
    if (e.type !== "change") {
      for (const fn of listeners) {
        try {
          fn({ type: "change" })
        } catch (err) {
          console.error("[wp/economy] subscriber threw:", err)
        }
      }
    }
  }

  const save = () => {
    const rec = serialize(state)
    if (asyncStore) void asyncStore.write(key, rec)
    else syncLocalWrite(key, rec)
  }

  // Async hydrate for the per-Track path. Reads the namespaced record; if absent
  // AND this is a fresh default Track, attempts the legacy-key migration COPY
  // (the legacy key stays one release — IMPLEMENTATION_CONTRACTS migration note).
  if (asyncStore) {
    void (async () => {
      try {
        let raw = await asyncStore.read<unknown>(key)
        if (raw == null) {
          const legacy = syncLocalRead(LEGACY_KEY)
          if (legacy != null) raw = legacy
        }
        if (raw != null) {
          state = reviveState(raw, defaultCurrency)
          emit({ type: "change" })
        }
      } catch (err) {
        console.error("[wp/economy] async hydrate failed:", err)
      }
    })()
  }

  const stackIndex = (id: string) => state.bag.findIndex((s) => s.id === id)

  function rawGrant(id: string, qty: number): boolean {
    const def = CATALOG_BY_ID.get(id)
    if (!def) {
      console.warn(`[wp/economy] grant of unknown item id "${id}" — skipped`)
      return false
    }
    if (qty <= 0) return false
    const i = stackIndex(id)
    if (i >= 0 && def.stackable) {
      state.bag[i].qty += qty
    } else if (i >= 0) {
      return false // non-stackable + already owned (one hat).
    } else {
      state.bag.push({ id, qty: def.stackable ? qty : 1 })
    }
    return true
  }

  function creditInternal(currencyId: string, units: number): number {
    const u = Math.floor(units)
    if (u === 0) return state.wallet[currencyId] ?? 0
    const next = Math.max(0, (state.wallet[currencyId] ?? 0) + u)
    if (next > 0) state.wallet[currencyId] = next
    else delete state.wallet[currencyId]
    return next
  }

  return {
    getState: () => state,

    wallet: () => state.wallet,
    balance: (id) => state.wallet[id] ?? 0,
    credit(id, units) {
      if (units <= 0) return
      const bal = creditInternal(id, units)
      save()
      emit({
        type: "currency",
        currencyId: id as CurrencyId,
        delta: units,
        balance: bal,
        coins: state.wallet[defaultCurrency] ?? 0,
      })
    },
    debit(id, units) {
      if (units <= 0) return true
      if ((state.wallet[id] ?? 0) < units) return false
      const bal = creditInternal(id, -units)
      save()
      emit({
        type: "currency",
        currencyId: id as CurrencyId,
        delta: -units,
        balance: bal,
        coins: state.wallet[defaultCurrency] ?? 0,
      })
      return true
    },
    walletEntries: () =>
      Object.entries(state.wallet)
        .filter(([, u]) => u > 0)
        .map(([currencyId, units]) => ({ currencyId: currencyId as CurrencyId, units }))
        .sort((a, b) => b.units - a.units),
    defaultCurrency: () => defaultCurrency,

    coins: () => state.wallet[defaultCurrency] ?? 0,
    addCoins(delta) {
      const bal = creditInternal(defaultCurrency, delta)
      save()
      emit({ type: "coins", delta, coins: bal })
      emit({ type: "currency", currencyId: defaultCurrency, delta, balance: bal, coins: bal })
    },
    spendCoins(amount) {
      if (amount <= 0) return true
      if ((state.wallet[defaultCurrency] ?? 0) < amount) return false
      const bal = creditInternal(defaultCurrency, -amount)
      save()
      emit({ type: "coins", delta: -amount, coins: bal })
      emit({ type: "currency", currencyId: defaultCurrency, delta: -amount, balance: bal, coins: bal })
      return true
    },

    xp: () => state.xp,
    qtyOf: (id) => state.bag.find((s) => s.id === id)?.qty ?? 0,
    has: (id) => stackIndex(id) >= 0,
    hasAll: (ids) => ids.every((id) => stackIndex(id) >= 0),
    bagWithDefs: () =>
      state.bag
        .map((s) => {
          const def = CATALOG_BY_ID.get(s.id)
          return def ? { def, qty: s.qty } : null
        })
        .filter((x): x is { def: Item; qty: number } => x != null),
    equippedLayers: () =>
      Object.entries(state.equipped).map(([slot, l]) => ({ slot, itemId: l.itemId, tint: l.tint })),

    applyReward(reward) {
      const granted: string[] = []
      // Multi-currency grant (the smorgasbord).
      const currency: Wallet = { ...(reward.currency ?? {}) }
      // Legacy scalar coins → default currency (mapped on read, §9).
      if (reward.coins) currency[defaultCurrency] = (currency[defaultCurrency] ?? 0) + reward.coins
      for (const [id, units] of Object.entries(currency)) {
        if (units <= 0) continue
        if (!getCurrency(id)) {
          console.warn(`[wp/economy] reward of unknown currency "${id}" — skipped`)
          continue
        }
        const bal = creditInternal(id, units)
        emit({
          type: "currency",
          currencyId: id as CurrencyId,
          delta: units,
          balance: bal,
          coins: state.wallet[defaultCurrency] ?? 0,
        })
        if (id === defaultCurrency) emit({ type: "coins", delta: units, coins: bal })
      }
      if (reward.xp) {
        state.xp = Math.max(0, state.xp + reward.xp)
        emit({ type: "xp", delta: reward.xp, xp: state.xp })
      }
      for (const id of reward.items ?? []) {
        if (rawGrant(id, 1)) {
          granted.push(id)
          emit({ type: "grant", id, qty: 1 })
        }
      }
      save()
      emit({ type: "reward", reward, newItems: granted })
      return granted
    },

    addXp(delta) {
      state.xp = Math.max(0, state.xp + delta)
      save()
      emit({ type: "xp", delta, xp: state.xp })
    },

    grant(id, qty = 1) {
      if (rawGrant(id, qty)) {
        save()
        emit({ type: "grant", id, qty })
      }
    },

    consume(id, qty = 1) {
      const i = stackIndex(id)
      if (i < 0 || state.bag[i].qty < qty) return false
      state.bag[i].qty -= qty
      if (state.bag[i].qty <= 0) state.bag.splice(i, 1)
      save()
      emit({ type: "consume", id, qty })
      return true
    },

    equip(itemId, tint) {
      const def = CATALOG_BY_ID.get(itemId)
      if (!def || !isCosmetic(def)) {
        console.warn(`[wp/economy] equip non-cosmetic / unknown "${itemId}" — ignored`)
        return false
      }
      if (stackIndex(itemId) < 0) {
        console.warn(`[wp/economy] equip unowned cosmetic "${itemId}" — ignored`)
        return false
      }
      const layer = cosmeticToAvatarLayer(def, tint)
      if (!layer) return false
      state.equipped[layer.slot] = { itemId: layer.itemId, tint: layer.tint }
      save()
      emit({ type: "equip", slot: layer.slot, itemId, tint: layer.tint })
      return true
    },

    unequip(slot) {
      if (state.equipped[slot]) {
        delete state.equipped[slot]
        save()
        emit({ type: "unequip", slot })
      }
    },

    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },

    reset() {
      state = emptyState()
      if (asyncStore) void asyncStore.remove(key)
      else
        try {
          localStorage.removeItem(key)
        } catch (err) {
          console.warn("[wp/economy] could not clear economy store:", err)
        }
      emit({ type: "change" })
    },
  }
}

/* --------------------------------------------------------- singleton seam */

let _singleton: InventoryStore | null = null
/** Process-wide inventory the game + shop + quest engine share (legacy path). */
export function inventory(): InventoryStore {
  if (!_singleton) _singleton = createInventory()
  return _singleton
}

/** Rebind the process-wide inventory to a per-Track store (Track switch). */
export function bindInventory(store: InventoryStore): void {
  _singleton = store
}
