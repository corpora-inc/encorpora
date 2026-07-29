// Question -> apparatus.
//
// The stub host attaches a fully-built `PuzzleSpec`. A foreign host will not,
// so this file can also *read a prompt* and build a board from it. The grammar
// is small and total: sums of numerals, fractions, unknowns and one blank, with
// or without an equals sign. `15 − 8` with answer `7` becomes a dish holding a
// 15 and a balloon marked −8, and an empty dish to fill. That is why the swap to
// the shared package later is mechanical: the game never needed anything the
// contract does not already carry.

import type { Question } from "./contract.ts";
import type { Frac } from "./frac.ts";
import { frac, parseFrac, toKey, toNumber, isPositive } from "./frac.ts";
import type { FixedItem, PuzzleSpec, Side } from "./puzzle.ts";
import { MOVEMENTS, PAN_PEG } from "./puzzle.ts";
import { makeRng, seedFromString } from "./rng.ts";
import type { Rng } from "./rng.ts";

export type QuestionWithSpec = Question & { spec?: PuzzleSpec };

type Term =
  | { t: "value"; value: Frac }
  | { t: "crate"; count: number }
  | { t: "blank" };

const MINUS = /[−–—-]/;

function tokenizeSide(sideText: string): Term[] {
  const cleaned = sideText
    .replace(/([+×*−–—-])/g, " $1 ")
    .replace(/\s+/g, " ")
    .trim();
  const out: Term[] = [];
  let sign = 1;
  let i = 0;
  const parts = cleaned.split(" ");
  while (i < parts.length) {
    const p = parts[i];
    if (p === "+") {
      sign = 1;
      i++;
      continue;
    }
    if (MINUS.test(p) && p.length === 1) {
      sign = -1;
      i++;
      continue;
    }
    // product form "6 × 2" collapses to a single 12
    if (i + 2 < parts.length && (parts[i + 1] === "×" || parts[i + 1] === "*")) {
      const a = parseFrac(p);
      const b = parseFrac(parts[i + 2]);
      if (a && b && a.d === 1 && b.d === 1) {
        out.push({ t: "value", value: frac(sign * a.n * b.n) });
        sign = 1;
        i += 3;
        continue;
      }
    }
    if (p === "□" || p === "?" || p === "_") {
      out.push({ t: "blank" });
      sign = 1;
      i++;
      continue;
    }
    const mx = /^(\d*)x$/i.exec(p);
    if (mx) {
      out.push({ t: "crate", count: mx[1] === "" ? 1 : Number(mx[1]) });
      sign = 1;
      i++;
      continue;
    }
    const f = parseFrac(p);
    if (f) {
      out.push({ t: "value", value: frac(sign * f.n, f.d) });
      sign = 1;
      i++;
      continue;
    }
    i++;
  }
  return out;
}

/** How many weights the rack offers. Nine, as it always did. */
const RACK_SIZE = 9;

/**
 * The rack the child chooses from — and the one defect in this game that made
 * arithmetic optional.
 *
 * The old version did three things, each of which on its own gives the answer
 * away:
 *
 *   1. It threw away any distractor whose magnitude exceeded 30. Every real
 *      mal-rule output for a two-digit sum is a two-digit number, so for
 *      `57 + 40` the host's plausible wrong answers were all discarded.
 *   2. It padded the remainder with 1, 2, 3, … from the bottom.
 *   3. It sorted the result ascending.
 *
 * Together those produced, verbatim, what the founder played:
 *
 *     19 + 70  →  1 2 3 4 5 6 7 8 89
 *     69 + 20  →  1 2 3 4 5 6 7 8 89
 *     57 + 40  →  1 2 3 4 5 6 7 8 97
 *
 * The answer was the only two-digit weight on the rack and it was always the
 * last one. A child does not need to add to win that; they need to notice which
 * brass disc is bigger than the others, and then drag the far right one, every
 * board, forever. Measured against the old code, a bot that drags the rightmost
 * weight and nothing else scored 100%.
 *
 * So: every distractor the host sends is kept (they are mal-rule outputs — that
 * is the whole point of them), the padding is drawn from the answer's own
 * neighbourhood rather than from 1, and the order is shuffled.
 *
 * **And the answer's rank is drawn too.** Shuffling fixes where the disc sits
 * on the rail; it does nothing about where the *number* sits once a child reads
 * the nine of them in order. An earlier pass at this padded symmetrically and
 * then forced at least two weights above and two below, which is a rule that
 * puts the answer in the middle — measured, rank 3, 4 or 5 held it 81.5% of the
 * time and "take the middle one" scored 32.6% against a 11.1% baseline. So the
 * rank is chosen first, uniformly, and the two sides are filled to match it.
 * There is one place that cannot be honoured and it is arithmetic rather than a
 * leak: an answer of 1 has nothing that can go below it.
 *
 * Deterministic given the question id, so a board looks the same if it is
 * rebuilt (a resize does that) and a test can pin it.
 */
