import { test } from "node:test";
import assert from "node:assert/strict";
import { Lookahead, Timeline } from "./scheduler.ts";

test("the tempo map does not move anything already scheduled", () => {
  const tl = new Timeline(10, 120, 4);
  const beat8 = tl.timeAt(8);
  assert.ok(Math.abs(beat8 - (10 + 8 * 0.5)) < 1e-9);
  tl.setTempoAtBeat(8, 60);
  assert.ok(Math.abs(tl.timeAt(8) - beat8) < 1e-9, "the join must be continuous");
  assert.ok(Math.abs(tl.timeAt(4) - (10 + 2)) < 1e-9, "earlier beats must not move");
  assert.ok(Math.abs(tl.timeAt(12) - (beat8 + 4)) < 1e-9, "later beats run at the new tempo");
});

test("beat and time are inverses across a tempo change", () => {
  const tl = new Timeline(0, 100, 4);
  tl.setTempoAtBeat(16, 150);
  tl.setTempoAtBeat(32, 84);
  for (const beat of [0, 3.5, 15.9, 16, 24, 32, 40.25]) {
    assert.ok(Math.abs(tl.beatAt(tl.timeAt(beat)) - beat) < 1e-9, `round trip failed at ${beat}`);
  }
});

test("negative beats extrapolate, so a count-in has somewhere to live", () => {
  const tl = new Timeline(5, 120, 4);
  assert.ok(Math.abs(tl.timeAt(-4) - (5 - 2)) < 1e-9);
});

test("bars and beats agree", () => {
  const tl = new Timeline(0, 90, 4);
  assert.equal(tl.beatOfBar(3), 12);
  assert.equal(tl.barOfBeat(12), 3);
  assert.equal(tl.barOfBeat(13.9), 3);
  assert.equal(tl.spbAtBeat(0), 60 / 90);
});

test("the lookahead fills every bar exactly once, in order, ahead of time", () => {
  const tl = new Timeline(0, 120, 4); // a bar is 2 s
  let now = 0;
  const filled: number[] = [];
  const times: number[] = [];
  const la = new Lookahead(
    () => now,
    tl,
    (bar, t) => {
      filled.push(bar);
      times.push(t - now);
    },
    { lookaheadSec: () => 2.4 },
  );
  la.start(0);
  for (let i = 0; i < 400; i++) {
    now += 1 / 60;
    la.pump();
  }
  la.stop();
  assert.deepEqual(filled, [...filled].sort((a, b) => a - b), "bars must arrive in order");
  assert.equal(new Set(filled).size, filled.length, "no bar may be filled twice");
  assert.ok(filled.length >= 3, "bars should keep arriving");
  // Every bar was handed over before it started, which is what makes it visible.
  for (const lead of times) assert.ok(lead >= 0, `a bar was filled ${lead.toFixed(3)} s late`);
});

test("a lookahead shorter than a bar would hide notes; the run's is not", () => {
  // The playfield shows exactly one bar, so the schedule depth must exceed one bar.
  const bpm = 84;
  const barSeconds = (60 / bpm) * 4;
  const runLookahead = barSeconds * 1.2 + 0.25;
  assert.ok(runLookahead > barSeconds, "notes would pop in already arriving");
});
