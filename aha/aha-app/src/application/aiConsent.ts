import type { Json } from "../storage";

/**
 * The one-time step before Free2Z sign-in (Apple 5.1.2(i), COPPA): the Free2Z account holder confirms they are an
 * adult and allows AI lessons that send structured problem and progress state (never a name) to Free2Z and its
 * OpenAI models. Kept per device in the "local-device" journal, which backups never export or restore.
 *
 * The gate is a neutral age screen: a birth year, with nothing on screen saying which answer passes. A year that
 * does not pass locks the step on this device for a day, so a second guess is not one tap away. The year itself is
 * never stored or sent; only the outcome is.
 */
export const CONSENT_KEY = "aha-ai-consent";
/** Bump when the disclosure changes (another AI provider, other data sent): everyone is asked again. */
export const CONSENT_VERSION = 1;
export const ADULT_AGE = 18;
export const LOCK_MS = 24 * 60 * 60 * 1000;

export type ConsentState =
  | { status: "granted"; grantedAt: string }
  | { status: "needed" }
  | { status: "locked"; until: number };

/** What the device journal holds, read defensively: anything unreadable or older than this version asks again. */
export function readConsent(data: Json, now: number): ConsentState {
  if (!data || typeof data !== "object" || Array.isArray(data) || data.version !== CONSENT_VERSION) return { status: "needed" };
  if (typeof data.grantedAt === "string" && !Number.isNaN(Date.parse(data.grantedAt))) return { status: "granted", grantedAt: data.grantedAt };
  if (typeof data.lockedUntil === "string") {
    const until = Date.parse(data.lockedUntil);
    if (Number.isFinite(until) && until > now) return { status: "locked", until };
  }
  return { status: "needed" };
}

export const grantedRecord = (now: number): Json => ({ version: CONSENT_VERSION, grantedAt: new Date(now).toISOString() });
export const lockedRecord = (now: number): Json => ({ version: CONSENT_VERSION, lockedUntil: new Date(now + LOCK_MS).toISOString() });

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
