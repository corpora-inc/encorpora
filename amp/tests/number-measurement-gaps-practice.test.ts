import test from "node:test";
import assert from "node:assert/strict";
import {
  numberMeasurementGapCase,
  numberMeasurementGapTemplates,
} from "../src/math/number-measurement-gaps-practice";
import { generateProblem, templates } from "../src/math/engine";
import { problemLesson } from "../src/content/problem-lessons";

const ids = numberMeasurementGapTemplates.map((t) => t.id);
const expectedVariants: Record<string, string[]> = {
  "signed-context-order": ["debt", "sea-level", "order-list", "temperature"],
  "equivalent-expressions-check": [
    "not-equivalent",
    "one-value-check",
    "combine",
    "factor",
    "fractional-factor",
  ],
  "area-tiling-distributive": [
    "array-split",
    "area-model-sum",
    "l-shape",
    "not-equal",
  ],
  "estimate-reasonableness": [
    "best-product",
    "verdict",
    "two-step",
    "quotient",
    "decimal-difference",
  ],
  "unit-chain-conversion": [
    "dose",
    "tablets",
    "density-mass",
    "density-volume",
    "speed-distance",
    "flow-volume",
    "floor-tiles",
    "tank-liters",
  ],
  "fraction-of-set": ["part", "remainder", "from-unit-part"],
};
const skills: Record<string, string> = {
  "signed-context-order": "absolute-value",
  "equivalent-expressions-check": "expression-properties",
  "area-tiling-distributive": "rectangle-area",
  "estimate-reasonableness": "multistep-whole-stories",
  "unit-chain-conversion": "units-and-precision",
  "fraction-of-set": "fraction-times-whole",
};

/** Evaluate plain arithmetic text such as "3(2x - 4) + 5x" at x. */
function evalText(text: string, x: number): number {
  const js = text
    .replace(/\$/g, "")
    .replace(/\\left|\\right/g, "")
    .replace(/\\frac\{(\d+)\}\{(\d+)\}/g, "($1/$2)")
    .replace(/\\cdot/g, "*")
    .replace(/\)\(/g, ")*(")
    .replace(/×/g, "*")
    .replace(/(\d)\(/g, "$1*(")
    .replace(/(\d)x/g, "$1*x")
    .replace(/\)x/g, ")*x")
    .replace(/(\d),(\d)/g, "$1$2");
  return Function("x", `return (${js});`)(x) as number;
}
const same = (a: string, b: string) =>
  [0, 1, 2, -3].every((x) => evalText(a, x) === evalText(b, x));
const texNumber = (s: string): number => {
  const m = /^(-?)\\frac\{(\d+)\}\{(\d+)\}$/.exec(s);
  if (m) return (m[1] ? -1 : 1) * (Number(m[2]) / Number(m[3]));
  return Number(s);
};
const labels = (generated: ReturnType<typeof generateProblem>) => {
  const response = generated.public.response;
  assert.equal(response.kind, "choice");
  return response.kind === "choice" ? response.options : [];
};

test("every template is deterministic, reachable through the engine and has every variant", () => {
  for (const id of ids) {
    const seen = new Set<string>();
    for (let seed = 0; seed < 400; seed++) {
      const a = numberMeasurementGapCase(id, `s${seed}`);
      const b = numberMeasurementGapCase(id, `s${seed}`);
      assert.deepEqual(a.problem, b.problem);
      seen.add(a.variant);
      if (seed < 40) {
        const viaEngine = generateProblem(id, `s${seed}`);
        assert.equal(viaEngine.public.id, a.problem.public.id);
        assert.equal(viaEngine.answer, a.problem.answer);
      }
    }
    assert.deepEqual([...seen].sort(), [...expectedVariants[id]!].sort(), id);
    assert.equal(templates.find((t) => t.id === id)?.skillId, skills[id]);
  }
});

