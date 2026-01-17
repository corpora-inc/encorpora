export type PurchaseInfo = {
  type: "free" | "iap" | "code"
  productId?: string
  priceLabel?: string
  platformPackId?: string
}

export type CatalogGame = {
  id: string
  name: string
  version: string
  manifestUrl?: string
  description?: string
  purchase?: PurchaseInfo
}

const DEFAULT_CATALOG: CatalogGame[] = [
  {
    id: "hover_runner",
    name: "Hover Runner",
    version: "0.1.0",
    manifestUrl: "https://encorpora.io/corpan/packs/hover-runner.zip",
    description: "Hoverboard runner that drills core phrases.",
    purchase: { type: "free", priceLabel: "Free" },
  },
  {
    id: "hanzipan",
    name: "Hanzipan",
    version: "0.1.0",
    manifestUrl: "https://encorpora.io/corpan/packs/hanzipan.zip",
    description: "Character-first handwriting studio for Mandarin.",
    purchase: { type: "free", priceLabel: "Free" },
  },
]

const DEV_CATALOG: CatalogGame[] = [
  {
    id: "hover_runner",
    name: "Hover Runner",
    version: "0.1.0",
    manifestUrl: "/packs/hover-runner.zip",
    description: "Hoverboard runner that drills core phrases.",
    purchase: { type: "free", priceLabel: "Free" },
  },
  {
    id: "hanzipan",
    name: "Hanzipan",
    version: "0.1.0",
    manifestUrl: "/packs/hanzipan.zip",
    description: "Character-first handwriting studio for Mandarin.",
    purchase: { type: "free", priceLabel: "Free" },
  },
]

const PRODUCTION_CATALOG_URL = "https://encorpora.io/corpan/packs/catalog.json"

const getCatalogUrl = () => {
  const envUrl = import.meta.env.VITE_GAME_CATALOG_URL
  if (typeof envUrl === "string" && envUrl.length > 0) {
    return envUrl
  }
  // In production, always try to fetch from the published catalog
  if (!import.meta.env.DEV) {
    return PRODUCTION_CATALOG_URL
  }
  return null
}

const toStringValue = (value: unknown) => {
  if (typeof value === "string") return value
  return ""
}

const toOptionalString = (value: unknown) => {
  if (typeof value === "string") return value
  return undefined
}

const parsePurchase = (value: unknown): PurchaseInfo | undefined => {
  if (!value || typeof value !== "object") return undefined
  const record = value as Record<string, unknown>
  const type = toStringValue(record.type)
  if (type !== "free" && type !== "iap" && type !== "code") return undefined
  return {
    type,
    productId: toOptionalString(record.productId),
    priceLabel: toOptionalString(record.priceLabel),
    platformPackId: toOptionalString(record.platformPackId),
  }
}

const getDefaultCatalog = () =>
  import.meta.env.DEV ? DEV_CATALOG : DEFAULT_CATALOG

const parseCatalog = (data: unknown): CatalogGame[] | null => {
  if (!Array.isArray(data)) return null
  const parsed: CatalogGame[] = []
  for (const item of data) {
    if (!item || typeof item !== "object") continue
    const record = item as Record<string, unknown>
    const id = toStringValue(record.id)
    const name = toStringValue(record.name)
    const version = toStringValue(record.version)
    if (!id || !version) continue
    parsed.push({
      id,
      name: name || id,
      version,
      manifestUrl: toOptionalString(record.manifestUrl),
      description: toOptionalString(record.description),
      purchase: parsePurchase(record.purchase),
    })
  }
  return parsed
}

export const fetchGameCatalog = async (): Promise<CatalogGame[]> => {
  const urlValue = getCatalogUrl()
  if (!urlValue) {
    console.log("[catalog] No catalog URL, using defaults")
    return getDefaultCatalog()
  }
  try {
    const url = new URL(urlValue, window.location.href).toString()
    console.log("[catalog] Fetching from:", url)
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) {
      console.log("[catalog] Fetch failed with status:", res.status)
      return getDefaultCatalog()
    }
    const data = (await res.json()) as unknown
    const parsed = parseCatalog(data)
    console.log("[catalog] Parsed catalog:", parsed)
    return parsed ?? getDefaultCatalog()
  } catch (error) {
    console.error("[catalog] Fetch error:", error)
    return getDefaultCatalog()
  }
}

const normalizeVersion = (value: string) =>
  value
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0))

export const compareVersions = (a: string, b: string) => {
  const left = normalizeVersion(a)
  const right = normalizeVersion(b)
  const length = Math.max(left.length, right.length)
  for (let i = 0; i < length; i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

export type UpdateType = "major" | "minor" | "patch"

/**
 * Determine the type of update based on semantic versioning
 * @param remoteVersion The version available remotely
 * @param localVersion The currently installed version
 * @returns 'major', 'minor', or 'patch' if remote is newer, null otherwise
 */
export const getUpdateType = (
  remoteVersion: string,
  localVersion: string
): UpdateType | null => {
  const remote = normalizeVersion(remoteVersion)
  const local = normalizeVersion(localVersion)

  // Check major version (X.0.0)
  if ((remote[0] ?? 0) > (local[0] ?? 0)) return "major"
  if ((remote[0] ?? 0) < (local[0] ?? 0)) return null

  // Check minor version (0.X.0)
  if ((remote[1] ?? 0) > (local[1] ?? 0)) return "minor"
  if ((remote[1] ?? 0) < (local[1] ?? 0)) return null

  // Check patch version (0.0.X)
  if ((remote[2] ?? 0) > (local[2] ?? 0)) return "patch"

  return null // Same version or local is newer
}
