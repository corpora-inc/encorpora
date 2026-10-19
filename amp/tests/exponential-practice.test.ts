import { test } from "node:test";
import assert from "node:assert/strict";
import { generateProblem, normalizeAnswer } from "../src/math/engine";
import { exponentialTemplates } from "../src/math/exponential-practice";
import { semanticFigureSchema } from "../src/math/contracts";
import { layoutScene, describeScene, sceneSchema } from "../src/math/scene";
import { bars, table } from "../src/math/scene/author";
import { exponentialLessonScenes } from "../src/math/exponential-scenes";
import { skills } from "../src/curriculum/catalog";
import { templateRole } from "../src/learning/placement";

const sample = (id: string, n = 120) =>
  Array.from({ length: n }, (_, i) => generateProblem(id, `exp-test-${i}`));

test("every exponential template is deterministic, exact and renderable", () => {
  for (const t of exponentialTemplates) {
    const a = generateProblem(t.id, "fixed"),
      b = generateProblem(t.id, "fixed");
    assert.deepEqual(a, b, t.id);
    for (const p of sample(t.id)) {
      if (p.public.response.kind === "choice") {
        assert.equal(t.requiredResponseCapability, "single-choice-v1", t.id);
        const ids = p.public.response.options.map((o) => o.id);
        assert.ok(ids.includes(p.answer), `${t.id}: answer is an option`);
        assert.equal(Object.keys(p.choiceFeedback ?? {}).length, ids.length - 1);
      } else
        assert.notEqual(normalizeAnswer(p.answer), null, `${t.id}: ${p.answer}`);
      if (p.public.figure) {
        assert.equal(t.requiredFigureCapability, "scenes-v1", t.id);
        assert.ok(semanticFigureSchema.safeParse(p.public.figure).success, t.id);
        assert.equal(p.public.figure.kind, "scene");
      }
      assert.ok(p.explanation.length >= 1 && p.hint.length > 20, t.id);
    }
  }
});

test("each skill is practiced through at least three prompt forms", () => {
  const forms = new Map<string, Set<string>>();
  for (const t of exponentialTemplates)
    for (const p of sample(t.id, 200)) {
      const set = forms.get(t.skillId) ?? new Set<string>();
      // A frame is its opening words with every number removed.
      set.add(
        `${t.id}:${p.public.prompt.replace(/[\d.,−-]+/g, "#").slice(0, 28)}`,
      );
      forms.set(t.skillId, set);
    }
  for (const skill of [
    "exponential-models",
    "growth-comparison",
    "exponential-equations",
    "sequence-sums",
    "logarithm-properties",
    "logarithms",
    "geometric-sequences",
  ])
    assert.ok((forms.get(skill)?.size ?? 0) >= 3, skill);
});

test("whole items are assessment items", () => {
  for (const t of exponentialTemplates)
    assert.equal(templateRole(t.id), "assessment", t.id);
});

test("figures carry givens, never the value asked for", () => {
  // Typed answers whose value could appear in a figure: the figure must not
  // be the place the answer is written.
  for (const id of [
    "exponential-model-value",
    "exponential-overtakes",
    "logarithm-value",
  ])
    for (const p of sample(id)) {
      if (!p.public.figure || p.public.figure.kind !== "scene") continue;
      const text = describeScene(p.public.figure.scene);
      const answer = p.answer.replace("-", "−");
      if (id === "logarithm-value")
        assert.ok(
          !p.public.figure.scene.elements.some(
            (e) =>
              e.type === "graph" &&
              (e.points ?? []).some((pt) => pt.y === Number(p.answer)),
          ),
          `${id}: the asked height is not plotted`,
        );
      if (id === "exponential-model-value")
        assert.ok(!text.includes(` ${answer}.`), `${id}: ${text}`);
    }
});

test("the overtaking input is the first whole crossing, past the figure", () => {
  for (const p of sample("exponential-overtakes", 200)) {
    const x = Number(p.answer);
    assert.ok(x >= 3 && x <= 9, p.public.prompt);
    if (p.public.prompt.startsWith("Offer"))
      assert.ok(x >= 5, "the bars stop at day 3, before the crossing");
  }
});

