// Seeded, exact puzzle generation.
//
// The ladder is deliberate. It starts where a five-year-old can act without a
// single word of instruction (one weight on the left, an empty dish on the
// right) and ends in two-step equations with unknowns on both sides and moments
// about a fulcrum. Every rung is the SAME physical verb: put brass on the thing.
//
// Prompts mirror the apparatus spatially — the left dish is written to the left
// of the equals sign — which routinely produces `9 = 4 + □`. That is the point.
// "The equals sign means 'here comes the answer'" is the single most durable
// misconception in elementary arithmetic, and a balance beam is the argument
// against it.

import type { Frac } from "./frac.ts";
import { frac, toKey, toNumber, add, sub, mulInt, isZero, isPositive } from "./frac.ts";
import type { FixedItem, PuzzleSpec, Side } from "./puzzle.ts";
import { MOVEMENTS, PAN_PEG } from "./puzzle.ts";
import { makeRng } from "./rng.ts";
import type { Rng } from "./rng.ts";

export { MOVEMENTS } from "./puzzle.ts";
export const PUZZLES_PER_MOVEMENT = 5;

type Draft = {
  kind: PuzzleSpec["kind"];
  mode: PuzzleSpec["mode"];
  fixed: FixedItem[];
  answer: Frac;
  rack: Frac[];
  fillSide: Side | null;
  hangSlot: { side: Side; peg: number } | null;
  prompt: string;
  domain: string;
  distractors: string[];
};

const w = (side: Side, value: Frac, peg = PAN_PEG): FixedItem => ({
  kind: "weight",
  side,
  peg,
  value,
});
const crate = (side: Side, peg = PAN_PEG): FixedItem => ({
  kind: "crate",
  side,
  peg,
});

/** Renders one dish exactly as it looks: crates as `x`, balloons as `− n`. */
function describeSide(
  items: readonly FixedItem[],
  side: Side,
  extra: "fill" | "hang" | null,
  mode: PuzzleSpec["mode"],
): string {
  const mine = items.filter((i) => i.side === side);
  const crates = mine.filter((i) => i.kind === "crate").length;
  const weights = mine.filter((i) => i.kind === "weight") as Extract<
    FixedItem,
    { kind: "weight" }
  >[];
  const parts: string[] = [];
  if (crates === 1) parts.push("x");
  else if (crates > 1) parts.push(`${crates}x`);
  for (const it of weights) {
    const n = toNumber(it.value);
    const label = mode === "beam" ? `${fmt(abs(it.value))} × ${it.peg}` : fmt(abs(it.value));
    if (n < 0) parts.push(`− ${label}`);
    else parts.push(parts.length === 0 ? label : `+ ${label}`);
  }
  if (extra === "fill") parts.push(parts.length === 0 ? "□" : "+ □");
  if (extra === "hang") parts.push(parts.length === 0 ? "□ × ?" : "+ □ × ?");
  return parts.join(" ") || "0";
}

function abs(f: Frac): Frac {
  return f.n < 0 ? frac(-f.n, f.d) : f;
}
function fmt(f: Frac): string {
  return f.d === 1 ? String(f.n) : `${f.n}/${f.d}`;
}

function buildPrompt(
  fixed: FixedItem[],
  mode: PuzzleSpec["mode"],
  fillSide: Side | null,
  hangSlot: { side: Side; peg: number } | null,
): string {
  const extraFor = (s: Side): "fill" | "hang" | null =>
    fillSide === s ? "fill" : hangSlot && hangSlot.side === s ? "hang" : null;
  const l = describeSide(fixed, -1, extraFor(-1), mode);
  const r = describeSide(fixed, 1, extraFor(1), mode);
  if (hangSlot) {
    // Show the peg the marked hook actually sits on: `6 × 2 = □ × 3`.
    const hung = `□ × ${hangSlot.peg}`;
    return hangSlot.side === 1
      ? `${l} = ${hung}`
      : `${hung} = ${r}`;
  }
  return `${l} = ${r}`;
}

