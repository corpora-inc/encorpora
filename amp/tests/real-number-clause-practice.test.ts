import { reportEditorialLimit } from "./fixtures/editorial";
import assert from "node:assert/strict";
import test from "node:test";
import { generatedProblemSchema } from "../src/math/contracts";
import { realNumberMethods } from "../src/content/real-number-lessons";
import { generateProblem } from "../src/math/engine";
import {
  calculatorDisplayText,
  generateRealNumberProblem,
  singleDigitEstimateOf,
  singleDigitRatioPairs,
  timesEstimate,
} from "../src/math/real-number-practice";

const words = (sentence: string) =>
  sentence
    .replace(/\$[^$]*\$/g, " math ")
    .replace(/`[^`]*`/g, " display ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
const sentences = (text: string) => text.split(/(?<=[.!?])\s+/).filter(Boolean);

function assertShort(problem: { prompt: string; explanation: string[]; hint: string }, where: string) {
  for (const text of [problem.prompt, problem.hint, ...problem.explanation])
    for (const sentence of sentences(text))
      assert.ok(words(sentence) <= 35, `${where} has ${words(sentence)} words: ${sentence}`);
}

test("single-digit estimates match the clause's three acceptance numbers", () => {
  const brazil = singleDigitEstimateOf("289,000,000");
  assert.equal(brazil.correct, "3 \\times 10^{8}");
  assert.deepEqual(brazil.wrong, [
    "2 \\times 10^{8}",
    "3 \\times 10^{9}",
    "29 \\times 10^{7}",
  ]);
  const cell = singleDigitEstimateOf("0.0000078");
  assert.equal(cell.correct, "8 \\times 10^{-6}");
  assert.deepEqual(cell.wrong, [
    "7 \\times 10^{-6}",
    "8 \\times 10^{6}",
    "78 \\times 10^{-7}",
  ]);
  const nine = singleDigitEstimateOf("970,000,000");
  assert.equal(nine.correct, "1 \\times 10^{9}");
  assert.equal(new Set([nine.correct, ...nine.wrong]).size, 4);
});

test("times-as-large estimates keep a one-decimal ratio", () => {
  const sample = timesEstimate(3, 8, 6, 9);
  assert.equal(sample.times, "20");
  assert.equal(sample.first, "300000000");
  assert.equal(sample.second, "6000000000");
  for (const [a, b] of singleDigitRatioPairs) {
    const tenths = (10 * b) / a;
    assert.equal(Number.isInteger(tenths), true, `${b}/${a}`);
  }
});

test("scientific families keep the legacy stream and add the clause surfaces", () => {
  const seen = {
    "standard-to-scientific": new Set<string>(),
    "scientific-times-larger": new Set<string>(),
    "scientific-to-standard": new Set<string>(),
  };
  for (const id of Object.keys(seen) as (keyof typeof seen)[]) {
    for (let i = 0; i < 80; i++) {
      const seed = `clause:${id}:${i}`;
      const legacy = generateProblem(id, seed, 1);
      assert.equal(legacy.public.templateVersion, 1, id);
      assert.equal(legacy.variant, undefined, id);
      assert.equal(legacy.public.response.kind === "choice", id === "standard-to-scientific");
      const fresh = generateProblem(id, seed);
      generatedProblemSchema.parse(fresh);
      assert.deepEqual(generateProblem(id, seed), fresh);
      assert.equal(fresh.public.templateVersion, 2);
      seen[id].add(fresh.variant?.axes?.task ?? "exact");
      assertShort(
        { prompt: fresh.public.prompt, explanation: fresh.explanation, hint: fresh.hint },
        `${id} ${seed}`,
      );
      const answer =
        fresh.public.response.kind === "choice"
          ? fresh.public.response.options.find((o) => o.id === fresh.answer)!.label
          : fresh.answer;
      if (answer.length >= 4 && fresh.public.response.kind !== "choice")
        assert.equal(fresh.hint.includes(answer), false, `${id} leaks ${answer}`);
      if (fresh.public.response.kind === "choice") {
        const label = fresh.public.response.options.find((o) => o.id === fresh.answer)!.label;
        assert.equal(fresh.hint.includes(label), false, `${id} hint leaks`);
        assert.equal(fresh.public.prompt.includes(label), false, `${id} prompt leaks`);
      }
      if (id === "standard-to-scientific" && fresh.variant?.axes?.task === "single-digit-estimate") {
        assert.equal(fresh.public.response.kind, "choice");
        const labels = fresh.public.response.kind === "choice"
          ? fresh.public.response.options.map((o) => o.label)
          : [];
        assert.equal(new Set(labels).size, 4);
      }
      if (id === "scientific-times-larger" && fresh.variant?.axes?.task === "times-as-much") {
        assert.match(fresh.public.prompt, /estimated as/);
        assert.match(fresh.explanation.join(" "), /10\^\{1[0-9]\}|digits alone|Multiplying the digits/);
      }
      if (id === "scientific-to-standard" && fresh.variant?.axes?.task === "display") {
        const shown = /`([^`]+)`/.exec(fresh.public.prompt)?.[1];
        assert.ok(shown, fresh.public.prompt);
        assert.match(fresh.answer, /^-?\d+(\.\d+)?$/);
      }
      if (id === "scientific-to-standard" && fresh.variant?.axes?.task === "product") {
        assert.match(fresh.public.prompt, /multiplies|divides/);
        assert.match(fresh.answer, /^\d+(\.\d+)?$/);
      }
    }
    assert.ok(seen[id].has("exact"), `${id} still draws the stored task`);
  }
  assert.ok(seen["standard-to-scientific"].has("single-digit-estimate"));
  for (const task of ["estimate-first", "estimate-second", "times-as-much"])
    assert.ok(seen["scientific-times-larger"].has(task), task);
  assert.ok(seen["scientific-to-standard"].has("display"));
  assert.ok(seen["scientific-to-standard"].has("product"));
  assert.equal(calculatorDisplayText("4.282", -4, 0), "4.282E-4");
  assert.equal(calculatorDisplayText("4.282", -4, 1), "4.282E-04");
  assert.equal(calculatorDisplayText("4.282", -4, 2), "4.282e-4");
  assert.equal(calculatorDisplayText("5.1", -7, 2), "5.1e-7");
  assert.equal(calculatorDisplayText("9", 12, 0), "9E12");
});

