/** Small helpers shared by the structure definitions. */
import { multiply, rational } from '../../../learning/rational';
import type { BoundRole, Roles } from '../registry';
import { issue } from '../registry';
import { formatPlain, toNumber, type Issue, type Value } from '../quantity';

/** A bound role that the definition requires (its RoleSpec is not nullable). */
export const req = <R extends string>(roles: Roles<R>, r: R): BoundRole => {
  const b = roles[r];
  if (!b) throw new Error(`role ${r} is required`);
  return b;
};
/** A count's whole-number value as a JS number (counts are whole and bounded by invariants). */
export const n = (b: BoundRole | null): number => b ? toNumber(b.value.q) : 0;
export const count = (q: bigint): Value => ({ q: rational(q), power: 0, unit: null });
export const product = (a: Value, b: Value): Value => ({ q: multiply(a.q, b.q), power: a.power + b.power, unit: a.unit ?? b.unit });
/** "between lo and hi" bound check on a count role. */
export function within(b: BoundRole | null, role: string, lo: number, hi: number, where: string): Issue[] {
  if (!b) return [];
  const v = toNumber(b.value.q);
  return v < lo || v > hi ? [issue('magnitude', `${role} (${b.id} = ${formatPlain(b.value.q)}) must be from ${lo} to ${hi} ${where}.`)] : [];
}
export const plural = (k: number, one: string, other: string) => `${k} ${k === 1 ? one : other}`;

/** Most items a countable description spells out one by one; more is read as "many". */
export const MAX_COUNTABLE_WORDS = 12;
/** "apple, apple, apple": a count a learner using a screen reader can count without being told it. */
export const countable = (one: string, other: string, k: number) => k <= MAX_COUNTABLE_WORDS ? Array.from({ length: k }, () => one).join(', ') : `many ${other}`;
/** The singular and plural a count is described with: its noun, or a fallback word. */
export const nounOf = (b: BoundRole | null, one: string, other: string) => ({ one: b?.decl.noun?.one ?? one, other: b?.decl.noun?.other ?? other });
export const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
