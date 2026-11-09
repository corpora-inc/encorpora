import assert from "node:assert/strict";
import test from "node:test";
import { generateProblem, gradeAnswer } from "../src/math/engine";
import { generatedProblemSchema } from "../src/math/contracts";
import {
  visiblePrismCubes,
  visibleStepCubes,
} from "../src/math/volume-coordinate-practice";
import { layoutScene } from "../src/math/scene";
import { missingTargets } from "../src/math/scene/timeline";

const CLASSIC = {
  prism:
    "Each small cube is 1 cubic unit. What is the volume of this rectangular prism, in cubic units?",
  steps:
    "This solid is built from 1-unit cubes, and every column is filled to the bottom. What is its volume, in cubic units?",
};

/** Front, top, and side, minus the double-counted edges, plus the corner. */
function visibleByFaces(l: number, w: number, h: number) {
  return l * h + w * h + l * w - l - w - h + 1;
}

function unitOf(prompt: string) {
  const found = /, in ([^?]+)\?$/.exec(prompt);
  assert.ok(found, prompt);
  return found[1]!;
}

test("a full prism's visible cubes are the three faces, not the volume", () => {
  assert.equal(visiblePrismCubes(2, 2, 2), 7);
  assert.equal(visibleByFaces(2, 2, 2), 7);
  // The spec's 36-cube example is not 22 visible cubes. 3×3×4 hides 12.
  assert.equal(visiblePrismCubes(3, 3, 4), 24);
  assert.equal(3 * 3 * 4 - 2 * 2 * 3, 24);
  for (let l = 2; l <= 6; l++)
    for (let w = 2; w <= 6; w++)
      for (let h = 2; h <= 6; h++) {
        assert.equal(visiblePrismCubes(l, w, h), visibleByFaces(l, w, h));
        assert.ok(visiblePrismCubes(l, w, h) < l * w * h);
      }
  const columns = [4, 3, 3, 1];
  let enumerated = 0;
  for (let x = 0; x < columns.length; x++)
    for (let y = 0; y < 2; y++)
      for (let z = 0; z < columns[x]!; z++) {
        const next = x + 1 < columns.length ? columns[x + 1]! : 0;
        if (z === columns[x]! - 1 || y === 1 || z >= next) enumerated++;
      }
  assert.equal(visibleStepCubes(2, columns), enumerated);
  assert.ok(enumerated < 2 * columns.reduce((a, b) => a + b, 0));
});

test("named units on unit-cube-volume keep the classic sentence at version 1", () => {
  const kinds = new Set<string>();
  let classic = 0;
  for (let i = 0; i < 400; i++) {
    const seed = `named-${i}`;
    const current = generateProblem("unit-cube-volume", seed);
    const stored = generateProblem("unit-cube-volume", seed, 1);
    generatedProblemSchema.parse(current);
    generatedProblemSchema.parse(stored);
    assert.equal(current.public.id, stored.public.id);
    assert.equal(stored.public.templateVersion, 1);
    assert.equal(stored.variant?.axes?.units, undefined);
    assert.ok(
      stored.public.prompt === CLASSIC.prism ||
        stored.public.prompt === CLASSIC.steps,
    );
    assert.equal(gradeAnswer(stored, stored.answer), true);
    if (current.variant?.axes?.units == null) {
      classic++;
      assert.equal(current.public.templateVersion, 1);
      assert.deepEqual(current, stored);
      continue;
    }
    const unit = current.variant.axes.units;
    kinds.add(unit);
    assert.equal(current.public.templateVersion, 2);
    const phrase = unitOf(current.public.prompt);
    const joined = [
      current.public.prompt,
      current.public.response.kind === "number"
        ? current.public.response.label
        : "",
      current.hint,
      ...current.explanation,
    ].join(" ");
    assert.equal(joined.includes("cubic units"), false, seed);
    assert.ok(current.public.response.kind === "number");
    assert.ok(current.public.response.label.includes(phrase), seed);
    assert.equal(phrase, unitOf(current.public.prompt));
    if (unit === "ft") assert.match(current.public.prompt, /crate|storage|bale/);
    if (unit === "cm") assert.equal(phrase, "cubic centimeters");
    if (unit === "in") assert.equal(phrase, "cubic inches");
    if (unit === "ft") assert.equal(phrase, "cubic feet");
    if (unit === "improvised")
      assert.ok(
        ["blocks", "sugar cubes", "dice", "ice cubes", "bales"].includes(phrase),
      );
    const figure = current.public.figure!;
    assert.equal(figure.kind, "scene");
    const solid = figure.scene.elements.find((e) => e.type === "isoSolid");
    assert.ok(solid && solid.type === "isoSolid");
    if (solid.solid.form === "cubes") {
      const { length, width, height } = solid.solid;
      assert.ok(length >= 2 && width >= 2 && height >= 2);
      assert.ok(length <= 6 && width <= 6 && height <= 6);
      assert.equal(Number(current.answer), length * width * height);
      assert.ok(length * width * height <= 150);
    } else {
      assert.equal(solid.solid.form, "steps");
      const total =
        solid.solid.width *
        solid.solid.columns.reduce((a, b) => a + b, 0);
      assert.equal(Number(current.answer), total);
      assert.ok(total >= 12 && total <= 45);
    }
    assert.equal(gradeAnswer(current, current.answer), true);
    assert.ok(!current.hint.includes(current.answer) || current.answer.length < 3);
  }
  assert.ok(classic >= 160, `classic ${classic}`);
  assert.deepEqual([...kinds].sort(), ["cm", "ft", "improvised", "in"]);
});

