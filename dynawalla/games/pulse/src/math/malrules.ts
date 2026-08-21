/**
 * Mal-rules: the wrong answers children actually produce.
 *
 * A distractor that nobody would ever write teaches nothing and is trivially
 * eliminated. Every rule here is a documented systematic error, so a learner who
 * holds the misconception finds their own answer sitting right there on the bar.
 */

import { type Rat, rat, add as radd, sub as rsub } from "./rational.ts";

export type MalRule = {
  id: string;
  /** The misconception, in one line, for anyone reading a report. */
  why: string;
};

export type MalOut = { value: Rat; rule: MalRule };

const R = {
  addAcross: { id: "add-across", why: "adds numerators and denominators: a/b + c/d = (a+c)/(b+d)" },
  keepDenom: { id: "keep-denominator", why: "adds numerators, keeps one denominator" },
  subAcross: { id: "sub-across", why: "subtracts numerators and denominators" },
  mulDenomToo: { id: "multiply-denominator-too", why: "n × a/b = (n·a)/(n·b)" },
  complementFlip: {
    id: "complement-flip",
    why: "1 − a/b computed as (b−a)/a — subtracts inside the fraction the wrong way",
  },
  complementNumer: { id: "complement-numerator-only", why: "1 − a/b = (1−a)/b, treating 1 as 1/b" },
  offByOneNum: { id: "off-by-one-numerator", why: "counts the ticks, not the gaps" },
  denomOfLarger: { id: "denominator-of-larger", why: "keeps the bigger denominator, adds numerators" },
} as const satisfies Record<string, MalRule>;

const safe = (fn: () => Rat): Rat | null => {
  try {
    return fn();
  } catch {
    return null;
  }
};

export function malForAdd(a: Rat, b: Rat): MalOut[] {
  const out: MalOut[] = [];
  const across = safe(() => rat(a.n + b.n, a.d + b.d));
  if (across) out.push({ value: across, rule: R.addAcross });
  const keep = safe(() => rat(a.n + b.n, a.d));
  if (keep) out.push({ value: keep, rule: R.keepDenom });
  const bigger = safe(() => rat(a.n + b.n, a.d > b.d ? a.d : b.d));
  if (bigger) out.push({ value: bigger, rule: R.denomOfLarger });
  const off = safe(() => {
    const s = radd(a, b);
    return rat(s.n + 1n, s.d);
  });
  if (off) out.push({ value: off, rule: R.offByOneNum });
  return out;
}

export function malForSub(a: Rat, b: Rat): MalOut[] {
  const out: MalOut[] = [];
  const across = safe(() => (a.d === b.d ? rat(a.n - b.n, 1n) : rat(a.n - b.n, a.d - b.d)));
  if (across) out.push({ value: across, rule: R.subAcross });
  const keep = safe(() => rat(a.n - b.n, a.d));
  if (keep) out.push({ value: keep, rule: R.keepDenom });
  const off = safe(() => {
    const s = rsub(a, b);
    return rat(s.n + 1n, s.d);
  });
  if (off) out.push({ value: off, rule: R.offByOneNum });
  return out;
}

export function malForMul(n: bigint, f: Rat): MalOut[] {
  const out: MalOut[] = [];
  const both = safe(() => rat(n * f.n, n * f.d));
  if (both) out.push({ value: both, rule: R.mulDenomToo });
  const off = safe(() => rat(n * f.n + 1n, f.d));
  if (off) out.push({ value: off, rule: R.offByOneNum });
  const plus = safe(() => rat(n + f.n, f.d));
  if (plus) out.push({ value: plus, rule: R.keepDenom });
  return out;
}

export function malForComplement(f: Rat): MalOut[] {
  const out: MalOut[] = [];
  const flip = safe(() => rat(f.d - f.n, f.n));
  if (flip) out.push({ value: flip, rule: R.complementFlip });
  const numOnly = safe(() => rat(1n - f.n, f.d));
  if (numOnly) out.push({ value: numOnly, rule: R.complementNumer });
  const off = safe(() => {
    const s = rsub({ n: 1n, d: 1n }, f);
    return rat(s.n + 1n, s.d);
  });
  if (off) out.push({ value: off, rule: R.offByOneNum });
  return out;
}

export const MAL_RULES = R;
