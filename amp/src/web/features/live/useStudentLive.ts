import { useQuery, type QueryClient } from "@tanstack/react-query";
import type { AuthSession } from "../../auth";
import {
  STREAM_EVENTS,
  type StudentLive,
} from "../../../schools/live/stream-contracts";
import { qk } from "../../lib/keys";
import { openLiveStream } from "../../lib/live-stream";
import { forSession, useSessionOrNull } from "../../lib/session";
import { setLookFed } from "../practice/look-feed";
import { applyStudentMessage, studentLiveOptions } from "./api";

/** The student's state polls this often when a network holds the stream:
 * it changes when a session starts or stops, or an adult answers a request. */
const STUDENT_POLL_MS = 5_000;
/** While a network holds the stream, the student's practice settings are
 * also read again this often, for the screens that show them outside a
 * problem; practice reads them with each answer meanwhile. */
const SETTINGS_WHILE_POLLING_MS = 90_000;

/**
 * A signed-in student's own live state (#2465): whether a session is running
 * in one of their classes, and their own requests (a raised hand, a forgotten
 * picture) with how each was resolved, so their screen can move on by
 * itself. One cache entry (`studentLiveOptions`), kept current by the
 * student stream. Never anyone else's.
 *
 * Every student sign-in (`st_…`) has one: a class's student, a family's
 * child on their own device, and a child on a device their parent handed
 * them (that sign-in is the child's own too, so they have the stream and
 * the hand, and the parent answers it). An adult's sign-in has none, and
 * this stays empty there.
 *
 * Two halves, so the stream outlives the problem:
 *
 * - `holdStudentStream` opens the stream and keeps the cache. Practice
 *   holds it once, above the workspace it mounts anew for each problem
 *   (`useStudentStream`, RaiseHandSlot.tsx, in app/LegacyApp.tsx): one
 *   stream for as long as practice is on screen, ended and opened again
 *   only as every stream is (the server ends each after 85 to 95 s; a
 *   hidden page holds none). Leaving practice closes it.
 * - `useStudentLive` reads what the stream keeps. The hand in the practice
 *   bar mounts with each problem and asks the server nothing.
 *
 * The stream is also how a change of settings reaches a student who is
 * already practicing ("Allow Colorful" turned off by a teacher, a school or
 * a parent): the server sends the whole state again when their settings
 * change (a `settings` row in the live outbox), as it does on connect and
 * when a session starts or stops or their own request changes, and each
 * whole state marks their practice settings stale, so the screens that show
 * them read them again: about a second after the switch. While it streams,
 * practice asks nothing more per problem; while a network holds it (it
 * polls), practice reads them with each answer instead
 * (features/practice/look-feed.ts).
 */
export function holdStudentStream(
  client: QueryClient,
  session: AuthSession,
): () => void {
  const options = studentLiveOptions(session);
  let settingsAt = Date.now();
  const refreshSettings = () => {
    settingsAt = Date.now();
    client
      .invalidateQueries({
        queryKey: qk.practiceSettingsOf(session.accountId),
      })
      .catch((error: unknown) =>
        console.warn("AMP: practice settings weren’t read again", error),
      );
  };
  const stream = openLiveStream({
    path: "/school/student/live/stream",
    token: session.token,
    onEvent: (event, data) => {
      client.setQueryData<StudentLive>(options.queryKey, (held) =>
        applyStudentMessage(held, event, data),
      );
      if (event === STREAM_EVENTS.snapshot) refreshSettings();
    },
    poll: async () => {
      const state = await client.fetchQuery({ ...options, staleTime: 0 });
      if (Date.now() - settingsAt >= SETTINGS_WHILE_POLLING_MS)
        refreshSettings();
      return state;
    },
    timing: { pollMs: STUDENT_POLL_MS },
    // Only a stream that streams tells this tab of a change at once.
    onMode: (mode) => setLookFed(mode === "streaming"),
  });
  return () => {
    setLookFed(false);
    stream.close();
  };
}

/** What the student stream keeps, read where it is shown. It opens nothing:
 * the screen's `holdStudentStream` does. Mounting it again (a new problem's
 * hand) reads the cache and asks the server nothing; with nothing in the
 * cache yet (the route's own read failed), it asks once. */
export function useStudentLive() {
  const signedIn = useSessionOrNull();
  const session = signedIn?.token.startsWith("st_") ? signedIn : null;
  const query = useQuery({
    ...forSession(session, studentLiveOptions),
    refetchOnMount: false,
  });
  const live = query.data;
  return {
    /** The sessions running in the student's classes now. */
    sessions: live?.sessions ?? [],
    /** Their own requests: open, or resolved in the last minute. */
    signals: live?.signals ?? [],
    /** A session is running in one of their classes. */
    inSession: !!live?.sessions.length,
    query,
  };
}
