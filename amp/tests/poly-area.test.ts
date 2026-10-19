import assert from "node:assert/strict";
import test from "node:test";
import {
  describeScene,
  layoutScene,
  sceneSchema,
  type Drawn,
} from "../src/math/scene/index.js";
import { polyArea } from "../src/math/scene/author.js";
import {
  X,
  sideText,
  termText,
} from "../src/math/scene/components/poly-area.js";
import { missingTargets } from "../src/math/scene/timeline.js";
import { factoringTemplates } from "../src/math/factoring-practice.js";
import { generateProblem } from "../src/math/engine.js";

const rects = (items: Drawn[]) =>
  items.flatMap((d) => (d.k === "rect" ? [d] : []));
const texts = (items: Drawn[]) =>
  items.flatMap((d) => (d.k === "text" ? [d] : []));
const near = (a: number, b: number, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);

test("term labels use exact signs and powers", () => {
  assert.equal(termText([1, 1]), "x");
  assert.equal(termText([-1, 2]), "−x^2");
  assert.equal(termText([-12, 0]), "−12");
  assert.equal(
    sideText([
      [2, 1],
      [-3, 0],
    ]),
    "2x − 3",
  );
  assert.equal(
    sideText([
      [1, 3],
      [-2, 1],
      [5, 0],
    ]),
    "x^3 − 2x + 5",
  );
});

test("(x + 3)(x + 2) as tiles: x-lengths are X units, regions are tiled, terms masked", () => {
  const scene = polyArea(
    [
      [1, 1],
      [3, 0],
    ],
    [
      [1, 1],
      [2, 0],
    ],
  )
    .id("t")
    .scene();
  const l = layoutScene(scene);
  const r = Object.fromEntries(rects(l.items).map((d) => [d.id, d]));
  const x2 = r["t.region.0.0"]!,
    units = r["t.region.1.1"]!;
  near(x2.w / units.w, X / 3);
  near(x2.h / units.h, X / 2);
  // The unit block is cut into 3 × 2 tiles: 2 vertical and 1 horizontal edge.
  const edges = l.items.filter((d) => d.id.startsWith("t.region.1.1.tile"));
  assert.equal(edges.length, 3);
  const labels = texts(l.items).filter((t) => t.id.endsWith(".term"));
  assert.equal(labels.length, 4);
  assert.ok(labels.every((t) => t.masked && t.plain === "?"));
  const shown = texts(layoutScene(scene, { reveal: true }).items)
    .filter((t) => t.id.endsWith(".term"))
    .map((t) => t.plain)
    .sort();
  assert.deepEqual(shown, ["2x", "3x", "6", "x^2"].sort());
  assert.match(
    describeScene(scene),
    /algebra tiles.*x \+ 3 across and x \+ 2 down.*to be found/,
  );
});

test("negative products are shaded apart from positive ones; large sides are schematic", () => {
  const l = layoutScene(
    polyArea(
      [
        [1, 1],
        [-2, 0],
      ],
      [
        [1, 1],
        [4, 0],
      ],
    )
      .id("t")
      .scene(),
  );
  const fill = (id: string) => rects(l.items).find((d) => d.id === id)!.fill;
  assert.equal(fill("t.region.1.0"), fill("t.region.1.1"));
  assert.notEqual(fill("t.region.1.0"), fill("t.region.0.1"));
  const big = polyArea(
    [
      [1, 3],
      [-2, 1],
      [5, 0],
    ],
    [[6, 1]],
  ).scene();
  assert.match(describeScene(big), /not to scale/);
  assert.ok(!layoutScene(big).items.some((d) => d.id.includes(".tile")));
});

test("a missing corner is an empty dashed outline whose term stays unknown", () => {
  const scene = polyArea(
    [
      [1, 1],
      [3, 0],
    ],
    [
      [1, 1],
      [3, 0],
    ],
    {
      products: "shown",
      missing: [[1, 1]],
    },
  )
    .id("t")
    .scene();
  const l = layoutScene(scene);
  const corner = rects(l.items).find((d) => d.id === "t.region.1.1")!;
  assert.equal(corner.fill, "none");
  assert.equal(corner.dash, "dash");
  const terms = Object.fromEntries(texts(l.items).map((t) => [t.id, t.plain]));
  assert.equal(terms["t.region.1.1.term"], "?");
  assert.equal(terms["t.region.1.0.term"], "3x");
  assert.match(describeScene(scene), /One corner region is empty/);
});

test("factoring prompts use three frames and every lesson walkthrough is valid", () => {
  for (const t of factoringTemplates) {
    const frames = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const p = generateProblem(t.id, `tiles-${i}`);
      frames.add(p.public.prompt.split(" ")[0]!);
      assert.equal(p.public.figure, undefined, "the model stays private");
      const w = p.walkthrough!;
      assert.equal(sceneSchema.safeParse(w).success, true);
      assert.deepEqual(missingTargets(layoutScene(w), w.steps!), []);
      const answer = (
        p.public.response.kind === "choice" ? p.public.response.options : []
      ).find((o) => o.id === p.answer)!.label;
      const last = w.steps!.at(-1)!.caption;
      if (t.id === "greatest-monomial-factor")
        assert.ok(last.endsWith(`${answer}.`), `${last} / ${answer}`);
      else
        assert.ok(
          last.includes(answer),
          `${last} / ${answer}`,
        );
    }
    assert.equal(frames.size, 3, t.id);
  }
});
