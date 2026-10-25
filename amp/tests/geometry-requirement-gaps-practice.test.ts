import test from "node:test";
import assert from "node:assert/strict";
import {
  geometryRequirementGapCase,
  geometryRequirementGapTemplates,
} from "../src/math/geometry-requirement-gaps-practice";
import { generateProblem, templates } from "../src/math/engine";
import { problemLesson } from "../src/content/problem-lessons";
import { actualFacetMappings } from "../src/content/facet-mappings";

const variants: Record<string, string[]> = {
  "arc-sector-derivation": [
    "arc-proportional",
    "similar-circles-equation",
    "radian-from-arc",
    "arc-from-radian",
    "sector-fraction",
    "sector-simplify",
  ],
  "complex-plane-operations": [
    "parallelogram",
    "subtract",
    "conjugate-reflection",
    "i-rotation",
    "rotation-angle",
    "scale-rotate",
    "modulus-argument",
  ],
  "conditional-everyday-reasoning": [
    "words-to-notation",
    "notation-to-words",
    "compare-directions",
    "independent-product",
    "dependent-product",
    "rates-independent",
    "rates-more",
    "rates-less",
  ],
  "congruence-by-rigid-motion": [
    "congruent-translation",
    "congruent-motion",
    "congruent-two-step",
    "predict-image",
    "decide-congruent",
    "decide-scaled",
    "corresponding-parts",
  ],
  "conic-foci": [
    "ellipse-foci-h",
    "ellipse-foci-v",
    "hyperbola-foci-h",
    "hyperbola-foci-v",
    "ellipse-equation",
    "hyperbola-equation",
    "distance-sum",
  ],
  "choose-the-plot": [
    "dot-plot-to-data",
    "histogram-to-data",
    "box-plot-to-data",
    "data-to-bar-heights",
    "data-to-five-numbers",
  ],
  "similarity-by-transformation": [
    "dilate-translate",
    "dilate-motion",
    "decide-similar",
    "not-similar",
  ],
  "aa-similarity": [
    "aa-similar",
    "aa-not-similar",
    "aa-find-angle",
    "aa-proportion",
  ],
};
const skills: Record<string, string> = {
  "arc-sector-derivation": "arc-sector-measure",
  "complex-plane-operations": "complex-plane",
  "conditional-everyday-reasoning": "conditional-probability",
  "congruence-by-rigid-motion": "congruence-criteria",
  "conic-foci": "conic-sections",
  "choose-the-plot": "distribution-plots",
  "similarity-by-transformation": "similarity-proofs",
  "aa-similarity": "similarity-proofs",
};
const facets: Record<string, string> = {
  "arc-sector-derivation": "arc-sector-measure.HSG.C.B.5",
  "complex-plane-operations": "complex-plane.HSN.CN.B.5",
  "conditional-everyday-reasoning": "conditional-probability.HSS.CP.A.5",
  "congruence-by-rigid-motion": "congruence-criteria.HSG.CO.B.6",
  "conic-foci": "conic-sections.HSG.GPE.A.3",
  "choose-the-plot": "distribution-plots.HSS.ID.A.1",
  "similarity-by-transformation": "similarity-proofs.HSG.SRT.A.2",
  "aa-similarity": "similarity-proofs.HSG.SRT.A.3",
};

type Case = ReturnType<typeof geometryRequirementGapCase>;
const cases = (id: string, count = 400, prefix = "s"): Case[] =>
  Array.from({ length: count }, (_, i) =>
    geometryRequirementGapCase(id, `${prefix}${i}`),
  );
const options = (c: Case) => {
  const response = c.problem.public.response;
  assert.equal(response.kind, "choice");
  if (response.kind !== "choice") throw new Error("not a choice");
  return response.options;
};

