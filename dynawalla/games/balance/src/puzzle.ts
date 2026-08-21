// The puzzle model.
//
// One idea runs through every kind: the beam is the equals sign. A puzzle is a
// set of torques, and it is solved when the exact rational sum of them is zero.
// Nothing else counts as solved, and nothing rounds.

import type { Frac } from "./frac.ts";
import { ZERO, add, mulInt, isZero, toKey, frac } from "./frac.ts";

export type Side = -1 | 1; // -1 = left, +1 = right

/** A pre-placed thing the player cannot move. A negative value is a balloon: it pulls up. */
export type FixedItem =
  | { kind: "weight"; side: Side; peg: number; value: Frac }
  | { kind: "crate"; side: Side; peg: number };

/** Something the player put there. */
export type PlacedItem = {
  id: string;
  side: Side;
  peg: number;
  value: Frac;
};

export type PuzzleKind =
  /** Add weights to one side until the beam levels. Missing addend, made of brass. */
  | "fill"
  /** Drop a numeral onto the sealed crate to declare what x weighs. */
  | "declare"
  /** Hang one weight on a marked peg so the two moments cancel. Ratio. */
  | "hang";

export type PuzzleSpec = {
  id: string;
  kind: PuzzleKind;
  /** "pans" hangs two dishes at the ends; "beam" exposes numbered pegs along the arm. */
  mode: "pans" | "beam";
  fixed: FixedItem[];
  /** The canonical thing the player must produce. */
  answer: Frac;
  /** What the rack offers. Always more than the puzzle needs. */
  rack: Frac[];
  fillSide: Side | null;
  hangSlot: { side: Side; peg: number } | null;
  /**
   * The answer is *how many* weights were hung, not what they weigh.
   *
   * True only on a measurement-division board — `□ × 15 = 165`, where the rack
   * holds nothing but 15s and eleven of them is the answer. Everything else about
   * such a board is an ordinary `fill`: the beam still levels on exact torque and
   * nothing about the physics changes. The one difference is what gets reported,
   * and it lives here rather than in a fourth `kind` so that every path that
   * already handles `fill` — the drop zone, the spill, the verdict, the clean-solve
   * gem — keeps working without learning a new case.
   */
  countAnswer: boolean;
  /**
   * The thing the child hangs in the dish is a balloon, so the mass they placed is
   * the negative of the answer they were asked for.
   *
   * `8 − □ = 4` is answered **4** and solved by tying a balloon of 4 to the heavy
   * dish. Without this, `answeredKey` reported `-4`, the host's own judge parsed
   * it, `family.check` rejected it, and a child who solved the board was recorded
   * wrong and stepped down the ladder for it.
   */
  fillLifts: boolean;
  prompt: string;
  domain: string;
  difficulty: number;
  movement: number;
  /** Human-readable movement name, engraved on the plinth between movements. */
  movementName: string;
};

export const PAN_PEG = 3; // pans always hang at the same distance, so peg cancels out

/**
 * The names engraved on the plinth as the apparatus changes.
 *
 * They live here rather than in `generate.ts` because both the local ladder and
 * the real host need them, and `generate.ts` is the whole standalone question
 * generator — importing it from the adapter would pull the entire local ladder
 * into the shipped pack bundle to read ten strings.
 */
export const MOVEMENTS: readonly string[] = [
  "First Light",
  "Both Dishes",
  "The Sealed Crate",
  "Identical Crates",
  "The Arm",
  "Crates Facing Crates",
  "Lift",
  "Halves and Quarters",
  "The Long Arm",
  "Sealed and Split",
];

/**
 * What is actually standing in front of the child, indexed by `PuzzleSpec.movement`.
 *
 * `MOVEMENTS` above is a *ladder* of names and it was engraved by dividing the
 * child's difficulty into ten, which meant the plinth announced "IDENTICAL
 * CRATES" and "THE LONG ARM" over boards that had neither — because against the
 * shipped host every board was a plain pair of dishes. The founder played it and
 * said the quiet part: *"'identical' doesn't do much .. you just put the matching
 * weight on the other side."*
 *
 * These names describe objects instead, so the engraving is true by construction
 * and the fanfare fires the first time a child meets a new piece of apparatus
 * rather than every fifth question. The order is the order they are met in.
 */
export const APPARATUS: readonly string[] = [
  "Both Dishes",
  "Lift",
  "Equal Rows",
  "How Many Fit",
  "The Sealed Crate",
  "Identical Crates",
  "Halves and Quarters",
];

