import { z } from "zod"
import { Currency, Denomination, type CurrencyId, type CurrencyArt } from "@corpan-city/contracts"
import type { IconRenderer, IconSpec, IconFamily } from "../contracts/runtime"
import currenciesJson from "../../content/economy/currencies.json"

/**
 * currencies — the currency CATALOG runtime (ECONOMY_CURRENCY §1).
 *
 * Loads + validates `content/economy/currencies.json` (CDN-overridable later),
 * indexes by id, and provides the pure money helpers every economy surface uses:
 *   - `decompose(C, units)` → greedy "make change" into physical denominations
 *     (the "stacks of bills" rendering, not "+N🪙"),
 *   - `format(C, units, locale)` → grouped major-unit string ("R 18.40"),
 *   - `defaultCurrencyForScene(...)` → which currency a Scene mints natively,
 *   - `currencyIconSpec` / `denominationIconSpec` → map `CurrencyArt` → the
 *     shared `IconRenderer` `IconSpec` (Seam 2), so we NEVER hardcode emoji.
 *
 * The catalog is GLOBAL data (one library shared by all Tracks); only balances
 * are per-Track. Unknown/invalid rows are dropped with a loud warn (never crash)
 * — same forward-compat discipline as catalog-v2.
 */

/* --------------------------------------------------------------- load + index */

const CatalogShape = z.object({
  version: z.number().optional(),
  default: z.string().optional(),
  currencies: z.array(z.unknown()),
})

function loadCatalog(raw: unknown): { currencies: Currency[]; defaultId: CurrencyId } {
  const parsed = CatalogShape.safeParse(raw)
  if (!parsed.success) {
    console.error("[wp/economy/currencies] currencies.json malformed — empty catalog", parsed.error)
    return { currencies: [], defaultId: "coin-base" as CurrencyId }
  }
  const currencies: Currency[] = []
  for (const row of parsed.data.currencies) {
    const r = Currency.safeParse(row)
    if (r.success) currencies.push(r.data)
    else
      console.warn(
        "[wp/economy/currencies] dropping invalid currency row:",
        (row as { id?: string })?.id ?? "<no id>",
        r.error.issues[0]?.message,
      )
  }
  const defaultId = (parsed.data.default ?? currencies[0]?.id ?? "coin-base") as CurrencyId
  return { currencies, defaultId }
}

const { currencies: CURRENCIES, defaultId: CATALOG_DEFAULT } = loadCatalog(currenciesJson)
const BY_ID = new Map<string, Currency>(CURRENCIES.map((c) => [c.id, c]))

/** The catalog default currency id (used when no Scene match). */
export const DEFAULT_CURRENCY_ID: CurrencyId = CATALOG_DEFAULT

/** Look up a currency definition by id (undefined if unknown). */
export function getCurrency(id: string): Currency | undefined {
  return BY_ID.get(id)
}

/** Is this a known, non-legacy currency that may be rewarded/exchanged? */
export function isLiveCurrency(id: string): boolean {
  return BY_ID.has(id) && id !== "coin-base"
}

/** All currencies (excludes the legacy `coin-base` by default). */
export function allCurrencies(includeLegacy = false): Currency[] {
  return CURRENCIES.filter((c) => includeLegacy || c.id !== "coin-base")
}

/* --------------------------------------------------- default currency by Scene */

/**
 * The currency a Scene mints natively → the Track's default reward currency.
 * Matches the Scene's place/era/tags against each currency's `sceneTags`,
 * preferring an exact place/era hit, then any tag overlap, else the catalog
 * default. Pure — takes plain strings so it needs no Scene import.
 */
export function defaultCurrencyForScene(opts: {
  place?: string
  era?: string
  tags?: string[]
}): CurrencyId {
  const hay = new Set(
    [opts.place, opts.era, ...(opts.tags ?? [])].filter(Boolean).map((s) => String(s).toLowerCase()),
  )
  let best: { id: CurrencyId; score: number } | null = null
  for (const c of CURRENCIES) {
    if (c.id === "coin-base") continue
    let score = 0
    if (c.place && hay.has(c.place.toLowerCase())) score += 3
    if (c.era && hay.has(c.era.toLowerCase())) score += 2
    for (const tag of c.sceneTags ?? []) if (hay.has(tag.toLowerCase())) score += 1
    if (score > 0 && (!best || score > best.score)) best = { id: c.id as CurrencyId, score }
  }
  return best?.id ?? DEFAULT_CURRENCY_ID
}

/* ---------------------------------------------------------- make change / fmt */

export interface DenomStack {
  denom: Denomination
  count: number
}

/**
 * Greedy large→small decomposition of `units` (minor units) into physical
 * denomination stacks — the "stacks of bills / coins / ingots" rendering. Any
 * remainder below the smallest denomination is returned as a final stack of the
 * smallest denom only when it has units===1 (true minor unit); otherwise the
 * leftover is reported via `remainder` so callers can show "+N loose".
 */
