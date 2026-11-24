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
  inSession,
  isAnswering,
  isHere,
  LIVE_RULES,
  liveStatus,
  liveTotals,
  reportStatus,
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

/** A student signed in before the session, whose own sign-in was seen as it
 * started, and who has done nothing in it yet. */
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
    name: "seen 9 minutes ago, nothing in the session: here, with the session's own two minutes",
    row: facts({ lastSeenAt: at(-510) }),
    now: 30,
    expect: "working",
  },
  {
    name: "signed in a second before Start: the same 120 s as anyone here at Start",
    row: facts({ lastSeenAt: at(-1) }),
    now: 1,
    expect: "working",
  },
  {
    name: "signed in a second before Start, 119 s in",
    row: facts({ lastSeenAt: at(-1) }),
    now: 119,
    expect: "working",
  },
  {
    name: "signed in a second before Start, 120 s in with nothing done: quiet",
    row: facts({ lastSeenAt: at(-1) }),
    now: 120,
    expect: "idle",
  },
  {
    name: "signed in five minutes before Start: the quiet clock starts at Start, not at their sign-in",
    row: facts({ lastSeenAt: at(-300) }),
    now: 5,
    expect: "working",
  },
  {
    name: "signed in five minutes before Start, 120 s in: quiet",
    row: facts({ lastSeenAt: at(-300) }),
    now: 120,
    expect: "idle",
  },
  {
    name: "signed in a second after Start reads the same in its first seconds",
    row: facts({ ...UNSEEN, firstSeenAt: at(1), lastSeenAt: at(1) }),
    now: 5,
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
    name: "seen a second before the start, 9:58 in: still here",
    row: facts({ lastSeenAt: at(-1) }),
    now: 598,
    expect: "idle",
  },
  {
    name: "seen a second before the start and never in it: not signed in at ten minutes",
    row: facts({ lastSeenAt: at(-1) }),
    now: 599,
    expect: "not_signed_in",
  },
  {
    name: "their sign-in seen inside the session, nothing else: in it for good",
    row: facts({ lastSeenAt: at(200) }),
    now: 3600,
    expect: "idle",
  },
  {
    name: "their sign-in seen inside the session a minute in: working from the start's clock",
    row: facts({ lastSeenAt: at(60) }),
    now: 119,
    expect: "working",
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
  const before = facts({ lastSeenAt: at(-1) });
  assert.equal(
    liveStatus(before, { now: START + 60_000, startedAt: at(0) }),
    "working",
  );
  assert.equal(
    liveStatus(
      before,
      { now: START + 60_000, startedAt: at(0) },
      { ...LIVE_RULES, hereMs: 60_000 },
    ),
    "not_signed_in",
  );
});

test("live status: here is the first rule, and the rest keep their order", () => {
  assert.equal(LIVE_RULES.version, 3);
  assert.equal(LIVE_RULES.hereMs, 600_000);
  assert.equal(LIVE_RULES.idleMs, 120_000);
  const hour = { now: START + 3_600_000, startedAt: at(0) };
  // Three wrong in the session an hour ago: still here, and idle before
  // struggling, as ever.
  const row = facts({ ...UNSEEN, ...answered([W, W, W], 10) });
  assert.equal(isHere(row, hour), true);
  assert.equal(liveStatus(row, hour), "idle");
  // In the session, the later rules run from the start's clock as before.
  const signedIn = facts({ ...UNSEEN, firstSeenAt: at(0) });
  assert.equal(
    liveStatus(signedIn, { now: START + 119_000, startedAt: at(0) }),
    "working",
  );
  assert.equal(
    liveStatus(signedIn, { now: new Date(START + 120_000), startedAt: at(0) }),
    "idle",
  );
});

test("the quiet clock starts no earlier than the session: everyone here at Start gets the same 120 s", () => {
  const before = facts({ lastSeenAt: at(-45) });
  const after = facts({ ...UNSEEN, firstSeenAt: at(2), lastSeenAt: at(2) });
  for (const seconds of [3, 60, 119]) {
    const when = { now: START + seconds * 1000, startedAt: at(0) };
    assert.equal(liveStatus(before, when), "working", `before, ${seconds} s`);
    assert.equal(
      liveStatus(before, when),
      liveStatus(after, when),
      `signed in just before and just after Start read the same at ${seconds} s`,
    );
  }
  // Counted from the later of their last activity and the start.
  assert.equal(
    liveStatus(before, { now: START + 120_000, startedAt: at(0) }),
    "idle",
  );
  assert.equal(
    liveStatus(after, { now: START + 121_000, startedAt: at(0) }),
    "working",
  );
  assert.equal(
    liveStatus(after, { now: START + 122_000, startedAt: at(0) }),
    "idle",
  );
  // An answer restarts it, as ever.
  const answering = facts({ lastSeenAt: at(-45), ...answered([R], 100) });
  assert.equal(
    liveStatus(answering, { now: START + 219_000, startedAt: at(0) }),
    "working",
  );
  assert.equal(
    liveStatus(answering, { now: START + 220_000, startedAt: at(0) }),
    "idle",
  );
});

