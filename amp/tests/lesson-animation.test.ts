import { test } from "node:test";
import assert from "node:assert/strict";
import { problemLesson } from "../src/content/problem-lessons";
import {
  animationModel,
  animationFrames,
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

test("root zooms and decimal shifts follow the example's own givens exactly", () => {
  const seen = new Set<string>();
  for (const id of [
    "root-between-integers",
    "root-nearest-tenth",
    "scientific-to-standard",
    "standard-to-scientific",
  ])
    for (let i = 0; i < 120; i++) {
      const lesson = problemLesson(id, `animation-${i}`);
      const model = animationModel(lesson);
      assert(model, `${id} has no compatible model`);
      const frames = animationFrames(model);
      assert.equal(frames.length, 3);
      // The givens appear in the example prompt the learner reads.
      if (model.kind === "root-zoom") {
        const { radicand: n, index } = model;
        assert.ok(
          lesson.example.prompt.includes(
            index === 2 ? `\\sqrt{${n}}` : `\\sqrt[3]{${n}}`,
          ),
        );
        const k = Math.floor(Math.round(n ** (1 / index) * 1e9) / 1e9);
        assert.ok(k ** index < n && n < (k + 1) ** index);
        // Each framed inequality holds when evaluated independently.
        for (const frame of frames.slice(0, 2)) {
          const tokens = frame.math.replace(/[$]/g, "").split(/ [=<] /);
          assert.equal(tokens.length, 5, frame.math);
          const [low, a, b, c, high] = tokens;
          const power = (t: string) => Number(t.split("^")[0]) ** index;
          assert.ok(Number(a) < Number(b) && Number(b) < Number(c), frame.math);
          assert.equal(Number(b), n);
          assert.ok(Math.abs(power(low!) - Number(a)) < 1e-9, frame.math);
          assert.ok(Math.abs(power(high!) - Number(c)) < 1e-9, frame.math);
        }
        if (id === "root-nearest-tenth")
          assert.ok(
            frames[2]!.math.endsWith(`\\approx ${lesson.example.answer}$`),
            `${frames[2]!.math} vs ${lesson.example.answer}`,
          );
        seen.add(`root-${index}`);
      } else if (model.kind === "decimal-shift") {
        const coefficient =
          model.digits.length > 1
            ? `${model.digits[0]}.${model.digits.slice(1)}`
            : model.digits;
        const standard = frames[2]!.math
          .replace(/[$]/g, "")
          .split(" = ")
          [model.toStandard ? 1 : 0]!.replaceAll("{,}", "");
        // Exact: shifting the coefficient's digits by the exponent gives the standard form.
        const [whole, part = ""] = coefficient.split(".");
        const scaledDigits = BigInt(`${whole}${part}`);
        const exponent = model.exponent - part.length;
        const [sw, sp = ""] = standard.split(".");
        const standardDigits = BigInt(`${sw}${sp}`);
        const left =
          exponent + sp.length >= 0
            ? scaledDigits * 10n ** BigInt(exponent + sp.length)
            : scaledDigits;
        const right =
          exponent + sp.length >= 0
            ? standardDigits
            : standardDigits * 10n ** BigInt(-(exponent + sp.length));
        assert.equal(left, right, frames[2]!.math);
        if (model.toStandard)
          assert.equal(standard, lesson.example.answer.replaceAll(",", ""));
        else
          assert.ok(
            lesson.example.answer.includes(
              `${coefficient} \\times 10^{${model.exponent}}`,
            ),
          );
        seen.add(
          `${model.toStandard ? "to" : "from"}-${model.exponent > 0 ? "large" : "small"}`,
        );
      } else assert.fail(`unexpected model ${model.kind}`);
    }
  assert.deepEqual([...seen].sort(), [
    "from-large",
    "from-small",
    "root-2",
    "root-3",
    "to-large",
    "to-small",
  ]);
  const lesson = problemLesson("root-nearest-tenth", "animation");
  assert.equal(
    animationModel({
      ...lesson,
      example: {
        ...lesson.example,
        givens: { kind: "root", radicand: 49, index: 2 },
      },
    }),
    null,
  );
  assert.equal(
    animationModel({
      ...lesson,
      example: { ...lesson.example, givens: undefined },
    }),
    null,
  );
});
