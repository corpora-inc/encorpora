import { z } from "zod";

/* Live class sessions (#2465): what the snapshot, the session routes, the
   stream (L2), the cockpit components (L3), signals (L4) and the session
   report (L5) exchange. Shared by the server and the web, so nothing here
   imports server code. Status values are keys; the words a screen shows for
   them live in the web and describe what is happening, never the child. */

const id = z.uuid();
const instant = z.iso.datetime();

export const liveStatuses = [
  "not_signed_in",
  "idle",
  "struggling",
  "flying",
  "working",
] as const;
export type LiveStatus = (typeof liveStatuses)[number];

export const sessionEndReasons = [
  "stopped",
  "planned_end",
  "time_limit",
] as const;
export type SessionEndReason = (typeof sessionEndReasons)[number];

export const signalKinds = ["hand", "forgot_picture"] as const;
export type SignalKind = (typeof signalKinds)[number];
export const signalResolutions = [
  "acknowledged",
  "reset",
  "withdrawn",
  "expired",
] as const;
export type SignalResolution = (typeof signalResolutions)[number];
/** An open signal nobody resolved stops showing after this long. */
export const SIGNAL_OPEN_MS = 30 * 60_000;

/** What an outbox row says changed (`amp_class_events.kind`). */
export const classEventKinds = [
  "answer",
  "help",
  "presence",
  "session",
  "signal",
] as const;
export type ClassEventKind = (typeof classEventKinds)[number];

/** A session never runs longer than this; a reader closes it then. */
export const MAX_SESSION_MINUTES = 240;

/** `POST …/sessions`: an optional planned length ("AMP for 15 minutes"). */
export const startSessionBody = z
  .strictObject({
    minutes: z.number().int().min(1).max(MAX_SESSION_MINUTES).optional(),
  })
  .nullish()
  .transform((body) => body ?? {});
export type StartSessionBody = z.input<typeof startSessionBody>;

/** The status rules, versioned: the snapshot carries the server's copy, and a
 * stored report names the version it was judged by. */
export const liveRulesResource = z.object({
  version: z.number().int().positive(),
  /** No answer and no help opened for this long: idle. */
  idleMs: z.number().int().positive(),
  /** The last this-many answers all wrong: struggling. */
  wrongRun: z.number().int().positive(),
  /** How many recent answers a row carries (and the next two rules read). */
  recent: z.number().int().positive(),
  /** At most this many right of the last `recent`: struggling. */
  struggleMaxCorrect: z.number().int().nonnegative(),
});
export type LiveRules = z.infer<typeof liveRulesResource>;

export const sessionResource = z.object({
  id,
  classId: id,
  startedAt: instant,
  /** The planned end, when the adult set a length. */
  plannedEndAt: instant.nullable(),
  /** When it stops counting: the planned end, or four hours after start. */
  endsAt: instant,
  endedAt: instant.nullable(),
  endReason: z.enum(sessionEndReasons).nullable(),
  /** The adult (their person in this place) who started or stopped it. */
  startedBy: id.nullable(),
  endedBy: id.nullable(),
  rulesVersion: z.number().int().positive(),
});
export type LiveSession = z.infer<typeof sessionResource>;

export const skillRefResource = z.object({
  id: z.string(),
  title: z.string(),
  strand: z.string(),
});
export type SkillRef = z.infer<typeof skillRefResource>;

/** One answer, as the status rules read it. */
export const liveOutcomeResource = z.object({
  correct: z.boolean(),
  assisted: z.boolean(),
});
export type LiveOutcome = z.infer<typeof liveOutcomeResource>;

/** Counts inside the session's window. Paper marks never count. */
const counts = {
  problems: z.number().int().nonnegative(),
  correct: z.number().int().nonnegative(),
  /** Right with no help. */
  independent: z.number().int().nonnegative(),
  /** Answers that had a hint or a lesson (`outcome.assisted`). */
  assisted: z.number().int().nonnegative(),
  /** Help opened: hints revealed, lessons, worked explanations, videos. */
  hints: z.number().int().nonnegative(),
  lessons: z.number().int().nonnegative(),
  examples: z.number().int().nonnegative(),
  videos: z.number().int().nonnegative(),
};

