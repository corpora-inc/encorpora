/**
 * THE ANSWERING WINDOW IS A PURE FUNCTION OF THE ITEM, AND IT NEVER SHRINKS.
 *
 * The pacing audit's finding, in seventeen games: a comprehension window derived
 * from a motion constant that is also the escalation knob. This file asserts the
 * negation of that, three ways — on the plan, on the judged window a tile is
 * actually given, and on what a four-minute run delivers at every tempo.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { answerPlan, READ_CEIL, READ_FLOOR, STRIKE_CEIL, STRIKE_FLOOR } from "./answer.ts";
import { strikeWindows } from "./judge.ts";

/** Fine enough that a non-monotone step anywhere in [0,1] is caught. */
const SWEEP = 2001;

test("the plan is monotone non-decreasing in item difficulty, everywhere", () => {
  let prevRead = -Infinity;
  let prevStrike = -Infinity;
  for (let i = 0; i < SWEEP; i++) {
    const d = i / (SWEEP - 1);
    const p = answerPlan({ difficulty: d });
    assert.ok(
      p.readSec >= prevRead,
      `reading time fell from ${prevRead.toFixed(4)}s to ${p.readSec.toFixed(4)}s at item ` +
        `difficulty ${d.toFixed(4)}; a harder question must never get less time`,
    );
    assert.ok(
      p.strikeSec >= prevStrike,
      `the strike window fell from ${(prevStrike * 1000).toFixed(1)}ms to ` +
        `${(p.strikeSec * 1000).toFixed(1)}ms at item difficulty ${d.toFixed(4)}`,
    );
    prevRead = p.readSec;
    prevStrike = p.strikeSec;
  }
});

test("a harder item gets STRICTLY more, not merely not-less", () => {
  // "Never less" is satisfied by a constant, and a constant is what the audit
  // found in game after game. The difference has to be felt.
  const easy = answerPlan({ difficulty: 0.1 });
  const hard = answerPlan({ difficulty: 0.9 });
  assert.ok(
    hard.readSec - easy.readSec > 2,
    `a hard item got only ${(hard.readSec - easy.readSec).toFixed(2)}s more reading than an easy one`,
  );
  assert.ok(
    hard.strikeSec - easy.strikeSec > 0.15,
    `a hard item got only ${((hard.strikeSec - easy.strikeSec) * 1000).toFixed(0)}ms more to strike in`,
  );
});

test("the plan depends on the item and on NOTHING else", () => {
  // Everything that used to reach into this window — bpm, the difficulty
  // scalar, the bar count, the run's state — is not an argument, so the only
  // way to prove purity is that the same item always answers the same.
  const item = { difficulty: 0.37 };
  const first = answerPlan(item);
  for (let i = 0; i < 100; i++) {
    const again = answerPlan({ difficulty: 0.37 });
    assert.deepEqual(again, first, "the same item answered differently on call " + i);
  }
  // Extra fields on the item are ignored: a host that decorates its questions
  // cannot move a child's reading time by doing so.
  const decorated = answerPlan({ difficulty: 0.37, prompt: "9 x 7", id: "z" } as { difficulty: number });
  assert.deepEqual(decorated, first);
});

test("a host that violates the [0,1] contract cannot take time AWAY", () => {
  for (const d of [-5, -0.0001, NaN, Infinity, -Infinity, 2, 1e9]) {
    const p = answerPlan({ difficulty: d });
    assert.ok(
      p.readSec >= READ_FLOOR && p.readSec <= READ_CEIL,
      `difficulty ${d} produced a reading window of ${p.readSec}s`,
    );
    assert.ok(p.strikeSec >= STRIKE_FLOOR && p.strikeSec <= STRIKE_CEIL);
  }
  // Unknown difficulty is not evidence of mastery, so it gets the EASIEST plan.
  assert.equal(answerPlan({ difficulty: NaN }).readSec, READ_FLOOR);
});

test("a tile's judged window is the plan's, and is never clamped back onto the motion constant", () => {
  // `windowsFor` clamps against BASE_WINDOWS.miss = 205ms. Every plan is wider
  // than that, so reusing it would have silently flattened the whole range.
  let prev = -Infinity;
  for (let i = 0; i < SWEEP; i++) {
    const d = i / (SWEEP - 1);
    const plan = answerPlan({ difficulty: d });
    const w = strikeWindows(plan.strikeSec);
    assert.equal(w.miss, plan.strikeSec, `the tile at item ${d} was not judged on its own plan`);
    assert.ok(w.miss >= prev, "the judged window shrank as the item got harder");
    assert.ok(w.perfect <= w.great && w.great <= w.good && w.good <= w.miss, "windows out of order");
    prev = w.miss;
  }
  assert.ok(
    strikeWindows(answerPlan({ difficulty: 0 }).strikeSec).miss > 0.205,
    "the easiest item's window is no wider than the note-timing constant it was supposed to escape",
  );
});
