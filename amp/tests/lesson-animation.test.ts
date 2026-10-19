import { test } from "node:test";
import assert from "node:assert/strict";
import { problemLesson } from "../src/content/problem-lessons";
import {
  animationModel,
  animationFrames,
} from "../src/web/lesson-animation/model";
import type { CoordinateGeometryFigure } from "../src/math/contracts";

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

/** Coordinate rules restated here, independent of the generator and the model. */
const rules: Record<string, (x: number, y: number) => [number, number]> = {
  '{"kind":"reflect","axis":"x"}': (x, y) => [x, -y],
  '{"kind":"reflect","axis":"y"}': (x, y) => [-x, y],
  '{"kind":"rotate","degrees":90}': (x, y) => [-y, x],
  '{"kind":"rotate","degrees":180}': (x, y) => [-x, -y],
  '{"kind":"rotate","degrees":270}': (x, y) => [y, -x],
};
function expected(motion: object, x: number, y: number): [number, number] {
  const m = motion as {
    kind: string;
    dx?: number;
    dy?: number;
    numerator?: number;
    denominator?: number;
  };
  if (m.kind === "translate") return [x + m.dx!, y + m.dy!];
  if (m.kind === "dilate")
    return [
      (x * m.numerator!) / m.denominator!,
      (y * m.numerator!) / m.denominator!,
    ];
  return rules[JSON.stringify(motion)]!(x, y);
}

test("motion animations carry every vertex exactly onto its image", () => {
  const seen = new Set<string>();
  for (const id of [
    "transformation-image",
    "identify-rigid-motion",
    "dilation-image",
    "dilation-scale-factor",
  ])
    for (let i = 0; i < 80; i++) {
      const lesson = problemLesson(id, `motion-${i}`);
      const model = animationModel(lesson);
      assert(model && model.kind === "motion", `${id} has no motion model`);
      const figure = lesson.example.figure as CoordinateGeometryFigure;
      const given = figure.shapes.find((s) => s.role === "given")!.vertices;
      assert.deepEqual(
        model.given.map((p) => [p.x, p.y]),
        given.map((p) => [p.x, p.y]),
      );
      model.given.forEach((p, j) =>
        assert.deepEqual(
          [model.image[j]!.x, model.image[j]!.y],
          expected(model.motion, p.x, p.y),
        ),
      );
      // A stated image must be the one the animation lands on.
      const image = figure.shapes.find((s) => s.role === "image");
      if (image)
        assert.deepEqual(
          image.vertices.map((p) => [p.x, p.y]),
          model.image.map((p) => [p.x, p.y]),
        );
      const frames = animationFrames(model);
      assert.equal(frames.length, 3);
      for (const p of model.image)
        assert.ok(
          frames[2]!.math.includes(`(${p.x}, ${p.y})`),
          frames[2]!.math,
        );
      seen.add(
        model.motion.kind === "rotate"
          ? `rotate-${model.motion.degrees}`
          : model.motion.kind === "reflect"
            ? `reflect-${model.motion.axis}`
            : model.motion.kind,
      );
    }
  assert.deepEqual([...seen].sort(), [
    "dilate",
    "reflect-x",
    "reflect-y",
    "rotate-180",
    "rotate-270",
    "rotate-90",
    "translate",
  ]);
});

test("a figure whose image fits no single motion falls back to the static figure", () => {
  const lesson = problemLesson("identify-rigid-motion", "motion-fallback");
  const figure = structuredClone(
    lesson.example.figure,
  ) as CoordinateGeometryFigure;
  figure.shapes[1]!.vertices[2]!.x += 1;
  assert.equal(
    animationModel({ ...lesson, example: { ...lesson.example, figure } }),
    null,
  );
});

test("line-plot animations keep every measurement and share the exact mean", () => {
  for (const id of ["line-plot-whole", "fraction-line-plot"])
    for (let i = 0; i < 40; i++) {
      const model = animationModel(problemLesson(id, `stack-${i}`));
      assert(model?.kind === "line-plot-stack", id);
      assert.equal(animationFrames(model).length, 3);
    }
  for (let i = 0; i < 60; i++) {
    const lesson = problemLesson("fraction-plot-equal-share", `share-${i}`);
    const model = animationModel(lesson);
    assert(model?.kind === "line-plot-share");
    const { values, denominator } = model.figure;
    assert.equal(
      model.share * values.length,
      values.reduce((a, b) => a + b, 0),
    );
    const [n, d] = lesson.example.answer.split("/").map(Number);
    assert.equal(model.share * (d ?? 1), n! * denominator);
    assert.ok(model.share >= Math.min(...values));
    assert.ok(model.share <= Math.max(...values));
  }
});
