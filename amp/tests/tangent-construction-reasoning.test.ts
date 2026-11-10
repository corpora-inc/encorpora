import { test } from "node:test";
import assert from "node:assert/strict";
import { generatedProblemSchema } from "../src/math/contracts";
import { generateProblem, gradeAnswer, templates } from "../src/math/engine";
import {
  PYTHAGOREAN,
  tangentConstructionReasoningCases as cases,
  tangentConstructionReasoningTemplates,
} from "../src/math/tangent-construction-reasoning-practice";

type Pt = [number, number];
type El = {
  id?: string;
  type: string;
  center?: Pt;
  r?: number;
  from?: Pt;
  to?: Pt;
  at?: Pt;
};
const SEEDS = 2000;
const ids = tangentConstructionReasoningTemplates.map((t) => t.id);
const elements = (p: { public: { figure?: unknown } }) =>
  (p.public.figure as { scene: { elements: El[] } }).scene.elements;
const el = (els: El[], id: string) => els.find((e) => e.id === id);
/** Distance from O = (0, 0) to the line through a and b. */
const distO = (a: Pt, b: Pt) =>
  Math.abs(a[0] * (b[1] - a[1]) - a[1] * (b[0] - a[0])) /
  Math.hypot(b[0] - a[0], b[1] - a[1]);
const dirAngle = (u: Pt, v: Pt) => {
  const cos =
    Math.abs(u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v));
  return (Math.acos(Math.min(1, cos)) * 180) / Math.PI;
};

test("templates are registered, deterministic and valid", () => {
  for (const id of ids) {
    assert.ok(
      templates.some((t) => t.id === id),
      id,
    );
    for (let i = 0; i < 80; i++) {
      const a = generateProblem(id, `det-${i}`);
      assert.deepEqual(a, generateProblem(id, `det-${i}`));
      generatedProblemSchema.parse(a);
      assert.equal(gradeAnswer(a, a.answer), true);
      assert.equal(a.public.skillId, "tangent-construction");
      const r = a.public.response;
      assert.equal(r.kind, "choice");
      if (r.kind === "choice") {
        assert.equal(r.options.length, 4);
        assert.equal(new Set(r.options.map((o) => o.label)).size, 4);
        assert.equal(Object.keys(a.choiceFeedback!).length, 3);
      }
    }
  }
});

test("every variant is reached at least 50 times in 2000 seeds", () => {
  const seen = new Map<string, number>();
  const at = new Map<string, Set<number>>();
  for (const id of ids)
    for (let i = 0; i < SEEDS; i++) {
      const p = generateProblem(id, `sweep-${i}`);
      seen.set(p.variant!.id, (seen.get(p.variant!.id) ?? 0) + 1);
      const r = p.public.response;
      if (r.kind === "choice") {
        const set = at.get(id) ?? new Set();
        set.add(r.options.findIndex((o) => o.id === p.answer));
        at.set(id, set);
      }
    }
  for (const v of [
    "next-step-0",
    "next-step-1",
    "next-step-2",
    "next-step-3",
    "order-steps-circle-at-p",
    "order-steps-radius-line",
    "order-steps-perpendicular-at-p",
    "which-line",
    "reason-for-step",
    "reason-tangent",
    "find-flaw-ana",
    "find-flaw-ben",
    "find-flaw-cara",
    "complete-explanation-right-angle",
    "complete-explanation-tangent-rule",
  ])
    assert.ok((seen.get(v) ?? 0) >= 50, `${v}: ${seen.get(v)}`);
  for (const id of ids)
    assert.equal(at.get(id)!.size, 4, `${id} key positions`);
});

