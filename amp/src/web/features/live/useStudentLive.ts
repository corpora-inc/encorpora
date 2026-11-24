import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  STREAM_EVENTS,
  type StudentLive,
} from "../../../schools/live/stream-contracts";
import { qk } from "../../lib/keys";
import { openLiveStream } from "../../lib/live-stream";
import { forSession, useSessionOrNull } from "../../lib/session";
import { applyStudentMessage, studentLiveOptions } from "./api";

/** The student's state polls this often when a network holds the stream:
 * it changes when a session starts or stops, or an adult answers a request. */
const STUDENT_POLL_MS = 5_000;
/** While a network holds the stream, the student's practice settings are
 * read again this often: as often as a stream's own lifetime brings a
 * snapshot (85 to 95 s). */
const SETTINGS_WHILE_POLLING_MS = 90_000;

/**
 * A signed-in student's own live state (#2465): whether a session is running
 * in one of their classes, and their own requests (a raised hand, a forgotten
 * picture) with how each was resolved, so their screen can move on by
 * itself. Kept current from the student stream while mounted, in the one
 * cache entry (`studentLiveOptions`). Never anyone else's.
 *
 * Only a school student's session (`st_…`) has one: a child practicing on a
 * parent's device has no student stream (v1), and this stays empty there.
 *
 * It is also how a class's settings reach a student who is already
 * practicing (the look their teacher chose and locked): each whole state
 * the stream sends (on connect, so at least every 95 s, and when a session
 * starts or stops or their own request changes) marks their practice
 * settings stale, and the screens that show them read them again. Nothing
 * is asked of the server per problem. The stream doesn't yet say when a
 * class's settings change, so the look arrives within a stream's lifetime,
 * not at once.
 */
export function useStudentLive() {
  const signedIn = useSessionOrNull();
  const session = signedIn?.token.startsWith("st_") ? signedIn : null;
  const client = useQueryClient();
  const query = useQuery(forSession(session, studentLiveOptions));
  useEffect(() => {
    if (!session) return;
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
    });
    return () => stream.close();
  }, [client, session]);
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
