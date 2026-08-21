import { test } from "node:test";
import assert from "node:assert/strict";
import { showcaseBar, polyBar, subdivisionFor, MUSICAL_CELLS, type ChartNote } from "./chart.ts";
import { grooveBar, laneOf, newGroove } from "./groove.ts";
import { windowsFor, verdictFor, BASE_WINDOWS } from "./judge.ts";
import { createStubHost, parseRat, fmt, rat } from "../stubHost.ts";

const out: ChartNote[] = [];

/* ---------------- subdivision mapping ---------------- */

test("an answer that is a musical denominator becomes that subdivision", () => {
  assert.deepEqual(subdivisionFor("1/8"), { cells: 8, accentEvery: 4 });
  assert.deepEqual(subdivisionFor("1/4"), { cells: 4, accentEvery: 2 });
  assert.deepEqual(subdivisionFor("1/3"), { cells: 3, accentEvery: 2 });
  assert.equal(subdivisionFor("8")!.cells, 8);
  assert.equal(subdivisionFor("16")!.cells, 16);
});

test("3/8 accents every third of eight — the tresillo, not a plain eighth line", () => {
  assert.deepEqual(subdivisionFor("3/8"), { cells: 8, accentEvery: 3 });
});

test("an answer that is not a rhythm returns null rather than being forced", () => {
  // The brief's rule: never cripple the game to force the elegant case.
  for (const a of ["37", "5", "1", "1/1", "1/5", "1/7", "banana", "", "2/9"]) {
    assert.equal(subdivisionFor(a), null, `expected null for ${JSON.stringify(a)}`);
  }
});

/* ---------------- groove shape ---------------- */

test("every generated note lands exactly on a cell boundary", () => {
  for (const cells of MUSICAL_CELLS) {
    const g = newGroove(cells * 31 + 7);
    g.cells = cells;
    for (let bar = 0; bar < 40; bar++) {
      grooveBar(g, 0.55, out);
      for (const n of out) {
        const expected = (n.cell * 4) / n.cells;
        assert.ok(
          Math.abs(n.beat - expected) < 1e-9,
          `bar ${bar} cells ${cells}: beat ${n.beat} is off the grid`,
        );
        assert.ok(n.beat >= 0 && n.beat < 4, `beat ${n.beat} escaped the bar`);
      }
    }
  }
});

test("a bar always announces itself on beat one", () => {
  for (const cells of MUSICAL_CELLS) {
    const g = newGroove(cells * 17 + 3);
    g.cells = cells;
    for (let bar = 0; bar < 30; bar++) {
      grooveBar(g, 0, out);
      assert.ok(out.some((n) => n.beat === 0), `bar ${bar} cells ${cells} lost its downbeat`);
    }
  }
});

test("notes never collide within a lane", () => {
  for (const cells of MUSICAL_CELLS) {
    const g = newGroove(cells * 101 + 11);
    g.cells = cells;
    g.accentEvery = 3;
    for (let bar = 0; bar < 60; bar++) {
      grooveBar(g, 1, out);
      const seen = new Set<string>();
      for (const n of out) {
        const k = `${n.lane}@${n.beat.toFixed(6)}`;
        assert.ok(!seen.has(k), `duplicate ${k} in bar ${bar} cells ${cells}`);
        seen.add(k);
      }
    }
  }
});

test("the showcase plays the answer in full — every slice is struck", () => {
  for (const cells of MUSICAL_CELLS) {
    showcaseBar(cells, 2, out);
    assert.equal(out.length, cells, `showcase at ${cells} cells produced ${out.length} notes`);
    for (const n of out) {
      assert.equal(n.lane, laneOf(n.cell, cells), "the payoff must lane a slice the way the groove does");
    }
  }
});

test("three-against-four really is three against four", () => {
  polyBar(1, out);
  const three = out.filter((n) => n.lane === 2);
  const four = out.filter((n) => n.lane !== 2);
  assert.equal(four.length, 4);
  assert.ok(three.length >= 2 && three.length <= 3);
  // They agree only on beat one — that is lcm(3,4) made audible.
  const shared = three.filter((a) => four.some((b) => Math.abs(a.beat - b.beat) < 1e-9));
  assert.deepEqual(shared.map((s) => s.beat), [0]);
});

