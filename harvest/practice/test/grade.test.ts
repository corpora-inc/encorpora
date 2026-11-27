import { test } from "node:test";
import assert from "node:assert/strict";
import { grade, parseNumber, parseNumericKey, parseRubric, type Item } from "../src/index.ts";

const mc: Item = { id: "q", skillId: "s", kind: "mc", choiceCount: 4, answer: "2", difficulty: 0.5 };
const num = (answer: string): Item => ({ id: "n", skillId: "s", kind: "numeric", answer, difficulty: 0.5 });
const ft = (rubric: object): Item => ({ id: "f", skillId: "s", kind: "free_text", answer: JSON.stringify(rubric), difficulty: 0.5 });

test("mc: index match, number or text", () => {
  assert.deepEqual(grade(mc, 2), { correct: true, score: 1 });
  assert.deepEqual(grade(mc, "2"), { correct: true, score: 1 });
  assert.equal(grade(mc, 1).correct, false);
  assert.equal(grade(mc, "two").correct, false);
});

test("no response is wrong, never an error", () => {
  for (const r of [null, undefined, ""]) {
    assert.equal(grade(mc, r).correct, false);
    assert.equal(grade(num("5"), r).correct, false);
  }
});

test("mc with a broken key throws", () => {
  assert.throws(() => grade({ ...mc, answer: "b" }, 1));
});

test("numeric: exact by default, binary rounding absorbed", () => {
  assert.equal(grade(num("0.3"), 0.1 + 0.2).correct, true);
  assert.equal(grade(num("25"), 25).correct, true);
  assert.equal(grade(num("25"), 25.01).correct, false);
  assert.equal(grade(num("25"), "25").correct, true);
  assert.equal(grade(num("1,200"), "1200").correct, true);
  assert.equal(grade(num("1200"), "1,200").correct, true);
  assert.equal(grade(num("25"), "25 ft").correct, false);
  assert.equal(grade(num("-4"), -4).correct, true);
});

test("numeric: tolerance forms", () => {
  assert.deepEqual(parseNumericKey("25±0.5"), { value: 25, tolerance: 0.5 });
  assert.deepEqual(parseNumericKey("25 +/- 0.5"), { value: 25, tolerance: 0.5 });
  assert.deepEqual(parseNumericKey("25+-1"), { value: 25, tolerance: 1 });
  assert.equal(grade(num("25±0.5"), 25.5).correct, true);
  assert.equal(grade(num("25±0.5"), 24.5).correct, true);
  assert.equal(grade(num("25±0.5"), 25.51).correct, false);
});

test("numeric: bad keys throw", () => {
  for (const k of ["", "abc", "25±", "25±-1", "1,2"]) assert.throws(() => parseNumericKey(k), Error, k);
});

test("parseNumber accepts plain decimals only", () => {
  assert.equal(parseNumber(" 12.5 "), 12.5);
  assert.equal(parseNumber(".5"), 0.5);
  assert.equal(parseNumber("1,234,567"), 1234567);
  assert.equal(parseNumber("1e3"), null);
  assert.equal(parseNumber("0x10"), null);
  assert.equal(parseNumber("12,34"), null);
  assert.equal(parseNumber(""), null);
});

test("free text: whole-word rubric points, pass count", () => {
  const item = ft({ points: [{ id: "lines", any: ["power line", "energized line"] }, { id: "dist", any: ["20 feet", "twenty feet"] }], pass: 1 });
  const g = grade(item, "Stay twenty feet from the Energized line.");
  assert.equal(g.correct, true);
  assert.equal(g.score, 1);
  assert.deepEqual(g.matched, ["lines", "dist"]);
  const partial = grade(item, "keep clear of the power line");
  assert.equal(partial.correct, true);
  assert.equal(partial.score, 0.5);
  assert.equal(grade(item, "powerline").correct, false, "whole words only");
});

test("free text: default pass needs every point", () => {
  const item = ft({ points: [{ id: "a", any: ["outrigger"] }, { id: "b", any: ["fully extended"] }] });
  assert.equal(grade(item, "the outrigger").correct, false);
  assert.equal(grade(item, "each outrigger fully extended").correct, true);
});

test("rubric validation", () => {
  assert.throws(() => parseRubric("{}"));
  assert.throws(() => parseRubric(JSON.stringify({ points: [] })));
  assert.throws(() => parseRubric(JSON.stringify({ points: [{ id: "a", any: [] }] })));
  assert.throws(() => parseRubric(JSON.stringify({ points: [{ id: "a", any: ["x"] }], pass: 2 })));
  assert.throws(() => parseRubric("not json"));
});
