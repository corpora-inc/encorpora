import test from "node:test";
import assert from "node:assert/strict";
import { generateProblem, templates } from "../src/math/engine";
import { proofConstructionCase as geometryProofCase } from "../src/math/geometry-proof-practice";
import { problemLesson } from "../src/content/problem-lessons";
import { lessons } from "../src/content/lessons";

const expected: Record<string, { skill: string; tags: string[] }> = {
  "line-angle-proof-reasons": {
    skill: "line-angle-proofs",
    tags: [
      "alternate-interior",
      "bisector-equidistant",
      "equidistant-converse",
      "vertical-equation",
    ],
  },
  "triangle-theorem-consequences": {
    skill: "triangle-proofs",
    tags: ["base-angles", "midsegment", "median-ratio", "angle-sum-step"],
  },
  "parallelogram-property-consequences": {
    skill: "parallelogram-proofs",
    tags: [
      "reason-bisect",
      "reason-opAngles",
      "reason-opSides",
      "reason-rectDiag",
      "diagonal-halves",
      "rectangle-diagonals",
      "consecutive-angles",
    ],
  },
  "precise-geometric-definitions": {
    skill: "geometric-definitions",
    tags: [
      "define-circle",
      "define-parallel",
      "define-angle-ray",
      "spot-flawed",
    ],
  },
  "transformation-invariant-claims": {
    skill: "transformation-invariants",
    tags: [
      "which-preserves",
      "coordinate-rigid",
      "coordinate-dilation",
      "coordinate-mixed",
      "dilation-facts",
      "rotation-definition",
    ],
  },
  "polygon-symmetry-counts": {
    skill: "polygon-symmetries",
    tags: [
      "smallest-rotation",
      "reflection-lines",
      "rotations-half",
      "rotations-square",
      "rotations-none",
      "rotations-hex",
      "rotation-count",
    ],
  },
  "transformation-sequence-mapping": {
    skill: "transformation-constructions",
    tags: ["single", "composition", "dilation-composition"],
  },
  "compass-straightedge-reasoning": {
    skill: "geometric-constructions",
    tags: [
      "bisector-next-step",
      "angle-bisector-next-step",
      "bisector-justification",
      "parallel-justification",
      "step-order",
    ],
  },
  "inscribed-polygon-reasoning": {
    skill: "inscribed-polygons",
    tags: [
      "hexagon-side-reason",
      "hexagon-perimeter",
      "central-angle",
      "method-hexagon",
      "method-triangle",
      "method-square",
    ],
  },
  "triangle-circle-centers": {
    skill: "triangle-circles",
    tags: [
      "circumcenter",
      "incenter",
      "cyclic-opposite",
      "cyclic-algebra",
      "right-triangle-circumradius",
    ],
  },
  "tangent-circle-computation": {
    skill: "tangent-construction",
    tags: [
      "tangent-length",
      "equal-tangents",
      "radius-from-tangent",
      "tangent-angle",
    ],
  },
  "circle-dilation-scaling": {
    skill: "circle-similarity",
    tags: [
      "scale-factor",
      "area-factor",
      "circumference-factor",
      "map-sequence",
    ],
  },
  "coordinate-quadrilateral-claims": {
    skill: "coordinate-proofs",
    tags: [
      "type-square",
      "type-rectangle",
      "type-rhombus",
      "type-parallelogram",
      "type-trapezoid",
    ],
  },
  "measurement-formula-justifications": {
    skill: "measurement-formula-proofs",
    tags: [
      "sector-rearrangement",
      "cube-three-pyramids",
      "cone-cylinder",
      "circumference-justification",
      "limit-justification",
    ],
  },
};
const ids = Object.keys(expected);
const seeds = Array.from({ length: 400 }, (_, i) => `gp:${i}`);

