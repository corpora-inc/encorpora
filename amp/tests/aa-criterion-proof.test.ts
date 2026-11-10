import { reportEditorialLimit } from "./fixtures/editorial";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generatedProblemSchema,
  type GeneratedProblem,
} from "../src/math/contracts";
import {
  aaCriterionCases,
  aaCriterionGenerate,
  aaCriterionTemplates,
  drawSetup,
} from "../src/math/aa-criterion-proof-practice";
import { random } from "../src/math/distribution-practice";
import {
  gradeStructuredWork,
  type StructuredWorkResponse,
} from "../src/math/structured-work";
import type { Scene } from "../src/math/scene/spec";

type P = [number, number];
const angle = (x: P, y: P, z: P) => {
  const a: P = [x[0] - y[0], x[1] - y[1]];
  const b: P = [z[0] - y[0], z[1] - y[1]];
  return (
    (Math.acos(
      (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b)),
    ) *
      180) /
    Math.PI
  );
};
const dist = (a: P, b: P) => Math.hypot(a[0] - b[0], a[1] - b[1]);

const build = aaCriterionCases["aa-criterion-proof-build"];
const step = aaCriterionCases["aa-criterion-step-reason"];
const argue = aaCriterionCases["aa-criterion-argument-check"];

/** Named points of the figure, by role: the letters come from the prompt's
 * givens "∠X ≅ ∠U and ∠Y ≅ ∠V" and the two triangle names. */
function roles(p: GeneratedProblem) {
  const scene = (p.public.figure as { kind: "scene"; scene: Scene }).scene;
  const at = new Map<string, P>();
  for (const e of scene.elements)
    if (e.type === "text" && e.id && /^n[A-F]\d?$/.test(e.id))
      at.set(e.text, e.at as P);
  const g = p.public.prompt.match(
    /\\angle (\w)\\cong\\angle (\w)\$ and \$\\angle (\w)\\cong\\angle (\w)\$/,
  )!;
  const [A, D, B, E] = [g[1]!, g[2]!, g[3]!, g[4]!];
  const tris = [...p.public.prompt.matchAll(/\\triangle (\w)(\w)(\w)/g)].map(
    (m) => [m[1]!, m[2]!, m[3]!],
  );
  const first = tris.find((t) => t[0] === A && t[1] === B)!;
  const second = tris.find(
    (t) => t.includes(D) && t.includes(E) && !t.includes(A),
  )!;
  const C = first[2]!;
  const F = second.find((x) => x !== D && x !== E)!;
  const pt = (k: string) => {
    const x = at.get(k);
    assert.ok(x, `${k} in figure`);
    return x;
  };
  return { A, B, C, D, E, F, pt, at };
}
const numbers = (p: GeneratedProblem) => {
  const ab = Number(p.public.prompt.match(/\$(\w)(\w)=(\d+)\$/)![3]);
  const de = Number(p.public.prompt.match(/and \$(\w)(\w)=(\d+)\$/)![3]);
  return { ab, de };
};

test("deterministic and valid; every variant reachable", () => {
  for (const t of aaCriterionTemplates)
    for (let i = 0; i < 40; i++) {
      const a = aaCriterionGenerate(t.id, `det-${i}`);
      assert.deepEqual(a, aaCriterionGenerate(t.id, `det-${i}`));
      generatedProblemSchema.parse(a);
      assert.ok(a.hint.length > 40 && a.explanation.length >= 2);
    }
  const seen = {
    build: new Set<string>(),
    step: new Set<string>(),
    argue: new Set<string>(),
  };
  for (let i = 0; i < 1000; i++) {
    seen.build.add(build(`reach-${i}`).axes.proof);
    seen.step.add(step(`reach-${i}`).axes.step);
    seen.argue.add(argue(`reach-${i}`).axes.task);
  }
  assert.equal(seen.build.size, 3);
  assert.equal(seen.step.size, 8);
  assert.equal(seen.argue.size, 8);
});