/**
 * Every rack in this file is shuffled before it is handed over.
 *
 * A rack in ascending order is a rack whose answer has a *position*, and on a
 * board where the answer is much larger or much smaller than everything else
 * offered — which is most `declare` boards, where the mal-rules are `c − b` and
 * `c + b` and the answer is the little `x` — that position is the same one
 * every time. The child learns the position instead of the arithmetic. Nothing
 * downstream depends on the order: the rack is addressed by `findIndex` on
 * value everywhere it is used.
 */
const INT_RACK = (hi: number, rng: Rng): Frac[] =>
  rng.shuffle(Array.from({ length: hi }, (_, i) => frac(i + 1)));

/** Rack for a single-answer puzzle: the answer, real mal-rule outputs, and filler. */
function answerRack(answer: Frac, mals: number[], rng: Rng, size = 9): Frac[] {
  const set = new Set<number>([toNumber(answer)]);
  for (const m of mals) if (m > 0 && m <= 30 && Number.isInteger(m)) set.add(m);
  const a = toNumber(answer);
  let guard = 0;
  while (set.size < size && guard++ < 200) {
    const near = Math.max(1, a + rng.int(-5, 7));
    if (Number.isInteger(near)) set.add(near);
  }
  return rng.shuffle([...set]).map((n) => frac(n));
}

// ---------------------------------------------------------------- generators

function genFillSimple(rng: Rng, hi: number): Draft {
  const target = rng.int(3, hi);
  const fixed: FixedItem[] = [w(-1, frac(target))];
  return {
    kind: "fill",
    mode: "pans",
    fixed,
    answer: frac(target),
    rack: INT_RACK(Math.max(9, Math.min(12, hi)), rng),
    fillSide: 1,
    hangSlot: null,
    prompt: buildPrompt(fixed, "pans", 1, null),
    domain: "add-sub",
    distractors: [String(target + 1), String(target - 1), String(target + 10)],
  };
}

function genFillBoth(rng: Rng, hi: number): Draft {
  const total = rng.int(8, hi);
  const have = rng.int(2, total - 2);
  const need = total - have;
  const heavyLeft = rng.chance(0.5);
  const fixed: FixedItem[] = heavyLeft
    ? [w(-1, frac(total)), w(1, frac(have))]
    : [w(1, frac(total)), w(-1, frac(have))];
  const fillSide: Side = heavyLeft ? 1 : -1;
  return {
    kind: "fill",
    mode: "pans",
    fixed,
    answer: frac(need),
    rack: INT_RACK(12, rng),
    fillSide,
    hangSlot: null,
    prompt: buildPrompt(fixed, "pans", fillSide, null),
    domain: "add-sub",
    // The classic: add when the shape says subtract.
    distractors: [String(total + have), String(total), String(need + 1)],
  };
}

function genDeclareSimple(rng: Rng, hi: number): Draft {
  const x = rng.int(2, Math.min(12, hi));
  const b = rng.int(1, hi);
  const c = x + b;
  const crateLeft = rng.chance(0.7);
  const fixed: FixedItem[] = crateLeft
    ? [crate(-1), w(-1, frac(b)), w(1, frac(c))]
    : [w(-1, frac(c)), crate(1), w(1, frac(b))];
  return {
    kind: "declare",
    mode: "pans",
    fixed,
    answer: frac(x),
    rack: answerRack(frac(x), [c, b, c + b], rng),
    fillSide: null,
    hangSlot: null,
    prompt: buildPrompt(fixed, "pans", null, null),
    domain: "equations",
    distractors: [String(c), String(c + b), String(x + 1)],
  };
}

