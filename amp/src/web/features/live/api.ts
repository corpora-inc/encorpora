import {
  queryOptions,
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import {
  liveSnapshotResponse,
  sessionListResponse,
  sessionReportResponse,
  startSessionResponse,
  type LiveSnapshot,
  type StartSessionBody,
} from "../../../schools/live/contracts";
import { liveTotals } from "../../../schools/live/status";
import {
  liveRowsMessage,
  liveSignalsMessage,
  STREAM_EVENTS,
  studentLiveResponse,
  type StudentLive,
} from "../../../schools/live/stream-contracts";
import type { AuthSession } from "../../auth";
import { request } from "../../lib/api";
import { qk } from "../../lib/keys";
import { useSession } from "../../lib/session";
import { classKey, type Place } from "../school/classes/teacher-api";

/* Live class sessions on the web (#2465): the snapshot, the session list
   and stored reports, start and stop, and what a message from the stream
   does to the one cache. Space-neutral: a family's class is a class here
   (`place` is the family's org and class), and screens choose the words. */

export type { Place };
const CLASS = ({ class: id }: Place) => `/school/classes/${id}`;

/** The live snapshot's key: under the class's prefix, so a change anywhere
 * in the class (start, stop, a roster change) refreshes it with the rest. */
export const liveKey = (session: AuthSession, place: Place) =>
  classKey(session, place, "live");

/** `GET …/live`: the running session, every student's row, the totals and
 * the open signals. `useLiveClass` keeps it current from the stream. */
export const liveOptions = (session: AuthSession, place: Place) =>
  queryOptions({
    queryKey: liveKey(session, place),
    queryFn: ({ signal }) =>
      request(`${CLASS(place)}/live`, liveSnapshotResponse, {
        token: session.token,
        signal,
      }),
    // The stream keeps it current, and a shown page reconnects with a
    // fresh snapshot: a focus refetch would only read it twice.
    refetchOnWindowFocus: false,
  });

/** `GET …/sessions`: the class's sessions, newest first, 20 a page. */
export const sessionsOptions = (
  session: AuthSession,
  place: Place,
  offset = 0,
) =>
  queryOptions({
    queryKey: classKey(session, place, "sessions", offset),
    queryFn: ({ signal }) =>
      request(
        `${CLASS(place)}/sessions?limit=20&offset=${offset}`,
        sessionListResponse,
        { token: session.token, signal },
      ),
  });

/** `GET …/sessions/:session`: a stopped session's stored report. It never
 * changes once stored. */
export const sessionReportOptions = (
  session: AuthSession,
  place: Place,
  sessionId: string,
) =>
  queryOptions({
    queryKey: classKey(session, place, "session", sessionId),
    queryFn: ({ signal }) =>
      request(
        `${CLASS(place)}/sessions/${encodeURIComponent(sessionId)}`,
        sessionReportResponse,
        { token: session.token, signal },
      ),
    staleTime: Infinity,
  });

/** Everything the class's screens show, read again: a session changes the
 * live view, the session list, Today and the time report alike. */
const refreshClass = (
  client: QueryClient,
  session: AuthSession,
  place: Place,
) => client.invalidateQueries({ queryKey: classKey(session, place) });

/** Start a session (`minutes` plans its end). Starting while one runs
 * answers that one. */
export function useStartSession(place: Place) {
  const session = useSession();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: StartSessionBody = {}) =>
      request(`${CLASS(place)}/sessions`, startSessionResponse, {
        token: session.token,
        body: body ?? {},
      }),
    onSuccess: () => refreshClass(client, session, place),
  });
}

/** Stop the session: the answer is its stored report, which the report
 * page then opens without another read. */
export function useStopSession(place: Place) {
  const session = useSession();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      request(
        `${CLASS(place)}/sessions/${encodeURIComponent(sessionId)}/stop`,
        sessionReportResponse,
        { token: session.token, method: "POST", body: {} },
      ),
    onSuccess: (report) => {
      client.setQueryData(
        sessionReportOptions(session, place, report.session.id).queryKey,
        report,
      );
      return refreshClass(client, session, place);
    },
  });
}

/** What one stream message does to the snapshot the cache holds. Pure:
 * `snapshot` replaces it; `rows` merges whole rows by person (for the session
 * held, else it is stale and dropped) and recomputes the totals; `signals`
 * replaces the list. Anything unreadable leaves it as it was, logged. */
export function applyLiveMessage(
  held: LiveSnapshot | undefined,
  event: string,
  data: unknown,
): LiveSnapshot | undefined {
  if (event === STREAM_EVENTS.snapshot) {
    const parsed = liveSnapshotResponse.safeParse(data);
    if (parsed.success) return parsed.data;
    console.error("AMP: a live snapshot wasn’t readable", parsed.error);
    return held;
  }
  if (event === STREAM_EVENTS.rows) {
    const parsed = liveRowsMessage.safeParse(data);
    if (!parsed.success) {
      console.error("AMP: live rows weren’t readable", parsed.error);
      return held;
    }
    if (!held || held.session?.id !== parsed.data.sessionId) return held;
    const changed = new Map(parsed.data.rows.map((row) => [row.personId, row]));
    const rows = held.rows.map((row) => {
      const next = changed.get(row.personId);
      changed.delete(row.personId);
      return next ?? row;
    });
    // A student who joined the class mid-session, in name order as the
    // server sorts.
    if (changed.size) {
      rows.push(...changed.values());
      rows.sort(
        (a, b) =>
          a.name.toLowerCase().localeCompare(b.name.toLowerCase()) ||
          a.personId.localeCompare(b.personId),
      );
    }
    return {
      ...held,
      serverNow: parsed.data.serverNow,
      rows,
      totals: liveTotals(rows),
    };
  }
  if (event === STREAM_EVENTS.signals) {
    const parsed = liveSignalsMessage.safeParse(data);
    if (!parsed.success) {
      console.error("AMP: live signals weren’t readable", parsed.error);
      return held;
    }
    return held && { ...held, signals: parsed.data.signals };
  }
  return held;
}

/** A student's own live state's key: the sessions in their classes and
 * their requests. */
export const studentLiveKey = (session: AuthSession) =>
  qk.account(session.accountId, "school", "student-live");

/** `GET /api/v1/school/student/live`: the student stream's poll. */
export const studentLiveOptions = (session: AuthSession) =>
  queryOptions({
    queryKey: studentLiveKey(session),
    queryFn: ({ signal }) =>
      request("/school/student/live", studentLiveResponse, {
        token: session.token,
        signal,
      }),
    refetchOnWindowFocus: false,
  });

/** A student stream's message: its `snapshot` is the whole state. */
export function applyStudentMessage(
  held: StudentLive | undefined,
  event: string,
  data: unknown,
): StudentLive | undefined {
  if (event !== STREAM_EVENTS.snapshot) return held;
  const parsed = studentLiveResponse.safeParse(data);
  if (parsed.success) return parsed.data;
  console.error("AMP: the student's live state wasn’t readable", parsed.error);
  return held;
}