test("setup: distinct integer angles, allowed scale factors, both correspondences", () => {
  let reduce = 0,
    swapped = 0;
  const N = 1000;
  for (let i = 0; i < N; i++) {
    const s = drawSetup(random("aa-setup", `${i}`));
    assert.equal(s.alpha + s.beta + s.gamma, 180);
    assert.equal(new Set([s.alpha, s.beta, s.gamma]).size, 3);
    assert.ok(Math.min(s.alpha, s.beta, s.gamma) >= 30);
    assert.ok(s.ab >= 4 && s.ab <= 12);
    assert.notEqual(s.k[0], s.k[1]);
    assert.equal(s.de * s.k[1], s.ab * s.k[0]);
    assert.ok(Number.isInteger(s.de) && s.de <= 24);
    assert.ok(!s.first.some((x) => s.second.includes(x)));
    if (s.k[0] < s.k[1]) reduce++;
    if (s.swapped) swapped++;
  }
  assert.ok(reduce / N >= 0.3, `k < 1 in ${reduce / N}`);
  assert.ok(swapped / N > 0.2 && swapped / N < 0.4, `swapped ${swapped / N}`);
});

test("figures are drawn to scale: matched angles equal, sides in the ratio k, the image from center A", () => {
  for (let i = 0; i < 300; i++) {
    for (const make of [build, step, argue]) {
      const p = make(`scale-${i}`).problem;
      const { pt, A, B, C, D, E, F, at } = roles(p);
      assert.ok(
        Math.abs(angle(pt(B), pt(A), pt(C)) - angle(pt(E), pt(D), pt(F))) <
          1e-6,
      );
      assert.ok(
        Math.abs(angle(pt(A), pt(B), pt(C)) - angle(pt(D), pt(E), pt(F))) <
          1e-6,
      );
      const { ab, de } = numbers(p);
      const k = de / ab;
      assert.ok(Math.abs(dist(pt(D), pt(E)) / dist(pt(A), pt(B)) - k) < 1e-6);
      const m = p.public.prompt.match(
        /m\\angle (\w)=(\d+)\^\\circ\$, \$m\\angle (\w)=(\d+)/,
      );
      if (m) {
        assert.ok(Math.abs(angle(pt(B), pt(A), pt(C)) - Number(m[2])) < 0.5);
        assert.ok(Math.abs(angle(pt(A), pt(B), pt(C)) - Number(m[4])) < 0.5);
      }
      const B1 = at.get(`${B}′`);
      if (B1) {
        const C1 = at.get(`${C}′`)!;
        for (const [img, src] of [
          [B1, pt(B)],
          [C1, pt(C)],
        ] as [P, P][]) {
          assert.ok(
            Math.abs(img[0] - (pt(A)[0] + k * (src[0] - pt(A)[0]))) < 1e-6,
          );
          assert.ok(
            Math.abs(img[1] - (pt(A)[1] + k * (src[1] - pt(A)[1]))) < 1e-6,
          );
        }
        // AB′ = DE and the image's angles match ∠D and ∠E.
        assert.ok(Math.abs(dist(pt(A), B1) - dist(pt(D), pt(E))) < 1e-6);
        assert.ok(
          Math.abs(angle(B1, pt(A), C1) - angle(pt(E), pt(D), pt(F))) < 1e-6,
        );
      }
      const B2 = at.get(`${B}″`);
      if (B2) {
        const C2 = at.get(`${C}″`)!;
        // The rigid copy keeps AB and AC and sits on rays DE and DF.
        assert.ok(Math.abs(dist(pt(D), B2) - dist(pt(A), pt(B))) < 1e-6);
        assert.ok(Math.abs(dist(pt(D), C2) - dist(pt(A), pt(C))) < 1e-6);
        const onRay = (q: P, from: P, to: P) => {
          const u: P = [q[0] - from[0], q[1] - from[1]];
          const w: P = [to[0] - from[0], to[1] - from[1]];
          return (
            Math.abs(u[0] * w[1] - u[1] * w[0]) < 1e-6 &&
            u[0] * w[0] + u[1] * w[1] > 0
          );
        };
        assert.ok(onRay(B2, pt(D), pt(E)));
        assert.ok(onRay(C2, pt(D), pt(F)));
      }
    }
  }
});

