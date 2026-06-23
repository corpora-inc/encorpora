/**
 * beatlounge — the WORLD-RHYTHMS corpus + operations engine, public surface.
 *
 * `import { RHYTHMS, getRhythm, applyRhythm, varyRhythm } from "../rhythm"`.
 * The corpus (data) and the operations engine (pure functions) are decoupled
 * from any UI so other modules can reuse them.
 */

import { RHYTHMS } from "./corpus"
import type { Rhythm, RhythmFamily } from "./types"

export type {
  Hit,
  Lane,
  Rhythm,
  RhythmFamily,
  Role,
  ScatterStep,
} from "./types"
export { rhythmCells, laneVelocity, hitVelocity } from "./types"

export {
  grooveProfile,
  type GrooveProfile,
  type ProfileCell,
} from "./profile"

export {
  KIT_ROLES,
  kitPitches,
  ROLE_BY_PITCH,
  type KitRole,
  type KitFamily,
} from "./kit"

export {
  ARCHETYPES,
  PROB_CAP,
  weightAt,
  type Archetype,
  type ArchStep,
} from "./archetypes"

export {
  buildWeightTable,
  type KitWeightTable,
  type WeightCell,
} from "./weights"

export {
  generateBeat,
  densityScale,
  tableWeightMass,
  gammaForLevel,
  DENSITY_LEVELS,
  LEVEL1_TARGET_HITS,
  type GenerateOptions,
} from "./generator"

export { RHYTHMS, FAMILY_META } from "./corpus"
export {
  ROLE_MAP,
  KIT_PITCHES,
  resolveRole,
  pitchForRole,
  type RoleMapping,
  type KitPitch,
} from "./roles"

export {
  applyRhythm,
  applyRhythmToPhrases,
  scatterRhythm,
  scatterPhrases,
  chooseHitsToSparsify,
  varyRhythm,
  evolveRhythm,
  randomizeRhythm,
  cellTicks,
  rhythmTicks,
  type NotePlacement,
  type RemovableHit,
  type ApplyOptions,
  type ScatterOptions,
  type ScatterPhrasesOptions,
  type ApplyToPhrasesOptions,
  type PhrasePlacement,
  type RandomizeOptions,
} from "./engine"

// ----------------------------------------------------------------- lookup
/** Index by id for O(1) lookup. */
const BY_ID: ReadonlyMap<string, Rhythm> = new Map(RHYTHMS.map((r) => [r.id, r]))

/** Get a rhythm by id (undefined if unknown). */
export const getRhythm = (id: string): Rhythm | undefined => BY_ID.get(id)

/** All rhythms in a family, in corpus order. */
export const rhythmsByFamily = (family: RhythmFamily): Rhythm[] =>
  RHYTHMS.filter((r) => r.family === family)

/** All distinct families present in the corpus, in corpus order. */
export const families = (): RhythmFamily[] => {
  const seen = new Set<RhythmFamily>()
  const out: RhythmFamily[] = []
  for (const r of RHYTHMS) {
    if (!seen.has(r.family)) {
      seen.add(r.family)
      out.push(r.family)
    }
  }
  return out
}

/** Group the whole corpus by family (picker convenience). */
export const groupedByFamily = (): { family: RhythmFamily; rhythms: Rhythm[] }[] =>
  families().map((family) => ({ family, rhythms: rhythmsByFamily(family) }))
