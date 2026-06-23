/**
 * Per-language list preferences (sort key, view mode, active tags).
 *
 * Distinct from `prefs.ts` which is global (volume, last station). This is
 * keyed by Corpan language code so reopening Persian remembers your
 * "sort by bitrate, filter to news, map view" choice while Swahili stays
 * defaulted.
 */

const KEY_PREFIX = "worldRadio.listPrefs.v1:"

export type SortKey = "popular" | "name" | "bitrate" | "country"
export type ViewMode = "list" | "map"

export type LanguagePrefs = {
  sort: SortKey
  view: ViewMode
  tags: string[]
}

const DEFAULTS: LanguagePrefs = {
  sort: "popular",
  view: "list",
  tags: [],
}

function key(corpanCode: string): string {
  return KEY_PREFIX + corpanCode
}

export function loadLanguagePrefs(corpanCode: string): LanguagePrefs {
  try {
    const raw = localStorage.getItem(key(corpanCode))
    if (!raw) return { ...DEFAULTS, tags: [] }
    const parsed = JSON.parse(raw) as Partial<LanguagePrefs>
    return {
      sort: parsed.sort ?? DEFAULTS.sort,
      view: parsed.view ?? DEFAULTS.view,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    }
  } catch (err) {
    console.error("[world-radio] loadLanguagePrefs failed:", err)
    return { ...DEFAULTS, tags: [] }
  }
}

export function saveLanguagePrefs(corpanCode: string, prefs: LanguagePrefs): void {
  try {
    localStorage.setItem(key(corpanCode), JSON.stringify(prefs))
  } catch (err) {
    console.error("[world-radio] saveLanguagePrefs failed:", err)
  }
}
