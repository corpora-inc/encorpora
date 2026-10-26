import test from "node:test";
import assert from "node:assert/strict";
import {
  satFunctionFormsCase,
  satFunctionFormsTemplates,
} from "../src/math/sat-function-forms-practice";
import { generateProblem, gradeAnswer, templates } from "../src/math/engine";
import { problemLesson } from "../src/content/problem-lessons";
import { buildSatCoverage } from "../src/curriculum/sat-coverage";
import { buildReleasedItemLedger } from "../src/curriculum/released-items";

const skills: Record<string, string> = {
  "sat-fn-linear-notation": "function-evaluation",
  "sat-fn-line-equation-choice": "linear-models",
  "sat-fn-constraint-choice": "linear-equation-modeling",
  "sat-fn-exponential-choice": "exponential-models",
  "sat-fn-exponential-numeric": "exponential-models",
  "sat-fn-related-value": "linear-equations",
};
const variants: Record<string, string[]> = {
  "sat-fn-linear-notation": [
    "evaluate-integer",
    "evaluate-fraction-coefficient",
    "evaluate-fraction-input",
    "evaluate-contextual",
    "input-proportional",
    "input-contextual",
    "input-grouped",
    "constant-term",
    "growth-words",
  ],
  "sat-fn-line-equation-choice": [
    "slope-intercept-point",
    "slope-point",
    "rate-point",
  ],
  "sat-fn-constraint-choice": [
    "sales",
    "distance",
    "points",
    "capacity-intercepts",
  ],
  "sat-fn-exponential-choice": [
    "percent-over-100",
    "multi-year-period",
    "factor-from-later-value",
    "small-rate-table",
    "first-round-coefficient",
  ],
  "sat-fn-exponential-numeric": ["initial-from-later", "base-then-next-output"],
  "sat-fn-related-value": [
    "scaled-term",
    "common-factor",
    "reciprocal-ratio",
    "scaled-equation",
    "grouped-unit",
    "common-factor-added",
  ],
};
const num = (s: string) => {
  const [n, d] = s.split("/");
  return Number(n) / Number(d ?? 1);
};
const close = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${a} vs ${b}`);

/** Parse "$y=-\frac{2}{3}x+5$" or "$y=4x-1$" into slope, intercept. */
function parseLine(raw: string): { m: number; b: number } {
  const label = raw.replaceAll(" ", "");
  const m =
    /^\$(?:y|f\(x\))=(-?)(?:\\frac\{(\d+)\}\{(\d+)\}|(\d*))x(?:([+-])(\d+))?\$$/.exec(
      label,
    );
  assert.ok(m, label);
  const mag = m[2]
    ? Number(m[2]) / Number(m[3])
    : m[4] === ""
      ? 1
      : Number(m[4]);
  return {
    m: (m[1] ? -1 : 1) * mag,
    b: m[5] ? (m[5] === "-" ? -1 : 1) * Number(m[6]) : 0,
  };
}
/** Parse "$3x+22y=480$" into [a, b, c]. */
function parseStandard(raw: string): [number, number, number] {
  const label = raw.replaceAll(" ", "");
  const m = /^\$(-?\d*)x([+-]\d*)y=(\d+)\$$/.exec(label);
  assert.ok(m, label);
  const co = (s: string) => (s === "-" ? -1 : s === "" ? 1 : Number(s));
  return [co(m[1]!), co(m[2]!.replace("+", "")), Number(m[3])];
}

/** Independent check from the private givens. */
function verify(id: string, c: ReturnType<typeof satFunctionFormsCase>) {
  const d = c.data as Record<string, number | string>;
  const n = (k: string) => Number(d[k]);
  const correct = c.choices?.find((x) => x.correct)?.label ?? "";
  const ans = c.problem.answer.includes("option") ? NaN : num(c.problem.answer);
  switch (d.kind) {
    case "evaluate":
      close(ans, n("m") * n("a") + n("b"));
      break;
    case "evaluate-fraction":
      close(ans, (n("p") / n("d")) * n("a") + n("b"));
      assert.ok(Number.isInteger(ans));
      break;
    case "evaluate-fraction-input":
      close(ans, n("m") * (n("p") / n("d")) + n("b"));
      assert.ok(Number.isInteger(ans));
      break;
    case "evaluate-context":
      close(ans, n("a") + n("sign") * n("m") * n("t"));
      break;
    case "input-proportional": {
      const k = n("kn") / n("kd");
      close(k * ans, num(String(d.v)));
      break;
    }
    case "input-profit":
      close(n("m") * ans - n("f"), n("m") * n("x") - n("f"));
      assert.equal(ans, n("x"));
      break;
    case "input-fee":
      close(n("fee") + n("m") * ans, n("fee") + n("m") * n("x"));
      assert.equal(ans, n("x"));
      break;
    case "input-grouped":
      close(n("p") * (ans + n("c")), n("v"));
      break;
    case "constant":
      close(n("m") * n("a") + ans, n("v"));
      break;
    case "growth":
      close(
        ans,
        n("down")
          ? n("start") - n("rate") * n("n")
          : n("start") + n("rate") * n("n"),
      );
      break;
    case "slope-intercept": {
      const { m, b } = parseLine(correct);
      close(m, n("pn") / n("d"));
      close(b, n("b"));
      break;
    }
    case "slope-point": {
      const { m, b } = parseLine(correct);
      close(m, n("pn") / n("d"));
      close(m * n("x0") + b, n("y0"));
      break;
    }
    case "rate-point": {
      const { m, b } = parseLine(correct);
      close(m, n("rate"));
      close(m * n("t0") + b, n("y0"));
      assert.ok(b > 0);
      break;
    }
    case "sales":
    case "distance":
    case "points": {
      assert.deepEqual(parseStandard(correct), [n("a"), n("b"), n("c")]);
      break;
    }
    case "capacity": {
      const [a, b, cc] = parseStandard(correct);
      assert.equal(a * n("p") + b * 0, cc);
      assert.equal(a * 0 + b * n("q"), cc);
      break;
    }
    case "percent": {
      const factor = 1 + n("pct") / 100;
      close(Number(/\\cdot ([\d.]+)\^/.exec(correct)![1]), factor);
      break;
    }
    case "period": {
      const m = /\\cdot (\d+)\^\{t\/(\d+)\}/.exec(correct)!;
      // Doubling every k years: value at t = k is exactly b times the start.
      close(Number(m[1]) ** (n("k") / Number(m[2])), n("b"));
      break;
    }
    case "root-factor": {
      const b = Number(/\\cdot (\d+)\^/.exec(correct)![1]);
      close(n("a") * b ** n("n"), n("a") * n("b") ** n("n"));
      break;
    }
    case "table-rate": {
      const g = Number(/\\cdot ([\d.]+)\^/.exec(correct)![1]);
      close(g, 1 + n("pct") / 100);
      assert.ok(c.problem.public.prompt.includes(`f(0)=${n("a")}`));
      break;
    }
    case "first-round": {
      assert.ok(correct.includes(`x-1`));
      assert.ok(correct.startsWith(`$f(x)=${n("n0")}`));
      break;
    }
    case "initial":
      close(ans * n("b") ** n("m"), n("v"));
      break;
    case "base-next": {
      const b = Math.cbrt(n("v") / n("a"));
      const base = n("n") === 2 ? Math.sqrt(n("v") / n("a")) : b;
      close(base, n("b"));
      close(ans, n("a") * base ** (n("n") + 1));
      break;
    }
    case "scaled-term": {
      const x = (n("c") * n("d")) / n("p");
      close(ans, n("k") * x);
      break;
    }
    case "common-factor":
      close(n("a") * ans, n("rhs"));
      break;
    case "common-factor-added":
      close(n("a") * ans, n("rhs"));
      break;
    case "reciprocal":
      close(ans * (n("p") / n("qq")), 1);
      break;
    case "scaled-equation":
      close(ans, (n("c") * n("num")) / n("den"));
      break;
    case "grouped-unit":
      // Substituting u into both sides must agree.
      close(n("p") * ans + n("s"), n("s2") * ans + n("t"));
      break;
    default:
      assert.fail(String(d.kind));
  }
}

for (const template of satFunctionFormsTemplates) {
  const id = template.id;
  const choice = template.requiredResponseCapability === "single-choice-v1";
  test(`${id}: independent answers, grading, reachability and hint safety`, () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 400; seed++) {
      const s = `oracle:${seed}`;
      const c = satFunctionFormsCase(id, s);
      const generated = generateProblem(id, s);
      assert.equal(generated.answer, c.problem.answer);
      assert.deepEqual(generated.public.response, c.problem.public.response);
      assert.deepEqual(satFunctionFormsCase(id, s).problem, c.problem);
      for (const text of [
        generated.public.prompt,
        ...generated.explanation,
        generated.hint,
      ])
        assert.ok(!/NaN|undefined|--|\+ -|\+-|-\+/.test(text), text);
      verify(id, c);
      seen.add(c.variant);
      assert.ok(generated.explanation.length >= 2);
      assert.ok(generated.hint !== generated.explanation.at(-1));
      if (choice) {
        const response = generated.public.response;
        assert.equal(response.kind, "choice");
        if (response.kind !== "choice") continue;
        const labels = response.options.map((o) => o.label);
        assert.equal(labels.length, 4);
        assert.equal(new Set(labels).size, 4);
        const right = response.options.find((o) => o.id === generated.answer)!;
        assert.equal(c.choices!.filter((x) => x.correct).length, 1);
        assert.equal(right.label, c.choices!.find((x) => x.correct)!.label);
        assert.ok(gradeAnswer(generated, generated.answer));
        for (const o of response.options)
          if (o.id !== generated.answer) {
            assert.ok(!gradeAnswer(generated, o.id));
            assert.ok(generated.choiceFeedback?.[o.id]);
          }
        assert.ok(!generated.public.prompt.includes(right.label));
        assert.ok(!generated.hint.includes(right.label));
      } else {
        assert.equal(generated.public.response.kind, "fraction");
        assert.equal(generated.entryPolicy, "sat-spr");
        assert.ok(gradeAnswer(generated, generated.answer));
        assert.ok(!gradeAnswer(generated, String(num(generated.answer) + 1)));
        const [nn, dd = "1"] = generated.answer.split("/");
        assert.ok(
          gradeAnswer(generated, `${Number(nn) * 3}/${Number(dd) * 3}`),
        );
      }
    }
    for (const v of variants[id]!)
      assert.ok(seen.has(v), `${id} missing ${v}; saw ${[...seen].join(",")}`);
  });

  test(`${id}: skill, instruction and SAT binding`, () => {
    const registered = templates.find((t) => t.id === id);
    assert.equal(registered?.skillId, skills[id]);
    const lesson = problemLesson(id, "library");
    assert.ok((lesson.intuition ?? "").length > 40);
    assert.ok(lesson.method.length >= 3);
    assert.ok(lesson.watch);
    assert.ok(lesson.principle);
    assert.ok(lesson.example.steps.length >= 2);
    assert.ok(
      buildSatCoverage().tasks.some((task) => task.templateIds.includes(id)),
    );
  });
}

test("SAT coverage and released-item ledger stay valid", () => {
  assert.deepEqual(buildSatCoverage().errors, []);
  const ledger = buildReleasedItemLedger();
  assert.deepEqual(ledger.errors, []);
  assert.ok(ledger.valid);
});

test("numeric function-form practice reaches negative and fractional answers", () => {
  const kinds = new Set<string>();
  for (const id of [
    "sat-fn-linear-notation",
    "sat-fn-related-value",
    "sat-fn-exponential-numeric",
  ])
    for (let seed = 0; seed < 400; seed++) {
      const answer = generateProblem(id, `kinds:${seed}`).answer;
      if (answer.startsWith("-")) kinds.add("negative");
      if (answer.includes("/")) kinds.add("fraction");
    }
  assert.deepEqual([...kinds].sort(), ["fraction", "negative"]);
});
