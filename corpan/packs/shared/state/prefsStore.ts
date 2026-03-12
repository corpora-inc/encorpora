export type PrefsStore<T extends Record<string, unknown>> = {
  load: (bookId: string) => T
  save: (bookId: string, prefs: T) => void
}

/**
 * Create a generic preferences store backed by localStorage.
 *
 * Each reader defines its own prefs type and defaults:
 * - stargate: oscilloscope, waveform, pulseRing configs
 * - earthgate: fontSize, theme, etc.
 *
 * Stored values are deep-merged with defaults so new fields
 * get their default values automatically.
 */
export function createPrefsStore<T extends Record<string, unknown>>(
  prefix: string,
  defaults: T
): PrefsStore<T> {
  function key(bookId: string): string {
    return `${prefix}:${bookId}`
  }

  function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = { ...target }
    for (const k of Object.keys(source)) {
      const sv = source[k]
      const tv = target[k]
      if (
        sv !== null && typeof sv === "object" && !Array.isArray(sv) &&
        tv !== null && typeof tv === "object" && !Array.isArray(tv)
      ) {
        result[k] = deepMerge(tv as Record<string, unknown>, sv as Record<string, unknown>)
      } else {
        result[k] = sv
      }
    }
    return result
  }

  return {
    load(bookId: string): T {
      try {
        const raw = localStorage.getItem(key(bookId))
        if (!raw) return JSON.parse(JSON.stringify(defaults))
        const parsed = JSON.parse(raw)
        return deepMerge(JSON.parse(JSON.stringify(defaults)), parsed) as T
      } catch {
        return JSON.parse(JSON.stringify(defaults))
      }
    },

    save(bookId: string, prefs: T): void {
      try {
        localStorage.setItem(key(bookId), JSON.stringify(prefs))
      } catch {
        // Storage full or unavailable — silently ignore
      }
    },
  }
}
