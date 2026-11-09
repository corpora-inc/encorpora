import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generatedProblemSchema,
  type GeneratedProblem,
} from "../src/math/contracts";
import { gradeAnswer } from "../src/math/engine";
import {
  congruenceCriterionProofCases,
  congruenceCriterionProofGenerate,
  congruenceCriterionProofTemplates,
} from "../src/math/congruence-criterion-proof-practice";
import {
  gradeStructuredWork,
  type StructuredWorkResponse,
} from "../src/math/structured-work";

/* ------------------------------------------------ independent geometry */

type P = [number, number];
const sub = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1]];
const add = (a: P, b: P): P => [a[0] + b[0], a[1] + b[1]];
const cross = (u: P, v: P) => u[0] * v[1] - u[1] * v[0];
const dot = (u: P, v: P) => u[0] * v[0] + u[1] * v[1];
const len = (u: P) => Math.hypot(u[0], u[1]);
const dist = (a: P, b: P) => len(sub(a, b));
const near = (a: P, b: P, eps = 1e-7) => dist(a, b) < eps;
const rot = (v: P, t: number): P => [
  v[0] * Math.cos(t) - v[1] * Math.sin(t),
  v[0] * Math.sin(t) + v[1] * Math.cos(t),
];
const mirror = (p: P, a: P, b: P): P => {
  const u = sub(b, a);
  const k = dot(sub(p, a), u) / dot(u, u);
  const foot = add(a, [u[0] * k, u[1] * k]);
  return [2 * foot[0] - p[0], 2 * foot[1] - p[1]];
};
const angleAt = (v: P, p: P, q: P) => {
  const a = sub(p, v),
    b = sub(q, v);
  return Math.acos(dot(a, b) / (len(a) * len(b)));
};
const onRay = (o: P, through: P, x: P) =>
  Math.abs(cross(sub(through, o), sub(x, o))) < 1e-7 &&
  dot(sub(through, o), sub(x, o)) > 0;
const turnSign = (a: P, b: P, c: P) => Math.sign(cross(sub(b, a), sub(c, a)));

type Roles = Record<"A" | "B" | "C" | "D" | "E" | "F", P>;
type Scene = {
  elements: { id?: string; at?: P; from?: P; to?: P; text?: string }[];
};
const sceneOf = (p: GeneratedProblem) =>
  (p.public.figure as { scene: Scene }).scene;
function figurePoints(p: GeneratedProblem): Roles {
  const at = (r: string) =>
    sceneOf(p).elements.find((e) => e.id === `n${r}`)!.at!;
  return {
    A: at("A"),
    B: at("B"),
    C: at("C"),
    D: at("D"),
    E: at("E"),
    F: at("F"),
  };
}
function construct(X: Roles) {
  const v = sub(X.D, X.A);
  const t = Math.atan2(
    cross(sub(X.B, X.A), sub(X.E, X.D)),
    dot(sub(X.B, X.A), sub(X.E, X.D)),
  );
  const image = (q: P) => add(X.D, rot(sub(add(q, v), X.D), t));
  const opposite = turnSign(X.A, X.B, X.C) !== turnSign(X.D, X.E, X.F);
  const C1 = image(X.C);
  return {
    A1: image(X.A),
    B1: image(X.B),
    C1,
    C2: opposite ? mirror(C1, X.D, X.E) : C1,
    opposite,
  };
}

const gen = congruenceCriterionProofGenerate;
const sweep = (id: string, n: number) =>
  Array.from({ length: n }, (_, i) => gen(id, `ccp-${i}`));

test("every template is deterministic and valid", () => {
  for (const t of congruenceCriterionProofTemplates) {
    assert.equal(t.skillId, "congruence-criteria");
    for (let i = 0; i < 60; i++) {
      const a = gen(t.id, `det-${i}`);
      assert.deepEqual(a, gen(t.id, `det-${i}`), `${t.id} det-${i}`);
      generatedProblemSchema.parse(a);
      assert.ok(gradeAnswer(a, a.answer), `${t.id} det-${i}: key credited`);
      assert.ok(a.hint.length > 40 && a.explanation.length >= 3);
    }
  }
});

