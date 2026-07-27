import { fmt } from "./glyphs.ts";

/**
 * Turning a `Question` into three lanes.
 *
 * Both places a child ever chooses an answer go through this: the gate arrays
 * out on the causeway and the recharge gate that opens when the voltage runs
 * out. They used to build their options independently, and the two
 * implementations disagreed in ways that mattered — the recharge gate backfilled
 * with `String(Number(answer) + k)`, which is the literal string `NaN` the
 * moment a host answers `3/4` and offers fewer than two distractors.
 *
 * The rules, in order:
 *
 *  1. Prefer the host's own distractors. They are mal-rule outputs — what a
 *     child actually writes when they run the wrong procedure — and they are the
 *     whole reason a wrong lane is not free to reject.
 *  2. Failing that, nudge the answer's own trailing number. `42` gives `43`
 *     and `41`; `3/4` gives `3/5` and `3/3`. Both stay in the shape of the
 *     question rather than becoming a different kind of thing.
 *  3. Failing even that, `?`. Unreachable with any sane host, and it is at least
 *     honestly unanswerable rather than quietly duplicated.
 *
 * Nothing here is float arithmetic and nothing here parses the prompt: the
 * nudge is a decimal-string increment on an integer run, so `999` gives `1000`
 * and never `999.9999999999999`.
 */

/** Anything that can shuffle in place, deterministically. Satisfied by `Rng`. */
export type Shuffler = { shuffle<T>(xs: T[]): T[]; int(lo: number, hi: number): number };

export type LaneOptions = {
  /** What is drawn in lane 0, 1, 2, already typographically normalised. */
  values: [string, string, string];
  /** Which of them is right. */
  correct: number;
};

/** The trailing run of digits in `s`, or null when there is not one. */
function trailingNumber(s: string): { head: string; digits: string } | null {
  const m = /(\d+)$/.exec(s);
  if (!m) return null;
  return { head: s.slice(0, s.length - m[1].length), digits: m[1] };
}

/**
 * `s` with its trailing number moved by `k`, or null if that is not possible.
 *
 * Kept as string arithmetic on a `BigInt` so an answer of any length nudges
 * exactly. A 20-digit answer is not a thing this game asks for, but silently
 * emitting `10000000000000000000` for `9999999999999999999 + 1` would be a lie,
 * and lies are what this file exists to prevent.
 */
export function nudge(s: string, k: number): string | null {
  const t = trailingNumber(s);
  if (!t) return null;
  const v = BigInt(t.digits) + BigInt(k);
  if (v < 0n) return null;
  return `${t.head}${v.toString()}`;
}

/**
 * Three lane values for one question, with the answer in a random lane.
 *
 * @param answer      the true answer, as the host wrote it
 * @param distractors the host's wrong answers, best first
 * @param rng         seeded; the same seed lays out the same gate
 */
export function laneOptions(answer: string, distractors: readonly string[], rng: Shuffler): LaneOptions {
  const right = fmt(answer);
  const seen = new Set<string>([right]);
  const wrong: string[] = [];

  for (const d of rng.shuffle(distractors.slice())) {
    const v = fmt(d);
    if (v === "" || seen.has(v)) continue;
    seen.add(v);
    wrong.push(v);
    if (wrong.length === 2) break;
  }

  for (let k = 1; wrong.length < 2 && k <= 40; k++) {
    for (const cand of [nudge(right, k), nudge(right, -k)]) {
      if (cand === null || seen.has(cand)) continue;
      seen.add(cand);
      wrong.push(cand);
      if (wrong.length === 2) break;
    }
  }

  // Distinct, so a child is never shown the same value in two lanes even in the
  // branch no host should ever reach.
  for (let k = 1; wrong.length < 2; k++) wrong.push("?".repeat(k));

  const correct = rng.int(0, 2);
  const values: [string, string, string] = ["", "", ""];
  let w = 0;
  for (let i = 0; i < 3; i++) values[i] = i === correct ? right : wrong[w++];
  return { values, correct };
}