/* ---------------- judgement ---------------- */

test("windows never let one tap claim two adjacent notes", () => {
  // 16ths at 152bpm are ~99ms apart. The base Good window is 155ms, which would
  // overlap; the clamp is what stops a fast run turning into mush.
  for (const spacing of [0.06, 0.1, 0.15, 0.25, 0.5, 1]) {
    const w = windowsFor(spacing);
    assert.ok(w.miss * 2 <= spacing * 1.001, `miss window ${w.miss} overlaps at spacing ${spacing}`);
    assert.ok(w.perfect <= w.great && w.great <= w.good && w.good <= w.miss, "windows out of order");
  }
});

test("wide spacing keeps the generous base windows", () => {
  const w = windowsFor(2);
  assert.equal(w.perfect, BASE_WINDOWS.perfect);
  assert.equal(w.good, BASE_WINDOWS.good);
});

test("verdicts are symmetric about the beat and give up outside the window", () => {
  const w = windowsFor(1);
  assert.equal(verdictFor(0, w), "perfect");
  assert.equal(verdictFor(-0.05, w), "perfect");
  assert.equal(verdictFor(0.09, w), "great");
  assert.equal(verdictFor(-0.14, w), "good");
  assert.equal(verdictFor(0.19, w), "miss");
  assert.equal(verdictFor(0.4, w), null);
  assert.equal(verdictFor(-0.4, w), null);
});

/* ---------------- the stub host ---------------- */

test("exact rationals: no float ever reaches an answer string", () => {
  assert.equal(fmt(rat(2, 8)), "1/4");
  assert.equal(fmt(rat(4, 2)), "2");
  assert.equal(fmt(rat(-2, -4)), "1/2");
  assert.equal(fmt(rat(3, -9)), "-1/3");
  for (const s of ["1/4", "3", "3/8", "-1/3"]) {
    assert.equal(fmt(parseRat(s)!), s, `round trip failed for ${s}`);
  }
});

test("the host is deterministic under a seed", () => {
  const a = createStubHost({ seed: 99 });
  const b = createStubHost({ seed: 99 });
  for (let i = 0; i < 200; i++) {
    const qa = a.next({ difficulty: (i % 10) + 1 });
    const qb = b.next({ difficulty: (i % 10) + 1 });
    assert.deepEqual(qa, qb);
  }
});

test("no question is unwinnable: two distinct distractors, none equal to the answer", () => {
  const h = createStubHost({ seed: 7 });
  for (let i = 0; i < 4000; i++) {
    const q = h.next({ difficulty: (i % 10) + 1 });
    const tiles = [q.answer, ...q.distractors.slice(0, 2)];
    assert.equal(new Set(tiles).size, 3, `duplicate tile in ${q.prompt} -> ${tiles.join("|")}`);
    assert.ok(q.distractors.length >= 2, `too few distractors for ${q.prompt}`);
  }
});

test("every answer is an exact integer or reduced fraction — never a decimal", () => {
  const h = createStubHost({ seed: 11 });
  for (let i = 0; i < 4000; i++) {
    const q = h.next({ difficulty: (i % 10) + 1 });
    for (const s of [q.answer, ...q.distractors]) {
      assert.ok(!s.includes("."), `decimal leaked into ${JSON.stringify(s)} from ${q.prompt}`);
      assert.notEqual(parseRat(s), null, `unparseable answer ${JSON.stringify(s)} from ${q.prompt}`);
    }
  }
});

test("plain-arithmetic mode still yields playable questions (graceful degradation)", () => {
  const h = createStubHost({ seed: 3, musical: false });
  let musical = 0;
  for (let i = 0; i < 500; i++) {
    const q = h.next({ difficulty: 6 });
    if (subdivisionFor(q.answer)) musical++;
    assert.ok(q.prompt.length > 0);
  }
  // Most plain-arithmetic answers are not rhythms. The game must survive that.
  assert.ok(musical < 400, "expected mostly unplayable answers in arithmetic mode");
});