for (const id of Object.keys(variants)) {
  test(`${id}: deterministic, every variant reachable, one correct distinct choice`, () => {
    const seen = new Set<string>();
    for (const a of cases(id)) {
      const seed = a.problem.public.seed;
      assert.deepEqual(a.problem, geometryRequirementGapCase(id, seed).problem);
      const via = generateProblem(id, seed);
      assert.equal(via.public.templateId, id);
      assert.deepEqual(via.public.response, a.problem.public.response);
      assert.equal(via.answer, a.problem.answer);
      seen.add(a.variant);
      const choices = options(a);
      const labels = choices.map((o) => o.label);
      assert.equal(choices.length, 4);
      assert.equal(new Set(labels).size, 4, `${a.variant}: ${labels}`);
      assert.equal(labels.filter((l) => l === a.correctLabel).length, 1);
      const correct = choices.find((o) => o.label === a.correctLabel)!;
      assert.equal(a.problem.answer, correct.id);
      const feedback = a.problem.choiceFeedback ?? {};
      for (const o of choices)
        if (o.id !== correct.id)
          assert.ok(feedback[o.id]?.length, `${a.variant}: feedback`);
      assert.ok(
        !(a.problem.public.prompt + a.problem.hint).includes(a.correctLabel),
        `${a.variant}: leaks ${a.correctLabel}`,
      );
      assert.ok(a.problem.explanation.length >= 2);
      assert.ok(a.problem.hint.length > 20);
    }
    assert.deepEqual([...seen].sort(), [...variants[id]!].sort());
  });
}

test("templates are registered with their own skill, a lesson and a partial facet mapping", () => {
  for (const t of geometryRequirementGapTemplates) {
    assert.equal(templates.find((x) => x.id === t.id)?.skillId, skills[t.id]);
    const lesson = problemLesson(t.id, "library");
    assert.ok(lesson.method.length >= 3);
    assert.ok(lesson.watch);
    assert.ok(lesson.principle);
    assert.ok(lesson.example.steps.length >= 3);
    const mapping = actualFacetMappings.filter((m) => m.templateId === t.id);
    assert.equal(mapping.length, 1);
    assert.equal(mapping[0]!.facetId, facets[t.id]);
    assert.equal(mapping[0]!.extent, "partial");
  }
});

// -------------------------------------------------------- independent checks
type Pt = [number, number];
const num = (s: string) => Number(s);
/** Parse $\frac{a}{b}$, $a$ or $-a$ into [numerator, denominator]. */
function rational(text: string): [number, number] {
  const f = /^(-?)\\frac\{(\d+)\}\{(\d+)\}$/.exec(text);
  if (f) return [num(f[2]!) * (f[1] ? -1 : 1), num(f[3]!)];
  assert.match(text, /^-?\d+$/, text);
  return [num(text), 1];
}
const equalRational = (a: [number, number], b: [number, number]) =>
  a[0] * b[1] === b[0] * a[1];
const inner = (label: string) => label.replace(/^\$/, "").replace(/\$.*$/, "");
const scenePoints = (c: Case) => {
  const figure = c.problem.public.figure;
  assert.equal(figure?.kind, "scene");
  if (figure?.kind !== "scene") throw new Error("no scene");
  const graph = figure.scene.elements.find((e) => e.type === "graph")!;
  assert.equal(graph.type, "graph");
  if (graph.type !== "graph") throw new Error("no graph");
  const at = new Map<string, Pt>();
  for (const p of graph.points ?? []) if (p.label) at.set(p.label, [p.x, p.y]);
  return at;
};

