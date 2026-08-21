/**
 * Place names, indexed from the units column.
 *
 * One key per place rather than a generated `dw.term.place.10-3`: a place name is
 * a word in every language this ships in, several of them do not build it by
 * exponent, and a key a translator cannot see is a key nobody translates.
 *
 * Shared because two families name a place — the one that asks what a digit in a
 * place is worth, and the one that says which place two numbers first differ in —
 * and two spellings of one `LocKey` is a template nobody translated twice.
 */

import { locKey } from "../../types/ids.ts";
import type { LocKey } from "../../types/ids.ts";

export const PLACE_TERM_KEYS: readonly LocKey[] = [
  locKey("dw.term.place.ones"),
  locKey("dw.term.place.tens"),
  locKey("dw.term.place.hundreds"),
  locKey("dw.term.place.thousands"),
  locKey("dw.term.place.ten-thousands"),
  locKey("dw.term.place.hundred-thousands"),
  locKey("dw.term.place.millions"),
];

/** Places after the point, indexed from the first one. */
export const DECIMAL_PLACE_TERM_KEYS: readonly LocKey[] = [
  locKey("dw.term.place.tenths"),
  locKey("dw.term.place.hundredths"),
  locKey("dw.term.place.thousandths"),
  locKey("dw.term.place.ten-thousandths"),
];

export const ALL_PLACE_TERM_KEYS = [...PLACE_TERM_KEYS, ...DECIMAL_PLACE_TERM_KEYS] as const;

/** The term for a place, or `null` above the largest one this program names. */
export function placeTerm(place: number): LocKey | null {
  const key = place >= 0 ? PLACE_TERM_KEYS[place] : DECIMAL_PLACE_TERM_KEYS[-place - 1];
  return key ?? null;
}
