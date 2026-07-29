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
    let sum: Frac = ZERO;
    for (const p of placed) sum = add(sum, p.value);
    return toKey(sum);
  }
  if (spec.kind === "declare") return declared ? toKey(declared) : "";
  return placed.length > 0 ? toKey(placed[placed.length - 1].value) : "";
}

/**
 * The minimum number of rack weights that can make up the answer, for the
 * "clean solve" gem. Small numbers, small rack: exhaustive search is fine.
 */
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
 * Can a target still be made from the rack, using as many copies of each weight
 * as you like? Coin-change over a common denominator, so it is exact.
 */
export function rackCanMake(rack: readonly Frac[], target: Frac): boolean {
  if (isZero(target)) return true;
  let L = target.d;
  for (const f of rack) L = lcm(L, f.d);
  const goal = Math.abs(target.n) * (L / target.d);
  if (goal <= 0 || goal > 4096) return false;
  const sign = target.n < 0 ? -1 : 1;
  const vals = rack
    .filter((f) => f.n !== 0 && (f.n < 0 ? -1 : 1) === sign)
    .map((f) => Math.abs(f.n) * (L / f.d));
  if (vals.length === 0) return false;
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
  return ok[goal];
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
  if (left && !rackCanMake(spec.rack, left)) return "deadEnd";
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