test("arc-sector-derivation answers match independent arithmetic", () => {
  const seen = new Set<string>();
  for (const c of cases("arc-sector-derivation", 600, "o")) {
    const p = c.problem.public.prompt;
    seen.add(c.variant);
    if (c.variant === "arc-proportional") {
      const m =
        /radius (\d+) cm, a central angle of \d+° cuts off an arc (\d+) cm long.*radius (\d+) cm\?/.exec(
          p,
        )!;
      const [r1, s1, r2] = [num(m[1]!), num(m[2]!), num(m[3]!)];
      assert.equal((s1 * r2) % r1, 0);
      assert.equal(c.correctLabel, `$${(s1 * r2) / r1}$ cm`);
    } else if (c.variant === "similar-circles-equation") {
      const m =
        /radius (\d+) the angle cuts off an arc of length (\d+)\. In the circle of radius (\d+)/.exec(
          p,
        )!;
      assert.equal(
        c.correctLabel,
        `$\\frac{${m[2]}}{${m[1]}}=\\frac{x}{${m[3]}}$`,
      );
    } else if (c.variant === "radian-from-arc") {
      const m = /radius (\d+) cm cuts off an arc (\d+) cm long/.exec(p)!;
      assert.ok(
        equalRational(rational(inner(c.correctLabel)), [
          num(m[2]!),
          num(m[1]!),
        ]),
      );
    } else if (c.variant === "arc-from-radian") {
      const m =
        /measures \$(-?\\frac\{\d+\}\{\d+\}|\d+)\$ radians in a circle of radius (\d+) cm/.exec(
          p,
        )!;
      const [n, d] = rational(m[1]!);
      const s = rational(inner(c.correctLabel));
      assert.ok(equalRational(s, [n * num(m[2]!), d]));
    } else if (c.variant === "sector-fraction") {
      const m =
        /central angle \$(.*?)\$ radians in a circle of radius (\d+) cm/.exec(
          p,
        )!;
      const coefficient = (t: string): [number, number] => {
        t = t.replace(/\\pi/, "P");
        const a = /^\\frac\{(\d*)P\}\{(\d+)\}$/.exec(t);
        if (a) return [num(a[1] || "1"), num(a[2]!)];
        const b = /^\\frac\{P\}\{(\d+)\}$/.exec(t);
        if (b) return [1, num(b[1]!)];
        const c2 = /^(\d*)P$/.exec(t);
        assert.ok(c2, t);
        return [num(c2![1] || "1"), 1];
      };
      const [p0, q0] = coefficient(m[1]!);
      const rr = num(m[2]!);
      // area = (theta / 2pi) * pi r^2 = (p0/q0) * r^2 / 2 times pi
      const expected: [number, number] = [p0 * rr * rr, 2 * q0];
      const label = c.correctLabel.replace(/^\$/, "").replace(/\$ cm.*$/, "");
      assert.ok(equalRational(coefficient(label), expected), label);
    } else {
      const m =
        /central angle ([\d.]+) radians in a circle of radius (\d+) cm/.exec(
          p,
        )!;
      const area = (num(m[1]!) * num(m[2]!) ** 2) / 2;
      assert.equal(c.correctLabel, `$${area}$ cm$^2$`);
    }
  }
  assert.equal(seen.size, 6);
});

