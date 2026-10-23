import test from "node:test";
import assert from "node:assert/strict";
import { complexMultiplicationCase } from "../src/math/complex-practice";
import { generateProblem, templates } from "../src/math/engine";
import { problemLesson } from "../src/content/problem-lessons";

const templateId = "complex-multiplication";
const productPrompt =
  /^Multiply \$\((-?\d+) ([+-]) (\d*)i\)\((-?\d+) ([+-]) (\d*)i\)\$ using \$i\^2=-1\$\./;
function parse(label: string): [bigint, bigint] {
  const both = /^\$(-?\d+) ([+-]) (\d*)i\$$/.exec(label);
  if (both)
    return [
      BigInt(both[1]!),
      BigInt(both[3] || "1") * (both[2] === "-" ? -1n : 1n),
    ];
  const imaginary = /^\$(-?)(\d*)i\$$/.exec(label);
  if (imaginary)
    return [
      0n,
      BigInt(imaginary[2] || "1") * (imaginary[1] === "-" ? -1n : 1n),
    ];
  const real = /^\$(-?\d+)\$$/.exec(label);
  assert.ok(real, label);
  return [BigInt(real[1]!), 0n];
}

test("public complex products have one exact, unique choice across signed and cancellation cases", () => {
  const seen = new Set<string>();
  for (let seed = 0; seed < 512; seed++) {
    const generated = generateProblem(templateId, `oracle:${seed}`);
    const direct = complexMultiplicationCase(`oracle:${seed}`).problem;
    assert.equal(generated.public.templateId, direct.public.templateId);
    assert.deepEqual(generated.public.response, direct.public.response);
    assert.equal(generated.answer, direct.answer);
    const prompt = productPrompt.exec(generated.public.prompt);
    assert.ok(prompt, generated.public.prompt);
    const a = BigInt(prompt[1]!);
    const b = BigInt(prompt[3] || "1") * (prompt[2] === "-" ? -1n : 1n);
    const c = BigInt(prompt[4]!);
    const d = BigInt(prompt[6] || "1") * (prompt[5] === "-" ? -1n : 1n);
    // Independent integer-pair multiplication; no generator internals or floating arithmetic.
    const expected: [bigint, bigint] = [a * c - b * d, a * d + b * c];
    const response = generated.public.response;
    assert.equal(response.kind, "choice");
    if (response.kind !== "choice") continue;
    const labels = response.options.map((option) => option.label);
    assert.equal(new Set(labels).size, 4);
    const matches = response.options.filter((option) => {
      const [real, imaginary] = parse(option.label);
      return real === expected[0] && imaginary === expected[1];
    });
    assert.equal(matches.length, 1);
    assert.equal(generated.answer, matches[0]!.id);
    assert.ok(generated.hint.includes(prompt[0]!.split(" using")[0]!.slice(9)));
    if (a === 0n || c === 0n) seen.add("pure-imaginary-factor");
    if (expected[0] === 0n) seen.add("zero-real-part");
    if (expected[1] === 0n) seen.add("zero-imaginary-part");
    if ([a, b, c, d].some((value) => value < 0n)) seen.add("signed");
  }
  assert.deepEqual(
    [...seen].sort(),
    [
      "pure-imaginary-factor",
      "signed",
      "zero-imaginary-part",
      "zero-real-part",
    ].sort(),
  );
});

test("complex family binds the existing skill to both lesson forms", () => {
  const template = templates.find((item) => item.id === templateId);
  assert.equal(template?.skillId, "complex-numbers");
  const lesson = problemLesson(templateId, "library");
  assert.match(lesson.intuition ?? "", /\$i\^2=-1\$/);
  assert.ok(lesson.method.length >= 2);
  assert.ok(lesson.watch);
  assert.ok(lesson.principle);
  assert.ok(lesson.example.steps.length >= 3);
});
