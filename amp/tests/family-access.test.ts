import test from "node:test";
import assert from "node:assert/strict";
import { licenseSummary } from "../src/web/family-access.js";
const now = Date.parse("2026-06-01T00:00:00Z");
const license = {
  channel: "stripe",
  status: "active",
  startsAt: "2026-01-01T00:00:00Z",
  endsAt: "2027-01-01T00:00:00Z",
};
test("family license summary distinguishes current, scheduled, expired and revoked terms", () => {
  const future = {
    ...license,
    startsAt: "2027-01-01T00:00:00Z",
    endsAt: "2028-01-01T00:00:00Z",
  };
  assert.deepEqual(licenseSummary([future, license], now), {
    kind: "active",
    license,
  });
  assert.equal(
    licenseSummary([{ ...license, status: "revoked" }], now).kind,
    "none",
  );
  assert.equal(
    licenseSummary([license], Date.parse(license.endsAt)).kind,
    "none",
  );
  assert.deepEqual(licenseSummary([future], now), {
    kind: "scheduled",
    license: future,
  });
  assert.equal(
    licenseSummary([{ ...license, endsAt: "invalid" }], now).kind,
    "none",
  );
  assert.equal(
    licenseSummary([{ ...license, startsAt: license.endsAt }], now).kind,
    "none",
  );
  assert.equal(
    licenseSummary([license], Date.parse(license.startsAt)).kind,
    "active",
  );
});

test("earliest scheduled term wins irrespective of delivery order, revoked terms excluded", () => {
  const near = {
    ...license,
    startsAt: "2027-01-01T00:00:00Z",
    endsAt: "2028-01-01T00:00:00Z",
  };
  const far = {
    ...license,
    startsAt: "2028-01-01T00:00:00Z",
    endsAt: "2029-01-01T00:00:00Z",
  };
  const revoked = { ...license, status: "revoked" };
  assert.deepEqual(licenseSummary([far, revoked, near], now), {
    kind: "scheduled",
    license: near,
  });
  assert.deepEqual(licenseSummary([], now), { kind: "none" });
});