test("geometry: P is outside, drawn to scale, T and T′ are points of tangency far apart", () => {
  for (let i = 0; i < 600; i++) {
    for (const id of ids) {
      const c = (
        cases[id as keyof typeof cases] as (s: string) => {
          model: {
            c: {
              r: number;
              d: number;
              P: Pt;
              T: Pt;
              T2: Pt;
              M: Pt;
              quoted: boolean;
            };
          };
          problem: ReturnType<typeof generateProblem>;
        }
      )(`geo-${i}`);
      const { r, d, P, T, T2, M, quoted } = c.model.c;
      assert.ok(d >= 1.6 * r - 1e-9 && d <= 3 * r + 1e-9, `${r}, ${d}`);
      if (quoted) assert.ok(PYTHAGOREAN.some(([a, b]) => a === r && b === d));
      else assert.ok([3, 4, 5, 6].includes(r));
      const els = elements(c.problem);
      const given = el(els, "given")!;
      assert.equal(given.r, r);
      const pp = el(els, "pp")!.at!;
      assert.ok(Math.abs(Math.hypot(...pp) - d) < 1e-9, "OP drawn to scale");
      for (const X of [T, T2]) {
        assert.ok(Math.abs(Math.hypot(...X) - r) < 1e-9, "on circle O");
        assert.ok(
          Math.abs(Math.hypot(X[0] - M[0], X[1] - M[1]) - d / 2) < 1e-9,
          "on the circle with diameter OP",
        );
        const dot = X[0] * (P[0] - X[0]) + X[1] * (P[1] - X[1]);
        assert.ok(Math.abs(dot) < 1e-9, "OT ⊥ PT");
        assert.ok(Math.abs(distO(P, X) - r) < 1e-9, "line PT is at distance r");
      }
      const apart =
        (Math.acos((T[0] * T2[0] + T[1] * T2[1]) / (r * r)) * 180) / Math.PI;
      assert.ok(apart >= 20, `${apart}`);
      // Lengths are quoted only for Pythagorean pairs, and then exactly.
      const prompt = c.problem.public.prompt;
      if (quoted) {
        assert.equal(Math.sqrt(d * d - r * r) % 1, 0);
        assert.ok(
          prompt.includes(`radius $${r}$`) && prompt.includes(`OP=${d}`),
        );
      } else
        assert.equal(
          /\d/.test(prompt.replace(/\$[^$]*\$/g, "").replace(/Step \d:/g, "")),
          false,
          prompt,
        );
    }
  }
});

test("which-line: only the keyed line is tangent; the others are the chord TT′, a line that misses, and a line through the center", () => {
  let n = 0;
  for (let i = 0; i < SEEDS && n < 300; i++) {
    const c = cases["tangent-construct-steps"](`line-${i}`, {
      ask: "which-line",
    });
    n++;
    const p = c.problem;
    const r = p.public.response;
    if (r.kind !== "choice") continue;
    const radius = c.model.c.r;
    const P = c.model.c.P;
    const els = elements(p);
    const lines = ["a", "b", "c", "d"].map((name) => {
      const s = el(els, `l${name}`)!;
      return { name, a: s.from!, b: s.to!, dist: distO(s.from!, s.to!) };
    });
    const keyed = r.options.find((o) => o.id === p.answer)!.label;
    for (const l of lines) {
      const isKey = keyed === `Line $${l.name}$`;
      assert.equal(
        Math.abs(l.dist - radius) < 1e-9,
        isKey,
        `${l.name}: ${l.dist} vs ${radius}`,
      );
      if (!isKey) {
        const onP =
          distO(
            [l.a[0] - P[0], l.a[1] - P[1]],
            [l.b[0] - P[0], l.b[1] - P[1]],
          ) < 1e-9;
        if (l.dist < 1e-9) assert.equal(onP, false, "the radius line misses P");
        else if (l.dist < radius) {
          // The chord of contact: far from tangent, and not through P.
          assert.ok(l.dist <= 0.85 * radius);
          assert.equal(onP, false);
        } else assert.ok(l.dist >= 1.5 * radius, "misses the circle");
        // Every decoy is at least 0.15r from tangency.
        assert.ok(Math.abs(l.dist - radius) >= 0.15 * radius);
      }
    }
    const throughP = lines.filter(
      (l) =>
        distO([l.a[0] - P[0], l.a[1] - P[1]], [l.b[0] - P[0], l.b[1] - P[1]]) <
        1e-9,
    );
    assert.equal(throughP.length, 2);
    const u: Pt = [
      throughP[0]!.b[0] - throughP[0]!.a[0],
      throughP[0]!.b[1] - throughP[0]!.a[1],
    ];
    const v: Pt = [
      throughP[1]!.b[0] - throughP[1]!.a[0],
      throughP[1]!.b[1] - throughP[1]!.a[1],
    ];
    assert.ok(dirAngle(u, v) >= 8);
  }
});