test("log equations reject the extraneous root", () => {
  const sums = sample("log-equation", 300).filter((p) =>
    / \+ \\log/.test(p.public.prompt),
  );
  assert.ok(sums.length > 20);
  for (const p of sums) {
    assert.ok(Number(p.answer) > 0);
    assert.match(p.explanation.join(" "), /rejected/);
  }
});

test("table steps label each gap in a gutter, and highlights tint rows", () => {
  const s = table({
    corner: "x",
    columns: ["y"],
    rows: [
      { label: "0", cells: [3] },
      { label: "1", cells: [6] },
      { label: "2", cells: [12] },
    ],
    math: true,
  })
    .steps(0, ["×2", "×2"])
    .highlight({ rows: [1] })
    .scene();
  const l = layoutScene(s);
  assert.equal(l.scale, 1);
  const arrows = l.items.filter(
    (d) => d.k === "path" && /^e0\.step\.0\.\d$/.test(d.id),
  );
  assert.equal(arrows.length, 2);
  const labels = l.items.flatMap((d) =>
    d.k === "text" && /^e0\.step\.0\.\d\.label$/.test(d.id) ? [d] : [],
  );
  assert.deepEqual(
    labels.map((d) => d.plain),
    ["×2", "×2"],
  );
  // Each label sits right of the column, between its two rows.
  const cell = (r: number) =>
    l.items.find((d) => d.id === `e0.cell.${r}.0`) as Extract<
      (typeof l.items)[number],
      { k: "text" }
    >;
  for (const [i, d] of labels.entries()) {
    assert.ok(d.box.x0 > cell(i).box.x1);
    const mid = (d.box.y0 + d.box.y1) / 2;
    assert.ok(mid > cell(i).box.y1 - 4 && mid < cell(i + 1).box.y0 + 4);
  }
  assert.ok(l.items.some((d) => d.id === "e0.highlight.row.1"));
  assert.match(describeScene(s), /each step is ×2, then ×2/);
  assert.throws(() =>
    sceneSchema.parse({
      v: 1,
      elements: [
        {
          type: "table",
          columns: ["y"],
          rows: [{ label: "0", cells: [1] }],
          steps: [{ column: 0, labels: ["×2"] }],
        },
      ],
    }),
  );
});

test("bars share one linear scale", () => {
  const l = layoutScene(bars([1, 2, 3], { values: [1, 2, 4] }).scene());
  const heights = [0, 1, 2].map((i) => {
    const d = l.items.find((x) => x.id === `e0.series.0.bar.${i}`);
    assert.ok(d && d.k === "rect");
    return d.h;
  });
  assert.ok(Math.abs(heights[1]! / heights[0]! - 2) < 1e-6);
  assert.ok(Math.abs(heights[2]! / heights[0]! - 4) < 1e-6);
});

test("lesson scenes validate and fit their box", () => {
  for (const [name, scene] of Object.entries(exponentialLessonScenes)) {
    assert.ok(sceneSchema.safeParse(scene).success, name);
    const l = layoutScene(scene, { reveal: true });
    assert.ok(l.width <= 361 && l.height <= 321, name);
  }
});

test("logarithm properties is a catalog skill with its prerequisites", () => {
  const skill = skills.find((s) => s.id === "logarithm-properties");
  assert.ok(skill);
  assert.equal(skill.gradeBand, "algebra-2");
  assert.equal(skill.strand, "functions");
  assert.deepEqual(skill.prerequisites, ["logarithms"]);
  assert.ok(
    skills
      .find((s) => s.id === "exponential-equations")!
      .prerequisites.includes("logarithm-properties"),
  );
  for (const id of [
    "logarithm-properties.rules",
    "logarithm-properties.change-of-base",
  ])
    assert.equal(
      skill.facets.find((f) => f.id === id)?.status,
      "implemented",
      id,
    );
});
