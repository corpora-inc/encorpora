import { reportEditorialLimit } from "./fixtures/editorial";
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  generatedProblemSchema,
  type GeneratedProblem,
} from "../src/math/contracts";
import { generateProblem, gradeAnswer, templates } from "../src/math/engine";
import { algebraFormReasoningTemplates } from "../src/math/algebra-form-reasoning-practice";
import { methods } from "../src/content/problem-methods";
import { principles } from "../src/content/problem-principles";

/**
 * Checks for rewriting percent expressions (7.EE.A.2) and the slope and
 * line-equation arguments (8.EE.B.6). Option expressions are evaluated here
 * with a separate parser; triangle facts are recomputed from the figure.
 */

const IDS = algebraFormReasoningTemplates.map((t) => t.id);
const R = [4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75];
const SEEDS = 300;
const sample = (id: string, n = SEEDS) =>
  Array.from({ length: n }, (_, i) => generateProblem(id, `afr-${i}`));

/* ---- a small exact evaluator for the TeX these items print ---- */
type Env = Record<string, number>;
function evaluate(tex: string, env: Env): number {
  const src = tex.replaceAll("−", "-").replace(/\s+/g, "");
  let at = 0;
  const peek = () => src[at];
  const expr = (): number => {
    let v = peek() === "-" ? (at++, -term()) : term();
    while (peek() === "+" || peek() === "-") {
      const op = src[at++];
      const t = term();
      v = op === "+" ? v + t : v - t;
    }
    return v;
  };
  const term = (): number => {
    let v = factor();
    for (;;) {
      if (src.startsWith("\\cdot", at)) {
        at += 5;
        v *= factor();
      } else if (peek() === "/") {
        at++;
        v /= factor();
      } else if (peek() && /[\d.a-zA-Z(\\]/.test(peek()!)) v *= factor();
      else return v;
    }
  };
  const factor = (): number => {
    let v = primary();
    if (peek() === "^") {
      at++;
      v = v ** primary();
    }
    return v;
  };
  const primary = (): number => {
    const c = peek();
    if (c === "(" || c === "{") {
      at++;
      const v = expr();
      at++;
      return v;
    }
    if (src.startsWith("\\frac", at)) {
      at += 5;
      at++;
      const top = expr();
      at += 2;
      const bottom = expr();
      at++;
      return top / bottom;
    }
    const num = /^\d+(?:\.\d+)?/.exec(src.slice(at));
    if (num) {
      at += num[0].length;
      return Number(num[0]);
    }
    if (c && /[a-zA-Z]/.test(c)) {
      at++;
      if (!(c in env)) throw new Error(`letter ${c} in ${tex}`);
      return env[c]!;
    }
    throw new Error(`cannot read ${tex} at ${at}`);
  };
  const v = expr();
  if (at !== src.length) throw new Error(`trailing input in ${tex}`);
  return v;
}
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const tex = (label: string) => /\$([^$]+)\$/.exec(label)![1]!;
const choiceOf = (p: GeneratedProblem) => {
  const r = p.public.response;
  assert.equal(r.kind, "choice");
  if (r.kind !== "choice") throw new Error("choice");
  return r.options;
};
/** Letter, percent and direction of a percent story sentence. */
function story(prompt: string) {
  const letter = /\$([a-z])\$ dollars/.exec(prompt)![1]!;
  const pct = Number(/(\d+)%/.exec(prompt)![1]);
  const up = /goes up|raise\.|tip is added|rises by|marks the price up/.test(
    prompt,
  );
  const down = /marked down|% off|cuts the cost|lowers the rate/.test(prompt);
  assert.ok(up !== down, `direction of ${prompt}`);
  return { letter, pct, factor: up ? 1 + pct / 100 : 1 - pct / 100 };
}

test("every template is registered, typed, deterministic and schema-valid", () => {
  for (const id of IDS) {
    const meta = templates.find((t) => t.id === id);
    assert.ok(meta, id);
    assert.ok(methods[id]?.watch, `${id} method`);
    assert.ok(principles[id], `${id} principle`);
    for (const p of sample(id, 60)) {
      assert.equal(generatedProblemSchema.safeParse(p).success, true, id);
      assert.deepEqual(generateProblem(id, p.public.seed), p);
      assert.equal(gradeAnswer(p, p.answer), true, `${id} accepts its answer`);
      const kind = p.public.response.kind;
      assert.equal(
        kind,
        meta!.requiredResponseCapability === "single-choice-v1"
          ? "choice"
          : meta!.requiredResponseCapability === "multi-part-choice-v1"
            ? "multi-part-choice"
            : "number",
        id,
      );
      if (kind === "choice") {
        const wrong = choiceOf(p).find((o) => o.id !== p.answer)!;
        assert.equal(gradeAnswer(p, wrong.id), false);
        assert.deepEqual(
          Object.keys(p.choiceFeedback ?? {}).sort(),
          choiceOf(p)
            .map((o) => o.id)
            .filter((x) => x !== p.answer)
            .sort(),
        );
      }
      for (const text of [p.public.prompt, p.hint, ...p.explanation])
        assert.doesNotMatch(text, /\bundefined\b|NaN|\$\{/, id);
    }
  }
});

test("every variant family is reachable", () => {
  const want: Record<string, RegExp[]> = {
    "percent-change-multiplier-form": [/^up-choice$/, /^down-choice$/],
    "percent-change-multiplier-entry": [
      /^up-number$/,
      /^down-number$/,
      /^two-step-number$/,
      /^reverse-up$/,
      /^reverse-down$/,
    ],
    "expression-form-insight": [
      /^which-form-/,
      /^what-term-means-/,
      /^what-coefficient-means-/,
    ],
    "expression-form-two-part": [/^two-part-/],
    "percent-rewrite-reasoning": [
      /^justify$/,
      /^find-the-flaw-cents$/,
      /^find-the-flaw-increase-only$/,
      /^find-the-flaw-slip$/,
      /^successive-claim-down-up$/,
      /^successive-claim-up-down$/,
    ],
    "slope-constant-similar-triangles": [
      /^missing-reason-/,
      /^proportion-/,
      /-congruent$/,
      /-one-angle$/,
      /-reciprocal$/,
      /-hypotenuse$/,
      /-separate$/,
      /-chained$/,
      /-nested$/,
    ],
    "slope-argument-order": [/-separate$/, /-chained$/, /-nested$/],
    "derive-line-equation": [
      /^origin-reason$/,
      /^intercept-step$/,
      /^intercept-slope$/,
      /^origin-explanation$/,
      /-b-from-x$/,
      /-run-over-rise$/,
      /-intercept-as-slope$/,
      /-add-for-multiply$/,
      /-sign-slip$/,
    ],
  };
  for (const [id, patterns] of Object.entries(want)) {
    const variants = sample(id, 500).map((p) => p.variant!.id);
    for (const pattern of patterns)
      assert.ok(
        variants.some((v) => pattern.test(v)),
        `${id}: ${pattern} in 500 seeds`,
      );
  }
  // Every expression-form context appears with at least two question kinds.
  const insight = sample("expression-form-insight", 600).map(
    (p) => p.variant!.id,
  );
  for (const context of [
    "jacket",
    "tip",
    "wage",
    "markup",
    "perimeter",
    "per-ticket-fee",
    "overtime",
  ])
    assert.ok(
      new Set(
        insight
          .filter((v) => v.endsWith(`-${context}`))
          .map((v) => v.split("-").slice(0, 2).join("-")),
      ).size >= 2,
      context,
    );
});

test("percent multipliers: the key equals the story at two values, the decoys do not", () => {
  for (const p of sample("percent-change-multiplier-form")) {
    const s = story(p.public.prompt);
    assert.ok(R.includes(s.pct));
    assert.ok(!["x", "e", "i", "o", "l"].includes(s.letter));
    const options = choiceOf(p);
    for (const o of options) {
      const truth = [2, 7].every((v) =>
        close(evaluate(tex(o.label), { [s.letter]: v }), s.factor * v),
      );
      assert.equal(truth, o.id === p.answer, `${p.public.prompt} ${o.label}`);
    }
    // The decimal slip (5% written as 0.5) is offered only below 10%.
    const slipDecoy =
      s.factor > 1 &&
      options.some(
        (o) =>
          o.id !== p.answer &&
          new RegExp(`^\\$1\\.${s.pct / 10}${s.letter}\\$$`).test(o.label),
      );
    if (slipDecoy) assert.ok(s.pct < 10);
    if (s.factor < 1) assert.notEqual(s.pct, 50);
  }
});

test("multiplier entry: exact decimals, the right range, exact grading", () => {
  for (const p of sample("percent-change-multiplier-entry")) {
    const variant = p.variant!.id;
    if (variant.startsWith("reverse")) {
      const pct = Number(p.answer);
      assert.ok(R.includes(pct), p.answer);
      const k = Number(/\$(\d+\.\d+)[a-z]\$/.exec(p.public.prompt)![1]);
      assert.ok(close(variant === "reverse-up" ? k - 1 : 1 - k, pct / 100));
      assert.equal(gradeAnswer(p, String(pct / 100)), false);
      assert.equal(gradeAnswer(p, String(100 + pct)), false);
      continue;
    }
    const k = Number(p.answer);
    assert.ok(k > 0 && k < 2, p.answer);
    assert.ok(/^\d+(\.\d{1,3})?$/.test(p.answer), p.answer);
    if (variant === "two-step-number") {
      const [off, tax] = [...p.public.prompt.matchAll(/(\d+)%/g)].map((m) =>
        Number(m[1]),
      );
      assert.ok(close(k, (1 - off! / 100) * (1 + tax! / 100)));
      assert.ok(k > 0.5 && k < 1.5);
    } else {
      const s = story(p.public.prompt);
      assert.ok(close(k, s.factor));
      assert.equal(gradeAnswer(p, `${p.answer}0`), true);
      assert.equal(gradeAnswer(p, String(Math.round(k * 100))), false);
      // At 50% off the change and the multiplier are both 0.5.
      if (s.pct !== 50)
        assert.equal(gradeAnswer(p, String(s.pct / 100)), false);
      assert.equal(gradeAnswer(p, p.answer.replace(".", ",")), false);
    }
  }
});

test("successive changes: the keyed verdict multiplies the two changes", () => {
  const orders = new Set<string>();
  for (const p of sample("percent-rewrite-reasoning")) {
    if (!p.variant!.id.startsWith("successive")) continue;
    orders.add(p.variant!.id);
    const [a, b] = [...p.public.prompt.matchAll(/(down|up) (\d+)%/g)];
    const sign = (w: string) => (w === "up" ? 1 : -1);
    const final =
      (1 + (sign(a![1]!) * Number(a![2])) / 100) *
      (1 + (sign(b![1]!) * Number(b![2])) / 100);
    const key = choiceOf(p).find((o) => o.id === p.answer)!.label;
    assert.match(key, /^Wrong:/);
    const [left, right] = tex(key).split(" = ");
    const v = /\$([a-z])\$ dollars/.exec(p.public.prompt)![1]!;
    assert.ok(close(evaluate(left!, { [v]: 1 }), final));
    assert.ok(close(evaluate(right!, { [v]: 1 }), final));
  }
  assert.equal(orders.size, 2);
});

/* ---- slope triangles: recomputed from the figure ---- */
type Graph = {
  points: { x: number; y: number; label: string }[];
  slopeTriangles: { from: [number, number]; to: [number, number] }[];
};
const graphOf = (p: GeneratedProblem): Graph => {
  const figure = p.public.figure;
  assert.equal(figure?.kind, "scene");
  if (figure?.kind !== "scene") throw new Error("scene");
  return figure.scene.elements.find(
    (e) => e.type === "graph",
  ) as unknown as Graph;
};
function vertices(p: GeneratedProblem) {
  const where: Record<string, [number, number]> = {};
  for (const pt of graphOf(p).points)
    for (const name of pt.label.split(", ")) where[name] = [pt.x, pt.y];
  const names = /two slope triangles, \$([A-Z]{3})\$ and \$([A-Z]{3})\$/.exec(
    p.public.prompt,
  )!;
  return { where, small: names[1]!, large: names[2]! };
}
const length = (w: Record<string, [number, number]>, seg: string) =>
  Math.hypot(w[seg[1]!]![0] - w[seg[0]!]![0], w[seg[1]!]![1] - w[seg[0]!]![1]);

test("slope triangles lie on one line with equal rise over run", () => {
  const layouts = new Set<string>();
  for (const id of ["slope-constant-similar-triangles", "slope-argument-order"])
    for (const p of sample(id)) {
      const { where, small, large } = vertices(p);
      layouts.add(p.variant!.id.split("-").at(-1)!);
      const [a, b, c] = [...small].map((n) => where[n]!);
      const [d, e, f] = [...large].map((n) => where[n]!);
      for (const pt of [...[a, b, c], ...[d, e, f]])
        assert.ok(pt!.every((v) => Number.isInteger(v) && Math.abs(v) <= 10));
      assert.equal(a![1], b![1]);
      assert.equal(b![0], c![0]);
      assert.equal(d![1], e![1]);
      assert.equal(e![0], f![0]);
      const slope = (c![1] - a![1]) / (c![0] - a![0]);
      for (const pt of [d!, f!])
        assert.ok(close(pt[1] - a![1], slope * (pt[0] - a![0])));
      assert.ok(close((f![1] - e![1]) / (e![0] - d![0]), slope));
      assert.ok(Math.abs(slope) <= 3 && slope !== 0);
      const ratio = (e![0] - d![0]) / (b![0] - a![0]);
      assert.ok([2, 3, 4, 1.5].includes(ratio), `scale ${ratio}`);
    }
  for (const layout of ["separate", "chained", "nested"])
    assert.ok(layouts.has(layout), layout);
});

test("the proportion item has exactly one numerically true equation, and it is keyed", () => {
  for (const p of sample("slope-constant-similar-triangles")) {
    if (!p.variant!.id.startsWith("proportion")) continue;
    const { where } = vertices(p);
    const truths = choiceOf(p).map((o) => {
      const [n1, d1, n2, d2] = [
        ...o.label.matchAll(/\\frac\{([A-Z]{2})\}\{([A-Z]{2})\}/g),
      ].flatMap((m) => [m[1]!, m[2]!]);
      return close(
        length(where, n1!) / length(where, d1!),
        length(where, n2!) / length(where, d2!),
      );
    });
    assert.equal(truths.filter(Boolean).length, 1, p.public.prompt);
    assert.equal(choiceOf(p)[truths.indexOf(true)]!.id, p.answer);
  }
});

test("the order item is shuffled, one-to-one, and keyed in argument order", () => {
  for (const p of sample("slope-argument-order", 120)) {
    const r = p.public.response;
    if (r.kind !== "multi-part-choice") throw new Error("parts");
    const key = JSON.parse(p.answer) as Record<string, string>;
    assert.deepEqual(Object.keys(key), ["s1", "s2", "s3", "s4", "s5"]);
    assert.equal(new Set(Object.values(key)).size, 5);
    assert.ok(
      Object.values(key).filter((id, i) => id === "abcde"[i]).length <= 1,
      "at most one statement is listed at its own step",
    );
    const order = Object.values(key).map(
      (id) => r.blanks[0]!.options.find((o) => o.id === id)!.label,
    );
    assert.match(order[0]!, /^Draw/);
    assert.match(order[2]!, /are similar/);
    assert.match(order[3]!, /proportional/);
    assert.match(order[4]!, /rise over run/);
    for (const o of r.blanks[0]!.options)
      reportEditorialLimit(
        o.label.length <= 80,
        `${p.public.templateId}: option exceeds 80 characters`,
      );
  }
});

test("line derivations: intercept by variant, and the keyed slope expression equals m", () => {
  for (const p of sample("derive-line-equation")) {
    const g = graphOf(p);
    const [from, to] = [g.slopeTriangles[0]!.from, g.slopeTriangles[0]!.to];
    const b = from[1];
    const m = (to[1] - from[1]) / (to[0] - from[0]);
    const variant = p.variant!.id;
    if (variant.startsWith("origin")) assert.equal(b, 0);
    else assert.notEqual(b, 0);
    const general = g.points.find((pt) => pt.label === "(x, y)")!;
    assert.ok(close(general.y, m * general.x + b));
    if (variant === "intercept-slope") {
      const env = { x: to[0], y: to[1] };
      for (const o of choiceOf(p)) {
        let value = Number.NaN;
        try {
          value = evaluate(tex(o.label), env);
        } catch {
          value = Number.NaN;
        }
        assert.equal(close(value, m), o.id === p.answer, o.label);
      }
    }
    if (variant === "intercept-step") {
      const key = choiceOf(p).find((o) => o.id === p.answer)!.label;
      const [left, right] = tex(key).split(" = ");
      for (const x of [1, 2, 5]) {
        const env = { x, y: m * x + b };
        assert.ok(close(evaluate(left!, env), evaluate(right!, env)));
      }
    }
  }
});

test("the independent oracle agrees on 256 seeds of every template", () => {
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
import algebra_form_reasoning_math_oracle as oracle
print(oracle.self_test())
cases = json.load(sys.stdin)
for problem in cases:
    assert oracle.review_problem(problem) == problem['answer'], problem['public']['seed']
    assert oracle.solve(problem['public']) == problem['answer']
print({'cases': len(cases)})
`,
    ],
    {
      input: JSON.stringify(cases),
      encoding: "utf8",
      timeout: 120_000,
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
  assert.match(result.stdout, new RegExp(`'cases': ${IDS.length * 256}`));
});
