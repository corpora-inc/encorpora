import type { Json } from "../storage";

/**
 * The adult step before every account exit, and the one-time AI permission (Apple 5.1.2(i), COPPA).
 *
 * - Every exit that opens a Free2Z page (Connect, Manage Free2Z account, Delete Free2Z account), and Allow AI lessons,
 *   passes a neutral age screen: a birth year, nothing pre-filled or suggested, nothing on screen saying which answer
 *   passes. A pass is remembered in memory for GATE_MS, so a second exit right after stays smooth.
 * - A year that does not pass is refused calmly and locks every exit on this device for a day, so a second guess is
 *   not one tap away. The year itself is never stored or sent; only the outcome is.
 * - The first Connect also asks the account holder to allow AI lessons that send structured problem and progress state
 *   (never a name) to Free2Z and its OpenAI models. That permission is kept per device in the "local-device" journal
 *   (backups never export or restore journals) and withdrawn on sign-out.
 */
export const CONSENT_KEY = "aha-ai-consent";
/** Bump when the disclosure changes (another AI provider, other data sent): everyone is asked again. */
export const CONSENT_VERSION = 1;
export const ADULT_AGE = 18;
export const LOCK_MS = 24 * 60 * 60 * 1000;

/**
 * This device's state. `locked` closes every exit until `until`; it keeps an earlier AI permission (`grantedAt`), so a
 * failed step never stops AI lessons the account holder already allowed.
 */
export type ConsentState =
  | { status: "granted"; grantedAt: string }
  | { status: "needed" }
  | { status: "locked"; until: number; grantedAt?: string };

/** AI lessons may send data: permission was given (a lock on the exits does not withdraw it). */
export const aiAllowed = (state: ConsentState): boolean => state.status === "granted" || (state.status === "locked" && !!state.grantedAt);

/** What the device journal holds, read defensively: anything unreadable or older than this version asks again. */
export function readConsent(data: Json, now: number): ConsentState {
  if (!data || typeof data !== "object" || Array.isArray(data) || data.version !== CONSENT_VERSION) return { status: "needed" };
  const grantedAt = typeof data.grantedAt === "string" && !Number.isNaN(Date.parse(data.grantedAt)) ? data.grantedAt : undefined;
  if (typeof data.lockedUntil === "string") {
    const until = Date.parse(data.lockedUntil);
    if (Number.isFinite(until) && until > now) return { status: "locked", until, ...(grantedAt ? { grantedAt } : {}) };
  }
  return grantedAt ? { status: "granted", grantedAt } : { status: "needed" };
}

export const grantedRecord = (now: number): Json => ({ version: CONSENT_VERSION, grantedAt: new Date(now).toISOString() });
/** Locks every exit for a day from `now`, keeping an earlier permission. */
export const lockedRecord = (now: number, grantedAt?: string): Json =>
  ({ version: CONSENT_VERSION, lockedUntil: new Date(now + LOCK_MS).toISOString(), ...(grantedAt ? { grantedAt } : {}) });
/** What a lock leaves behind once it is over, and what sign-out keeps: an expired lock reads the same as none. */
export const grantOf = (state: ConsentState): string | undefined => state.status === "needed" ? undefined : state.grantedAt;

export type BirthYearCheck = "adult" | "minor" | "invalid";

/**
 * A four-digit year within a plausible lifetime. With only the year known, the person is at least
 * (this year - year - 1) years old, so an adult is someone who is certainly 18 already.
 */
export function checkBirthYear(input: string, now: Date): BirthYearCheck {
  const text = input.trim();
  if (!/^\d{4}$/.test(text)) return "invalid";
  const year = Number(text), current = now.getFullYear();
  if (year > current || year < current - 120) return "invalid";
  return current - year - 1 >= ADULT_AGE ? "adult" : "minor";
}

/**
 * Every way AHA leaves for a Free2Z page (Connect opens the system sign-in; Manage and Delete open account pages in the
 * system browser), plus Allow AI lessons for a session signed in without permission. Each one passes the adult step.
 */
export const ACCOUNT_EXITS = ["connect", "manage", "delete", "allow"] as const;
export type AccountExit = (typeof ACCOUNT_EXITS)[number];
/** The exits that open a Free2Z page in the browser. */
export const BROWSER_EXITS: readonly AccountExit[] = ["connect", "manage", "delete"];
/** A passed step is remembered this long in memory only, so a second exit right after the first stays smooth. */
export const GATE_MS = 5 * 60 * 1000;

/** The exits that send learning data to Free2Z's AI afterwards, and so need this device's AI permission too. */
export const needsConsent = (exit: AccountExit, consent: ConsentState): boolean =>
  (exit === "connect" || exit === "allow") && !aiAllowed(consent);

/** The adult step's pass, in memory only: a relaunch or GATE_MS later asks again. */
export class AdultGate {
  private passedAt: number | undefined;
  pass(now: number): void { this.passedAt = now; }
  fresh(now: number): boolean { return this.passedAt !== undefined && now >= this.passedAt && now - this.passedAt < GATE_MS; }
  reset(): void { this.passedAt = undefined; }
}

/** Whether an exit may run now without showing the step: a fresh pass, no lock, and permission where it needs one. */
export function exitClear(exit: AccountExit, gate: AdultGate, consent: ConsentState, now: number): boolean {
  return consent.status !== "locked" && gate.fresh(now) && !needsConsent(exit, consent);
}
