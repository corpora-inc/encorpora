import { test } from "node:test";
import assert from "node:assert/strict";
import { problemLesson } from "../src/content/problem-lessons";
import type { SemanticFigure } from "../src/math/contracts";
import {
  animationModel,
  animationFrames,
  jumpStops,
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

test("signed-number animations reflect exactly across 0 and land where the jumps sum", () => {
  const kinds = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const opposite = problemLesson("opposite-on-line", `animation-${i}`);
    const model = animationModel(opposite);
    assert(model?.kind === "opposite", "opposite-on-line has no model");
    const frames = animationFrames(model);
    assert.equal(frames.length, 3);
    // The final frame names the opposite: same distance, other side of 0.
    assert.equal(frames[2]!.math, `$-(${model.value}) = ${-model.value}$`);
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
      else if (!lesson.example.prompt.includes("The patterns continue"))
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

test("geometry animations come from exact figures and state true measures", () => {
  const seen = new Set<string>();
  for (const id of [
    "triangle-angle-sum",
    "triangle-exterior-angle",
    "parallel-lines-angle",
    "cross-section-shape",
    "cross-section-area",
  ])
    for (let i = 0; i < 40; i++) {
      const lesson = problemLesson(id, `geometry-animation-${i}`);
      const model = animationModel(lesson);
      assert(model, `${id} has no compatible model`);
      seen.add(model.kind);
      const frames = animationFrames(model);
      assert.equal(frames.length, 3);
      if (model.kind === "triangle-sum") {
        const [a, b, c] = model.figure.angles;
        assert.equal(a + b + c, 180);
        assert.equal(
          frames[2]!.math,
          `$${a}^\\circ + ${b}^\\circ + ${c}^\\circ = 180^\\circ$`,
        );
      }
      if (model.kind === "exterior-angle") {
        const [a, b, c] = model.figure.angles;
        assert.equal(180 - b, a + c);
        assert.match(frames[2]!.math, new RegExp(`= ${a + c}\\^`));
      }
    }
  assert.deepEqual([...seen].sort(), [
    "exterior-angle",
    "plane-sweep",
    "transversal",
    "triangle-sum",
  ]);
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