function rackFor(answer: Frac, distractors: readonly string[], rng: Rng): Frac[] {
  if (answer.d !== 1) return fractionRack(answer, distractors, rng);

  const negative = !isPositive(answer);
  const mag = Math.abs(answer.n);

  // The neighbourhood the padding is drawn from. A ±35% band, never narrower
  // than ±4, keeps every weight the same size of number as the answer, so no
  // single disc is conspicuous whatever order they end up in.
  const spread = Math.max(4, Math.min(40, Math.round(mag * 0.35)));

  // The host's own wrong answers, split by which side of the answer they fall.
  // No magnitude filter: a distractor for `57 + 40` is 87 or 107, and dropping
  // those was what left the answer standing alone in the first place.
  const below = new Set<number>();
  const above = new Set<number>();
  for (const d of distractors) {
    if (below.size + above.size >= RACK_SIZE - 1) break;
    const f = parseFrac(d);
    if (!f || f.d !== 1) continue;
    const v = Math.abs(f.n);
    if (v <= 0 || v === mag || v > mag * 4 + 30) continue;
    (v < mag ? below : above).add(v);
  }

  // How many weights read lighter than the answer — which is the answer's rank
  // once a child sorts them in their head. Uniform over the whole rack, then
  // clamped to what the distractors already committed to and to what the number
  // line can supply.
  const roomBelow = Math.max(below.size, Math.min(mag - 1, spread));
  let nBelow = rng.int(0, RACK_SIZE - 1);
  nBelow = Math.min(Math.max(nBelow, below.size), RACK_SIZE - 1 - above.size);
  nBelow = Math.min(nBelow, roomBelow);

  fillSide(below, nBelow, Math.max(1, mag - spread), mag - 1, -1, mag, rng);
  fillSide(above, RACK_SIZE - 1 - nBelow, mag + 1, mag + spread, 1, mag, rng);

  const vals = rng.shuffle([mag, ...below, ...above]);
  return vals.map((n) => frac(negative ? -n : n));
}

/**
 * Fill one side of the answer to exactly `want` distinct values.
 *
 * Random draws inside the band first, then a deterministic walk outward if the
 * band did not have enough distinct integers in it — the walk is what makes
 * this total, and `above` is always satisfiable because there is no ceiling on
 * the number line. `below` is capped by the caller at `mag - 1`, which is the
 * most values that can exist under the answer at all.
 */
function fillSide(
  into: Set<number>,
  want: number,
  lo: number,
  hi: number,
  outward: 1 | -1,
  skip: number,
  rng: Rng,
): void {
  if (hi < lo) return;
  let guard = 0;
  while (into.size < want && guard++ < 400) {
    const v = rng.int(lo, hi);
    if (v >= 1 && v !== skip) into.add(v);
  }
  let v = outward > 0 ? hi + 1 : lo - 1;
  while (into.size < want && v >= 1 && guard++ < 2000) {
    if (v !== skip) into.add(v);
    v += outward;
  }
}

/**
 * The fractional rack. It used to be one frozen list in one frozen order, which
 * did not always contain the answer — `5/6` was unreachable and the board was
 * unsolvable. Now the answer is always on it, the family it belongs to fills
 * the rest, and it is shuffled like every other rack.
 */
