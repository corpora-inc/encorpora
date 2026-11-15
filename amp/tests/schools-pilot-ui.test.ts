import test from "node:test";
import assert from "node:assert/strict";
import {
  pilotStateSchema,
  startSchoolClassSchema,
} from "../src/schools/pilot-contracts.js";
import {
  accessView,
  pilotLeft,
  practiceDate,
  practiceView,
} from "../src/web/features/school/pilots/presentation.js";

const now = new Date("2026-11-13T15:00:00Z");
const ready = pilotStateSchema.parse({
  status: "ready",
  startedAt: null,
  endsAt: null,
  graceEndsAt: null,
  eligible: true,
  authorized: true,
  coverage: { students: 20, covered: 0, paid: 0 },
});
const existing = {
  ...ready,
  startedAt: "2026-11-01T00:00:00Z",
  endsAt: "2026-12-01T00:00:00Z",
  graceEndsAt: "2026-12-08T00:00:00Z",
};
test("practice starts after students arrive, for 30 days, by the class's teacher", () => {
  assert.deepEqual(
    accessView(
      { ...ready, coverage: { students: 0, covered: 0, paid: 0 } },
      true,
      now,
    ),
    { kind: "empty" },
  );
  const fresh = accessView(ready, true, now);
  assert.equal(fresh.kind, "start");
  assert.equal(fresh.kind === "start" && fresh.joining, false);
  assert.equal(
    fresh.kind === "start" && fresh.until.slice(0, 10),
    "2026-12-13",
  );
  assert.deepEqual(accessView(ready, false, now), { kind: "waiting" });
  // An administrator's own ended pilot never describes a class they don't teach.
  assert.deepEqual(accessView({ ...ready, eligible: false }, false, now), {
    kind: "waiting",
  });
});
test("a second class joins the running pilot on its dates; an ended one offers seats", () => {
  assert.deepEqual(accessView(existing, true, now), {
    kind: "start",
    joining: true,
    until: "2026-12-01T00:00:00Z",
  });
  assert.deepEqual(accessView({ ...existing, eligible: false }, true, now), {
    kind: "ended",
  });
  assert.deepEqual(accessView({ ...existing, status: "active" }, true, now), {
    kind: "active",
    until: "2026-12-01T00:00:00Z",
  });
  assert.deepEqual(accessView({ ...existing, status: "grace" }, true, now), {
    kind: "ending",
    until: "2026-12-08T00:00:00Z",
  });
});
test("paid coverage takes precedence over pilot expiry, while partial coverage does not hide it", () => {
  const expired = {
    ...ready,
    status: "expired" as const,
    eligible: false,
    coverage: { students: 20, paid: 20, covered: 20 },
  };
  assert.deepEqual(accessView(expired, true, now), { kind: "paid" });
  assert.deepEqual(
    accessView(
      { ...expired, coverage: { students: 20, paid: 19, covered: 19 } },
      true,
      now,
    ),
    { kind: "partial", covered: 19, students: 20 },
  );
  assert.deepEqual(
    accessView(
      { ...expired, coverage: { students: 20, paid: 0, covered: 20 } },
      true,
      now,
    ),
    { kind: "covered" },
  );
  assert.deepEqual(
    accessView(
      { ...expired, coverage: { students: 0, paid: 0, covered: 0 } },
      true,
      now,
    ),
    { kind: "empty" },
  );
});
test("practice dates drop the year only when it is this one", () => {
  assert.match(practiceDate("2026-12-13T12:00:00Z", now), /Dec 13$/);
  assert.match(practiceDate("2027-01-05T12:00:00Z", now), /2027/);
});
test("class setup requires explicit school authorization and bounds student names", () => {
  const input = {
    requestId: "ca6a86dd-d82c-4fa4-af5a-625b8cc8cd00",
    schoolName: "School",
    className: "Class",
    timezone: "UTC",
    signerName: "Teacher",
    signerTitle: "Teacher",
    agreementVersion: "fixture",
    authorized: true,
    names: ["Ana Ruiz"],
  };
  assert.ok(startSchoolClassSchema.safeParse(input).success);
  assert.equal(
    startSchoolClassSchema.safeParse({ ...input, authorized: false }).success,
    false,
  );
  assert.equal(
    startSchoolClassSchema.safeParse({
      ...input,
      names: Array(501).fill("Student"),
    }).success,
    false,
  );
});

test("a teacher's class needs no title: one tick and a name", () => {
  const input = {
    requestId: "11111111-1111-4111-8111-111111111111",
    schoolName: "School",
    className: "Math",
    timezone: "UTC",
    signerName: "Teacher",
    agreementVersion: "fixture",
    authorized: true,
  };
  assert.ok(startSchoolClassSchema.safeParse(input).success);
  assert.equal(
    startSchoolClassSchema.safeParse({ ...input, signerName: "" }).success,
    false,
  );
});

test("the header says how many pilot or grace days are left, never 0", () => {
  assert.equal(
    pilotLeft({ kind: "active", until: "2026-12-06T15:00:00Z" }, now),
    "Free pilot · 23 days left",
  );
  assert.equal(
    pilotLeft({ kind: "ending", until: "2026-11-14T03:00:00Z" }, now),
    "Grace period · 1 day left",
  );
  assert.equal(
    pilotLeft({ kind: "ending", until: "2026-11-13T15:00:01Z" }, now),
    "Grace period · 1 day left",
  );
  assert.equal(pilotLeft({ kind: "ended" }, now), null);
  assert.equal(pilotLeft({ kind: "paid" }, now), null);
});

test("a class whose pilot runs waits for students, never for its teacher", () => {
  assert.deepEqual(practiceView("waiting", "students"), { kind: "empty" });
  // Only a class with no pilot and no license waits for its teacher.
  assert.deepEqual(practiceView("waiting", "start"), { kind: "waiting" });
  // An older server that doesn't say keeps the old reading.
  assert.deepEqual(practiceView("waiting", null), { kind: "waiting" });
  assert.deepEqual(practiceView("ended", null), { kind: "ended" });
  assert.deepEqual(practiceView("open", null), { kind: "none" });
});
