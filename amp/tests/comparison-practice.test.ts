import { test } from "node:test";
import assert from "node:assert/strict";
import { generateProblem, gradeAnswer } from "../src/math/engine";
import {
  comparisonTemplates,
  formatWhole,
} from "../src/math/comparison-practice";
import { generatedProblemSchema } from "../src/math/contracts";
import { openerSlots, templateRole } from "../src/learning/placement";
import { problemLesson } from "../src/content/problem-lessons";
import {
  animationFrames,
  animationModel,
} from "../src/web/lesson-animation/model";
import { lessons } from "../src/content/lessons";

const ids = comparisonTemplates.map((t) => t.id);
const parse = (text: string) => Number(text.replaceAll(",", ""));
const numbersIn = (prompt: string) =>
  (prompt.match(/\d[\d,]*\d|\d/g) ?? []).map(parse);

test("comparison families are deterministic, valid and gradeable", () => {
  for (const id of ids)
    for (let i = 0; i < 300; i++) {
      const problem = generateProblem(id, `cmp-${i}`);
      assert.deepEqual(problem, generateProblem(id, `cmp-${i}`));
      generatedProblemSchema.parse(problem);
      assert.equal(gradeAnswer(problem, problem.answer), true, id);
      assert.equal(templateRole(id), "assessment");
      const response = problem.public.response;
      if (response.kind === "choice") {
        const wrong = response.options.filter((o) => o.id !== problem.answer);
        for (const option of wrong)
          assert.ok(problem.choiceFeedback?.[option.id], `${id} feedback`);
      } else assert.equal(gradeAnswer(problem, `${problem.answer}1`), false);
    }
});

test("each comparison answer follows from the displayed numbers", () => {
  for (const id of [
    "greater-numeral",
    "compare-two-digit",
    "compare-three-digit",
    "compare-multidigit",
  ])
    for (let i = 0; i < 300; i++) {
      const p = generateProblem(id, `cmp-${i}`);
      const [a, b] = numbersIn(p.public.prompt);
      assert.notEqual(a, b);
      const greater = p.public.prompt.includes("greater");
      assert.equal(
        Number(p.answer),
        greater ? Math.max(a!, b!) : Math.min(a!, b!),
      );
      if (id === "compare-two-digit")
        assert.deepEqual(p.public.figure, {
          kind: "base-ten-pair",
          values: [a, b],
        });
    }
  for (let i = 0; i < 300; i++) {
    const p = generateProblem("multidigit-digit-value", `cmp-${i}`);
    const [digit, n] = numbersIn(p.public.prompt) as [number, number];
    const text = String(n);
    assert.equal(text.split(String(digit)).length, 2, "digit appears once");
    assert.equal(
      Number(p.answer),
      digit * 10 ** (text.length - 1 - text.indexOf(String(digit))),
    );
  }
});

test("comparison items reach their hard cases, not only easy ones", () => {
  const share = (
    id: string,
    test: (p: ReturnType<typeof generateProblem>) => boolean,
  ) =>
    Array.from({ length: 400 }, (_, i) =>
      generateProblem(id, `share-${i}`),
    ).filter(test).length / 400;
  // Spacing misleads: the longer row has fewer counters.
  const misleading = share("compare-groups", (p) => {
    const f = p.public.figure!;
    if (f.kind !== "counter-rows" || f.circles === f.squares) return false;
    return f.spread === (f.circles < f.squares ? "circles" : "squares");
  });
  assert.ok(misleading > 0.25 && misleading < 0.5, `${misleading}`);
  const equalGroups = share("compare-groups", (p) => {
    const f = p.public.figure!;
    return f.kind === "counter-rows" && f.circles === f.squares;
  });
  assert.ok(equalGroups > 0.15 && equalGroups < 0.35, `${equalGroups}`);
  // More ones but fewer tens: 39 and 41.
  const tail = share("compare-two-digit", (p) => {
    const [a, b] = numbersIn(p.public.prompt).sort((x, y) => x - y);
    return a! % 10 > b! % 10;
  });
  assert.ok(tail > 0.25, `${tail}`);
  const equalSymbols = share("three-digit-symbol", (p) => {
    const [a, b] = numbersIn(p.public.prompt);
    return a === b;
  });
  assert.ok(equalSymbols > 0.08 && equalSymbols < 0.25, `${equalSymbols}`);
  const lengths = share("compare-multidigit", (p) => {
    const [a, b] = numbersIn(p.public.prompt);
    return String(a).length !== String(b).length;
  });
  assert.ok(lengths > 0.15 && lengths < 0.4, `${lengths}`);
});

test("symbol statements keep reading order and a fixed <, =, > layout", () => {
  for (const id of ["two-digit-symbol", "three-digit-symbol"])
    for (let i = 0; i < 100; i++) {
      const p = generateProblem(id, `cmp-${i}`);
      const [a, b] = numbersIn(p.public.prompt);
      const response = p.public.response;
      assert.equal(response.kind, "choice");
      if (response.kind !== "choice") continue;
      assert.deepEqual(
        response.options.map((o) => o.label),
        ["<", "=", ">"].map((s) => `${a} ${s} ${b}`),
      );
      const truth = a! < b! ? 0 : a === b ? 1 : 2;
      assert.equal(p.answer, response.options[truth]!.id);
    }
});

test("large numbers use thousands separators", () => {
  assert.equal(formatWhole(372946), "372,946");
  assert.equal(formatWhole(6902), "6,902");
  assert.equal(formatWhole(940), "940");
  for (let i = 0; i < 100; i++)
    for (const id of ["compare-multidigit", "multidigit-digit-value"])
      for (const token of generateProblem(id, `cmp-${i}`).public.prompt.match(
        /\d[\d,]*/g,
      )!)
        assert.match(token, /^\d{1,3}(,\d{3})*$/);
});

test("comparison openers are whole, short and numeric", () => {
  const openers = new Set(openerSlots.flat(2));
  for (const id of ["greater-numeral", "compare-three-digit"]) {
    assert.ok(openers.has(id), id);
    assert.equal(
      comparisonTemplates.find((t) => t.id === id)!.requiredResponseCapability,
      undefined,
    );
  }
});

test("comparison animations conserve the example's quantities", () => {
  for (const id of ["compare-groups", "compare-two-digit"])
    for (let i = 0; i < 60; i++) {
      const lesson = problemLesson(id, `animation-${i}`);
      const model = animationModel(lesson);
      assert.ok(model, id);
      const frames = animationFrames(model);
      assert.equal(frames.length, 3);
      if (model.kind === "pairing") {
        const { circles: c, squares: s } = model.figure;
        assert.equal(
          frames[2]!.math,
          `$${c} ${c < s ? "<" : c > s ? ">" : "="} ${s}$`,
        );
      } else if (model.kind === "place-compare") {
        const [a, b] = model.figure.values;
        assert.equal(frames[2]!.math, `$${a} ${a < b ? "<" : ">"} ${b}$`);
        assert.equal(
          Number(lesson.example.answer),
          lesson.example.prompt.includes("greater")
            ? Math.max(a, b)
            : Math.min(a, b),
        );
      } else assert.fail(model.kind);
    }
});

test("every comparison family has one reference lesson with an illustration", () => {
  for (const id of ids) {
    const bound = lessons.filter((lesson) => lesson.templateIds.includes(id));
    assert.equal(bound.length, 1, id);
    assert.ok(bound[0]!.sections.some((s) => s.illustration));
  }
});