function parts(templateId: string, seed: string) {
  const generated = generateProblem(templateId, seed);
  const response = generated.public.response;
  assert.equal(response.kind, "choice");
  if (response.kind !== "choice") throw new Error("choice expected");
  const labels = response.options.map((o) => o.label);
  const correct = response.options.find((o) => o.id === generated.answer)!;
  return { generated, response, labels, correct: correct.label };
}

test("every geometry proof family is deterministic, reaches every variant, and has one correct distinct choice", () => {
  for (const id of ids) {
    const seen = new Set<string>();
    for (const seed of seeds) {
      const { generated, labels, correct, response } = parts(id, seed);
      const again = generateProblem(id, seed);
      assert.deepEqual(again, generated);
      const direct = geometryProofCase(id, seed);
      assert.equal(direct.problem.answer, generated.answer);
      assert.equal(generated.public.skillId, expected[id]!.skill);
      assert.equal(new Set(labels).size, 4, `${id} ${seed}`);
      assert.equal(
        response.options.filter((o) => o.id === generated.answer).length,
        1,
      );
      assert.ok(
        generated.hint.length > 20 && generated.explanation.length >= 2,
      );
      // Neither the prompt nor the hint states the correct choice.
      assert.ok(
        !generated.public.prompt.includes(correct),
        `${id}: prompt leaks ${correct}`,
      );
      assert.ok(
        !generated.hint.includes(correct),
        `${id}: hint leaks ${correct}`,
      );
      // Every wrong choice carries corrective feedback.
      for (const option of response.options)
        if (option.id !== generated.answer)
          assert.ok(
            generated.choiceFeedback?.[option.id],
            `${id}: missing feedback`,
          );
      for (const tag of direct.tags) seen.add(tag);
    }
    assert.deepEqual([...seen].sort(), [...expected[id]!.tags].sort(), id);
  }
});

test("template metadata, lessons, methods and principles are registered for each family", () => {
  for (const id of ids) {
    const template = templates.find((t) => t.id === id);
    assert.equal(template?.skillId, expected[id]!.skill);
    assert.equal(template?.requiredResponseCapability, "single-choice-v1");
    assert.ok(
      lessons.some((l) => l.templateIds.includes(id)),
      `${id} lesson`,
    );
    const view = problemLesson(id, "gp-lesson");
    assert.ok(
      view.intuition && view.method.length >= 3 && view.watch && view.principle,
    );
    assert.ok(view.example.steps.length >= 2);
  }
});

const modelOf = (id: string, seed: string) =>
  geometryProofCase(id, seed).model as Record<
    string,
    number & number[] & string
  >;
const tagOf = (id: string, seed: string) => geometryProofCase(id, seed).tags[0];

test("numeric families agree with independent arithmetic", () => {
  for (const seed of seeds) {
    const m = modelOf("line-angle-proof-reasons", seed);
    if (tagOf("line-angle-proof-reasons", seed) === "vertical-equation") {
      assert.equal(m.a * m.x0 + m.b, m.c * m.x0 + m.d);
      assert.ok(m.v > 0 && m.v < 180);
    }
    const t = modelOf("triangle-theorem-consequences", seed);
    switch (tagOf("triangle-theorem-consequences", seed)) {
      case "base-angles":
        assert.equal(2 * t.base + t.apex, 180);
        break;
      case "midsegment":
        assert.equal(t.p * t.x0 + t.q, t.de);
        assert.equal(t.c * t.x0 + t.d, t.bc);
        assert.equal(t.bc, 2 * t.de);
        break;
    }
    const p = modelOf("parallelogram-property-consequences", seed);
    const pt = tagOf("parallelogram-property-consequences", seed);
    if (pt === "diagonal-halves") {
      assert.equal(p.p * p.x0 + p.q, p.half);
      assert.equal(p.c * p.x0 + p.d, p.half);
    }
    if (pt === "rectangle-diagonals") {
      assert.equal(p.p * p.x0 + p.q, p.t);
      assert.equal(p.c * p.x0 + p.d, p.t);
    }
    const c = modelOf("triangle-circle-centers", seed);
    const ct = tagOf("triangle-circle-centers", seed);
    if (ct === "cyclic-algebra") {
      assert.equal(c.p * c.x0 + c.q + (c.c * c.x0 + c.d), 180);
      assert.equal(c.p * c.x0 + c.q, c.alpha);
    }
    if (ct === "right-triangle-circumradius")
      assert.equal(c.a ** 2 + c.b ** 2, c.h ** 2);
    const tg = modelOf("tangent-circle-computation", seed);
    const tt = tagOf("tangent-circle-computation", seed);
    if (tt === "tangent-length" || tt === "radius-from-tangent")
      assert.equal(tg.rad ** 2 + tg.t ** 2, tg.d ** 2);
    if (tt === "equal-tangents") {
      assert.equal(tg.p * tg.x0 + tg.q, tg.t);
      assert.equal(tg.c * tg.x0 + tg.d, tg.t);
    }
  }
});

