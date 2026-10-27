import assert from "node:assert/strict";
import test from "node:test";
import {
  clientCanDraw,
  figureCapabilities,
  generatedProblemSchema,
} from "../src/math/contracts.js";
import {
  generateProblem,
  generateProblemFor,
  gradeAnswer,
  templates,
} from "../src/math/engine.js";
import {
  THERMOMETER_HEIGHT,
  thermometerReadingCase,
  thermometerReadingTemplate,
  thermometerScales,
  thermometerScene,
  type ThermometerModel,
} from "../src/math/thermometer-reading-practice.js";
import {
  describeScene,
  layoutScene,
  sceneCapabilitiesIn,
  type Drawn,
} from "../src/math/scene/index.js";
import { lessons } from "../src/content/lessons.js";
import { methods } from "../src/content/problem-methods.js";
import { templateArchetypes } from "../src/curriculum/template-archetypes.js";

const ID = "thermometer-reading";
const seeds = (n: number) => Array.from({ length: n }, (_, i) => `t:${i}`);

test("the template is registered once, needs scenes-v2, and has instruction", () => {
  assert.equal(templates.filter((t) => t.id === ID).length, 1);
  assert.equal(
    thermometerReadingTemplate.requiredFigureCapability,
    "scenes-v2",
  );
  assert.equal(lessons.filter((l) => l.templateIds.includes(ID)).length, 1);
  assert.ok(methods[ID]?.watch);
  assert.deepEqual(templateArchetypes[ID], ["measure.thermometer"]);
});

test("a client without scenes-v2 is never sent the template", () => {
  const without = figureCapabilities.filter((c) => c !== "scenes-v2");
  assert.equal(
    clientCanDraw(thermometerReadingTemplate, {
      responseCapabilities: [],
      figureCapabilities: without,
    }),
    false,
  );
  assert.equal(
    clientCanDraw(thermometerReadingTemplate, {
      responseCapabilities: [],
      figureCapabilities: [...figureCapabilities],
    }),
    true,
  );
  assert.throws(() => generateProblemFor(ID, "t:0", without));
});

test("instances are valid, deterministic, gradable and read off the figure", () => {
  const variants = new Set<string>();
  let negative = 0,
    onLabel = 0;
  for (const seed of seeds(600)) {
    const { model, problem } = thermometerReadingCase(seed);
    generatedProblemSchema.parse(problem);
    assert.deepEqual(generateProblem(ID, seed), generateProblem(ID, seed));
    assert.deepEqual(generateProblem(ID, seed), problem);
    assert.equal(problem.answer, String(model.reading));
    assert.ok(gradeAnswer(problem, problem.answer));
    assert.ok(!gradeAnswer(problem, String(model.reading + model.minor)));
    assert.deepEqual(sceneCapabilitiesIn(problem.public), ["scenes-v2"]);
    const figure = problem.public.figure;
    assert.equal(figure?.kind, "scene");
    const element = figure.kind === "scene" ? figure.scene.elements[0] : null;
    assert.equal(element?.type, "thermometer");
    if (element?.type !== "thermometer") continue;
    assert.equal(element.reading, model.reading);
    assert.equal(element.derived, true);
    assert.ok(element.min < model.reading && model.reading < element.max);
    assert.equal(Math.abs(model.reading % model.minor), 0);
    assert.equal(model.base + model.steps * model.minor, model.reading);
    // The answer is never written in words a learner reads first.
    const value = String(Math.abs(model.reading));
    const said = new RegExp(`(?<![\\d.])${value}(?![\\d])`);
    assert.doesNotMatch(problem.public.prompt, said, seed);
    assert.doesNotMatch(problem.hint, said, `${seed}: ${problem.hint}`);
    // The description gives the scale, never the reading.
    const described = describeScene(
      figure.kind === "scene" ? figure.scene : thermometerScene(model),
    );
    assert.match(described, /reading is to be found/);
    assert.doesNotMatch(described, /liquid reaches/);
    // The hint names this scale's step.
    assert.match(
      problem.hint,
      new RegExp(`each small mark is ${model.minor} `),
    );
    variants.add(model.variant);
    if (model.reading < 0) negative++;
    if (model.steps === 0) onLabel++;
  }
  assert.deepEqual([...variants].sort(), [
    "below-zero",
    "celsius",
    "fahrenheit",
  ]);
  assert.ok(negative > 60 && negative < 200, `negative readings ${negative}`);
  assert.ok(onLabel > 20 && onLabel < 120, `on a numbered mark ${onLabel}`);
});

test("every scale keeps small marks at least 6 px and numbers at least 28 px apart", () => {
  for (const scale of thermometerScales)
    for (const width of [288, 360]) {
      const model: ThermometerModel = {
        variant: "fahrenheit",
        unit: "F",
        minor: scale.minor,
        major: scale.major,
        min: 30,
        max: 30 + scale.span,
        reading: 30 + scale.minor * 3,
        base: 30,
        steps: 3,
      };
      const l = layoutScene({ ...thermometerScene(model), width });
      assert.ok(l.height <= THERMOMETER_HEIGHT + 1);
      const y = (d: number) =>
        (
          l.items.find((i) => i.id === `t.tick.${d}`) as Extract<
            Drawn,
            { k: "line" }
          >
        ).y1;
      const minor = y(30) - y(30 + scale.minor);
      assert.ok(minor >= 6, `${JSON.stringify(scale)}: ${minor}`);
      assert.ok(minor * (scale.major / scale.minor) >= 28);
    }
});

test("the hint cue highlights the numbered mark to count from", () => {
  for (const seed of seeds(80)) {
    const { model, problem } = thermometerReadingCase(seed);
    if (model.steps === 0) {
      assert.equal(problem.hintCue, undefined);
      continue;
    }
    const figure = problem.public.figure!;
    assert.equal(figure.kind, "scene");
    if (figure.kind !== "scene") continue;
    const ids = new Set(layoutScene(figure.scene).items.map((i) => i.id));
    for (const step of problem.hintCue!)
      for (const action of step.actions)
        assert.ok(ids.has(action.target as string), action.target as string);
  }
});
