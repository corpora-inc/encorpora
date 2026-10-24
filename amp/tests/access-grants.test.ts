import test from "node:test";
import assert from "node:assert/strict";
import { giftEnd } from "../src/access-grants/repository.js";

test("gift terms are calendar months/years, with UTC month-end and leap-day clamping", () => {
  for (const [start, months, end] of [
    ["2026-01-31T18:22:33.444Z", 1, "2026-02-28T18:22:33.444Z"],
    ["2028-01-31T18:22:33.444Z", 1, "2028-02-29T18:22:33.444Z"],
    ["2028-02-29T18:22:33.444Z", 12, "2029-02-28T18:22:33.444Z"],
    ["2026-12-15T18:22:33.444Z", 1, "2027-01-15T18:22:33.444Z"],
  ] as const) {
    const date = new Date(start);
    assert.equal(giftEnd(date, months).toISOString(), end);
    assert.equal(date.toISOString(), start);
  }
});
