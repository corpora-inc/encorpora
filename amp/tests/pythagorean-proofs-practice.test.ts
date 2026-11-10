import { reportEditorialLimit } from "./fixtures/editorial";
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  generatedProblemSchema,
  type GeneratedProblem,
} from "../src/math/contracts";
import { generateProblem, templates } from "../src/math/engine";
import {
  STEP_DECOYS,
  STEPS_TWO_COUNTS,
  STEPS_TWO_PICTURES,
  TRIPLES,
  pythagoreanProofsTemplates,
} from "../src/math/pythagorean-proofs-practice";
import { methods } from "../src/content/problem-methods";
import { principles } from "../src/content/problem-principles";

/**
 * Checks for the 8.G.B.6 proof family. Answers are recomputed from the
 * prompt and the drawn polygons here and, independently, by
 * scripts/pythagorean_proofs_math_oracle.py over the inventory's seeds.
 */

const IDS = pythagoreanProofsTemplates.map((t) => t.id);
const SEEDS = 400;
const cache = new Map<string, GeneratedProblem[]>();
function sample(id: string, n = SEEDS): GeneratedProblem[] {
  const key = `${id}:${n}`;
  if (!cache.has(key))
    cache.set(
      key,
      Array.from({ length: n }, (_, i) => generateProblem(id, `pp-${i}`)),
    );
  return cache.get(key)!;
}
const variantOf = (p: GeneratedProblem) => p.variant!.axes!;
type El = { type: string; id?: string; points?: [number, number][] };
const elementsOf = (p: GeneratedProblem): El[] => {
  const figure = p.public.figure;
  assert.equal(figure?.kind, "scene");
  if (figure?.kind !== "scene") throw new Error("scene");
  return figure.scene.elements as unknown as El[];
};
const shoelace = (pts: [number, number][]) =>
  Math.abs(
    pts.reduce(
      (s, p, i) =>
        s +
        p[0] * pts[(i + 1) % pts.length]![1] -
        pts[(i + 1) % pts.length]![0] * p[1],
      0,
    ),
  ) / 2;
const areaOf = (els: El[], id: string) =>
  shoelace(els.find((e) => e.id === id)!.points!);
const choiceLabels = (p: GeneratedProblem) => {
  const r = p.public.response;
  assert.equal(r.kind, "choice");
  if (r.kind !== "choice") throw new Error("choice");
  return r.options;
};
const correctLabel = (p: GeneratedProblem) =>
  choiceLabels(p).find((o) => o.id === p.answer)!.label;

test("the family registers six templates on the Pythagorean skill with lessons", () => {
  for (const id of IDS) {
    const t = templates.find((x) => x.id === id);
    assert.ok(t, id);
    assert.equal(t.skillId, "pythagorean-theorem");
    assert.equal(t.gradeBand, "6–8");
    assert.equal(t.requiredFigureCapability, "scenes-v1");
    assert.ok(methods[id]?.watch, `${id} method`);
    assert.ok(principles[id], `${id} principle`);
  }
});

