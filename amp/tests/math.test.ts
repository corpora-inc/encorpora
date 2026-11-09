import test from "node:test";
import assert from "node:assert/strict";
import {
  generateProblem,
  gradeAnswer,
  normalizeAnswer,
  baseTemplates as templates,
} from "../src/math/engine.js";

function numeric(s: string): number {
  const [a, b] = s.split("/").map(Number);
  return a! / (b ?? 1);
}
test("all reference families are deterministic and independently solve from displayed givens", () => {
  assert.ok(templates.length >= 10);
  for (const template of templates)
    for (let i = 0; i < 150; i++) {
      const problem = generateProblem(template.id, `case-${i}`),
        p = problem.public;
      assert.deepEqual(problem, generateProblem(template.id, `case-${i}`));
      assert.match(p.id, /^[a-f0-9]{64}$/);
      assert.ok(problem.hint.length && problem.explanation.length);
      assert.equal("answer" in p, false);
      const numbers = p.prompt.match(/-?\d+/g)?.map(Number) ?? [];
      let expected: number;
      switch (template.id) {
        case "count-objects":
          assert.equal(p.figure?.kind, "collection");
          expected = p.figure!.kind === "collection" ? p.figure!.count : NaN;
          break;
        case "add-within-20": {
          if (p.response.kind !== "number") {
            const found =
              /the double (\d+) \+ \1, and what is (\d+) \+ (\d+)\?/.exec(
                p.prompt,
              );
            assert.ok(found, p.prompt);
            const double = 2 * Number(found[1]);
            const total = Number(found[2]) + Number(found[3]);
            assert.ok(total <= 20, p.prompt);
            const response = p.response as {
              blanks: { id: string; options: { id: string; label: string }[] }[];
            };
            const key = JSON.parse(problem.answer) as Record<string, string>;
            const chosen = (id: string) =>
              response.blanks
                .find((blank) => blank.id === id)!
                .options.find((option) => option.id === key[id])!.label;
            assert.equal(chosen("dbl"), String(double), p.prompt);
            assert.equal(chosen("sum"), String(total), p.prompt);
            assert.equal(gradeAnswer(problem, problem.answer), true);
            assert.equal(
              gradeAnswer(problem, JSON.stringify({ ...key, sum: "nope" })),
              false,
            );
            continue;
          }
          expected = numbers[0]! + numbers[1]!;
          assert.ok(expected <= 20);
          break;
        }
        case "subtract-within-20":
          expected = numbers[0]! - numbers[1]!;
          assert.ok(expected >= 0);
          break;
        case "fraction-model": {
          assert.equal(p.figure?.kind, "fraction");
          const f = p.figure!;
          if (f.kind !== "fraction") throw new Error("Wrong figure");
          assert.ok(f.selected > 0 && f.selected < f.parts);
          expected = f.selected / f.parts;
          break;
        }
        case "add-fractions": {
          if (p.prompt.startsWith("Rename over the common denominator")) {
            const response = p.response as {
              blanks: { id: string; options: { id: string; label: string }[] }[];
              sentence?: ({ text: string } | { blank: string })[];
            };
            const text = (response.sentence ?? [])
              .map((part) => ("text" in part ? part.text : ""))
              .join("");
            const fracs = [...text.matchAll(/\\frac\{(\d+)\}\{(\d+)\}/g)].map(
              (m) => [Number(m[1]), Number(m[2])] as const,
            );
            const denominator = Number(/denominator (\d+)/.exec(p.prompt)![1]);
            const mixed = /^(\d+) /.exec(text);
            const whole = mixed ? Number(mixed[1]) : 0;
            const [topA, denA] = fracs[0]!;
            const [topC, denC] = fracs[1]!;
            const renamedA = ((whole * denA + topA) * denominator) / denA;
            const renamedC = (topC * denominator) / denC;
            const difference = text.includes("−");
            const total = difference ? renamedA - renamedC : renamedA + renamedC;
            const key = JSON.parse(problem.answer) as Record<string, string>;
            const chosen = (id: string) =>
              Number(
                response.blanks
                  .find((blank) => blank.id === id)!
                  .options.find((option) => option.id === key[id])!.label,
              );
            assert.equal(chosen("left"), renamedA, p.prompt);
            assert.equal(chosen("right"), renamedC, p.prompt);
            assert.equal(chosen("sum"), total, p.prompt);
            assert.equal(gradeAnswer(problem, problem.answer), true);
            assert.equal(
              gradeAnswer(problem, JSON.stringify({ ...key, sum: "nope" })),
              false,
            );
            continue;
          }
          expected = numbers[0]! / numbers[1]! + numbers[2]! / numbers[3]!;
          break;
        }
        case "rectangle-area": {
          expected = numbers[0]! * numbers[1]!;
          assert.deepEqual(p.figure, {
            kind: "rectangle",
            width: numbers[0],
            height: numbers[1],
            unit: "cm",
          });
          break;
        }
        case "linear-equation":
          expected = (numbers[2]! - numbers[1]!) / numbers[0]!;
          break;
        case "mean-data":
          expected = numbers.reduce((a, b) => a + b, 0) / numbers.length;
          assert.deepEqual(p.figure, { kind: "dataset", values: numbers });
          break;
        case "right-triangle": {
          expected = Math.hypot(numbers[0]!, numbers[1]!);
          // The rounded surfaces name the place; the integer triples do not.
          const rounded = /to the nearest (whole number|tenth)\?/.exec(
            p.prompt,
          );
          if (rounded)
            expected = Number(expected.toFixed(rounded[1] === "tenth" ? 1 : 0));
          assert.deepEqual(p.figure, {
            kind: "right-triangle",
            a: numbers[0],
            b: numbers[1],
            unit: "cm",
          });
          break;
        }
        case "quadratic-vertex": {
          const [a, h, k] = numbers;
          expected = k!;
          for (let x = -20; x <= 20; x++)
            assert.ok(a! * (x - h!) ** 2 + k! >= expected);
          break;
        }
        case "geometric-sequence": {
          let term = numbers[0]!;
          if (/divided by/.test(p.prompt)) {
            // "starts at S ... divided by D ... term N"
            for (let j = 1; j < numbers[2]!; j++) term /= numbers[1]!;
          } else if (/\\frac/.test(p.prompt)) {
            // "first term S and common ratio 1/D ... term N"
            for (let j = 1; j < numbers[3]!; j++) term /= numbers[2]!;
          } else for (let j = 1; j < numbers[2]!; j++) term *= numbers[1]!;
          expected = term;
          break;
        }
        case "logarithm-integer": {
          let value = 1,
            exponent = 0;
          while (value < numbers[1]!) {
            value *= numbers[0]!;
            exponent++;
          }
          assert.equal(value, numbers[1]);
          expected = exponent;
          break;
        }
        default:
          throw new Error("Missing independent oracle");
      }
      assert.ok(
        Math.abs(numeric(problem.answer) - expected) < 1e-10,
        `${template.id}: ${p.prompt}`,
      );
      assert.equal(gradeAnswer(problem, problem.answer), true);
      assert.equal(
        gradeAnswer(problem, String(Math.trunc(expected) + 1)),
        false,
      );
    }
});
test("exact answer normalization accepts equivalence without float tolerance", () => {
  assert.equal(normalizeAnswer(" 2 / 4 "), "1/2");
  assert.equal(normalizeAnswer("0.50"), "1/2");
  assert.equal(normalizeAnswer(".5"), "1/2");
  assert.equal(normalizeAnswer("-.5"), "-1/2");
  assert.equal(normalizeAnswer("+.50"), "1/2");
  assert.equal(normalizeAnswer("−0.50"), "-1/2");
  assert.equal(normalizeAnswer("-3/-6"), "1/2");
  assert.equal(normalizeAnswer("0/5"), "0");
  for (const bad of [
    "",
    "1/0",
    "Infinity",
    "NaN",
    "1e3",
    "1 + 2",
    "<script>",
    "1.2.3",
    "9".repeat(101),
  ])
    assert.equal(normalizeAnswer(bad), null);
  const p = generateProblem("add-within-20", "exact");
  assert.equal(gradeAnswer(p, `${p.answer}.000000000000000001`), false);
});
test("identity includes seed and template; invalid inputs fail closed", () => {
  assert.notEqual(
    generateProblem("add-within-20", "a").public.id,
    generateProblem("add-within-20", "b").public.id,
  );
  assert.notEqual(
    generateProblem("add-within-20", "a").public.id,
    generateProblem("subtract-within-20", "a").public.id,
  );
  assert.throws(() => generateProblem("missing", "a"));
  assert.throws(() => generateProblem("add-within-20", ""));
  assert.throws(() => generateProblem("add-within-20", "x".repeat(129)));
});
