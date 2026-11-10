import assert from "node:assert/strict";
import test from "node:test";
import { generateProblemFor, templates } from "../src/math/engine.js";
import {
  clientCanDraw,
  figureCapabilities,
  responseCapabilities,
  generatedProblemSchema,
} from "../src/math/contracts.js";
import { sceneCapabilitiesIn } from "../src/math/scene/index.js";
import { problemLesson } from "../src/content/problem-lessons.js";
import { sweepAxes } from "../src/math/number-domain-axes.js";

/** Isolate figure negotiation: every response format, but no scenes-v2. */
const older = {
  responseCapabilities: [...responseCapabilities],
  figureCapabilities: figureCapabilities.filter((c) => c !== "scenes-v2"),
};

test("no template sends a scenes-v2 figure to a client without it", () => {
  for (const template of templates) {
    if (!clientCanDraw(template, older)) {
      assert.equal(template.requiredFigureCapability, "scenes-v2", template.id);
      continue;
    }
    for (let i = 0; i < 6; i++) {
      const problem = generateProblemFor(
        template.id,
        `negotiation:${i}`,
        older.figureCapabilities,
      );
      assert.deepEqual(
        sceneCapabilitiesIn(problem.public),
        [],
        `${template.id} negotiation:${i}`,
      );
    }
  }
});

test("figure-surface axes reach their drawn value for a current client, and the legacy value for an older one", () => {
  const figureAxes = Object.entries(sweepAxes).flatMap(([id, axes]) =>
    Object.values(axes).flatMap((axis) =>
      "needs" in axis && axis.needs ? [{ id, axis }] : [],
    ),
  );
  assert.ok(figureAxes.length >= 6);
  for (const { id, axis } of figureAxes) {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const seed = `surface:${i}`;
      const current = generateProblemFor(id, seed, figureCapabilities);
      generatedProblemSchema.parse(current);
      seen.add(current.variant!.axes![axis.id]!);
      const old = generateProblemFor(id, seed, older.figureCapabilities);
      const value = old.variant!.axes![axis.id]!;
      const needs = (axis.needs as Record<string, string>)[value];
      assert.ok(
        !needs || older.figureCapabilities.includes(needs as never),
        `${id} ${seed}: ${value} sent to a client without ${needs}`,
      );
    }
    assert.deepEqual([...seen].sort(), [...axis.values].sort(), id);
  }
});

test("lesson examples are drawn for the oldest client that can receive the template", () => {
  for (const id of Object.keys(sweepAxes)) {
    const template = templates.find((t) => t.id === id)!;
    const lesson = problemLesson(id, "library");
    const needs = sceneCapabilitiesIn(lesson);
    assert.ok(
      needs.every((c) => template.requiredFigureCapability === c),
      `${id}: lesson needs ${needs.join(", ")}`,
    );
  }
});
