/**
 * beatlounge — seeded RANDOM selection from the instrument-preset corpus.
 *
 * Used by the "Start fresh → Randomize" flow to pick a fresh synth per voice
 * class (bass / mid / lead). Deterministic from an `Rng` (the pack-standard
 * mulberry32 stream) so a roll is reproducible in tests.
 */

import { type Rng } from "../music/chords/random"
import {
  INSTRUMENT_PRESETS,
  presetsByFamily,
  type InstrumentPreset,
  type PresetFamily,
} from "./presets"

export { type Rng } from "../music/chords/random"

/** Pick a uniformly-random element of a non-empty list using `rng`. */
const pick = <T>(items: readonly T[], rng: Rng): T =>
  items[Math.min(items.length - 1, Math.floor(rng() * items.length))]

/**
 * A random preset from one of the given families (any family if none given).
 * Returns undefined only if no preset matches (e.g. an unknown family).
 */
export const pickRandomPreset = (
  rng: Rng,
  families?: readonly PresetFamily[]
): InstrumentPreset | undefined => {
  const pool = families
    ? INSTRUMENT_PRESETS.filter((p) => families.includes(p.family))
    : INSTRUMENT_PRESETS
  if (pool.length === 0) return undefined
  return pick(pool, rng)
}

/**
 * The three voice CLASSES the randomizer fills — a low end, a mid voice, and a
 * lead. "mid" spreads across keys/pad/pluck/brass so the middle is varied.
 */
export const VOICE_CLASS_FAMILIES = {
  bass: ["bass"],
  mid: ["keys", "pad", "pluck", "brass"],
  lead: ["lead"],
} as const satisfies Record<string, readonly PresetFamily[]>

export type VoiceClass = keyof typeof VOICE_CLASS_FAMILIES

/** Pick a random preset suited to a voice class (bass / mid / lead). */
export const pickRandomPresetForClass = (
  rng: Rng,
  voiceClass: VoiceClass
): InstrumentPreset => {
  const p = pickRandomPreset(rng, VOICE_CLASS_FAMILIES[voiceClass])
  // Every class has presets in the corpus; fall back to any preset defensively.
  return p ?? presetsByFamily()[0].presets[0]
}
