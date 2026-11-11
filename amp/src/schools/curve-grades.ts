import { z } from "zod";
import {
  allocationSampler,
  curveIssues,
  curveLetters,
  letterBands,
  scaleCurve,
  seededRandom,
  type Allocation,
  type CurveLetter,
  type GradeCurve,
} from "./grade-curve.js";
import {
  compositeScore,
  DEFAULT_GRADE_POLICY,
  letterFor,
  retentionPosterior,
  type Estimate,
  type GradeInput,
  type GradePolicy,
  type GradeSuggestion,
  type StudentLevel,
} from "./grade-policy.js";

/**
 * school-grades-v3: the teacher's curve sets the suggestion.
 *
 * 1. Rank. Every student with enough work has a composite (the four
 *    components at their weights). Its inputs are estimates: each level has an
 *    sd, and a share of reviews right is a few dozen answers. Each draw takes
 *    every level from its normal and the review share from its Beta, scores
 *    the composite, and ranks the class on it.
 * 2. Curve. Each draw also takes how many students each letter holds, from
 *    every allocation the teacher's ranges allow, equally likely. Places go to
 *    letters in rank order.
 * 3. Score. Inside a letter, a student's place sets the score within the band
 *    the school's scale gives that letter: the top A near 100, the last A near
 *    90.
 * 4. Range. Over the draws, the suggestion is the 80% interval of the score,
 *    with its letters, and of the place.
 *
 * The draws are seeded from the inputs, so the same class, curve and evidence
 * give the same suggestion on every read.
 */
export const curvePolicySchema = z.strictObject({
  version: z.string().min(1).max(100),
  draws: z.number().int().min(100).max(20_000),
  /** The middle share of draws a range covers. */
  interval: z.number().min(0.5).max(0.99),
  /** Where an F's band starts: the lowest score a curve gives. */
  failingFloor: z.number().min(0).max(100),
});
export type CurvePolicy = Readonly<z.infer<typeof curvePolicySchema>>;
export const CURVE_POLICY: CurvePolicy = Object.freeze(
  curvePolicySchema.parse({
    version: "school-grades-v3",
    draws: 1000,
    interval: 0.8,
    failingFloor: 50,
  }),
);

export type CurveStudent = {
  id: string;
  input: GradeInput;
  suggestion: GradeSuggestion;
};

