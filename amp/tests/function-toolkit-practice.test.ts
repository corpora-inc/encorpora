import assert from "node:assert/strict";
import test from "node:test";
import { layoutScene, sceneSchema } from "../src/math/scene/index.js";
import { frameAt, missingTargets } from "../src/math/scene/timeline.js";
import {
  functionToolkitPrintCase,
  functionToolkitTemplates,
} from "../src/math/function-toolkit-practice.js";
import {
  inPiece,
  machineScene,
  pieceAt,
  transformWalkthrough,
  type Piece,
} from "../src/math/function-toolkit-scenes.js";
import { functionToolkitIllustrations } from "../src/content/function-toolkit-illustrations.js";
import { templateRole } from "../src/learning/placement.js";

const seeds = Array.from({ length: 120 }, (_, i) => `ft-${i}`);

test("pieces: each input lies in exactly one piece", () => {
  const pieces: Piece[] = [
    { m: 2, b: 1, lo: null, hi: 2, loIn: false, hiIn: false },
    { m: -1, b: 7, lo: 2, hi: null, loIn: true, hiIn: false },
  ];
  for (const x of [-3, 1.9, 2, 2.1, 6])
    assert.equal(pieces.filter((p) => inPiece(p, x)).length, 1, String(x));
  assert.equal(pieceAt(pieces[1]!, 2), 5);
  assert.equal(inPiece(pieces[0]!, 2), false, "the open end excludes 2");
});

test("the transformation walkthrough slides h, stretches through flat, and lifts k", () => {
  const s = transformWalkthrough("square", -2, 1, 3, "x^2", "-2(x - 1)^2 + 3");
  const l = layoutScene(s, { reveal: true });
  assert.deepEqual(missingTargets(l, s.steps!), []);
  // Stretch frames 0, −1, −2 replace the parent one after another.
  const g = s.elements[0] as { curves: { fn: { c?: number[] } }[] };
  assert.equal(g.curves.length, 4);
  const end = frameAt(l, s.steps!, s.steps!.length - 1, 1);
  // The parent moved 1 right, then faded out; the final curve moved 3 up.
  const parent = Object.entries(end).filter(([id]) =>
    id.startsWith("g.curve.0"),
  );
  assert.ok(parent.every(([, st]) => st.opacity === 0));
  const last = Object.entries(end).filter(([id]) => id.startsWith("g.curve.3"));
  assert.ok(last.length > 0);
  for (const [, st] of last)
    assert.ok(Math.abs((st.dy ?? 0) + 3 * l.scale) < 1e-6);
});

test("the composition machine carries the input through g, then f", () => {
  const s = machineScene(
    { name: "g", rule: "g(x) = x^2 + 1" },
    { name: "f", rule: "f(x) = 2x - 3" },
    ["3", "10", "17"],
    true,
  );
  const l = layoutScene(s, { reveal: true });
  assert.deepEqual(missingTargets(l, s.steps!), []);
  const end = frameAt(l, s.steps!, s.steps!.length - 1, 1);
  assert.ok(
    Math.abs((end.token?.dx ?? 0) - 13.6 * l.scale) < 1e-6,
    "token reaches the output",
  );
  // A problem's machine shows only the input.
  const problem = machineScene(
    { name: "g", rule: "g(x) = x^2 + 1" },
    { name: "f", rule: "f(x) = 2x - 3" },
    ["3", null, null],
  );
  const texts = problem.elements.flatMap((e) =>
    e.type === "text" ? [e.text] : [],
  );
  assert.ok(!texts.includes("10") && !texts.includes("17"));
});

test("every template is deterministic, has three frames per skill, valid scenes, and is an assessment item", () => {
  const frames = new Map<string, Set<string>>();
  for (const t of functionToolkitTemplates) {
    assert.equal(templateRole(t.id), "assessment");
    const tags = new Set<string>();
    for (const seed of seeds) {
      const a = functionToolkitPrintCase(t.id, seed),
        b = functionToolkitPrintCase(t.id, seed);
      assert.deepEqual(a.problem, b.problem);
      tags.add(a.tags[0]!);
      const p = a.problem;
      const fig = p.public.figure;
      if (fig?.kind === "scene") {
        assert.equal(sceneSchema.safeParse(fig.scene).success, true);
        assert.equal(fig.scene.steps, undefined, "a problem figure is whole");
        // No value the learner finds is carried in the public figure.
        if (p.public.response.kind !== "choice")
          assert.ok(
            !JSON.stringify(fig.scene).includes('"derived":true'),
            `${t.id}: derived labels stay in the walkthrough`,
          );
        if (p.hintCue)
          assert.deepEqual(
            missingTargets(layoutScene(fig.scene), p.hintCue),
            [],
            t.id,
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
  assert.equal(frames.size, 5);
  for (const [skill, set] of frames) assert.ok(set.size >= 3, skill);
});

test("lesson illustrations validate, lay out and play", () => {
  for (const [kind, scene] of Object.entries(functionToolkitIllustrations)) {
    assert.equal(sceneSchema.safeParse(scene).success, true, kind);
    const l = layoutScene(scene, { reveal: true });
    if (scene.steps) assert.deepEqual(missingTargets(l, scene.steps), [], kind);
  }
});
