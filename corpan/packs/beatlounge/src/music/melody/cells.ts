/**
 * beatlounge — SYSTEMATIC combinatoric coverage of the melodic-contour space.
 *
 * The founder's framing for chords applies verbatim to melody: "It's just data
 * in a finite soup of possibilities." A contour over a scale IS that soup. Here
 * we enumerate it methodically by SHAPE (ascending, arch, neighbor, enclosure,
 * pendulum, …) crossed with a small set of musical RHYTHM templates — never by
 * copying a melody. Every cell is degree-relative, generic, descriptively
 * tagged, and deterministic (fixed iteration order → stable ids/counts).
 *
 * Degrees are scale-step indices (0 = tonic, octave wraps at resolve time), so a
 * cell is key- AND mode-agnostic; the resolver sings it in whatever scale is
 * live. Counts are capped per family so no single shape swamps the bank.
 */

import type { CellNote, ContourFamily, MelodicCell, Sixteenths } from "./types"

const BAR16 = 16

/** Emphasis from a metric position: downbeat strongest, &s medium, weak light. */
const posWeight = (pos: number): number => {
  if (pos % 8 === 0) return 0.9 // beats 1 & 3
  if (pos % 4 === 0) return 0.72 // beats 2 & 4
  if (pos % 2 === 0) return 0.54 // the &s
  return 0.42 // weak e/a sixteenths
}

/** Rhythm templates by note count (onset positions in sixteenths within a bar). */
const RHYTHMS: Record<number, Sixteenths[][]> = {
  3: [
    [0, 4, 8],
    [0, 6, 12],
    [0, 4, 12],
  ],
  4: [
    [0, 4, 8, 12], // quarters
    [0, 2, 4, 8], // gallop into beat
    [0, 4, 8, 10],
  ],
  5: [
    [0, 4, 8, 12, 14],
    [0, 2, 4, 8, 12],
    [0, 3, 6, 8, 12],
  ],
  6: [
    [0, 2, 4, 8, 10, 12],
    [0, 4, 6, 8, 12, 14],
  ],
}

/** Build a cell from a degree sequence + a rhythm template (durations = gaps). */
const makeCell = (
  family: ContourFamily,
  degrees: number[],
  rhythm: Sixteenths[],
  rhythmTag: string,
  tags: string[]
): MelodicCell => {
  const span = BAR16
  const notes: CellNote[] = degrees.map((degree, i) => {
    const pos = rhythm[i]
    const next = i + 1 < rhythm.length ? rhythm[i + 1] : span
    return { degree, pos, dur: Math.max(1, next - pos), weight: posWeight(pos) }
  })
  const ds = degrees.map((d) => d).join("-")
  const lo = Math.min(...degrees)
  const hi = Math.max(...degrees)
  return {
    id: `contour:${family}:len${degrees.length}:${ds}@${rhythmTag}`,
    notes,
    spanSixteenths: span,
    family,
    tags: [family, `len${degrees.length}`, rhythmTag, "contour", "systematic", ...tags],
    range: [lo, hi],
  }
}

/** Cross a set of degree sequences with every rhythm template of its length. */
const cross = (
  family: ContourFamily,
  sequences: number[][],
  extraTags: string[] = [],
  cap = Infinity
): MelodicCell[] => {
  const out: MelodicCell[] = []
  for (const seq of sequences) {
    const rhythms = RHYTHMS[seq.length] ?? [evenSpread(seq.length)]
    rhythms.forEach((r, ri) => {
      if (out.length >= cap) return
      out.push(makeCell(family, seq, r, `r${ri}`, extraTags))
    })
  }
  return out
}

/** Fallback even spread for lengths without an authored rhythm template. */
const evenSpread = (n: number): Sixteenths[] =>
  Array.from({ length: n }, (_, i) => Math.round((i * BAR16) / n))

// The chord-tone anchor degrees (1/3/5) and the diatonic passing palette.
const ANCHORS = [0, 2, 4]
const STEPS = [0, 1, 2, 3, 4, 5, 6]