function normal(random: () => number): number {
  // Box–Muller; 1 − u keeps the logarithm finite.
  const u = 1 - random(),
    v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
/** Marsaglia–Tsang, boosted below a shape of 1. */
function gamma(shape: number, random: () => number): number {
  if (shape < 1)
    return gamma(shape + 1, random) * Math.pow(1 - random(), 1 / shape);
  const d = shape - 1 / 3,
    c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number, v: number;
    do {
      x = normal(random);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = 1 - random();
    if (Math.log(u) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v;
  }
}
function beta(a: number, b: number, random: () => number): number {
  const x = gamma(a, random),
    y = gamma(b, random);
  return x / (x + y);
}
const drawEstimate = (estimate: Estimate, random: () => number): Estimate => ({
  level: estimate.level + Math.max(0, estimate.sd) * normal(random),
  sd: estimate.sd,
});
const drawLevel = (
  level: StudentLevel,
  random: () => number,
): StudentLevel => ({
  overall: drawEstimate(level.overall, random),
  strands: Object.fromEntries(
    Object.entries(level.strands).map(([id, estimate]) => [
      id,
      drawEstimate(estimate, random),
    ]),
  ),
});

/** Nearest-rank quantiles of a sorted list. */
const lowQuantile = (sorted: readonly number[], share: number) =>
  sorted[Math.floor(share * (sorted.length - 1))]!;
const highQuantile = (sorted: readonly number[], share: number) =>
  sorted[Math.ceil(share * (sorted.length - 1))]!;

/** What the draws are seeded from: everything that changes the answer, in a
 * fixed order. */
function seedOf(
  ranked: readonly CurveStudent[],
  curve: GradeCurve,
  policy: GradePolicy,
  options: CurvePolicy,
): string {
  return JSON.stringify([
    options,
    policy.fingerprint,
    curve,
    ranked.map(({ id, input }) => [
      id,
      input.start,
      input.end,
      input.objectivesGained,
      input.activity,
      input.weeklyTargetMinutes,
      input.classMedianWeeklyMinutes,
      input.enrolled,
      input.course,
      input.gradeLevel,
    ]),
  ]);
}

/** Each ranked student's curved suggestion, by id; students without enough work
 * keep theirs. Null when the curve can't hold the class, so the standard scale
 * stands. Pure and deterministic. */
export function applyCurve(
  students: readonly CurveStudent[],
  curve: GradeCurve,
  policy: GradePolicy = DEFAULT_GRADE_POLICY,
  options: CurvePolicy = CURVE_POLICY,
): Map<string, GradeSuggestion> | null {
  if (curveIssues(curve).length) return null;
  const ranked = students
    .filter(
      (student) =>
        student.suggestion.status === "ready" && student.input.end !== null,
    )
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const size = ranked.length;
  if (!size) return new Map();
  const scaled = scaleCurve(curve, size);
  const sample = allocationSampler(scaled.ranges, size);
  if (!sample) return null;
  const random = seededRandom(seedOf(ranked, curve, policy, options));
  const bands = letterBands(policy.letters, options.failingFloor);
  const posteriors = ranked.map(({ input }) =>
    retentionPosterior(input, policy),
  );
  const places = ranked.map(() => new Array<number>(options.draws));
  const scores = ranked.map(() => new Array<number>(options.draws));
  const letters = ranked.map((): Allocation => ({
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    F: 0,
  }));
  const composite = new Float64Array(size);
  const tie = new Float64Array(size);
  const order = Array.from({ length: size }, (_, index) => index);
  for (let draw = 0; draw < options.draws; draw++) {
    ranked.forEach(({ input }, index) => {
      const posterior = posteriors[index]!;
      composite[index] = compositeScore(
        input,
        {
          start: input.start && drawLevel(input.start, random),
          end: drawLevel(input.end!, random),
          retentionShare: posterior
            ? beta(posterior.right, posterior.wrong, random)
            : null,
        },
        policy,
      );
      // Equal composites share their places evenly.
      tie[index] = random();
    });
    order.sort((a, b) => composite[b]! - composite[a]! || tie[a]! - tie[b]!);
    const allocation = sample(random);
    let place = 0;
    for (const letter of curveLetters) {
      const held = allocation[letter];
      const { bottom, top } = bands[letter];
      for (let within = 0; within < held; within++, place++) {
        const index = order[place]!;
        places[index]![draw] = place + 1;
        scores[index]![draw] = top - ((within + 0.5) / held) * (top - bottom);
        letters[index]![letter] += 1;
      }
    }
  }
  const tail = (1 - options.interval) / 2;
  const result = new Map<string, GradeSuggestion>();
  ranked.forEach(({ id, suggestion }, index) => {
    const sortedPlaces = places[index]!.sort((a, b) => a - b);
    const sortedScores = scores[index]!.sort((a, b) => a - b);
    const low = Math.round(lowQuantile(sortedScores, tail));
    const high = Math.round(highQuantile(sortedScores, 1 - tail));
    const shares = Object.fromEntries(
      curveLetters.map((letter) => [
        letter,
        Math.round((letters[index]![letter] / options.draws) * 1000) / 1000,
      ]),
    ) as Record<CurveLetter, number>;
    result.set(id, {
      ...suggestion,
      low,
      high,
      letterLow: letterFor(low, policy),
      letterHigh: letterFor(high, policy),
      policyVersion: options.version,
      curve: {
        teacher: curve,
        ranked: size,
        rankLow: lowQuantile(sortedPlaces, tail),
        rankHigh: highQuantile(sortedPlaces, 1 - tail),
        letters: shares,
        standard: { low: suggestion.low!, high: suggestion.high! },
      },
    });
  });
  return result;
}
