/**
 * Condition generators.
 *
 * A *condition* is what the arena floor says — `= 12`, `6 × ?`, `> 3/4`. It
 * comes with two label pools: things that satisfy it and things that do not.
 * The wrong ones are the maze the child has to swim through, so they are built
 * to be *near misses* — off-by-one, borrow slips, place-value slips, times-table
 * neighbours, "bigger denominator so it must be bigger". A wrong answer you can
 * spot without arithmetic teaches nothing and, worse, is boring.
 *
 * Every label is produced together with its exact value. Nothing is parsed at
 * runtime and nothing is a float.
 */

import type { Rng } from "./rng.ts";
import type { Frac, Predicate } from "./exact.ts";
import { GLYPH, cmp, frac, fracLabel, int, predicateKey, promptFor, satisfies } from "./exact.ts";

export type Condition = {
  predicate: Predicate;
  key: string;
  prompt: string;
  domain: string;
  difficulty: number;
  satisfying: string[];
  failing: string[];
};

const { minus: M, times: X, divide: D } = GLYPH;

/** Unique-preserving push. Labels must be distinct or two orbs read the same. */
function put(into: string[], seen: Set<string>, label: string): void {
  if (seen.has(label)) return;
  seen.add(label);
  into.push(label);
}

// ---------------------------------------------------------------- equal-to

function factorPairs(t: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let a = 2; a * a <= t; a++) {
    if (t % a === 0) out.push([a, t / a]);
  }
  return out;
}

/** Expressions whose exact value is `v`, in shapes a child of this level meets. */
function expressionsFor(v: number, level: number, rng: Rng, want: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (out.length < want && guard++ < 60) {
    const roll = rng.next();
    if (roll < 0.4 && v >= 2) {
      const a = rng.int(1, v - 1);
      put(out, seen, `${a} + ${v - a}`);
    } else if (roll < 0.72 && level >= 1) {
      const b = rng.int(1, level >= 3 ? 12 : 6);
      put(out, seen, `${v + b} ${M} ${b}`);
    } else if (roll < 0.9 && level >= 3) {
      const pairs = factorPairs(v);
      if (pairs.length > 0) {
        const p = rng.pick(pairs);
        put(out, seen, rng.chance(0.5) ? `${p[0]} ${X} ${p[1]}` : `${p[1]} ${X} ${p[0]}`);
      }
    } else if (level >= 4 && v >= 2) {
      const b = rng.int(2, 6);
      put(out, seen, `${v * b} ${D} ${b}`);
    }
  }
  return out;
}

function eqCondition(rng: Rng, level: number): Condition {
  const bands: Array<[number, number]> = [
    [4, 10],
    [8, 18],
    [10, 30],
    [12, 45],
    [15, 60],
    [18, 80],
    [20, 99],
  ];
  const band = bands[Math.min(level, bands.length - 1)] as [number, number];
  const target = rng.int(band[0], band[1]);

  const satisfying: string[] = [];
  const sSeen = new Set<string>();
  put(satisfying, sSeen, String(target));
  for (const e of expressionsFor(target, level, rng, 7)) put(satisfying, sSeen, e);

  // Near misses. ±1..4 are counting and borrow slips and they dominate the
  // pool on purpose: a wrong answer you can reject without arithmetic makes the
  // round free. ±9..11 are place-value slips, which only mean anything once the
  // number is big enough to have a tens column worth dropping — they are capped
  // to a minority so most of the field still has to be computed.
  const failing: string[] = [];
  const fSeen = new Set<string>();
  for (const d of rng.shuffle([1, -1, 2, -2, 3, -3, 4, -4])) {
    const v = target + d;
    if (v < 1) continue;
    put(failing, fSeen, String(v));
    for (const e of expressionsFor(v, level, rng, 2)) put(failing, fSeen, e);
  }
  if (target >= 20) {
    const farBudget = Math.floor(failing.length / 3);
    const before = failing.length;
    for (const d of rng.shuffle([9, -9, 10, -10, 11, -11])) {
      if (failing.length - before >= farBudget) break;
      const v = target + d;
      if (v < 1) continue;
      put(failing, fSeen, String(v));
      for (const e of expressionsFor(v, level, rng, 1)) put(failing, fSeen, e);
    }
  }

  const predicate: Predicate = { kind: "eq", target: int(target) };
  return {
    predicate,
    key: predicateKey(predicate),
    prompt: promptFor(predicate),
    domain: level >= 3 ? "mult-div" : "add-sub",
    difficulty: Math.min(1, level / 6),
    satisfying,
    failing,
  };
}

// ---------------------------------------------------------------- multiples

