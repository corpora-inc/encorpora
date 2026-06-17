/**
 * beatlounge — the assembled MELODY corpus: contour cells + probability banks.
 *
 * Built ENTIRELY by generation from music theory (cells.ts) plus hand-tuned
 * generic weight tables (weights.ts). No song/artist/album name appears
 * anywhere; every entry is a generic, descriptively-tagged, key-agnostic theory
 * object. Frozen at module load and exposed read-only; ids are unique by
 * construction (a test re-checks).
 */

import { genContourCells } from "./cells"
import { METRIC_PROFILES, TRANSITION_TABLES } from "./weights"
import type {
  ContourFamily,
  MelodicCell,
  MelodyCorpus,
  MetricProfile,
  TransitionTable,
} from "./types"

/** Run the contour generator and de-dup by id (defensive). */
const buildCells = (): MelodicCell[] => {
  const seen = new Set<string>()
  const out: MelodicCell[] = []
  for (const c of genContourCells()) {
    if (seen.has(c.id)) continue
    seen.add(c.id)
    out.push(Object.freeze({ ...c, notes: Object.freeze(c.notes) }) as MelodicCell)
  }
  return out
}

/** The full contour-cell bank (frozen array of frozen cells). */
export const CELLS: readonly MelodicCell[] = Object.freeze(buildCells())

const CELL_BY_ID = new Map<string, MelodicCell>(CELLS.map((c) => [c.id, c]))

/** All cell ids, in corpus order. */
export const CELL_IDS: readonly string[] = CELLS.map((c) => c.id)

/** The whole corpus as one object (cells + the two probability banks). */
export const MELODY_CORPUS: MelodyCorpus = Object.freeze({
  cells: CELLS,
  metric: METRIC_PROFILES,
  transitions: TRANSITION_TABLES,
})

/** Look a cell up by id (undefined if absent). */
export const getCell = (id: string): MelodicCell | undefined => CELL_BY_ID.get(id)

/** Every cell in the named contour family. */
export const cellsByFamily = (family: ContourFamily): MelodicCell[] =>
  CELLS.filter((c) => c.family === family)

/** Every cell carrying the given tag (exact match). */
export const cellsByTag = (tag: string): MelodicCell[] =>
  CELLS.filter((c) => c.tags.includes(tag))

/** Per-family cell counts (for docs / sanity). */
export const cellFamilyCounts = (): Record<string, number> => {
  const counts: Record<string, number> = {}
  for (const c of CELLS) counts[c.family] = (counts[c.family] ?? 0) + 1
  return counts
}

/** The set of all distinct cell tags present (sorted). */
export const allCellTags = (): string[] => {
  const s = new Set<string>()
  for (const c of CELLS) for (const t of c.tags) s.add(t)
  return [...s].sort()
}

/** Look a metric profile up by id (or short name). */
export const getMetric = (idOrName: string): MetricProfile | undefined =>
  METRIC_PROFILES.find((m) => m.id === idOrName || m.id === `metric:${idOrName}`)

/** Look a transition table up by id (or short name). */
export const getTransition = (idOrName: string): TransitionTable | undefined =>
  TRANSITION_TABLES.find((t) => t.id === idOrName || t.id === `transition:${idOrName}`)