test("named-unit choices use the visible-cube count and the prompt's unit", () => {
  const kinds = new Set<string>();
  for (let i = 0; i < 400; i++) {
    const p = generateProblem("named-unit-cube-choice", `choice-${i}`);
    generatedProblemSchema.parse(p);
    assert.equal(p.public.response.kind, "choice");
    const phrase = unitOf(p.public.prompt);
    kinds.add(p.variant!.id);
    assert.equal(joinedHasCubicUnits(p), false);
    const figure = p.public.figure!;
    assert.equal(figure.kind, "scene");
    const solid = figure.scene.elements.find((e) => e.type === "isoSolid")!;
    assert.ok(solid.type === "isoSolid" && solid.solid.form === "cubes");
    const { length: l, width: w, height: h } = solid.solid;
    const volume = l * w * h;
    const visible = visibleByFaces(l, w, h);
    assert.notEqual(visible, volume);
    const labels = p.public.response.options.map((o) => o.label);
    assert.equal(new Set(labels).size, 4);
    const correct = p.public.response.options.find((o) => o.id === p.answer)!;
    assert.equal(correct.label, `${volume} ${phrase}`);
    assert.ok(labels.includes(`${visible} ${phrase}`));
    assert.ok(labels.some((label) => label.startsWith(`${volume} square`)));
    assert.ok(
      labels.some(
        (label) =>
          label !== correct.label &&
          label.startsWith(`${volume} `) &&
          !label.includes(phrase),
      ),
    );
    if (phrase === "cubic feet")
      assert.match(p.public.prompt, /crate|storage|bale/);
    assert.ok(!p.hint.includes(correct.label));
    assert.equal(gradeAnswer(p, p.answer), true);
    for (const option of p.public.response.options)
      assert.equal(gradeAnswer(p, option.id), option.id === p.answer);
  }
  assert.deepEqual([...kinds].sort(), ["cm", "ft", "improvised", "in"]);
});

function joinedHasCubicUnits(p: {
  public: { prompt: string };
  hint: string;
  explanation: string[];
}) {
  return [p.public.prompt, p.hint, ...p.explanation].join(" ").includes(
    "cubic units",
  );
}

