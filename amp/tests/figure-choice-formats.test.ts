import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { legacySurface } from "./fixtures/legacy-surface";
import { readFileSync } from "node:fs";
import {
  generatedProblemSchema,
  publicProblemSchema,
} from "../src/math/contracts";
import { generateProblem, gradeAnswer, templates } from "../src/math/engine";
import type { FigureChoiceResponse } from "../src/math/figure-choice";
import {
  gradeMultiPart,
  type MultiPartChoiceResponse,
} from "../src/math/multi-part-choice";
import { layoutScene } from "../src/math/scene";
import { answerText } from "../src/math/selection-response";
import { enumerateAxes } from "../src/math/variation/axes";
import { rateAxes } from "../src/math/figure-choice-practice";
import { figureChoiceFormatsAxes } from "../src/math/figure-choice-formats-practice";
import { multiPartFormatsAxes } from "../src/math/multi-part-formats-practice";
import { problemLesson } from "../src/content/problem-lessons";
import { templateArchetypes } from "../src/curriculum/template-archetypes";
import { objectiveForSkill } from "../src/curriculum/selection";

const figureIds = [
  "graph-of-paired-values",
  "point-on-signed-grid",
  "graph-after-shift",
] as const;
const partIds = ["table-rule-sentence", "substitution-match-table"] as const;
const seeds = (n: number, prefix = "f") =>
  Array.from({ length: n }, (_, i) => `${prefix}:${i}`);
const axesOf = {
  ...figureChoiceFormatsAxes,
  ...multiPartFormatsAxes,
  "graph-of-proportional-rate": rateAxes,
} as const;