/** The reason expected on each line of the given proof, written by hand. */
const dilateFirst = [
  "A dilation multiplies every length by its scale factor",
  "Dilations preserve angle measure",
  "Given, with the transitive property of congruence",
  "ASA: two angles and the included side",
  "Definition of congruence: a rigid motion maps one figure onto the other",
  "Definition of similarity: rigid motions and dilations map one figure onto the other",
];
const rigidFirst = [
  "Rigid motions and dilations preserve angle measure, with the given",
  "A dilation maps every line through its center to itself",
  "A dilation multiplies every length by its scale factor",
  "Rigid motions and dilations preserve angle measure, with the given",
  "Two different lines meet in at most one point",
  "Definition of similarity: rigid motions and dilations map one figure onto the other",
];
const falseProperty = [
  "Dilations preserve length",
  "Dilations multiply angle measures by the scale factor",
];
const circularReason = [
  "AA similarity",
  "Corresponding sides of similar triangles are proportional",
];

test("the proof: expected reasons, only the key credited, distractors of each kind", () => {
  for (let i = 0; i < 300; i++) {
    for (const proof of [
      "reasons-dilate-first",
      "reasons-rigid-first",
    ] as const) {
      const p = build(`proof-${i}`, { proof }).problem;
      const r = p.public.response as StructuredWorkResponse;
      const key = JSON.parse(p.answer) as string[][];
      const label = (bank: number, id: string) =>
        r.banks[bank]!.options.find((o) => o.id === id)!.label;
      const reasons = r.rows.map((row, k) =>
        label(1, row.fields[1]!.given ?? key[k]![1]!),
      );
      assert.deepEqual(
        reasons,
        proof === "reasons-dilate-first" ? dilateFirst : rigidFirst,
      );
      const blanks = key.flatMap((row, k) => (row[1] ? [k] : []));
      assert.equal(blanks.length, 5);
      const always =
        proof === "reasons-dilate-first" ? [0, 1, 3, 5] : [0, 1, 2, 4];
      for (const k of always) assert.ok(blanks.includes(k));
      for (const k of blanks)
        for (const o of r.banks[1]!.options) {
          const tryKey = key.map((row) => [...row]);
          tryKey[k]![1] = o.id;
          assert.equal(
            gradeStructuredWork(r, p.workGrading!, JSON.stringify(tryKey)),
            o.id === key[k]![1],
            `line ${k + 1}: ${o.label}`,
          );
        }
      const bank = r.banks[1]!.options.map((o) => o.label);
      assert.ok(bank.some((l) => falseProperty.includes(l)));
      assert.ok(bank.some((l) => circularReason.includes(l)));
      if (proof === "reasons-dilate-first")
        assert.ok(bank.includes("SAS congruence"));
      assert.ok(bank.length <= 9);
    }
  }
});

