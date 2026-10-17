import assert from "node:assert/strict";
import test from "node:test";
import { measurementDefinitions } from "../src/content/measurement-definitions.js";
import {
  generateMeasurementProblem,
  measurementTemplates,
} from "../src/math/measurement-practice.js";
import { generatedProblemSchema } from "../src/math/contracts.js";
import {
  measurementFigureSchema,
  rectangleComparisonLayout,
} from "../src/math/measurement-models.js";
import { generateProblem, templates } from "../src/math/engine.js";
import { lessons } from "../src/content/lessons.js";

test("measurement families have instruction, deterministic public givens and honest response capabilities", () => {
  assert.equal(measurementDefinitions.length, 15);
  const edges = new Set<string>();
  for (const t of measurementTemplates) {
    assert.equal(templates.filter((p) => p.id === t.id).length, 1);
    assert.equal(lessons.filter((l) => l.templateIds.includes(t.id)).length, 1);
    const positions = new Set<string>();
    for (let seed = 0; seed < 256; seed++) {
      const p = generateProblem(t.id, `measurement-boundary-${seed}`);
      assert.deepEqual(
        p,
        generateMeasurementProblem(t.id, `measurement-boundary-${seed}`),
      );
      generatedProblemSchema.parse(p);
      assert.ok(p.public.prompt.length <= 205, `${t.id} prompt too long`);
      assert.ok(!("answer" in p.public) && !("choiceFeedback" in p.public));
      assert.equal(
        !!p.public.figure,
        t.requiredFigureCapability === "measurement-models-v1",
      );
      if (p.public.response.kind === "choice") {
        assert.equal(t.requiredResponseCapability, "single-choice-v1");
        assert.equal(
          p.public.response.options.filter((o) => o.id === p.answer).length,
          1,
        );
        assert.equal(
          Object.keys(p.choiceFeedback!).length,
          p.public.response.options.length - 1,
        );
        positions.add(p.answer);
        const selected = p.public.response.options.find(
          (o) => o.id === p.answer,
        )!.label;
        if (selected === "No such rectangle") edges.add("impossible");
        if (selected === "Same cost") edges.add("tie");
      } else {
        assert.equal(t.requiredResponseCapability, undefined);
        assert.match(p.answer, /^\d+(?:\/[1-9]\d*)?$/);
        if (p.answer.includes("/")) edges.add(`${t.id}.fraction`);
      }
      const f = p.public.figure;
      if (f?.kind === "measure-rectangle" && t.id.includes("missing")) {
        assert.equal(
          f.height,
          null,
          "Unknown length must not leak through SVG proportions or public data",
        );
        assert.deepEqual(Object.keys(f).sort(), ["height", "kind", "width"]);
      }
      if (f?.kind === "length-interval") {
        assert.ok(
          f.startNumerator > 0,
          "Shifted ruler must exercise the starting position",
        );
        edges.add(`ruler.${f.denominator}`);
      }
      if (f?.kind === "rectangle-comparison") {
        const layout = rectangleComparisonLayout(f);
        assert.equal(layout[0]!.unit, layout[1]!.unit);
        for (let i = 0; i < 2; i++) {
          const r = f.rectangles[i]!,
            l = layout[i]!;
          assert.ok(Math.abs(l.width / r.width - l.height / r.height) < 1e-12);
          assert.ok(
            l.x >= i * 160 + 40 && l.x + l.width <= i * 160 + 144 + 1e-9,
          );
          assert.ok(l.y >= 38 && l.y + l.height <= 108 + 1e-9);
        }
      }
    }
    if (t.requiredResponseCapability)
      assert.equal(positions.size, 3, `${t.id} choice position coverage`);
  }
  for (const edge of [
    "impossible",
    "tie",
    "ruler.1",
    "ruler.2",
    "ruler.4",
    "fractional-ruler-length.fraction",
    "metric-length-reverse.fraction",
  ])
    assert.ok(edges.has(edge), `Missing boundary ${edge}`);
});

test("measurement schemas reject invisible, impossible and unbounded givens", () => {
  const ruler = {
    kind: "length-interval",
    denominator: 4,
    maxWhole: 3,
    startNumerator: 1,
    endNumerator: 12,
    unit: "cm",
  };
  measurementFigureSchema.parse(ruler);
  for (const mutation of [
    { endNumerator: 13 },
    { startNumerator: 12 },
    { denominator: 3 },
    { maxWhole: 12 },
    { answer: "11/4" },
  ])
    assert.equal(
      measurementFigureSchema.safeParse({ ...ruler, ...mutation }).success,
      false,
    );
  for (const invalid of [
    {
      kind: "measure-rectangle",
      width: { value: 1200, unit: "cm" },
      height: null,
    },
    { kind: "measure-rectangle", width: null, height: null },
    {
      kind: "measure-rectangle",
      width: { value: 0, unit: "cm" },
      height: null,
    },
    {
      kind: "measure-rectangle",
      width: { value: 12, unit: "cm" },
      height: null,
      hiddenHeight: 7,
    },
    {
      kind: "rectangle-comparison",
      rectangles: [
        { width: 13, height: 1 },
        { width: 2, height: 6 },
      ],
      unit: "cm",
    },
  ])
    assert.equal(measurementFigureSchema.safeParse(invalid).success, false);
  assert.throws(() => generateMeasurementProblem("missing", "seed"));
  assert.throws(() => generateMeasurementProblem("shifted-ruler-length", ""));
  assert.throws(() =>
    generateMeasurementProblem("shifted-ruler-length", "x".repeat(129)),
  );
});