/* ======================================= rigid-motion-criterion-proof */

const PROOF = "rigid-motion-criterion-proof";
/** What each line needs above it, from the geometry: the rotation puts B'
 * on ray DE, which is all the orientation line and the angle at D need;
 * the angle at E and the circle about E need B' = E; C'' exists only
 * after the reflection line. */
function needs(path: string, opposite: boolean): Record<string, string[]> {
  const common = { tr: [], be: ["tr"], or: ["tr"], conc: ["be", "pin"] };
  if (path === "sas") return { ...common, ray: ["or"], pin: ["ray"] };
  if (path === "asa") return { ...common, rays: ["or", "be"], pin: ["rays"] };
  return {
    ...common,
    circ: opposite ? ["or", "be"] : ["be"],
    pin: ["circ", "or"],
  };
}
function topoOrders(n: Record<string, string[]>): string[] {
  const keys = Object.keys(n);
  const out: string[] = [];
  const go = (done: string[]) => {
    if (done.length === keys.length) return void out.push(done.join(","));
    for (const k of keys)
      if (!done.includes(k) && n[k]!.every((x) => done.includes(x)))
        go([...done, k]);
  };
  go([]);
  return out.sort();
}
function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) =>
    permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((rest) => [
      x,
      ...rest,
    ]),
  );
}

test("criterion proof: every criterion, orientation and task; the givens hold and every line is true of the figure", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 600; i++) {
    const c = congruenceCriterionProofCases[PROOF](`ccp-${i}`);
    const p = c.problem;
    seen.add(`${c.axes.criterion}/${c.axes.orientation}/${c.axes.task}`);
    const X = figurePoints(p);
    const k = construct(X);
    assert.equal(k.opposite, c.axes.orientation === "opposite");
    assert.ok(near(k.A1, X.D) && near(k.B1, X.E) && near(k.C2, X.F));
    assert.ok(onRay(X.D, X.E, k.B1));
    const side = (q: P) => Math.sign(cross(sub(X.E, X.D), sub(q, X.D)));
    assert.equal(side(k.C1) === side(X.F), !k.opposite);
    assert.ok(
      Math.abs(angleAt(X.D, X.E, k.C2) - angleAt(X.A, X.B, X.C)) < 1e-9,
    );
    assert.ok(Math.abs(dist(X.D, k.C2) - dist(X.A, X.C)) < 1e-9);
    assert.ok(Math.abs(dist(X.E, k.C2) - dist(X.B, X.C)) < 1e-9);
    // The circles about D and E meet in F and in F's mirror across DE:
    // exactly one on each side.
    const Fm = mirror(X.F, X.D, X.E);
    assert.ok(
      Math.abs(dist(X.D, Fm) - dist(X.D, X.F)) < 1e-9 &&
        side(Fm) === -side(X.F),
    );
    // Angles of the drawn triangle stay in [30°, 110°].
    for (const [v, a, b] of [
      ["A", "B", "C"],
      ["B", "C", "A"],
      ["C", "A", "B"],
    ] as const) {
      const deg = (angleAt(X[v], X[a], X[b]) * 180) / Math.PI;
      assert.ok(deg >= 30 - 1e-9 && deg <= 110 + 1e-9, `${deg}`);
    }
    // The prompt lists exactly the criterion's three givens.
    const givens = p.public.prompt.match(/Given: (.*?);/)![1]!;
    const count = (givens.match(/\\cong/g) ?? []).length;
    assert.equal(count, 3);
  }
  for (const cr of ["sas", "asa", "sss"])
    for (const o of ["same", "opposite"])
      for (const t of ["order", "statements", "reasons"])
        assert.ok(seen.has(`${cr}/${o}/${t}`), `${cr}/${o}/${t}`);
});

