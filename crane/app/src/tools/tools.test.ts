import { test } from "node:test";
import assert from "node:assert/strict";
import { TABLE_A, bandFor } from "./clearance.ts";
import { FIXTURE_CHART, generateProblem, readChart } from "./loadchart.ts";

test("Table A bands include their upper value", () => {
  const cases: [number, number | null][] = [[0.6, 10], [50, 10], [50.1, 15], [200, 15], [201, 20], [350, 20], [345, 20], [500, 25], [750, 35], [765, 45], [1000, 45], [1001, null]];
  for (const [kv, ft] of cases) assert.equal(bandFor(kv)?.feet, ft, `${kv} kV`);
  assert.equal(bandFor(0), null);
  assert.equal(bandFor(-5), null);
  assert.equal(bandFor(Number.NaN), null);
  assert.equal(TABLE_A.length, 7);
});

test("the Option 1-3 trigger is 20 ft up to 350 kV and 50 ft over 350 to 1,000 kV", () => {
  const cases: [number, number | null, string][] = [[13.8, 20, "29cfr1926.1408(a)(2)"], [350, 20, "29cfr1926.1408(a)(2)"], [351, 50, "29cfr1926.1409(a)"], [765, 50, "29cfr1926.1409(a)"], [1000, 50, "29cfr1926.1409(a)"], [1100, null, "29cfr1926.1409(b)"]];
  for (const [kv, ft, sid] of cases) {
    const b = bandFor(kv)!;
    assert.equal(b.triggerFeet, ft, `${kv} kV trigger`);
    assert.equal(b.triggerRule.section_id, sid, `${kv} kV rule`);
  }
});

const cfg = FIXTURE_CHART.configurations[0]!;

test("exact cells read directly", () => {
  assert.deepEqual(readChart(cfg, 45, 20), { ok: true, capacityLb: 32100, radiusUsedFt: 20, boomUsedFt: [45], note: "exact" });
});

test("between radii: the next longer radius", () => {
  const r = readChart(cfg, 45, 22);
  assert.ok(r.ok);
  assert.equal(r.capacityLb, 25000);
  assert.equal(r.radiusUsedFt, 25);
  assert.equal(r.note, "next-radius");
});

test("between boom lengths: the lower of the two", () => {
  const r = readChart(cfg, 50, 20);
  assert.ok(r.ok);
  assert.equal(r.capacityLb, 28900);
  assert.deepEqual(r.boomUsedFt, [45, 60]);
  const both = readChart(cfg, 50, 27);
  assert.ok(both.ok);
  assert.equal(both.capacityLb, 19100);
  assert.equal(both.note, "both");
});

test("out of range and unrated cells are refused", () => {
  assert.deepEqual(readChart(cfg, 45, 71), { ok: false, reason: "radius-out-of-range" });
  assert.deepEqual(readChart(cfg, 20, 20), { ok: false, reason: "boom-out-of-range" });
  assert.deepEqual(readChart(cfg, 95, 20), { ok: false, reason: "boom-out-of-range" });
  assert.deepEqual(readChart(cfg, 32, 40), { ok: false, reason: "not-rated" });
  assert.deepEqual(readChart(cfg, 80, 10), { ok: false, reason: "not-rated" }, "a rated cell next to an unrated one is not rated");
});

test("generated problems are deterministic, solvable and exact", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 300; i++) {
    const p = generateProblem(FIXTURE_CHART, `s${i}`);
    assert.deepEqual(generateProblem(FIXTURE_CHART, `s${i}`), p);
    const config = FIXTURE_CHART.configurations.find((c) => c.id === p.configId)!;
    const r = readChart(config, p.boomFt, p.radiusFt);
    assert.ok(r.ok);
    assert.equal(r.capacityLb, p.grossLb);
    assert.equal(p.netLb, p.grossLb - p.deductions.hookBlockLb - p.deductions.riggingLb - p.deductions.otherLb);
    assert.equal(p.canLift, p.loadLb <= p.netLb);
    assert.ok(p.netLb > 0 && p.loadLb >= 100);
    seen.add(`${p.canLift}`);
  }
  assert.equal(seen.size, 2, "both lift and no-lift outcomes occur");
});
