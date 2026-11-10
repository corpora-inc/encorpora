import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generatedProblemSchema,
  type GeneratedProblem,
} from "../src/math/contracts";
import { gradeAnswer } from "../src/math/engine";
import {
  congruenceRigidMotionCases,
  congruenceRigidMotionGenerate,
  congruenceRigidMotionTemplates,
} from "../src/math/congruence-rigid-motion-practice";
import {
  reasonMisconception,
  type ReasonKey,
} from "../src/math/congruence-rigid-motion-kit";
import {
  gradeStructuredWork,
  type StructuredWorkResponse,
} from "../src/math/structured-work";
import type { MultiPartChoiceResponse } from "../src/math/multi-part-choice";
import { chooseOption } from "../src/math/multi-part-choice";

/* ------------------------------------------------ independent geometry */

type P = [number, number];
const sub = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1]];
const add = (a: P, b: P): P => [a[0] + b[0], a[1] + b[1]];
const cross = (u: P, v: P) => u[0] * v[1] - u[1] * v[0];
const dot = (u: P, v: P) => u[0] * v[0] + u[1] * v[1];
const len = (u: P) => Math.hypot(u[0], u[1]);
const near = (a: P, b: P, eps = 1e-7) => len(sub(a, b)) < eps;
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

type Roles = Record<"A" | "B" | "C" | "D" | "E" | "F", P>;
/** Vertex positions read from the public figure (the name labels). */
function figurePoints(p: GeneratedProblem): Roles {
  const fig = p.public.figure as {
    scene: { elements: { id?: string; at?: P }[] };
  };
  const at = (r: string) =>
    fig.scene.elements.find((e) => e.id === `n${r}`)!.at!;
  return {
    A: at("A"),
    B: at("B"),
    C: at("C"),
    D: at("D"),
    E: at("E"),
    F: at("F"),
  };
}
/** The construction, computed here from the figure alone: translate A to
 * D, rotate about D so the image of B is on ray DE, reflect over DE when
 * the orientations differ. Returns every intermediate image. */
function construct(X: Roles) {
  const v = sub(X.D, X.A);
  const t = Math.atan2(
    cross(sub(X.B, X.A), sub(X.E, X.D)),
    dot(sub(X.B, X.A), sub(X.E, X.D)),
  );
  const image = (q: P) => add(X.D, rot(sub(add(q, v), X.D), t));
  const B1 = image(X.B),
    C1 = image(X.C);
  const opposite =
    Math.sign(cross(sub(X.B, X.A), sub(X.C, X.A))) !==
    Math.sign(cross(sub(X.E, X.D), sub(X.F, X.D)));
  const C2 = opposite ? mirror(C1, X.D, X.E) : C1;
  return { A1: image(X.A), B1, C1, C2, opposite };
}

const N = 600;
const sweep = (id: string, n = N) =>
  Array.from({ length: n }, (_, i) =>
    congruenceRigidMotionGenerate(id, `crm-${i}`),
  );

test("every template is deterministic and valid", () => {
  for (const t of congruenceRigidMotionTemplates) {
    assert.equal(t.skillId, "congruence-criteria");
    for (let i = 0; i < 60; i++) {
      const a = congruenceRigidMotionGenerate(t.id, `det-${i}`);
      const b = congruenceRigidMotionGenerate(t.id, `det-${i}`);
      assert.deepEqual(a, b, `${t.id} det-${i}`);
      generatedProblemSchema.parse(a);
      assert.ok(gradeAnswer(a, a.answer), `${t.id} det-${i}: key credited`);
      assert.ok(a.hint.length > 40 && a.explanation.length >= 3);
    }
  }
});

/* ============================== six-parts-imply-rigid-motion-proof */

const PROOF = "six-parts-imply-rigid-motion-proof";
/** Lines each statement truly needs above it (geometric reasons):
 * the angle at D needs only B' on ray DE and C on F's side; the angle at E
 * needs B' = E; the conclusion needs both B' = E and C's landing. */