test("criterion proof: every valid order is credited and no other", () => {
  let multi = 0;
  for (let i = 0; i < 400; i++) {
    const c = congruenceCriterionProofCases[PROOF](`ccp-${i}`);
    if (c.axes.task !== "order") continue;
    const p = c.problem;
    const r = p.public.response as StructuredWorkResponse;
    const keyOf = new Map(
      r.banks[0]!.options.map((o) => [
        o.id,
        c.model.script.find((s) => s.tex === o.label)?.key,
      ]),
    );
    const rowKey = new Map(
      r.rows.map((row) => [row.id, keyOf.get(row.fields[0]!.given!)!]),
    );
    const credited = permutations(r.rows.map((x) => x.id))
      .filter((order) =>
        gradeStructuredWork(r, p.workGrading!, JSON.stringify(order)),
      )
      .map((order) => order.map((id) => rowKey.get(id)).join(","))
      .sort();
    const expected = topoOrders(needs(c.model.path, c.model.pair.opposite));
    assert.deepEqual(credited, expected, `ccp-${i}`);
    if (expected.length > 1) multi++;
  }
  assert.ok(multi > 10);
});

test("criterion proof: each blank has exactly one credited choice; decoys and phantom givens are never credited", () => {
  let phantoms = 0;
  for (let i = 0; i < 600; i++) {
    const c = congruenceCriterionProofCases[PROOF](`ccp-${i}`);
    if (c.axes.task === "order") continue;
    const p = c.problem;
    const r = p.public.response as StructuredWorkResponse;
    const key = JSON.parse(p.answer) as [string, string][];
    const fill = (row: number, field: 0 | 1, value: string) =>
      JSON.stringify(
        key.map((pair, j) =>
          j === row
            ? field === 0
              ? [value, pair[1]]
              : [pair[0], value]
            : pair,
        ),
      );
    const blankRows = r.rows.flatMap((row, j) =>
      row.fields.some((f) => f.given === undefined) ? [j] : [],
    );
    if (c.axes.task === "statements") {
      // Two statement blanks, one of them a finish line of this criterion.
      assert.equal(blankRows.length, 2);
      assert.ok(blankRows.some((j) => j === 3 || j === 4));
      assert.ok(!blankRows.includes(0) && !blankRows.includes(5));
      for (const j of blankRows) {
        const ok = r.banks[0]!.options.filter((o) =>
          gradeStructuredWork(r, p.workGrading!, fill(j, 0, o.id)),
        );
        assert.deepEqual(
          ok.map((o) => o.id),
          [key[j]![0]],
          `ccp-${i} row ${j + 1}`,
        );
      }
      // A phantom decoy, when offered, uses a pair the criterion does not give.
      const L = c.model.L;
      const phantom =
        c.model.path === "sas"
          ? `m\\angle ${L.B}=m\\angle ${L.E}`
          : c.model.path === "asa"
            ? `${L.A}${L.C}=${L.D}${L.F}`
            : `m\\angle ${L.A}=m\\angle ${L.D}`;
      const decoy = r.banks[0]!.options.find((o) => o.label.includes(phantom));
      if (decoy) {
        phantoms++;
        assert.ok(!c.model.script.some((s) => s.tex === decoy.label));
      }
    } else {
      assert.ok(blankRows.length >= 3);
      for (const j of blankRows) {
        const ok = r.banks[1]!.options.filter((o) =>
          gradeStructuredWork(r, p.workGrading!, fill(j, 1, o.id)),
        );
        assert.deepEqual(
          ok.map((o) => o.id),
          [key[j]![1]],
          `ccp-${i} row ${j + 1}`,
        );
        assert.doesNotMatch(ok.map((o) => o.label).join(), /CPCTC|criterion/);
      }
    }
    // The last line concludes by the definition.
    const lastReason = r.rows.at(-1)!.fields[1]!.given ?? key.at(-1)![1];
    assert.match(
      r.banks[1]!.options.find((o) => o.id === lastReason)!.label,
      /^Definition of congruence/,
    );
  }
  assert.ok(phantoms > 20, `${phantoms} phantom decoys`);
});

/* ====================================== rigid-motion-criterion-reason */

const REASON = "rigid-motion-criterion-reason";
const GIVEN_OF: Record<string, (path: string) => string | null> = {
  tr: () => null,
  be: () => "AB",
  ray: () => "A",
  "ray-e": () => "B",
  "circ-d": () => "CA",
  "circ-e": () => "BC",
  pin: (path) => (path === "sas" ? "CA" : null),
};