test("next step: each wrong claim about tangent points is false for its own circle", () => {
  for (let i = 0; i < 1500; i++) {
    const c = cases["tangent-construct-steps"](`next-${i}`, {
      ask: "next-step",
    });
    const { r, d } = c.model.c;
    const r0 = c.problem.public.response;
    if (r0.kind !== "choice") continue;
    const labels = r0.options.map((o) => o.label);
    // Crossings of circle O with a circle at distance e from O, radius q,
    // are tangent points exactly when they lie on the circle with diameter
    // OP: compare the x-coordinate along OP with the tangent point's r²/d.
    const tangentX = (r * r) / d;
    const check = (e: number, q: number, along: number) => {
      // Circle centered `along`·e on ray OP; crossing x solves
      // x² + y² = r², (x - e)² + y² = q².
      const x = (r * r - q * q + e * e) / (2 * e);
      if (Math.abs(x) > r) return; // no crossing: the claim fails
      assert.ok(
        Math.abs(x - tangentX) > 1e-6,
        `${along}: crossing is a tangent point`,
      );
    };
    for (const l of labels) {
      if (l.startsWith("Draw the circle with center $P$ through $O$"))
        check(d, d, 1);
      if (
        l.startsWith(
          "Draw the circle with center $M$ and the radius of circle $O$",
        )
      ) {
        assert.notEqual(
          d,
          2 * r,
          "offered only when it is not the circle on OP",
        );
        check(d / 2, r, 0.5);
      }
      if (
        l.startsWith(
          "Draw the circle with center $P$ and the radius of circle $O$",
        )
      )
        check(d, r, 1);
      if (l.startsWith("Draw the circle with center $P$ through $M$"))
        check(d, d / 2, 1);
    }
    const correct = r0.options.find((o) => o.id === c.problem.answer)!.label;
    const expected = [
      "Construct the perpendicular bisector",
      "Draw the circle with center $M$ through $O$",
      "Mark the points $T$ and $T'$",
      "Draw the line through $P$ and $T$",
    ][c.model.k]!;
    assert.ok(correct.startsWith(expected), correct);
  }
});

test("order steps: the key is the canonical order and never uses the decoy", () => {
  for (let i = 0; i < 400; i++) {
    const p = cases["tangent-construct-steps"](`order-${i}`, {
      ask: "order-steps",
    }).problem;
    const r = p.public.response;
    if (r.kind !== "choice") continue;
    const listed = [
      ...p.public.prompt.matchAll(/Step (\d): (.*?\.)(?= Step \d:| Which)/g),
    ].map((m) => [Number(m[1]), m[2]!] as const);
    assert.equal(listed.length, 5, p.public.prompt);
    const num = (start: string) =>
      listed.find(([, t]) => t.startsWith(start))![0];
    const canonical = [
      num("Construct the perpendicular bisector"),
      num("Draw the circle with center $M$"),
      num("Mark the points"),
      num("Draw line $PT$"),
    ];
    const decoy = [1, 2, 3, 4, 5].find((k) => !canonical.includes(k))!;
    const key = r.options.find((o) => o.id === p.answer)!.label;
    assert.equal(key, `$${canonical.join(",\\ ")}$`);
    for (const o of r.options) {
      const used = [...o.label.matchAll(/\d/g)].map((m) => Number(m[0]));
      assert.equal(used.length, 4);
      if (o.id !== p.answer)
        assert.ok(used.includes(decoy) || used.join() !== canonical.join());
    }
  }
});

test("find-flaw figures show the faulty line as described", () => {
  const scripts = new Set<string>();
  for (let i = 0; i < 600; i++) {
    const c = cases["tangent-construct-justify"](`flaw-${i}`, {
      ask: "find-flaw",
    });
    const m = c.model;
    scripts.add(m.script);
    const { a, b } = m.faulty!;
    const dist = distO(a, b);
    if (m.script === "ana")
      assert.ok(dist < m.c.r - 1e-6, "Ana's line crosses circle O");
    if (m.script === "ben")
      assert.ok(dist < 1e-9, "Ben's line passes through O");
    if (m.script === "cara")
      assert.ok(dist > m.c.r, "Cara's line misses circle O");
  }
  assert.equal(scripts.size, 3);
});

test("hints name the instance and never quote the keyed option", () => {
  for (const id of ids)
    for (let i = 0; i < 60; i++) {
      const p = generateProblem(id, `hint-${i}`);
      const r = p.public.response;
      if (r.kind === "choice") {
        const key = r.options.find((o) => o.id === p.answer)!.label;
        assert.equal(p.hint.includes(key), false, p.hint);
      }
    }
});
