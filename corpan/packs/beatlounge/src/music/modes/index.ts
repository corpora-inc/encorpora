/**
 * beatlounge — world-modes corpus: the typed index + lookup.
 *
 * THE single entry point. Aggregates Western modes, the 10 Hindustani thaats,
 * the 72 Carnatic melakartas, and the principal Arabic maqamat into one typed
 * registry keyed by stable id, plus per-family lists and helpers. Every entry is
 * a `Mode` whose `degrees` are EXACT cents-above-tonic — the universal currency
 * consumed by `../tuning.ts` (and, later, the global harmony resolver).
 *
 * Nothing here mutates or imports the legacy scale tables (harmony.ts /
 * ribbonScales.ts / pitchModel.ts) — this is the NEW canonical corpus.
 */

import type { Mode, ModeFamily } from "./types"
import { WESTERN_MODES } from "./western"
import { THAATS } from "./thaats"
import { MELAKARTAS } from "./melakarta"
import { MAQAMAT } from "./maqam"
import { modeCents } from "./types"
import type { ModeCents as TuningModeCents } from "../tuning"

export type { Mode, ModeDegree, ModeFamily, Jins, DegreeRatio } from "./types"
export { modeCents } from "./types"
export { WESTERN_MODES } from "./western"
export { THAATS, THAAT_SHRUTI } from "./thaats"
export { MELAKARTAS, buildMelakarta } from "./melakarta"
export {
  MAQAMAT,
  AJNAS,
  NEUTRAL,
  JINS_RAST,
  JINS_BAYATI,
  JINS_HIJAZ,
  JINS_NAHAWAND,
  JINS_KURD,
  JINS_AJAM,
  JINS_SIKAH,
  JINS_NIKRIZ,
  JINS_SABA,
} from "./maqam"

/** Per-family lists. */
export const MODES_BY_FAMILY: Record<ModeFamily, Mode[]> = {
  western: WESTERN_MODES,
  thaat: THAATS,
  melakarta: MELAKARTAS,
  maqam: MAQAMAT,
}

/** The flat corpus — every mode, all families. */
export const ALL_MODES: Mode[] = [
  ...WESTERN_MODES,
  ...THAATS,
  ...MELAKARTAS,
  ...MAQAMAT,
]

/** id → Mode lookup (the primary index). */
export const MODE_BY_ID: Record<string, Mode> = Object.fromEntries(
  ALL_MODES.map((m) => [m.id, m])
)

/** Lookup a mode by id (exact), returning undefined if unknown. */
export const getMode = (id: string): Mode | undefined => MODE_BY_ID[id]

/**
 * Resolve a mode by id OR any of its aliases / display name (case-insensitive).
 * Returns the first match in corpus order; undefined if none.
 */
export const findMode = (query: string): Mode | undefined => {
  const q = query.trim().toLowerCase()
  if (MODE_BY_ID[query]) return MODE_BY_ID[query]
  return ALL_MODES.find(
    (m) =>
      m.id.toLowerCase() === q ||
      m.name.toLowerCase() === q ||
      (m.aliases ?? []).some((a) => a.toLowerCase() === q)
  )
}

/**
 * Adapt a corpus `Mode` to the `ModeCents` shape `../tuning.ts` consumes
 * (`detuneCentsForMidi`, `quantizeToScale`). Pure projection of the degrees.
 */
export const toModeCents = (m: Mode): TuningModeCents => ({
  degrees: modeCents(m),
})

/** Convenience re-export of the tuning-layer ModeCents shape. */
export type { ModeCents } from "../tuning"

/** Quick corpus census (handy for tests / UI counts). */
export const CORPUS_COUNTS = {
  western: WESTERN_MODES.length,
  thaat: THAATS.length,
  melakarta: MELAKARTAS.length,
  maqam: MAQAMAT.length,
  total: ALL_MODES.length,
} as const
