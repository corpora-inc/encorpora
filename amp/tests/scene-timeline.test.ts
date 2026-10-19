import assert from "node:assert/strict";
import test from "node:test";
import { layoutScene, type Scene } from "../src/math/scene/index.js";
import { act, numberLine, step, lessonStep } from "../src/math/scene/author.js";
import {
  captionText,
  cubicBezier,
  frameAt,
  missingTargets,
  stepsSchema,
  visibleSteps,
} from "../src/math/scene/timeline.js";
import {
  makeTenHops,
  partialProducts,
} from "../src/math/scene/explanations.js";
import { generateProblem } from "../src/math/engine.js";
import { generatedProblemSchema } from "../src/math/contracts.js";

const hopScene = numberLine({ id: "nl", min: 0, max: 20 })
  .mark(8)
  .hop(8, 5)
  .scene({
    steps: [
      step("Start at 8.", act.highlight("nl.mark.0")),
      step("Jump 5.", act.trace("nl.hop.0")),
      lessonStep("8 + 5 = {nl.hop.0.landing}", act.count("nl.hop.0.landing")),
    ],
  });

test("start frame hides entrances; the final frame is the whole figure", () => {
  const l = layoutScene(hopScene, { reveal: true });
  const steps = hopScene.steps!;
  const start = frameAt(l, steps, -1, 0);
  assert.equal(start["nl.hop.0"]!.opacity, 0);
  assert.equal(start["nl.hop.0.head"]!.opacity, 0);
  assert.equal(start["nl.hop.0.landing"]!.opacity, 0);
  assert.equal(start["nl.mark.0"], undefined);
  const mid = frameAt(l, steps, 1, 0.5);
  assert.equal(mid["nl.hop.0"]!.drawn, 0.5);
  assert.equal(mid["nl.hop.0.head"]!.opacity, 0);
  assert.equal(frameAt(l, steps, 0, 1)["nl.mark.0"]!.highlight, true);
  // Highlight lasts only for its own step.
  assert.equal(frameAt(l, steps, 1, 1)["nl.mark.0"]?.highlight, undefined);
  const counting = frameAt(l, steps, 2, 0.5)["nl.hop.0.landing"]!;
  assert.equal(counting.text, "7");
  const end = frameAt(l, steps, 2, 1);
  assert.equal(end["nl.hop.0"]!.drawn, 1);
  assert.equal(end["nl.hop.0.landing"]?.text, undefined);
});

test("a move is math units times the fitted scale, y up", () => {
  const s: Scene = {
    ...hopScene,
    steps: [step("Shift.", act.move("nl.mark.0", [2, 1]))],
  };
  const l = layoutScene(s);
  const st = frameAt(l, s.steps!, 0, 1)["nl.mark.0"]!;
  assert.ok(Math.abs(st.dx! - 2 * l.scale) < 1e-9);
  assert.ok(Math.abs(st.dy! + 1 * l.scale) < 1e-9);
});

test("hints stop before lesson steps and keep their entrances hidden", () => {
  const l = layoutScene(hopScene);
  const hint = visibleSteps(hopScene.steps!, "hint");
  assert.equal(hint.length, 2);
  const s: Scene = {
    ...hopScene,
    steps: [
      step("Start.", act.highlight("nl.mark.0")),
      lessonStep("Land.", act.appear("nl.hop.0")),
    ],
  };
  const hidden = frameAt(
    layoutScene(s),
    visibleSteps(s.steps!, "hint"),
    0,
    1,
    s.steps,
  );
  assert.equal(hidden["nl.hop.0"]!.opacity, 0);
  assert.equal(captionText(l, "8 + 5 = {nl.hop.0.landing}"), "8 + 5 = ?");
  assert.equal(
    captionText(layoutScene(hopScene, { reveal: true }), "{nl.hop.0.landing}"),
    "13",
  );
});

test("cues are validated against the scene they target", () => {
  const l = layoutScene(hopScene);
  assert.deepEqual(
    missingTargets(l, [step("x", act.highlight("nl.hop.0"))]),
    [],
  );
  assert.deepEqual(missingTargets(l, [step("x", act.highlight("nl.hop.9"))]), [
    "nl.hop.9",
  ]);
  assert.equal(
    stepsSchema.safeParse([
      { caption: "x", actions: [{ do: "explode", target: "a" }] },
    ]).success,
    false,
  );
  assert.equal(
    stepsSchema.safeParse([
      { caption: "x", actions: [{ do: "trace", target: "a b" }] },
    ]).success,
    false,
  );
});

test("easing follows the CSS curve", () => {
  const ease = cubicBezier("cubic-bezier(0.22, 0.7, 0.18, 1)");
  assert.equal(ease(0), 0);
  assert.equal(ease(1), 1);
  assert.ok(ease(0.5) > 0.8);
  const linear = cubicBezier("cubic-bezier(0, 0, 1, 1)");
  assert.ok(Math.abs(linear(0.3) - 0.3) < 1e-6);
});

const numbers = (text: string): string[] => text.match(/\d+/g) ?? [];
for (const id of [
  "add-within-20",
  "tens-contribution",
  "number-line-hops",
  "number-line-missing-hop",
]) {
  test(`${id}: the learner's scene walks its own numbers and never shows the answer`, () => {
    for (let i = 0; i < 300; i++) {
      const p = generateProblem(id, `scene-${i}`);
      assert.equal(generatedProblemSchema.safeParse(p).success, true);
      const f = p.public.figure;
      assert.ok(f?.kind === "scene");
      const scene = f.scene;
      const masked = layoutScene(scene);
      const revealed = layoutScene(scene, { reveal: true });
      assert.deepEqual(missingTargets(masked, scene.steps!), []);
      const given = new Set(numbers(p.public.prompt));
      // Hint captions and every masked derived label stay free of the answer
      // unless the prompt itself states that number.
      const steps = p.hintCue ?? visibleSteps(scene.steps!, "hint");
      if (p.hintCue) assert.deepEqual(missingTargets(masked, p.hintCue), []);
      for (const s of steps) {
        const caption = captionText(masked, s.caption);
        if (!given.has(p.answer))
          assert.ok(
            !numbers(caption).includes(p.answer),
            `${id} ${i}: ${caption}`,
          );
      }
      for (const d of masked.items)
        if (d.k === "text" && d.masked) assert.equal(d.plain, "?");
      assert.ok(!JSON.stringify(f).includes(`"${p.answer}"`));
      // The revealed final caption states the result.
      const final = captionText(revealed, scene.steps!.at(-1)!.caption);
      assert.ok(!final.includes("?"), final);
    }
  });
}

test("make ten splits the jump at 10, and area models split by place value", () => {
  const s = makeTenHops(8, 5);
  assert.deepEqual(
    s.elements[0]!.type === "numberLine" &&
      s.elements[0]!.hops!.map((h) => [h.from, h.by]),
    [
      [8, 2],
      [10, 3],
    ],
  );
  assert.equal(makeTenHops(12, 5).steps!.length, 3);
  const a = partialProducts(34, 6);
  assert.deepEqual(
    a.elements[0]!.type === "areaModel" && a.elements[0]!.across,
    [30, 4],
  );
  assert.equal(
    captionText(layoutScene(a, { reveal: true }), a.steps!.at(-1)!.caption),
    "Join the parts: 34 × 6 = 180 + 24",
  );
});