function genDeclareCoeff(rng: Rng, maxK: number, hi: number): Draft {
  const k = rng.int(2, maxK);
  const x = rng.int(2, Math.min(10, hi));
  const b = rng.int(1, Math.min(12, hi));
  const c = k * x + b;
  const fixed: FixedItem[] = [];
  for (let i = 0; i < k; i++) fixed.push(crate(-1));
  fixed.push(w(-1, frac(b)));
  fixed.push(w(1, frac(c)));
  return {
    kind: "declare",
    mode: "pans",
    fixed,
    answer: frac(x),
    // Mal-rules: forgot to divide (c − b); divided first (c/k − b when it divides);
    // subtracted the wrong way ((c + b)/k).
    rack: answerRack(
      frac(x),
      [c - b, Math.floor(c / k) - b, Math.round((c + b) / k), x + 1],
      rng,
    ),
    fillSide: null,
    hangSlot: null,
    prompt: buildPrompt(fixed, "pans", null, null),
    domain: "equations",
    distractors: [String(c - b), String(Math.floor(c / k)), String(x + 1)],
  };
}

function genDeclareBothSides(rng: Rng, hi: number): Draft {
  // k·x + b = m·x + c  with k > m, x = (c − b)/(k − m)
  const k = rng.int(2, 3);
  const m = 1;
  const x = rng.int(2, Math.min(9, hi));
  const b = rng.int(0, 8);
  const c = (k - m) * x + b;
  const fixed: FixedItem[] = [];
  for (let i = 0; i < k; i++) fixed.push(crate(-1));
  if (b > 0) fixed.push(w(-1, frac(b)));
  for (let i = 0; i < m; i++) fixed.push(crate(1));
  fixed.push(w(1, frac(c)));
  return {
    kind: "declare",
    mode: "pans",
    fixed,
    answer: frac(x),
    rack: answerRack(frac(x), [c - b, c, c + b, x + 1], rng),
    fillSide: null,
    hangSlot: null,
    prompt: buildPrompt(fixed, "pans", null, null),
    domain: "equations",
    distractors: [String(c - b), String(c), String(x + 1)],
  };
}

function genHang(rng: Rng, maxPeg: number): Draft {
  // A·dA = x·dX — a moment about the fulcrum, which is ratio you can feel.
  // Enumerate every exact board and pick one: no rejection loop, no recursion,
  // and no chance of a puzzle whose answer is not a whole number of weights.
  const cands: { a: number; dA: number; x: number; dX: number }[] = [];
  for (let dA = 1; dA <= maxPeg; dA++) {
    for (let dX = 1; dX <= maxPeg; dX++) {
      if (dA === dX) continue;
      for (let x = 2; x <= 9; x++) {
        const t = x * dX;
        if (t % dA !== 0) continue;
        const a = t / dA;
        if (a < 2 || a > 12) continue;
        cands.push({ a, dA, x, dX });
      }
    }
  }
  const c = rng.pick(cands);
  return hangDraft(rng, c.a, c.dA, c.x, c.dX);
}

function hangDraft(rng: Rng, a: number, dA: number, x: number, dX: number): Draft {
  const leftIsFixed = rng.chance(0.6);
  const fixedSide: Side = leftIsFixed ? -1 : 1;
  const hangSide: Side = leftIsFixed ? 1 : -1;
  const fixed: FixedItem[] = [w(fixedSide, frac(a), dA)];
  const hangSlot = { side: hangSide, peg: dX };
  return {
    kind: "hang",
    mode: "beam",
    fixed,
    answer: frac(x),
    rack: answerRack(frac(x), [a, a * dA, a + dA, a * dX], rng),
    fillSide: null,
    hangSlot,
    prompt: buildPrompt(fixed, "beam", null, hangSlot),
    domain: "ratio",
    distractors: [String(a), String(a * dA), String(a + dA)],
  };
}

