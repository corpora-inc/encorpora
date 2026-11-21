import assert from "node:assert/strict";
import test from "node:test";
import {
  liveRowResource,
  liveSnapshotResponse,
  type LiveOutcome,
  type LiveRow,
  type LiveStatus,
} from "../src/schools/live/contracts";
import {
  LIVE_RULES,
  liveStatus,
  liveTotals,
  reportTotals,
  type StatusFacts,
} from "../src/schools/live/status";

/* The live status rules (src/schools/live/status.ts) as a table: every status
   and each boundary. First match wins. */

const START = Date.parse("2026-11-30T14:00:00.000Z");
const at = (seconds: number) => new Date(START + seconds * 1000).toISOString();
const R: LiveOutcome = { correct: true, assisted: false };
const H: LiveOutcome = { correct: true, assisted: true };
const W: LiveOutcome = { correct: false, assisted: false };

/** A student who signed in at the start and has done nothing yet. */
const facts = (over: Partial<StatusFacts> = {}): StatusFacts => ({
  problems: 0,
  hints: 0,
  lessons: 0,
  examples: 0,
  videos: 0,
  recent: [],
  firstSeenAt: null,
  lastAnswerAt: null,
  lastHelpAt: null,
  seenToday: true,
  ...over,
});
/** Answered `recent` with the last answer `secondsAgo` before `now`. */
const answered = (
  recent: LiveOutcome[],
  last: number,
): Partial<StatusFacts> => ({
  problems: recent.length,
  recent,
  firstSeenAt: at(0),
  lastAnswerAt: at(last),
});

const cases: {
  name: string;
  row: StatusFacts;
  now: number;
  expect: LiveStatus;
}[] = [
  // 1. not signed in
  {
    name: "not seen today, no activity in the session",
    row: facts({ seenToday: false }),
    now: 30,
    expect: "not_signed_in",
  },
  {
    name: "not seen today, a long time later, still not signed in (not idle)",
    row: facts({ seenToday: false }),
    now: 3600,
    expect: "not_signed_in",
  },
  {
    name: "not seen today but answered on a parent's device: signed in",
    row: facts({ seenToday: false, ...answered([R], 20) }),
    now: 30,
    expect: "working",
  },
  {
    name: "not seen today but opened a lesson in the session: signed in",
    row: facts({ seenToday: false, lessons: 1, lastHelpAt: at(10) }),
    now: 30,
    expect: "working",
  },
  {
    name: "not seen today but showed up in the session: signed in",
    row: facts({ seenToday: false, firstSeenAt: at(5) }),
    now: 30,
    expect: "working",
  },
  // 2. idle: 120 s with no answer or help, from max(start, first seen)
  {
    name: "signed in, nothing done, 119 s after the start",
    row: facts(),
    now: 119,
    expect: "working",
  },
  {
    name: "signed in, nothing done, 120 s after the start",
    row: facts(),
    now: 120,
    expect: "idle",
  },
  {
    name: "first seen at 60 s: 179 s is not idle yet",
    row: facts({ firstSeenAt: at(60) }),
    now: 179,
    expect: "working",
  },
  {
    name: "first seen at 60 s: idle at 180 s",
    row: facts({ firstSeenAt: at(60) }),
    now: 180,
    expect: "idle",
  },
  {
    name: "first seen before the start counts from the start",
    row: facts({ firstSeenAt: at(-600) }),
    now: 120,
    expect: "idle",
  },
  {
    name: "last answer 119 s ago",
    row: facts(answered([R], 100)),
    now: 219,
    expect: "working",
  },
  {
    name: "last answer 120 s ago",
    row: facts(answered([R], 100)),
    now: 220,
    expect: "idle",
  },
  {
    name: "a hint 30 s ago keeps an old answer from idle",
    row: facts({ ...answered([W], 100), hints: 1, lastHelpAt: at(200) }),
    now: 230,
    expect: "working",
  },
  {
    name: "idle wins over struggling",
    row: facts(answered([W, W, W], 10)),
    now: 130,
    expect: "idle",
  },
  // 3. struggling
  {
    name: "two wrong in a row is not yet struggling",
    row: facts(answered([R, W, W], 30)),
    now: 40,
    expect: "working",
  },
  {
    name: "three wrong in a row",
    row: facts(answered([W, W, W], 30)),
    now: 40,
    expect: "struggling",
  },
  {
    name: "three wrong in a row after rights",
    row: facts(answered([R, R, W, W, W], 30)),
    now: 40,
    expect: "struggling",
  },
  {
    name: "2 of the last 5 right",
    row: facts(answered([R, W, R, W, W], 30)),
    now: 40,
    expect: "struggling",
  },
  {
    name: "2 of the last 5 right, the last one right",
    row: facts(answered([W, R, W, W, R], 30)),
    now: 40,
    expect: "struggling",
  },
  {
    name: "3 of the last 5 right",
    row: facts(answered([W, R, W, R, R], 30)),
    now: 40,
    expect: "working",
  },
  {
    name: "only four answers: 1 of 4 right is judged by the run only",
    row: facts(answered([W, R, W, W], 30)),
    now: 40,
    expect: "working",
  },
  {
    name: "help-assisted right answers count as right",
    row: facts(answered([W, H, W, H, H], 30)),
    now: 40,
    expect: "working",
  },
  // 4. flying
  {
    name: "five right with no help",
    row: facts(answered([R, R, R, R, R], 30)),
    now: 40,
    expect: "flying",
  },
  {
    name: "an assisted answer breaks flying",
    row: facts(answered([R, R, H, R, R], 30)),
    now: 40,
    expect: "working",
  },
  {
    name: "four right is not yet flying",
    row: facts(answered([R, R, R, R], 30)),
    now: 40,
    expect: "working",
  },
  {
    name: "a wrong answer before the last five doesn't matter",
    row: facts(answered([W, R, R, R, R, R], 30)),
    now: 40,
    expect: "flying",
  },
  // 5. working
  {
    name: "signed in, just started",
    row: facts(),
    now: 5,
    expect: "working",
  },
];

