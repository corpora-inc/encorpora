import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { AuthSession } from "../../auth";
import { readyLazy } from "../../lib/ready-lazy";
import { useSessionOrNull } from "../../lib/session";
import { logAhead } from "../../lib/ahead";

/** The raised hand's code loads only for a school student's practice: the
 * route's loader fetches it ahead of the screen (app/router.tsx, `/$`), so
 * the practice bar paints with it, and a parent's or adult's practice never
 * downloads it. Nothing paints in its place meanwhile. */
const hand = readyLazy<{ problem?: string }>(
  async () => (await import("./RaiseHand")).RaiseHand,
  "The raised hand",
);

/** The student stream's code (useStudentLive.ts), a student's practice's
 * only, the same way. */
const streamCode = () => import("./useStudentLive");

/** How long practice waits to learn whether a session runs. */
const LIVE_WAIT_MS = 1_500;

/** Ahead of a school student's practice: the hand's code, and whether a
 * session runs in one of their classes now, which decides where the hand is
 * (the bar while one runs, the menu otherwise). With both in hand the bar's
 * first frame is its last: no button arrives after it. The answer is the
 * student stream's own cache entry; a slow or failed read never holds the
 * problem back, and the stream brings it a moment later. */
export function preloadStudentHand(client: QueryClient, session: AuthSession) {
  const live = import("./api")
    .then(({ studentLiveOptions }) =>
      client.ensureQueryData(studentLiveOptions(session)),
    )
    .catch((error: unknown) =>
      logAhead("Whether a session runs will load with practice", error),
    );
  return Promise.all([
    hand.preload(),
    streamCode().catch((error: unknown) =>
      console.warn("The student's stream will load with practice", error),
    ),
    Promise.race([
      live,
      new Promise<void>((resolve) => setTimeout(resolve, LIVE_WAIT_MS)),
    ]),
  ]);
}
const RaiseHandCode = hand.Component;
/** The practice bar's raised hand: a school student's session only.
 * `problem` is the problem on screen: the hand's place is settled as each
 * one arrives (RaiseHand.tsx). */
export function StudentHand({ problem }: { problem?: string }) {
  const session = useSessionOrNull();
  return session?.token.startsWith("st_") ? (
    <RaiseHandCode problem={problem} />
  ) : null;
}

/**
 * A student's one stream, for as long as practice is on screen (`on`).
 * Practice holds this once, above the workspace it mounts anew for each
 * problem (app/LegacyApp.tsx), so a new problem opens no stream and asks
 * the server nothing: the hand reads what this keeps. Leaving practice
 * closes it. A student sign-in only.
 */
export function useStudentStream(on: boolean) {
  const signedIn = useSessionOrNull();
  const session = on && signedIn?.token.startsWith("st_") ? signedIn : null;
  const client = useQueryClient();
  useEffect(() => {
    if (!session) return;
    let close: (() => void) | undefined;
    let gone = false;
    streamCode().then(
      ({ holdStudentStream }) => {
        if (!gone) close = holdStudentStream(client, session);
      },
      (error: unknown) =>
        console.warn("The student's stream didn’t open", error),
    );
    return () => {
      gone = true;
      close?.();
    };
  }, [client, session]);
}
