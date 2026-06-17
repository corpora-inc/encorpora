/**
 * beatlounge — built-in wavetables. Each table is a pair of Fourier
 * coefficient arrays (`real`, `imag`) suitable for AudioContext
 * `createPeriodicWave(real, imag)`. Index 0 is DC (kept 0); index k is the
 * amplitude of the k-th harmonic.
 *
 * Tables are kept small and described by closed-form harmonic recipes so the
 * data stays readable and tiny in git. `buildWavetable` renders a recipe to
 * the coefficient arrays; `WAVETABLES` is the frozen registry the wavetable
 * instrument and presets address by `tableId`.
 */

export interface WavetableData {
  /** Cosine (real) coefficients, index 0 = DC. */
  real: number[]
  /** Sine (imag) coefficients, index 0 = DC. */
  imag: number[]
}

/** A harmonic amplitude recipe: `harmonics[k]` ⇒ amplitude of harmonic (k+1). */
export interface WavetableRecipe {
  id: string
  label: string
  /** Sine-phase amplitudes for harmonics 1..N (index 0 ⇒ fundamental). */
  harmonics: number[]
}

const MAX_HARMONICS = 64

/** Render a recipe into normalized real/imag coefficient arrays. */
export const buildWavetable = (recipe: WavetableRecipe): WavetableData => {
  const n = Math.min(recipe.harmonics.length, MAX_HARMONICS) + 1
  const real = new Array<number>(n).fill(0)
  const imag = new Array<number>(n).fill(0)
  let peak = 0
  for (let k = 1; k < n; k++) {
    const a = recipe.harmonics[k - 1] ?? 0
    imag[k] = a
    peak += Math.abs(a)
  }
  // Normalize so the summed harmonic magnitude is ~1 (avoids clipping the
  // PeriodicWave; the browser also normalizes but we keep recipes comparable).
  if (peak > 0) {
    for (let k = 1; k < n; k++) imag[k] /= peak
  }
  return { real, imag }
}

const sawHarmonics = (count: number): number[] =>
  Array.from({ length: count }, (_, i) => 1 / (i + 1))

const squareHarmonics = (count: number): number[] =>
  Array.from({ length: count }, (_, i) => (i % 2 === 0 ? 1 / (i + 1) : 0))

const organHarmonics = (): number[] => {
  // Drawbar-ish: strong fundamental + octave + fifth, gentle upper partials.
  const drawbars = [1, 0.5, 0.7, 0.4, 0.25, 0.18, 0.12, 0.08, 0.05]
  return drawbars
}

const glassHarmonics = (): number[] => {
  // Inharmonic-leaning bell/glass: sparse odd partials with a bright tail.
  const out = new Array<number>(24).fill(0)
  out[0] = 1
  out[2] = 0.6
  out[4] = 0.35
  out[6] = 0.25
  out[10] = 0.18
  out[14] = 0.1
  out[20] = 0.06
  return out
}

const vocalHarmonics = (): number[] => {
  // Two soft formant bumps for a vowel-ish "aah" timbre.
  const out = new Array<number>(32).fill(0)
  const formant = (center: number, width: number, gain: number) => {
    for (let h = 0; h < out.length; h++) {
      const d = (h + 1 - center) / width
      out[h] += gain * Math.exp(-d * d)
    }
  }
  out[0] = 1
  formant(4, 2.2, 0.8) // ~first formant
  formant(9, 2.8, 0.5) // ~second formant
  return out
}

/** Built-in recipes shipped with the pack. */
export const WAVETABLE_RECIPES: readonly WavetableRecipe[] = [
  { id: "saw", label: "Saw", harmonics: sawHarmonics(32) },
  { id: "square", label: "Square", harmonics: squareHarmonics(32) },
  { id: "organ", label: "Organ", harmonics: organHarmonics() },
  { id: "glass", label: "Glass", harmonics: glassHarmonics() },
  { id: "vocal", label: "Vocal", harmonics: vocalHarmonics() },
] as const

/** id → rendered coefficients. */
export const WAVETABLES: Readonly<Record<string, WavetableData>> = Object.freeze(
  Object.fromEntries(WAVETABLE_RECIPES.map((r) => [r.id, buildWavetable(r)]))
)

export const DEFAULT_WAVETABLE_ID = "saw"

/** Resolve a tableId to coefficients, falling back to the default. */
export const resolveWavetable = (tableId: string): WavetableData =>
  WAVETABLES[tableId] ?? WAVETABLES[DEFAULT_WAVETABLE_ID]