function genBalloon(rng: Rng, hi: number): Draft {
  // The left dish is too heavy. Tie a balloon to it. Subtraction with buoyancy.
  const a = rng.int(8, hi);
  const x = rng.int(2, Math.min(9, a - 2));
  const b = a - x;
  const heavyLeft = rng.chance(0.5);
  const heavy: Side = heavyLeft ? -1 : 1;
  const light: Side = heavyLeft ? 1 : -1;
  const fixed: FixedItem[] = [w(heavy, frac(a)), w(light, frac(b))];
  return {
    kind: "fill",
    mode: "pans",
    fixed,
    answer: frac(-x),
    // The rack holds balloons: every value lifts.
    rack: rng.shuffle(Array.from({ length: 9 }, (_, i) => frac(-(i + 1)))),
    fillSide: heavy,
    hangSlot: null,
    prompt: buildPrompt(fixed, "pans", heavy, null),
    domain: "add-sub",
    distractors: [String(-(a + b)), String(-a), String(-(x + 1))],
  };
}

const FRACTION_RACK: Frac[] = [
  frac(1, 4),
  frac(1, 3),
  frac(1, 2),
  frac(2, 3),
  frac(3, 4),
  frac(1),
  frac(5, 4),
  frac(3, 2),
];

function genFraction(rng: Rng): Draft {
  const family = rng.pick([2, 4, 3] as const);
  const den = family;
  const total = rng.int(family + 1, family * 2 + 1); // e.g. 5/4 .. 9/4
  const have = rng.int(1, total - 1);
  const need = total - have;
  const left = frac(total, den);
  const rightHave = frac(have, den);
  const answer = frac(need, den);
  const fixed: FixedItem[] = [w(-1, left), w(1, rightHave)];
  return {
    kind: "fill",
    mode: "pans",
    fixed,
    answer,
    rack: rng.shuffle(FRACTION_RACK),
    fillSide: 1,
    hangSlot: null,
    prompt: buildPrompt(fixed, "pans", 1, null),
    domain: "fractions",
    // The signature error: add across the bar.
    distractors: [
      toKey(frac(total + have, den + den)),
      toKey(add(left, rightHave)),
      toKey(sub(left, frac(1, den))),
    ],
  };
}

function genDeclareFraction(rng: Rng): Draft {
  const den = rng.pick([2, 4] as const);
  const x = frac(rng.int(1, 3), den);
  const b = frac(rng.int(1, 4), den);
  const c = add(x, b);
  const fixed: FixedItem[] = [crate(-1), w(-1, b), w(1, c)];
  return {
    kind: "declare",
    mode: "pans",
    fixed,
    answer: x,
    rack: rng.shuffle(FRACTION_RACK),
    fillSide: null,
    hangSlot: null,
    prompt: buildPrompt(fixed, "pans", null, null),
    domain: "fractions",
    distractors: [toKey(c), toKey(add(c, b)), toKey(add(x, frac(1, den)))],
  };
}

// ------------------------------------------------------------------- ladder

function draftFor(index: number, rng: Rng): Draft {
  const movement = Math.floor(index / PUZZLES_PER_MOVEMENT);
  const step = index % PUZZLES_PER_MOVEMENT;
  switch (movement) {
    case 0:
      return genFillSimple(rng, 6 + step);
    case 1:
      return genFillBoth(rng, 12 + step * 2);
    case 2:
      return genDeclareSimple(rng, 9 + step * 2);
    case 3:
      return genDeclareCoeff(rng, step < 2 ? 2 : 3, 10 + step);
    case 4:
      return genHang(rng, step < 2 ? 3 : 4);
    case 5:
      return genDeclareBothSides(rng, 6 + step);
    case 6:
      return genBalloon(rng, 12 + step * 2);
    case 7:
      return step % 3 === 2 ? genDeclareFraction(rng) : genFraction(rng);
    default: {
      // Mixed review, still climbing. Deterministic by index, never a streak of one kind.
      const hi = 14 + Math.min(20, (movement - 7) * 3);
      const pick = (index * 7 + movement) % 8;
      switch (pick) {
        case 0:
          return genFillBoth(rng, hi + 6);
        case 1:
          return genDeclareCoeff(rng, 4, hi);
        case 2:
          return genHang(rng, 5);
        case 3:
          return genDeclareBothSides(rng, 9);
        case 4:
          return genBalloon(rng, hi);
        case 5:
          return genFraction(rng);
        case 6:
          return genDeclareFraction(rng);
        default:
          return genDeclareSimple(rng, hi);
      }
    }
  }
}

