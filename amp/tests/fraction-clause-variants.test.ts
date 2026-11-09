import assert from "node:assert/strict";
import test from "node:test";
import { generateProblem } from "../src/math/engine";
import type { GeneratedProblem } from "../src/math/contracts";
import { phraseIsTrue } from "../src/math/fraction-clause-variants";

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;

function taskOf(problem: GeneratedProblem): string {
  return problem.variant?.axes?.task ?? problem.variant?.id ?? "legacy";
}

function collect(id: string, seeds = 400) {
  const byTask = new Map<string, GeneratedProblem[]>();
  for (let i = 0; i < seeds; i++) {
    const problem = generateProblem(id, `clause:${i}`);
    const task = taskOf(problem);
    const list = byTask.get(task) ?? [];
    list.push(problem);
    byTask.set(task, list);
  }
  return byTask;
}

function blanks(problem: GeneratedProblem) {
  const response = problem.public.response;
  assert.equal(response.kind, "multi-part-choice");
  if (response.kind !== "multi-part-choice") throw new Error("multi-part");
  const key = JSON.parse(problem.answer) as Record<string, string>;
  return Object.fromEntries(
    response.blanks.map((blank) => [
      blank.id,
      blank.options.find((option) => option.id === key[blank.id])!.label,
    ]),
  );
}

function choiceLabel(problem: GeneratedProblem) {
  const response = problem.public.response;
  assert.equal(response.kind, "choice");
  if (response.kind !== "choice") throw new Error("choice");
  return response.options.find((option) => option.id === problem.answer)!.label;
}