test("packing equals the edge product", async () => {
  const groupings = new Set<string>();
  for (let i = 0; i < 300; i++) {
    const work = generateProblem("pack-equals-product-work", `pack-${i}`);
    generatedProblemSchema.parse(work);
    const figure = work.public.figure!;
    assert.equal(figure.kind, "scene");
    const solid = figure.scene.elements.find((e) => e.type === "isoSolid")!;
    assert.ok(solid.type === "isoSolid" && solid.solid.form === "cubes");
    const { length: l, width: w, height: h } = solid.solid;
    assert.equal(new Set([l, w, h]).size, 3);
    const volume = l * w * h;
    const rows = JSON.parse(work.answer) as string[][];
    assert.deepEqual(rows.slice(0, 4), [
      [String(l * w)],
      [String(h)],
      [String(volume)],
      [String(volume)],
    ]);
    assert.equal(rows[4]![0], "eq");
    assert.equal(gradeAnswer(work, work.answer), true);
    assert.deepEqual(
      missingTargets(layoutScene(figure.scene), figure.scene.steps!),
      [],
    );
    assert.ok(!work.hint.includes(String(volume)));

    const select = generateProblem("pack-equals-product-select", `pack-${i}`);
    generatedProblemSchema.parse(select);
    assert.equal(select.public.response.kind, "multi-select");
    assert.equal(select.public.response.selectionCount, 3);
    const selectSolid = select.public.figure!.kind === "scene"
      ? select.public.figure.scene.elements.find((e) => e.type === "isoSolid")
      : undefined;
    assert.ok(selectSolid && selectSolid.type === "isoSolid" && selectSolid.solid.form === "cubes");
    const selectVolume =
      selectSolid.solid.length * selectSolid.solid.width * selectSolid.solid.height;
    const keyed = JSON.parse(select.answer) as string[];
    assert.equal(keyed.length, 3);
    const chosen = select.public.response.options.filter((o) =>
      keyed.includes(o.id),
    );
    const valueOf = (label: string) => {
      const times = label.replace(/[()]/g, "").split("×").map((part) => Number(part));
      if (label.includes("+") && label.includes("×")) {
        const [prod, add] = label.split("+").map((s) => s.trim());
        const [a, b] = prod!.split("×").map(Number);
        return a! * b! + Number(add);
      }
      if (label.includes("+")) return label.split("+").map(Number).reduce((a, b) => a + b, 0);
      return times.reduce((a, b) => a * b, 1);
    };
    for (const option of select.public.response.options) {
      const value = valueOf(option.label);
      assert.equal(keyed.includes(option.id), value === selectVolume);
      if (!keyed.includes(option.id)) assert.notEqual(value, selectVolume);
      else groupings.add(option.label.replace(/\d+/g, "#"));
      if (keyed.includes(option.id))
        assert.ok(!select.hint.includes(option.label));
    }
    assert.equal(gradeAnswer(select, select.answer), true);

    const picture = generateProblem("pack-equals-product-picture", `pack-${i}`);
    generatedProblemSchema.parse(picture);
    assert.equal(picture.public.response.kind, "figure-choice");
    const asked = /Which solid is (\d+) layers of (\d+) cubes\?/.exec(
      picture.public.prompt,
    );
    assert.ok(asked);
    const layers = Number(asked[1]),
      base = Number(asked[2]);
    let matches = 0;
    for (const option of picture.public.response.options) {
      layoutScene(option.scene);
      const drawn = option.scene.elements.find((e) => e.type === "isoSolid");
      assert.ok(drawn && drawn.type === "isoSolid" && drawn.solid.form === "cubes");
      assert.ok((drawn.solid.lift ?? 0) > 0);
      const product = drawn.solid.length * drawn.solid.width * drawn.solid.height;
      const askedProduct = layers * base;
      const isAsked =
        drawn.solid.height === layers &&
        drawn.solid.length * drawn.solid.width === base;
      if (product === askedProduct) {
        matches++;
        assert.equal(isAsked, true);
        assert.equal(option.id, picture.answer);
      }
      if (option.id === picture.answer) assert.ok(!picture.hint.includes(option.label));
    }
    assert.equal(matches, 1);
    assert.equal(gradeAnswer(picture, picture.answer), true);
  }
  assert.ok(groupings.has("# × (# × #)"));
  assert.ok(groupings.has("(# × #) × #"));
});
