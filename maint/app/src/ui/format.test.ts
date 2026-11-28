import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDate, formatMinutes, unitName } from "./format.ts";

test("dates read as day, month, year; anything else is shown as given", () => {
  assert.equal(formatDate("2026-03-09"), "9 Mar 2026");
  assert.equal(formatDate("2026-11-28T07:48:01.436Z"), "28 Nov 2026");
  assert.equal(formatDate("last spring"), "last spring");
  assert.equal(formatDate(null), "");
});

test("durations and unit names", () => {
  assert.equal(formatMinutes(45), "45 min");
  assert.equal(formatMinutes(95), "1 h 35 min");
  assert.equal(unitName({ name: null, asset_id: "unit-7" }), "unit-7");
});
