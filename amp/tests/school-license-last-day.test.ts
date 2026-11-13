import assert from "node:assert/strict";
import test from "node:test";
import { formatLastDay } from "../src/schools/calendar.js";

/* A license ends at the midnight after its last day, in the school's zone.
   Overview and Settings once printed that instant's UTC date ("Through Dec
   14") while setup said "through Dec 13": one license, two end dates. */
test("a license is shown through its last day, in the school's zone", () => {
  // Midnight Dec 14 in New York is 05:00 UTC.
  assert.equal(
    formatLastDay("2026-12-14T05:00:00.000Z", "America/New_York"),
    "Dec 13, 2026",
  );
  assert.equal(
    formatLastDay("2026-07-01T07:00:00.000Z", "America/Los_Angeles"),
    "Jun 30, 2026",
  );
});
