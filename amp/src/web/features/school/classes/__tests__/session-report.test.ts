import { expect, test } from "vitest";
import type {
  LiveSnapshot,
  ReportRow,
} from "../../../../../schools/live/contracts";
import { LIVE_RULES, reportStatus } from "../../../../../schools/live/status";
import { endedBetween } from "../../../live/api";
import {
  CLASS_REPORT_WORDS,
  followUp,
  sessionSkills,
} from "../SessionReportScreen";
import { DEFAULT_COCKPIT_SORT, sortOf } from "../today/live-sort";

/* What the report derives from the stored rows (#2465): who to follow up
 * with (each once, in plain words), and the skills by how many worked on
 * them. Nothing it shows is more than the stored report holds. */

const skill = (id: string, title: string) => ({ id, title, strand: "number" });
const fractions = skill("frac", "Adding fractions");
const decimals = skill("dec", "Comparing decimals");
const row = (name: string, patch: Partial<ReportRow> = {}): ReportRow => ({
  personId: `p-${name}`,
  name,
  problems: 0,
  correct: 0,
  independent: 0,
  assisted: 0,
  hints: 0,
  lessons: 0,
  examples: 0,
  videos: 0,
  skills: [],
  skill: null,
  level: 4,
  firstSeenAt: "2026-11-30T14:01:00.000Z",
  firstAnswerAt: null,
  lastAnswerAt: null,
  status: "working",
  ...patch,
});

const rows = [
  row("Ana", { status: "not_signed_in", firstSeenAt: null }),
  row("Ben", { status: "idle" }),
  row("Cal", {
    problems: 6,
    correct: 2,
    status: "struggling",
    skills: [fractions],
    skill: fractions,
    assisted: 5,
  }),
  row("Dee", {
    problems: 6,
    correct: 5,
    independent: 2,
    assisted: 4,
    skills: [decimals, fractions],
    skill: decimals,
  }),
  row("Eve", {
    problems: 9,
    correct: 9,
    independent: 9,
    status: "flying",
    skills: [fractions],
    skill: fractions,
  }),
];

test("follow up first: each student once, in the first group that fits", () => {
  expect(
    followUp(rows).map((group) => [
      group.title,
      group.members.map((member) => member.name),
      group.members.map((member) => group.fact(member, CLASS_REPORT_WORDS)),
    ]),
  ).toEqual([
    ["Didn’t sign in", ["Ana"], [""]],
    ["Signed in, no answers", ["Ben"], [expect.stringMatching(/^Signed in /)]],
    ["Needed help at the end", ["Cal"], ["2 of 6 right"]],
    ["Used help on most answers", ["Dee"], ["4 of 6 with help"]],
  ]);
  expect(followUp([rows[4]!])).toEqual([]);
});

test("didn’t sign in and signed in, no answers: told apart by the session alone", () => {
  // A second session of the day, 2:00 to 2:15. What each student's own
  // sign-in and work say, judged as the server judges a report.
  const startedAt = "2026-11-30T14:00:00.000Z";
  const at = { now: Date.parse("2026-11-30T14:15:00.000Z"), startedAt };
  const facts = {
    problems: 0,
    hints: 0,
    lessons: 0,
    examples: 0,
    videos: 0,
    recent: [],
    firstSeenAt: null,
    lastAnswerAt: null,
    lastHelpAt: null,
    lastSeenAt: null,
  };
  const judged = [
    // Practiced in the morning's session; never in this one.
    row("Elin", {
      firstSeenAt: null,
      status: reportStatus(
        { ...facts, lastSeenAt: "2026-11-30T09:30:00.000Z" },
        at,
      ),
    }),
    // On AMP five minutes before Start; nothing after.
    row("Finn", {
      firstSeenAt: null,
      status: reportStatus(
        { ...facts, lastSeenAt: "2026-11-30T13:55:00.000Z" },
        at,
      ),
    }),
    // Signed in at 2:11 and answered nothing.
    row("Jory", {
      firstSeenAt: "2026-11-30T14:11:00.000Z",
      status: reportStatus(
        { ...facts, firstSeenAt: "2026-11-30T14:11:00.000Z" },
        at,
      ),
    }),
    // Signed in before Start; her open tab was seen during the session.
    row("Kay", {
      firstSeenAt: null,
      status: reportStatus(
        { ...facts, lastSeenAt: "2026-11-30T14:06:00.000Z" },
        at,
      ),
    }),
  ];
  expect(judged.map((member) => member.status)).toEqual([
    "not_signed_in",
    "not_signed_in",
    "idle",
    "idle",
  ]);
  const groups = followUp(judged);
  expect(
    groups.map((group) => [
      group.id,
      group.members.map((member) => member.name),
      group.members.map((member) => group.fact(member, CLASS_REPORT_WORDS)),
    ]),
  ).toEqual([
    ["not-signed-in", ["Elin", "Finn"], ["", ""]],
    ["no-answers", ["Jory", "Kay"], [expect.stringMatching(/^Signed in /), ""]],
  ]);
});

test("skills: most students first, and who ended on one needing help", () => {
  expect(
    sessionSkills(rows).map((entry) => [
      entry.skill.title,
      entry.students.map((student) => student.name),
      entry.endedNeedingHelp,
    ]),
  ).toEqual([
    ["Adding fractions", ["Cal", "Dee", "Eve"], 1],
    ["Comparing decimals", ["Dee"], 0],
  ]);
});

test("the cockpit's sort: needs-you first unless chosen, kept flat", () => {
  expect(sortOf(undefined)).toEqual(DEFAULT_COCKPIT_SORT);
  expect(DEFAULT_COCKPIT_SORT.key).toBe("attention");
  expect(
    sortOf({
      liveSort: "problems",
      liveDirection: "descending",
      liveVersion: 3,
    }),
  ).toEqual({ key: "problems", direction: "descending", version: 3 });
  expect(sortOf({ liveSort: "nonsense" })).toEqual(DEFAULT_COCKPIT_SORT);
});

test("a session that is gone has ended; a new one in its place has not", () => {
  const session = {
    id: "s1",
    classId: "c",
    startedAt: "2026-11-30T14:00:00.000Z",
    plannedEndAt: "2026-11-30T14:10:00.000Z",
    endsAt: "2026-11-30T14:10:00.000Z",
    endedAt: null,
    endReason: null,
    startedBy: null,
    endedBy: null,
    rulesVersion: 1,
  };
  const snap = (patch: Partial<LiveSnapshot>): LiveSnapshot => ({
    serverNow: "2026-11-30T14:10:02.000Z",
    session,
    rules: LIVE_RULES,
    rows: [],
    totals: {
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
    },
    signals: [],
    can: { manage: true },
    ...patch,
  });
  const before = snap({});
  expect(endedBetween(before, snap({ session: null }))).toEqual({
    snapshot: before,
    // The planned end, not the moment the news arrived.
    endedAt: Date.parse("2026-11-30T14:10:00.000Z"),
  });
  expect(endedBetween(before, before)).toBeNull();
  expect(
    endedBetween(before, snap({ session: { ...session, id: "s2" } })),
  ).toBeNull();
  expect(endedBetween(undefined, snap({ session: null }))).toBeNull();
});
