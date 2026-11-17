import { redirect } from "@tanstack/react-router";
import type { AuthSession } from "../auth";
import type { SignedInMe } from "../../account/contracts";
import { continuationSearch } from "../lib/funded-entry";
import { queryClient, sessionOptions } from "../lib/query";
import { studentSession } from "../lib/student-device";
import { nativeRuntime } from "../native-runtime";
import { studentPracticeHref } from "../features/profiles/practice-mode";

/*
 * The sign-in gate (amp/AGENTS.md, "Frontend architecture"): the one place a
 * route guard sends someone away from a screen that isn't theirs to open.
 * Each is ONE hop, replacing the address:
 *
 * - signed out, to sign-in, which comes back (`requireSignedIn`);
 * - a school student's device, to their own practice (`adults`);
 * - the store apps, to their home screen (`web`);
 * - a signed-in person on a screen that isn't theirs, to their own place
 *   (`toOwnPlace`), never through `/`.
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
  searchStr: string;
  search?: unknown;
};

/** How sign-in comes back: by the continuation the address carries (a
 * campaign, a program, a return; lib/funded-entry.ts), or, for a place
 * (a school's, a family's), straight back to this address. */
export type Back = "continue" | "here";

/** A device this screen isn't for: one hop to the device's own home. */
export function admit({ web, adults }: Admits) {
  if (web && nativeRuntime) throw redirect({ to: "/", replace: true });
  if (adults && studentSession())
    throw redirect({ href: studentPracticeHref(), replace: true });
}

/** The sign-in address that comes back to `location`. */
export function signInTarget(location: GateLocation, back: Back = "continue") {
  const search =
    back === "here"
      ? {
          return: "school" as const,
          next: `${location.pathname}${location.searchStr}`,
        }
      : continuationSearch((location.search ?? {}) as Record<string, unknown>);
  return { to: "/sign-in" as const, search };
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
