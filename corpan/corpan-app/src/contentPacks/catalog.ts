import {
  type LocalizedString,
  parseLocalizedString,
} from "./localized"

export type PurchaseInfo = {
  type: "free" | "iap" | "code"
  productId?: string
  priceLabel?: string
  platformPackId?: string
}

/** Host platforms a pack can declare support for. Mirrors the values
 *  returned by `@tauri-apps/plugin-os` `type()`. */
export type HostPlatform = "ios" | "android" | "macos" | "windows" | "linux"

export type CatalogGame = {
  id: string
  name: string
  /** Per-language overrides for `name`. Resolved at the render site
   *  against `i18n.language` via `resolveLocalized()`. Optional — older
   *  catalogs (and packs that haven't authored translations yet) ship
   *  English-only via the bare `name` field. */
  nameLocalized?: LocalizedString
  version: string
  manifestUrl?: string
  description?: string
  /** Per-language overrides for `description`. Same fallback chain as
   *  `nameLocalized`. */
  descriptionLocalized?: LocalizedString
  imageUrl?: string
  purchase?: PurchaseInfo
}

export type CatalogNarrationEntry = {
  id: string
  bookId: string
  bookTitle: string
  language: string
  voiceId: string
  voiceName: string
  version: string
  downloadUrl: string
  sha256: string
  sizeMb: number
  series?: string
  volume?: number
  tier: "public" | "premium"
  purchase: PurchaseInfo
  /** Minimum Corpan app version required to use this pack */
  minAppVersion?: string
}

export type CatalogGamePack = {
  id: string
  type: "game"
  version: string
  downloadUrl: string
  purchase: PurchaseInfo
}

export type CatalogV2 = {
  version: 2
  generatedAt: string
  narrations: CatalogNarrationEntry[]
  gamePacks: CatalogGamePack[]
}

// --- V3 catalog types ---

export type PackChannel = "stable" | "preview"

export type CatalogV3Entry = {
  id: string
  name: string
  /** Per-language overrides for `name`. See `CatalogGame.nameLocalized`
   *  for resolution semantics. */
  nameLocalized?: LocalizedString
  version: string
  manifestUrl?: string
  zipUrl?: string
  description?: string
  /** Per-language overrides for `description`. */
  descriptionLocalized?: LocalizedString
  imageUrl?: string
  purchase?: PurchaseInfo
  minAppVersion: string
  /** Optional upper bound. Catalog may carry multiple entries with the
   *  same `id` but disjoint `[minAppVersion, maxAppVersion]` ranges, so a
   *  pack can ship a different version of itself to old vs. new apps
   *  (e.g. World Radio 0.3.x for ≤ 0.11.x hosts, 0.5.x for ≥ 0.12.0). */
  maxAppVersion?: string
  channel: PackChannel
  packType?: string
  /** Restrict the pack to specific host platforms. Absent = available
   *  everywhere. e.g. ["ios"] for packs that depend on native iOS-only
   *  plugins (Pronunciation Coach → WhisperKit / Apple Neural Engine). */
  platforms?: HostPlatform[]
  /** Minimum OS version (string from `@tauri-apps/plugin-os` `version()`).
   *  Compared via semantic version ordering — major.minor only is fine,
   *  trailing zeros are tolerated. Used to gate packs that need APIs from
   *  a specific iOS / Android / macOS release. */
  minOSVersion?: string
}

// Phrase packs are NOT on the v3 catalog. They ship through a dedicated
// S3-hosted catalog written directly by the publisher — see
// `contentPacks/phrasePackCatalog.ts` and `corpan/docs/PHRASE_PACK_AUTHORING.md`.

export type CatalogV3 = {
  version: 3
  generatedAt: string
  packs: CatalogV3Entry[]
}

const DEFAULT_CATALOG: CatalogGame[] = [
  {
    id: "hover_runner",
    name: "Hover Runner",
    version: "0.1.0",
    manifestUrl: "https://encorpora.io/corpan/packs/hover-runner.zip",
    description:
      "3D fun in Hover Runner: lock in correct translations with the All-Hearing Ear and avoid wrong ones.",
    imageUrl: "https://encorpora.io/assets/hover_runner-avatar.png",
    purchase: { type: "free", priceLabel: "Free" },
  },
  {
    id: "hanzipan",
    name: "Hanzipan",
    version: "0.3.0",
    manifestUrl: "https://encorpora.io/corpan/packs/hanzipan.zip",
    description: "Character-first handwriting studio for Mandarin.",
    imageUrl: "https://encorpora.io/assets/hanzipan-avatar.png",
    purchase: { type: "free", priceLabel: "Free" },
  },
]