function lcm(a: number, b: number): number {
  let x = a;
  let y = b;
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return (a / x) * b;
}

/** Exact net moment: positive means the right side sinks. */
export function netTorque(
  spec: PuzzleSpec,
  placed: readonly PlacedItem[],
  declared: Frac | null,
): Frac {
  let t: Frac = ZERO;
  for (const f of spec.fixed) {
    const v = f.kind === "crate" ? (declared ?? ZERO) : f.value;
    t = add(t, mulInt(v, f.peg * f.side));
  }
  for (const p of placed) {
    t = add(t, mulInt(p.value, p.peg * p.side));
  }
  return t;
}

export function isBalanced(
  spec: PuzzleSpec,
  placed: readonly PlacedItem[],
  declared: Frac | null,
): boolean {
  if (spec.kind === "declare" && declared === null) return false;
  return isZero(netTorque(spec, placed, declared));
}

/** True while an undeclared crate makes the balance indeterminate — the beam stays pinned. */
export function isPinned(spec: PuzzleSpec, declared: Frac | null): boolean {
  return spec.kind === "declare" && declared === null;
}

export function hasCrate(spec: PuzzleSpec): boolean {
  return spec.fixed.some((f) => f.kind === "crate");
}

/** What the player has committed so far, as the canonical answer string. */
export function answeredKey(
  spec: PuzzleSpec,
  placed: readonly PlacedItem[],
  declared: Frac | null,
): string {
  if (spec.kind === "fill") {
    // On a measurement-division board the child's answer is the count. `11` is
    // what the host asked for and `165` is what the brass weighs; reporting the
    // mass would mark every correct answer wrong.
    if (spec.countAnswer) return String(placed.length);
    let sum: Frac = ZERO;
    for (const p of placed) sum = add(sum, p.value);
    // A balloon dish holds negative mass and the host asked for a positive
    // number. See `fillLifts`.
    return toKey(spec.fillLifts ? frac(-sum.n, sum.d) : sum);
  }
  if (spec.kind === "declare") return declared ? toKey(declared) : "";
  return placed.length > 0 ? toKey(placed[placed.length - 1].value) : "";
}

/**
 * The minimum number of rack weights that can make up the answer, for the
 * "clean solve" gem. Small numbers, small rack: exhaustive search is fine.
 */
export function minWeightsForSpec(spec: PuzzleSpec): number {
  // A measurement-division board is solved with `answer` copies of the one weight
  // on the rail, and the answer is a count and not a mass — coin-changing it
  // against the rack returns 1, which would hand a clean-solve gem to a board that
  // takes eleven drags.
  if (spec.countAnswer && spec.answer.d === 1) return Math.abs(spec.answer.n);
  return minWeightsFor(spec.rack, spec.answer);
}

export function minWeightsFor(rack: readonly Frac[], target: Frac): number {
  if (isZero(target)) return 0;

  let L = target.d;
  for (const f of rack) L = lcm(L, f.d);
  const values = rack.map((f) => f.n * (L / f.d));
  const goal = target.n * (L / target.d);
  if (!Number.isInteger(goal) || goal <= 0 || goal > 4096) return 1;
  const best = new Array<number>(goal + 1).fill(Infinity);
  best[0] = 0;
  for (let i = 1; i <= goal; i++) {
    for (const v of values) {
      if (v > 0 && v <= i && best[i - v] + 1 < best[i]) best[i] = best[i - v] + 1;
    }
  }
  return Number.isFinite(best[goal]) ? best[goal] : 1;
}

/**
 * How far the search got on "can this target be made from the rack, using as many
 * copies of each weight as you like": `"yes"` and `"no"` are proofs, `"unknown"` is
 * the search declining to run.
 *
 * **The three values are the point.** This was a `boolean` called `rackCanMake`, and
 * it returned `true` both for "I made it out of the rack" and for "the goal is past
 * my cap and I did not look" — one bit standing for a proof and for the absence of
 * one. Every caller then had to already know which it was holding, and the review
 * that caught it read the optimistic return as a claim that an impossible board is
 * solvable. Nothing was actually wrong at runtime, because both call sites act only
 * on a *proved* `"no"`; but a type that cannot distinguish a proof from an unknown
 * is a type that will eventually be read as the wrong one.
 *
 * Why the optimistic direction is right, and must stay: `verdictFor` reads a proved
 * dead end as *the child made a mistake* — the dish tips, everything comes back, an
 * error is recorded. The shipped ladder reaches `913072 − 884`, so a capped search
 * that answered "no" when it meant "I could not check" charged the founder's own
 * locked room to the child. Not knowing has to fail the safe way. The beam is still
 * telling them the truth either way, and `remainingFor` still says what is missing.
 *
 * The cap is a real limit, not a guess: this is a coin-change table over a common
 * denominator, so it allocates `goal + 1` entries, and `goal` is the answer scaled
 * by the LCM of every denominator on the rack.
 */