test("choose-unit-size is one multi-part ladder with one readable unit", () => {
  assert.ok(realNumberMethods["choose-unit-size"]);
  reportEditorialLimit(
    realNumberMethods["choose-unit-size"].goal.length <= 140,
    "choose-unit-size: goal exceeds 140 characters",
  );
  const ladders = new Set<string>();
  for (let i = 0; i < 60; i++) {
    const problem = generateRealNumberProblem("choose-unit-size", `unit:${i}`);
    generatedProblemSchema.parse(problem);
    assert.equal(problem.public.response.kind, "multi-part-choice");
    if (problem.public.response.kind !== "multi-part-choice") continue;
    assert.deepEqual(
      problem.public.response.blanks.map((b) => b.id),
      ["unit", "value"],
    );
    const key = JSON.parse(problem.answer) as { unit: string; value: string };
    const unit = problem.public.response.blanks[0]!.options.find((o) => o.id === key.unit)!;
    const value = problem.public.response.blanks[1]!.options.find((o) => o.id === key.value)!;
    assert.equal(new Set(problem.public.response.blanks[0]!.options.map((o) => o.label)).size, 4);
    assert.equal(new Set(problem.public.response.blanks[1]!.options.map((o) => o.label)).size, 4);
    const given = /\$(\d+(?:\.\d+)?) \\times 10\^\{(-?\d+)\}\$ ([A-Za-z]+)/.exec(problem.public.prompt);
    assert.ok(given, problem.public.prompt);
    const coef = Number(given[1]);
    assert.ok(coef >= 1 && coef < 10);
    assert.match(problem.public.prompt, /1,000:/);
    ladders.add(problem.public.prompt.includes("kilometer") ? "length"
      : problem.public.prompt.includes("tonne") ? "mass"
      : problem.public.prompt.includes("millisecond") ? "time"
      : "data");
    if (value.label.length >= 2)
      assert.equal(problem.hint.includes(value.label), false, `hint leaks ${value.label}`);
    assertShort(
      { prompt: problem.public.prompt, explanation: problem.explanation, hint: problem.hint },
      `choose-unit ${i}`,
    );
  }
  assert.deepEqual([...ladders].sort(), ["data", "length", "mass", "time"]);
});
