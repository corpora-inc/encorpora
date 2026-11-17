import { skipToken, useQuery } from "@tanstack/react-query";
import { use } from "react";
import type { AuthSession } from "../auth";
import { AppError } from "./AppError";
import { sessionOptions } from "./query";

/**
 * The current session, the one way a component reads it
 * (docs/architecture/frontend-patterns.md, "Session"). It is read from the
 * Query cache (`sessionOptions`), its only owner, so every screen sees a
 * sign-in, renewal or sign-out at once; never pass it down as a prop, copy it
 * into state, or build a stand-in to call a hook with. A signed-in route's
 * guard (`beforeLoad`) makes sure of the session before its screen renders,
 * so on such a screen `useSession()` is never null. The session leaves the
 * cache only as the page leaves for sign-in (`signOut`, an ended sign-in in
 * app/router.tsx): the screen then holds still under its route's pending
 * screen rather than render without one. If the page has not left after
 * `LEAVE_MS`, a screen was opened without its guard; that fails into the
 * route's error screen, which logs it. Public screens use
 * `useSessionOrNull()`.
 */
export function useSession(): AuthSession {
  const session = useSessionOrNull();
  return session ?? use(signedOut());
}

/** The session on a screen anyone may open: null when signed out. */
export function useSessionOrNull(): AuthSession | null {
  return useQuery(sessionOptions).data ?? null;
}

/** A session's query on a screen that may be signed out:
 * `useQuery(forSession(session, meOptions))`. Signed out, it asks nothing
 * and stays pending. Use it instead of a stand-in session
 * (`{ accountId: "", token: "" }`) and an `enabled` flag. */
export function forSession<Options extends object>(
  session: AuthSession | null,
  options: (session: AuthSession) => Options,
): Options {
  return session
    ? options(session)
    : ({ ...options(SIGNED_OUT), queryFn: skipToken } as Options);
}
// Only ever paired with `skipToken` above: nothing is asked with it.
const SIGNED_OUT: AuthSession = { accountId: "", token: "" };

/** How long a page has to leave for sign-in once its session ended. */
export const LEAVE_MS = 10_000;
// One wait for every screen: `use` needs the same promise on each render.
let leaving: Promise<never> | undefined;
function signedOut() {
  leaving ??= new Promise<never>((_, reject) =>
    setTimeout(
      () =>
        reject(
          new AppError(
            "authentication",
            "You’re signed out. Sign in to continue.",
            false,
          ),
        ),
      LEAVE_MS,
    ),
  );
  return leaving;
}
