const STORAGE_PREFIX = "stargate-reader-prefs"

export type DisplayPrefs = {
  oscilloscope: boolean
  waveform: boolean
}

const DEFAULTS: DisplayPrefs = {
  oscilloscope: true,
  waveform: true,
}

function key(bookId: string): string {
  return `${STORAGE_PREFIX}:${bookId}`
}

export function loadPrefs(bookId: string): DisplayPrefs {
  try {
    const raw = localStorage.getItem(key(bookId))
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function savePrefs(bookId: string, prefs: DisplayPrefs): void {
  try {
    localStorage.setItem(key(bookId), JSON.stringify(prefs))
  } catch {
    // Storage full or unavailable — silently ignore
  }
}
