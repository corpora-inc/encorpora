import test from "node:test";
import assert from "node:assert/strict";
import {
  pilotStateSchema,
  startSchoolClassSchema,
} from "../src/schools/pilot-contracts.js";
import { pilotPresentation } from "../src/web/features/school/pilots/presentation.js";

const ready = pilotStateSchema.parse({
  status: "ready",
  startedAt: null,
  endsAt: null,
  graceEndsAt: null,
  eligible: true,
  authorized: true,
});
test("a pilot starts after roster setup and only the first eligible class offers 30 days", () => {
  assert.equal(pilotPresentation(ready, 0).action, null);
  assert.equal(pilotPresentation(ready, 20).action, "Start 30-day pilot");
  const existing = {
    ...ready,
    startedAt: "2026-11-01T00:00:00Z",
    endsAt: "2026-12-01T00:00:00Z",
    graceEndsAt: "2026-12-08T00:00:00Z",
  };
  assert.equal(pilotPresentation(existing, 20).action, "Add class to pilot");
  assert.equal(
    pilotPresentation({ ...existing, eligible: false }, 20).action,
    null,
  );
  assert.match(
    pilotPresentation({ ...existing, eligible: false }, 20).title,
    /ended/,
  );
  assert.equal(
    pilotPresentation({ ...existing, status: "active" }, 20).action,
    null,
  );
  assert.equal(
    pilotPresentation({ ...existing, status: "grace" }, 20).action,
    null,
  );
});
test("paid coverage takes precedence over pilot expiry, while partial coverage does not hide it", () => {
  const expired = {
    ...ready,
    status: "expired" as const,
    eligible: false,
    coverage: { students: 20, paid: 20, covered: 20 },
  };
  assert.equal(pilotPresentation(expired, 20).title, "Your class has seats");
  assert.equal(
    pilotPresentation(
      { ...expired, coverage: { students: 20, paid: 19, covered: 19 } },
      20,
    ).title,
    "Your pilot has ended",
  );
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
