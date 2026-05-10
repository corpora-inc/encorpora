/**
 * Radio Browser API client.
 *
 * Public, free, no API key. We rotate across the regional mirrors that resolve
 * from a browser; `all.api.radio-browser.info` DNS round-robin only works
 * properly from Node, and most listed mirrors (at1/nl1/fi1) are decommissioned.
 * As of 2026-04-30 only de1/de2 reliably respond — keep the pool tight to
 * avoid wasting time on dead hosts.
 *
 * No custom request headers: the server's CORS preflight whitelist is just
 * `origin, x-requested-with, content-type, User-Agent`, so any extra header
 * (like a custom X-User-Agent) triggers a preflight that fails. Browsers also
 * forbid setting `User-Agent` from JS, so we just let the WebKit default UA
 * flow through, which the server happily accepts.
 *
 * Cache strategy: stale-while-revalidate via localStorage. Language list TTL is
 * 24h; per-language station list TTL is 12h. On network failure we keep serving
 * stale data so the catalog never goes empty. Stations are stripped to only the
 * fields the UI actually reads before caching, keeping the per-language entry
 * around 30 kB instead of ~80 kB so we can fit ~30+ languages within the WKWebView
 * 5 MB localStorage budget. On quota error we LRU-evict the oldest entry and
 * retry once before giving up.
 */

const SERVERS = [
  "https://de1.api.radio-browser.info",
  "https://de2.api.radio-browser.info",
]

const CACHE_PREFIX = "worldRadio.api.cache:"
const TTL_LANGUAGES_MS = 24 * 60 * 60 * 1000
const TTL_STATIONS_MS = 12 * 60 * 60 * 1000

export type RadioLanguage = {
  name: string
  iso_639: string | null
  stationcount: number
}

export type RadioStation = {
  changeuuid: string
  stationuuid: string
  name: string
  url: string
  url_resolved: string
  homepage: string
  favicon: string
  tags: string
  country: string
  countrycode: string
  state: string
  language: string
  languagecodes: string
  votes: number
  codec: string
  bitrate: number
  hls: number
  lastcheckok: number
  clickcount: number
  clicktrend: number
  geo_lat: number | null
  geo_long: number | null
}

type CacheEntry<T> = { fetchedAt: number; value: T }

function readCache<T>(key: string, ttlMs: number): { value: T | null; stale: boolean } {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return { value: null, stale: true }
    const entry = JSON.parse(raw) as CacheEntry<T>
    const age = Date.now() - entry.fetchedAt
    return { value: entry.value, stale: age > ttlMs }
  } catch {
    return { value: null, stale: true }
  }
}

/** Drop the oldest cached entry to make room. Returns true if anything went. */
function evictOldestCacheEntry(): boolean {
  let oldestKey: string | null = null
  let oldestAt = Infinity
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith(CACHE_PREFIX)) continue
      const raw = localStorage.getItem(k)
      if (!raw) continue
      try {
        const entry = JSON.parse(raw) as { fetchedAt?: number }
        const at = typeof entry.fetchedAt === "number" ? entry.fetchedAt : 0
        if (at < oldestAt) {
          oldestAt = at
          oldestKey = k
        }
      } catch { /* corrupt entry — drop it */ oldestKey = k; break }
    }
    if (oldestKey) {
      localStorage.removeItem(oldestKey)
      return true
    }
  } catch (err) {
    console.warn("[world-radio] cache eviction failed:", err)
  }
  return false
}

function writeCache<T>(key: string, value: T): void {
  const entry: CacheEntry<T> = { fetchedAt: Date.now(), value }
  const payload = JSON.stringify(entry)
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      localStorage.setItem(CACHE_PREFIX + key, payload)
      return
    } catch (err) {
      // QuotaExceededError — try evicting an older entry and retrying.
      const evicted = evictOldestCacheEntry()
      if (!evicted) {
        console.error("[world-radio] cache write failed (no entries left to evict):", err)
        return
      }
    }
  }
  console.error("[world-radio] cache write failed after eviction retries; giving up on", key)
}