export function decompose(c: Currency, units: number): { stacks: DenomStack[]; remainder: number } {
  const stacks: DenomStack[] = []
  let rest = Math.max(0, Math.floor(units))
  // denominations are authored small→large; walk large→small for greedy change.
  const denoms = [...c.denominations].sort((a, b) => b.units - a.units)
  for (const d of denoms) {
    if (d.units <= 0) continue
    const count = Math.floor(rest / d.units)
    if (count > 0) {
      stacks.push({ denom: d, count })
      rest -= count * d.units
    }
  }
  return { stacks, remainder: rest }
}

/** The top `n` denomination stacks (largest value first) for a compact render. */
export function topStacks(c: Currency, units: number, n = 3): DenomStack[] {
  return decompose(c, units).stacks.slice(0, n)
}

/**
 * Format a minor-unit balance as a grouped major-unit string ("R 18.40",
 * "¥ 50,000"). Uses Intl.NumberFormat with the Track's native locale so large
 * numbers group per-locale (a localization win + a place-value drill). The
 * currency symbol prefixes; the *name* localizes elsewhere (i18n), the symbol
 * is Unicode + locale-neutral.
 */
export function format(c: Currency, units: number, locale?: string): string {
  const major = units / c.minorPerMajor
  const fractionDigits = c.minorPerMajor > 1 ? String(c.minorPerMajor - 1).length : 0
  let num: string
  try {
    num = new Intl.NumberFormat(locale || undefined, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(major)
  } catch {
    num = major.toFixed(fractionDigits)
  }
  return `${c.symbol} ${num}`
}

/** Bare grouped number (no symbol) — for steppers / totals. */
export function formatMajor(c: Currency, units: number, locale?: string): string {
  return format(c, units, locale).replace(`${c.symbol} `, "")
}

/* ------------------------------------------------------ CurrencyArt → IconSpec */

/** CurrencyArt.shape is a strict subset of IconFamily — pass it through. */
function shapeToFamily(shape: CurrencyArt["shape"]): IconFamily {
  return shape as IconFamily
}

/** Map a `CurrencyArt` + a currency's palette to the shared `IconSpec`. */
export function artToIconSpec(art: CurrencyArt, paletteHint?: string, seed?: number): IconSpec {
  return {
    family: shapeToFamily(art.shape),
    palette: paletteHint ?? art.paper?.hue ?? "#cdb87a",
    finish: art.metal ? "metal" : art.paper ? "matte" : "matte",
    motif: art.motif,
    accent: art.bandColor ?? art.paper?.hue,
    metal: art.metal,
    seed,
  }
}

/** The icon spec for a currency's headline art. */
export function currencyIconSpec(c: Currency): IconSpec {
  return artToIconSpec(c.art, c.paletteHint, hashSeed(c.id))
}

/** The icon spec for a specific denomination. */
export function denominationIconSpec(c: Currency, d: Denomination): IconSpec {
  return artToIconSpec(d.art, c.paletteHint, hashSeed(`${c.id}:${d.id}`))
}

function hashSeed(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) h = (Math.imul(h ^ s.charCodeAt(i), 0x01000193)) >>> 0
  return h >>> 0
}

/* ------------------------------------------------------ stub IconRenderer (S2) */

/**
 * The labeled-disc stub renderer (IMPLEMENTATION_CONTRACTS Seam 2). Economy UI
 * codes against this until Slice 4 lands the painted `IconRenderer`; swapping in
 * the real one is a zero-call-site change. It draws a filled disc in the spec's
 * palette plus a tiny family glyph so distinct currencies are still legible in
 * dev. NEVER an emoji — a colored shape, the seam's promise.
 */
export const stubIconRenderer: IconRenderer = {
  renderIcon(spec, target) {
    const s = target?.size ?? 32
    const c = document.createElement("canvas")
    c.width = c.height = s
    const x = c.getContext("2d")
    if (!x) return c
    // body: rounded shape tinted by palette
    x.fillStyle = spec.palette
    const isBill = spec.family === "bill-rect" || spec.family === "note-stack"
    if (isBill) {
      const m = s * 0.12
      x.fillRect(m, m * 1.6, s - 2 * m, s - 3.2 * m)
      if (spec.accent) {
        x.fillStyle = spec.accent
        x.fillRect(m, s * 0.5 - s * 0.05, s - 2 * m, s * 0.1)
      }
    } else {
      x.beginPath()
      x.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2)
      x.fill()
      // metal rim highlight so a coin reads as money, never a flat moon.
      x.strokeStyle = "rgba(255,255,255,0.45)"
      x.lineWidth = Math.max(1, s * 0.04)
      x.stroke()
    }
    return c
  },
  iconDataUrl(spec, target) {
    return this.renderIcon(spec, target).toDataURL()
  },
}

/** The renderer the economy uses. Swap-point for the real Slice 4 renderer. */
let _renderer: IconRenderer = stubIconRenderer

/** Orchestrator injects the real `IconRenderer` here when Slice 4 lands. */
export function setIconRenderer(r: IconRenderer): void {
  _renderer = r
}

/** The active icon renderer (stub until Slice 4). */
export function iconRenderer(): IconRenderer {
  return _renderer
}