const NEEDS: Record<string, Record<string, string[]>> = {
  sas: {
    tr: [],
    be: ["tr"],
    or: ["tr"],
    ray: ["or"],
    pin: ["ray"],
    conc: ["be", "pin"],
  },
  asa: {
    tr: [],
    be: ["tr"],
    or: ["tr"],
    rays: ["or", "be"],
    pin: ["rays"],
    conc: ["be", "pin"],
  },
};
function topoOrders(needs: Record<string, string[]>): string[] {
  const keys = Object.keys(needs);
  const out: string[] = [];
  const go = (done: string[]) => {
    if (done.length === keys.length) return void out.push(done.join(","));
    for (const k of keys)
      if (!done.includes(k) && needs[k]!.every((x) => done.includes(x)))
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

test("six-parts proof: every family and task is reached; the figure, orientation and construction agree", () => {
  const seen = new Set<string>();
  for (let i = 0; i < N; i++) {
    const c = congruenceRigidMotionCases[PROOF](`crm-${i}`);
    const p = c.problem;
    seen.add(`${p.variant!.id}/${c.axes.mode}`);
    const X = figurePoints(p);
    // Congruent, scalene, drawn to scale.
    const sides = [len(sub(X.B, X.A)), len(sub(X.C, X.B)), len(sub(X.A, X.C))];
    const match = [len(sub(X.E, X.D)), len(sub(X.F, X.E)), len(sub(X.D, X.F))];
    sides.forEach((s, k) => assert.ok(Math.abs(s - match[k]!) < 1e-9));
    assert.equal(new Set(sides.map((s) => s.toFixed(6))).size, 3);
    const k = construct(X);
    assert.ok(
      near(k.A1, X.D) && near(k.B1, X.E) && near(k.C2, X.F),
      `${i}: motions land`,
    );
    // The reflection rows appear iff the drawn orientations differ, and the
    // prompt states the drawn orientations.
    const reflect = p.variant!.id.startsWith("reflect");
    assert.equal(reflect, k.opposite);
    const ccw = (a: P, b: P, q: P) =>
      cross(sub(b, a), sub(q, a)) > 0 ? "counterclockwise" : "clockwise";
    const m = p.public.prompt.match(
      /runs (counterclockwise|clockwise) and .*? runs (counterclockwise|clockwise)/,
    )!;
    assert.deepEqual([m[1], m[2]], [ccw(X.A, X.B, X.C), ccw(X.D, X.E, X.F)]);
    // Each line's statement is true of the figure.
    assert.ok(onRay(X.D, X.E, k.B1), "tr: image of B on ray DE");
    const side = (q: P) => Math.sign(cross(sub(X.E, X.D), sub(q, X.D)));
    assert.equal(side(k.C1) === side(X.F), !k.opposite, "or: side of line DE");
    assert.equal(side(k.C2), side(X.F));
    assert.ok(
      Math.abs(angleAt(X.D, X.E, k.C2) - angleAt(X.A, X.B, X.C)) < 1e-9,
      "ray: angle at D",
    );
    assert.ok(onRay(X.D, X.F, k.C2) && onRay(X.E, X.F, k.C2), "ray(s)");
    assert.ok(
      Math.abs(len(sub(k.C2, X.D)) - len(sub(X.C, X.A))) < 1e-9,
      "pin: DC* = AC",
    );
  }
  for (const v of [
    "no-reflect-side",
    "reflect-side",
    "no-reflect-angle",
    "reflect-angle",
  ])
    for (const mode of ["build", "fill", "order"])
      assert.ok(seen.has(`${v}/${mode}`), `${v}/${mode} reached`);
});

test("six-parts proof: every valid order is credited and no other", () => {
  let multi = 0;
  for (let i = 0; i < 400; i++) {
    const c = congruenceRigidMotionCases[PROOF](`crm-${i}`);
    if (c.axes.mode !== "order") continue;
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
    const expected = topoOrders(NEEDS[c.model.path]!);
    assert.deepEqual(credited, expected, `crm-${i}`);
    if (expected.length > 1) multi++;
  }
  assert.ok(multi > 10, "orders with more than one valid sequence occur");
});

test("six-parts proof: each line has exactly one correct reason, decoys are never credited, and the definition ends the proof", () => {
  for (let i = 0; i < 300; i++) {
    const c = congruenceRigidMotionCases[PROOF](`crm-${i}`);
    if (c.axes.mode !== "build") continue;
    const p = c.problem;
    const r = p.public.response as StructuredWorkResponse;
    const key = JSON.parse(p.answer) as [string, string][];
    const reasons = r.banks[1]!.options.map((o) => o.id);
    const statements = r.banks[0]!.options.map((o) => o.id);
    assert.ok(gradeStructuredWork(r, p.workGrading!, p.answer));
    key.forEach(([, reason], row) => {
      const ok = reasons.filter((x) => {
        const next = key.map((pair, j) => (j === row ? [pair[0], x] : pair));
        return gradeStructuredWork(r, p.workGrading!, JSON.stringify(next));
      });
      assert.deepEqual(ok, [reason], `crm-${i} row ${row + 1}`);
    });
    // Decoy statements (not in the script) are never accepted on any line.
    const scriptIds = new Set(key.map(([s]) => s));
    for (const decoy of statements.filter((s) => !scriptIds.has(s)))
      key.forEach((_, row) => {
        const next = key.map((pair, j) =>
          j === row ? [decoy, pair[1]] : pair,
        );
        assert.equal(
          gradeStructuredWork(r, p.workGrading!, JSON.stringify(next)),
          false,
        );
      });
    // The last reason is the definition; CPCTC and the criterion are never
    // a correct reason.
    const label = (id: string) =>
      r.banks[1]!.options.find((o) => o.id === id)!.label;
    assert.match(label(key.at(-1)![1]), /^Definition of congruence/);
    for (const [, reason] of key)
      assert.doesNotMatch(label(reason), /CPCTC|criterion/);
  }
});

test("six-parts proof: decoys are false for the drawn figure, and every distractor reason names its misconception", () => {
  const tagged = new Set(Object.keys(reasonMisconception) as ReasonKey[]);
  for (let i = 0; i < 200; i++) {
    const c = congruenceRigidMotionCases[PROOF](`crm-${i}`);
    const X = figurePoints(c.problem);
    // "Translate so AB lands on DE" is impossible: DE is not a translate of AB.
    assert.ok(!near(sub(X.B, X.A), sub(X.E, X.D), 0.1));
    // "Rotate about D until B lands on E" is impossible: DB ≠ DE.
    assert.ok(Math.abs(len(sub(X.B, X.D)) - len(sub(X.E, X.D))) > 0.1);
    const r = c.problem.public.response as StructuredWorkResponse;
    const correct = new Set(c.model.script.map((s) => s.reason));
    const reasonCount = r.banks[1]!.options.length;
    assert.equal(reasonCount, correct.size + 4);
    for (const key of correct)
      assert.ok(!tagged.has(key), `${key} is a correct reason`);
  }
  for (const key of [
    "cpctc",
    "criterion",
    "freeRotation",
    "reflectionKeepsOrientation",
    "dilation",
    "leap",
    "picture",
    "twoPoints",
  ] as ReasonKey[])
    assert.ok(tagged.has(key), `${key} names its misconception`);
  // Two points determine one line would justify the two-angle finish, so
  // it is never offered there.
  for (let i = 0; i < 300; i++) {
    const c = congruenceRigidMotionCases[PROOF](`crm-${i}`);
    const r = c.problem.public.response as StructuredWorkResponse;
    if (c.model.path === "asa")
      assert.ok(
        !r.banks[1]!.options.some((o) =>
          o.label.startsWith("Two points determine"),
        ),
      );
  }
});

/* ================================= congruence-definition-reasoning */

const REASON = "congruence-definition-reasoning";
const ALTERED: Record<string, number> = {
  center: 2,
  leap: 3,
  angles: 2,
  distance: 4,
  criterion: 5,
};

test("definition reasoning: variants, answers and distractors", () => {
  const problems = sweep(REASON, 1000);
  const seen = new Set(problems.map((p) => p.variant!.id));
  for (const v of [
    "forward-side",
    "forward-angle",
    "direction-forward",
    "direction-converse",
    "remains-forward",
    "remains-converse",
    "flaw-center",
    "flaw-leap",
    "flaw-angles",
    "flaw-distance",
    "flaw-criterion",
    "flaw-none",
  ])
    assert.ok(seen.has(v), v);
  let flaws = 0,
    none = 0,
    longest = 0;
  const positions = [0, 0, 0, 0];
  for (const p of problems) {
    const r = p.public.response;
    assert.equal(r.kind, "choice");
    if (r.kind !== "choice") continue;
    const correct = r.options.find((o) => o.id === p.answer)!;
    positions[r.options.indexOf(correct)]!++;
    const visible = (s: string) => s.replace(/\$|\\[a-z]+|[{}]/g, "").length;
    if (
      visible(correct.label) ===
      Math.max(...r.options.map((o) => visible(o.label)))
    )
      longest++;
    assert.deepEqual(
      Object.keys(p.choiceFeedback!).sort(),
      r.options
        .filter((o) => o.id !== p.answer)
        .map((o) => o.id)
        .sort(),
      "every wrong option has feedback",
    );
    const v = p.variant!.id;
    if (v.startsWith("forward")) {
      // The correct explanation names the landing of exactly the asked part.
      const side = p.public.prompt.match(
        /explain why \$\\overline\{(\w)(\w)\}\\cong\\overline\{(\w)(\w)\}\$/,
      );
      const ang = p.public.prompt.match(
        /explain why \$\\angle (\w)\\cong\\angle (\w)\$/,
      );
      if (side) {
        assert.ok(
          correct.label.includes(`$${side[1]}\\to ${side[3]}$`) &&
            correct.label.includes(`$${side[2]}\\to ${side[4]}$`),
          correct.label,
        );
        assert.match(correct.label, /keep length/);
      } else {
        assert.ok(ang, p.public.prompt);
        assert.ok(
          correct.label.startsWith(`$${ang![1]}\\to ${ang![2]}$`),
          correct.label,
        );
        assert.match(correct.label, /angle measure/);
      }
      assert.ok(!correct.label.includes("corresponding parts"));
    }
    if (v.startsWith("direction")) {
      const fwd = /Argument: A sequence of rigid motions maps/.test(
        p.public.prompt,
      );
      assert.equal(v, fwd ? "direction-forward" : "direction-converse");
      assert.equal(
        correct.label,
        fwd ? "If $P$, then $Q$." : "If $Q$, then $P$.",
      );
    }
    if (v.startsWith("remains")) {
      const fwd = v === "remains-forward";
      assert.ok(
        correct.label.startsWith(fwd ? "If $Q$, then $P$" : "If $P$, then $Q$"),
      );
    }
    if (v.startsWith("flaw")) {
      flaws++;
      const kind = v.slice(5);
      if (kind === "none") {
        none++;
        assert.equal(correct.label, "The argument is correct and complete.");
      } else {
        const n = ALTERED[kind]!;
        assert.ok(
          correct.label.startsWith(`Step ${n} is wrong`),
          correct.label,
        );
        assert.ok(p.public.prompt.includes(`Step ${n}:`));
      }
      // False accusations only name steps that are correct in this argument.
      for (const o of r.options)
        if (o.id !== p.answer && o.label.startsWith("Step")) {
          const n = Number(o.label.match(/^Step (\d)/)![1]);
          assert.notEqual(n, ALTERED[kind], o.label);
          assert.ok(p.public.prompt.includes(`Step ${n}:`), o.label);
        }
    }
  }
  assert.ok(
    none / flaws >= 0.15 && none / flaws <= 0.25,
    `no-flaw share ${none / flaws}`,
  );
  assert.ok(
    longest / problems.length <= 0.35,
    `correct is longest ${longest / problems.length}`,
  );
  for (const n of positions)
    assert.ok(n / problems.length > 0.18, `positions ${positions}`);
});

/* ============================ rigid-motion-from-six-parts-coordinates */

const COORD = "rigid-motion-from-six-parts-coordinates";
type I = [number, number];
const turnI = (v: I, t: number): I =>
  t === 0
    ? [v[0], v[1]]
    : t === 90
      ? [-v[1], v[0]]
      : t === 180
        ? [-v[0], -v[1]]
        : [v[1], -v[0]];
/** Reflection of w across the line through the origin with direction u. */
function mirrorI(w: I, u: I): I {
  const d = u[0] * u[0] + u[1] * u[1];
  const k = (2 * (w[0] * u[0] + w[1] * u[1])) / d;
  return [k * u[0] - w[0], k * u[1] - w[1]];
}

test("coordinates: the stated motions map A, B, C exactly onto D, E, F, and the key names them", () => {
  const combos = new Set<string>();
  let pure = 0;
  const problems = sweep(COORD, 1000);
  for (const p of problems) {
    const pts = [
      ...p.public.prompt.matchAll(/\$([A-Z])\((-?\d+),(-?\d+)\)\$/g),
    ].map((m) => [m[1]!, [Number(m[2]), Number(m[3])] as I] as const);
    assert.equal(pts.length, 6);
    const [A, B, C, D, E, F] = pts.map((x) => x[1]);
    const names = pts.map((x) => x[0]);
    assert.equal(new Set(names).size, 6);
    for (const n of names) assert.ok(!"IOQ".includes(n));
    for (const q of [A, B, C, D, E, F])
      assert.ok(Math.abs(q![0]) <= 8 && Math.abs(q![1]) <= 8);
    const v: I = [D![0] - A![0], D![1] - A![1]];
    assert.ok(v[0] !== 0 || v[1] !== 0);
    const ab: I = [B![0] - A![0], B![1] - A![1]];
    assert.ok(
      ab[0] === 0 || ab[1] === 0 || Math.abs(ab[0]) === Math.abs(ab[1]),
      "AB is a grid or diagonal direction",
    );
    const sq = (a: I, b: I) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
    assert.equal(new Set([sq(A!, B!), sq(B!, C!), sq(C!, A!)]).size, 3);
    // Bounding boxes are disjoint.
    const bx = (ps: I[]) => [
      Math.min(...ps.map((q) => q[0])),
      Math.max(...ps.map((q) => q[0])),
      Math.min(...ps.map((q) => q[1])),
      Math.max(...ps.map((q) => q[1])),
    ];
    const [a0, a1, a2, a3] = bx([A!, B!, C!]);
    const [d0, d1, d2, d3] = bx([D!, E!, F!]);
    assert.ok(a1! < d0! || d1! < a0! || a3! < d2! || d3! < a2!);
    // Find the turn about D and whether a reflection over DE follows.
    const de: I = [E![0] - D![0], E![1] - D![1]];
    const theta = [0, 90, 180, 270].find((t) => {
      const w = turnI(ab, t);
      return w[0] === de[0] && w[1] === de[1];
    })!;
    assert.ok(theta !== undefined);
    const ac: I = [C![0] - A![0], C![1] - A![1]];
    const c1 = turnI(ac, theta);
    const df: I = [F![0] - D![0], F![1] - D![1]];
    const reflect = !(c1[0] === df[0] && c1[1] === df[1]);
    if (reflect) {
      const c2 = mirrorI(c1, de);
      assert.ok(
        c2[0] === df[0] && c2[1] === df[1],
        "the reflection over DE lands C on F",
      );
    }
    const orient = (a: I, b: I, c: I) =>
      Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
    assert.equal(reflect, orient(A!, B!, C!) !== orient(D!, E!, F!));
    combos.add(`${theta}-${reflect}`);
    if (theta === 0 && !reflect) pure++;
    // The answer key, read from the public options.
    const r = p.public.response as MultiPartChoiceResponse;
    const key = JSON.parse(p.answer) as Record<string, string>;
    const chosen = (id: string) =>
      r.blanks.find((b) => b.id === id)!.options.find((o) => o.id === key[id])!
        .label;
    const mv = chosen("move").match(/\(x([+-]\d+)?,\\,y([+-]\d+)?\)\$$/)!;
    assert.deepEqual([Number(mv[1] ?? 0), Number(mv[2] ?? 0)], v);
    const [nD, nE] = [names[3]!, names[4]!];
    const turn = chosen("turn");
    if (theta === 0) assert.equal(turn, "No rotation is needed");
    else {
      assert.ok(turn.startsWith(`$${theta}^\\circ$`), turn);
      assert.ok(turn.endsWith(`about $${nD}$`), turn);
    }
    assert.equal(chosen("flip").startsWith("Yes"), reflect);
    assert.match(chosen("land"), new RegExp(`distance .*${nD}${nE}`));
    assert.match(chosen("pin"), /\\cong.*puts it on ray.*puts it at/);
    // Every other choice in a blank breaks the answer.
    for (const b of r.blanks)
      for (const o of b.options)
        if (o.id !== key[b.id])
          assert.equal(
            gradeAnswer(p, chooseOption(r, p.answer, b.id, o.id)),
            false,
          );
  }
  for (const t of [0, 90, 180, 270])
    for (const f of [true, false])
      assert.ok(combos.has(`${t}-${f}`), `${t}-${f}`);
  assert.ok(
    pure / problems.length <= 0.15,
    `pure translations ${pure / problems.length}`,
  );
});

test("coordinates: rotation distractors really fail", () => {
  for (const p of sweep(COORD, 300)) {
    const r = p.public.response as MultiPartChoiceResponse;
    const turn = r.blanks.find((b) => b.id === "turn")!;
    const found = [
      ...p.public.prompt.matchAll(/\$([A-Z])\((-?\d+),(-?\d+)\)\$/g),
    ];
    const pts = found.map((m) => [Number(m[2]), Number(m[3])] as I);
    const nE = found[4]![1]!;
    const [A, B, , D, E] = pts;
    const B1: I = [B![0] + D![0] - A![0], B![1] + D![1] - A![1]];
    const key = JSON.parse(p.answer) as Record<string, string>;
    for (const o of turn.options) {
      if (o.id === key.turn) continue;
      if (o.label === "No rotation is needed") {
        assert.ok(B1[0] !== E![0] || B1[1] !== E![1]);
        continue;
      }
      const t = Number(o.label.match(/^\$(\d+)\^/)![1]);
      const centerName = o.label.match(/about (.*)$/)![1]!;
      const center: I =
        centerName === "the origin"
          ? [0, 0]
          : centerName === `$${nE}$`
            ? E!
            : D!;
      const rotate = (q: I): I => {
        const w = turnI([q[0] - center[0], q[1] - center[1]], t);
        return [center[0] + w[0], center[1] + w[1]];
      };
      const Dm = rotate(D!),
        Bm = rotate(B1);
      assert.ok(
        !(
          Dm[0] === D![0] &&
          Dm[1] === D![1] &&
          Bm[0] === E![0] &&
          Bm[1] === E![1]
        ),
        o.label,
      );
    }
  }
});