test("choices are distinct, exactly one is correct, feedback exists, and the answer never leaks", () => {
  for (const id of ids) {
    for (let seed = 0; seed < 400; seed++) {
      const g = numberMeasurementGapCase(id, `c${seed}`).problem;
      assert.ok(g.hint.length > 20 && g.explanation.length >= 2);
      const response = g.public.response;
      if (response.kind === "choice") {
        assert.equal(response.options.length, 4);
        assert.equal(new Set(response.options.map((o) => o.label)).size, 4);
        const correct = response.options.find((o) => o.id === g.answer)!;
        assert.ok(correct);
        for (const o of response.options)
          if (o.id !== g.answer)
            assert.ok((g.choiceFeedback?.[o.id] ?? "").length > 10, o.label);
        const text = `${g.public.prompt}\n${g.hint}`;
        const numeric = /^-?[\d,.]+$/.test(correct.label);
        assert.ok(
          numeric
            ? !new RegExp(`(?<![\\d.,])${correct.label}(?![\\d]|[.,]\\d)`).test(
                text,
              )
            : !text.includes(correct.label),
          correct.label,
        );
      } else {
        assert.equal(
          response.kind,
          "fraction" in response ? "fraction" : response.kind,
        );
        assert.match(g.answer, /^\d+$/);
        const text = `${g.public.prompt}\n${g.hint}`;
        assert.ok(
          !new RegExp(`(?<![\\d.,])${g.answer}(?![\\d]|[.,]\\d)`).test(text),
          `${id}: ${g.answer} appears in the prompt or hint`,
        );
      }
    }
  }
});

test("equivalent expressions: independent evaluation finds the right choice", () => {
  for (let seed = 0; seed < 400; seed++) {
    const { variant, problem } = numberMeasurementGapCase(
      "equivalent-expressions-check",
      `e${seed}`,
    );
    const g = generateProblem("equivalent-expressions-check", `e${seed}`);
    const options = labels(g);
    if (variant === "one-value-check") {
      const m = /\$(\d+)\(x \+ (\d+)\)\$ and \$x \+ (\d+)\$/.exec(
        problem.public.prompt,
      )!;
      const a = Number(m[1]),
        b = Number(m[2]);
      assert.equal(Number(m[3]), a * b);
      assert.notEqual(a * (1 + b), 1 + a * b);
      const correct = options.find((o) => o.id === g.answer)!.label;
      assert.match(
        correct,
        new RegExp(`gives ${a + a * b} and .* ${1 + a * b}\\.`),
      );
      continue;
    }
    const prompt = /to \$(.+)\$\?|equivalent to \$(.+)\$\?/.exec(
      problem.public.prompt,
    )!;
    const given = (prompt[1] ?? prompt[2])!;
    const matches = options.filter((o) => same(o.label, given));
    if (variant === "not-equivalent" || variant === "fractional-factor") {
      assert.equal(matches.length, 3);
      assert.ok(!same(options.find((o) => o.id === g.answer)!.label, given));
    } else {
      assert.equal(matches.length, 1);
      assert.equal(matches[0]!.id, g.answer);
    }
  }
});

test("area: totals come from figures and sentences, not generator internals", () => {
  for (let seed = 0; seed < 400; seed++) {
    const { variant, problem } = numberMeasurementGapCase(
      "area-tiling-distributive",
      `a${seed}`,
    );
    const g = generateProblem("area-tiling-distributive", `a${seed}`);
    const options = labels(g);
    const figure = problem.public.figure as any;
    const correct = options.find((o) => o.id === g.answer)!.label;
    if (variant === "array-split") {
      const total = figure.rows * figure.columns;
      const hits = options.filter((o) => evalText(o.label, 0) === total);
      assert.deepEqual(
        hits.map((o) => o.id),
        [g.answer],
      );
      assert.ok(
        figure.splitAfterRow >= 1 && figure.splitAfterRow < figure.rows,
      );
    } else if (variant === "area-model-sum") {
      const total =
        figure.rows[0] *
        figure.columns.reduce((s: number, v: number) => s + v, 0);
      assert.equal(Number(correct), total);
      assert.ok(
        options.every((o) => Number(o.label) !== total || o.id === g.answer),
      );
    } else if (variant === "l-shape") {
      const v: number[][] = figure.vertices;
      let twice = 0;
      v.forEach((p, i) => {
        const q = v[(i + 1) % v.length]!;
        twice += p[0]! * q[1]! - q[0]! * p[1]!;
      });
      assert.equal(Number(correct), twice / 2);
      const split = figure.heights[0];
      assert.ok(
        v.some((p) => p[0] === split.from[0] && p[1] === split.from[1]),
      );
      assert.ok(split.from[0] === split.to[0] || split.from[1] === split.to[1]);
    } else {
      const total =
        figure.rows[0] *
        figure.columns.reduce((s: number, v: number) => s + v, 0);
      const bad = options.filter((o) => evalText(o.label, 0) !== total);
      assert.deepEqual(
        bad.map((o) => o.id),
        [g.answer],
      );
    }
  }
});

