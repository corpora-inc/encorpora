import test from "node:test";
import assert from "node:assert/strict";
import { generateProblem } from "../src/math/engine";

/** Teaching text over many seeds of one template: explanation, hint and feedback. */
function texts(id: string, seeds = 300): string[] {
  const out: string[] = [];
  for (let i = 0; i < seeds; i++) {
    const p = generateProblem(id, `text-${i}`);
    out.push(
      ...p.explanation,
      p.hint,
      ...Object.values(p.choiceFeedback ?? {}),
    );
  }
  return out;
}
const offenders = (id: string, bad: RegExp) =>
  texts(id).filter((t) => bad.test(t));

test("a coefficient of 1 is never printed before a root or a variable", () => {
  assert.deepEqual(
    offenders("tangent-quadrant-cosine", /(?<![\d.])1\\sqrt|(?<![\d.])1√/),
    [],
  );
  assert.deepEqual(
    offenders("solve-by-completing-square", /[+-]\s*1x(?![\d])/),
    [],
  );
});

test("a zero root is written as x, not (x - 0)", () => {
  assert.deepEqual(offenders("square-root-extraneous", /\(x\s*[-−]\s*0\)/), []);
});

test("subtracting a negative number is said as adding", () => {
  assert.deepEqual(
    offenders("quadratic-form-conversion", /[Ss]ubtract\s*\$?[−-]\d/),
    [],
  );
});

test("one asymptote is singular", () => {
  const texts1 = texts("rational-function-features");
  const plural = texts1.filter(
    (t) =>
      /asymptotes are (?:the line )?\$[^$]*\$\.?(?:$|\s[A-Z])/.test(t) &&
      !/ and /.test(t.split("asymptotes are")[1] ?? ""),
  );
  assert.deepEqual(plural, []);
});