test("live status: the rule table", () => {
  for (const { name, row, now, expect } of cases)
    assert.equal(
      liveStatus(row, { now: START + now * 1000, startedAt: at(0) }),
      expect,
      name,
    );
});

test("live status: accepts a Date and a rules object", () => {
  const row = facts();
  assert.equal(
    liveStatus(row, { now: new Date(START + 60_000), startedAt: at(0) }),
    "working",
  );
  assert.equal(
    liveStatus(
      row,
      { now: START + 60_000, startedAt: at(0) },
      { ...LIVE_RULES, idleMs: 60_000 },
    ),
    "idle",
  );
});

const row = (over: Partial<LiveRow>): LiveRow => ({
  personId: "00000000-0000-4000-8000-000000000001",
  name: "Fixture",
  problems: 0,
  correct: 0,
  independent: 0,
  assisted: 0,
  hints: 0,
  lessons: 0,
  examples: 0,
  videos: 0,
  skill: null,
  level: null,
  recent: [],
  firstSeenAt: null,
  firstAnswerAt: null,
  lastAnswerAt: null,
  lastHelpAt: null,
  lastSeenAt: null,
  seenToday: false,
  ...over,
});

test("live totals: sums, who is present and who is answering", () => {
  const rows = [
    row({
      seenToday: true,
      problems: 4,
      correct: 3,
      independent: 2,
      assisted: 1,
      hints: 2,
    }),
    row({ problems: 1, correct: 1, independent: 1, videos: 1 }),
    row({ seenToday: true }),
    row({}),
  ];
  for (const r of rows) liveRowResource.parse(r);
  assert.deepEqual(liveTotals(rows), {
    students: 4,
    present: 3,
    answering: 2,
    problems: 5,
    correct: 4,
    independent: 3,
    assisted: 1,
    hints: 2,
    lessons: 0,
    examples: 0,
    videos: 1,
  });
  assert.deepEqual(
    reportTotals(
      rows.map((r, i) => ({
        ...r,
        skills: [],
        status: i === 3 ? ("not_signed_in" as const) : ("working" as const),
      })),
    ),
    liveTotals(rows),
  );
  liveSnapshotResponse.parse({
    serverNow: at(0),
    session: null,
    rules: LIVE_RULES,
    rows: [],
    totals: liveTotals([]),
    signals: [],
    can: { manage: true },
  });
});