test("criterion reasons: every question; the given, the side and the criterion are right", () => {
  const problems = Array.from({ length: 1200 }, (_, i) =>
    congruenceCriterionProofCases[REASON](`ccp-${i}`),
  );
  const seen = new Set(
    problems.map((c) => c.problem.variant!.id.replace(/-(sas|asa|sss)/, "")),
  );
  for (const v of [
    "justify-be",
    "justify-or",
    "justify-ray",
    "justify-pin",
    "given-tr",
    "given-be",
    "given-ray",
    "given-ray-e",
    "given-circ-d",
    "given-circ-e",
    "given-pin",
    "reflect-yes",
    "reflect-no",
    "which",
    "which-gap",
  ])
    assert.ok(seen.has(v), v);
  let which = 0,
    gaps = 0,
    reflectYes = 0,
    reflects = 0;
  for (const c of problems) {
    const p = c.problem;
    const r = p.public.response;
    if (r.kind !== "choice") throw new Error("choice");
    const correct = r.options.find((o) => o.id === p.answer)!;
    const L = c.model.L;
    const X = figurePoints(p);
    if (c.axes.question === "given") {
      const g = GIVEN_OF[c.model.step]!(c.model.path);
      const tex: Record<string, string> = {
        AB: `$\\overline{${L.A}${L.B}}\\cong\\overline{${L.D}${L.E}}$`,
        BC: `$\\overline{${L.B}${L.C}}\\cong\\overline{${L.E}${L.F}}$`,
        CA: `$\\overline{${L.C}${L.A}}\\cong\\overline{${L.F}${L.D}}$`,
        A: `$\\angle ${L.A}\\cong\\angle ${L.D}$`,
        B: `$\\angle ${L.B}\\cong\\angle ${L.E}$`,
      };
      assert.equal(correct.label, g ? tex[g] : "No given pair.");
    }
    if (c.axes.question === "reflect") {
      reflects++;
      const opposite = turnSign(X.A, X.B, X.C) !== turnSign(X.D, X.E, X.F);
      if (opposite) reflectYes++;
      assert.equal(correct.label.startsWith("Across"), opposite);
      assert.ok(
        !/clockwise/.test(p.public.prompt),
        "the prompt does not state the orientation",
      );
    }
    if (c.axes.question === "which") {
      which++;
      if (c.model.gap) gaps++;
      assert.equal(
        correct.label,
        c.model.gap
          ? "None: the finish has a gap."
          : c.model.path.toUpperCase(),
      );
    }
    if (c.axes.question === "justify") {
      // Anti-gaming: the correct option's length is near the distractors'.
      const words = (s: string) => s.split(/\s+/).length;
      const others = r.options
        .filter((o) => o.id !== p.answer)
        .map((o) => words(o.label));
      const mean = others.reduce((s, n) => s + n, 0) / others.length;
      assert.ok(
        Math.abs(words(correct.label) - mean) <= 0.25 * mean,
        `${correct.label} vs ${mean}`,
      );
    }
  }
  assert.ok(
    gaps / which >= 0.2 && gaps / which <= 0.3,
    `gap share ${gaps / which}`,
  );
  assert.ok(reflectYes / reflects >= 0.4 && reflectYes / reflects <= 0.6);
});

/* ======================================= rigid-motion-criterion-flaw */

const FLAW = "rigid-motion-criterion-flaw";
const PLANTED_LINE: Record<string, number> = {
  "planted-segment": 1,
  "planted-any-point": 2,
  "planted-move-line": 3,
  "planted-assume-side": 3,
  "planted-phantom": 5,
  "planted-circular": 5,
};