test("quadrilateral classification agrees with a diagonal-based derivation", () => {
  for (const seed of seeds) {
    const { type, A, B, C, D } = modelOf(
      "coordinate-quadrilateral-claims",
      seed,
    ) as unknown as {
      type: string;
      A: number[];
      B: number[];
      C: number[];
      D: number[];
    };
    const mid = (p: number[], q: number[]) => [p[0]! + q[0]!, p[1]! + q[1]!];
    const len2 = (p: number[], q: number[]) =>
      (p[0]! - q[0]!) ** 2 + (p[1]! - q[1]!) ** 2;
    const parallelogram = mid(A, C).join() === mid(B, D).join();
    const equalDiagonals = len2(A, C) === len2(B, D);
    const perpendicularDiagonals =
      (C[0]! - A[0]!) * (D[0]! - B[0]!) + (C[1]! - A[1]!) * (D[1]! - B[1]!) ===
      0;
    const derived = !parallelogram
      ? "trapezoid"
      : equalDiagonals && perpendicularDiagonals
        ? "square"
        : equalDiagonals
          ? "rectangle"
          : perpendicularDiagonals
            ? "rhombus"
            : "parallelogram";
    assert.equal(derived, type);
  }
});

/** Independent parser for transformation-sequence labels. */
function applyLabel(label: string, [x0, y0]: number[]): number[] {
  let [x, y] = [x0!, y0!];
  for (const step of label.replace(/\.$/, "").toLowerCase().split(", then ")) {
    let hit: RegExpExecArray | null;
    if (step.includes("across the $x$-axis")) y = -y;
    else if (step.includes("across the $y$-axis")) x = -x;
    else if (step.includes("$90^\\circ$ counterclockwise")) [x, y] = [-y, x];
    else if (step.includes("$90^\\circ$ clockwise")) [x, y] = [y, -x];
    else if (step.includes("$180^\\circ$")) [x, y] = [-x, -y];
    else if (
      (hit = /translate by \$\\langle (-?\d+),(-?\d+)\\rangle\$/.exec(step))
    )
      [x, y] = [x + Number(hit[1]), y + Number(hit[2])];
    else if (
      (hit =
        /dilate by scale factor \$(?:(\d+)|\\frac\{(\d+)\}\{(\d+)\})\$ about (?:the origin|\$\((-?\d+),(-?\d+)\)\$)/.exec(
          step,
        ))
    ) {
      const num = Number(hit[1] ?? hit[2]);
      const den = Number(hit[3] ?? 1);
      const [cx, cy] = [Number(hit[4] ?? 0), Number(hit[5] ?? 0)];
      [x, y] = [cx + (num * (x - cx)) / den, cy + (num * (y - cy)) / den];
    } else throw new Error(`unparsed step ${step}`);
  }
  return [x, y];
}
const nums = (text: string) =>
  [...text.matchAll(/-?\d+/g)].map((m) => Number(m[0]));