test("answering now: an answer or help in the last two minutes, never only being here", () => {
  const when = (seconds: number) => ({
    now: START + seconds * 1000,
    startedAt: at(0),
  });
  const cases: [string, StatusFacts, number, boolean][] = [
    [
      "here since before Start, nothing done",
      facts({ lastSeenAt: at(-45) }),
      5,
      false,
    ],
    [
      "just signed in, nothing done",
      facts({ ...UNSEEN, firstSeenAt: at(2) }),
      5,
      false,
    ],
    ["answered 20 s ago", facts(answered([R], 20)), 40, true],
    ["answered 119 s ago", facts(answered([R], 20)), 139, true],
    ["answered 120 s ago", facts(answered([R], 20)), 140, false],
    [
      "opened a hint 10 s ago",
      facts({ ...UNSEEN, hints: 1, lastHelpAt: at(30) }),
      40,
      true,
    ],
    ["not here at all", facts(UNSEEN), 40, false],
  ];
  for (const [name, row, seconds, expect] of cases)
    assert.equal(isAnswering(row, when(seconds)), expect, name);
});

test("in the session: something of theirs inside its window", () => {
  const cases: [string, StatusFacts, boolean][] = [
    ["nothing of their own", facts(UNSEEN), false],
    ["seen three hours before", facts({ lastSeenAt: at(-3 * 3600) }), false],
    ["seen a second before", facts({ lastSeenAt: at(-1) }), false],
    ["their sign-in seen as it starts", facts({ lastSeenAt: at(0) }), true],
    ["their sign-in seen in it", facts({ lastSeenAt: at(300) }), true],
    ["signed in or a hand", facts({ ...UNSEEN, firstSeenAt: at(5) }), true],
    ["an answer", facts({ ...UNSEEN, ...answered([R], 20) }), true],
    ["help", facts({ ...UNSEEN, hints: 1, lastHelpAt: at(9) }), true],
  ];
  for (const [name, row, expect] of cases)
    assert.equal(inSession(row, at(0)), expect, name);
});

test("a report is the row as it stood when the session ended", () => {
  // The cockpit and the stored report tell one story: a report freezes each
  // row's status at the end, by the same rule the live row was read with.
  const cases: {
    name: string;
    row: StatusFacts;
    /** When it stopped, seconds after the start. */
    stop: number;
    expect: LiveStatus;
  }[] = [
    {
      name: 'signed in a minute before Start, never answered, stopped at 5 minutes: here and quiet, not "didn\'t sign in"',
      row: facts({ lastSeenAt: at(-60) }),
      stop: 300,
      expect: "idle",
    },
    {
      name: "active 5 minutes before Start, nothing after, stopped at 2 minutes",
      row: facts({ lastSeenAt: at(-300) }),
      stop: 120,
      expect: "idle",
    },
    {
      name: "seen 9 minutes before Start and never again, stopped at 45 minutes: the row read not signed in by then",
      row: facts({ lastSeenAt: at(-540) }),
      stop: 2700,
      expect: "not_signed_in",
    },
    {
      name: "practiced that morning, never in the session",
      row: facts({ lastSeenAt: at(-3 * 3600) }),
      stop: 900,
      expect: "not_signed_in",
    },
    {
      name: "never seen",
      row: facts(UNSEEN),
      stop: 900,
      expect: "not_signed_in",
    },
    {
      name: "their sign-in seen in the session, no answers",
      row: facts({ lastSeenAt: at(400) }),
      stop: 2700,
      expect: "idle",
    },
    {
      name: "signed in during the session, no answers, stopped a minute later",
      row: facts({ ...UNSEEN, firstSeenAt: at(840) }),
      stop: 900,
      expect: "working",
    },
    {
      name: "answered, then silent",
      row: facts({ ...UNSEEN, ...answered([R, R], 60) }),
      stop: 900,
      expect: "idle",
    },
    {
      name: "three wrong just before it stopped",
      row: facts({ ...UNSEEN, ...answered([W, W, W], 890) }),
      stop: 900,
      expect: "struggling",
    },
  ];
  for (const { name, row, stop, expect } of cases) {
    const when = { now: START + stop * 1000, startedAt: at(0) };
    assert.equal(reportStatus(row, when), expect, name);
    assert.equal(
      reportStatus(row, when),
      liveStatus(row, when),
      `${name}: the report and the row agree`,
    );
  }
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
  assert.deepEqual(liveTotals(rows, { now: START, startedAt: at(0) }), {
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
    liveTotals(rows, { now: START, startedAt: at(0) }),
  );
  liveSnapshotResponse.parse({
    serverNow: at(0),
    session: null,
    rules: LIVE_RULES,
    rows: [],
    totals: liveTotals([], { now: START, startedAt: at(0) }),
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
    // Their own sign-in seen two minutes in, nothing else.
    row({ lastSeenAt: at(120) }),
    // Nothing of their own.
    row({}),
  ];
  const when = (seconds: number) => ({
    now: START + seconds * 1000,
    startedAt: at(0),
  });
  const present = (seconds: number) => liveTotals(rows, when(seconds)).present;
  assert.equal(present(59), 4);
  assert.equal(present(60), 3, "ten minutes after the last sighting");
  assert.equal(present(1800), 3, "the session's own never lapse");
  for (const seconds of [59, 60, 120, 1800])
    assert.equal(
      present(seconds),
      rows.filter((r) => liveStatus(r, when(seconds)) !== "not_signed_in")
        .length,
    );
  assert.equal(
    liveTotals(rows, { now: new Date(START + 59_000), startedAt: at(0) })
      .present,
    4,
  );
  assert.equal(
    liveTotals(rows, when(59), { ...LIVE_RULES, hereMs: 60_000 }).present,
    3,
  );
  // A report counts who the cockpit counted when it stopped.
  for (const seconds of [59, 60, 1800]) {
    const stopped = when(seconds);
    assert.equal(
      reportTotals(
        rows.map((r) => ({
          ...r,
          skills: [],
          status: reportStatus(r, stopped),
        })),
      ).present,
      liveTotals(rows, stopped).present,
      `stopped at ${seconds} s`,
    );
  }
});