let serverPool: string[] = []
function pickServers(): string[] {
  if (serverPool.length === 0) {
    serverPool = [...SERVERS].sort(() => Math.random() - 0.5)
  }
  return serverPool
}

async function fetchJson<T>(pathSuffix: string): Promise<T> {
  const servers = pickServers()
  let lastErr: unknown = null
  for (const base of servers) {
    try {
      // No custom headers — see file header for CORS preflight rationale.
      const res = await fetch(base + pathSuffix)
      if (!res.ok) {
        throw new Error(`Radio Browser ${base} ${pathSuffix} → ${res.status}`)
      }
      return (await res.json()) as T
    } catch (err) {
      console.error(`[world-radio] ${base}${pathSuffix} failed, trying next:`, err)
      lastErr = err
    }
  }
  throw lastErr ?? new Error("All Radio Browser servers failed")
}

/**
 * Fetch the full language → station-count list. Cached 24h.
 */
export async function getLanguages(): Promise<RadioLanguage[]> {
  const key = "languages"
  const cached = readCache<RadioLanguage[]>(key, TTL_LANGUAGES_MS)
  if (cached.value && !cached.stale) return cached.value

  try {
    const fresh = await fetchJson<RadioLanguage[]>("/json/languages?hidebroken=true")
    writeCache(key, fresh)
    return fresh
  } catch (err) {
    console.error("[world-radio] getLanguages failed, using cache if any:", err)
    if (cached.value) return cached.value
    throw err
  }
}

/**
 * Fetch playable stations for a given Radio Browser language name (lowercase, e.g. "persian").
 * Server-side excludes broken stations; client also drops unplayable codecs.
 * Cached 1h per language.
 */
export async function getStationsByLanguage(
  radioName: string,
  limit: number = 200
): Promise<RadioStation[]> {
  const key = `stations:${radioName}:${limit}`
  const cached = readCache<RadioStation[]>(key, TTL_STATIONS_MS)
  if (cached.value && !cached.stale) return cached.value

  const path =
    `/json/stations/bylanguageexact/${encodeURIComponent(radioName)}` +
    `?hidebroken=true&order=clickcount&reverse=true&limit=${limit}`
  try {
    const stations = await fetchJson<RadioStation[]>(path)
    const filtered = stations.filter(isPlayable).map(stripStation)
    writeCache(key, filtered)
    return filtered
  } catch (err) {
    console.error(`[world-radio] getStationsByLanguage(${radioName}) failed:`, err)
    if (cached.value) return cached.value
    throw err
  }
}

/**
 * Trim a station to only the fields the UI reads. Cuts the cache footprint by
 * roughly 50–60% (drops `homepage`, `state`, `votes`, `lastcheckok`,
 * `clicktrend`, `changeuuid`). Keeps the API surface stable — unused fields
 * are just absent, no consumer breakage.
 *
 * Preserves `hls`: the player keys off it to route through hls.js on Android,
 * since Chromium WebView has no native HLS decoder.
 *
 * Preserves `languagecodes` (typically 5–15 chars): the global map's
 * language filter matches against it for accuracy, since `language` is a
 * free-text English name with inconsistent operator tagging.
 */
function stripStation(s: RadioStation): RadioStation {
  return {
    changeuuid: "",
    stationuuid: s.stationuuid,
    name: s.name,
    url: s.url,
    url_resolved: s.url_resolved,
    homepage: "",
    favicon: s.favicon,
    tags: s.tags,
    country: s.country,
    countrycode: s.countrycode,
    state: "",
    language: s.language,
    languagecodes: s.languagecodes ?? "",
    votes: 0,
    codec: s.codec,
    bitrate: s.bitrate,
    hls: s.hls ? 1 : 0,
    lastcheckok: 1,
    clickcount: s.clickcount,
    clicktrend: 0,
    geo_lat: s.geo_lat,
    geo_long: s.geo_long,
  }
}