/** One student, live. Facts only: `liveStatus(row, …)` (status.ts) derives
 * the status, on the server for the report and on the client every 15 s. */
export const liveRowResource = z.object({
  personId: id,
  /** As the class's lists name them (`STUDENT_LABEL`). */
  name: z.string(),
  ...counts,
  /** The skill of their latest answer in the session. */
  skill: skillRefResource.nullable(),
  /** Their overall level estimate, as last stored; null before any. */
  level: z.number().nullable(),
  /** Their last answers in the session, at most `rules.recent`, oldest first. */
  recent: z.array(liveOutcomeResource),
  /** First seen in the session: signed in, a first heartbeat, an answer or
   * help, whichever came first. */
  firstSeenAt: instant.nullable(),
  firstAnswerAt: instant.nullable(),
  lastAnswerAt: instant.nullable(),
  /** Last help opened in the session (any kind but a print). */
  lastHelpAt: instant.nullable(),
  /** Last heartbeat or request from a student session, or from a parent's
   * device practicing as them; any day. */
  lastSeenAt: instant.nullable(),
  /** `lastSeenAt` falls on today in the class's school's timezone. */
  seenToday: z.boolean(),
});
export type LiveRow = z.infer<typeof liveRowResource>;

/** The class at a glance. `present`: students not "not signed in". */
export const liveTotalsResource = z.object({
  students: z.number().int().nonnegative(),
  present: z.number().int().nonnegative(),
  /** Students with at least one answer. */
  answering: z.number().int().nonnegative(),
  ...counts,
});
export type LiveTotals = z.infer<typeof liveTotalsResource>;

/** An open request from a student (L4 writes them). */
export const signalResource = z.object({
  id,
  personId: id,
  name: z.string(),
  kind: z.enum(signalKinds),
  createdAt: instant,
});
export type LiveSignal = z.infer<typeof signalResource>;

/** `GET /api/v1/school/classes/:class/live`. `session` null: none running,
 * and `rows` is empty; `signals` are read either way. */
export const liveSnapshotResponse = z.object({
  /** The server's clock, so the client ages `idle` from the same instant. */
  serverNow: instant,
  session: sessionResource.nullable(),
  rules: liveRulesResource,
  rows: z.array(liveRowResource),
  totals: liveTotalsResource,
  signals: z.array(signalResource),
  /** `manage`: this adult may start and stop sessions here. */
  can: z.object({ manage: z.boolean() }),
});
export type LiveSnapshot = z.infer<typeof liveSnapshotResponse>;

/** `POST …/sessions`: 201 with a new session, 200 with the one running. */
export const startSessionResponse = z.object({ session: sessionResource });

/** A student's frozen row in a stopped session's report. */
export const reportRowResource = z.object({
  personId: id,
  name: z.string(),
  ...counts,
  /** Skills answered, first answered first. */
  skills: z.array(skillRefResource),
  /** The skill of their last answer. */
  skill: skillRefResource.nullable(),
  level: z.number().nullable(),
  firstSeenAt: instant.nullable(),
  firstAnswerAt: instant.nullable(),
  lastAnswerAt: instant.nullable(),
  /** Their status when the session ended. */
  status: z.enum(liveStatuses),
});
export type ReportRow = z.infer<typeof reportRowResource>;

/** `GET …/sessions/:session` and `POST …/sessions/:session/stop`. */
export const sessionReportResponse = z.object({
  session: sessionResource,
  rows: z.array(reportRowResource),
  totals: liveTotalsResource,
});
export type SessionReport = z.infer<typeof sessionReportResponse>;

/** `GET …/sessions`: newest first. `totals` is null for the running one. */
export const sessionListResponse = z.object({
  sessions: z.array(
    sessionResource.extend({ totals: liveTotalsResource.nullable() }),
  ),
  nextOffset: z.number().int().nullable(),
});
export type SessionList = z.infer<typeof sessionListResponse>;
