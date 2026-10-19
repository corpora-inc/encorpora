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
    assert.equal(t.requiredFigureCapability, "volume-coordinate-figures-v1");
  const ids = (figureCapabilities: FigureCapability[]) =>
    supportedOfflineTemplates({
      responseCapabilities: ["single-choice-v1"],
      figureCapabilities,
      requestId: "00000000-0000-4000-8000-000000000000",
    }).map((t) => t.id);
  assert.ok(!ids(["measurement-models-v1"]).includes("unit-cube-volume"));
  assert.ok(
    ids(["measurement-models-v1", "volume-coordinate-figures-v1"]).includes(
      "unit-cube-volume",
    ),
  );
});

test("problems are deterministic, valid and never reveal a missing edge", () => {
  for (const t of volumeCoordinateTemplates)
    for (let i = 0; i < 200; i++) {
      const p = generateProblem(t.id, `vc-${i}`);
      assert.deepEqual(p, generateProblem(t.id, `vc-${i}`));
      generatedProblemSchema.parse(p);
      const f = p.public.figure!;
      if (t.id === "prism-missing-edge") {
        assert.equal(f.kind, "box-prism");
        const shown = [f.length, f.width, f.height].map((e) => e?.value);
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