test("criterion flaws: the planted line, SSA's two meets and AAA's scaled copy", () => {
  const problems = sweep(FLAW, 1000);
  const seen = new Set(problems.map((p) => p.variant!.id));
  for (const v of [...Object.keys(PLANTED_LINE), "ssa", "aaa"])
    assert.ok(seen.has(v), v);
  let longest = 0;
  const positions = [0, 0, 0, 0];
  for (const p of problems) {
    const r = p.public.response;
    if (r.kind !== "choice") throw new Error("choice");
    const correct = r.options.find((o) => o.id === p.answer)!;
    positions[r.options.indexOf(correct)]!++;
    const visible = (s: string) => s.replace(/\$|\\[a-z]+|[{}]/g, "").length;
    if (
      visible(correct.label) ===
      Math.max(...r.options.map((o) => visible(o.label)))
    )
      longest++;
    const v = p.variant!.id;
    const X = figurePoints(p);
    if (v.startsWith("planted")) {
      const n = PLANTED_LINE[v]!;
      assert.ok(correct.label.startsWith(`Line ${n} is wrong`), correct.label);
      // Other accusations name correct lines, or the planted line for a
      // wrong reason.
      for (const o of r.options)
        if (o.id !== p.answer) assert.match(o.label, /^Line [1-6] is wrong/);
      const k = construct(X);
      assert.ok(near(k.C2, X.F), "the triangles are congruent");
    } else if (v === "ssa") {
      // AB ≅ DE, BC ≅ EF, ∠A ≅ ∠D, but AC ≠ DF.
      assert.ok(Math.abs(dist(X.A, X.B) - dist(X.D, X.E)) < 1e-9);
      assert.ok(Math.abs(dist(X.B, X.C) - dist(X.E, X.F)) < 1e-9);
      assert.ok(
        Math.abs(angleAt(X.A, X.B, X.C) - angleAt(X.D, X.E, X.F)) < 1e-9,
      );
      assert.ok(Math.abs(dist(X.A, X.C) - dist(X.D, X.F)) > 0.3);
      // The circle about E of radius EF meets ray DF twice exactly when
      // AB·sin A < BC < AB (the side next to the given angle is AB).
      const AB = dist(X.A, X.B),
        BC = dist(X.B, X.C),
        A = angleAt(X.A, X.B, X.C);
      assert.ok(AB * Math.sin(A) < BC && BC < AB, "ambiguous SSA");
      // The dashed point: on ray DF, as far from D as C is from A, and as
      // far from E as F is: the second meet.
      const dashed = sceneOf(p).elements.find((e) => e.id === "xEP")!;
      const Pt = dashed.to!;
      assert.ok(near(dashed.from!, X.E));
      assert.ok(onRay(X.D, X.F, Pt));
      assert.ok(Math.abs(dist(X.E, Pt) - dist(X.E, X.F)) < 1e-7);
      assert.ok(Math.abs(dist(X.D, Pt) - dist(X.A, X.C)) < 1e-7);
      assert.ok(dist(Pt, X.F) > 0.3);
      assert.ok(correct.label.startsWith("Line 5:"), correct.label);
    } else {
      // AAA: equal angles, sides in one ratio other than 1.
      for (const [a, b, c, d, e, f] of [
        ["A", "B", "C", "D", "E", "F"],
        ["B", "C", "A", "E", "F", "D"],
        ["C", "A", "B", "F", "D", "E"],
      ] as const)
        assert.ok(
          Math.abs(angleAt(X[a], X[b], X[c]) - angleAt(X[d], X[e], X[f])) <
            1e-9,
        );
      const k = dist(X.A, X.B) / dist(X.D, X.E);
      assert.ok(Math.abs(k - 1) > 0.2);
      assert.ok(Math.abs(dist(X.B, X.C) / dist(X.E, X.F) - k) < 1e-9);
      // The dashed copy at D: B' on ray DE but not at E.
      const dashed = sceneOf(p).elements.find((e) => e.id === "xDB")!;
      assert.ok(onRay(X.D, X.E, dashed.to!) && dist(dashed.to!, X.E) > 0.3);
      assert.ok(correct.label.startsWith("Line 2:"), correct.label);
    }
  }
  assert.ok(
    longest / problems.length <= 0.35,
    `correct longest ${longest / problems.length}`,
  );
  for (const n of positions)
    assert.ok(n / problems.length > 0.15, `positions ${positions}`);
});
