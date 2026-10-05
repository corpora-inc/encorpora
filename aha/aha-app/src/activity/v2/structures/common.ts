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
