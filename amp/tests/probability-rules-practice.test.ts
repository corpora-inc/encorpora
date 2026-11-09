import assert from "node:assert/strict";
import test from "node:test";
import {
  probabilityRulesCase,
  probabilityRulesTemplates,
} from "../src/math/probability-rules-practice.js";
import { generateProblem, gradeAnswer } from "../src/math/engine.js";
import { semanticFigureSchema } from "../src/math/contracts.js";
import { templateRole } from "../src/learning/placement.js";
import { layoutScene } from "../src/math/scene/index.js";
import { captionText, missingTargets } from "../src/math/scene/timeline.js";
import { lessonScenes } from "../src/content/lesson-scenes.js";

const SEEDS = 200;
const cases = (id: string) =>
  Array.from({ length: SEEDS }, (_, i) => probabilityRulesCase(id, `t-${i}`));

test("each probability problem type is deterministic, scene-gated and an assessment item", () => {
  for (const t of probabilityRulesTemplates) {
    assert.equal(t.requiredFigureCapability, "scenes-v1");
    assert.equal(templateRole(t.id), "assessment");
    assert.deepEqual(
      generateProblem(t.id, "same"),
      generateProblem(t.id, "same"),
    );
  }
});

test("every skill is practiced in at least three prompt frames", () => {
  const frames: Record<string, string[]> = {
    "event-set-count": ["listed", "totals", "probability", "symbols", "words"],
    "addition-rule-probability": [
      "counts",
      "cards",
      "formula",
      "overlap-unknown",
    ],
    "conditional-probability-value": ["table", "venn", "listed", "formula"],
    "multiplication-rule-probability": ["marbles", "tree", "cards", "formula"],
  };
  for (const [id, needed] of Object.entries(frames)) {
    const seen = new Set(cases(id).flatMap((c) => c.tags));
    for (const tag of needed) assert.ok(seen.has(tag), `${id} lacks ${tag}`);
  }
  const tree = new Set(
    cases("multiplication-rule-probability").flatMap((c) => c.tags),
  );
  assert.ok(tree.has("total") && tree.has("joint"));
  const table = new Set(
    cases("conditional-probability-value").flatMap((c) => c.tags),
  );
  assert.ok(table.has("given-row") && table.has("given-column"));
});

test("answers are exact, graded in either form, and never sit in the figure", () => {
  for (const t of probabilityRulesTemplates)
    for (const { problem } of cases(t.id)) {
      const [n, d = "1"] = problem.answer.split("/");
      assert.ok(Number(d) > 0 && Number.isInteger(Number(n)));
      if (problem.public.response.kind === "fraction") {
        assert.ok(Number(n) / Number(d) >= 0 && Number(n) / Number(d) <= 1);
        // A terminating decimal is accepted for the same value.
        const value = Number(n) / Number(d);
        if (Number.isFinite(value) && /^\d+(\.\d{1,4})?$/.test(String(value)))
          assert.ok(gradeAnswer(problem, String(value)), problem.answer);
      }
      const figure = problem.public.figure;
      if (!figure) continue;
      assert.equal(semanticFigureSchema.safeParse(figure).success, true);
      assert.equal(figure.kind, "scene");
      if (figure.kind !== "scene") continue;
      // A region asked about from totals is unlabeled in the figure.
      if (problem.public.prompt.startsWith("Of ")) {
        const v = figure.scene.elements[0]!;
        assert.ok(v.type === "venn");
        if (v.type === "venn")
          for (const region of ["a", "b"] as const)
            assert.equal(v.regions?.[region], null);
      }
      assert.ok(layoutScene(figure.scene).items.length > 0);
      assert.ok(!JSON.stringify(figure).includes('"?"'));
    }
});

test("counts and probabilities agree with the figure the learner sees", () => {
  for (const { problem } of cases("event-set-count")) {
    const f = problem.public.figure;
    if (f?.kind !== "scene" || !problem.public.prompt.startsWith("The Venn"))
      continue;
    const venn = f.scene.elements[0]!;
    assert.equal(venn.type, "venn");
    if (venn.type !== "venn") continue;
    const r = venn.regions!;
    const n = Number(/sorts (\d+)/.exec(problem.public.prompt)![1]);
    assert.equal(Number(r.a) + Number(r.ab) + Number(r.b) + Number(r.none), n);
  }
});