const UNPLAYABLE_CODECS = new Set(["FLV", "RTMP", "RTSP", "UNKNOWN", ""])

function isPlayable(s: RadioStation): boolean {
  if (s.lastcheckok !== 1) return false
  if (UNPLAYABLE_CODECS.has(s.codec.toUpperCase())) return false
  if (!s.url_resolved && !s.url) return false
  return true
}

/**
 * Fetch up to `limit` of the world's most-clicked playable stations, across
 * every language. Powers the global map view.
 *
 * Storage strategy: in-memory ONLY for the lifetime of the pack mount.
 * The global payload (10k stations × ~250 B serialized ≈ 2.5 MB) is the
 * single biggest thing this pack would write to localStorage, and the
 * Corpán host shares one localStorage origin across every pack — so even
 * a successful write would crowd out other packs' caches. Re-fetching on
 * every fresh pack open is a one-shot ~2 s network cost; keeping the
 * full set in memory while the pack is open delivers instant filter
 * re-renders and instant tab switches without touching disk.
 *
 * If the pack is closed and reopened, the in-memory cache is discarded
 * along with the rest of the pack module — the next open re-fetches
 * from Radio Browser. That's the right tradeoff: shared-origin storage
 * is a precious resource, and global-station data isn't worth the
 * persistence given how lightweight the network round-trip is.
 */
let memGlobalStations: { fetchedAt: number; limit: number; value: RadioStation[] } | null = null

export async function getAllStations(limit: number = 10000): Promise<RadioStation[]> {
  // In-memory hit — instant. Reuse if same limit and within the TTL window
  // (avoids re-fetching when the user toggles between tabs in one session).
  if (
    memGlobalStations &&
    memGlobalStations.limit === limit &&
    Date.now() - memGlobalStations.fetchedAt < TTL_STATIONS_MS
  ) {
    return memGlobalStations.value
  }

  const path =
    `/json/stations` +
    `?hidebroken=true&order=clickcount&reverse=true&limit=${limit}`
  try {
    const stations = await fetchJson<RadioStation[]>(path)
    const filtered = stations.filter(isPlayable).map(stripStation)
    memGlobalStations = { fetchedAt: Date.now(), limit, value: filtered }
    return filtered
  } catch (err) {
    console.error(`[world-radio] getAllStations(${limit}) failed:`, err)
    // Stale-better-than-nothing: if we have any prior in-memory copy
    // (e.g., a stale TTL fetch that succeeded earlier this session), use
    // it before propagating the error.
    if (memGlobalStations) return memGlobalStations.value
    throw err
  }
}

/**
 * Per-platform playability filter, applied at display time. With the native
 * `tauri-plugin-radio-stream` plugin in 0.11.8+ (ExoPlayer / AVPlayer), every
 * codec we care about decodes natively, so this is now a pass-through. We
 * keep the function for the call site in stationList — if a future codec
 * gap shows up we drop the filter back in here without touching the UI.
 *
 * If a station fails to play despite the filter, the native plugin surfaces
 * a play-time error and the user can pick something else.
 */
export function isPlayableOnPlatform(_s: RadioStation): boolean {
  return true
}

/**
 * Split the comma-separated `tags` field into clean lowercase tokens.
 * Drops empties, dedupes, and trims whitespace.
 */
export function parseTags(raw: string): string[] {
  if (!raw) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.split(",")) {
    const t = part.trim().toLowerCase()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

/**
 * Register a click for a station. Best-effort; failure is logged and ignored.
 */
export async function registerClick(stationuuid: string): Promise<void> {
  const servers = pickServers()
  const path = `/json/url/${encodeURIComponent(stationuuid)}`
  for (const base of servers) {
    try {
      const res = await fetch(base + path)
      if (!res.ok) throw new Error(`click ${res.status}`)
      return
    } catch (err) {
      console.error(`[world-radio] click ${base}${path} failed:`, err)
    }
  }
}
