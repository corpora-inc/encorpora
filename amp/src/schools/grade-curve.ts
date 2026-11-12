import { z } from "zod";

/**
 * The teacher's curve: for a class of `size`, how many students they expect at
 * each letter, as a low and a high. It is the biggest input to a curved
 * suggestion (`curve-grades.ts`): AMP ranks the class on its composite, and the
 * curve says how many places each letter holds.
 *
 * Pure and free of Node, so the Grades tab validates and previews a curve with
 * the same code the server ranks with.
 */
export const curveLetters = ["A", "B", "C", "D", "F"] as const;
export type CurveLetter = (typeof curveLetters)[number];
/** The largest class a curve is set for. */
export const MAXIMUM_CURVE_SIZE = 1000;

const count = z.number().int().min(0).max(MAXIMUM_CURVE_SIZE);
const span = z.tuple([count, count]);
export const curveRangesSchema = z.strictObject({
  A: span,
  B: span,
  C: span,
  D: span,
  F: span,
});
export type CurveRanges = z.infer<typeof curveRangesSchema>;
export const gradeCurveSchema = z.strictObject({
  size: z.number().int().min(1).max(MAXIMUM_CURVE_SIZE),
  ranges: curveRangesSchema,
});
export type GradeCurve = z.infer<typeof gradeCurveSchema>;

export type CurveIssue =
  | { kind: "order"; letter: CurveLetter }
  | { kind: "over"; letter: CurveLetter; size: number }
  | { kind: "lows"; total: number; size: number }
  | { kind: "highs"; total: number; size: number };

/** Why a curve can't hold its class: a low above its high, a high above the
 * class, or lows and highs that no count of students can satisfy. Empty when
 * the ranges can sum to the class size. */
export function curveIssues(curve: GradeCurve): CurveIssue[] {
  const issues: CurveIssue[] = [];
  let lows = 0,
    highs = 0;
  for (const letter of curveLetters) {
    const [low, high] = curve.ranges[letter];
    if (low > high) issues.push({ kind: "order", letter });
    if (high > curve.size)
      issues.push({ kind: "over", letter, size: curve.size });
    lows += low;
    highs += high;
  }
  if (lows > curve.size)
    issues.push({ kind: "lows", total: lows, size: curve.size });
  if (highs < curve.size)
    issues.push({ kind: "highs", total: highs, size: curve.size });
  return issues;
}
export const isValidCurve = (curve: GradeCurve) =>
  curveIssues(curve).length === 0;

const students = (count: number) =>
  `${count} ${count === 1 ? "student" : "students"}`;
/** What's wrong, and what to change. */
export function curveIssueText(issue: CurveIssue): string {
  switch (issue.kind) {
    case "order":
      return `${issue.letter}’s fewest is above its most.`;
    case "over":
      return `${issue.letter}’s most is more than the ${students(issue.size)}.`;
    case "lows":
      return `The fewest add to ${issue.total}, ${issue.total - issue.size} more than the ${students(issue.size)}. Lower one.`;
    case "highs":
      return `The most add to ${issue.total}, ${issue.size - issue.total} short of the ${students(issue.size)}. Raise one.`;
  }
}

/** The same curve for a class of `size`: lows round down and highs round up,
 * so a curve that could hold its class still can. */
export function scaleCurve(curve: GradeCurve, size: number): GradeCurve {
  if (size === curve.size) return curve;
  const scale = size / curve.size;
  const ranges = Object.fromEntries(
    curveLetters.map((letter) => {
      const [low, high] = curve.ranges[letter];
      return [
        letter,
        [
          Math.min(size, Math.floor(low * scale + 1e-9)),
          Math.min(size, Math.ceil(high * scale - 1e-9)),
        ],
      ];
    }),
  ) as CurveRanges;
  return { size, ranges };
}

/** `ways[k][s]`: how many allocations give letters k onward exactly s students.
 * Every allocation the ranges allow is equally likely. */
function suffixWays(ranges: CurveRanges, size: number): Float64Array[] {
  const ways = Array.from(
    { length: curveLetters.length + 1 },
    () => new Float64Array(size + 1),
  );
  ways[curveLetters.length]![0] = 1;
  for (let k = curveLetters.length - 1; k >= 0; k--) {
    const [low, high] = ranges[curveLetters[k]!];
    const next = ways[k + 1]!;
    const here = ways[k]!;
    for (let s = 0; s <= size; s++) {
      let total = 0;
      for (let b = low; b <= Math.min(high, s); b++) total += next[s - b]!;
      here[s] = total;
    }
  }
  return ways;
}

export type Allocation = Record<CurveLetter, number>;
export type AllocationSampler = (random: () => number) => Allocation;
/** Draws allocations of `size` students to letters, uniformly among those the
 * ranges allow. Null when none can. */
export function allocationSampler(
  ranges: CurveRanges,
  size: number,
): AllocationSampler | null {
  const ways = suffixWays(ranges, size);
  if (!(ways[0]![size]! > 0)) return null;
  return (random) => {
    const allocation = {} as Allocation;
    let left = size;
    curveLetters.forEach((letter, k) => {
      const [low, high] = ranges[letter];
      const next = ways[k + 1]!;
      let pick = random() * ways[k]![left]!;
      let chosen = low;
      for (let b = low; b <= Math.min(high, left); b++) {
        const weight = next[left - b]!;
        if (weight <= 0) continue;
        chosen = b;
        if (pick < weight) break;
        pick -= weight;
      }
      allocation[letter] = chosen;
      left -= chosen;
    });
    return allocation;
  };
}

/** For each place in the ranking, best first, the chance of each letter when
 * every allocation the ranges allow is equally likely: the curve as a picture.
 * Null when the ranges can't hold the class. */