const DEV_CATALOG: CatalogGame[] = [
  {
    id: "hover_runner",
    name: "Hover Runner",
    version: "0.1.0",
    manifestUrl: "/packs/hover-runner.zip",
    description:
      "3D fun in Hover Runner: lock in correct translations with the All-Hearing Ear and avoid wrong ones.",
    imageUrl: "https://encorpora.io/assets/hover_runner-avatar.png",
    purchase: { type: "free", priceLabel: "Free" },
  },
  {
    id: "hanzipan",
    name: "Hanzipan",
    version: "0.3.0",
    manifestUrl: "/packs/hanzipan.zip",
    description: "Character-first handwriting studio for Mandarin.",
    imageUrl: "https://encorpora.io/assets/hanzipan-avatar.png",
    purchase: { type: "free", priceLabel: "Free" },
  },
]

const PRODUCTION_CATALOG_URL = "https://encorpora.io/corpan/packs/catalog.json"

const isTauriRuntime = () => {
  if (typeof window === "undefined") return false
  return (
    "__TAURI__" in window ||
    "__TAURI_INTERNALS__" in window ||
    (window as any).__TAURI_IPC__ !== undefined
  )
}

const getCatalogUrl = () => {
  const envUrl = import.meta.env.VITE_GAME_CATALOG_URL
  if (typeof envUrl === "string" && envUrl.length > 0) {
    console.log("[catalog] Using VITE_GAME_CATALOG_URL:", envUrl)
    return envUrl
  }
  // In production, always try to fetch from the published catalog
  if (!import.meta.env.DEV) {
    console.log("[catalog] Production mode, using PRODUCTION_CATALOG_URL")
    return PRODUCTION_CATALOG_URL
  }
  // In dev mode on mobile/desktop (Tauri), use production catalog for testing consumer experience
  if (isTauriRuntime()) {
    console.log("[catalog] Dev mode + Tauri detected, using PRODUCTION_CATALOG_URL for consumer testing")
    return PRODUCTION_CATALOG_URL
  }
  // In dev mode in browser, use null to get local dev catalog
  console.log("[catalog] Dev mode in browser, using local DEV_CATALOG")
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

const toNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value
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
      nameLocalized: parseLocalizedString(record.nameLocalized),
      version,
      manifestUrl: toOptionalString(record.manifestUrl),
      description: toOptionalString(record.description),
      descriptionLocalized: parseLocalizedString(record.descriptionLocalized),
      imageUrl: toOptionalString(record.imageUrl),
      purchase: parsePurchase(record.purchase),
    })
  }
  return parsed
}

const parseNarration = (item: unknown): CatalogNarrationEntry | null => {
  if (!item || typeof item !== "object") return null
  const r = item as Record<string, unknown>
  const id = toStringValue(r.id)
  const bookId = toStringValue(r.bookId)
  const bookTitle = toStringValue(r.bookTitle)
  const language = toStringValue(r.language)
  const voiceId = toStringValue(r.voiceId)
  const voiceName = toStringValue(r.voiceName)
  const version = toStringValue(r.version)
  const downloadUrl = toStringValue(r.downloadUrl)
  const sha256 = toStringValue(r.sha256)
  const sizeMb = toNumber(r.sizeMb)
  if (!id || !bookId || !version || !downloadUrl) return null
  const tierRaw = toStringValue(r.tier)
  const tier: "public" | "premium" =
    tierRaw === "premium" ? "premium" : "public"
  return {
    id,
    bookId,
    bookTitle: bookTitle || bookId,
    language: language || "en",
    voiceId: voiceId || "default",
    voiceName: voiceName || voiceId || "Default",
    version,
    downloadUrl,
    sha256: sha256 || "",
    sizeMb: sizeMb ?? 0,
    series: toOptionalString(r.series),
    volume: toNumber(r.volume),
    tier,
    purchase: parsePurchase(r.purchase) ?? { type: "free" },
  }
}

/**
 * Parse a v2 catalog (object with version, narrations, gamePacks).
 * Also handles v1 format (plain array) for backward compatibility:
 * v1 arrays are treated as game catalogs with empty narrations.
 */
