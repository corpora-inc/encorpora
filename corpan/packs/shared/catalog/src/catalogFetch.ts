import type { CatalogV2, CatalogNarrationEntry, PurchaseInfo } from "./types"

const CACHE_KEY = "reader-catalog-cache"
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

type CachedCatalog = {
  catalog: CatalogV2
  fetchedAt: number
}

function readCache(): CachedCatalog | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cached = JSON.parse(raw) as CachedCatalog
    if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) return null
    return cached
  } catch {
    return null
  }
}

function writeCache(catalog: CatalogV2): void {
  try {
    const entry: CachedCatalog = { catalog, fetchedAt: Date.now() }
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry))
  } catch {
    // localStorage full or unavailable — ignore
  }
}

function toString(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function toOptString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined
}

function toNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined
}

function parsePurchase(v: unknown): PurchaseInfo {
  if (!v || typeof v !== "object") return { type: "free" }
  const r = v as Record<string, unknown>
  const t = toString(r.type)
  if (t !== "free" && t !== "iap" && t !== "code") return { type: "free" }
  return {
    type: t,
    productId: toOptString(r.productId),
    priceLabel: toOptString(r.priceLabel),
    platformPackId: toOptString(r.platformPackId),
  }
}

function parseNarration(item: unknown): CatalogNarrationEntry | null {
  if (!item || typeof item !== "object") return null
  const r = item as Record<string, unknown>
  const id = toString(r.id)
  const bookId = toString(r.bookId)
  const version = toString(r.version)
  const downloadUrl = toString(r.downloadUrl)
  if (!id || !bookId || !version || !downloadUrl) return null
  const tierRaw = toString(r.tier)
  return {
    id,
    bookId,
    bookTitle: toString(r.bookTitle) || bookId,
    language: toString(r.language) || "en",
    voiceId: toString(r.voiceId) || "default",
    voiceName: toString(r.voiceName) || "Default",
    version,
    downloadUrl,
    sha256: toString(r.sha256),
    sizeMb: toNumber(r.sizeMb) ?? 0,
    series: toOptString(r.series),
    volume: toNumber(r.volume),
    tier: tierRaw === "premium" ? "premium" : "public",
    purchase: parsePurchase(r.purchase),
  }
}

function parseCatalogV2(data: unknown): CatalogV2 | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null
  const record = data as Record<string, unknown>

  const narrations: CatalogNarrationEntry[] = []
  if (Array.isArray(record.narrations)) {
    for (const item of record.narrations) {
      const parsed = parseNarration(item)
      if (parsed) narrations.push(parsed)
    }
  }

  return {
    version: 2,
    generatedAt: toString(record.generatedAt) || new Date().toISOString(),
    narrations,
    gamePacks: [], // reader-catalog only cares about narrations
  }
}

/**
 * Fetch the narration catalog from CDN.
 * Returns cached data if fresh, otherwise fetches and caches.
 */
export async function fetchCatalog(cdnUrl: string): Promise<CatalogV2> {
  // Try cache first
  const cached = readCache()
  if (cached) return cached.catalog

  const empty: CatalogV2 = {
    version: 2,
    generatedAt: new Date().toISOString(),
    narrations: [],
    gamePacks: [],
  }

  try {
    const res = await fetch(cdnUrl, { cache: "no-store" })
    if (!res.ok) return empty
    const data = await res.json()
    const catalog = parseCatalogV2(data)
    if (!catalog) return empty
    writeCache(catalog)
    return catalog
  } catch {
    return empty
  }
}

/** Clear the catalog cache (force fresh fetch next time) */
export function clearCatalogCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    // ignore
  }
}
