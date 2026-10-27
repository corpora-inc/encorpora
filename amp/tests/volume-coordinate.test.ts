import { test } from "node:test";
import assert from "node:assert/strict";
import { generateProblem, generateProblemFor } from "../src/math/engine";
import {
  figureCapabilities,
  generatedProblemSchema,
  type FigureCapability,
} from "../src/math/contracts";
import { volumeCoordinateTemplates } from "../src/math/volume-coordinate-practice";
import { supportedOfflineTemplates } from "../src/offline/repository";
import { templateRole } from "../src/learning/placement";

test("geometry figures reach only clients that declare them", () => {
  for (const t of volumeCoordinateTemplates)
    assert.equal(t.requiredFigureCapability, "scenes-v1");
  const ids = (figureCapabilities: FigureCapability[]) =>
    supportedOfflineTemplates({
      responseCapabilities: ["single-choice-v1"],
      figureCapabilities,
      requestId: "00000000-0000-4000-8000-000000000000",
    }).map((t) => t.id);
  assert.ok(!ids(["measurement-models-v1"]).includes("unit-cube-volume"));
  assert.ok(
    ids(["measurement-models-v1", "scenes-v1"]).includes("unit-cube-volume"),
  );
});

test("problems are deterministic, valid and never reveal a missing edge", () => {
  for (const t of volumeCoordinateTemplates)
    for (let i = 0; i < 200; i++) {
      const p = generateProblem(t.id, `vc-${i}`);
      assert.deepEqual(p, generateProblem(t.id, `vc-${i}`));
      generatedProblemSchema.parse(p);
      const f = p.public.figure!;
      assert(f.kind === "scene");
      if (t.id === "prism-missing-edge") {
        const e = f.scene.elements.find((x) => x.type === "isoSolid")!;
        assert(e.type === "isoSolid" && e.solid.form === "box");
        const shown = [e.solid.length, e.solid.width, e.solid.height].map(
          (x) => x?.value,
        );
        assert.equal(shown.filter((v) => v === undefined).length, 1);
      }
    }
});

test("only the layer count is a method step", () => {
  for (const t of volumeCoordinateTemplates)
    assert.equal(
      templateRole(t.id),
      t.id === "cube-layer-count" ? "scaffold" : "assessment",
    );
});

test("cubes fill the prism layer by layer, and the walk goes across then up", async () => {
  const { layoutScene } = await import("../src/math/scene");
  const { missingTargets, visibleSteps } =
    await import("../src/math/scene/timeline");
  for (let i = 0; i < 40; i++) {
    for (const id of ["unit-cube-volume", "cube-layer-count"]) {
      const p = generateProblem(id, `walk-${i}`);
      if (p.variant?.axes?.solid === "steps") continue;
      const f = p.public.figure!;
      assert(f.kind === "scene");
      const e = f.scene.elements.find((x) => x.type === "isoSolid")!;
      assert(e.type === "isoSolid" && e.solid.form === "cubes");
      const steps = f.scene.steps!;
      assert.equal(steps.length, e.solid.height);
      assert.deepEqual(missingTargets(layoutScene(f.scene), steps), []);
      // Running totals are derived: "?" in a problem, the count in a lesson.
      const plain = (reveal: boolean) =>
        layoutScene(f.scene, { reveal }).items.flatMap((d) =>
          d.k === "text" ? [d.plain] : [],
        );
      assert.ok(plain(false).every((t) => t === "?"));
      assert.ok(plain(true).includes(p.answer));
      assert.ok(!JSON.stringify(f).includes(`"${p.answer}"`));
    }
    const p = generateProblem("first-quadrant-coordinates", `walk-${i}`);
    const f = p.public.figure!;
    assert(f.kind === "scene");
    const steps = f.scene.steps!;
    assert.deepEqual(missingTargets(layoutScene(f.scene), steps), []);
    assert.equal(visibleSteps(steps, "hint").length, 1);
  }
});

test("unit-cube volume draws a prism or a stepped solid, and only scenes-v2 clients get the steps", async () => {
  const { describeScene, layoutScene, sceneCapabilitiesIn } =
    await import("../src/math/scene");
  const older = figureCapabilities.filter((c) => c !== "scenes-v2");
  const reached = new Set<string>();
  const totals = new Set<number>();
  for (let i = 0; i < 300; i++) {
    const seed = `steps-${i}`;
    const p = generateProblem("unit-cube-volume", seed);
    generatedProblemSchema.parse(p);
    const solid = p.variant!.axes!.solid!;
    reached.add(solid);
    const f = p.public.figure!;
    assert(f.kind === "scene");
    const e = f.scene.elements.find((x) => x.type === "isoSolid")!;
    assert(e.type === "isoSolid");
    // An older client never receives a stepped solid; its problem is the
    // legacy prism for the same seed.
    const old = generateProblemFor("unit-cube-volume", seed, older);
    assert.equal(old.variant!.axes!.solid, "prism");
    assert.deepEqual(sceneCapabilitiesIn(old.public), []);
    if (solid !== "steps") {
      assert.equal(e.solid.form, "cubes");
      assert.deepEqual(old, p);
      continue;
    }
    assert(e.solid.form === "steps");
    assert.deepEqual(sceneCapabilitiesIn(p.public), ["scenes-v2"]);
    assert.deepEqual(
      generateProblemFor("unit-cube-volume", seed, figureCapabilities),
      p,
    );
    // The answer is the cubes the figure holds: depth times the column sum.
    const { width, columns } = e.solid;
    const total = width * columns.reduce((a, b) => a + b, 0);
    assert.equal(p.answer, String(total));
    totals.add(total);
    assert.ok(total >= 12 && total <= 45, `total ${total}`);
    assert.ok(columns.length >= 3 && columns.length <= 5 && width <= 4);
    assert.ok(columns.every((h) => h <= 5));
    // The total is never stated in the public problem, figure description
    // or hint.
    const said = `${p.public.prompt} ${describeScene(f.scene)} ${p.hint}`;
    assert.doesNotMatch(said, new RegExp(`(?<!\\d)${total}(?!\\d)`));
    // Countable on a phone: a cube edge is at least 22 px at 288 px.
    const l = layoutScene({ ...f.scene, width: 288 });
    assert.ok(l.scale >= 22, `scale ${l.scale}`);
    assert.match(p.explanation.at(-1)!, new RegExp(`= ${total}\\$`));
  }
  assert.deepEqual([...reached].sort(), ["prism", "steps"]);
  assert.ok(totals.size >= 10);
});