export const parseCatalogV2 = (data: unknown): CatalogV2 | null => {
  // v1 backward compat: plain array = game-only catalog
  if (Array.isArray(data)) {
    const games = parseCatalog(data)
    if (!games) return null
    return {
      version: 2,
      generatedAt: new Date().toISOString(),
      narrations: [],
      gamePacks: games.map((g) => ({
        id: g.id,
        type: "game" as const,
        version: g.version,
        downloadUrl: g.manifestUrl ?? "",
        purchase: g.purchase ?? { type: "free" },
      })),
    }
  }

  if (!data || typeof data !== "object") return null
  const record = data as Record<string, unknown>

  const narrations: CatalogNarrationEntry[] = []
  if (Array.isArray(record.narrations)) {
    for (const item of record.narrations) {
      const parsed = parseNarration(item)
      if (parsed) narrations.push(parsed)
    }
  }

  const gamePacks: CatalogGamePack[] = []
  if (Array.isArray(record.gamePacks)) {
    for (const item of record.gamePacks) {
      if (!item || typeof item !== "object") continue
      const r = item as Record<string, unknown>
      const id = toStringValue(r.id)
      const version = toStringValue(r.version)
      const downloadUrl = toStringValue(r.downloadUrl)
      if (!id || !version) continue
      gamePacks.push({
        id,
        type: "game",
        version,
        downloadUrl: downloadUrl || "",
        purchase: parsePurchase(r.purchase) ?? { type: "free" },
      })
    }
  }

  return {
    version: 2,
    generatedAt: toStringValue(record.generatedAt) || new Date().toISOString(),
    narrations,
    gamePacks,
  }
}

// --- V3 catalog logic ---

const CATALOG_V3_URL = "https://encorpora.io/corpan/packs/catalog-v3.json"

const parseV3Entry = (item: unknown): CatalogV3Entry | null => {
  if (!item || typeof item !== "object") return null
  const r = item as Record<string, unknown>
  const id = toStringValue(r.id)
  const name = toStringValue(r.name)
  const version = toStringValue(r.version)
  const minAppVersion = toStringValue(r.minAppVersion)
  const channelRaw = toStringValue(r.channel)
  if (!id || !version || !minAppVersion) return null
  const channel: PackChannel =
    channelRaw === "preview" ? "preview" : "stable"
  const allowedPlatforms: HostPlatform[] = [
    "ios", "android", "macos", "windows", "linux",
  ]
  let platforms: HostPlatform[] | undefined
  if (Array.isArray(r.platforms)) {
    const filtered = r.platforms
      .filter((p): p is HostPlatform =>
        typeof p === "string" &&
        (allowedPlatforms as readonly string[]).includes(p))
    platforms = filtered.length ? filtered : undefined
  }
  return {
    id,
    name: name || id,
    nameLocalized: parseLocalizedString(r.nameLocalized),
    version,
    manifestUrl: toOptionalString(r.manifestUrl),
    zipUrl: toOptionalString(r.zipUrl),
    description: toOptionalString(r.description),
    descriptionLocalized: parseLocalizedString(r.descriptionLocalized),
    imageUrl: toOptionalString(r.imageUrl),
    purchase: parsePurchase(r.purchase),
    minAppVersion,
    maxAppVersion: toOptionalString(r.maxAppVersion),
    channel,
    packType: toOptionalString(r.packType),
    platforms,
    minOSVersion: toOptionalString(r.minOSVersion),
  }
}

export const parseCatalogV3 = (data: unknown): CatalogV3 | null => {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null
  const record = data as Record<string, unknown>
  if (record.version !== 3) return null
  if (!Array.isArray(record.packs)) return null
  const packs: CatalogV3Entry[] = []
  for (const item of record.packs) {
    const parsed = parseV3Entry(item)
    if (parsed) packs.push(parsed)
  }
  return {
    version: 3,
    generatedAt:
      toStringValue(record.generatedAt) || new Date().toISOString(),
    packs,
  }
}

// Phrase packs were moved to a dedicated S3-hosted catalog in Phase B′
// (see `contentPacks/phrasePackCatalog.ts`). The old v3-catalog phrase-pack
// helpers (`selectPhrasePacks`, `fetchCatalogV3`) and the per-entry phrase-
// pack extension fields were removed at the same time.