test("estimates follow the stated rounding rule", () => {
  const r10 = (n: number) => Math.round(n / 10) * 10;
  for (let seed = 0; seed < 400; seed++) {
    const { variant, problem } = numberMeasurementGapCase(
      "estimate-reasonableness",
      `r${seed}`,
    );
    const g = generateProblem("estimate-reasonableness", `r${seed}`);
    const options = labels(g);
    const correct = options.find((o) => o.id === g.answer)!.label;
    const p = problem.public.prompt;
    const num = (s: string) => Number(s.replace(/,/g, ""));
    if (variant === "best-product") {
      const m = /(\d+) \w+ with (\d+)/.exec(p)!;
      assert.equal(num(correct), r10(Number(m[1])) * r10(Number(m[2])));
    } else if (variant === "verdict") {
      const m = /(\d+) × (\d+) = ([\d,]+)\./.exec(p)!;
      const exact = Number(m[1]) * Number(m[2]);
      const claim = num(m[3]!);
      const est = r10(Number(m[1])) * r10(Number(m[2]));
      const close = Math.abs(claim - exact) === 0;
      assert.equal(correct.startsWith("Reasonable"), close);
      assert.ok(
        close
          ? Math.abs(claim - est) / est < 0.3
          : Math.abs(claim - est) / est > 0.8,
      );
      assert.ok(correct.includes(`= ${est.toLocaleString("en-US")}`));
    } else if (variant === "decimal-difference") {
      const m =
        /holds (\d+\.\d) milliliters and another holds (\d+\.\d) milliliters/.exec(
          p,
        )!;
      assert.equal(
        num(correct),
        Math.round(Number(m[1])) - Math.round(Number(m[2])),
      );
    } else if (variant === "two-step") {
      const m =
        /fills (\d+) trays with (\d+) rolls each .* and (\d+) trays with (\d+) rolls/.exec(
          p,
        )!;
      assert.equal(
        num(correct),
        Number(m[1]) * r10(Number(m[2])) + Number(m[3]) * r10(Number(m[4])),
      );
    } else {
      const m = /^(\d+) students .* seat (\d+)\./.exec(p)!;
      assert.equal(
        num(correct),
        (Math.round(Number(m[1]) / 100) * 100) / r10(Number(m[2])),
      );
    }
  }
});

test("unit chains give the exact value by an independent calculation", () => {
  for (let seed = 0; seed < 400; seed++) {
    const g = numberMeasurementGapCase(
      "unit-chain-conversion",
      `u${seed}`,
    ).problem;
    const p = g.public.prompt.replace(/(\d),(\d{3})/g, "$1$2");
    const nums = (p.match(/\d+/g) ?? []).map(Number);
    let expected: number;
    if (/per kilogram of body mass/.test(p)) {
      const [D, W, n] = nums as [number, number, number];
      expected = (D * W) / n / (/tablet/.test(p) ? nums[nums.length - 1]! : 1);
    } else if (
      /solid block/.test(p) &&
      /volume .* cubic centimeters and density/.test(p)
    ) {
      expected = (nums[0]! * nums[1]!) / 1000;
    } else if (/solid block/.test(p)) {
      expected = (nums[0]! * 1000) / nums[1]!;
    } else if (/cyclist/.test(p)) {
      expected = (nums[0]! * 1000 * nums[1]!) / 60;
    } else if (/pipe/.test(p)) {
      expected = (nums[0]! * 60 * nums[nums.length - 1]!) / 1000;
    } else if (/floor/.test(p)) {
      expected = ((nums[0]! * 100) / nums[2]!) * ((nums[1]! * 100) / nums[2]!);
    } else {
      expected = nums[0]! * nums[1]! * nums[2]! * 1000;
    }
    assert.equal(Number(g.answer), expected, p);
    assert.ok(Number.isInteger(expected));
  }
});