test("exactly the correct transformation sequence maps the stated figure to its image", () => {
  for (const seed of seeds) {
    const { generated, response, correct } = parts(
      "transformation-sequence-mapping",
      seed,
    );
    const [px, py, qx, qy, rx, ry, px2, py2, qx2, qy2, rx2, ry2] = nums(
      generated.public.prompt.replace(/[PQR]'?/g, " "),
    );
    const before = [
      [px, py],
      [qx, qy],
      [rx, ry],
    ];
    const after = [
      [px2, py2],
      [qx2, qy2],
      [rx2, ry2],
    ];
    for (const option of response.options) {
      const maps = before.every((p, i) => {
        const image = applyLabel(option.label, p as number[]);
        return (
          Math.abs(image[0]! - after[i]![0]!) < 1e-9 &&
          Math.abs(image[1]! - after[i]![1]!) < 1e-9
        );
      });
      assert.equal(maps, option.label === correct, `${seed}: ${option.label}`);
    }
  }
});

test("exactly the correct sequence maps one circle onto the other", () => {
  let checked = 0;
  for (const seed of seeds) {
    if (tagOf("circle-dilation-scaling", seed) !== "map-sequence") continue;
    const { generated, response, correct } = parts(
      "circle-dilation-scaling",
      seed,
    );
    const [x1, y1, r1, x2, y2, r2] = nums(
      generated.public.prompt.replace(/[^\d\-(),. ]/g, " ").replace(/\./g, " "),
    );
    for (const option of response.options) {
      const label = option.label;
      const center = applyLabel(label, [x1!, y1!]);
      let radius = r1!;
      for (const step of label.toLowerCase().split(", then ")) {
        const hit =
          /dilate by scale factor \$(?:(\d+)|\\frac\{(\d+)\}\{(\d+)\})\$/.exec(
            step,
          );
        if (hit)
          radius = (radius * Number(hit[1] ?? hit[2])) / Number(hit[3] ?? 1);
      }
      const maps =
        Math.abs(center[0]! - x2!) < 1e-9 &&
        Math.abs(center[1]! - y2!) < 1e-9 &&
        Math.abs(radius - r2!) < 1e-9;
      assert.equal(maps, label === correct, `${seed}: ${label}`);
    }
    checked++;
  }
  assert.ok(checked > 20);
});

test("symmetry and inscribed-polygon numbers match closed forms", () => {
  for (const seed of seeds) {
    if (tagOf("polygon-symmetry-counts", seed) === "smallest-rotation") {
      const { generated, correct } = parts("polygon-symmetry-counts", seed);
      const n = Number(/with (\d+) sides/.exec(generated.public.prompt)![1]);
      assert.equal(correct, `$${360 / n}^\\circ$`);
    }
    if (tagOf("polygon-symmetry-counts", seed) === "rotation-count") {
      const { generated, correct } = parts("polygon-symmetry-counts", seed);
      const n = Number(/with (\d+) sides/.exec(generated.public.prompt)![1]);
      assert.equal(correct, `$${n}$`);
    }
    if (tagOf("inscribed-polygon-reasoning", seed) === "hexagon-perimeter") {
      const { generated, correct } = parts("inscribed-polygon-reasoning", seed);
      const r = Number(/radius (\d+) cm/.exec(generated.public.prompt)![1]);
      assert.equal(correct, `$${6 * r}\\text{ cm}$`);
    }
    if (tagOf("circle-dilation-scaling", seed) === "scale-factor") {
      const { generated, correct } = parts("circle-dilation-scaling", seed);
      const [a, b] = nums(generated.public.prompt).slice(0, 2) as [
        number,
        number,
      ];
      const g = (x: number, y: number): number => (y ? g(y, x % y) : x);
      const d = g(a, b);
      assert.equal(
        correct,
        a / d === 1 ? `$${b / d}$` : `$\\frac{${b / d}}{${a / d}}$`,
      );
    }
  }
});
