import { test } from "node:test";
import assert from "node:assert/strict";
import { segments, toTex, withSeparators } from "../src/web/MathText";

// A missing number is part of its equation: one formula, typeset spacing.
test("a blank and its equation typeset as one formula", () => {
  for (const prompt of [
    "□ ÷ 9 = 8. What number belongs in the blank?",
    "? ÷ 9 = 8. What number belongs in the blank?",
  ]) {
    const math = segments(prompt).filter((s) => s.math);
    assert.equal(math.length, 1, JSON.stringify(segments(prompt)));
    assert.match(
      math[0]!.text,
      /\\boxed\{\\phantom\{0\}\}\s*\\div\s*9\s*=\s*8/,
    );
  }
  assert.match(toTex("6×□=24"), /\\times\s*\\boxed\{\\phantom\{0\}\}/);
});

test("a sentence-ending question mark is still prose", () => {
  const s = segments("What is 3 + 4?");
  assert.equal(s.at(-1)!.text.endsWith("?"), true);
  assert.equal(s.filter((x) => x.math).length, 1);
});

test("a thousands separator stays inside its numeral", () => {
  const math = segments("Multiply: 2,000 × 3 = 6,000; 70 × 50 = 3,500.")
    .filter((s) => s.math)
    .map((s) => s.text);
  assert.deepEqual(math, [
    "2{,}000 \\times  3 = 6{,}000",
    "70 \\times  50 = 3{,}500",
  ]);
  assert.equal(toTex("372,946 + 1,000,000"), "372{,}946 + 1{,}000{,}000");
  assert.equal(toTex("(1,2)"), "(1,2)");
});

test("a whole-number answer shows thousands separators", () => {
  assert.equal(withSeparators("6084"), "6,084");
  assert.equal(withSeparators("372946"), "372,946");
  assert.equal(withSeparators("940"), "940");
  assert.equal(withSeparators("3/4"), "3/4");
});

test("a bare symbol named in prose keeps its comma as prose", () => {
  const s = segments("choose the true statement with <, = or >.");
  const comma = s.findIndex((x) => !x.math && x.text.startsWith(","));
  assert.ok(comma > 0 && s[comma - 1]!.math, JSON.stringify(s));
});
