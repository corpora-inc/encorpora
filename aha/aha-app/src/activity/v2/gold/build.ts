/** Builders that write the strict wire shape exactly (every key, null where unused), so gold specs stay readable. */
import type { QuantityKind, UnitId } from '../quantity';
import type { WireNoun, WireQuantity } from '../wire';

export const noun = (one: string, other: string, icon: string | null = one.replace(/ /g, '_')): WireNoun => ({ icon, one, other });
export const q = (id: string, kind: QuantityKind, value: string, n: WireNoun | null = null, unit: UnitId | null = null): WireQuantity => ({ id, kind, noun: n, unit, value });