function multipleCondition(rng: Rng, level: number): Condition {
  const pools: number[][] = [
    [2, 5],
    [2, 5, 10],
    [2, 3, 4, 5],
    [3, 4, 5, 6],
    [4, 6, 7, 8],
    [6, 7, 8, 9],
    [6, 7, 8, 9, 11, 12],
  ];
  const base = rng.pick(pools[Math.min(level, pools.length - 1)] as number[]);
  const maxK = Math.min(12, 5 + level * 2);

  const satisfying: string[] = [];
  const sSeen = new Set<string>();
  for (const k of rng.shuffle(Array.from({ length: maxK - 1 }, (_, i) => i + 2))) {
    put(satisfying, sSeen, String(base * k));
    if (satisfying.length >= 8) break;
  }
  // At higher levels a couple of orbs make you do the multiplication *first*
  // and then decide whether the result is in the table. Two steps, one bite.
  if (level >= 3) {
    for (let i = 0; i < 2; i++) {
      const k = rng.int(2, Math.min(9, maxK));
      const a = rng.int(2, 6);
      const v = base * k;
      if (v % a === 0) put(satisfying, sSeen, `${a} ${X} ${v / a}`);
    }
  }

  const failing: string[] = [];
  const fSeen = new Set<string>();
  let guard = 0;
  while (failing.length < 18 && guard++ < 200) {
    const k = rng.int(1, maxK);
    const off = rng.pick([1, -1, 2, -2, 3, -3]);
    const v = base * k + off;
    if (v < 2) continue;
    if (v % base === 0) continue; // would satisfy — never a distractor
    put(failing, fSeen, String(v));
  }
  // Neighbouring times-tables: the classic "I recited the wrong one" error.
  for (const nb of [base - 1, base + 1]) {
    if (nb < 2) continue;
    for (let k = 2; k <= 7; k++) {
      const v = nb * k;
      if (v % base !== 0) put(failing, fSeen, String(v));
    }
  }

  const predicate: Predicate = { kind: "multiple", base };
  return {
    predicate,
    key: predicateKey(predicate),
    prompt: promptFor(predicate),
    domain: "multiples",
    difficulty: Math.min(1, level / 6),
    satisfying,
    failing,
  };
}

// ---------------------------------------------------------------- fractions

const REF_BY_LEVEL: Frac[][] = [
  [frac(1, 2)],
  [frac(1, 2)],
  [frac(1, 2), frac(1, 4)],
  [frac(1, 2), frac(1, 4), frac(3, 4)],
  [frac(1, 2), frac(1, 3), frac(2, 3), frac(3, 4)],
  [frac(1, 3), frac(2, 3), frac(3, 4), frac(2, 5), frac(3, 5)],
  [frac(2, 3), frac(3, 4), frac(3, 5), frac(5, 8), frac(5, 6)],
];

function candidateFractions(maxD: number): Frac[] {
  const out: Frac[] = [];
  const seen = new Set<string>();
  for (let d = 2; d <= maxD; d++) {
    for (let n = 1; n <= d + 1; n++) {
      const f = frac(n, d);
      const key = `${f.n}/${f.d}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(f);
    }
  }
  return out;
}

/** |x − ref| vs |y − ref|, by integer cross-multiplication only. */
function nearer(ref: Frac): (x: Frac, y: Frac) => number {
  return (x, y) => {
    const dx = Math.abs(x.n * ref.d - ref.n * x.d);
    const dy = Math.abs(y.n * ref.d - ref.n * y.d);
    return dx * y.d - dy * x.d;
  };
}

function fracCondition(rng: Rng, level: number): Condition {
  const ref = rng.pick(REF_BY_LEVEL[Math.min(level, REF_BY_LEVEL.length - 1)] as Frac[]);
  const dir: "gt" | "lt" = rng.chance(0.5) ? "gt" : "lt";
  const predicate: Predicate = dir === "gt" ? { kind: "gt", ref } : { kind: "lt", ref };
  const maxD = level <= 3 ? 8 : level <= 5 ? 10 : 12;

  const all = candidateFractions(maxD);
  const near = nearer(ref);
  const pass = all.filter((f) => satisfies(predicate, f)).sort(near);
  const fail = all.filter((f) => !satisfies(predicate, f)).sort(near);

  const satisfying = rng.shuffle(pass.slice(0, 12).map(fracLabel)).slice(0, 9);
  const failing = rng.shuffle(fail.slice(0, 16).map(fracLabel)).slice(0, 14);

  // The equal-value trap always ships: for `> 1/2`, `2/4` is not greater. It is
  // the single most instructive orb in the round, and it only exists as an
  // *unreduced* label — every other label in the pools is in lowest terms.
  for (let k = 2; k <= 4; k++) {
    if (ref.d * k > maxD) break;
    const trap = `${ref.n * k}/${ref.d * k}`;
    if (!failing.includes(trap)) {
      failing.unshift(trap);
      break;
    }
  }

  // Unreduced satisfying labels at the top of the ladder: `4/6` and `2/3` are
  // the same orb, and knowing that is the whole skill.
  if (level >= 5) {
    for (const f of pass.slice(0, 6)) {
      const k = 2;
      if (f.d * k > maxD) continue;
      const label = `${f.n * k}/${f.d * k}`;
      if (!satisfying.includes(label) && cmp(frac(f.n * k, f.d * k), ref) !== 0) {
        satisfying.push(label);
        break;
      }
    }
  }

  return {
    predicate,
    key: predicateKey(predicate),
    prompt: promptFor(predicate),
    domain: "fractions",
    difficulty: Math.min(1, 0.4 + level / 10),
    satisfying,
    failing,
  };
}

// ---------------------------------------------------------------- selection

type Family = "eq" | "multiple" | "fraction";

const FAMILIES_BY_LEVEL: Family[][] = [
  ["eq"],
  ["eq", "eq", "multiple"],
  ["eq", "multiple"],
  ["eq", "multiple", "multiple"],
  ["eq", "multiple", "fraction"],
  ["eq", "multiple", "fraction", "fraction"],
  ["eq", "multiple", "fraction", "fraction"],
];

export function makeCondition(rng: Rng, level: number, avoidKey?: string): Condition {
  const lv = Math.max(0, Math.min(6, Math.floor(level)));
  const families = FAMILIES_BY_LEVEL[lv] as Family[];
  for (let attempt = 0; attempt < 8; attempt++) {
    const family = rng.pick(families);
    const c =
      family === "eq"
        ? eqCondition(rng, lv)
        : family === "multiple"
          ? multipleCondition(rng, lv)
          : fracCondition(rng, lv);
    if (c.key !== avoidKey && c.satisfying.length >= 4 && c.failing.length >= 8) return c;
  }
  return eqCondition(rng, lv);
}
