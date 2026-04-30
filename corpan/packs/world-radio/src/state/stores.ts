/**
 * localStorage-backed stores for prefs, favorites, recents.
 *
 * Each store is a simple read/write pair around a single JSON key. Errors are
 * logged loudly (per the project's noisy-errors rule) and the store falls back
 * to defaults — never silently swallowed.
 */

const KEY_PREFS = "worldRadio.prefs.v1"
const KEY_FAVORITES = "worldRadio.favorites.v1"
const KEY_RECENTS = "worldRadio.recents.v1"

const RECENTS_CAP = 20

export type Prefs = {
  volume: number
  lastStationUuid: string | null
}

export type StationLite = {
  uuid: string
  name: string
  url_resolved: string
  language: string
  country: string
  codec: string
  bitrate: number
  favicon: string
}

const DEFAULT_PREFS: Prefs = {
  volume: 0.85,
  lastStationUuid: null,
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch (err) {
    console.error(`[world-radio] load ${key} failed:`, err)
    return fallback
  }
}

function saveJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (err) {
    console.error(`[world-radio] save ${key} failed:`, err)
  }
}

export const prefsStore = {
  load: (): Prefs => ({ ...DEFAULT_PREFS, ...loadJson<Partial<Prefs>>(KEY_PREFS, {}) }),
  save: (p: Prefs) => saveJson(KEY_PREFS, p),
}

export const favoritesStore = {
  load: (): StationLite[] => loadJson<StationLite[]>(KEY_FAVORITES, []),
  save: (list: StationLite[]) => saveJson(KEY_FAVORITES, list),
  toggle(station: StationLite): { list: StationLite[]; isFavorite: boolean } {
    const current = this.load()
    const idx = current.findIndex((s) => s.uuid === station.uuid)
    if (idx >= 0) {
      const next = current.slice()
      next.splice(idx, 1)
      this.save(next)
      return { list: next, isFavorite: false }
    }
    const next = [station, ...current]
    this.save(next)
    return { list: next, isFavorite: true }
  },
  has(uuid: string): boolean {
    return this.load().some((s) => s.uuid === uuid)
  },
}

export const recentsStore = {
  load: (): StationLite[] => loadJson<StationLite[]>(KEY_RECENTS, []),
  save: (list: StationLite[]) => saveJson(KEY_RECENTS, list),
  push(station: StationLite): StationLite[] {
    const current = this.load().filter((s) => s.uuid !== station.uuid)
    const next = [station, ...current].slice(0, RECENTS_CAP)
    this.save(next)
    return next
  },
}

export function toLite(s: {
  stationuuid: string
  name: string
  url_resolved: string
  url: string
  language: string
  country: string
  codec: string
  bitrate: number
  favicon: string
}): StationLite {
  return {
    uuid: s.stationuuid,
    name: s.name,
    url_resolved: s.url_resolved || s.url,
    language: s.language,
    country: s.country,
    codec: s.codec,
    bitrate: s.bitrate,
    favicon: s.favicon,
  }
}
