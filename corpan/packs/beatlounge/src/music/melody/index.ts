/**
 * beatlounge — MELODY corpus + pure generation API (public surface).
 *
 * A key- AND mode-agnostic, IP-safe library of melodic contour cells plus the
 * metric-onset and degree-transition weight banks that drive endless, non-
 * repeating, LLM-free melody generation. Degrees resolve against `doc.harmony`
 * through `../resolver.ts`; nothing here touches the document model, audio, or
 * UI. The score's +/− "layer" dial and the auto-play mode consume it.
 *
 * This is a FOUNDATION module (see docs/MELODY_CORPUS.md).
 */

// Schema + taxonomy
export type {
  Sixteenths,
  CellNote,
  ContourFamily,
  MelodicCell,
  MetricProfile,
  TransitionTable,
  MelodyCorpus,
} from "./types"
export { CONTOUR_FAMILIES } from "./types"

// The probability banks
export { METRIC_PROFILES, TRANSITION_TABLES } from "./weights"

// The assembled corpus + lookup/listing API
export {
  CELLS,
  CELL_IDS,
  MELODY_CORPUS,
  getCell,
  cellsByFamily,
  cellsByTag,
  cellFamilyCounts,
  allCellTags,
  getMetric,
  getTransition,
} from "./corpus"

// Pure generation + the degree→pitch bridge
export {
  degreeToPitch,
  generateMelody,
  transposeCell,
  cellToNotes,
} from "./generate"
export type {
  MelodyNote,
  ResolvedPitch,
  GenerateOpts,
} from "./generate"