test("building the proof: wrong statements in the bank, any valid order credited", () => {
  for (let i = 0; i < 200; i++) {
    const p = build(`build-${i}`, { proof: "build-dilate-first" }).problem;
    const r = p.public.response as StructuredWorkResponse;
    assert.equal(r.mode, "build");
    const labels = r.banks[0]!.options.map((o) => o.label);
    assert.equal(labels.length, 8);
    const keptLength = /^\$(\w)(\w)'=\1\2\$ and/;
    assert.ok(labels.some((l) => keptLength.test(l)));
    assert.ok(
      labels.some((l) =>
        /^\$m\\angle \w\w'\w'=k\\cdot m\\angle \w{3}\$$/.test(l),
      ),
    );
    const key = JSON.parse(p.answer) as [string, string][];
    assert.ok(gradeStructuredWork(r, p.workGrading!, p.answer));
    // The length line and the angle line may trade places.
    const swapped = [key[1]!, key[0]!, ...key.slice(2)];
    assert.ok(gradeStructuredWork(r, p.workGrading!, JSON.stringify(swapped)));
    // The congruence before the angle facts it needs is not credited.
    const early = [key[0]!, key[3]!, key[1]!, key[2]!, key[4]!, key[5]!];
    assert.equal(
      gradeStructuredWork(r, p.workGrading!, JSON.stringify(early)),
      false,
    );
    // A wrong statement in place of the length line is not credited.
    const wrong = r.banks[0]!.options.find((o) => keptLength.test(o.label))!;
    const replaced = key.map((row) => [...row]);
    replaced[0]![0] = wrong.id;
    assert.equal(
      gradeStructuredWork(r, p.workGrading!, JSON.stringify(replaced)),
      false,
    );
  }
});

test("single choices: four distinct options, position spread, feedback, consistent numbers", () => {
  for (const make of [step, argue]) {
    const position = [0, 0, 0, 0];
    for (let i = 0; i < 1000; i++) {
      const c = make(`choice-${i}`);
      const p = c.problem;
      const r = p.public.response;
      assert.ok(r.kind === "choice");
      if (r.kind !== "choice") continue;
      assert.equal(new Set(r.options.map((o) => o.label)).size, 4);
      reportEditorialLimit(
        r.options.every((o) => o.label.length <= 120),
        `${p.public.templateId}: option exceeds 120 characters`,
      );
      position[r.options.findIndex((o) => o.id === p.answer)]!++;
      for (const o of r.options)
        if (o.id !== p.answer)
          assert.ok((p.choiceFeedback?.[o.id] ?? "").length > 15);
      if ("step" in c.axes && c.axes.step === "two-not-three") {
        const m = p.public.prompt.match(
          /m\\angle \w=(\d+)\^\\circ\$, \$m\\angle \w=(\d+)\^/,
        )!;
        const gamma = 180 - Number(m[1]) - Number(m[2]);
        const key = r.options.find((o) => o.id === p.answer)!.label;
        assert.ok(key.includes(`=${gamma}^\\circ=`), key);
      }
    }
    // The key's position is spread over the four places (argument checks
    // keep sentence order, so their flaw sits where the argument puts it).
    if (make === step)
      for (const n of position) assert.ok(n > 180 && n < 320, `${position}`);
  }
});

test("argument checks: one planted flaw, 'no flaw' never correct, a complete argument", () => {
  let noFlaw = 0,
    flawed = 0;
  for (let i = 0; i < 600; i++) {
    const c = argue(`argue-${i}`);
    const p = c.problem;
    const r = p.public.response;
    if (r.kind !== "choice") assert.fail("choice");
    const key = r.options.find((o) => o.id === p.answer)!.label;
    if (c.axes.task === "complete") {
      assert.match(key, /^Argument \d$/);
      const n = Number(key.slice(-1));
      const text = p.public.prompt
        .split("\n")
        .find((l) => l.startsWith(`Argument ${n}:`))!;
      for (const idea of [
        /k=\\frac\{\w\w\}\{\w\w\}=/,
        /k\\cdot \w\w=\w\w/,
        /preserve angle measure/,
        /By ASA/,
        /a rigid motion maps/,
        /followed by that rigid motion/,
      ])
        assert.match(text, idea);
      continue;
    }
    flawed++;
    assert.match(key, /^Sentence \d$/);
    if (r.options.some((o) => o.label === "There is no flaw")) noFlaw++;
    assert.notEqual(key, "There is no flaw");
    const sentences = p.public.prompt
      .split("\n")
      .filter((l) => l.startsWith("Sentence "));
    assert.equal(sentences.length, 4);
  }
  assert.ok(
    noFlaw / flawed > 0.4 && noFlaw / flawed < 0.6,
    `${noFlaw}/${flawed}`,
  );
});
