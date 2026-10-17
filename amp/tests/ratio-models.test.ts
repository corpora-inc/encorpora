import test from "node:test";
import assert from "node:assert/strict";
import {
  validateRatioModel,
  ratioTapeLayout,
  type RatioTapeModel,
  type PercentGridModel,
} from "../src/publishing/ratio-models.js";
const tape = (): RatioTapeModel => ({
  kind: "ratio-tape",
  unitLabel: "liters",
  frameParts: 6,
  rows: [
    { label: "Concentrate", parts: 2, total: [3, 2] },
    { label: "Water", parts: 3, total: [9, 4] },
  ],
});
test("ratio tape validates exact common amounts without filling missing values", () => {
  const d = tape();
  validateRatioModel(d);
  d.partValue = [3, 4];
  validateRatioModel(d);
  delete d.rows[1].total;
  const snapshot = JSON.stringify(d);
  validateRatioModel(d);
  assert.equal(JSON.stringify(d), snapshot);
  delete d.rows[0].total;
  delete d.partValue;
  validateRatioModel(d);
});
test("ratio tape rejects inconsistent totals and part values", () => {
  const d = tape();
  d.rows[1].total = [5, 2];
  assert.throws(() => validateRatioModel(d), /disagree/);
  const e = tape();
  e.partValue = [1, 1];
  assert.throws(() => validateRatioModel(e), /disagree/);
});
test("ratio tape validates bounded data at runtime", () => {
  const variants = [
    { frameParts: 1 },
    { frameParts: 13 },
    { frameParts: 2.5 },
    { unitLabel: "" },
    { partValue: [1, 0] },
    { partValue: [0, 1] },
    { rows: [{ label: "a", parts: 2 }] },
  ];
  for (const patch of variants)
    assert.throws(() =>
      validateRatioModel({ ...tape(), ...patch } as RatioTapeModel),
    );
  const d = tape();
  d.rows[1].label = d.rows[0].label;
  assert.throws(() => validateRatioModel(d));
  const e = tape();
  e.rows[0].total = null as never;
  assert.throws(() => validateRatioModel(e));
});
test("shared tape frame retains identical part geometry", () => {
  const a = tape(),
    b = tape();
  b.rows[0].parts = 4;
  b.rows[1].parts = 6;
  delete b.rows[0].total;
  delete b.rows[1].total;
  assert.deepEqual(ratioTapeLayout(a), ratioTapeLayout(b));
  assert.equal(ratioTapeLayout(a).cellWidth * 6, 276);
});
test("percent grids preserve exactly100 equal slots at boundary and scattered counts", () => {
  for (const count of [0, 1, 99, 100]) {
    const d: PercentGridModel = {
      kind: "percent-grid",
      wholeLabel: "The complete collection",
      shadedCells: Array.from({ length: count }, (_, i) => i),
    };
    validateRatioModel(d);
    assert.equal(d.shadedCells.length, count);
  }
  validateRatioModel({
    kind: "percent-grid",
    wholeLabel: "One full board",
    shadedCells: [0, 9, 44, 90, 99],
  });
  for (const shadedCells of [[0, 0], [-1], [100], [0.5]])
    assert.throws(() =>
      validateRatioModel({
        kind: "percent-grid",
        wholeLabel: "One board",
        shadedCells,
      }),
    );
});
