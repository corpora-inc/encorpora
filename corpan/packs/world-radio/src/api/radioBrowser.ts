/**
 * Radio Browser API client.
 *
 * Public, free, no API key. We rotate across the regional mirrors because the
 * documented `all.api.radio-browser.info` DNS pool only resolves cleanly from
 * Node — browsers don't get useful failover from it.
 *
 * Cache strategy: stale-while-revalidate via localStorage. Language list TTL is
 * 24h; per-language station list TTL is 1h. On network failure we keep serving
 * stale data so the catalog never goes empty.
 */

const SERVERS = [
  "https://de1.api.radio-browser.info",
  "https://fi1.api.radio-browser.info",
  "https://nl1.api.radio-browser.info",
  "https://at1.api.radio-browser.info",
]

const USER_AGENT_HEADER = "X-User-Agent"
const USER_AGENT = "corpan-world-radio/0.1.0"

const CACHE_PREFIX = "worldRadio.api.cache:"
const TTL_LANGUAGES_MS = 24 * 60 * 60 * 1000
const TTL_STATIONS_MS = 60 * 60 * 1000

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

function writeCache<T>(key: string, value: T): void {
  try {
    const entry: CacheEntry<T> = { fetchedAt: Date.now(), value }
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry))
  } catch (err) {
    console.error("[world-radio] cache write failed:", err)
  }
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
      const res = await fetch(base + pathSuffix, {
        method: "GET",
        headers: { [USER_AGENT_HEADER]: USER_AGENT, accept: "application/json" },
      })
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
    const filtered = stations.filter(isPlayable)
    writeCache(key, filtered)
    return filtered
  } catch (err) {
    console.error(`[world-radio] getStationsByLanguage(${radioName}) failed:`, err)
    if (cached.value) return cached.value
    throw err
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
 * Register a click for a station. Best-effort; failure is logged and ignored.
 */
export async function registerClick(stationuuid: string): Promise<void> {
  const servers = pickServers()
  const path = `/json/url/${encodeURIComponent(stationuuid)}`
  for (const base of servers) {
    try {
      const res = await fetch(base + path, {
        method: "GET",
        headers: { [USER_AGENT_HEADER]: USER_AGENT, accept: "application/json" },
      })
      if (!res.ok) throw new Error(`click ${res.status}`)
      return
    } catch (err) {
      console.error(`[world-radio] click ${base}${path} failed:`, err)
    }
  }
}
