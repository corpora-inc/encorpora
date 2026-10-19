import assert from "node:assert/strict";
import test from "node:test";
import { layoutScene, sceneSchema } from "../src/math/scene/index.js";
import { missingTargets } from "../src/math/scene/timeline.js";
import {
  completeSquareTiles,
  parabolaWindow,
  ratio,
  vertexGraph,
} from "../src/math/quadratic-scenes.js";
import { completingSquareTemplates } from "../src/math/completing-square-practice.js";
import { generateProblem } from "../src/math/engine.js";

test("exact vertex labels and a window holding the vertex and the origin", () => {
  assert.deepEqual(ratio(-6, 4), { label: "−3/2", tex: "-\\frac{3}{2}" });
  assert.deepEqual(ratio(8, -4), { label: "−2", tex: "-2" });
  for (const [a, b, c] of [
    [1, 3, 3],
    [-3, 6, -3],
    [2, -4, -6],
    [5, 17, -20],
  ] as const) {
    const w = parabolaWindow(a, b, c);
    assert.ok(w.x[0] < w.vx && w.vx < w.x[1] && w.x[0] < 0 && w.x[1] > 0);
    assert.ok(w.y[0] < w.vy && w.vy < w.y[1] && w.y[0] < 0 && w.y[1] > 0);
    assert.ok((w.y[1] - w.y[0]) / w.grid <= 60);
    const scene = vertexGraph(a, b, c, "p", "q");
    const l = layoutScene(scene, { reveal: true });
    assert.deepEqual(missingTargets(l, scene.steps!), []);
    const label = l.items.find((d) => d.id === "g.point.0.label");
    assert.ok(label?.k === "text" && label.plain.startsWith("("));
    const masked = layoutScene(scene).items.find(
      (d) => d.id === "g.point.0.label",
    );
    assert.ok(
      masked?.k === "text" && masked.masked,
      "the vertex is unknown in a problem",
    );
  }
});

test("completing-square tiles: x + b/2 on both sides with the corner missing", () => {
  assert.throws(() => completeSquareTiles(7));
  assert.throws(() => completeSquareTiles(0));
  const s = completeSquareTiles(-6);
  const tiles = s.elements[0]!;
  assert.ok(tiles.type === "polyArea");
  assert.deepEqual(tiles.across, [
    [1, 1],
    [-3, 0],
  ]);
  assert.deepEqual(tiles.missing, [[1, 1]]);
  assert.deepEqual(missingTargets(layoutScene(s), s.steps!), []);
  assert.equal(completeSquareTiles(8, false).steps, undefined);
});

test("completing-square templates: three frames, a valid tile frame and walkthroughs", () => {
  for (const t of completingSquareTemplates) {
    const frames = new Set<string>();
    for (let i = 0; i < 80; i++) {
      const p = generateProblem(t.id, `cs-${i}`);
      frames.add(p.public.prompt.split(" ")[0]!);
      const figure = p.public.figure;
      if (figure) {
        assert.equal(figure.kind, "scene");
        if (figure.kind !== "scene") continue;
        assert.equal(
          figure.scene.steps,
          undefined,
          "a problem shows the whole figure",
        );
        assert.match(p.public.prompt, /^The tiles show/);
        assert.deepEqual(
          missingTargets(layoutScene(figure.scene), p.hintCue!),
          [],
        );
        assert.ok(!JSON.stringify(figure).includes(`"${p.answer}"`));
      }
      if (p.walkthrough) {
        assert.equal(sceneSchema.safeParse(p.walkthrough).success, true);
        const l = layoutScene(p.walkthrough, { reveal: true });
        assert.deepEqual(missingTargets(l, p.walkthrough.steps!), []);
      }
    }
    assert.equal(frames.size, 3, t.id);
  }
});
