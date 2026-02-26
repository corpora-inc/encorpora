const STORAGE_PREFIX = "stargate-reader-prefs"

export type OscilloscopeConfig = { amplitude: number; width: number; alpha: number }
export type PulseRingConfig = { maxRadius: number; fadeMs: number }
export type WaveformConfig = { maxRadius: number; alpha: number; minRadius: number }

export type DisplayPrefs = {
  oscilloscope: boolean
  waveform: boolean
  pulseRing: boolean
  oscilloscopeConfig: OscilloscopeConfig
  pulseRingConfig: PulseRingConfig
  waveformConfig: WaveformConfig
}

const DEFAULTS: DisplayPrefs = {
  oscilloscope: true,
  waveform: true,
  pulseRing: true,
  oscilloscopeConfig: { amplitude: 23, width: 12, alpha: 0.35 },
  pulseRingConfig: { maxRadius: 1, fadeMs: 200 },
  waveformConfig: { maxRadius: 1, alpha: 0.005, minRadius: 0 },
}

function key(bookId: string): string {
  return `${STORAGE_PREFIX}:${bookId}`
}

export function loadPrefs(bookId: string): DisplayPrefs {
  try {
    const raw = localStorage.getItem(key(bookId))
    if (!raw) return { ...DEFAULTS }
    const saved = JSON.parse(raw)
    return {
      ...DEFAULTS,
      ...saved,
      oscilloscopeConfig: { ...DEFAULTS.oscilloscopeConfig, ...saved.oscilloscopeConfig },
      pulseRingConfig: { ...DEFAULTS.pulseRingConfig, ...saved.pulseRingConfig },
      waveformConfig: { ...DEFAULTS.waveformConfig, ...saved.waveformConfig },
    }
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
