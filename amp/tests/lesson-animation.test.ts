import { test } from "node:test";
import assert from "node:assert/strict";
import { problemLesson } from "../src/content/problem-lessons";
import type { SemanticFigure } from "../src/math/contracts";
import {
  animationModel,
  animationFrames,
  fiveNumbers,
} from "../src/web/lesson-animation/model";

test("animation models conserve the quantities in real lesson examples", () => {
  const kinds = new Set<string>();
  for (const id of [
    "fraction-model",
    "split-array-part",
    "exchange-base-ten",
    "double-number-line-missing",
    "balance-one-step",
    "balance-two-step",
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
      } else if (model.kind === "rate") {
        // Both lines scale by one factor: through 1, then to the target.
        const [b, t] = model.given,
          [tb, tt] = model.target;
        assert.equal(t * tb, tt * b);
        assert.equal(Number(lesson.example.answer), model.findBottom ? tb : tt);
        assert.equal(
          frames[1].math.includes(`${t} \\div ${b} = ${t / b}`),
          true,
        );
        kinds.add("rate");
      } else if (model.kind === "balance") {
        // Every frame's equation is true for the weight read from the pans.
        const { groups, blocks, units, right } = model.figure;
        assert.equal(groups * (blocks * model.x + units), right);
        assert.equal(Number(lesson.example.answer), model.x);
        assert.equal(frames[2].math.endsWith(`= ${model.x}$`), true);
        const tex = frames.map((frame) => frame.math).join(" ");
        assert.doesNotMatch(tex, /NaN|undefined|\.\d/);
        kinds.add(model.form);
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
  assert.deepEqual([...kinds].sort(), [
    "add",
    "array",
    "fraction",
    "ones",
    "rate",
    "remove-split",
    "split-remove",
    "tens",
    "times",
  ]);
});

test("geometry models follow the lesson example's own figure", () => {
  for (let i = 0; i < 60; i++) {
    for (const id of ["unit-cube-volume", "cube-layer-count"]) {
      const lesson = problemLesson(id, `animation-${i}`);
      const model = animationModel(lesson);
      assert(model?.kind === "prism-layers", id);
      const { length: l, width: w, height: h } = model.figure;
      const frames = animationFrames(model);
      assert.equal(frames.length, 3);
      assert.equal(
        Number(lesson.example.answer),
        id === "unit-cube-volume" ? l * w * h : l * w,
      );
      assert.equal(
        frames[2]!.math,
        `$V = ${l * w} \\times ${h} = ${l * w * h}$ cubic units`,
      );
    }
    const lesson = problemLesson(
      "first-quadrant-coordinates",
      `animation-${i}`,
    );
    const model = animationModel(lesson);
    assert(model?.kind === "quadrant-walk");
    const { x, y } = model.figure.points[0]!;
    assert.equal(lesson.example.answer, `(${x}, ${y})`);
    assert.equal(animationFrames(model)[2]!.math, `$(${x}, ${y})$`);
  }
  // Locating among several points has no single path to trace.
  assert.equal(
    animationModel(problemLesson("first-quadrant-locate", "animation")),
    null,
  );
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
    [
      "double-number-line-missing",
      {
        kind: "double-number-line",
        top: { label: "Miles", denominator: 2, numerators: [0, 3, null] },
        bottom: { label: "Hours", denominator: 1, numerators: [0, 1, 2] },
      },
    ],
    [
      "double-number-line-missing",
      {
        kind: "double-number-line",
        top: { label: "Miles", denominator: 1, numerators: [0, 7, null] },
        bottom: { label: "Hours", denominator: 1, numerators: [0, 2, 3] },
      },
    ],
  ] as const) {
    const lesson = problemLesson(templateId, "animation");
    assert.equal(
      animationModel({
        ...lesson,
        example: {
          ...lesson.example,
          // Fixtures are frozen literals; the adapter only reads them.
          figure: structuredClone(figure) as SemanticFigure,
        },
      }),
      null,
    );
  }
});

