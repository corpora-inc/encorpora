import assert from "node:assert/strict";
import test from "node:test";
import { generateProblem, templates } from "../src/math/engine";
import { clientCanDraw } from "../src/math/contracts";
import { proofConstructionCase } from "../src/math/geometry-proof-families";
import { satGeometryDataCase } from "../src/math/sat-geometry-data-practice";
import { obliqueCase } from "../src/math/trigonometry-practice";
import { triangleLawCase } from "../src/math/remaining-gap-practice";
import { polynomialGraphMatchCase } from "../src/math/function-behavior-practice";
import { describeScene, layoutScene, sceneSchema } from "../src/math/scene";
import type { Scene } from "../src/math/scene";

/** Teaching figures for geometry and trigonometry: each shows the prompt's
 * givens exactly, masks the unknown, and never carries the answer. */

const FIGURED = [
  "circle-segment-lengths",
  "oblique-triangle-solve",
  "triangle-law-reasoning",
  "tangent-circle-computation",
  "triangle-circle-centers",
  "inscribed-polygon-reasoning",
  "parallelogram-property-consequences",
  "triangle-theorem-consequences",
  "line-angle-proof-reasons",
  "polynomial-graph-match",
] as const;

const labelsOf = (node: unknown): string[] => {
  if (Array.isArray(node)) return node.flatMap(labelsOf);
  if (node && typeof node === "object")
    return Object.entries(node).flatMap(([key, value]) =>
      key === "label" && value === null
        ? ["?"]
        : (key === "text" || key === "label") && typeof value === "string"
          ? [value]
          : key === "title" || key === "note"
            ? []
            : labelsOf(value),
    );
  return [];
};
const ints = (text: string) => new Set(text.replace(/−/g, "-").match(/\d+/g));
const sceneOf = (id: string, seed: string): Scene | undefined => {
  const p = generateProblem(id, seed);
  return p.public.figure?.kind === "scene" ? p.public.figure.scene : undefined;
};

test("figured templates need scene capability; old clients are never sent them", () => {
  for (const id of FIGURED) {
    const t = templates.find((x) => x.id === id)!;
    assert.equal(t.version, 1);
    assert.equal(t.requiredFigureCapability, "scenes-v1", id);
    assert.ok(
      !clientCanDraw(t, {
        responseCapabilities: ["single-choice-v1"],
        figureCapabilities: [],
      }),
      id,
    );
  }
});

test("figures leave prompts, answers and choices exactly as before per seed", () => {
  // The figure is derived from the generated values and draws no random
  // numbers, so the same (id, version, seed) keeps its prompt, key and choices.
  for (const id of FIGURED.filter((x) => x !== "polynomial-graph-match"))
    for (let i = 0; i < 40; i++) {
      const one = generateProblem(id, `fig:${i}`);
      const two = generateProblem(id, `fig:${i}`);
      assert.deepEqual(one, two);
      assert.equal(one.public.templateVersion, 1);
    }
});

for (const id of FIGURED) {
  test(`${id}: every figure parses, lays out, reads aloud and shows only the givens`, () => {
    let figured = 0;
    for (let i = 0; i < 300; i++) {
      const p = generateProblem(id, `gf:${i}`);
      const scene = sceneOf(id, `gf:${i}`);
      if (!scene) continue;
      figured++;
      sceneSchema.parse(scene);
      const layout = layoutScene(scene);
      assert.deepEqual(
        layout.dropped.filter((d) => !/\.label\./.test(d)),
        [],
        `${id} gf:${i} dropped a label`,
      );
      assert.ok(describeScene(scene).length > 10);
      const labels = labelsOf(scene);
      const given = ints(p.public.prompt);
      // Angles around a transversal are named by position, 1 to 8; a plotted
      // polynomial marks its zeros, which the prompt leaves to the graph.
      if (/Transversal/.test(p.public.prompt))
        for (const n of "12345678") given.add(n);
      if (id === "polynomial-graph-match") continue;
      for (const text of labels)
        for (const n of ints(text))
          assert.ok(
            given.has(n),
            `${id} gf:${i}: label "${text}" shows ${n}, which the prompt does not state`,
          );
      if (p.public.response.kind === "choice") {
        const key = p.public.response.options.find((o) => o.id === p.answer)!;
        const keyText = key.label.replace(/\$/g, "");
        // A given that happens to equal the answer is not a leak.
        assert.ok(
          given.has(keyText) || !labels.includes(keyText),
          `${id} gf:${i}: a figure label repeats the answer`,
        );
      }
    }
    assert.ok(figured > 40, `${id} draws a figure for its figured variants`);
  });
}

test("circle segments: every stated length is on the figure, the unknown is masked", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 400; i++) {
    const { problem, tag } = satGeometryDataCase(
      "circle-segment-lengths",
      `cs:${i}`,
    );
    const scene = problem.public.figure;
    if (tag.startsWith("tangent-slope")) {
      assert.equal(scene, undefined);
      continue;
    }
    seen.add(tag);
    assert.equal(scene?.kind, "scene");
    const labels = labelsOf(scene);
    const stated = [...problem.public.prompt.matchAll(/[A-Z]{2}=(\d+)/g)].map(
      (m) => m[1]!,
    );
    assert.ok(stated.length >= 2);
    for (const n of stated)
      assert.ok(
        labels.some((l) => l === n || l.endsWith(`= ${n}`)),
        `${tag}: ${n} missing from ${labels.join("|")}`,
      );
    assert.equal(
      labels.filter((l) => l === "?").length,
      tag === "chords-whole" ? 0 : 1,
      tag,
    );
    assert.ok(labels.includes("Not to scale"));
  }
  assert.equal(seen.size, 7);
});