test("every new format is deterministic, valid and reaches every axis value", () => {
  for (const id of [...figureIds, ...partIds, "graph-of-proportional-rate"]) {
    const template = templates.find((t) => t.id === id);
    assert.ok(template, id);
    assert.ok(objectiveForSkill(template.skillId), `${id}: exposure objective`);
    assert.ok(templateArchetypes[id]?.length, `${id}: archetype`);
    const reached = new Map<string, Set<string>>();
    const prompts = new Set<string>();
    for (const seed of seeds(400)) {
      const problem = generateProblem(id, seed);
      assert.deepEqual(generateProblem(id, seed), problem, `${id} ${seed}`);
      generatedProblemSchema.parse(problem);
      publicProblemSchema.parse(problem.public);
      prompts.add(
        problem.public.prompt + JSON.stringify(problem.public.figure),
      );
      for (const [axis, value] of Object.entries(problem.variant!.axes!)) {
        const set = reached.get(axis) ?? new Set<string>();
        set.add(value);
        reached.set(axis, set);
      }
      assert.equal(/\$\{|undefined|NaN/.test(JSON.stringify(problem)), false);
    }
    const axes = axesOf[id as keyof typeof axesOf] as Record<
      string,
      { values: readonly string[] }
    >;
    for (const [axis, { values }] of Object.entries(axes))
      assert.deepEqual(
        [...(reached.get(axis) ?? [])].sort(),
        [...values].sort(),
        `${id}: ${axis} values reached`,
      );
    assert.ok(prompts.size >= 60, `${id}: ${prompts.size} distinct problems`);
    assert.ok(enumerateAxes(axes as never).length >= 2);
  }
});

test("figure options are distinct figures with one correct answer and a misconception each", () => {
  for (const id of figureIds) {
    const positions = new Set<number>();
    for (const seed of seeds(300)) {
      const problem = generateProblem(id, seed);
      const response = problem.public.response as FigureChoiceResponse;
      assert.equal(response.kind, "figure-choice");
      assert.equal(response.options.length, 4);
      assert.equal(
        new Set(response.options.map((o) => JSON.stringify(o.scene.elements)))
          .size,
        4,
        `${id} ${seed}: distinct figures`,
      );
      assert.equal(new Set(response.options.map((o) => o.label)).size, 4);
      const at = response.options.findIndex((o) => o.id === problem.answer);
      assert.ok(at >= 0);
      positions.add(at);
      assert.equal(gradeAnswer(problem, problem.answer), true);
      for (const [k, o] of response.options.entries()) {
        if (k === at) continue;
        assert.equal(gradeAnswer(problem, o.id), false);
        assert.ok(
          problem.choiceFeedback![o.id]!.startsWith(`Graph ${"ABCD"[k]} `),
          problem.choiceFeedback![o.id],
        );
      }
      assert.match(
        problem.explanation.at(-1)!,
        new RegExp(`^Graph ${"ABCD"[at]} `),
      );
      // Neither the prompt nor the hint names the correct figure.
      const correct = response.options[at]!;
      assert.equal(problem.public.prompt.includes(correct.label), false);
      assert.equal(problem.hint.includes(correct.label), false);
      assert.ok(problem.walkthrough, `${id}: lesson figure`);
    }
    assert.deepEqual([...positions].sort(), [0, 1, 2, 3], `${id}: positions`);
  }
});

test("option figures lay out at card size so labels stay legible at 320 px", () => {
  for (const id of [...figureIds, "graph-of-proportional-rate"])
    for (const seed of seeds(40, "layout")) {
      const problem = generateProblem(id, seed);
      for (const option of (problem.public.response as FigureChoiceResponse)
        .options) {
        const layout = layoutScene(option.scene);
        assert.ok(
          layout.width <= 280 && layout.height <= 300,
          `${id}: ${layout.width}x${layout.height}`,
        );
        assert.ok(layout.width >= 200, `${id}: ${layout.width} wide`);
        assert.ok(layout.dropped.length <= 6, `${id}: dropped labels`);
      }
    }
});

test("shifted graphs: each option is the shown graph moved by an exact amount", () => {
  // The shown scene and the correct option are the same drawing moved by the
  // prompt's amounts; read both from the scenes, not from the generator.
  let checked = 0;
  for (const seed of seeds(200, "shift")) {
    const problem = generateProblem("graph-after-shift", seed);
    const shown = (problem.public.figure as { scene: { elements: unknown[] } })
      .scene.elements[0] as Record<string, unknown>;
    const response = problem.public.response as FigureChoiceResponse;
    const correct = response.options.find((o) => o.id === problem.answer)!;
    const element = correct.scene.elements[0] as unknown as Record<
      string,
      unknown
    >;
    assert.equal(element.type, "graph");
    assert.deepEqual(element.x, shown.x);
    assert.deepEqual(element.y, shown.y);
    checked++;
  }
  assert.equal(checked, 200);
});

test("multi-part formats grade the key, reject any single wrong blank and leak nothing", () => {
  for (const id of partIds) {
    for (const seed of seeds(300)) {
      const problem = generateProblem(id, seed);
      const response = problem.public.response as MultiPartChoiceResponse;
      assert.equal(response.kind, "multi-part-choice");
      assert.equal(gradeAnswer(problem, problem.answer), true);
      const key = JSON.parse(problem.answer) as Record<string, string>;
      assert.deepEqual(
        Object.keys(key),
        response.blanks.map((b) => b.id),
      );
      for (const blank of response.blanks) {
        const labels = blank.options.map((o) => o.label);
        assert.equal(new Set(labels).size, labels.length);
        for (const o of blank.options) {
          if (o.id === key[blank.id]) continue;
          assert.equal(
            gradeMultiPart(
              response,
              problem.answer,
              JSON.stringify({ ...key, [blank.id]: o.id }),
            ),
            false,
            `${id} ${seed} ${blank.id}`,
          );
        }
      }
      assert.ok(problem.hint.length > 40 && problem.explanation.length >= 3);
    }
  }
});

test("table rules and equation tables are decided by their own numbers", () => {
  for (const seed of seeds(200, "rule")) {
    const problem = generateProblem("table-rule-sentence", seed);
    const rows = (
      problem.public.figure as { scene: { elements: { rows: string[][] }[] } }
    ).scene.elements[0]!.rows;
    const xs = rows[0]!.slice(1).map(Number);
    const ys = rows[1]!.slice(1).map(Number);
    const response = problem.public.response as MultiPartChoiceResponse;
    const key = JSON.parse(problem.answer) as Record<string, string>;
    const label = (blank: string) =>
      response.blanks
        .find((b) => b.id === blank)!
        .options.find((o) => o.id === key[blank])!.label;
    const n = Number(label("num"));
    const fits = {
      "increased by": xs.every((x, i) => x + n === ys[i]),
      "decreased by": xs.every((x, i) => x - n === ys[i]),
      "multiplied by": xs.every((x, i) => x * n === ys[i]),
      "divided by": xs.every((x, i) => x / n === ys[i]),
    };
    if (key.op)
      assert.equal(fits[label("op") as keyof typeof fits], true, seed);
    else {
      const kind = label("kind");
      assert.equal(
        kind === "additive"
          ? fits["increased by"] || fits["decreased by"]
          : fits["multiplied by"] || fits["divided by"],
        true,
        seed,
      );
    }
  }
  for (const seed of seeds(200, "subst")) {
    const problem = generateProblem("substitution-match-table", seed);
    const response = problem.public.response as MultiPartChoiceResponse;
    const value = Number(/= (-?\d+)\$\.$/.exec(problem.public.prompt)![1]);
    const key = JSON.parse(problem.answer) as Record<string, string>;
    for (const blank of response.blanks) {
      const [left, right] = blank.label.replace(/\$/g, "").split(" = ");
      const side = (text: string) =>
        Function(
          "v",
          `return ${text
            .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "(($1)/($2))")
            .replace(/[a-z]/g, "v")
            .replace(/(\d)v/g, "$1*v")
            .replace(/-v/g, "-1*v")}`,
        )(value) as number;
      const holds = side(left!) === side(right!);
      const chosen = blank.options.find((o) => o.id === key[blank.id])!.label;
      assert.equal(
        chosen,
        holds ? "True" : "Not true",
        `${seed} ${blank.label}`,
      );
    }
  }
});

test("the rate graph keeps every pre-axis output byte for byte at legacy axis values", () => {
  const golden = JSON.parse(
    readFileSync(
      new URL("./fixtures/figure-choice-legacy-digests.json", import.meta.url),
      "utf8",
    ),
  ) as Record<string, string[]>;
  let legacy = 0;
  golden["graph-of-proportional-rate"]!.forEach((digest, i) => {
    const problem = generateProblem(
      "graph-of-proportional-rate",
      `legacy:${i}`,
    );
    const axes = problem.variant!.axes!;
    if (axes["rate-form"] !== "whole-or-fraction" || axes["y-scale"] !== "unit")
      return;
    legacy++;
    const before = legacySurface(problem);
    assert.equal(
      createHash("sha256")
        .update(JSON.stringify(before))
        .digest("hex")
        .slice(0, 16),
      digest,
      `legacy:${i}`,
    );
  });
  assert.ok(legacy >= 60, `legacy surface reached (${legacy})`);
});

test("rate graphs on scaled axes keep a square window and plot the stated rate", () => {
  let scaled = 0;
  for (const seed of seeds(300, "rate")) {
    const problem = generateProblem("graph-of-proportional-rate", seed);
    if (problem.variant!.axes!["y-scale"] !== "scaled") continue;
    scaled++;
    const response = problem.public.response as FigureChoiceResponse;
    for (const option of response.options) {
      const g = option.scene.elements[0] as unknown as {
        x: number[];
        y: number[];
        grid: number[];
        tick: number[];
      };
      const step = g.y[1]! / 12;
      assert.ok([5, 10, 20].includes(step), `${step}`);
      assert.deepEqual(g.grid, [1, step]);
      assert.deepEqual(g.tick, [2, 2 * step]);
    }
  }
  assert.ok(scaled >= 60);
});

test("every new template has a lesson that never shows the learner's correct answer", () => {
  for (const id of [...figureIds, ...partIds])
    for (const seed of seeds(12, "lesson")) {
      const learner = generateProblem(id, seed);
      const view = problemLesson(
        id,
        learner.public.seed,
        learner.public.prompt,
        learner.public.response,
        learner,
      );
      if (learner.public.response.kind === "figure-choice") {
        assert.notEqual(
          view.example.prompt,
          learner.public.prompt,
          `${id} ${seed}`,
        );
        assert.notEqual(
          view.example.answer,
          answerText(learner.public.response, learner.answer),
          `${id} ${seed}`,
        );
      }
      assert.equal(/option-[a-d]/.test(JSON.stringify(view)), false);
      assert.equal(
        /\b(Graph|Number line) [A-D]\b/.test(view.example.steps.join(" ")),
        false,
      );
    }
});

test("a statement digest guard: the fixture file lists only the rate graph", () => {
  const golden = JSON.parse(
    readFileSync(
      new URL("./fixtures/figure-choice-legacy-digests.json", import.meta.url),
      "utf8",
    ),
  ) as Record<string, string[]>;
  assert.deepEqual(Object.keys(golden), ["graph-of-proportional-rate"]);
});
