import type {
  LiveRow,
  LiveRules,
  LiveStatus,
  LiveTotals,
  ReportRow,
} from "./contracts.js";

/* A student's live status, from the facts in their row. Pure and shared: the
   server judges the report with it when a session stops, and the web re-derives
   it on its own clock between updates (who is here and who is idle both turn
   with time). Imports types only, so the web can import it. First match wins. */

export const LIVE_RULES: LiveRules = {
  version: 2,
  hereMs: 600_000,
  idleMs: 120_000,
  wrongRun: 3,
  recent: 5,
  struggleMaxCorrect: 2,
};

/** What `liveStatus` reads from a row. */
export type StatusFacts = Pick<
  LiveRow,
  | "problems"
  | "hints"
  | "lessons"
  | "examples"
  | "videos"
  | "recent"
  | "firstSeenAt"
  | "lastAnswerAt"
  | "lastHelpAt"
  | "lastSeenAt"
>;

const time = (iso: string | null) => (iso === null ? null : Date.parse(iso));
const latest = (...times: (number | null)[]) =>
  Math.max(...times.filter((t): t is number => t !== null));

/** Any answer or help opened inside the session's window. */
export const activeInSession = (row: StatusFacts) =>
  row.problems > 0 ||
  row.hints + row.lessons + row.examples + row.videos > 0 ||
  row.lastHelpAt !== null;

/**
 * Here: something of theirs happened in the session (an answer, help, a
 * sign-in or a raised hand: `firstSeenAt`), or their own device was seen in
 * the `hereMs` before `now`. Practice earlier in the day is not here, and an
 * adult's device never is (`rows.ts` reads only what is the student's own).
 */
export function isHere(
  row: StatusFacts,
  now: number | Date,
  rules: LiveRules = LIVE_RULES,
): boolean {
  if (activeInSession(row) || row.firstSeenAt !== null) return true;
  const seen = time(row.lastSeenAt);
  return (
    seen !== null &&
    (typeof now === "number" ? now : now.getTime()) - seen < rules.hereMs
  );
}

/**
 * 1. `not_signed_in`: not here (`isHere`).
 * 2. `idle`: no answer and no help for `idleMs`, counted from the later of the
 *    session's start and when they were first seen in it.
 * 3. `struggling`: the last `wrongRun` answers all wrong, or at most
 *    `struggleMaxCorrect` right of the last `recent`.
 * 4. `flying`: the last `recent` answers all right with no help.
 * 5. `working`: everything else.
 */
export function liveStatus(
  row: StatusFacts,
  at: { now: number | Date; startedAt: string },
  rules: LiveRules = LIVE_RULES,
): LiveStatus {
  const now = typeof at.now === "number" ? at.now : at.now.getTime();
  if (!isHere(row, now, rules)) return "not_signed_in";
  const since = latest(
    Date.parse(at.startedAt),
    time(row.firstSeenAt),
    time(row.lastAnswerAt),
    time(row.lastHelpAt),
  );
  if (now - since >= rules.idleMs) return "idle";
  const recent = row.recent.slice(-rules.recent);
  const run = recent.slice(-rules.wrongRun);
  if (run.length === rules.wrongRun && run.every((o) => !o.correct))
    return "struggling";
  if (
    recent.length === rules.recent &&
    recent.filter((o) => o.correct).length <= rules.struggleMaxCorrect
  )
    return "struggling";
  if (
    recent.length === rules.recent &&
    recent.every((o) => o.correct && !o.assisted)
  )
    return "flying";
  return "working";
}

const zero = (): LiveTotals => ({
  students: 0,
  present: 0,
  answering: 0,
  problems: 0,
  correct: 0,
  independent: 0,
  assisted: 0,
  hints: 0,
  lessons: 0,
  examples: 0,
  videos: 0,
});
const add = (
  totals: LiveTotals,
  row: Omit<LiveTotals, "students" | "present" | "answering">,
  present: boolean,
) => {
  totals.students++;
  if (present) totals.present++;
  if (row.problems > 0) totals.answering++;
  for (const key of [
    "problems",
    "correct",
    "independent",
    "assisted",
    "hints",
    "lessons",
    "examples",
    "videos",
  ] as const)
    totals[key] += row[key];
  return totals;
};

/** The class's totals over live rows at `now`. Present: anyone not "not
 * signed in" (`isHere`), so it turns with the clock as that status does. */
export const liveTotals = (
  rows: readonly LiveRow[],
  now: number | Date,
  rules: LiveRules = LIVE_RULES,
): LiveTotals =>
  rows.reduce(
    (totals, row) => add(totals, row, isHere(row, now, rules)),
    zero(),
  );

/** The same totals over a stopped session's frozen rows. */
export const reportTotals = (rows: readonly ReportRow[]): LiveTotals =>
  rows.reduce(
    (totals, row) => add(totals, row, row.status !== "not_signed_in"),
    zero(),
  );
