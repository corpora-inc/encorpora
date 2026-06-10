/**
 * beatlounge — the DRUM-KIT corpus, public surface (the 4th corpus).
 *
 * `import { KITS, getKit, listKits, kitsByFamily, resolveKit } from "../kits"`.
 *
 * The corpus (data, ./corpus) and the resolve/merge helpers (pure, here) are
 * decoupled from any UI and from Tone, so the parametric synth, the picker, and
 * the tests all consume the same pure surface.
 */

import { KITS, FAMILY_ORDER } from "./corpus"
import { DEFAULT_KIT, DEFAULT_KIT_ID, DEFAULT_VOICES } from "./defaultKit"
import { VOICE_ROLES } from "./types"
import type {
  KitDef,
  KitFamily,
  ResolvedKit,
  VoiceParams,
  VoiceRole,
} from "./types"

export type {
  KitDef,
  KitFamily,
  KitFamilyMeta,
  ResolvedKit,
  VoiceParams,
  VoiceRole,
  Envelope,
  VoiceFilter,
  VoiceSource,
  VoicePartial,
  BodyLayer,
  OscType,
  NoiseType,
  FilterType,
} from "./types"

export { VOICE_ROLES } from "./types"
export { KITS, FAMILY_META, FAMILY_ORDER } from "./corpus"
export { DEFAULT_KIT, DEFAULT_KIT_ID, DEFAULT_VOICES } from "./defaultKit"
export {
  PITCH_TO_ROLE,
  ROLE_TO_PITCH,
  roleForPitch,
} from "./voiceForPitch"

// ----------------------------------------------------------------- lookup
const BY_ID: ReadonlyMap<string, KitDef> = new Map(KITS.map((k) => [k.id, k]))

/** Get a kit by id (undefined if unknown). */
export const getKit = (id: string): KitDef | undefined => BY_ID.get(id)

/** Every kit in corpus order. */
export const listKits = (): readonly KitDef[] => KITS

/** All kits in a family, in corpus order. */
export const kitsByFamily = (family: KitFamily): KitDef[] =>
  KITS.filter((k) => k.family === family)

/** Kits grouped by family, in family display order (picker-ready). */
export const kitsGroupedByFamily = (): { family: KitFamily; kits: KitDef[] }[] =>
  FAMILY_ORDER.map((family) => ({ family, kits: kitsByFamily(family) })).filter(
    (g) => g.kits.length > 0
  )

// ----------------------------------------------------------------- resolve
/**
 * Complete a (possibly partial) kit by filling every unspecified voice from the
 * default kit. The result has EVERY VoiceRole defined, so no pad is ever silent.
 * Pure + structural-share-free (returns a fresh voices object).
 */
export const resolveKit = (kit: KitDef): ResolvedKit => {
  const voices = {} as Record<VoiceRole, VoiceParams>
  for (const role of VOICE_ROLES) {
    voices[role] = kit.voices[role] ?? DEFAULT_VOICES[role]
  }
  return { ...kit, voices }
}

/**
 * Resolve a kit by id, falling back to the default kit for an unknown / missing
 * id (noisy-not-silent: warns once on an unknown id so the corpus can add it).
 * This is the entry point the parametric synth calls with `config.kitId`.
 */
export const resolveKitId = (id: string | undefined): ResolvedKit => {
  if (!id) return resolveKit(DEFAULT_KIT)
  const kit = BY_ID.get(id)
  if (!kit) {
    console.warn(
      `[beatlounge/kits] unknown kitId "${id}" — falling back to "${DEFAULT_KIT_ID}"; add it to kits/corpus.ts`
    )
    return resolveKit(DEFAULT_KIT)
  }
  return resolveKit(kit)
}