test("fraction of a set matches the picture", () => {
  for (let seed = 0; seed < 400; seed++) {
    const { variant, problem } = numberMeasurementGapCase(
      "fraction-of-set",
      `f${seed}`,
    );
    const fracs = [
      ...problem.public.prompt.matchAll(/\\frac\{(\d+)\}\{(\d+)\}/g),
    ];
    const m = fracs[variant === "from-unit-part" ? 1 : 0]!;
    const a = Number(m[1]),
      b = Number(m[2]);
    const fig = problem.public.figure as any;
    if (variant === "from-unit-part") {
      const g = Number(/is (\d+) /.exec(problem.public.prompt)![1]);
      assert.equal(Number(problem.answer), a * g);
      assert.deepEqual([fracs[0]![1], fracs[0]![2]], ["1", String(b)]);
    } else {
      assert.equal(fig.total % b, 0);
      assert.equal(fig.total / fig.groupSize, b);
      const share = variant === "part" ? a : b - a;
      assert.equal(Number(problem.answer), (fig.total / b) * share);
    }
  }
});

test("signed order statements are mathematically true", () => {
  for (let seed = 0; seed < 400; seed++) {
    const { variant, problem } = numberMeasurementGapCase(
      "signed-context-order",
      `n${seed}`,
    );
    const g = generateProblem("signed-context-order", `n${seed}`);
    const options = labels(g);
    const correct = options.find((o) => o.id === g.answer)!.label;
    const p = problem.public.prompt;
    if (variant === "debt") {
      const m =
        /^(\w+)'s account balance is \$(-[\d.]+)\$ dollars and (\w+)'s is \$(-[\d.]+)\$/.exec(
          p,
        )!;
      const owed = new Map([
        [m[1]!, -Number(m[2])],
        [m[3]!, -Number(m[4])],
      ]);
      const more = [...owed.entries()].sort((x, y) => y[1] - x[1])[0]![0];
      assert.ok(correct.startsWith(`${more} owes more`));
    } else if (variant === "sea-level") {
      const m = /is at \$(-\d+)\$ meters and .* is at \$(\d+)\$ meters/.exec(
        p,
      )!;
      const far = Math.max(Math.abs(Number(m[1])), Number(m[2]));
      const farValue = Math.abs(Number(m[1])) > Number(m[2]) ? m[1] : m[2];
      assert.ok(correct.includes(`|${farValue}|=${far}`));
    } else if (variant === "order-list") {
      const asc = /least to greatest/.test(p);
      const parse = (list: string) =>
        list.replace(/\$/g, "").split(",\\ ").map(texNumber);
      const sortedOk = (list: string) => {
        const v = parse(list);
        return v.every(
          (x, i) => i === 0 || (asc ? v[i - 1]! < x : v[i - 1]! > x),
        );
      };
      const hits = options.filter((o) => sortedOk(o.label));
      assert.deepEqual(
        hits.map((o) => o.id),
        [g.answer],
      );
      const shown = parse(/Order (.*) from/.exec(p)![1]!);
      assert.deepEqual([...shown].sort(), [...parse(correct)].sort());
    } else {
      const m =
        /^At noon, (.+) is \$(-?[\d.]+)\$ degrees Celsius and (.+) is \$(-?[\d.]+)\$ degrees/.exec(
          p,
        )!;
      const [n1, t1, n2, t2] = [m[1]!, Number(m[2]), m[3]!, Number(m[4])];
      const [colder, cv, wv] = t1 < t2 ? [n1, t1, t2] : [n2, t2, t1];
      const word = colder[0]!.toUpperCase() + colder.slice(1);
      assert.ok(correct.startsWith(`${word} is colder`));
      assert.ok(
        correct.includes(`$${cv}<${wv}$`) ||
          correct.includes(`$${cv.toFixed(1)}<${wv.toFixed(1)}$`) ||
          /</.test(correct),
      );
    }
  }
});

test("each template has a lesson, method, principle and worked example", () => {
  for (const id of ids) {
    const lesson = problemLesson(id, "library");
    assert.ok((lesson.intuition ?? "").length > 40, id);
    assert.ok(lesson.method.length >= 2, id);
    assert.ok(lesson.watch, id);
    assert.ok(lesson.principle, id);
    assert.ok(lesson.example.steps.length >= 3, id);
  }
});