test("walkthroughs name real elements, and hint captions never state the answer", () => {
  const plainAnswer = (answer: string) => {
    const [n, d = 1] = answer.split("/").map(Number);
    const out = [answer];
    const v = n! / d!;
    if (/^\d+(\.\d+)?$/.test(String(v))) out.push(String(v));
    return out;
  };
  let walkthroughs = 0;
  for (const t of probabilityRulesTemplates)
    for (const { problem } of cases(t.id)) {
      const f = problem.public.figure;
      if (f?.kind !== "scene" || !f.scene.steps) continue;
      walkthroughs++;
      for (const reveal of [false, true]) {
        const layout = layoutScene(f.scene, { reveal });
        assert.deepEqual(missingTargets(layout, f.scene.steps), [], t.id);
      }
      // No caption, in a hint or a lesson, states the answer unless the
      // prompt does; every masked label reads "?".
      const masked = layoutScene(f.scene);
      for (const s of f.scene.steps) {
        const caption = captionText(masked, s.caption);
        for (const a of plainAnswer(problem.answer))
          assert.ok(
            !new RegExp(`(?<![\\d/.])${a.replace(".", "\\.")}(?![\\d/])`).test(
              caption,
            ) || problem.public.prompt.includes(a),
            `${t.id}: "${caption}" states ${a}`,
          );
      }
      for (const d of masked.items)
        if (d.k === "text" && d.masked) assert.equal(d.plain, "?");
    }
  assert.ok(walkthroughs > 400);
});

test("lesson scenes play only on elements they draw", () => {
  for (const [kind, scene] of Object.entries(lessonScenes)) {
    if (!scene.steps) continue;
    assert.deepEqual(
      missingTargets(layoutScene(scene, { reveal: true }), scene.steps),
      [],
      kind,
    );
  }
});

const words = (text: string) =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

test("clause tasks keep a fraction in [0, 1] and version 1 omits the new wording", () => {
  const markers = [
    ["conditional-probability-value", "Build the two-way table"],
    ["conditional-probability-value", "what fraction also"],
    ["addition-rule-probability", "at least one"],
    ["multiplication-rule-probability", "band given the bus"],
    ["multiplication-rule-probability", "no rain and a late bus"],
  ] as const;
  const seen = new Map<string, number>();
  for (let i = 0; i < 160; i++) {
    for (const id of [
      "conditional-probability-value",
      "addition-rule-probability",
      "multiplication-rule-probability",
    ]) {
      const old = generateProblem(id, `clause:${i}`, 1);
      for (const [, marker] of markers.filter(([name]) => name === id))
        assert.equal(old.public.prompt.includes(marker), false, marker);
      const problem = generateProblem(id, `clause:${i}`);
      const hit = markers.find(
        ([name, marker]) =>
          name === id && problem.public.prompt.includes(marker),
      );
      if (!hit) continue;
      seen.set(hit[1], (seen.get(hit[1]) ?? 0) + 1);
      assert.equal(problem.variant?.id === undefined, false);
      assert.equal(problem.public.response.kind, "fraction");
      const [n, d = "1"] = problem.answer.split("/");
      const value = Number(n) / Number(d);
      assert.ok(value > 0 && value < 1, problem.answer);
      assert.equal(problem.hint.includes(problem.answer), false);
      for (const text of [
        problem.public.prompt,
        problem.hint,
        ...problem.explanation,
      ])
        for (const sentence of words(text))
          assert.ok(
            sentence.split(/\s+/).length <= 35,
            `${id}: ${sentence}`,
          );
      if (hit[1] === "Build the two-way table") {
        const m =
          /A survey of (\d+) .+ gives two facts\. (\d+) are .+ and the rest are .+\. (\d+) .+, including (\d+)/.exec(
            problem.public.prompt,
          )!;
        const N = Number(m[1]);
        const R = Number(m[2]);
        const C = Number(m[3]);
        const X = Number(m[4]);
        const cell = C - X;
        const rest = N - R;
        assert.notEqual(X * rest, R * cell);
        assert.equal(problem.answer, reduce(cell, rest));
      }
    }
  }
  for (const [, marker] of markers) assert.ok((seen.get(marker) ?? 0) > 0, marker);
});

function reduce(n: number, d: number) {
  let a = n;
  let b = d;
  while (b) [a, b] = [b, a % b];
  const g = a || 1;
  return d / g === 1 ? `${n / g}` : `${n / g}/${d / g}`;
}