export type RackReach = "yes" | "no" | "unknown";

/** Widest coin-change table this will build, in entries. */
const RACK_SEARCH_CAP = 4096;

export function rackReach(rack: readonly Frac[], target: Frac): RackReach {
  if (isZero(target)) return "yes";
  let L = target.d;
  for (const f of rack) L = lcm(L, f.d);
  const goal = Math.abs(target.n) * (L / target.d);
  if (goal <= 0) return "no";
  if (goal > RACK_SEARCH_CAP) return "unknown";
  const sign = target.n < 0 ? -1 : 1;
  const vals = rack
    .filter((f) => f.n !== 0 && (f.n < 0 ? -1 : 1) === sign)
    .map((f) => Math.abs(f.n) * (L / f.d));
  if (vals.length === 0) return "no";
  const ok = new Array<boolean>(goal + 1).fill(false);
  ok[0] = true;
  for (let i = 1; i <= goal; i++) {
    for (const v of vals) {
      if (v <= i && ok[i - v]) {
        ok[i] = true;
        break;
      }
    }
  }
  return ok[goal] ? "yes" : "no";
}

/**
 * How an attempt ended, once a weight has landed.
 *
 * `continue` is the only one that is not an ending: more brass is still on its
 * way to a solution.
 */
export type Verdict = "solved" | "overshot" | "deadEnd" | "continue";

/**
 * Read the board after a weight lands.
 *
 * Extracted from the game so it can be measured. The classification itself is
 * unchanged; what changed is `counts` below.
 */
export function verdictFor(
  spec: PuzzleSpec,
  placed: readonly PlacedItem[],
  declared: Frac | null,
  startNetSign: number,
): Verdict {
  if (isBalanced(spec, placed, declared)) return "solved";
  const net = Math.sign(toNumberSign(netTorque(spec, placed, declared)));
  const crossed = startNetSign !== 0 && net !== 0 && net !== startNetSign;
  if (spec.kind === "hang" || crossed) return "overshot";
  const left = remainingFor(spec, placed);
  // Only a PROVED dead end ends the attempt. `"unknown"` continues: see `rackReach`.
  if (left && rackReach(spec.rack, left) === "no") return "deadEnd";
  return "continue";
}

/**
 * Whether an ending is recorded against the child.
 *
 * **`deadEnd` used to be free, and that is now a lie.** The dish tipping and
 * handing everything back was written for a genuine dead end: a third placed
 * when a half was wanted and no sixth on the rack. Being stuck with no way out
 * is how a puzzle game loses a ten-year-old, so it cost nothing.
 *
 * Then the rack stopped padding from `1, 2, 3, …`. Every weight is now within a
 * band of the answer, so a pick that is merely *too light* leaves a remainder
 * smaller than the smallest disc on the rail and lands here. Measured over two
 * thousand host-shaped boards, 8131 of 16085 wrong picks reached `deadEnd` and
 * 7954 reached `overshot` — so half of every wrong answer in the game would
 * have been recorded as nothing at all: no error, no report, and a *gem* and a
 * ladder-climb at the end of a board that took four guesses. The controller in
 * `pacing.ts` reads errors, so that half would have pushed a floor under a
 * child who was guessing.
 *
 * Too light and too heavy are the same mistake seen from two sides. Both count.
 * Neither is announced any more loudly than it was: the beam still just swings
 * the way you made it swing.
 */
export function counts(v: Verdict): boolean {
  return v === "overshot" || v === "deadEnd";
}

/** `Math.sign` of a rational, without leaving the exact domain to get it. */
function toNumberSign(f: Frac): number {
  return f.n === 0 ? 0 : f.n < 0 ? -1 : 1;
}

/** What still has to go into the dish for the beam to level. */
export function remainingFor(
  spec: PuzzleSpec,
  placed: readonly PlacedItem[],
): Frac | null {
  if (spec.kind !== "fill" || spec.fillSide === null) return null;
  const net = netTorque(spec, placed, null);
  // adding v on the fill side changes net by v * PAN_PEG * fillSide
  return frac(-net.n, net.d * PAN_PEG * spec.fillSide);
}