function valueOf(text: string) {
  const frac = text.match(/(-?\d+)\s*\/\s*(-?\d+)/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const whole = text.match(/-?\d+/);
  return whole ? Number(whole[0]) : NaN;
}

test("fraction clause variants satisfy their acceptance checks", () => {
  const phrase = collect("name-equal-share");
  assert.ok((phrase.get("phrase") ?? []).length >= 40, "phrase");
  for (const problem of phrase.get("phrase") ?? []) {
    const figure = problem.public.figure;
    assert.equal(figure?.kind, "partitioned-shapes");
    if (figure?.kind !== "partitioned-shapes") continue;
    const shape = figure.shapes[0]!;
    const response = problem.public.response;
    assert.equal(response.kind, "choice");
    if (response.kind !== "choice") continue;
    const correct = choiceLabel(problem);
    assert.equal(
      phraseIsTrue(correct, shape.shape, shape.sizes.length, shape.shaded.length),
      true,
      correct,
    );
    for (const option of response.options)
      if (option.id !== problem.answer)
        assert.equal(
          phraseIsTrue(option.label, shape.shape, shape.sizes.length, shape.shaded.length),
          false,
          option.label,
        );
  }
  const wholes = phrase.get("whole") ?? [];
  assert.ok(wholes.length >= 40);
  for (const problem of wholes) {
    const figure = problem.public.figure;
    assert.equal(figure?.kind, "partitioned-shapes");
    if (figure?.kind !== "partitioned-shapes") continue;
    const n = figure.shapes[0]!.sizes.length;
    const label = choiceLabel(problem);
    const count = n === 2 ? "two" : "four";
    assert.ok(label.startsWith(count), label);
    assert.equal(figure.shapes[0]!.shaded.length, n);
  }

  const share = collect("name-share");
  const thirds = (share.get("whole") ?? []).filter((problem) => {
    const figure = problem.public.figure;
    return figure?.kind === "partitioned-shapes" && figure.shapes[0]!.sizes.length === 3;
  });
  assert.ok(thirds.length >= (share.get("whole") ?? []).length * 0.25, "thirds");

  const line = collect("fraction-line-names-select");
  const lineWhole = line.get("whole") ?? [];
  assert.ok(lineWhole.length >= 40);
  for (const problem of lineWhole) {
    const response = problem.public.response;
    assert.equal(response.kind, "multi-select");
    if (response.kind !== "multi-select") continue;
    const keyed = new Set(JSON.parse(problem.answer) as string[]);
    assert.equal(keyed.size, 2);
    const figure = problem.public.figure;
    assert.equal(figure?.kind, "scene");
  }

  const symbols = collect("compare-fractions-symbol-blanks");
  for (const problem of symbols.get("grade3") ?? []) {
    const response = problem.public.response;
    assert.equal(response.kind, "multi-part-choice");
    if (response.kind !== "multi-part-choice") continue;
    const text = (response.sentence ?? [])
      .map((part) => ("text" in part ? part.text : ""))
      .join(" ");
    const fracs = [...text.matchAll(/\\frac\{(\d+)\}\{(\d+)\}/g)].map((m) => [
      Number(m[1]),
      Number(m[2]),
    ]);
    assert.equal(fracs.length, 4);
    for (let i = 0; i < 4; i += 2) {
      const [a, b] = fracs[i]!;
      const [c, d] = fracs[i + 1]!;
      assert.ok(a === c || b === d, `${a}/${b} ${c}/${d}`);
      assert.ok([2, 3, 4, 6, 8].includes(b!) && [2, 3, 4, 6, 8].includes(d!));
    }
    const figure = problem.public.figure;
    assert.equal(figure?.kind, "scene");
  }

  const reasons = collect("compare-fractions-reason-blanks");
  for (const problem of reasons.get("grade3") ?? []) {
    const chosen = blanks(problem);
    const reasonsText = problem.public.response;
    assert.equal(reasonsText.kind, "multi-part-choice");
    if (reasonsText.kind !== "multi-part-choice") continue;
    const why = reasonsText.blanks.find((blank) => blank.id === "why")!;
    const trueLabels = why.options.filter((option) => option.label === chosen.why);
    assert.equal(trueLabels.length, 1);
  }
  let benchmarkCorrect = 0;
  let benchmarkShown = 0;
  for (const problem of reasons.get("unlike") ?? []) {
    const chosen = blanks(problem);
    benchmarkShown++;
    if (chosen.why?.includes("1/2")) benchmarkCorrect++;
    assert.ok(chosen.why);
  }
  if (benchmarkShown) assert.ok(benchmarkCorrect > 0);

  const pictures = collect("fraction-decompositions-select");
  for (const problem of pictures.get("picture") ?? []) {
    assert.equal(/\\frac|\/\d/.test(problem.public.prompt), false, problem.public.prompt);
    const response = problem.public.response;
    assert.equal(response.kind, "multi-select");
    if (response.kind !== "multi-select") continue;
    assert.equal(JSON.parse(problem.answer).length, 2);
  }

  const between = collect("whole-times-fraction");
  for (const problem of between.get("between") ?? []) {
    const chosen = blanks(problem);
    const product = valueOf(chosen.pounds ?? "");
    const [lo, hi] = (chosen.bounds ?? "").split(" and ").map(Number);
    assert.equal(lo, Math.floor(product));
    assert.equal(hi, lo! + 1);
    assert.ok(product > 1 && product < 7);
    assert.ok(!Number.isInteger(product));
  }

  const steps = collect("add-fractions");
  for (const problem of steps.get("steps") ?? []) {
    const chosen = blanks(problem);
    const text = problem.public.prompt + " " + (problem.public.response.kind === "multi-part-choice"
      ? (problem.public.response.sentence ?? []).map((part) => ("text" in part ? part.text : "")).join(" ")
      : "");
    const dens = [...text.matchAll(/\\frac\{(\d+)\}\{(\d+)\}/g)].map((m) => Number(m[2]));
    if (dens.length >= 2) {
      const D = lcm(dens[0]!, dens[1]!);
      assert.ok(D <= 60);
    }
    assert.ok(Number(chosen.left) > 0);
    assert.ok(Number(chosen.right) > 0);
    assert.ok(Number(chosen.sum) > 0);
  }

  const rice = collect("whole-sharing-fraction");
  for (const problem of rice.get("rice") ?? []) {
    const chosen = blanks(problem);
    const sack = problem.public.prompt.match(/(\d+)-pound/)!;
    const people = problem.public.prompt.match(/^(\d+) people/)!;
    const a = Number(sack[1]);
    const b = Number(people[1]);
    assert.ok(a % b !== 0 && a > b);
    assert.equal(Number(chosen.check), a);
    const floor = Math.floor(a / b);
    assert.equal(chosen.bounds, `${floor} and ${floor + 1}`);
  }

  const area = collect("divide-fractions");
  for (const problem of area.get("area") ?? []) {
    assert.equal(problem.public.response.kind, "fraction");
    const nums = [...problem.public.prompt.matchAll(/(\d+)\/(\d+)/g)].map((m) => [
      Number(m[1]),
      Number(m[2]),
    ]);
    assert.ok(nums.length >= 1);
    const [answerN, answerD] = problem.answer.includes("/")
      ? problem.answer.split("/").map(Number)
      : [Number(problem.answer), 1];
    assert.ok(answerD! <= 24);
  }

  const judge = collect("benchmark-fraction-estimate");
  assert.ok((judge.get("judge") ?? []).length >= 40);
  for (const problem of judge.get("judge") ?? []) {
    const label = choiceLabel(problem);
    assert.ok(label.startsWith("Right:") || label.startsWith("Wrong:"), label);
    if (label.startsWith("Wrong:") && problem.public.prompt.includes("+")) {
      const claim = problem.public.prompt.match(/=\s*(\d+\/\d+|\d+)/);
      const sum = problem.public.prompt.match(/(\d+)\/(\d+)\s*\+\s*(\d+)\/(\d+)/);
      if (claim && sum && label.includes("less than 1/2")) {
        const claimed = valueOf(claim[1]!);
        const truth =
          (Number(sum[1]) * Number(sum[4]) + Number(sum[3]) * Number(sum[2])) /
          (Number(sum[2]) * Number(sum[4]));
        assert.ok(Math.abs(claimed - truth) > 1e-9);
        assert.ok(claimed < 0.5);
      }
    }
  }
});
