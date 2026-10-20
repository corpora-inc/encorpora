import { test } from "node:test";
import assert from "node:assert/strict";
import { generateProblem } from "../src/math/engine";
import {
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
