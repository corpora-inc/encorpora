import type { CatalogV2, CatalogNarrationEntry, PurchaseInfo } from "./types"
import { resolveVoiceName } from "../../core/constants"

const CACHE_KEY = "reader-catalog-cache"

function readCache(): CatalogV2 | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cached = JSON.parse(raw) as { catalog: CatalogV2 }
    return cached.catalog ?? null
  } catch {
    return null
  }
}

function writeCache(catalog: CatalogV2): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ catalog }))
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
    languageName: toOptString(r.languageName),
    voiceId: toString(r.voiceId) || "default",
    voiceName: toString(r.voiceName) || resolveVoiceName(toString(r.voiceId) || "default"),
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
 *
 * By default lets CloudFront serve a cached copy (fast, cheap).
 * Pass `forceRefresh: true` to bypass CDN/browser cache and hit origin,
 * e.g. when the user explicitly opens the catalog drawer.
 *
 * On success the result is written to localStorage so it can serve as
 * an offline fallback when the network is unavailable.
 */
export async function fetchCatalog(
  cdnUrl: string,
  opts?: { forceRefresh?: boolean },
): Promise<CatalogV2> {
  const empty: CatalogV2 = {
    version: 2,
    generatedAt: new Date().toISOString(),
    narrations: [],
    gamePacks: [],
  }

  try {
    const force = opts?.forceRefresh ?? false
    const url = force
      ? cdnUrl + (cdnUrl.includes("?") ? "&" : "?") + "_t=" + Date.now()
      : cdnUrl
    const fetchOpts: RequestInit = force ? { cache: "no-store" } : {}
    const res = await fetch(url, fetchOpts)
    if (!res.ok) {
      console.warn("[reader-catalog] Fetch failed:", res.status, res.statusText)
      return readCache() ?? empty
    }
    const data = await res.json()
    const catalog = parseCatalogV2(data)
    if (!catalog) {
      console.warn("[reader-catalog] Failed to parse catalog data")
      return readCache() ?? empty
    }
    writeCache(catalog)
    return catalog
  } catch (err) {
    console.error("[reader-catalog] Fetch error:", err)
    // Offline or network error — fall back to last known good catalog
    const cached = readCache()
    if (cached) {
      return cached
    }
    return empty
  }
}

/** Clear the catalog cache */
export function clearCatalogCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    // ignore
  }
}
