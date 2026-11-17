import assert from "node:assert/strict";
import test from "node:test";
import { generateProblem, templates } from "../src/math/engine.js";
import {
  pointPlotScene,
  type PointPlotResponse,
} from "../src/math/point-plot.js";
import type { Scene } from "../src/math/scene/index.js";

/**
 * Given vertices are labeled points; edges between them are opt-in. QA
 * 2026-11-17: "Three vertices of rectangle ABCD are A(−8,2), C(−4,−8),
 * D(−8,−8)" drew A→C→D in listed order, and A→C is the rectangle's
 * diagonal. A shape to complete shows its corners and nothing else, in the
 * prompt and in the answer overlay alike.
 */
const segmentsBetween = (scene: Scene, r: PointPlotResponse) => {
  const at = new Set(r.given!.vertices.map((v) => `${v.x},${v.y}`));
  return scene.elements.flatMap((e) =>
    e.type === "graph"
      ? (e.segments ?? []).filter(
          (s) =>
            at.has(`${s.from[0]},${s.from[1]}`) &&
            at.has(`${s.to[0]},${s.to[1]}`),
        )
      : [],
  );
};

const plots = (id: string, n = 40) =>
  Array.from({ length: n }, (_, i) => generateProblem(id, `edges-${i}`).public)
    .map((p) => p.response)
    .filter(
      (r): r is PointPlotResponse => r.kind === "point-plot" && !!r.given,
    );

test("missing-vertex draws the three given corners and no edge between them", () => {
  const rs = plots("missing-vertex");
  assert.ok(rs.length > 0);
  for (const r of rs) {
    assert.equal(r.given!.vertices.length, 3);
    for (const scene of [
      pointPlotScene(r),
      pointPlotScene(r, { answer: [[0, 0]] }),
    ]) {
      assert.deepEqual(segmentsBetween(scene, r), []);
      const graph = scene.elements.find((e) => e.type === "graph");
      assert.ok(graph?.type === "graph");
      assert.deepEqual(
        (graph.points ?? [])
          .filter((p) => p.label)
          .map((p) => p.label)
          .sort(),
        r.given!.vertices.map((v) => v.label).sort(),
      );
    }
  }
});

test("every point plot draws edges between given vertices only when it asks for them", () => {
  for (const t of templates) {
    let rs: PointPlotResponse[];
    try {
      rs = plots(t.id, 6);
    } catch {
      continue; // Templates that need a client capability are covered elsewhere.
    }
    for (const r of rs) {
      const drawn = segmentsBetween(pointPlotScene(r), r).length;
      if (!r.given!.closed && !r.given!.edges)
        assert.equal(drawn, 0, `${t.id}: given vertices are points only`);
      else
        assert.ok(
          drawn > 0 || r.given!.vertices.length < 2,
          `${t.id}: edges drawn`,
        );
    }
  }
});
