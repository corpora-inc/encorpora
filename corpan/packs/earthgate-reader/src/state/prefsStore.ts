const STORAGE_PREFIX = "stargate-reader-prefs"

export type OscilloscopeConfig = { amplitude: number; width: number; alpha: number }
export type WaveformConfig = { maxRadius: number; alpha: number; minRadius: number }
export type PulseRingConfig = { maxRadius: number; fadeMs: number }
export type WordHoldConfig = { holdY: number; zPull: number }

export type DisplayPrefs = {
  oscilloscope: boolean
  waveform: boolean
  pulseRing: boolean
  wordHold: boolean
  oscilloscopeConfig: OscilloscopeConfig
  waveformConfig: WaveformConfig
  pulseRingConfig: PulseRingConfig
  wordHoldConfig: WordHoldConfig
}

const DEFAULTS: DisplayPrefs = {
  oscilloscope: true,
  waveform: true,
  pulseRing: true,
  wordHold: true,
  oscilloscopeConfig: { amplitude: 5, width: 12, alpha: 0.35 },
  waveformConfig: { maxRadius: 1, alpha: 0.005, minRadius: 0 },
  pulseRingConfig: { maxRadius: 1, fadeMs: 200 },
  wordHoldConfig: { holdY: 0, zPull: 0.4 },
}

function key(bookId: string): string {
  return `${STORAGE_PREFIX}:${bookId}`
}

export function loadPrefs(bookId: string): DisplayPrefs {
  try {
    const raw = localStorage.getItem(key(bookId))
    if (!raw) return { ...DEFAULTS, oscilloscopeConfig: { ...DEFAULTS.oscilloscopeConfig }, waveformConfig: { ...DEFAULTS.waveformConfig }, pulseRingConfig: { ...DEFAULTS.pulseRingConfig }, wordHoldConfig: { ...DEFAULTS.wordHoldConfig } }
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULTS,
      ...parsed,
      oscilloscopeConfig: { ...DEFAULTS.oscilloscopeConfig, ...parsed.oscilloscopeConfig },
      waveformConfig: { ...DEFAULTS.waveformConfig, ...parsed.waveformConfig },
      pulseRingConfig: { ...DEFAULTS.pulseRingConfig, ...parsed.pulseRingConfig },
      wordHoldConfig: { ...DEFAULTS.wordHoldConfig, ...parsed.wordHoldConfig },
    }
  } catch {
    return { ...DEFAULTS, oscilloscopeConfig: { ...DEFAULTS.oscilloscopeConfig }, waveformConfig: { ...DEFAULTS.waveformConfig }, pulseRingConfig: { ...DEFAULTS.pulseRingConfig }, wordHoldConfig: { ...DEFAULTS.wordHoldConfig } }
  }
}

export function savePrefs(bookId: string, prefs: DisplayPrefs): void {
  try {
    localStorage.setItem(key(bookId), JSON.stringify(prefs))
  } catch {
    // Storage full or unavailable — silently ignore
  }
}
