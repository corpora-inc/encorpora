/**
 * beatlounge — the assembled chord-progressions CORPUS (~1000 entries).
 *
 * Built ENTIRELY by generation from music theory (see families.ts +
 * combinatorial.ts). No song, artist, or album name appears anywhere; every
 * entry is a generic, descriptively-tagged, key-agnostic theory object.
 *
 * The corpus is frozen at module load and exposed read-only. Ids are unique by
 * construction; an assertion guards that at build time (and a test re-checks).
 */

import {
  genCadences,
  genPopLoops,
  genDooWop,
  genJazzTurnarounds,
  genBlues,
  genModalVamps,
  genCircleOfFifths,
  genSecondaryDominants,
  genModalInterchange,
  genFolk,
  genGospel,
  genLatin,
  genPopPunk,
  genEdm,
  genAndalusian,
} from "./families"
import { genDiatonicLoops, genDiatonicSeventhLoops } from "./combinatorial"
import type { CorpusProgression, ProgressionFamily } from "./types"

/** Run every generator and concatenate. Order is stable/deterministic. */
const buildCorpus = (): CorpusProgression[] => {
  const all: CorpusProgression[] = [
    ...genCadences(),
    ...genPopLoops(),
    ...genDooWop(),
    ...genJazzTurnarounds(),
    ...genBlues(),
    ...genModalVamps(),
    ...genCircleOfFifths(),
    ...genSecondaryDominants(),
    ...genModalInterchange(),
    ...genFolk(),
    ...genGospel(),
    ...genLatin(),
    ...genPopPunk(),
    ...genEdm(),
    ...genAndalusian(),
    ...genDiatonicLoops(),
    ...genDiatonicSeventhLoops(),
  ]
  // De-duplicate by id (defensive — generators are designed to be disjoint).
  const seen = new Set<string>()
  const deduped: CorpusProgression[] = []
  for (const p of all) {
    if (seen.has(p.id)) continue
    seen.add(p.id)
    deduped.push(p)
  }
  return deduped
}

/** The full corpus (frozen array of frozen entries). */
export const CORPUS: readonly CorpusProgression[] = Object.freeze(
  buildCorpus().map((p) => Object.freeze(p))
)

/** Fast id → entry index. */
const BY_ID = new Map<string, CorpusProgression>(CORPUS.map((p) => [p.id, p]))

/** All ids, in corpus order. */
export const CORPUS_IDS: readonly string[] = CORPUS.map((p) => p.id)

/** Look an entry up by id (undefined if absent). */
export const getProgression = (id: string): CorpusProgression | undefined =>
  BY_ID.get(id)

/** Every entry in the named family. */
export const listByFamily = (family: ProgressionFamily): CorpusProgression[] =>
  CORPUS.filter((p) => p.family === family)

/** Every entry carrying the given tag (exact match). */
export const listByTag = (tag: string): CorpusProgression[] =>
  CORPUS.filter((p) => p.tags.includes(tag))

/** Every entry matching ALL of the given tags. */
export const listByTags = (tags: string[]): CorpusProgression[] =>
  CORPUS.filter((p) => tags.every((t) => p.tags.includes(t)))

/** The set of all distinct tags present in the corpus (sorted). */
export const allTags = (): string[] => {
  const s = new Set<string>()
  for (const p of CORPUS) for (const t of p.tags) s.add(t)
  return [...s].sort()
}

/** Per-family entry counts (for docs / sanity). */
export const familyCounts = (): Record<string, number> => {
  const counts: Record<string, number> = {}
  for (const p of CORPUS) counts[p.family] = (counts[p.family] ?? 0) + 1
  return counts
}