export function puzzleAt(index: number, seed: number): PuzzleSpec {
  const rng = makeRng((seed ^ (index * 0x9e3779b1)) >>> 0);
  let d = draftFor(index, rng);
  // Never ship a degenerate board: the answer must be reachable from the rack.
  if (!isReachable(d)) d = genFillSimple(rng, 8);
  const movement = Math.floor(index / PUZZLES_PER_MOVEMENT);
  return {
    id: `bal-${seed.toString(36)}-${index}`,
    kind: d.kind,
    mode: d.mode,
    fixed: d.fixed,
    answer: d.answer,
    rack: d.rack,
    fillSide: d.fillSide,
    hangSlot: d.hangSlot,
    countAnswer: false,
    // The local ladder's balloon boards hand the child a negative answer already
    // (`genBalloon` answers `-x`), so the mass in the dish IS the answer.
    fillLifts: false,
    prompt: d.prompt,
    domain: d.domain,
    difficulty: Math.min(1, 0.06 + movement * 0.1 + (index % PUZZLES_PER_MOVEMENT) * 0.02),
    movement,
    movementName: MOVEMENTS[Math.min(movement, MOVEMENTS.length - 1)],
  };
}

export function distractorsAt(index: number, seed: number): string[] {
  const rng = makeRng((seed ^ (index * 0x9e3779b1)) >>> 0);
  const d = draftFor(index, rng);
  return cleanDistractors(d.answer, d.distractors);
}

/**
 * A mal-rule can coincide with the truth (`a × d` happens to equal `x`). Those
 * are not distractors, they are the answer, and shipping one would teach the
 * engine that a correct response was a known error. Drop them and pad with near
 * misses so the shape of the field never collapses.
 */
function cleanDistractors(answer: Frac, ds: readonly string[]): string[] {
  const key = toKey(answer);
  const out: string[] = [];
  for (const d of ds) {
    if (d === key || out.includes(d)) continue;
    if (parseFracKey(d) === null) continue;
    out.push(d);
  }
  const unit = frac(1, answer.d);
  for (let k = 1; out.length < 3 && k <= 12; k++) {
    for (const p of [add(answer, mulInt(unit, k)), sub(answer, mulInt(unit, k))]) {
      if (out.length >= 3) break;
      if (isZero(p)) continue;
      const s = toKey(p);
      if (s === key || out.includes(s)) continue;
      out.push(s);
    }
  }
  return out;
}

function parseFracKey(s: string): number | null {
  return /^-?\d+(\/\d+)?$/.test(s) ? 1 : null;
}

function isReachable(d: Draft): boolean {
  if (d.kind === "fill") {
    // Some multiset of rack values must hit the answer exactly.
    const sign = isPositive(d.answer) ? 1 : -1;
    const usable = d.rack.filter((r) => (r.n > 0 ? 1 : -1) === sign);
    if (usable.length === 0) return false;
    return reachable(usable, d.answer);
  }
  return d.rack.some((r) => r.n === d.answer.n && r.d === d.answer.d);
}

function reachable(rack: readonly Frac[], target: Frac): boolean {
  let L = target.d;
  for (const f of rack) L = lcmOf(L, f.d);
  const goal = Math.abs(target.n) * (L / target.d);
  const vals = rack.map((f) => Math.abs(f.n) * (L / f.d)).filter((v) => v > 0);
  if (goal <= 0 || goal > 4096) return false;
  const ok = new Array<boolean>(goal + 1).fill(false);
  ok[0] = true;
  for (let i = 1; i <= goal; i++) {
    for (const v of vals) if (v <= i && ok[i - v]) { ok[i] = true; break; }
  }
  return ok[goal];
}

function lcmOf(a: number, b: number): number {
  let x = a;
  let y = b;
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return (a / x) * b;
}
