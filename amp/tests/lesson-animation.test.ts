import { test } from "node:test";
import assert from "node:assert/strict";
import { problemLesson } from "../src/content/problem-lessons";
import {
  animationModel,
  animationFrames,
  jumpStops,
} from "../src/web/lesson-animation/model";

test("animation models conserve the quantities in real lesson examples", () => {
  const kinds = new Set<string>();
  for (const id of [
    "fraction-model",
    "split-array-part",
    "exchange-base-ten",
  ]) {
    for (let i = 0; i < 100; i++) {
      const lesson = problemLesson(id, `animation-${i}`);
      const model = animationModel(lesson);
      assert(model, `${id} has no compatible model`);
      const frames = animationFrames(model);
      assert.equal(frames.length, 3);
      if (model.kind === "exchange") {
        const { hundreds: h, tens: t, ones: o } = model.figure;
        const ones = model.unit === 1;
        assert.equal(
          (h + (ones ? 0 : 1)) * 100 +
            (t + (ones ? 1 : -10)) * 10 +
            o -
            (ones ? 10 : 0),
          h * 100 + t * 10 + o,
        );
        assert.equal(Number(lesson.example.answer), ones ? t + 1 : h + 1);
        assert.equal(
          frames[2].math,
          `$${h + (ones ? 0 : 1)} \\times 100 + ${t + (ones ? 1 : -10)} \\times 10 + ${o - (ones ? 10 : 0)}$`,
        );
        kinds.add(ones ? "ones" : "tens");
      } else if (model.kind === "array") {
        const { rows, columns, splitAfterRow } = model.figure;
        assert.equal(
          splitAfterRow * columns + (rows - splitAfterRow) * columns,
          rows * columns,
        );
        assert(
          [splitAfterRow * columns, (rows - splitAfterRow) * columns].includes(
            Number(lesson.example.answer),
          ),
        );
        assert.equal(
          frames[2].math,
          `$${splitAfterRow * columns} + ${(rows - splitAfterRow) * columns} = ${rows * columns}$`,
        );
        kinds.add("array");
      } else if (model.kind === "fraction") {
        const [n, d] = lesson.example.answer.split("/").map(Number);
        assert.equal(n * model.figure.parts, model.figure.selected * (d ?? 1));
        assert.equal(
          frames[2].math,
          `$${model.figure.selected} \\times \\dfrac{1}{${model.figure.parts}} = \\dfrac{${model.figure.selected}}{${model.figure.parts}}$`,
        );
        kinds.add("fraction");
      }
    }
  }
  assert.deepEqual([...kinds].sort(), ["array", "fraction", "ones", "tens"]);
});

test("incompatible or invalid figures fall back to the ordinary lesson figure", () => {
  const lesson = problemLesson("fraction-model", "animation");
  assert.equal(animationModel({ ...lesson, templateId: "other" }), null);
  for (const figure of [
    undefined,
    { kind: "fraction" as const, parts: 0, selected: 1 },
    { kind: "fraction" as const, parts: 4, selected: 5 },
    { kind: "fraction" as const, parts: 4.5, selected: 1 },
  ])
    assert.equal(
      animationModel({ ...lesson, example: { ...lesson.example, figure } }),
      null,
    );
});

test("array and exchange adapters reject ambiguous or unsupported metadata", () => {
  for (const [templateId, figure] of [
    ["split-array-part", { kind: "unit-array", rows: 4, columns: 5 }],
    [
      "split-array-part",
      { kind: "unit-array", rows: 4, columns: 5, splitAfterRow: 4 },
    ],
    [
      "exchange-base-ten",
      { kind: "base-ten", hundreds: 2, tens: 11, ones: 10 },
    ],
    ["exchange-base-ten", { kind: "base-ten", hundreds: 2, tens: 3, ones: 4 }],
  ] as const) {
    const lesson = problemLesson(templateId, "animation");
    assert.equal(
      animationModel({ ...lesson, example: { ...lesson.example, figure } }),
      null,
    );
  }
});

test("signed-number animations reflect exactly across 0 and land where the jumps sum", () => {
  const kinds = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const opposite = problemLesson("opposite-on-line", `animation-${i}`);
    const model = animationModel(opposite);
    assert(model?.kind === "opposite", "opposite-on-line has no model");
    const frames = animationFrames(model);
    assert.equal(frames.length, 3);
    // The final frame names the opposite: same distance, other side of 0.
    assert.equal(
      frames[2]!.math,
      `$-${model.value < 0 ? `(${model.value})` : model.value} = ${-model.value}$`,
    );
    const shown = Number(opposite.example.answer.replace("−", "-"));
    assert.ok(shown === -model.value || shown === model.value);
    kinds.add(model.value < 0 ? "negative" : "positive");

    const jumps = problemLesson("signed-jumps", `animation-${i}`);
    const jumpModel = animationModel(jumps);
    assert(jumpModel?.kind === "jumps", "signed-jumps has no model");
    const stops = jumpStops(jumpModel.start, jumpModel.jumps);
    const exact =
      jumpModel.jumps.reduce((sum, j) => sum + j * 2, jumpModel.start * 2) / 2;
    assert.equal(stops.at(-1), exact);
    assert.equal(Number(jumps.example.answer.replace("−", "-")), exact);
    assert.ok(stops.every((v) => v >= jumpModel.min && v <= jumpModel.max));
    assert.ok(animationFrames(jumpModel)[2]!.math.endsWith(` = ${exact}$`));
    kinds.add(`jumps-${jumpModel.jumps.length}`);
  }
  assert.deepEqual([...kinds].sort(), [
    "jumps-2",
    "jumps-3",
    "negative",
    "positive",
  ]);
  const lesson = problemLesson("opposite-on-line", "animation");
  for (const figure of [
    {
      kind: "signed-line" as const,
      min: -10,
      max: 10,
      labelEvery: 5,
      points: [],
    },
    {
      kind: "signed-line" as const,
      min: -10,
      max: 10,
      labelEvery: 5,
      points: [{ value: 0, label: "P" }],
    },
    {
      kind: "signed-line" as const,
      min: -10,
      max: 4,
      labelEvery: 5,
      points: [{ value: -7, label: "P" }],
    },
  ])
    assert.equal(
      animationModel({ ...lesson, example: { ...lesson.example, figure } }),
      null,
    );
  const jumpLesson = problemLesson("signed-jumps", "animation");
  assert.equal(
    animationModel({
      ...jumpLesson,
      example: {
        ...jumpLesson.example,
        figure: {
          kind: "signed-line",
          min: -5,
          max: 5,
          labelEvery: 5,
          points: [],
          start: 4,
          jumps: [3],
        },
      },
    }),
    null,
  );
});