test("complex-plane-operations answers match the algebra of complex numbers", () => {
  const cx = (re: number, im: number) => ({ re, im });
  let checked = 0;
  for (const c of cases("complex-plane-operations", 600, "o")) {
    const p = c.problem.public.prompt;
    if (c.variant === "rotation-angle") {
      const k = num(/i\^\{(\d+)\}/.exec(p)![1]!);
      let z = cx(1, 0);
      for (let i = 0; i < k; i++) z = cx(-z.im, z.re); // multiply by i
      const angle = Math.round((Math.atan2(z.im, z.re) * 180) / Math.PI);
      const expected = (angle + 360) % 360;
      const label = c.correctLabel;
      const got = /No rotation/.test(label)
        ? 0
        : num(/\$(\d+)\^/.exec(label)![1]!);
      assert.equal(got, expected);
      checked++;
    } else if (c.variant === "modulus-argument") {
      const m =
        /modulus (\d+) and argument (\d+)°, and \$w\$ has modulus (\d+) and argument (\d+)°/.exec(
          p,
        )!;
      const z = [num(m[1]!), (num(m[2]!) * Math.PI) / 180];
      const w = [num(m[3]!), (num(m[4]!) * Math.PI) / 180];
      const product = cx(
        z[0]! * w[0]! * Math.cos(z[1]! + w[1]!),
        z[0]! * w[0]! * Math.sin(z[1]! + w[1]!),
      );
      const mod = Math.hypot(product.re, product.im);
      const arg =
        ((Math.atan2(product.im, product.re) * 180) / Math.PI + 360) % 360;
      const got = /\|zw\|=(\d+),\\ \\arg\(zw\)=(\d+)\^/.exec(c.correctLabel)!;
      assert.ok(Math.abs(mod - num(got[1]!)) < 1e-9);
      assert.ok(Math.abs(arg - num(got[2]!)) < 1e-9);
      checked++;
    } else if (c.variant === "subtract") {
      const at = scenePoints(c);
      const P = at.get("P")!;
      const Q = at.get("Q")!;
      const re = P[0] - Q[0];
      const im = P[1] - Q[1];
      const label = inner(c.correctLabel);
      const m = /^(-?\d+)(?:([+-])(\d*)i)?$/.exec(label);
      const parsed = m
        ? {
            re: num(m[1]!),
            im: m[2] ? (m[2] === "-" ? -1 : 1) * num(m[3] || "1") : 0,
          }
        : (() => {
            const pure = /^(-?)(\d*)i$/.exec(label)!;
            return { re: 0, im: (pure[1] ? -1 : 1) * num(pure[2] || "1") };
          })();
      assert.deepEqual(parsed, { re, im });
      checked++;
    } else {
      const at = scenePoints(c);
      const letter = /\$([A-D])\$/.exec(c.correctLabel)![1]!;
      const got = at.get(letter)!;
      const P = at.get("P")!;
      let expected: Pt;
      if (c.variant === "parallelogram") {
        const Q = at.get("Q")!;
        expected = [P[0] + Q[0], P[1] + Q[1]];
      } else if (c.variant === "conjugate-reflection") expected = [P[0], -P[1]];
      else if (c.variant === "i-rotation") expected = [-P[1], P[0]];
      else {
        const m = /w=(\d+)\(\\cos (\d+)\^/.exec(p)!;
        const k = num(m[1]!);
        const t = (num(m[2]!) * Math.PI) / 180;
        // (a + bi) * k (cos t + i sin t)
        expected = [
          Math.round(k * (P[0] * Math.cos(t) - P[1] * Math.sin(t))),
          Math.round(k * (P[0] * Math.sin(t) + P[1] * Math.cos(t))),
        ];
      }
      assert.deepEqual(got, expected, c.variant);
      checked++;
    }
  }
  assert.ok(checked >= 590);
});

test("conditional probability answers match the counts and rates in the prompt", () => {
  const seen = new Set<string>();
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  for (const c of cases("conditional-everyday-reasoning", 800, "o")) {
    const p = c.problem.public.prompt;
    seen.add(c.variant);
    if (c.variant === "compare-directions") {
      const m = /Of (\d+) .*?, (\d+) .*?, (\d+) .*?, and (\d+) do both/.exec(
        p,
      )!;
      const [nA, nB, both] = [num(m[2]!), num(m[3]!), num(m[4]!)];
      const f = (n: number, d: number) => {
        const g = gcd(n, d);
        return d / g === 1 ? `${n / g}` : `\\frac{${n / g}}{${d / g}}`;
      };
      assert.equal(
        c.correctLabel,
        `$P(A\\mid B)=${f(both, nB)},\\ P(B\\mid A)=${f(both, nA)}$`,
      );
    } else if (c.variant.endsWith("-product")) {
      const m =
        /P\(A\)=([\d.]+)\$, \$P\(B\)=([\d.]+)\$ and \$P\(A\\cap B\)=([\d.]+)\$/.exec(
          p,
        )!;
      const [a, b, both] = [num(m[1]!), num(m[2]!), num(m[3]!)];
      const independent = Math.abs(a * b - both) < 1e-9;
      assert.equal(c.correctLabel.startsWith("Independent"), independent);
      assert.equal(independent, c.variant === "independent-product");
    } else if (c.variant.startsWith("rates-")) {
      const m = /Overall, (\d+)% .* (\d+)% /.exec(p)!;
      const [overall, within] = [num(m[1]!), num(m[2]!)];
      const expected =
        overall === within
          ? "Independent"
          : within > overall
            ? "Not independent, because $B$ makes $A$ more likely"
            : "Not independent, because $B$ makes $A$ less likely";
      assert.ok(c.correctLabel.startsWith(expected), c.correctLabel);
    }
  }
  assert.equal(seen.size, 8);
});

// ----------------------------- transformation sequences read back from the text
function interpret(label: string): ((p: Pt) => Pt)[] {
  const body = label.replace(/^(Yes|No): /, "");
  return body.split(", then ").map((part) => {
    const part2 = part.charAt(0).toLowerCase() + part.slice(1);
    let m = /^translate \$\(x,y\)\\to\(x([+-]\d+)?,y([+-]\d+)?\)\$$/.exec(
      part2,
    );
    if (m) {
      const dx = num(m[1] ?? "0");
      const dy = num(m[2] ?? "0");
      return ([x, y]: Pt): Pt => [x + dx, y + dy];
    }
    if (part2 === "reflect over the $x$-axis")
      return ([x, y]: Pt): Pt => [x, -y];
    if (part2 === "reflect over the $y$-axis")
      return ([x, y]: Pt): Pt => [-x, y];
    m = /^rotate \$(\d+)\^\\circ\$/.exec(part2);
    if (m) {
      const turns = num(m[1]!) / 90;
      return (p: Pt): Pt => {
        let [x, y] = p;
        for (let i = 0; i < turns; i++) [x, y] = [-y, x];
        return [x, y];
      };
    }
    m = /^dilate by a factor of \$(?:(\d+)|\\frac\{(\d+)\}\{(\d+)\})\$/.exec(
      part2,
    );
    if (m) {
      const k = m[1] ? num(m[1]) : num(m[2]!) / num(m[3]!);
      return ([x, y]: Pt): Pt => [x * k, y * k];
    }
    throw new Error(`Unparsed motion: ${part}`);
  });
}
const maps = (ops: ((p: Pt) => Pt)[], from: Pt[], to: Pt[]) =>
  from.every((p, i) => {
    const q = ops.reduce((acc, op) => op(acc), p);
    return q[0] === to[i]![0] && q[1] === to[i]![1];
  });
const triangles = (c: Case) => {
  const at = scenePoints(c);
  return {
    from: ["A", "B", "C"].map((n) => at.get(n)!),
    to: ["D", "E", "F"].map((n) => at.get(n)!),
  };
};
const side2 = (a: Pt, b: Pt) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

test("congruence and similarity sequences really map the drawn triangles", () => {
  const seen = new Set<string>();
  for (const id of [
    "congruence-by-rigid-motion",
    "similarity-by-transformation",
  ]) {
    for (const c of cases(id, 600, "m")) {
      seen.add(c.variant);
      const labels = options(c).map((o) => o.label);
      if (
        [
          "congruent-translation",
          "congruent-motion",
          "congruent-two-step",
          "dilate-translate",
          "dilate-motion",
        ].includes(c.variant)
      ) {
        const { from, to } = triangles(c);
        const mapping = labels.filter((l) => maps(interpret(l), from, to));
        assert.deepEqual(mapping, [c.correctLabel], c.variant);
      } else if (
        c.variant === "decide-congruent" ||
        c.variant === "decide-similar"
      ) {
        const { from, to } = triangles(c);
        const yes = labels.filter((l) => l.startsWith("Yes: "));
        const working = yes.filter((l) => maps(interpret(l), from, to));
        assert.deepEqual(working, [c.correctLabel]);
        const ratios = [0, 1, 2].map(
          (i) =>
            side2(to[i]!, to[(i + 1) % 3]!) /
            side2(from[i]!, from[(i + 1) % 3]!),
        );
        assert.ok(ratios.every((r) => r === ratios[0]));
        assert.equal(ratios[0] === 1, c.variant === "decide-congruent");
      } else if (c.variant === "decide-scaled" || c.variant === "not-similar") {
        const { from, to } = triangles(c);
        const ratios = [0, 1, 2].map(
          (i) =>
            side2(to[i]!, to[(i + 1) % 3]!) /
            side2(from[i]!, from[(i + 1) % 3]!),
        );
        assert.ok(c.correctLabel.startsWith("No: "));
        if (c.variant === "decide-scaled") {
          assert.ok(ratios.every((r) => r === ratios[0]) && ratios[0] > 1);
        } else {
          assert.ok(ratios.some((r) => r !== ratios[0]));
          assert.ok(
            labels.every(
              (l) =>
                !l.startsWith("Yes: dilate") || !maps(interpret(l), from, to),
            ),
          );
        }
      } else if (c.variant === "predict-image") {
        const at = scenePoints(c);
        const p = c.problem.public.prompt;
        const m = /: (.*)\. What are the coordinates of ([DEF])\?$/.exec(p)!;
        const index = "DEF".indexOf(m[2]!);
        const original = at.get("ABC"[index]!)!;
        const image = interpret(m[1]!).reduce((acc, op) => op(acc), original);
        assert.equal(c.correctLabel, `$(${image[0]},${image[1]})$`);
      }
    }
  }
  assert.ok(seen.has("predict-image") && seen.has("decide-scaled"));
});

test("conic foci and equations satisfy the distance definitions numerically", () => {
  const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;
  const seen = new Set<string>();
  for (const c of cases("conic-foci", 600, "k")) {
    seen.add(c.variant);
    const p = c.problem.public.prompt;
    if (c.variant.includes("foci-") && !c.variant.startsWith("distance")) {
      const m =
        /\\frac\{([xy])\^2\}\{(\d+)\}([+-])\\frac\{([xy])\^2\}\{(\d+)\}=1/.exec(
          p,
        )!;
      const first = m[1]!;
      const [A, B] = [num(m[2]!), num(m[5]!)];
      const ellipse = m[3] === "+";
      const c2 = ellipse ? Math.abs(A - B) : A + B;
      // Verify with a point on the curve: foci satisfy the distance definition.
      const cc = Math.sqrt(c2);
      const axisFirst = ellipse ? (A > B ? first : m[4]!) : first;
      const foci: Pt[] =
        axisFirst === "x"
          ? [
              [cc, 0],
              [-cc, 0],
            ]
          : [
              [0, cc],
              [0, -cc],
            ];
      const a = Math.sqrt(ellipse ? Math.max(A, B) : A);
      // vertex on the focal axis
      const vertex: Pt = axisFirst === "x" ? [a, 0] : [0, a];
      const d = foci.map((f) => Math.hypot(vertex[0] - f[0], vertex[1] - f[1]));
      if (ellipse) {
        // the point on the minor axis is equally far from both foci: sum = 2a
        const b = Math.sqrt(Math.min(A, B));
        const minor: Pt = axisFirst === "x" ? [0, b] : [b, 0];
        const total = foci.reduce(
          (s, f) => s + Math.hypot(minor[0] - f[0], minor[1] - f[1]),
          0,
        );
        assert.ok(close(total, 2 * a));
        assert.ok(close(d[0]! + d[1]!, 2 * a));
      } else assert.ok(close(Math.abs(d[0]! - d[1]!), 2 * a));
      const label = c.correctLabel;
      const coordinate = /\\pm ((?:\d+)?(?:\\sqrt\{\d+\})?)/.exec(label)!;
      const value = (() => {
        const t = coordinate[1]!;
        const r = /^(\d*)\\sqrt\{(\d+)\}$/.exec(t);
        if (r) return num(r[1] || "1") * Math.sqrt(num(r[2]!));
        return num(t);
      })();
      assert.ok(close(value, cc), `${label} vs ${cc}`);
      assert.equal(label.startsWith("$(0,"), axisFirst === "y");
    } else if (
      c.variant === "ellipse-equation" ||
      c.variant === "hyperbola-equation"
    ) {
      const m = /foci \$\((\\pm(\d+),0|0,\\pm(\d+))\)\$.*is (\d+)/.exec(p)!;
      const cc = num(m[2] ?? m[3]!);
      const constant = num(m[4]!);
      const e =
        /\\frac\{([xy])\^2\}\{(\d+)\}([+-])\\frac\{([xy])\^2\}\{(\d+)\}=1/.exec(
          c.correctLabel,
        )!;
      const [A, B] = [num(e[2]!), num(e[5]!)];
      const ellipse = c.variant === "ellipse-equation";
      assert.equal(e[3], ellipse ? "+" : "-");
      const vertical = m[3] !== undefined;
      assert.equal(e[1], vertical ? "y" : "x");
      const foci: Pt[] = vertical
        ? [
            [0, cc],
            [0, -cc],
          ]
        : [
            [cc, 0],
            [-cc, 0],
          ];
      // A point on the curve: first-variable vertex, and one more for hyperbola.
      const a = Math.sqrt(A);
      const vertex: Pt = vertical ? [0, a] : [a, 0];
      const dist = (pt: Pt) =>
        foci.map((f) => Math.hypot(pt[0] - f[0], pt[1] - f[1]));
      if (ellipse) {
        const b = Math.sqrt(B);
        const minor: Pt = vertical ? [b, 0] : [0, b];
        assert.ok(close(dist(vertex)[0]! + dist(vertex)[1]!, constant));
        assert.ok(close(dist(minor)[0]! + dist(minor)[1]!, constant));
      } else {
        // y = 1 or x = 1 on the second variable: x^2/A - y^2/B = 1
        const t = 1;
        const other = Math.sqrt(A * (1 + (t * t) / B));
        const pt: Pt = vertical ? [t, other] : [other, t];
        const d = dist(pt);
        assert.ok(close(Math.abs(d[0]! - d[1]!), constant));
      }
    } else if (c.variant === "distance-sum") {
      const m =
        /foci \$\((\\pm(\d+),0|0,\\pm(\d+))\)\$ and passes through \$\((\d+),(\d+)\)\$/.exec(
          p,
        )!;
      const cc = num(m[2] ?? m[3]!);
      const through: Pt = [num(m[4]!), num(m[5]!)];
      const foci: Pt[] =
        m[3] !== undefined
          ? [
              [0, cc],
              [0, -cc],
            ]
          : [
              [cc, 0],
              [-cc, 0],
            ];
      const total = foci.reduce(
        (s, f) => s + Math.hypot(through[0] - f[0], through[1] - f[1]),
        0,
      );
      assert.equal(c.correctLabel, `$${Math.round(total)}$`);
      assert.ok(close(total, Math.round(total)));
    }
  }
  assert.equal(seen.size, 7);
});

test("choose-the-plot answers agree with the drawn plot and the stated conventions", () => {
  const median = (s: number[]) => {
    const n = s.length;
    return n % 2 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2;
  };
  const five = (s: number[]) => {
    const n = s.length;
    const h = Math.floor(n / 2);
    return [
      s[0]!,
      median(s.slice(0, h)),
      median(s),
      median(s.slice(n % 2 ? h + 1 : h)),
      s[n - 1]!,
    ];
  };
  const list = (label: string) =>
    label.replace(/\$/g, "").split(",\\ ").map(Number);
  for (const c of cases("choose-the-plot", 800, "p")) {
    const figure = c.problem.public.figure;
    const p = c.problem.public.prompt;
    if (c.variant === "dot-plot-to-data") {
      assert.equal(figure?.kind, "line-plot");
      if (figure?.kind !== "line-plot") continue;
      assert.deepEqual(
        list(c.correctLabel),
        [...figure.values].sort((a, b) => a - b),
      );
      for (const o of options(c).filter((x) => x.label !== c.correctLabel))
        assert.notDeepEqual(
          list(o.label),
          [...figure.values].sort((a, b) => a - b),
        );
    } else if (c.variant === "histogram-to-data") {
      assert.equal(figure?.kind, "histogram");
      if (figure?.kind !== "histogram") continue;
      const tally = (values: number[]) => {
        const out = new Array<number>(figure.counts.length).fill(0);
        for (const v of values)
          out[Math.floor((v - figure.start) / figure.width)]!++;
        return out;
      };
      assert.deepEqual(tally(list(c.correctLabel)), figure.counts);
      for (const o of options(c).filter((x) => x.label !== c.correctLabel))
        assert.notDeepEqual(tally(list(o.label)), figure.counts);
    } else if (c.variant === "box-plot-to-data") {
      assert.equal(figure?.kind, "box-plot");
      if (figure?.kind !== "box-plot") continue;
      assert.deepEqual(five(list(c.correctLabel)), [...figure.summary]);
      for (const o of options(c).filter((x) => x.label !== c.correctLabel))
        assert.notDeepEqual(five(list(o.label)), [...figure.summary]);
    } else if (c.variant === "data-to-bar-heights") {
      const data = /: ([\d, ]+)\. A histogram/
        .exec(p)![1]!
        .split(", ")
        .map(Number);
      const bins = (p.match(/\\le x</g) ?? []).length;
      const counts = new Array<number>(bins).fill(0);
      for (const v of data) counts[Math.floor(v / 5)]!++;
      assert.deepEqual(list(c.correctLabel), counts);
    } else {
      const data = /order they were recorded: ([\d, ]+)\. Quartiles/
        .exec(p)![1]!
        .split(", ")
        .map(Number);
      const expected = five([...data].sort((a, b) => a - b));
      assert.deepEqual(list(c.correctLabel), expected);
    }
  }
});

test("AA similarity answers follow from the angle sum and the vertex matching", () => {
  const seen = new Set<string>();
  for (const c of cases("aa-similarity", 800, "a")) {
    seen.add(c.variant);
    const p = c.problem.public.prompt;
    if (c.variant === "aa-find-angle") {
      const m = /\\angle A=(\d+)\^\\circ\$ and \$\\angle B=(\d+)/.exec(p)!;
      assert.equal(c.correctLabel, `$${180 - num(m[1]!) - num(m[2]!)}^\\circ$`);
    } else if (c.variant === "aa-proportion") {
      const m = /\\triangle ABC\\sim ?\\triangle ([DEF]{3})/.exec(p)!;
      const image = m[1]!;
      assert.equal(
        c.correctLabel,
        `$\\frac{AB}{${image[0]}${image[1]}}=\\frac{BC}{${image[1]}${image[2]}}$`,
      );
    } else {
      const parse = (name: string) => {
        const part = new RegExp(`Triangle \\$${name}\\$ has (.*?)\\.`).exec(
          p,
        )![1]!;
        const out = new Map<string, number>();
        for (const m of part.matchAll(/\\angle ([A-F])=(\d+)\^/g))
          out.set(m[1]!, num(m[2]!));
        return out;
      };
      const complete = (angles: Map<string, number>, names: string[]) => {
        const missing = names.find((n) => !angles.has(n))!;
        const copy = new Map(angles);
        copy.set(
          missing,
          180 - [...angles.values()].reduce((a, b) => a + b, 0),
        );
        return copy;
      };
      const abc = complete(parse("ABC"), ["A", "B", "C"]);
      const def = complete(parse("DEF"), ["D", "E", "F"]);
      const shared = [...abc.values()].filter((v) =>
        [...def.values()].includes(v),
      );
      if (c.variant === "aa-similar") {
        assert.equal(shared.length, 3);
        const image = ["A", "B", "C"]
          .map((v) => [...def].find(([, a]) => a === abc.get(v))![0])
          .join("");
        assert.equal(
          c.correctLabel,
          `Similar by AA: $\\triangle ABC\\sim \\triangle ${image}$`,
        );
      } else {
        assert.equal(shared.length, 1);
        assert.ok(c.correctLabel.startsWith("Not similar: only one pair"));
      }
    }
  }
  assert.equal(seen.size, 4);
});

test("all seeds across a wide range generate without error", () => {
  for (const t of geometryRequirementGapTemplates)
    for (let i = 0; i < 3000; i++) {
      assert.doesNotThrow(
        () => geometryRequirementGapCase(t.id, `wide${i}`),
        `${t.id} wide${i}`,
      );
    }
});
