import { redirect } from "@tanstack/react-router";
import { z } from "zod";
import type { AuthSession } from "../auth";
import type { SignedInMe } from "../../account/contracts";
import { continuationSearch } from "../lib/funded-entry";
import { authStep, type AuthSearch } from "./auth-links";
import { queryClient, sessionOptions } from "../lib/query";
import { studentSession } from "../lib/student-device";
import { nativeRuntime } from "../native-runtime";
import { studentPracticeHref } from "../features/profiles/practice-mode";
import { RETURN_LIMIT } from "../features/spaces/returns";

/*
 * The sign-in gate (amp/AGENTS.md, "Frontend architecture"): the one place a
 * route guard sends someone away from a screen that isn't theirs to open.
 * Each is ONE hop, replacing the address:
 *
 * - signed out, to sign-in, which comes back (`requireSignedIn`);
 * - a school student's device, to their own practice (`adults`);
 * - the store apps, to their home screen (`web`);
 * - a signed-in person on a screen that isn't theirs, to their own place
 *   (`toOwnPlace`), never through `/`;
 * - a signed-in person on a screen that isn't theirs YET or any more (a
 *   first-run step not reached, a setup step not open, a start already
 *   made), to the one screen that is (`elsewhere`), its address computed
 *   once by the guard from canonical state.
 *
 * Guards call these; nothing else in a guard redirects. Old addresses are
 * app/legacy-aliases.ts's, and a provider's return value is
 * app/third-party-returns.ts's. This is a sanctioned mechanism
 * (tests/architecture-ratchet.test.ts, SANCTIONED).
 */

/** Who may open a screen, beyond being signed in. */
export type Admits = {
  /** Only on the web: the store apps open their home screen instead. */
  web?: boolean;
  /** Only an adult's device: a school student's opens their practice. */
  adults?: boolean;
};

/** Where a guard's location is: the router's. */
export type GateLocation = {
  pathname: string;
  searchStr?: string;
  search?: unknown;
};

/** `path?key=value…` from string values (others are left out). */
export function withQuery(path: string, query: Record<string, unknown> = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (typeof value === "string") params.set(key, value);
  const text = params.toString();
  return text ? `${path}?${text}` : path;
}

/** How sign-in comes back: by the continuation the address carries (a
 * campaign, a program, a return; lib/funded-entry.ts), for a place (a
 * school's, a family's) straight back to this address, or by a return of
 * its own (`{ return: "access" }`). */
export type Back = "continue" | "here" | AuthSearch;

/** The gate's way back, on the sign-in address's query: which kind of
 * return (lib/funded-entry.ts `continuationSearch`), and where a sign-in
 * continues, held to the one return contract (`appReturn`). Part of the
 * root's query schema (app/router.tsx). */
export const returnSearchShape = {
  return: z
    .enum([
      "free-practice",
      "security",
      "access",
      "arkansas-efa",
      "new-hampshire-efa",
      "arizona-esa",
      "school",
      "school-invite",
      "family-approval",
    ])
    .optional()
    .catch(undefined),
  next: z.string().max(RETURN_LIMIT).optional().catch(undefined),
};

/** A device this screen isn't for: one hop to the device's own home. */
export function admit({ web, adults }: Admits) {
  if (web && nativeRuntime) throw redirect({ to: "/", replace: true });
  if (adults && studentSession())
    throw redirect({ href: studentPracticeHref(), replace: true });
}

/** The sign-in address that comes back to `location`. */
export function signInTarget(location: GateLocation, back: Back = "continue") {
  return authStep(
    "sign-in",
    typeof back === "object"
      ? back
      : back === "here"
        ? {
            return: "school" as const,
            next: `${location.pathname}${location.searchStr ?? ""}`,
          }
        : continuationSearch(
            (location.search ?? {}) as Record<string, unknown>,
          ),
  );
}

/**
 * A screen that needs a signed-in account: the session, or one hop to
 * sign-in that comes back here. Checks `admits` first (a device that may
 * never open the screen isn't sent to sign in for it).
 */
export async function requireSignedIn(
  location: GateLocation,
  { back = "continue", ...admits }: Admits & { back?: Back } = {},
): Promise<AuthSession> {
  admit(admits);
  const session = await queryClient.ensureQueryData(sessionOptions);
  if (session) return session;
  if (back === "here") {
    // Account creation learns this person is on their way to a place.
    const { markSchoolSignup } = await import("../features/school/paths");
    markSchoolSignup("1");
  }
  throw redirect({ ...signInTarget(location, back), replace: true } as never);
}

/** The screen this person may open instead of the one asked for (its
 * address computed once, from canonical state): one hop, replacing it. */
export function elsewhere(
  target:
    | string
    | {
        to: string;
        search?: Record<string, unknown>;
        hash?: string;
        state?: Record<string, unknown>;
      },
): never {
  throw typeof target === "string"
    ? redirect({ href: target, replace: true })
    : redirect({ ...target, replace: true } as never);
}

/**
 * A signed-in person on a screen that isn't theirs (or an address that only
 * names "your place"): one hop to their own place, never through `/`.
 * Signed out, the pitch.
 */
export async function toOwnPlace(known?: SignedInMe): Promise<never> {
  const session = await queryClient
    .ensureQueryData(sessionOptions)
    .catch((error: unknown) => {
      console.warn(
        "The session couldn’t be read; opening as signed out",
        error,
      );
      return null;
    });
  const href = session
    ? await import("../features/home/destination")
        .then(({ homeDestination }) => homeDestination(session, known))
        .catch((error: unknown) => {
          console.warn("Your place didn’t load; opening home", error);
          return "/";
        })
    : "/";
  throw redirect({ href, replace: true });
}
