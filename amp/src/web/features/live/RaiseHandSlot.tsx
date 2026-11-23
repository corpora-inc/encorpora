import type { QueryClient } from "@tanstack/react-query";
import type { AuthSession } from "../../auth";
import { readyLazy } from "../../lib/ready-lazy";
import { useSessionOrNull } from "../../lib/session";

/** The raised hand's code loads only for a school student's practice: the
 * route's loader fetches it ahead of the screen (app/router.tsx, `/$`), so
 * the practice bar paints with it, and a parent's or adult's practice never
 * downloads it. Nothing paints in its place meanwhile. */
const hand = readyLazy<{ problem?: string }>(
  async () => (await import("./RaiseHand")).RaiseHand,
  "The raised hand",
);

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
      console.warn("Whether a session runs will load with practice", error),
    );
  return Promise.all([
    hand.preload(),
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