test("plot animations turn every table row into a point on the stated rule", () => {
  for (const id of [
    "related-patterns-relationship",
    "dependent-variable-equation",
  ]) {
    const rules = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const lesson = problemLesson(id, `animation-${i}`);
      const model = animationModel(lesson);
      assert(model?.kind === "plot", `${id} has no plot model`);
      const { rows, rule, graph } = model;
      for (const r of rows) {
        assert.equal(r.y, rule.k * r.x + rule.offset);
        assert.ok(r.x <= graph.xMax && r.y <= graph.yMax);
      }
      const frames = animationFrames(model);
      assert.equal(frames.length, 3);
      const equation =
        rule.offset === 0
          ? `${rule.y} = ${rule.k}${rule.x}`
          : `${rule.y} = ${rule.x} + ${rule.offset}`;
      assert.equal(frames[2]!.math, `$${equation}$`);
      if (id === "dependent-variable-equation")
        assert.equal(lesson.example.answer, equation);
      else if (!lesson.example.prompt.includes("paired with"))
        assert.equal(Number(lesson.example.answer), rule.k);
      rules.add(rule.offset ? "offset" : "proportional");
    }
    assert.ok(rules.has("proportional"), id);
  }
  const lesson = problemLesson("dependent-variable-equation", "animation");
  const figure = lesson.example.figure!;
  assert.equal(figure.kind, "function-display");
  if (figure.kind !== "function-display") return;
  const bent = {
    ...figure,
    table: {
      ...figure.table!,
      rows: figure.table!.rows.map((r, i) =>
        i === 2 ? { ...r, y: r.y + 1 } : r,
      ),
    },
  };
  assert.equal(
    animationModel({ ...lesson, example: { ...lesson.example, figure: bent } }),
    null,
  );
});

test("balance adapter rejects unlevel or undrawable balances", () => {
  for (const figure of [
    { kind: "balance-scale", groups: 1, blocks: 2, units: 3, right: 10 },
    { kind: "balance-scale", groups: 2, blocks: 2, units: 1, right: 10 },
    { kind: "balance-scale", groups: 1, blocks: 1, units: 0, right: 5 },
    { kind: "balance-scale", groups: 1, blocks: 1, units: 4, right: 4 },
  ] as const) {
    const lesson = problemLesson("balance-two-step", "animation");
    assert.equal(
      animationModel({ ...lesson, example: { ...lesson.example, figure } }),
      null,
    );
  }
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

test("statistics animations balance at the exact mean and box the exact quartiles", () => {
  for (const id of ["dot-plot-mean", "dot-plot-mad"])
    for (let i = 0; i < 60; i++) {
      const model = animationModel(problemLesson(id, `balance-${i}`));
      assert(model?.kind === "mean-balance", id);
      const { values } = model.figure;
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      assert.notEqual(model.trial, mean);
      // Signed distances about the mean cancel: it is the balance point.
      assert.ok(Math.abs(values.reduce((a, v) => a + (v - mean), 0)) < 1e-9);
      assert.equal(animationFrames(model).length, 3);
    }
  for (let i = 0; i < 60; i++) {
    const lesson = problemLesson("dot-plot-iqr", `box-${i}`);
    const model = animationModel(lesson);
    assert(model?.kind === "box-build");
    const q = fiveNumbers(model.figure.values);
    const [n, d] = lesson.example.answer.split("/").map(Number);
    assert.equal(
      q.q3 - q.q1,
      Number(
        lesson.example.answer.includes(".")
          ? lesson.example.answer
          : n! / (d ?? 1),
      ),
    );
    assert.ok(
      q.min <= q.q1 && q.q1 <= q.median && q.median <= q.q3 && q.q3 <= q.max,
    );
  }
});

test("the MAD-gap animation lays exactly the gap between the means in MADs", () => {
  for (let i = 0; i < 60; i++) {
    const lesson = problemLesson("means-in-mads", `gap-${i}`);
    const model = animationModel(lesson);
    assert(model?.kind === "mad-gap");
    const [a, b] = model.figure.groups.map((g) => g.values);
    const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
    assert.deepEqual(model.means, [mean(a!), mean(b!)]);
    const [n, d] = lesson.example.answer.split("/").map(Number);
    assert.equal(Math.abs(mean(a!) - mean(b!)) / model.mad, n! / (d ?? 1));
    assert.equal(animationFrames(model).length, 3);
  }
});
