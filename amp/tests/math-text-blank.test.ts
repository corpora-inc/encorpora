import { test } from "node:test";
import assert from "node:assert/strict";
import { segments, toTex } from "../src/web/MathText";

// A missing number is part of its equation: one formula, typeset spacing.
test("a blank and its equation typeset as one formula", () => {
  for (const prompt of ["□ ÷ 9 = 8. What number belongs in the blank?", "? ÷ 9 = 8. What number belongs in the blank?"]) {
    const math = segments(prompt).filter((s) => s.math);
    assert.equal(math.length, 1, JSON.stringify(segments(prompt)));
    assert.match(math[0]!.text, /\\boxed\{\\phantom\{0\}\}\s*\\div\s*9\s*=\s*8/);
  }
  assert.match(toTex("6×□=24"), /\\times\s*\\boxed\{\\phantom\{0\}\}/);
});

test("a sentence-ending question mark is still prose", () => {
  const s = segments("What is 3 + 4?");
  assert.equal(s.at(-1)!.text.endsWith("?"), true);
  assert.equal(s.filter((x) => x.math).length, 1);
});