function fractionRack(answer: Frac, distractors: readonly string[], rng: Rng): Frac[] {
  const seen = new Set<string>();
  const out: Frac[] = [];
  const push = (f: Frac): void => {
    if (f.n === 0) return;
    const k = toKey(f);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(f);
  };
  const sign = isPositive(answer) ? 1 : -1;
  push(answer);
  for (const d of distractors) {
    if (out.length >= RACK_SIZE) break;
    const f = parseFrac(d);
    if (f && f.d !== 1) push(frac(sign * Math.abs(f.n), f.d));
  }
  // Siblings in the answer's own family, then the standard halves and quarters.
  const den = answer.d;
  for (let n = 1; out.length < RACK_SIZE && n <= den * 2 + 2; n++) {
    push(frac(sign * n, den));
  }
  for (const f of [frac(1, 4), frac(1, 3), frac(1, 2), frac(2, 3), frac(3, 4), frac(1), frac(5, 4), frac(3, 2)]) {
    if (out.length >= RACK_SIZE) break;
    push(frac(sign * f.n, f.d));
  }
  return rng.shuffle(out);
}

/**
 * Build a board for a question that arrived without one. Total: it always
 * returns a solvable spec, because the answer is taken from the contract and
 * the missing side is simply "whatever is left".
 */
export function specFromQuestion(q: Question): PuzzleSpec {
  const withSpec = q as QuestionWithSpec;
  if (withSpec.spec) return withSpec.spec;

  // Seeded from the question id, not from a counter: the same question rebuilds
  // to the same board (a resize does that), and two questions never share a
  // rack order just because they arrived in the same position in the run.
  const rng = makeRng(seedFromString(q.id));
  const answer = parseFrac(q.answer) ?? frac(1);
  const eq = q.prompt.indexOf("=");
  const leftText = eq >= 0 ? q.prompt.slice(0, eq) : q.prompt;
  const rightText = eq >= 0 ? q.prompt.slice(eq + 1) : "□";

  const fixed: FixedItem[] = [];
  const place = (terms: Term[], side: Side): { fill: Side | null; crate: boolean } => {
    let fill: Side | null = null;
    let crate = false;
    for (const t of terms) {
      if (t.t === "value") fixed.push({ kind: "weight", side, peg: PAN_PEG, value: t.value });
      else if (t.t === "crate") {
        crate = true;
        for (let i = 0; i < t.count; i++) fixed.push({ kind: "crate", side, peg: PAN_PEG });
      } else fill = side;
    }
    return { fill, crate };
  };
  const l = place(tokenizeSide(leftText), -1);
  const r = place(tokenizeSide(rightText), 1);

  const kind: PuzzleSpec["kind"] = l.crate || r.crate ? "declare" : "fill";
  const fillSide: Side = l.fill ?? r.fill ?? 1;

  // The movement is the child's place on the *host's* ladder, not a count of
  // how many boards have gone by. It used to be `Math.floor(index / 5)`: a
  // hand-written staircase that advanced every five questions whether the
  // mathematics got harder or not, so the plinth announced a new movement on a
  // schedule and told the child nothing. `q.difficulty` is a 0..1 position on
  // the host's whole ladder, which is exactly what the engraving means.
  const movement = Math.max(
    0,
    Math.min(MOVEMENTS.length - 1, Math.floor((q.difficulty || 0) * MOVEMENTS.length)),
  );

  return {
    id: q.id,
    kind,
    mode: "pans",
    fixed,
    answer,
    rack: rackFor(answer, q.distractors, rng),
    fillSide: kind === "fill" ? fillSide : null,
    hangSlot: null,
    prompt: q.prompt,
    domain: q.domain,
    difficulty: q.difficulty,
    movement,
    movementName: MOVEMENTS[movement],
  };
}

/** Only used by the standalone shell's debug overlay. */
export function describeSpec(s: PuzzleSpec): string {
  return `${s.kind}/${s.mode} answer=${toNumber(s.answer)}`;
}