test("oblique triangles: sides, angles and the unknown match the prompt; SSA counts have no figure", () => {
  const variants = new Set<number>();
  for (let i = 0; i < 300; i++) {
    const { variant, problem } = obliqueCase(`ob:${i}`);
    variants.add(variant);
    const figure = problem.public.figure;
    if (variant === 4) {
      assert.equal(
        figure,
        undefined,
        "a count item must not show the triangle",
      );
      continue;
    }
    assert.equal(figure?.kind, "scene");
    const labels = labelsOf(figure);
    for (const m of problem.public.prompt.matchAll(/\b([abc])=(\d+)/g))
      assert.ok(labels.includes(`${m[1]} = ${m[2]}`), `${m[0]} on figure`);
    for (const m of problem.public.prompt.matchAll(/\b([ABC])=(\d+)\^/g))
      assert.ok(labels.includes(`${m[2]}°`), `${m[0]} on figure`);
    assert.equal(labels.filter((l) => l === "?").length, 1);
  }
  assert.equal(variants.size, 5);
});

test("triangle laws: altitude figures name the prompt's quantities; the SSA count has no figure", () => {
  const variants = new Set<number>();
  for (let i = 0; i < 300; i++) {
    const { variant, problem } = triangleLawCase(`tl:${i}`);
    variants.add(variant);
    if (variant >= 4) {
      assert.equal(problem.public.figure, undefined);
      continue;
    }
    const labels = labelsOf(problem.public.figure);
    if (variant <= 2) {
      assert.ok(labels.includes("D"));
      if (variant !== 1) assert.ok(labels.includes("h"));
      if (variant >= 1) assert.ok(labels.includes("u"));
    } else assert.equal(labels.filter((l) => l === "?").length, 1);
  }
  assert.equal(variants.size, 6);
});

test("proof-family figures carry exactly the marks the givens state", () => {
  const byTag = new Map<string, Scene>();
  for (const id of [
    "line-angle-proof-reasons",
    "triangle-theorem-consequences",
    "parallelogram-property-consequences",
    "inscribed-polygon-reasoning",
    "triangle-circle-centers",
    "tangent-circle-computation",
  ])
    for (let i = 0; i < 300; i++) {
      const r = proofConstructionCase(id, `pf:${i}`);
      const tag = r.tags[0]!;
      const scene = r.problem.public.figure;
      if (tag.startsWith("method-")) {
        assert.equal(scene, undefined, tag);
        continue;
      }
      assert.equal(scene?.kind, "scene", tag);
      if (scene?.kind === "scene" && !byTag.has(tag))
        byTag.set(tag, scene.scene);
    }
  // Isosceles: AB and AC carry one tick each, BC none; the apex is labeled and the base angle is unknown.
  const iso = byTag
    .get("base-angles")!
    .elements.find((e) => e.type === "triangle")!;
  assert.ok(iso.type === "triangle");
  assert.deepEqual(
    iso.sides?.map((s) => s.ticks ?? 0),
    [1, 0, 1],
  );
  assert.equal(iso.angles?.[1]?.label, null);
  // Rectangle: four right angles; no parallel chevrons.
  const rect = labelsOf(byTag.get("rectangle-diagonals"));
  assert.ok(
    rect.some((l) => l.startsWith("AC = ")) &&
      rect.some((l) => l.startsWith("BD = ")),
  );
  const rectIds = byTag.get("rectangle-diagonals")!.elements.map((e) => e.id);
  for (const id of ["ra", "rb", "rc", "rd"])
    assert.ok(rectIds.includes(id), id);
  assert.ok(!rectIds.some((id) => id?.startsWith("pab")));
  // Transversal: all eight angles are numbered, and both lines carry a parallel mark.
  const tr = labelsOf(byTag.get("alternate-interior"));
  for (const n of "12345678") assert.ok(tr.includes(n), `angle ${n}`);
  // Tangent: a right angle at T.
  const tan = byTag.get("tangent-length")!.elements[0]!;
  assert.ok(tan.type === "circleDiagram");
  assert.ok(tan.angles?.some((a) => a.at === "T" && a.mark === "right"));
  // Equal tangents carry both given expressions.
  assert.equal(
    labelsOf(byTag.get("equal-tangents")).filter((l) => /x/.test(l)).length,
    2,
  );
});

test("polynomial-graph-match: the plotted curve, marked zeros and the keyed choice agree", () => {
  const seenSigns = new Set<number>();
  for (let i = 0; i < 300; i++) {
    const { problem, shape } = polynomialGraphMatchCase(`pg:${i}`);
    const scene = problem.public.figure;
    assert.equal(scene?.kind, "scene");
    if (scene?.kind !== "scene") continue;
    const g = scene.scene.elements[0]!;
    assert.ok(g.type === "graph");
    const fn = g.curves![0]!.fn;
    assert.ok(fn.f === "poly");
    const value = (x: number) => fn.c.reduce((s, c, k) => s + c * x ** k, 0);
    const lead = fn.c[fn.c.length - 1]!;
    seenSigns.add(Math.sign(lead));
    assert.equal(Math.abs(lead), 1);
    assert.equal(Math.sign(lead), shape.a);
    const marked = (g.points ?? []).map((p) => p.x).sort((a, b) => a - b);
    assert.deepEqual(marked, shape.roots);
    for (const z of marked) assert.equal(value(z), 0);
    // Each zero: crossing exactly when its exponent is odd.
    shape.roots.forEach((z, k) => {
      const before = value(z - 0.25),
        after = value(z + 0.25);
      assert.equal(before * after < 0, shape.mult[k] === 1, `zero ${z}`);
    });
    assert.equal(problem.public.response.kind, "choice");
    assert.ok(!/P\(x\)=/.test(problem.public.prompt));
  }
  assert.deepEqual([...seenSigns].sort(), [-1, 1]);
});
