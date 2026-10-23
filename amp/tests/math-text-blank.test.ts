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

test("a question mark after explicit TeX is prose, not a blank", () => {
  const s = segments("What is $\\log_2 8$?");
  assert.deepEqual(s.at(-1), { text: "?", math: false });
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

test("coordinate lists wrap between complete pairs, with or without negative coordinates", () => {
  for (const pairs of [
    ["(1, 2)", "(3, 4)", "(5, 6)"],
    ["(-3, 2)", "(-2, 2)", "(-1, -4)"],
    ["(0.5, -2.5)", "(3, 4)", "(5, 6)"],
  ]) {
    for (const [open, close] of [
      ["", ""],
      ["{", "}"],
    ]) {
      const text = open + pairs.join(", ") + close;
      const parts = segments(text);
      assert.deepEqual(
        parts.filter((s) => s.math).map((s) => s.plain),
        pairs,
      );
      assert.equal(parts.map((s) => s.plain ?? s.text).join(""), text);
      assert.equal(
        parts.filter((s) => !s.math && s.text.includes(", ")).length,
        2,
      );
    }
  }
});

test("wrapping opportunities do not split grouped expressions or explicit TeX", () => {
  assert.deepEqual(
    segments("(x + 1)/(x - 2), 3/4")
      .filter((s) => s.math)
      .map((s) => s.plain),
    ["(x + 1)/(x - 2)", "3/4"],
  );
  assert.deepEqual(segments("$\\frac{a,b}{c,d}$"), [
    { text: "\\frac{a,b}{c,d}", math: true, plain: "\\frac{a,b}{c,d}" },
  ]);
  assert.equal(segments("f(1, 2) = 4").filter((s) => s.math).length, 1);
});

test("a variable introducing a grouped formula stays typeset", () => {
  const parts = segments("Factor out x: 16x² − 32x = x(16x − 32) = 0.");
  assert.ok(parts.some((part) => part.math && part.text === "x"));
  assert.equal(
    parts
      .filter((part) => !part.math)
      .map((part) => part.text)
      .join(""),
    "Factor out : .",
  );
});
