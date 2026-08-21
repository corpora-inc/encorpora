/**
 * THE GROOVE: does it fill three lanes, does it breathe both ways, and does it
 * stop being the same tune?
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { ChartNote } from "./chart.ts";
import {
  barSignature,
  CELL_LADDER,
  cellCeiling,
  evolve,
  grooveBar,
  laneOf,
  metricWeight,
  MIN_CELLS,
  newGroove,
  noteTarget,
  ruleInto,
} from "./groove.ts";

const out: ChartNote[] = [];

test("three lanes are reachable at every subdivision the evolution can choose", () => {
  for (const cells of CELL_LADDER) {
    if (cells < MIN_CELLS) continue;
    const lanes = new Set<number>();
    for (let c = 0; c < cells; c++) lanes.add(laneOf(c, cells));
    assert.deepEqual(
      [...lanes].sort(),
      [0, 1, 2],
      `a bar of ${cells} slices can only ever reach lanes ${[...lanes].sort().join(",")}`,
    );
  }
});

test("the lane quota puts a note in every lane from three notes upward", () => {
  for (const cells of CELL_LADDER) {
    if (cells < MIN_CELLS) continue;
    for (let step = 0; step <= 10; step++) {
      const intensity = step / 10;
      const g = newGroove(cells * 977 + step);
      g.cells = cells;
      for (let bar = 0; bar < 24; bar++) {
        grooveBar(g, intensity, out);
        assert.ok(out.length >= 3, `${cells} slices at intensity ${intensity} produced ${out.length} notes`);
        const lanes = new Set(out.map((n) => n.lane));
        assert.equal(
          lanes.size,
          3,
          `bar ${bar} at ${cells} slices, intensity ${intensity}, used only lanes ` +
            `${[...lanes].sort().join(",")} — the top of the field is dead`,
        );
        evolve(g, intensity);
      }
    }
  }
});

test("the note count rises with intensity and never drops below three", () => {
  for (const cells of CELL_LADDER) {
    let prev = -1;
    for (let step = 0; step <= 10; step++) {
      const n = noteTarget(cells, step / 10);
      assert.ok(n >= 3 || n === cells, `${cells} slices at ${step / 10} wanted only ${n} notes`);
      assert.ok(n >= prev, `the note count fell from ${prev} to ${n} as the intensity went UP`);
      assert.ok(n <= cells, `${n} notes were asked for out of ${cells} slices`);
      prev = n;
    }
  }
  // …and the opening really is sparse. Three notes in a 4/4 bar at 92 BPM is
  // one every 0.87 s, which is what a beginner can physically follow.
  assert.equal(noteTarget(MIN_CELLS, 0), 3);
  assert.ok(noteTarget(16, 1) >= 12, "the top of the range is not actually dense");
});

test("the subdivision ceiling rises with intensity and never falls below four", () => {
  let prev = 0;
  for (let step = 0; step <= 100; step++) {
    const c = cellCeiling(step / 100);
    assert.ok(c >= MIN_CELLS, `intensity ${step / 100} allowed a subdivision of ${c}`);
    assert.ok(c >= prev, `the ceiling fell from ${prev} to ${c} as the intensity went UP`);
    prev = c;
  }
  assert.equal(cellCeiling(0), MIN_CELLS);
  assert.ok(cellCeiling(1) >= 16, `the top of the range only reaches ${cellCeiling(1)} slices`);
});

test("a falling intensity brings the subdivision back DOWN", () => {
  const g = newGroove(4242);
  for (let bar = 0; bar < 200; bar++) evolve(g, 1);
  assert.ok(g.cells >= 12, `a run at full intensity only reached ${g.cells} slices`);
  // Relief is not earned: it arrives on the same evolution step, not slower.
  for (let bar = 0; bar < 40; bar++) evolve(g, 0);
  assert.equal(g.cells, MIN_CELLS, `after forty bars of relief the world is still at ${g.cells} slices`);
});

test("a bar answered as halves is PLAYED as halves, and does not stay there", () => {
  // The pedagogy: answer `1/2`, and the world re-rules itself into two.
  const g = newGroove(9);
  ruleInto(g, 2, 2, 0.5);
  assert.equal(g.cells, 2, "the world did not re-rule itself into the answer");
  // …but two slices cannot fill three lanes, so it climbs straight back out
  // rather than leaving the top of the field dead for four bars.
  evolve(g, 0);
  assert.equal(g.cells, MIN_CELLS, "a two-slice world was allowed to persist");
});

test("metric weight is a groove, not a sprinkle: the downbeat outranks everything", () => {
  for (const cells of CELL_LADDER) {
    const w0 = metricWeight(0, cells);
    for (let c = 1; c < cells; c++) {
      assert.ok(w0 > metricWeight(c, cells), `slice ${c} of ${cells} outranked the downbeat`);
    }
  }
  // A sixteenth is worth less than an "and", which is worth less than a beat.
  assert.ok(metricWeight(1, 4) > metricWeight(1, 8));
  assert.ok(metricWeight(1, 8) > metricWeight(1, 16));
});

test("the same groove state at the same intensity does not produce the same bar twice", () => {
  const g = newGroove(31337);
  g.cells = 8;
  const seen = new Set<string>();
  const seq: string[] = [];
  for (let bar = 0; bar < 200; bar++) {
    grooveBar(g, 0.5, out);
    const sig = barSignature(out, g.cells);
    seen.add(sig);
    seq.push(sig);
    evolve(g, 0.5);
  }
  assert.ok(seen.size >= 12, `200 bars produced only ${seen.size} distinct shapes`);
  // No four-bar phrase repeats verbatim — that is the thing a player gets
  // tired of, and it is a stronger claim than a count of distinct bars.
  const phrases = new Map<string, number>();
  for (let i = 0; i + 4 <= seq.length; i++) {
    const k = seq.slice(i, i + 4).join("|");
    phrases.set(k, (phrases.get(k) ?? 0) + 1);
  }
  assert.equal(Math.max(...phrases.values()), 1, "a four-bar phrase repeated inside 200 bars");
});

test("two runs from different seeds are different tunes", () => {
  const a = newGroove(1);
  const b = newGroove(2);
  a.cells = 8;
  b.cells = 8;
  let same = 0;
  for (let bar = 0; bar < 100; bar++) {
    grooveBar(a, 0.6, out);
    const sa = barSignature(out, a.cells);
    grooveBar(b, 0.6, out);
    const sb = barSignature(out, b.cells);
    if (sa === sb) same++;
    evolve(a, 0.6);
    evolve(b, 0.6);
  }
  assert.ok(same < 60, `${same} of 100 bars were identical between two differently seeded runs`);
});

test("every note lands on its own slice, in its own lane, exactly once", () => {
  for (const cells of CELL_LADDER) {
    const g = newGroove(cells * 13);
    g.cells = cells;
    for (let bar = 0; bar < 60; bar++) {
      // `evolve` moves the subdivision, so the bar's own `cells` is the truth —
      // and a two-slice world is raised to four on the first step, deliberately.
      const live = g.cells;
      grooveBar(g, (bar % 11) / 10, out);
      const seen = new Set<number>();
      for (const n of out) {
        assert.equal(n.cells, live, `a note claimed ${n.cells} slices in a bar of ${live}`);
        assert.ok(!seen.has(n.cell), `slice ${n.cell} was struck twice in one bar of ${live}`);
        seen.add(n.cell);
        assert.equal(n.lane, laneOf(n.cell, live));
        assert.ok(Math.abs(n.beat - (n.cell * 4) / live) < 1e-9, "a note left the grid");
      }
      assert.ok(out.some((n) => n.cell === 0), "the bar lost its downbeat");
      evolve(g, (bar % 11) / 10);
    }
  }
});
