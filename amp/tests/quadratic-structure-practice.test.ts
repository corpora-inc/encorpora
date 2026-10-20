import assert from "node:assert/strict";
import test from "node:test";
import { layoutScene, sceneSchema } from "../src/math/scene/index.js";
import { frameAt, missingTargets } from "../src/math/scene/timeline.js";
import {
  quadraticStructurePrintCase,
  quadraticStructureTemplates,
} from "../src/math/quadratic-structure-practice.js";
import {
  fromRoots,
  shiftWalkthrough,
  syntheticTableau,
  zerosGraph,
} from "../src/math/polynomial-scenes.js";
import { quadraticStructureIllustrations } from "../src/content/quadratic-structure-illustrations.js";

const seeds = Array.from({ length: 120 }, (_, i) => `qs-${i}`);

test("polynomial helpers: expansion from roots and synthetic division", () => {
  assert.deepEqual(fromRoots(1, [-2, 1, 4]), [1, -3, -6, 8]);
  assert.deepEqual(fromRoots(-1, [3, 3]), [-1, 6, -9]);
  const { sums, scene } = syntheticTableau(3, [1, -2, -5, 6], "blank");
  assert.deepEqual(sums, [1, 1, -2, 0]);
  const rows = (scene.elements[0] as { rows: unknown[][] }).rows;
  assert.ok(
    rows.slice(1).every((row) => row.every((c) => c === "")),
    "a problem's working rows are empty",
  );
  const g = zerosGraph(1, [-3, 1, 4]).elements[0] as { x: [number, number] };
  assert.ok(g.x[0] < -3 && g.x[1] > 4);
});

test("the translation walkthrough ends with y = x² moved h across and k up", () => {
  const s = shiftWalkthrough(3, -2, "y = (x - 3)^2 - 2");
  const l = layoutScene(s, { reveal: true });
  assert.deepEqual(missingTargets(l, s.steps!), []);
  const end = frameAt(l, s.steps!, s.steps!.length - 1, 1);
  const moved = Object.entries(end).filter(([id]) =>
    id.startsWith("g.curve.0"),
  );
  assert.ok(moved.length > 0);
  for (const [, st] of moved) {
    assert.ok(Math.abs((st.dx ?? 0) - 3 * l.scale) < 1e-6);
    assert.ok(
      Math.abs((st.dy ?? 0) - 2 * l.scale) < 1e-6,
      "2 down is +2 px-units in y-down space",
    );
  }
});

test("every template is deterministic, has three frames per skill, and valid scenes", () => {
  const frames = new Map<string, Set<string>>();
  for (const t of quadraticStructureTemplates) {
    const tags = new Set<string>();
    for (const seed of seeds) {
      const a = quadraticStructurePrintCase(t.id, seed),
        b = quadraticStructurePrintCase(t.id, seed);
      assert.deepEqual(a.problem, b.problem);
      tags.add(a.tags[0]!);
      const p = a.problem;
      const fig = p.public.figure;
      if (fig?.kind === "scene") {
        assert.equal(sceneSchema.safeParse(fig.scene).success, true);
        assert.equal(fig.scene.steps, undefined, "a problem figure is whole");
        if (p.hintCue)
          assert.deepEqual(
            missingTargets(layoutScene(fig.scene), p.hintCue),
            [],
          );
      }
      if (p.walkthrough?.steps)
        assert.deepEqual(
          missingTargets(
            layoutScene(p.walkthrough, { reveal: true }),
            p.walkthrough.steps,
          ),
          [],
          t.id,
        );
    }
    assert.ok(tags.size >= 3, `${t.id}: ${[...tags]}`);
    const skill = frames.get(t.skillId) ?? new Set();
    for (const tag of tags) skill.add(`${t.id}:${tag}`);
    frames.set(t.skillId, skill);
  }
  for (const [skill, set] of frames) assert.ok(set.size >= 3, skill);
});

test("lesson illustrations validate and lay out", () => {
  for (const [kind, scene] of Object.entries(quadraticStructureIllustrations)) {
    assert.equal(sceneSchema.safeParse(scene).success, true, kind);
    const l = layoutScene(scene, { reveal: true });
    if (scene.steps) assert.deepEqual(missingTargets(l, scene.steps), [], kind);
  }
});
