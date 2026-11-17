import { useSyncExternalStore } from "react";

/*
 * The arrival store: what a visitor came to AMP through, before any account,
 * kept per tab in sessionStorage so a refresh, Back and every next screen
 * (sign-up, the first run, the invoice) know it without a query string:
 *
 * - the funding program (an Arizona ESA, an Arkansas or New Hampshire EFA);
 * - the ad's campaign labels (`utm_*`), for attribution;
 * - why this visitor is signing up (`signUpEntry`): the pitch's Try it free
 *   or Buy, a partner's link. It picks the sign-up screen's words and is
 *   recorded with the new account; it never rides on an address.
 *
 * An ad's address is read once on arrival (`keepArrival`), the way a third
 * party's return value is.
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

/** The labels an ad puts on its link. Kept when each is a plain identifier
 * (at most 100 characters) and the visitor hasn't opted out (GPC); readers
 * still check them against the known campaigns (lib/funded-entry.ts
 * `campaignSearch`, which honors a privacy preference set later). */
export const CAMPAIGN_LABELS = [
  "utm_campaign",
  "utm_source",
  "utm_medium",
  "utm_content",
] as const;
export type ArrivalLabels = Partial<
  Record<(typeof CAMPAIGN_LABELS)[number], string>
>;
const LABELS_KEY = "amp.arrival-labels";
let labels: ArrivalLabels | undefined;

/** The campaign labels this tab arrived with, unchecked ({} for none). */
export function arrivalLabels(): ArrivalLabels {
  if (labels !== undefined) return labels;
  try {
    const kept: unknown = JSON.parse(
      sessionStorage.getItem(LABELS_KEY) ?? "{}",
    );
    labels = pickLabels(
      kept && typeof kept === "object" ? (kept as Record<string, unknown>) : {},
    );
  } catch (error) {
    console.warn("The arrival's campaign couldn’t be read", error);
    labels = {};
  }
  return labels;
}

/** A label as ads write them: a plain identifier, never free text (an
 * address, a name). */
const LABEL = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

function pickLabels(search: Record<string, unknown>): ArrivalLabels {
  const picked: ArrivalLabels = {};
  for (const key of CAMPAIGN_LABELS) {
    const value = search[key];
    if (typeof value === "string" && LABEL.test(value)) picked[key] = value;
  }
  return picked;
}

/** Global Privacy Control: a binding opt-out of sale and sharing, so no
 * campaign label is kept (lib/funded-entry.ts measurementOptOut). */
function optedOut() {
  return (
    typeof navigator !== "undefined" &&
    (navigator as Navigator & { globalPrivacyControl?: boolean })
      .globalPrivacyControl === true
  );
}

/** Why a visitor signs up: what they chose on the pitch (`pitch-*`, a
 * choice that survives a privacy preference), or a partner's link label
 * (measurement, dropped under GPC). parent-followup/contracts.ts
 * `signupEntrySchema` is the server's list (lib/__tests__/program-choice.test.ts
 * keeps the two equal). */
export const SIGN_UP_ENTRIES = [
  "pitch-try",
  "pitch-workbook",
  "pitch-buy",
  "openai-math-path",
  "openai-math-plans",
] as const;
export type SignUpEntry = (typeof SIGN_UP_ENTRIES)[number];
const isSignUpEntry = (value: unknown): value is SignUpEntry =>
  SIGN_UP_ENTRIES.includes(value as SignUpEntry);
const isPitchChoice = (value: SignUpEntry) => value.startsWith("pitch-");

/** What a sign-up is for: an entry, and whether it starts the free trial
 * (an older link's `return=free-practice`, the pitch's Try it free). */
export type SignUpIntent = { entry?: SignUpEntry; free?: boolean };
const ENTRY_KEY = "amp.sign-up-entry";
let intent: SignUpIntent | undefined;

/** Why this tab is signing up ({} for nothing in particular). */
export function signUpIntent(): SignUpIntent {
  if (intent !== undefined) return intent;
  try {
    const kept: unknown = JSON.parse(sessionStorage.getItem(ENTRY_KEY) ?? "{}");
    intent = pickIntent(
      kept && typeof kept === "object" ? (kept as Record<string, unknown>) : {},
    );
  } catch (error) {
    console.warn("Why this tab is signing up couldn’t be read", error);
    intent = {};
  }
  return intent;
}

function pickIntent(value: Record<string, unknown>): SignUpIntent {
  const entry =
    isSignUpEntry(value.entry) && (isPitchChoice(value.entry) || !optedOut())
      ? value.entry
      : undefined;
  return {
    ...(entry ? { entry } : {}),
    ...(value.free === true || entry === "pitch-try" ? { free: true } : {}),
  };
}

/** Sets why this tab is signing up: the pitch's Try it free or Buy, before
 * it opens sign-up at its plain address. `null` forgets it (Sign in). */
export function keepSignUpIntent(next: SignUpIntent | null) {
  intent = next ? pickIntent(next) : {};
  try {
    if (Object.keys(intent).length)
      sessionStorage.setItem(ENTRY_KEY, JSON.stringify(intent));
    else sessionStorage.removeItem(ENTRY_KEY);
  } catch (error) {
    console.warn("Why this tab is signing up lasts for this page only", error);
  }
}

/**
 * The tab's arrival as an address's query, for the one place it must cross
 * into another browser: the in-app browser's handoff to the phone's own
 * (features/auth/browser-handoff.ts), whose storage starts empty. The other
 * browser reads it once on arrival (`keepArrival`) and cleans the address.
 */
export function arrivalQuery(): Record<string, string> {
  const { entry, free } = signUpIntent();
  const program = chosenProgram();
  return {
    ...arrivalLabels(),
    ...(program ? { program } : {}),
    ...(entry ? { entry } : {}),
    ...(free && entry !== "pitch-try" ? { return: "free-practice" } : {}),
  };
}

/** An arrival's address (an ad's, a funding page's link, an older sign-up
 * link): its program, its campaign labels and why it signs up, kept for the
 * tab. A visit that names none keeps what was kept. */
export function keepArrival(search: Record<string, unknown>) {
  if (isProgramChoice(search.program)) chooseProgram(search.program);
  if (isSignUpEntry(search.entry) || search.return === "free-practice")
    keepSignUpIntent({
      ...(isSignUpEntry(search.entry) ? { entry: search.entry } : {}),
      free: search.return === "free-practice",
    });
  const given = optedOut() ? {} : pickLabels(search);
  if (Object.keys(given).length) {
    labels = given;
    try {
      sessionStorage.setItem(LABELS_KEY, JSON.stringify(given));
    } catch (error) {
      console.warn("The arrival's campaign lasts for this page only", error);
    }
  }
  return { program: chosenProgram(), labels: arrivalLabels() };
}

/** An arrival's program, kept (`keepArrival`). */
export function keepArrivalProgram(search: Record<string, unknown>) {
  return keepArrival(search).program;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** The chosen program, kept current on screen. */
export function useChosenProgram(): ProgramChoice | null {
  return useSyncExternalStore(subscribe, chosenProgram, () => null);
}

/** Forgets the cached copies (tests). */
export function resetProgramChoiceForTests() {
  current = undefined;
  labels = undefined;
  intent = undefined;
}
