import { useSyncExternalStore } from "react";

/*
 * The funding program a visitor came to AMP through (an Arizona ESA, an
 * Arkansas or New Hampshire EFA), before any account: one choice per tab,
 * kept in sessionStorage so a refresh, Back and every next screen (sign-up,
 * the first run, the invoice) know it without a query string. An ad's
 * `?program=` is read once on arrival (`keepArrivalProgram`), the way a
 * third party's return value is.
 *
 * Dependency-free (React only): the pitch loads it without auth, router or
 * query (scripts/check-bundle-budget.ts).
 */

/** Every program AMP sells through (lib/funded-entry.ts `fundedPrograms`
 * ids; lib/__tests__/program-choice.test.ts keeps the two lists equal). */
export const PROGRAM_CHOICES = ["ar-efa", "az-esa", "nh-efa"] as const;
export type ProgramChoice = (typeof PROGRAM_CHOICES)[number];
export const isProgramChoice = (value: unknown): value is ProgramChoice =>
  PROGRAM_CHOICES.includes(value as ProgramChoice);

const KEY = "amp.program-choice";
/** This page's copy: storage can be blocked, and the choice still holds
 * for the page. */
let current: ProgramChoice | null | undefined;
const listeners = new Set<() => void>();

/** The program this tab chose, or null. */
export function chosenProgram(): ProgramChoice | null {
  if (current !== undefined) return current;
  try {
    const kept = sessionStorage.getItem(KEY);
    current = isProgramChoice(kept) ? kept : null;
  } catch (error) {
    console.warn("The chosen program couldn’t be read", error);
    current = null;
  }
  return current;
}

/** Chooses a program for this tab (null: none). */
export function chooseProgram(program: ProgramChoice | null) {
  if (chosenProgram() === program) return;
  current = program;
  try {
    if (program) sessionStorage.setItem(KEY, program);
    else sessionStorage.removeItem(KEY);
  } catch (error) {
    console.warn("The chosen program lasts for this page only", error);
  }
  for (const listener of listeners) listener();
}

/** An arrival's `?program=` (an ad's, a funding page's link), kept for the
 * tab. A visit that names none keeps the choice already made. */
export function keepArrivalProgram(search: Record<string, unknown>) {
  if (isProgramChoice(search.program)) chooseProgram(search.program);
  return chosenProgram();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** The chosen program, kept current on screen. */
export function useChosenProgram(): ProgramChoice | null {
  return useSyncExternalStore(subscribe, chosenProgram, () => null);
}

/** Forgets the cached copy (tests). */
export function resetProgramChoiceForTests() {
  current = undefined;
}
