import type {
  CatalogV2,
  CatalogNarrationEntry,
  NarrationArtifact,
  PurchaseInfo,
  Character,
  VoiceProfile,
  VoiceProvider,
  VoiceSource,
  BookEntry,
} from "./types"
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

/** Parse a two-ZIP artifact (preview/full). Returns undefined when absent or
 *  malformed so the entry simply isn't treated as two-zip. */
function parseArtifact(v: unknown): NarrationArtifact | undefined {
  if (!v || typeof v !== "object") return undefined
  const r = v as Record<string, unknown>
  const url = toString(r.url)
  if (!url) return undefined
  return {
    url,
    sha256: toString(r.sha256),
    sizeMb: toNumber(r.sizeMb) ?? 0,
    requires: toOptString(r.requires),
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
    minAppVersion: toOptString(r.minAppVersion),
    characterId: toOptString(r.characterId),
    coverImageUrl: toOptString(r.coverImageUrl),
    // Corpán Plus two-ZIP fields — WITHOUT these, isTwoZipEntry() is always
    // false and every install falls back to the full legacy `downloadUrl`
    // (no preview, no paywall). Carry them through.
    totalSegments: toNumber(r.totalSegments),
    freeSegments: toNumber(r.freeSegments),
    preview: parseArtifact(r.preview),
    full: parseArtifact(r.full),
  }
}

const VALID_PROVIDERS: VoiceProvider[] = [
  "chatterbox",
  "gemini",
  "vertex-tts",
  "elevenlabs",
  "openai",
  "platform",
]

function parseVoiceProvider(v: unknown): VoiceProvider {
  const s = toString(v)
  return (VALID_PROVIDERS as string[]).includes(s) ? (s as VoiceProvider) : "chatterbox"
}

function parseVoiceSource(v: unknown): VoiceSource {
  if (!v || typeof v !== "object") return { kind: "native" }
  const r = v as Record<string, unknown>
  if (toString(r.kind) === "cloned") {
    return {
      kind: "cloned",
      sourceWaveUrl: toString(r.sourceWaveUrl),
      sourceWaveSha256: toString(r.sourceWaveSha256),
      lengthSeconds: toNumber(r.lengthSeconds) ?? 0,
      recordedAt: toOptString(r.recordedAt),
    }
  }
  return { kind: "native" }
}

function parseStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === "string")
}

function parseVoiceProfile(item: unknown): VoiceProfile | null {
  if (!item || typeof item !== "object") return null
  const r = item as Record<string, unknown>
  const id = toString(r.id)
  const characterId = toString(r.characterId)
  if (!id || !characterId) return null
  const statusRaw = toString(r.status)
  const status: VoiceProfile["status"] =
    statusRaw === "deprecated" ? "deprecated"
    : statusRaw === "experimental" ? "experimental"
    : "active"
  return {
    id,
    characterId,
    displayName: toString(r.displayName) || resolveVoiceName(id),
    provider: parseVoiceProvider(r.provider),
    providerVoiceId: toOptString(r.providerVoiceId),
    source: parseVoiceSource(r.source),
    supportedLanguages: parseStringArray(r.supportedLanguages),
    traits: Array.isArray(r.traits) ? parseStringArray(r.traits) : undefined,
    previewClipUrl: toOptString(r.previewClipUrl),
    status,
    order: toNumber(r.order),
  }
}

function parseCharacterLinks(v: unknown): { label: string; url: string }[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out: { label: string; url: string }[] = []
  for (const raw of v) {
    if (!raw || typeof raw !== "object") continue
    const r = raw as Record<string, unknown>
    const label = toString(r.label)
    const url = toString(r.url)
    if (label && url) out.push({ label, url })
  }
  return out.length > 0 ? out : undefined
}

