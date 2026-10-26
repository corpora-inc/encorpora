import { defineAxis } from "./axes";
import type { Statement } from "./statement-set";

/**
 * Unknown / target selection for a two-operand relation
 * `whole = first ∘ second` (∘ is × or +). The model fixes the three values;
 * the target axis chooses which one the learner is asked for. Candidate
 * equations come from one ordered list of symbolic forms — equivalent
 * rearrangements first, then misconception transforms (wrong operation,
 * reversed division, inverse operation on the wrong side) — with the chosen
 * unknown written as a letter. Every candidate's truth is computed exactly by
 * substituting the unknown's value, never asserted.
 */
export type Slot = "whole" | "first" | "second";
export type RelationOp = "product" | "sum";
export interface FactRelation {
  op: RelationOp;
  whole: number;
  first: number;
  second: number;
}

/** Define a family's target axis: its value names (evidence) map to slots. */
export const targetAxis = <const V extends string>(
  slots: Readonly<Record<V, Slot>>,
  legacy: NoInfer<V>,
) => ({
  axis: defineAxis("unknown", Object.keys(slots) as V[], { legacy }),
  slot: (value: V): Slot => slots[value],
});

type Fr = readonly [number, number];
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const fr = (n: number, d: number): Fr => {
  if (d === 0) throw new Error("Zero denominator");
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return [n / g, d / g];
};
const ops: Record<string, (a: Fr, b: Fr) => Fr> = {
  "\\times": (a, b) => fr(a[0] * b[0], a[1] * b[1]),
  "\\div": (a, b) => fr(a[0] * b[1], a[1] * b[0]),
  "+": (a, b) => fr(a[0] * b[1] + b[0] * a[1], a[1] * b[1]),
  "-": (a, b) => fr(a[0] * b[1] - b[0] * a[1], a[1] * b[1]),
};
type Term = Slot | [Slot, string, Slot];
type Form = [Term, Term];
const W = "whole",
  P = "first",
  Q = "second";
/** whole = first × second. Five equivalent forms, then five misconceptions. */
const productForms: Form[] = [
  [W, [P, "\\times", Q]],
  [W, [Q, "\\times", P]],
  [[Q, "\\times", P], W],
  [[W, "\\div", P], Q],
  [[W, "\\div", Q], P],
  [W, [Q, "+", P]],
  [W, [Q, "\\div", P]],
  [[W, "\\times", P], Q],
  [[Q, "\\div", W], P],
  [[W, "-", P], Q],
];
/** whole = second + first. Five equivalent forms, then five misconceptions. */
const sumForms: Form[] = [
  [W, [Q, "+", P]],
  [[Q, "+", P], W],
  [[W, "-", Q], P],
  [[W, "-", P], Q],
  [[P, "+", Q], W],
  [W, [Q, "\\times", P]],
  [W, [Q, "-", P]],
  [[W, "+", Q], P],
  [[W, "\\div", Q], P],
  [[P, "-", Q], W],
];

export interface FactEquation extends Statement {
  left: number;
  right: number;
}

/** Candidate equations for finding `unknown`, in the fixed form order. */
export function factEquations(
  relation: FactRelation,
  unknown: Slot,
  letter = "n",
): FactEquation[] {
  const value = (slot: Slot): Fr => [relation[slot], 1];
  const name = (slot: Slot) => (slot === unknown ? letter : `${relation[slot]}`);
  const side = (term: Term): { tex: string; v: Fr } =>
    typeof term === "string"
      ? { tex: name(term), v: value(term) }
      : {
          tex: `${name(term[0])}${term[1]}${name(term[2])}`,
          v: ops[term[1]]!(value(term[0]), value(term[2])),
        };
  const known = relation[unknown];
  return (relation.op === "product" ? productForms : sumForms).map(
    ([l, r]) => {
      const left = side(l),
        right = side(r);
      const lv = left.v[0] / left.v[1],
        rv = right.v[0] / right.v[1];
      return {
        label: `$${left.tex}=${right.tex}$`,
        holds: left.v[0] === right.v[0] && left.v[1] === right.v[1],
        why: `With $${letter}=${known}$ the left side is ${Number(lv.toFixed(3))} and the right side is ${Number(rv.toFixed(3))}.`,
        left: lv,
        right: rv,
      };
    },
  );
}
