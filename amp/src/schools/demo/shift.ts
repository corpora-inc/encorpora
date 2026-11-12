/**
 * Moves a static demo term (`roster.ts`, anchor variants) to the day a shared
 * school is written for. Every date moves by whole weeks, so each day keeps
 * its weekday, and every time keeps its wall clock: an answer at 9:30 in the
 * anchor's New York is at 9:30 in the school's own zone. Nothing else
 * changes: the same problems, responses, levels and help, in the same order.
 */
import { ANCHOR_OFFSET_MS, zonedInstant } from "./roster.js";
import type { TermSource } from "./snapshot.js";
import type { Simulation } from "./term-rows.js";

const DAY = 86_400_000;
const iso = (time: number) => new Date(time).toISOString().slice(0, 10);

export function termShifter(days: number, timezone: string) {
  if (days % 7 !== 0) throw new Error("A demo term moves by whole weeks");
  /** The zone's offset from UTC on a day, at midday (school hours). */
  const offsets = new Map<string, number>();
  const offsetOn = (day: string) => {
    let found = offsets.get(day);
    if (found === undefined) {
      found = Date.parse(`${day}T12:00:00Z`) - zonedInstant(day, 12, timezone);
      offsets.set(day, found);
    }
    return found;
  };
  const shiftDay = (day: string) =>
    iso(Date.parse(`${day}T12:00:00Z`) + days * DAY);
  const shiftAt = (at: string) => {
    // The anchor's wall clock, as if it were UTC, moved by `days`.
    const wall = Date.parse(at) + ANCHOR_OFFSET_MS + days * DAY;
    return new Date(wall - offsetOn(iso(wall))).toISOString();
  };
  return { shiftDay, shiftAt };
}

/** `terms`, every date `days` later (a multiple of 7) in `timezone`. */
export function shiftTerms(
  terms: readonly Simulation[],
  days: number,
  timezone: string,
): Simulation[] {
  const { shiftDay, shiftAt } = termShifter(days, timezone);
  return terms.map((term) => ({
    answers: term.answers.map((row) => ({
      ...row,
      at: shiftAt(row.at),
      day: shiftDay(row.day),
    })),
    active: term.active.map((row) => ({ ...row, day: shiftDay(row.day) })),
    help: term.help.map((row) => ({
      ...row,
      at: shiftAt(row.at),
      day: shiftDay(row.day),
    })),
    levels: term.levels.map((row) => ({ ...row, day: shiftDay(row.day) })),
    truth: term.truth,
  }));
}

/** `shiftTerms` over a shipped school (`snapshot.ts`), a slice at a time, so
 * a pod holds only the students it is writing. */
export function shiftedTerms(
  terms: TermSource,
  days: number,
  timezone: string,
): TermSource {
  termShifter(days, timezone);
  return {
    length: terms.length,
    slice: (from, to) => shiftTerms(terms.slice(from, to), days, timezone),
  };
}
