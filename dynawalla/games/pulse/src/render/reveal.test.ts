/**
 * What a child sees when a fraction gate goes wrong.
 *
 * `dynawalla/docs/EXPERIENCE_DESIGN.md`: a miss completes the sum in front of
 * them, held, in the accent colour, never red. PULSE used to answer a wrong
 * strike with the word "OFF" in rose and an unanswered one with "GONE", and
 * then take the question away — so the one moment a child is certainly paying
 * attention was spent telling them off and never telling them the answer.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { GATE_READ_SEC } from "../game/run.ts";
import { INK } from "./palette.ts";
import { missReveal, REVEAL_SEC } from "./scene.ts";
import type { BuiltGate } from "../game/gate.ts";

const gate = (): BuiltGate => ({
  questionId: "q1",
  prompt: "1/2 + 1/4",
  positional: true,
  candidates: [
    { label: "1/4", pos: 0.25, correct: false, frac: { n: 1, d: 4 } },
    { label: "3/4", pos: 0.75, correct: true, frac: { n: 3, d: 4 } },
  ],
});

test("a miss finishes the sum rather than naming a verdict", () => {
  const r = missReveal(gate());
  assert.equal(r.text, "1/2 + 1/4 = 3/4");
  for (const verdict of ["OFF", "GONE", "WRONG", "NO"]) {
    assert.ok(!r.text.includes(verdict), `the reveal said ${verdict}`);
  }
});

test("a miss is never red", () => {
  const r = missReveal(gate());
  assert.notEqual(r.ink, "rose");
  const [red, green, blue] = INK[r.ink];
  assert.ok(
    green + blue > red,
    `${r.ink} is rgb(${red},${green},${blue}) — a warning colour, not an accent`,
  );
});

test("a gate with no correct candidate still shows the question, not a blank", () => {
  const broken: BuiltGate = { ...gate(), candidates: gate().candidates.map((c) => ({ ...c, correct: false })) };
  const r = missReveal(broken);
  assert.equal(r.text, "1/2 + 1/4");
  assert.ok(r.text.length > 0);
});

test("the reveal is held long enough to read, and the hold is not a tempo", () => {
  // Long enough that reading it is possible at all, and never so short that a
  // child who has got GOOD at the game — which is what raises the tempo — ends
  // up with less time to look at the answer than one who has not. It is a
  // constant, so there is nothing for the tempo to be in it.
  assert.ok(REVEAL_SEC >= 3, `${REVEAL_SEC}s is not long enough to read a sum`);
  assert.ok(REVEAL_SEC <= GATE_READ_SEC, "the reveal must not outlast the next question's reading window");
  assert.equal(typeof REVEAL_SEC, "number");
});
