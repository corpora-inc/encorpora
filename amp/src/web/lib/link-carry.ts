/**
 * An invitation or approval carried across a sign-in on this device
 * (docs/architecture/spaces.md, "Continuations"). Opening a link keeps it
 * in the page's memory only (`capability-entry.ts`); it is written here
 * only when its holder deliberately leaves the page to authenticate: signs
 * in, creates an account, confirms an address, or switches account. It
 * lasts as long as the page's own hold, two hours at most, and goes as soon
 * as the link is accepted, refused or over.
 *
 * An account change clears every carry (`forgetEveryLink`), except one that
 * "Use another account" started from the link itself: that one survives
 * this one exit, and the next sign-in makes it an ordinary carry again.
 */
import { AppError } from "./AppError";

export type LinkPath = "/school/invite" | "/family/approve";
export const LINK_PATHS: readonly LinkPath[] = [
  "/school/invite",
  "/family/approve",
];
/** How long a link is held, in memory or carried. */
export const HELD_FOR_MS = 2 * 60 * 60 * 1000;
const KEYS: Record<LinkPath, string> = {
  "/school/invite": "amp.school-invite",
  "/family/approve": "amp.family-approval",
};
type Carried = { value: string; until: number; switching?: true };

function write(path: LinkPath, carried: Carried) {
  try {
    localStorage.setItem(KEYS[path], JSON.stringify(carried));
  } catch (error) {
    console.warn("The link couldn’t be kept for sign-in on this device", error);
  }
}
function read(path: LinkPath): Carried | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEYS[path]);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const carried = JSON.parse(raw) as Partial<Carried> | null;
    if (typeof carried?.value === "string" && typeof carried.until === "number")
      return carried as Carried;
  } catch {
    // Not a carry this version wrote.
  }
  // Kept by an earlier version, with no lifetime: let go.
  dropCarry(path);
  return null;
}

/** The holder is leaving to authenticate: keep the link for the return. */
export function carryLink(
  path: LinkPath,
  value: string,
  { switching = false, now = Date.now() } = {},
) {
  write(path, {
    value,
    until: now + HELD_FOR_MS,
    ...(switching ? { switching: true as const } : {}),
  });
}

/** The link carried for this path, while it lasts. */
export function carriedLink(path: LinkPath, now = Date.now()) {
  const carried = read(path);
  if (!carried) return null;
  if (carried.until <= now) {
    dropCarry(path);
    return null;
  }
  return carried.value;
}

export function dropCarry(path: LinkPath) {
  try {
    localStorage.removeItem(KEYS[path]);
  } catch {
    // Nothing was kept, then.
  }
}

/** An account exit: every carry goes but an account switch's own, which
 * survives this exit only. Returns the paths still carried. */
export function forgetCarries(now = Date.now()): LinkPath[] {
  const kept: LinkPath[] = [];
  for (const path of LINK_PATHS) {
    const carried = read(path);
    if (carried?.switching && carried.until > now) {
      write(path, { value: carried.value, until: carried.until });
      kept.push(path);
    } else dropCarry(path);
  }
  return kept;
}

/** A sign-in arrived: a switch's carry is an ordinary one from now on, so
 * the next account change clears it. */
export function settleSwitches() {
  for (const path of LINK_PATHS) {
    const carried = read(path);
    if (carried?.switching)
      write(path, { value: carried.value, until: carried.until });
  }
}

/** The server refused the link itself (malformed, unknown, gone): it is over.
 * Anything else (offline, rate-limited, a server fault) may pass, so the
 * link is kept for another try. */
export const linkRefused = (error: unknown) =>
  error instanceof AppError && [400, 403, 404, 410].includes(error.status ?? 0);
