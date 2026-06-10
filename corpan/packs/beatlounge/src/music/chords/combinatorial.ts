/**
 * beatlounge — SYSTEMATIC combinatorial coverage of the diatonic loop space.
 *
 * The founder's framing: "It's just text data in a finite soup of
 * possibilities." The diatonic 3- and 4-chord loops over a key ARE that finite
 * soup. Here we enumerate it methodically (not by copying any database): every
 * tonic-anchored diatonic loop using the strong functional chords, in major
 * and minor, deduplicated. This is the systematic bulk that pushes the corpus
 * to ~1000 WITHOUT naming a single song — the loops are generic theory objects.
 *
 * We constrain the enumeration to stay MUSICAL and finite:
 *  - Loops start on the tonic (I or i) — the overwhelmingly common case.
 *  - Inner chords are drawn from the functional diatonic set.
 *  - No immediate repeats of the same chord.
 *  - We cap each length's count so no single family dominates the corpus.
 */

import { prog, slug } from "./build"
import type { CorpusChord, CorpusProgression } from "./types"

// MAJOR diatonic triads as authoring chords, by degree.
const MAJ: CorpusChord[] = [
  { degree: 0, quality: "maj", roman: "I" },
  { degree: 1, quality: "min", roman: "ii" },
  { degree: 2, quality: "min", roman: "iii" },
  { degree: 3, quality: "maj", roman: "IV" },
  { degree: 4, quality: "maj", roman: "V" },
  { degree: 5, quality: "min", roman: "vi" },
  { degree: 6, quality: "dim", roman: "vii°" },
]

// MINOR (natural) diatonic triads by degree.
const MIN: CorpusChord[] = [
  { degree: 0, quality: "min", roman: "i" },
  { degree: 1, quality: "dim", roman: "ii°" },
  { degree: 2, quality: "maj", roman: "III" },
  { degree: 3, quality: "min", roman: "iv" },
  { degree: 4, quality: "min", roman: "v" },
  { degree: 5, quality: "maj", roman: "VI" },
  { degree: 6, quality: "maj", roman: "VII" },
]

/**
 * Inner-chord degree pool: every NON-TONIC diatonic degree. vi/VII (deg 5),
 * VII/vii° (deg 6) and the rest are all musically legitimate inner chords of a
 * loop, so the full functional set is enumerated.
 */
const INNER_DEGREES = [1, 2, 3, 4, 5, 6]

/**
 * Degrees with a strong pull BACK to the tonic — a loop's FINAL chord must come
 * from this set so the repeat lands convincingly: V (4), IV (3), ii (1),
 * vii°/VII (6). This trims the combinatorial space to musical loops (and keeps
 * the count balanced) rather than enumerating every tail.
 */
const RETURN_DEGREES = new Set([1, 3, 4, 6])

/**
 * Enumerate tonic-anchored diatonic loops of a given length for one scale set.
 *  - position 0 is always the tonic (degree 0)
 *  - inner positions range over INNER_DEGREES with no immediate repeat
 *  - the FINAL position must be a RETURN_DEGREES chord (strong pull home)
 *  - results are DEDUPED by their roman slug and capped per length so no single
 *    length dominates the corpus.
 *
 * Deterministic: recursion is in fixed ascending-degree order, so ids/counts
 * are stable across runs.
 */
const enumerateLoops = (
  scale: CorpusChord[],
  length: number,
  keyMode: CorpusProgression["mode"],
  modeTag: string,
  cap = Infinity
): CorpusProgression[] => {
  const results: CorpusProgression[] = []
  const seen = new Set<string>()
  const positions = length - 1 // positions after the fixed tonic

  const recurse = (acc: number[]) => {
    if (results.length >= cap) return
    if (acc.length === positions) {
      // The closing chord must pull home.
      if (!RETURN_DEGREES.has(acc[acc.length - 1])) return
      const degrees = [0, ...acc].map((deg) => scale[deg])
      const key = slug(degrees)
      if (seen.has(key)) return
      seen.add(key)
      results.push(
        prog(
          `diatonic:${modeTag}:len${length}:${key}`,
          degrees,
          keyMode,
          "pop-loop",
          ["diatonic", "loop", modeTag, `len${length}`, "systematic"],
          4
        )
      )
      return
    }
    const prev = acc.length === 0 ? 0 : acc[acc.length - 1]
    for (const deg of INNER_DEGREES) {
      if (deg === prev) continue // no immediate repeat
      recurse([...acc, deg])
    }
  }
  recurse([])
  return results
}

/**
 * The full systematic diatonic-loop bank: 3-, 4- and 5-chord tonic-anchored
 * loops in major and minor. Length-5 is capped per scale so it complements
 * (rather than swamps) the shorter, more-common loops.
 */
export const genDiatonicLoops = (): CorpusProgression[] => {
  return [
    ...enumerateLoops(MAJ, 3, "major", "major"),
    ...enumerateLoops(MAJ, 4, "major", "major"),
    ...enumerateLoops(MAJ, 5, "major", "major", 160),
    ...enumerateLoops(MIN, 3, "minor", "minor"),
    ...enumerateLoops(MIN, 4, "minor", "minor"),
    ...enumerateLoops(MIN, 5, "minor", "minor", 160),
  ]
}

/**
 * SEVENTH-CHORD colourings of the diatonic 4-chord loops: the same systematic
 * loops voiced with diatonic sevenths (jazz/neo-soul colour). Generated from
 * the same enumeration so the harmonic content is identical to the triad bank
 * but the quality differs — a distinct, musically-real corpus layer.
 */
const MAJ7: CorpusChord[] = [
  { degree: 0, quality: "maj7", roman: "Imaj7" },
  { degree: 1, quality: "min7", roman: "ii7" },
  { degree: 2, quality: "min7", roman: "iii7" },
  { degree: 3, quality: "maj7", roman: "IVmaj7" },
  { degree: 4, quality: "dom7", roman: "V7" },
  { degree: 5, quality: "min7", roman: "vi7" },
  { degree: 6, quality: "m7b5", roman: "viiø7" },
]
const MIN7: CorpusChord[] = [
  { degree: 0, quality: "min7", roman: "i7" },
  { degree: 1, quality: "m7b5", roman: "iiø7" },
  { degree: 2, quality: "maj7", roman: "IIImaj7" },
  { degree: 3, quality: "min7", roman: "iv7" },
  { degree: 4, quality: "min7", roman: "v7" },
  { degree: 5, quality: "maj7", roman: "VImaj7" },
  { degree: 6, quality: "dom7", roman: "VII7" },
]

export const genDiatonicSeventhLoops = (): CorpusProgression[] => {
  const out: CorpusProgression[] = []
  for (const [scale, mode, tag] of [
    [MAJ7, "major", "major7"],
    [MIN7, "minor", "minor7"],
  ] as const) {
    const loops = enumerateLoops(scale as CorpusChord[], 4, mode, tag)
    for (const p of loops) {
      out.push({
        ...p,
        family: "jazz-turnaround",
        tags: ["diatonic", "loop", "sevenths", tag, "systematic"],
      })
    }
  }
  return out
}
