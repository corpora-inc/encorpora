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
  isHere,
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

/** A student whose own device was last seen at the start, signed in before
 * it, and who has done nothing in the session yet. */
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
  lastSeenAt: at(0),
  ...over,
});
/** No sign-in of their own was ever seen. */
const UNSEEN = { lastSeenAt: null };
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
  // 1. not signed in: nothing of theirs in the session, and not seen in the
  // ten minutes before now
  {
    name: "never seen, no activity in the session",
    row: facts(UNSEEN),
    now: 30,
    expect: "not_signed_in",
  },
  {
    name: "never seen, a long time later, still not signed in (not idle)",
    row: facts(UNSEEN),
    now: 3600,
    expect: "not_signed_in",
  },
  {
    name: "practiced three hours ago, the session starts now",
    row: facts({ lastSeenAt: at(-3 * 3600) }),
    now: 0,
    expect: "not_signed_in",
  },
  {
    name: "practiced three hours ago, two minutes in: not signed in, not idle",
    row: facts({ lastSeenAt: at(-3 * 3600) }),
    now: 120,
    expect: "not_signed_in",
  },
  {
    name: "seen 9 minutes ago, nothing in the session: here",
    row: facts({ lastSeenAt: at(-510) }),
    now: 30,
    expect: "working",
  },
  {
    name: "seen 11 minutes ago, nothing in the session",
    row: facts({ lastSeenAt: at(-630) }),
    now: 30,
    expect: "not_signed_in",
  },
  {
    name: "seen 9 minutes 59 seconds ago: here",
    row: facts({ lastSeenAt: at(-599) }),
    now: 0,
    expect: "working",
  },
  {
    name: "seen exactly 10 minutes ago: no longer here",
    row: facts({ lastSeenAt: at(-600) }),
    now: 0,
    expect: "not_signed_in",
  },
  {
    name: "seen at the start, quiet at two minutes while still here",
    row: facts(),
    now: 599,
    expect: "idle",
  },
  {
    name: "seen at the start and nothing since: not signed in at ten minutes",
    row: facts(),
    now: 600,
    expect: "not_signed_in",
  },
  {
    name: "a sighting a moment ahead of this clock is still here",
    row: facts({ lastSeenAt: at(31) }),
    now: 30,
    expect: "working",
  },
  {
    name: "an adult's device is never read: a child with nothing of their own",
    row: facts(UNSEEN),
    now: 5,
    expect: "not_signed_in",
  },
  {
    name: "never seen but answered on a parent's sign-in: here",
    row: facts({ ...UNSEEN, ...answered([R], 20) }),
    now: 30,
    expect: "working",
  },
  {
    name: "a handed-over child answering: here",
    row: facts({ ...answered([R], 20), lastSeenAt: at(20) }),
    now: 30,
    expect: "working",
  },
  {
    name: "never seen but opened a lesson in the session: here",
    row: facts({ ...UNSEEN, lessons: 1, lastHelpAt: at(10) }),
    now: 30,
    expect: "working",
  },
  {
    name: "never seen but showed up in the session (signed in, a hand): here",
    row: facts({ ...UNSEEN, firstSeenAt: at(5) }),
    now: 30,
    expect: "working",
  },
  {
    name: "an answer in the session, then 30 minutes of silence: quiet, still here",
    row: facts({ ...answered([R], 20), lastSeenAt: at(25) }),
    now: 20 + 1800,
    expect: "idle",
  },
  {
    name: "signed in during the session, then 30 minutes of silence: quiet",
    row: facts({ firstSeenAt: at(5), lastSeenAt: at(5) }),
    now: 5 + 1800,
    expect: "idle",
  },
  {
    name: "help in the session, then 30 minutes of silence: quiet",
    row: facts({ ...UNSEEN, hints: 1, lastHelpAt: at(10) }),
    now: 10 + 1800,
    expect: "idle",
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
  assert.equal(
    liveStatus(
      row,
      { now: START + 60_000, startedAt: at(0) },
      { ...LIVE_RULES, hereMs: 60_000 },
    ),
    "not_signed_in",
  );
});

test("live status: here is the first rule, and the rest keep their order", () => {
  assert.equal(LIVE_RULES.version, 2);
  assert.equal(LIVE_RULES.hereMs, 600_000);
  assert.equal(LIVE_RULES.idleMs, 120_000);
  // Three wrong in the session an hour ago: still here, and idle before
  // struggling, as ever.
  const row = facts({ ...UNSEEN, ...answered([W, W, W], 10) });
  assert.equal(isHere(row, START + 3_600_000), true);
  assert.equal(
    liveStatus(row, { now: START + 3_600_000, startedAt: at(0) }),
    "idle",
  );
  // Here by a recent sighting alone takes the same later rules.
  const seen = facts({ lastSeenAt: at(-60) });
  assert.equal(isHere(seen, new Date(START + 119_000)), true);
  assert.equal(
    liveStatus(seen, { now: START + 119_000, startedAt: at(0) }),
    "working",
  );
  assert.equal(
    liveStatus(seen, { now: START + 120_000, startedAt: at(0) }),
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
  ...over,
});

test("live totals: sums, who is present and who is answering", () => {
  const rows = [
    row({
      lastSeenAt: at(-60),
      problems: 4,
      correct: 3,
      independent: 2,
      assisted: 1,
      hints: 2,
    }),
    row({ problems: 1, correct: 1, independent: 1, videos: 1 }),
    row({ lastSeenAt: at(-60) }),
    row({}),
  ];
  for (const r of rows) liveRowResource.parse(r);
  assert.deepEqual(liveTotals(rows, START), {
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
    liveTotals(rows, START),
  );
  liveSnapshotResponse.parse({
    serverNow: at(0),
    session: null,
    rules: LIVE_RULES,
    rows: [],
    totals: liveTotals([], START),
    signals: [],
    can: { manage: true },
  });
});

test("live totals: who is here follows the same rule as the status, on the clock", () => {
  const rows = [
    // Practiced this morning.
    row({ lastSeenAt: at(-3 * 3600) }),
    // Seen 9 minutes before the start, nothing since.
    row({ lastSeenAt: at(-540) }),
    // Answered in the session; a parent's sign-in, so never seen.
    row({ problems: 1, firstSeenAt: at(20), lastAnswerAt: at(20) }),
    // Raised a hand in the session.
    row({ firstSeenAt: at(40), lastSeenAt: at(-1200) }),
    // Nothing of their own.
    row({}),
  ];
  const present = (seconds: number) =>
    liveTotals(rows, START + seconds * 1000).present;
  assert.equal(present(0), 3);
  assert.equal(present(59), 3);
  assert.equal(present(60), 2, "ten minutes after the last sighting");
  assert.equal(present(1800), 2, "the session's own never lapse");
  for (const seconds of [0, 59, 60, 1800])
    assert.equal(
      present(seconds),
      rows.filter(
        (r) =>
          liveStatus(r, { now: START + seconds * 1000, startedAt: at(0) }) !==
          "not_signed_in",
      ).length,
    );
  assert.equal(liveTotals(rows, new Date(START)).present, 3);
  assert.equal(
    liveTotals(rows, START, { ...LIVE_RULES, hereMs: 60_000 }).present,
    2,
  );
});