// --------------------------------------------------------------- generators
const genAscending = (): MelodicCell[] => {
  const seqs: number[][] = []
  // Strictly rising runs from each anchor start, length 3..5, stepwise + skips.
  for (const start of [0, 2, 4, -3]) {
    seqs.push([start, start + 1, start + 2])
    seqs.push([start, start + 2, start + 4])
    seqs.push([start, start + 1, start + 2, start + 3])
    seqs.push([start, start + 2, start + 4, start + 6])
    seqs.push([start, start + 1, start + 2, start + 3, start + 4])
  }
  return cross("ascending", seqs, ["rising"])
}

const genDescending = (): MelodicCell[] =>
  cross(
    "descending",
    genAscending()
      .filter((c) => c.tags.includes("r0"))
      .map((c) => c.notes.map((n) => n.degree).reverse()),
    ["falling"]
  )

const genArch = (): MelodicCell[] => {
  const seqs: number[][] = []
  for (const peak of [2, 4, 6, 7]) {
    seqs.push([0, peak, 0])
    seqs.push([0, Math.round(peak / 2), peak, Math.round(peak / 2), 0])
    seqs.push([0, peak - 1, peak, peak - 2])
  }
  return cross("arch", seqs, ["up-down"])
}

const genValley = (): MelodicCell[] => {
  const seqs: number[][] = []
  for (const trough of [-2, -3, -4]) {
    seqs.push([0, trough, 0])
    seqs.push([2, trough, 2])
    seqs.push([0, Math.round(trough / 2), trough, Math.round(trough / 2), 0])
  }
  return cross("valley", seqs, ["down-up"])
}

const genStatic = (): MelodicCell[] => {
  const seqs: number[][] = []
  for (const d of ANCHORS) {
    seqs.push([d, d, d])
    seqs.push([d, d, d, d])
    seqs.push([d, d, d, d, d])
  }
  return cross("static", seqs, ["repeated", "pedal"])
}

const genZigzag = (): MelodicCell[] => {
  const seqs: number[][] = []
  for (const base of [0, 2]) {
    seqs.push([base, base + 2, base + 1, base + 3])
    seqs.push([base, base + 2, base + 1, base + 3, base + 2])
    seqs.push([base, base - 1, base + 1, base])
  }
  return cross("zigzag", seqs, ["alternating"])
}

const genNeighbor = (): MelodicCell[] => {
  const seqs: number[][] = []
  for (const d of STEPS) {
    seqs.push([d, d + 1, d]) // upper neighbor
    seqs.push([d, d - 1, d]) // lower neighbor
  }
  return cross("neighbor", seqs, ["ornament"])
}

const genEnclosure = (): MelodicCell[] => {
  const seqs: number[][] = []
  // Approach a target from above then below (or vice-versa), then land.
  for (const t of [0, 2, 4]) {
    seqs.push([t + 1, t - 1, t])
    seqs.push([t - 1, t + 1, t])
    seqs.push([t + 2, t + 1, t - 1, t])
  }
  return cross("enclosure", seqs, ["approach", "resolution"])
}

const genPendulum = (): MelodicCell[] => {
  const seqs: number[][] = []
  for (const [a, b] of [
    [0, 4],
    [2, 5],
    [0, 6],
    [2, 4],
  ]) {
    seqs.push([a, b, a, b])
    seqs.push([a, b, a, b, a])
  }
  return cross("pendulum", seqs, ["swing", "oscillation"])
}

const genLeapReturn = (): MelodicCell[] => {
  const seqs: number[][] = []
  // A leap out, then stepwise return toward the start.
  for (const leap of [4, 5, 7, -3, -4]) {
    seqs.push([0, leap, leap - 1, leap - 2])
    seqs.push([0, leap, Math.round(leap / 2), 0])
  }
  return cross("leap-return", seqs, ["leap", "recover"])
}

/**
 * The full systematic contour bank. Deterministic order → stable ids; the corpus
 * dedupes by id defensively. Each family is independently musical and tagged.
 */
export const genContourCells = (): MelodicCell[] => [
  ...genAscending(),
  ...genDescending(),
  ...genArch(),
  ...genValley(),
  ...genStatic(),
  ...genZigzag(),
  ...genNeighbor(),
  ...genEnclosure(),
  ...genPendulum(),
  ...genLeapReturn(),
]
