import { validateMeasurementCoverage } from "../src/content/measurement-coverage.js";
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
import {
  generateProblem,
  generateProblemFor,
  polishProblem,
  templates,
} from "../src/math/engine.js";
import { figureCapabilities } from "../src/math/contracts.js";
import {
  describeScene,
  layoutScene,
  sceneCapabilitiesIn,
  type Drawn,
} from "../src/math/scene/index.js";
import { lessons } from "../src/content/lessons.js";

test("measurement families have instruction, deterministic public givens and honest response capabilities", () => {
  assert.equal(measurementDefinitions.length, 15);
  validateMeasurementCoverage();
  const edges = new Set<string>();
  for (const t of measurementTemplates) {
    assert.equal(templates.filter((p) => p.id === t.id).length, 1);
    assert.equal(lessons.filter((l) => l.templateIds.includes(t.id)).length, 1);
    const positions = new Set<string>();
    for (let seed = 0; seed < 256; seed++) {
      const p = generateProblem(t.id, `measurement-boundary-${seed}`);
      assert.deepEqual(
        p,
        polishProblem(
          generateMeasurementProblem(t.id, `measurement-boundary-${seed}`),
        ),
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

test("fractional ruler lengths: a centimeter strip or an object on an inch ruler, the ruler only for scenes-v2 clients", () => {
  const older = figureCapabilities.filter((c) => c !== "scenes-v2");
  const reached = new Set<string>();
  const parts = new Set<number>();
  let shifted = 0;
  for (let i = 0; i < 300; i++) {
    const seed = `ruler-${i}`;
    const p = generateProblem("fractional-ruler-length", seed);
    generatedProblemSchema.parse(p);
    const surface = p.variant!.axes!.ruler!;
    reached.add(surface);
    const old = generateProblemFor("fractional-ruler-length", seed, older);
    assert.equal(old.variant!.axes!.ruler, "cm-strip");
    assert.equal(old.public.figure?.kind, "length-interval");
    if (surface === "cm-strip") {
      assert.deepEqual(old, p);
      continue;
    }
    const f = p.public.figure!;
    assert(f.kind === "scene");
    assert.deepEqual(sceneCapabilitiesIn(p.public), ["scenes-v2"]);
    const r = f.scene.elements[0]!;
    assert(r.type === "ruler" && r.unit === "in" && r.object);
    parts.add(r.parts);
    assert.ok(r.length <= (r.parts === 8 ? 4 : 6));
    if (r.object.from > 0) {
      shifted++;
      assert.equal(
        r.object.from % r.parts,
        0,
        "a shifted start is a whole inch",
      );
    }
    // The answer is the object's span in the ruler's parts, in lowest terms
    // with the part as denominator.
    const spaces = r.object.to - r.object.from;
    assert.equal(p.answer, `${spaces}/${r.parts}`);
    assert.equal(spaces % 2, 1);
    assert.equal(p.public.response.kind, "fraction");
    if (r.parts === 8)
      assert.match(p.public.prompt, /nearest eighth of an inch/);
    // No surface states the length before the answer.
    const said = `${p.public.prompt} ${describeScene(f.scene)} ${p.hint}`;
    assert.ok(!said.includes(p.answer), said);
    assert.ok(!said.includes(`${spaces} spaces`));
    // Eighths stay at least 7 px apart at the phone width.
    const l = layoutScene({ ...f.scene, width: 288 });
    const x = (k: number) =>
      (
        l.items.find((d) => d.id === `ruler.tick.${k}`) as Extract<
          Drawn,
          { k: "line" }
        >
      ).x1;
    if (r.parts === 8) assert.ok(x(1) - x(0) >= 7, `${x(1) - x(0)} px`);
  }
  assert.deepEqual([...reached].sort(), ["cm-strip", "inch-ruler"]);
  assert.deepEqual([...parts].sort(), [2, 4, 8]);
  assert.ok(shifted > 0);
});
