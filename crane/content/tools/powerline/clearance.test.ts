import { test } from "node:test";
import assert from "node:assert/strict";
import { TABLE_A, TABLE_T, clearance, lookup, checkApproach, voltageClass } from "./clearance.ts";

test("Table A boundaries are inclusive at the upper value", () => {
  const cases: [number, number | null][] = [[0.12, 10], [50, 10], [50.01, 15], [200, 15], [200.5, 20], [350, 20], [351, 25], [500, 25], [750, 35], [751, 45], [1000, 45], [1000.1, null]];
  for (const [kv, ft] of cases) assert.equal(lookup(TABLE_A, kv).clearance_ft, ft, `${kv} kV`);
});

test("Table T boundaries", () => {
  const cases: [number, number | null][] = [[0.12, 4], [0.75, 4], [0.8, 6], [50, 6], [69, 10], [345, 10], [346, 16], [750, 16], [765, 20], [1000, 20], [1100, null]];
  for (const [kv, ft] of cases) assert.equal(lookup(TABLE_T, kv).clearance_ft, ft, `${kv} kV`);
});

test("rows are contiguous and increasing", () => {
  for (const rows of [TABLE_A, TABLE_T]) {
    assert.equal(rows[0].over_kv, 0);
    for (let i = 1; i < rows.length; i++) {
      assert.equal(rows[i].over_kv, rows[i - 1].to_kv);
      if (rows[i].clearance_ft !== null) assert.ok(rows[i].clearance_ft! > rows[i - 1].clearance_ft!);
    }
    assert.equal(rows.at(-1)!.to_kv, null);
  }
});

test("20 ft threshold up to 350 kV, 50 ft to 1,000 kV, engineer above", () => {
  assert.equal(clearance("operation", 13.8).thresholdFt, 20);
  assert.equal(clearance("operation", 13.8).minClearanceFt, 10);
  assert.equal(clearance("operation", 345).minClearanceFt, 20);
  assert.equal(clearance("operation", 500).thresholdFt, 50);
  assert.equal(clearance("operation", 500).minClearanceFt, 25);
  const big = clearance("operation", 1100);
  assert.equal(big.minClearanceFt, null);
  assert.equal(big.decidedBy, "utility-or-engineer");
  assert.equal(voltageClass(350), "up-to-350");
});

test("unknown voltage: no Table A number, Option 2 distance only when the class is known", () => {
  const u = clearance("operation", null);
  assert.equal(u.minClearanceFt, null);
  assert.equal(u.thresholdFt, null);
  assert.equal(u.decidedBy, "voltage-needed");
  assert.ok(u.cites.some((c) => c.section_id === "29cfr1926.1408(e)"));
  assert.equal(clearance("operation", null, "up-to-350").thresholdFt, 20);
  assert.equal(clearance("assembly", null, "over-350-to-1000").thresholdFt, 50);
  assert.equal(clearance("travel", null).table, "T");
});

test("approach check", () => {
  assert.deepEqual([checkApproach("operation", 69, 18).ok, checkApproach("operation", 69, 18).needsPrecautions], [true, true]);
  assert.equal(checkApproach("operation", 69, 14).ok, false);
  assert.equal(checkApproach("operation", null, 25, "up-to-350").ok, true);
  assert.equal(checkApproach("operation", null, 25).ok, false);
  assert.equal(checkApproach("travel", 12.47, 5).ok, false);
  assert.equal(checkApproach("travel", 12.47, 6).ok, true);
});

test("every result carries citations", () => {
  for (const kv of [1, 69, 230, 345, 500, 765, 1200]) {
    for (const a of ["operation", "assembly", "travel"] as const) {
      const r = clearance(a, kv);
      assert.ok(r.cites.length >= 2);
      for (const c of r.cites) assert.match(c.section_id, /^29cfr1926\.14/);
    }
  }
  assert.throws(() => lookup(TABLE_A, 0));
  assert.throws(() => lookup(TABLE_A, Number.NaN));
});