test("every template is schema-valid, deterministic and keeps one response kind", () => {
  const kinds: Record<string, string> = {
    "pythagorean-proof-area": "number",
    "pythagorean-proof-figure": "choice",
    "pythagorean-proof-steps": "multi-part-choice",
    "pythagorean-proof-flaw": "choice",
    "pythagorean-converse-proof": "choice",
    "pythagorean-converse-blanks": "multi-part-choice",
  };
  for (const id of IDS)
    for (const [i, p] of sample(id, 200).entries()) {
      generatedProblemSchema.parse(p);
      assert.equal(p.public.response.kind, kinds[id], id);
      assert.deepEqual(generateProblem(id, `pp-${i}`), p);
      const text = [
        p.public.prompt,
        p.hint,
        ...p.explanation,
        JSON.stringify(p.public.response),
      ].join(" ");
      assert.doesNotMatch(text, /inverse|contrapositive/i, id);
      assert.doesNotMatch(text, /undefined|NaN|\$\{/, id);
    }
});

test("areas: legs in range, the figure tiles the square, the answer is a² + b²", () => {
  const seen = new Set<string>();
  for (const p of sample("pythagorean-proof-area")) {
    const m = /legs (\d+) and (\d+)/.exec(p.public.prompt)!;
    const s = Number(/square of side (\d+)/.exec(p.public.prompt)![1]);
    const a = Number(m[1]),
      b = Number(m[2]);
    assert.ok(2 <= a && a < b && b <= 12 && s === a + b && s <= 15);
    assert.equal(p.answer, String(a * a + b * b));
    const els = elementsOf(p);
    const triangles = [1, 2, 3, 4].map((k) => areaOf(els, `ft${k}`));
    assert.ok(triangles.every((t) => t === (a * b) / 2));
    const left =
      variantOf(p).variant === "middle-square"
        ? areaOf(els, "fmid")
        : areaOf(els, "fsa") + areaOf(els, "fsb");
    assert.equal(left + 2 * a * b, areaOf(els, "fbox"));
    assert.equal(left, a * a + b * b);
    // The figure's labels never print the leftover area, and nor does the hint.
    assert.ok(!JSON.stringify(els).includes(`"${p.answer}"`));
    assert.ok(!p.hint.split(/\D+/).includes(p.answer));
    seen.add(variantOf(p).variant!);
  }
  assert.deepEqual([...seen].sort(), ["middle-square", "two-squares"]);
});

test("reading the picture: three variants, exact options, no equivalent pair", () => {
  const counts: Record<string, number> = {};
  for (const p of sample("pythagorean-proof-figure")) {
    const v = variantOf(p).variant!;
    counts[v] = (counts[v] ?? 0) + 1;
    const labels = choiceLabels(p).map((o) => o.label);
    assert.equal(labels.length, 4);
    // 4·½ab and 2ab never appear as two separate options.
    assert.ok(
      !(
        labels.some((l) => l.includes("4 \\cdot \\tfrac{1}{2}ab")) &&
        labels.some((l) => /\b2ab\b/.test(l))
      ),
    );
    if (v === "equation")
      assert.match(
        correctLabel(p),
        /^\$(?:\(a \+ b\)\^2 = 4 \\cdot \\tfrac\{1\}\{2\}ab \+ c\^2|4 \\cdot \\tfrac\{1\}\{2\}ab \+ c\^2 = \(a \+ b\)\^2)\$$/,
      );
    if (v === "leftovers") {
      const els = elementsOf(p);
      assert.equal(
        areaOf(els, "fmid"),
        areaOf(els, "gsa") + areaOf(els, "gsb"),
      );
      assert.match(correctLabel(p), /same four triangles are removed/);
    }
    if (v === "corner") assert.match(correctLabel(p), /add to \$90\^\\circ\$/);
    for (const [id, text] of Object.entries(p.choiceFeedback ?? {}))
      assert.ok(id !== p.answer && text.length > 20);
  }
  for (const v of ["equation", "leftovers", "corner"])
    assert.ok((counts[v] ?? 0) > SEEDS * 0.2, `${v}: ${counts[v]}`);
});

test("ordering: the key is the proof's order, the pool is scrambled, decoys fit nowhere", () => {
  const blanksSeen = new Set<string>();
  const variants = new Set<string>();
  for (const p of sample("pythagorean-proof-steps")) {
    const r = p.public.response;
    assert.equal(r.kind, "multi-part-choice");
    if (r.kind !== "multi-part-choice") continue;
    const v = variantOf(p).variant!;
    variants.add(v);
    const key = JSON.parse(p.answer) as Record<string, string>;
    if (v === "fill-blanks") {
      blanksSeen.add(variantOf(p).blanks!);
      assert.equal(r.blanks.length, 2);
      for (const b of r.blanks) assert.ok(b.options.length <= 6);
      continue;
    }
    const canon: readonly string[] =
      v === "order-two-pictures" ? STEPS_TWO_PICTURES : STEPS_TWO_COUNTS;
    const options = r.blanks[0]!.options;
    const labels = options.map((o) => o.label);
    assert.ok(labels.length <= 6);
    reportEditorialLimit(
      labels.every((l) => l.length <= 80),
      `${p.public.templateId}: option exceeds 80 characters`,
    );
    const extra = labels.filter((l) => !canon.includes(l));
    assert.ok(extra.length >= 1);
    assert.ok(
      extra.every((l) => (STEP_DECOYS as readonly string[]).includes(l)),
    );
    const order = canon.map((s) => labels.indexOf(s));
    assert.notDeepEqual(
      order,
      [...order].sort((x, y) => x - y),
    );
    canon.forEach((step, i) => {
      const chosen = options.find((o) => o.id === key[`s${i + 1}`])!;
      assert.equal(chosen.label, step);
    });
  }
  assert.equal(variants.size, 3);
  assert.equal(blanksSeen.size, 6, [...blanksSeen].join(" "));
});

test("flaws: all five reached, and a nothing-is-wrong option is always offered", () => {
  const flaws = new Set<string>();
  for (const p of sample("pythagorean-proof-flaw")) {
    flaws.add(variantOf(p).flaw!);
    const labels = choiceLabels(p).map((o) => o.label);
    assert.equal(labels.length, 4);
    assert.ok(labels.some((l) => l.startsWith("Nothing is wrong.")));
    assert.ok(!correctLabel(p).startsWith("Nothing is wrong."));
    if (variantOf(p).flaw === "example") {
      const m = /legs (\d+) and (\d+)\. The hypotenuse measures (\d+)/.exec(
        p.public.prompt,
      )!;
      const [a, b, c] = [m[1], m[2], m[3]].map(Number) as [
        number,
        number,
        number,
      ];
      assert.equal(a * a + b * b, c * c);
    }
  }
  assert.deepEqual([...flaws].sort(), [
    "circular",
    "example",
    "expansion",
    "triangle-area",
    "unproved-square",
  ]);
});

test("converse: hinge third side keyed by the law of cosines, both directions balanced", () => {
  const variants = new Map<string, number>();
  const flaws = new Set<string>();
  let wider = 0,
    hinges = 0;
  for (const p of sample("pythagorean-converse-proof", 800)) {
    const ax = variantOf(p);
    variants.set(ax.variant!, (variants.get(ax.variant!) ?? 0) + 1);
    if (ax.variant === "flaw") flaws.add(ax.flaw!);
    if (ax.variant !== "hinge-read") continue;
    const m =
      /lengths (\d+) and (\d+) .* exactly (\d+)\. The third side now measures (\d+)\./.exec(
        p.public.prompt,
      )!;
    const [a, b, c, d] = [m[1], m[2], m[3], m[4]].map(Number) as [
      number,
      number,
      number,
      number,
    ];
    assert.equal(a * a + b * b, c * c);
    assert.ok(
      Math.abs(a - b) < d && d < a + b && d !== c && Math.abs(d - c) <= 3,
    );
    // cos C = (a² + b² − d²) / 2ab: negative means wider than a right angle.
    const obtuse = a * a + b * b - d * d < 0;
    assert.equal(
      correctLabel(p),
      `The angle is ${obtuse ? "greater" : "less"} than $90^\\circ$.`,
    );
    hinges++;
    if (obtuse) wider++;
  }
  assert.equal(variants.size, 4);
  assert.deepEqual([...flaws].sort(), ["adding", "backwards", "wrong-side"]);
  assert.ok(
    wider / hinges >= 0.35 && wider / hinges <= 0.65,
    `${wider}/${hinges}`,
  );
});

test("converse blanks: Pythagorean triples or letters; the right angle is across from the longest side", () => {
  const forms = new Set<string>();
  for (const p of sample("pythagorean-converse-blanks")) {
    forms.add(variantOf(p).form!);
    const r = p.public.response;
    if (r.kind !== "multi-part-choice") throw new Error("parts");
    const key = JSON.parse(p.answer) as Record<string, string>;
    const pickLabel = (id: string) =>
      r.blanks.find((b) => b.id === id)!.options.find((o) => o.id === key[id])!
        .label;
    const m = /sides (\d+), (\d+) and (\d+)/.exec(p.public.prompt);
    if (m) {
      const [a, b, c] = [m[1], m[2], m[3]].map(Number) as [
        number,
        number,
        number,
      ];
      assert.ok(TRIPLES.some((t) => t[0] === a && t[1] === b && t[2] === c));
      assert.equal(pickLabel("equals"), String(c));
      assert.equal(pickLabel("where"), `across from the side ${c}`);
      assert.equal(pickLabel("hyp"), `$\\sqrt{${a}^2 + ${b}^2}$`);
    } else {
      assert.equal(pickLabel("where"), "across from the side $c$");
      assert.equal(pickLabel("hyp"), "$\\sqrt{a^2 + b^2}$");
    }
    assert.equal(pickLabel("same"), "congruent, the same size and shape");
    for (const b of r.blanks) assert.ok(b.options.length <= 6);
  }
  assert.deepEqual([...forms].sort(), ["letters", "numbers"]);
});

test("the correct option sits in every position", () => {
  for (const id of [
    "pythagorean-proof-figure",
    "pythagorean-proof-flaw",
    "pythagorean-converse-proof",
  ]) {
    const positions = new Map<string, number>();
    for (const p of sample(id))
      positions.set(p.answer, (positions.get(p.answer) ?? 0) + 1);
    for (const option of ["option-a", "option-b", "option-c", "option-d"])
      assert.ok((positions.get(option) ?? 0) > SEEDS * 0.15, `${id} ${option}`);
  }
});

test("the independent oracle agrees on 256 inventory seeds of every template", () => {
  const cases = IDS.flatMap((id) =>
    Array.from({ length: 256 }, (_, i) =>
      generateProblem(id, `independent-${i}`),
    ),
  );
  const result = spawnSync(
    "python3",
    [
      "-c",
      String.raw`
import json, sys
sys.path.insert(0, 'scripts')
import pythagorean_proofs_math_oracle as oracle
print(oracle.self_test())
cases = json.load(sys.stdin)
for problem in cases:
    assert oracle.review_problem(problem) == problem['answer'], problem['public']['templateId']
    assert oracle.solve(problem['public']) == problem['answer']
print({'cases': len(cases)})
`,
    ],
    {
      input: JSON.stringify(cases),
      encoding: "utf8",
      timeout: 120_000,
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
  assert.match(result.stdout, /'mutations': 9/);
  assert.match(result.stdout, new RegExp(`'cases': ${256 * IDS.length}`));
});