function parseCharacter(item: unknown): Character | null {
  if (!item || typeof item !== "object") return null
  const r = item as Record<string, unknown>
  const id = toString(r.id)
  if (!id) return null
  const status: Character["status"] = toString(r.status) === "deprecated" ? "deprecated" : "active"
  return {
    id,
    displayName: toString(r.displayName) || id,
    tagline: toOptString(r.tagline),
    bio: toOptString(r.bio),
    pronouns: toOptString(r.pronouns),
    avatarUrl: toString(r.avatarUrl),
    bannerUrl: toOptString(r.bannerUrl),
    accentColor: toOptString(r.accentColor),
    links: parseCharacterLinks(r.links),
    supportedLanguages: Array.isArray(r.supportedLanguages)
      ? parseStringArray(r.supportedLanguages)
      : undefined,
    status,
    order: toNumber(r.order),
  }
}

function parseBookEntry(item: unknown): BookEntry | null {
  if (!item || typeof item !== "object") return null
  const r = item as Record<string, unknown>
  const bookId = toString(r.bookId)
  if (!bookId) return null
  return {
    bookId,
    title: toString(r.title) || bookId,
    description: toOptString(r.description),
    author: toOptString(r.author),
    coverImageUrl: toString(r.coverImageUrl),
    bannerUrl: toOptString(r.bannerUrl),
    series: toOptString(r.series),
    volume: toNumber(r.volume),
    primaryLanguage: toString(r.primaryLanguage) || "en",
    tags: Array.isArray(r.tags) ? parseStringArray(r.tags) : undefined,
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

  let characters: Character[] | undefined
  if (Array.isArray(record.characters)) {
    characters = []
    for (const item of record.characters) {
      const parsed = parseCharacter(item)
      if (parsed) characters.push(parsed)
    }
  }

  let voiceProfiles: VoiceProfile[] | undefined
  if (Array.isArray(record.voiceProfiles)) {
    voiceProfiles = []
    for (const item of record.voiceProfiles) {
      const parsed = parseVoiceProfile(item)
      if (parsed) voiceProfiles.push(parsed)
    }
  }

  let books: BookEntry[] | undefined
  if (Array.isArray(record.books)) {
    books = []
    for (const item of record.books) {
      const parsed = parseBookEntry(item)
      if (parsed) books.push(parsed)
    }
  }

  return {
    version: 2,
    generatedAt: toString(record.generatedAt) || new Date().toISOString(),
    narrations,
    gamePacks: [], // reader-catalog only cares about narrations
    characters,
    voiceProfiles,
    books,
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
  opts?: { forceRefresh?: boolean; fallbackUrl?: string },
): Promise<CatalogV2> {
  const empty: CatalogV2 = {
    version: 2,
    generatedAt: new Date().toISOString(),
    narrations: [],
    gamePacks: [],
  }

  async function tryFetch(url: string, force: boolean): Promise<CatalogV2 | null> {
    const fetchUrl = force
      ? url + (url.includes("?") ? "&" : "?") + "_t=" + Date.now()
      : url
    const fetchOpts: RequestInit = force ? { cache: "no-store" } : {}
    const res = await fetch(fetchUrl, fetchOpts)
    if (!res.ok) return null
    const data = await res.json()
    return parseCatalogV2(data)
  }

  try {
    const force = opts?.forceRefresh ?? false

    // Try primary URL (catalog-v2.json for new readers)
    let catalog = await tryFetch(cdnUrl, force)
    if (catalog) {
      writeCache(catalog)
      return catalog
    }

    // Fallback to legacy catalog.json if v2 not available
    if (opts?.fallbackUrl) {
      console.info("[reader-catalog] v2 unavailable, falling back to legacy catalog")
      catalog = await tryFetch(opts.fallbackUrl, force)
      if (catalog) {
        writeCache(catalog)
        return catalog
      }
    }

    console.warn("[reader-catalog] All catalog URLs failed")
    return readCache() ?? empty
  } catch (err) {
    console.error("[reader-catalog] Fetch error:", err)
    return readCache() ?? empty
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
