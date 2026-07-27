import test from "node:test";
import assert from "node:assert/strict";
import { laneOptions, nudge } from "./options.ts";
import { CHARS } from "./glyphs.ts";
import { Rng } from "./rng.ts";

/**
 * Three lanes means a guesser is right one time in three. Everything here is
 * about making sure the other two lanes are worth reading — that they are never
 * the answer, never each other, never `NaN`, and never a string the atlas would
 * mangle into a different number on the way to the screen.
 *
 * The gates on the causeway and the recharge gate share this file, so these
 * assertions cover both.
 */

const renderable = (s: string): boolean => s.length > 0 && [...s].every((c) => CHARS.includes(c));

function check(answer: string, distractors: string[], seed: number): void {
  const { values, correct } = laneOptions(answer, distractors, new Rng(seed));
  assert.ok(correct >= 0 && correct <= 2, `correct lane ${correct} is not a lane`);
  assert.equal(new Set(values).size, 3, `${answer} -> ${values.join(" | ")} repeats a lane`);
  for (const v of values) {
    assert.ok(renderable(v), `"${v}" contains a character the atlas cannot draw`);
  }
  assert.equal(values[correct].replace(/−/g, "-"), answer.replace(/−/g, "-"));
}

test("a well-supplied question uses the host's own mal-rule distractors", () => {
  const { values, correct } = laneOptions("42", ["13", "35", "36"], new Rng(9));
  assert.equal(values[correct], "42");
  const wrong = values.filter((_, i) => i !== correct);
  for (const w of wrong) assert.ok(["13", "35", "36"].includes(w), `invented "${w}" with real ones available`);
});

test("three lanes are always filled, distinct, and never leak the answer", () => {
  const cases: Array<[string, string[]]> = [
    ["42", ["13", "35", "36"]],
    ["7", ["8"]],
    ["7", []],
    ["0", []],
    ["0", ["0", "0"]],
    ["-5", ["-6"]],
    ["−5", []],
    ["100", ["100", "100", "100"]],
    ["3/4", []],
    ["3/4", ["1/4"]],
    ["1.5", []],
    ["999", []],
  ];
  for (const [answer, distractors] of cases) {
    for (let seed = 1; seed <= 40; seed++) check(answer, distractors, seed);
  }
});

test("a host that offers nothing usable still produces a playable gate", () => {
  // The old code did `String(Number(answer) + k)` here, which is the literal
  // string "NaN" for any answer that is not a bare number — shown to a child,
  // in a lane, as if it were a real option.
  const { values } = laneOptions("3/4", [], new Rng(3));
  for (const v of values) assert.ok(!v.includes("N"), `offered "${v}"`);
  assert.deepEqual([...values].sort(), ["3/3", "3/4", "3/5"]);
});

test("duplicate and empty distractors are dropped rather than shown", () => {
  const { values, correct } = laneOptions("12", ["12", "", "12", "13"], new Rng(5));
  assert.equal(values[correct], "12");
  assert.ok(values.includes("13"));
  assert.equal(new Set(values).size, 3);
});

test("a seed lays out the same gate every time, and different seeds differ", () => {
  const one = laneOptions("42", ["13", "35", "36"], new Rng(2024));
  const two = laneOptions("42", ["13", "35", "36"], new Rng(2024));
  assert.deepEqual(one, two);
  const lanes = new Set<number>();
  for (let s = 1; s <= 60; s++) lanes.add(laneOptions("42", ["13", "35", "36"], new Rng(s)).correct);
  assert.equal(lanes.size, 3, "the answer never reached one of the three lanes");
});

test("the nudge is exact decimal arithmetic, never a float", () => {
  assert.equal(nudge("42", 1), "43");
  assert.equal(nudge("42", -1), "41");
  assert.equal(nudge("999", 1), "1000");
  assert.equal(nudge("0", -1), null, "a nudge must not invent a stray minus sign");
  assert.equal(nudge("3/4", 1), "3/5");
  assert.equal(nudge("1.5", 1), "1.6");
  assert.equal(nudge("−5", 1), "−6");
  assert.equal(nudge("?", 1), null);
  // Past 2^53 a float nudge starts returning the number it was given.
  assert.equal(nudge("9007199254740993", 1), "9007199254740994");
});
