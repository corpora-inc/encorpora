import { test } from "node:test";
import assert from "node:assert/strict";
import { barNotes, BEATS_PER_BAR, laneVoices, _clearChartCache } from "./chart.ts";
import { STAGES, stageAt } from "./stages.ts";

test("the same seed and bar is always the same bar", () => {
  const a = barNotes(STAGES[3]!, "seed-a", 17);
  _clearChartCache();
  const b = barNotes(STAGES[3]!, "seed-a", 17);
  assert.deepEqual(a, b);
  _clearChartCache();
  const c = barNotes(STAGES[3]!, "seed-b", 17);
  assert.notDeepEqual(a, c);
});

test("every bar is playable: in range, in bounds, and not a wall", () => {
  for (let s = 0; s < 12; s++) {
    const stage = stageAt(s);
    for (let bar = 0; bar < 24; bar++) {
      const notes = barNotes(stage, "playable", bar);
      assert.ok(notes.length > 0, `stage ${s} bar ${bar} is empty`);
      assert.ok(notes.length <= 30, `stage ${s} bar ${bar} has ${notes.length} notes`);
      for (const n of notes) {
        assert.ok(n.beatInBar >= 0 && n.beatInBar < BEATS_PER_BAR, `beat ${n.beatInBar} out of bar`);
        assert.ok(n.lane >= 0 && n.lane < stage.lanes, `lane ${n.lane} outside ${stage.lanes}`);
        assert.ok(laneVoices(stage.lanes).includes(n.kind) || n.kind === "tom");
      }
    }
  }
});

test("no lane is ever asked for two notes at the same instant", () => {
  for (let s = 0; s < 12; s++) {
    const stage = stageAt(s);
    for (let bar = 0; bar < 16; bar++) {
      const seen = new Set<string>();
      for (const n of barNotes(stage, "collide", bar)) {
        const key = `${n.lane}:${n.beatInBar.toFixed(4)}`;
        assert.ok(!seen.has(key), `stage ${s} bar ${bar}: duplicate at ${key}`);
        seen.add(key);
      }
    }
  }
});

test("hands stay physically possible, including across the bar line", () => {
  for (let s = 0; s < 12; s++) {
    const stage = stageAt(s);
    const spb = 60 / stage.bpm;
    // Lay 16 consecutive bars end to end and look at every gap in every lane.
    const byLane = new Map<number, number[]>();
    for (let bar = 0; bar < 16; bar++) {
      for (const n of barNotes(stage, "speed", bar)) {
        const arr = byLane.get(n.lane) ?? [];
        arr.push(bar * BEATS_PER_BAR + n.beatInBar);
        byLane.set(n.lane, arr);
      }
    }
    for (const [lane, beats] of byLane) {
      beats.sort((a, b) => a - b);
      for (let i = 1; i < beats.length; i++) {
        const ms = (beats[i]! - beats[i - 1]!) * spb * 1000;
        assert.ok(ms >= 85, `stage ${s} lane ${lane}: ${ms.toFixed(1)} ms apart`);
      }
    }
  }
});

test("the downbeat is always there — the groove has an anchor", () => {
  for (let s = 0; s < 8; s++) {
    const stage = STAGES[s]!;
    for (let bar = 0; bar < 8; bar++) {
      const notes = barNotes(stage, "anchor", bar);
      assert.ok(
        notes.some((n) => n.beatInBar === 0),
        `stage ${s} bar ${bar} has no downbeat`,
      );
    }
  }
});

test("a polyrhythm stage really lays N notes evenly across the bar", () => {
  const stage = STAGES[5]!; // three over four
  assert.ok(stage.poly);
  const notes = barNotes(stage, "poly", 4).filter((n) => n.div === -stage.poly!.perBar);
  assert.equal(notes.length, stage.poly!.perBar);
  const beats = notes.map((n) => n.beatInBar).sort((a, b) => a - b);
  for (let i = 0; i < beats.length; i++) {
    assert.ok(
      Math.abs(beats[i]! - (i * BEATS_PER_BAR) / stage.poly!.perBar) < 1e-6,
      `poly note ${i} at ${beats[i]}`,
    );
  }
});

test("a phrase restates itself rather than being fresh noise every bar", () => {
  const stage = STAGES[1]!;
  const sig = (bar: number) =>
    barNotes(stage, "motif", bar)
      .map((n) => `${n.lane}@${n.beatInBar}`)
      .sort()
      .join(",");
  const a = sig(0);
  const b = sig(2);
  const shared = a.split(",").filter((x) => b.includes(x)).length;
  assert.ok(shared >= a.split(",").length * 0.7, "bars 0 and 2 of a phrase should share a motif");
});

test("escalation is monotone where it should be and bounded where it must be", () => {
  for (let i = 1; i < STAGES.length; i++) {
    assert.ok(STAGES[i]!.bpm >= STAGES[i - 1]!.bpm, `stage ${i} slowed down`);
    assert.ok(STAGES[i]!.gateFloor > STAGES[i - 1]!.gateFloor, `stage ${i} got easier`);
  }
  for (let i = STAGES.length; i < 80; i++) {
    const s = stageAt(i);
    assert.ok(s.bpm <= 168, `endless stage ${i} runs at ${s.bpm} bpm`);
    assert.ok(s.gateFloor <= 1, `endless stage ${i} floor ${s.gateFloor}`);
    assert.ok(s.density <= 0.65, `endless stage ${i} density ${s.density}`);
    assert.ok(s.lanes <= 3 && s.bars > 0);
  }
  assert.ok(stageAt(40).bpm > STAGES[STAGES.length - 1]!.bpm, "endless mode must keep climbing");
});