export const filterCatalogForApp = (
  v3: CatalogV3,
  appVersion: string,
  devMode: boolean,
  host?: { platform?: HostPlatform; osVersion?: string },
): CatalogGame[] => {
  const hostPlatform = host?.platform
  const hostOsVersion = host?.osVersion
  return v3.packs
    .filter((entry) => {
      if (compareVersions(appVersion, entry.minAppVersion) < 0) return false
      if (
        entry.maxAppVersion &&
        compareVersions(appVersion, entry.maxAppVersion) > 0
      ) {
        return false
      }
      if (!devMode && entry.channel === "preview") return false
      // Platform restriction. If a pack declares `platforms`, the host's
      // platform must be in the list (e.g. Pronunciation Coach is iOS-
      // only because it depends on WhisperKit / ANE). When the host
      // platform is unknown (older app, web preview), be permissive
      // rather than hide everything.
      if (entry.platforms && entry.platforms.length > 0 && hostPlatform) {
        if (!entry.platforms.includes(hostPlatform)) return false
      }
      // OS version gate — keeps users on too-old iOS / Android from
      // installing packs that won't run. Skipped when host OS version
      // isn't known.
      if (entry.minOSVersion && hostOsVersion) {
        if (compareVersions(hostOsVersion, entry.minOSVersion) < 0) {
          return false
        }
      }
      return true
    })
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      nameLocalized: entry.nameLocalized,
      version: entry.version,
      manifestUrl: entry.zipUrl ?? entry.manifestUrl,
      description: entry.description,
      descriptionLocalized: entry.descriptionLocalized,
      imageUrl: entry.imageUrl,
      purchase: entry.purchase,
    }))
}

const fetchCatalogV3Raw = async (): Promise<CatalogV3 | null> => {
  try {
    const res = await fetch(CATALOG_V3_URL, { cache: "no-store" })
    if (!res.ok) return null
    const data = (await res.json()) as unknown
    return parseCatalogV3(data)
  } catch {
    return null
  }
}

/** Best-effort host detection via @tauri-apps/plugin-os. Outside Tauri
 *  (e.g. web preview) returns an empty object so platform / minOSVersion
 *  filters become no-ops rather than excluding everything. */
const detectHost = async (): Promise<{
  platform?: HostPlatform
  osVersion?: string
}> => {
  if (typeof window === "undefined") return {}
  if (!isTauriRuntime()) return {}
  try {
    const { type, version } = await import("@tauri-apps/plugin-os")
    const t = type()
    const v = version()
    const allowed: HostPlatform[] = [
      "ios", "android", "macos", "windows", "linux",
    ]
    const platform = (allowed as readonly string[]).includes(t)
      ? (t as HostPlatform)
      : undefined
    return { platform, osVersion: v || undefined }
  } catch {
    return {}
  }
}

export const fetchGameCatalog = async (
  appVersion?: string,
  devMode?: boolean,
): Promise<CatalogGame[]> => {
  // Try V3 catalog when app version is 0.10.0+
  if (appVersion && compareVersions(appVersion, "0.10.0") >= 0) {
    try {
      console.log("[catalog] App version", appVersion, ">= 0.10.0, trying V3 catalog")
      const v3 = await fetchCatalogV3Raw()
      if (v3) {
        const host = await detectHost()
        const filtered = filterCatalogForApp(
          v3, appVersion, devMode ?? false, host)
        console.log(
          "[catalog] V3 catalog:", v3.packs.length, "total,",
          filtered.length, "after filtering",
          "(host:", host.platform ?? "?", host.osVersion ?? "?", ")")
        if (filtered.length > 0) return filtered
      }
    } catch (error) {
      console.warn("[catalog] V3 fetch failed, falling back to V1:", error)
    }
  }

  // V1 fallback
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
    // v1 format is a plain array — parse directly to preserve all fields
    // (imageUrl, description, name). Routing through parseCatalogV2 is lossy.
    if (Array.isArray(data)) {
      const parsed = parseCatalog(data)
      console.log("[catalog] Parsed v1 catalog:", parsed?.length, "games")
      return parsed ?? getDefaultCatalog()
    }
    // v2 format is an object with narrations + gamePacks
    const v2 = parseCatalogV2(data)
    if (v2) {
      console.log("[catalog] Parsed v2 catalog:", v2.narrations.length, "narrations,", v2.gamePacks.length, "game packs")
      const games: CatalogGame[] = v2.gamePacks.map((gp) => ({
        id: gp.id,
        name: gp.id,
        version: gp.version,
        manifestUrl: gp.downloadUrl,
        purchase: gp.purchase,
      }))
      if (games.length === 0) {
        return getDefaultCatalog()
      }
      return games
    }
    return getDefaultCatalog()
  } catch (error) {
    console.error("[catalog] Fetch error:", error)
    return getDefaultCatalog()
  }
}

/**
 * Fetch the full v2 catalog including narrations.
 * Returns null if fetch fails or data is unparseable.
 */
export const fetchCatalogV2 = async (): Promise<CatalogV2 | null> => {
  const urlValue = getCatalogUrl()
  if (!urlValue) return null
  try {
    const url = new URL(urlValue, window.location.href).toString()
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) return null
    const data = (await res.json()) as unknown
    return parseCatalogV2(data)
  } catch {
    return null
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
