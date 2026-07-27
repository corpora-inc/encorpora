import { test } from "node:test";
import assert from "node:assert/strict";
import { add, cmp, div, eq, int, mul, percentText, rat, ratText, sub } from "./rational.ts";
import { faceExpr, faceFrac, faceInt, guilty, ruleBanner } from "./rules.ts";
import type { Rule } from "./rules.ts";

test("rational arithmetic is exact where floats are not", () => {
  // The canonical float failure: 0.1 + 0.2 !== 0.3.
  const a = rat(1, 10);
  const b = rat(2, 10);
  assert.ok(eq(add(a, b), rat(3, 10)));
  assert.equal(0.1 + 0.2 === 0.3, false);

  // 1/3 + 1/6 = 1/2, exactly, with no representation error.
  assert.ok(eq(add(rat(1, 3), rat(1, 6)), rat(1, 2)));
  assert.ok(eq(sub(rat(3, 4), rat(1, 4)), rat(1, 2)));
  assert.ok(eq(mul(rat(2, 3), rat(3, 2)), int(1)));
  assert.ok(eq(div(rat(1, 2), rat(1, 4)), int(2)));
});

test("rationals reduce and normalise sign", () => {
  assert.deepEqual(rat(4, 8), { n: 1, d: 2 });
  assert.deepEqual(rat(-4, -8), { n: 1, d: 2 });
  assert.deepEqual(rat(3, -6), { n: -1, d: 2 });
  assert.throws(() => rat(1, 0));
  assert.throws(() => rat(1.5, 2));
});

test("ordering is a cross-multiplication, never a division", () => {
  assert.equal(cmp(rat(1, 3), rat(2, 5)), -1);
  assert.equal(cmp(rat(2, 5), rat(1, 3)), 1);
  assert.equal(cmp(rat(2, 4), rat(1, 2)), 0);
  // 355/113 vs 22/7 — both round to 3.14 in a float compare at low precision.
  assert.equal(cmp(rat(355, 113), rat(22, 7)), -1);
});

test("multiples", () => {
  const r: Rule = { kind: "multiple", target: int(6) };
  for (const n of [6, 12, 18, 42, 60, 0]) assert.equal(guilty(r, int(n)), true, `${n}`);
  for (const n of [7, 11, 41, 43, 59]) assert.equal(guilty(r, int(n)), false, `${n}`);
  // A fraction is never a multiple of anything.
  assert.equal(guilty(r, rat(1, 2)), false);
});

test("factors", () => {
  const r: Rule = { kind: "factor", target: int(24) };
  for (const n of [1, 2, 3, 4, 6, 8, 12, 24]) assert.equal(guilty(r, int(n)), true, `${n}`);
  for (const n of [5, 7, 9, 10, 11, 13, 48]) assert.equal(guilty(r, int(n)), false, `${n}`);
  assert.equal(guilty(r, int(0)), false, "zero divides nothing");
});

test("equals covers integers, equivalent fractions and percentages", () => {
  const twelve: Rule = { kind: "equals", target: int(12) };
  assert.equal(guilty(twelve, faceExpr(7, "+", 5).value), true);
  assert.equal(guilty(twelve, faceExpr(20, "−", 8).value), true);
  assert.equal(guilty(twelve, faceExpr(3, "×", 4).value), true);
  assert.equal(guilty(twelve, faceExpr(48, "÷", 4).value), true);
  assert.equal(guilty(twelve, faceExpr(7, "+", 6).value), false);

  const half: Rule = { kind: "equals", target: rat(1, 2) };
  for (const [n, d] of [
    [1, 2],
    [2, 4],
    [3, 6],
    [7, 14],
    [50, 100],
  ] as [number, number][]) {
    assert.equal(guilty(half, faceFrac(n, d).value), true, `${n}/${d}`);
  }
  for (const [n, d] of [
    [1, 3],
    [2, 5],
    [3, 5],
    [4, 9],
  ] as [number, number][]) {
    assert.equal(guilty(half, faceFrac(n, d).value), false, `${n}/${d}`);
  }
});

test("comparison rules", () => {
  const gt: Rule = { kind: "greater", target: int(40) };
  assert.equal(guilty(gt, int(41)), true);
  assert.equal(guilty(gt, int(40)), false);
  assert.equal(guilty(gt, faceExpr(30, "+", 15).value), true);
  const lt: Rule = { kind: "less", target: int(25) };
  assert.equal(guilty(lt, int(24)), true);
  assert.equal(guilty(lt, int(25)), false);
});

test("the banner is glyphs and numerals only — it never needs translating", () => {
  const banners = [
    ruleBanner({ kind: "multiple", target: int(6) }),
    ruleBanner({ kind: "factor", target: int(24) }),
    ruleBanner({ kind: "equals", target: int(12) }),
    ruleBanner({ kind: "equals", target: rat(1, 2) }),
    ruleBanner({ kind: "equals", target: rat(1, 2), asPercent: true }),
    ruleBanner({ kind: "greater", target: int(40) }),
    ruleBanner({ kind: "less", target: int(25) }),
  ];
  assert.deepEqual(banners, ["× 6", "24 ÷ ▪", "= 12", "= 1/2", "= 50%", "> 40", "< 25"]);
  for (const b of banners) assert.equal(/[A-Za-z]/.test(b), false, b);
});

test("percent is exact or absent — never a rounded decimal", () => {
  assert.equal(percentText(rat(1, 2)), "50%");
  assert.equal(percentText(rat(1, 4)), "25%");
  assert.equal(percentText(rat(1, 3)), null);
  assert.equal(ratText(int(7)), "7");
  assert.equal(ratText(rat(3, 6)), "1/2");
});

test("a division tile is only ever generated when it comes out whole", () => {
  assert.equal(faceExpr(48, "÷", 8).value.n, 6);
  assert.throws(() => faceExpr(50, "÷", 8), /inexact/);
  assert.equal(faceInt(42).text, "42");
});