export function placeOdds(
  ranges: CurveRanges,
  size: number,
): Allocation[] | null {
  const after = suffixWays(ranges, size);
  const total = after[0]![size]!;
  if (!(total > 0)) return null;
  // before[s]: ways the letters so far take exactly s students.
  let before = new Float64Array(size + 1);
  before[0] = 1;
  const odds: Allocation[] = Array.from({ length: size }, () => ({
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    F: 0,
  }));
  curveLetters.forEach((letter, k) => {
    const [low, high] = ranges[letter];
    const rest = after[k + 1]!;
    // Each (start, count) covers places start .. start+count−1.
    const diff = new Float64Array(size + 1);
    const nextBefore = new Float64Array(size + 1);
    for (let start = 0; start <= size; start++) {
      const ways = before[start]!;
      if (!ways) continue;
      for (let b = low; b <= Math.min(high, size - start); b++) {
        nextBefore[start + b]! += ways;
        const weight = ways * rest[size - start - b]!;
        if (!weight || !b) continue;
        diff[start]! += weight;
        diff[start + b]! -= weight;
      }
    }
    let running = 0;
    for (let place = 0; place < size; place++) {
      running += diff[place]!;
      odds[place]![letter] = running / total;
    }
    before = nextBefore;
  });
  return odds;
}

/** A starting curve from what the class's work already shows: each student's
 * letter on the standard scale, widened by about a tenth of the class each way.
 * A class with no letters yet starts from a common spread. */
export function defaultCurve(
  letters: readonly CurveLetter[],
  size: number,
): GradeCurve {
  const common: Allocation = { A: 0.25, B: 0.35, C: 0.25, D: 0.1, F: 0.05 };
  const shares = { ...common };
  if (letters.length) {
    for (const letter of curveLetters) shares[letter] = 0;
    for (const letter of letters) shares[letter] += 1 / letters.length;
  }
  // Largest remainder, so the expected counts add to the class.
  const exact = curveLetters.map((letter) => shares[letter] * size);
  const counts = exact.map(Math.floor);
  let short = size - counts.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, rest: value - Math.floor(value) }))
    .sort((a, b) => b.rest - a.rest || a.index - b.index);
  for (const { index } of order) {
    if (short <= 0) break;
    counts[index]! += 1;
    short -= 1;
  }
  const width = Math.max(1, Math.round(size / 10));
  const ranges = Object.fromEntries(
    curveLetters.map((letter, index) => [
      letter,
      [
        Math.max(0, counts[index]! - width),
        Math.min(size, counts[index]! + width),
      ],
    ]),
  ) as CurveRanges;
  return { size, ranges };
}

export type LetterBand = { bottom: number; top: number };
/** The out-of-100 band each letter holds on the school's scale: A from the
 * lowest A− up to 100, and so on down; F from `failingFloor`. */
export function letterBands(
  letters: readonly { letter: string; min: number }[],
  failingFloor: number,
): Record<CurveLetter, LetterBand> {
  const bottoms = Object.fromEntries(
    curveLetters.map((family) => [
      family,
      Math.min(
        ...letters
          .filter((entry) => entry.letter.startsWith(family))
          .map((entry) => entry.min),
      ),
    ]),
  ) as Record<CurveLetter, number>;
  const bands = {} as Record<CurveLetter, LetterBand>;
  let top = 100;
  for (const family of curveLetters) {
    const bottom =
      family === "F" ? Math.min(failingFloor, top) : bottoms[family];
    bands[family] = { bottom, top };
    top = bottom;
  }
  return bands;
}

/** A letter's family: "B+" is a B. */
export function letterFamily(letter: string): CurveLetter | null {
  const family = letter[0];
  return (curveLetters as readonly string[]).includes(family ?? "")
    ? (family as CurveLetter)
    : null;
}

/** A small, fast generator from a string: the same seed gives the same draws
 * on every machine (cyrb128 into sfc32). */
export function seededRandom(seed: string): () => number {
  let h1 = 1779033703,
    h2 = 3144134277,
    h3 = 1013904242,
    h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  let a = (h1 ^ h2 ^ h3 ^ h4) >>> 0,
    b = (h2 ^ h1) >>> 0,
    c = (h3 ^ h1) >>> 0,
    d = (h4 ^ h1) >>> 0;
  const next = () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    const t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    const out = (t + d) | 0;
    c = (c + out) | 0;
    return (out >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; i++) next();
  return next;
}

const ordinal = (n: number) => {
  const tens = n % 100;
  const suffix =
    tens >= 11 && tens <= 13
      ? "th"
      : (({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ??
        "th");
  return `${n}${suffix}`;
};
const article = (letter: string) => (/^[AEF]/.test(letter) ? "an" : "a");

/** A curved suggestion in one clinical sentence: "Ranks 4th to 9th of 24 on
 * the composite; your curve gives that band an A− to B+." */
export function curveSentence({
  rankLow,
  rankHigh,
  ranked,
  letterHigh,
  letterLow,
}: {
  rankLow: number;
  rankHigh: number;
  ranked: number;
  letterHigh: string;
  letterLow: string;
}): string {
  const places =
    rankLow === rankHigh
      ? `${ordinal(rankLow)} of ${ranked}`
      : `${ordinal(rankLow)} to ${ordinal(rankHigh)} of ${ranked}`;
  const letters =
    letterHigh === letterLow ? letterHigh : `${letterHigh} to ${letterLow}`;
  return `Ranks ${places} on the composite; your curve gives that ${rankLow === rankHigh ? "place" : "band"} ${article(letterHigh)} ${letters}.`;
}
