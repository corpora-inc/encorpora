import { z } from "zod";
import {
  liveRowResource,
  liveSnapshotResponse,
  signalResource,
  studentSignalResource,
  type StudentSignal,
} from "./contracts.js";

/* The live stream's wire format (#2465, work package L2). Server-sent events
   over a plain streamed response, read with fetch (src/web/lib/live-stream.ts).
   Every message is state, never a delta to add up: the client replaces or
   merges what it holds, so a message seen twice or missed between two
   streams does no harm, and nothing is replayed. Web-safe: imports nothing
   from the server. */

/** Event names, as each frame's `event:` line carries them. */
export const STREAM_EVENTS = {
  /** Staff and student: everything, on connect and after a session starts
   * or stops. Replaces what the client holds. */
  snapshot: "snapshot",
  /** Staff: full rows for the students who changed, to merge by person. */
  rows: "rows",
  /** Staff: the class's whole open-signal list, to replace. */
  signals: "signals",
  /** Staff and student: the server is ending this stream on purpose;
   * reconnect. */
  bye: "bye",
} as const;

/** `rows`: the students whose rows changed, whole. Rows of another session
 * than the one the client holds are stale and dropped. The client recomputes
 * the class's totals from its merged rows (`liveTotals`). */
export const liveRowsMessage = z.object({
  serverNow: z.iso.datetime(),
  sessionId: z.uuid(),
  rows: z.array(liveRowResource),
});
export type LiveRowsMessage = z.infer<typeof liveRowsMessage>;

/** `signals`: the class's open signals, all of them. */
export const liveSignalsMessage = z.object({
  signals: z.array(signalResource),
});
export type LiveSignalsMessage = z.infer<typeof liveSignalsMessage>;

/** Why the server ended a stream. `rotate`: its lifetime (85–95 s, under the
 * load balancer's cut) is up. `shutdown`: this server is stopping. `slow`:
 * the client wasn't reading. Reconnect in every case. */
export const streamEndReasons = ["rotate", "shutdown", "slow"] as const;
export const byeMessage = z.object({ reason: z.enum(streamEndReasons) });
export type ByeMessage = z.infer<typeof byeMessage>;

/** A staff stream's `snapshot` is exactly `GET …/live`. */
export const staffSnapshotMessage = liveSnapshotResponse;

/** A session running in one of the student's classes: what the student may
 * know of it (never who started it). */
export const studentSessionResource = z.object({
  id: z.uuid(),
  classId: z.uuid(),
  startedAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
});
export type StudentSession = z.infer<typeof studentSessionResource>;

/** The student's own requests, as `GET /api/v1/school/student/signals`
 * (work package L4) reads them: open, or resolved in the last minute, so
 * their screen can move on by itself ("your teacher saw your hand"). Never
 * anyone else's. */
export { studentSignalResource, type StudentSignal };

/** `GET /api/v1/school/student/live` and the student stream's `snapshot`:
 * the sessions running in the student's classes and their own requests,
 * oldest first. Sent whole whenever either changes. */
export const studentLiveResponse = z.object({
  serverNow: z.iso.datetime(),
  sessions: z.array(studentSessionResource),
  signals: z.array(studentSignalResource),
});
export type StudentLive = z.infer<typeof studentLiveResponse>;
