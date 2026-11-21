import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { StudentLive } from "../../../schools/live/stream-contracts";
import { openLiveStream } from "../../lib/live-stream";
import { forSession, useSessionOrNull } from "../../lib/session";
import { applyStudentMessage, studentLiveOptions } from "./api";

/** The student's state polls this often when a network holds the stream:
 * it changes when a session starts or stops, or an adult answers a request. */
const STUDENT_POLL_MS = 5_000;

/**
 * A signed-in student's own live state (#2465): whether a session is running
 * in one of their classes, and their own requests (a raised hand, a forgotten
 * picture) with how each was resolved, so their screen can move on by
 * itself. Kept current from the student stream while mounted, in the one
 * cache entry (`studentLiveOptions`). Never anyone else's.
 *
 * Only a school student's session (`st_…`) has one: a child practicing on a
 * parent's device has no student stream (v1), and this stays empty there.
 */
export function useStudentLive() {
  const signedIn = useSessionOrNull();
  const session = signedIn?.token.startsWith("st_") ? signedIn : null;
  const client = useQueryClient();
  const query = useQuery(forSession(session, studentLiveOptions));
  useEffect(() => {
    if (!session) return;
    const options = studentLiveOptions(session);
    const stream = openLiveStream({
      path: "/school/student/live/stream",
      token: session.token,
      onEvent: (event, data) =>
        client.setQueryData<StudentLive>(options.queryKey, (held) =>
          applyStudentMessage(held, event, data),
        ),
      poll: () => client.fetchQuery({ ...options, staleTime: 0 }),
      timing: { pollMs: STUDENT_POLL_MS },
    });
    return () => stream.close();
  }, [client, session]);
  const live = query.data;
  return {
    /** The sessions running in the student's classes now. */
    sessions: live?.sessions ?? [],
    /** Their own requests: open, or resolved in the last 30 minutes. */
    signals: live?.signals ?? [],
    /** A session is running in one of their classes. */
    inSession: !!live?.sessions.length,
    query,
  };
}
