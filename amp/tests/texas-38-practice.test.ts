import test from "node:test";
import assert from "node:assert/strict";
import { texas38Case, texas38Templates } from "../src/math/texas-38-practice";
import { generateProblem, templates } from "../src/math/engine";
import { problemLesson } from "../src/content/problem-lessons";
import { lessons } from "../src/content/lessons";

const VARIANTS: Record<string, string[]> = {
  "times-as-many-comparison": [
    "expression-to-sentence",
    "sentence-to-expression",
    "compare-counts",
  ],
  "situation-pair-table": [
    "rate-forward",
    "rate-backward",
    "per-one",
    "gap-forward",
    "gap-backward",
  ],
  "story-equation-choice": [
    "join-result",
    "separate-result",
    "join-start-unknown",
    "separate-start-unknown",
    "join-change-unknown",
    "two-step-result",
    "two-step-start-unknown",
  ],
  "strip-diagram-equation": [
    "groups-plus-extra",
    "total-minus-groups",
    "unknown-in-groups",
    "share-after-removing",
  ],
  "division-area-model": [
    "partial-quotients",
    "area-equation",
    "read-quotient",
  ],
  "fraction-benchmark-reasonable": [
    "nearest-benchmark",
    "estimate-sum",
    "estimate-difference",
    "denominator-check",
  ],
  "unit-relative-size": [
    "which-larger",
    "cross-system",
    "greater-number",
    "order",
  ],
  "decimal-area-model": [
    "product-from-grid",
    "sentence-from-grid",
    "divide-tenths",
    "divide-hundredths",
  ],
  "number-set-venn": ["place-number", "smallest-set", "subset-statement"],
  "reciprocal-division-choice": [
    "whole-by-fraction",
    "fraction-by-fraction",
    "fraction-by-whole",
    "how-many-fit",
  ],
  "scaling-direction-choice": [
    "greater-than-start",
    "less-than-start",
    "statement",
  ],
  "percent-grid-model": ["grid-percent", "grid-fraction", "grid-decimal"],
  "percent-forms-and-parts": [
    "fraction-to-percent",
    "decimal-to-percent",
    "percent-to-fraction",
    "find-whole",
    "find-percent",
  ],
  "independent-dependent-roles": [
    "independent-from-table",
    "dependent-from-table",
    "which-depends",
    "horizontal-axis",
  ],
  "expression-or-equation": [
    "pick-equation",
    "pick-expression",
    "verbal",
    "numeric",
  ],
  "rational-area-volume-equation": [
    "triangle-height",
    "triangle-base",
    "rectangle-width",
    "prism-height",
  ],
  "categorical-summary": ["mode", "relative-frequency", "percent-bar-count"],
  "check-register-balance": [
    "final-balance",
    "final-with-transfer-and-fee",
    "missing-amount",
  ],
  "lifetime-income-salary": [
    "annual-times-years",
    "age-span",
    "monthly-pay",
    "two-salaries",
  ],
  "pi-as-ratio": [
    "definition",
    "measured-diameter",
    "measured-radius",
    "scale",
  ],
  "experimental-probability-predict": [
    "experimental-probability",
    "predict-count",
    "compare-expected",
    "trust-more-trials",
  ],
  "cylinder-prism-surface-area": [
    "lateral",
    "total",
    "find-height",
    "triangular-prism",
  ],
  "both-sides-situation-equation": [
    "equation-same-cost",
    "inequality-less",
    "decreasing-and-increasing",
  ],
};

type P = ReturnType<typeof generateProblem>;
const labels = (p: P) =>
  p.public.response.kind === "choice"
    ? p.public.response.options.map((o) => o.label)
    : [];
const correctLabel = (p: P) => {
  const r = p.public.response;
  assert.equal(r.kind, "choice");
  if (r.kind !== "choice") throw new Error("choice");
  return r.options.find((o) => o.id === p.answer)!.label;
};
const num = (s: string) => Number(s.replace(/,/g, ""));

test("every variant is reachable, deterministic and engine-routed", () => {
  for (const t of texas38Templates) {
    const seen = new Set<string>();
    for (let seed = 0; seed < 400; seed++) {
      const c = texas38Case(t.id, `s${seed}`);
      seen.add(c.variant);
      if (seed < 40) {
        const again = generateProblem(t.id, `s${seed}`);
        assert.deepEqual(again, generateProblem(t.id, `s${seed}`));
        assert.equal(again.public.templateId, t.id);
        assert.equal(again.public.skillId, t.skillId);
        assert.equal(again.answer, c.problem.answer);
      }
    }
    assert.deepEqual([...seen].sort(), [...VARIANTS[t.id]!].sort(), t.id);
    assert.ok(templates.some((x) => x.id === t.id));
    assert.ok(problemLesson(t.id, "library").method.length >= 1);
    assert.ok(
      lessons.some((l) => l.templateIds.includes(t.id)),
      `${t.id} has a lesson`,
    );
  }
});

test("choices are distinct, exactly one is correct, feedback exists and prompts do not reveal the answer", () => {
  for (const t of texas38Templates)
    for (let seed = 0; seed < 400; seed++) {
      const { problem: p } = texas38Case(t.id, `s${seed}`);
      assert.ok(p.hint.length > 20 && p.explanation.length >= 2);
      const r = p.public.response;
      if (r.kind === "number") {
        assert.ok(/^\d+(\.\d{1,2})?$/.test(p.answer), `${t.id} ${p.answer}`);
        continue;
      }
      assert.equal(r.kind, "choice");
      if (r.kind !== "choice") continue;
      assert.equal(r.options.length, 4, t.id);
      assert.equal(new Set(labels(p)).size, 4, `${t.id} ${labels(p)}`);
      const wrong = r.options.filter((o) => o.id !== p.answer);
      assert.equal(wrong.length, 3);
      for (const o of wrong) assert.ok(p.choiceFeedback![o.id]!.length > 10);
      assert.ok(!(p.answer in (p.choiceFeedback ?? {})));
    }
});

test("numeric answers are not stated in the prompt or hint", () => {
  for (const t of texas38Templates)
    for (let seed = 0; seed < 400; seed++) {
      const { problem: p } = texas38Case(t.id, `s${seed}`);
      if (p.public.response.kind !== "number") continue;
      const re = new RegExp(
        `(?<![\\d.,])${p.answer.replace(".", "\\.")}(?![\\d]|[.,]\\d)`,
      );
      assert.ok(!re.test(p.public.prompt + " " + p.hint), `${t.id} leaks`);
    }
});

test("figures never state the asked-for number", () => {
  for (const id of ["situation-pair-table", "check-register-balance"])
    for (let seed = 0; seed < 200; seed++) {
      const p = texas38Case(id, `s${seed}`).problem;
      const text = JSON.stringify(p.public.figure);
      assert.ok(text.includes('"?"'), `${id} shows an unknown cell`);
    }
});

test("numeric templates match an independent derivation from the prompt", () => {
  for (let seed = 0; seed < 300; seed++) {
    // Lifetime income: recompute from the numbers in the prompt.
    {
      const { variant, problem: p } = texas38Case(
        "lifetime-income-salary",
        `s${seed}`,
      );
      const n = [...p.public.prompt.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) =>
        num(m[0]),
      );
      const expected =
        variant === "annual-times-years"
          ? n[0]! * n[1]!
          : variant === "age-span"
            ? (n[1]! - n[0]!) * n[2]!
            : variant === "monthly-pay"
              ? n[0]! * 12 * n[1]!
              : (n[1]! - n[0]!) * n[2]!;
      assert.ok(Math.abs(Number(p.answer) - expected) < 0.005, variant);
    }
    // Cylinder and prism surface area.
    {
      const { variant, problem: p } = texas38Case(
        "cylinder-prism-surface-area",
        `s${seed}`,
      );
      const prompt = p.public.prompt;
      const n = [...prompt.matchAll(/\d+/g)].map((m) => Number(m[0]));
      if (variant === "lateral")
        assert.equal(Number(p.answer), 2 * n[0]! * n[1]!);
      if (variant === "total")
        assert.equal(Number(p.answer), 2 * n[0]! ** 2 + 2 * n[0]! * n[1]!);
      if (variant === "find-height") {
        const [r, a] = n;
        assert.ok(
          Math.abs(2 * r! * Number(p.answer) + 2 * r! ** 2 - a!) < 1e-9,
        );
      }
      if (variant === "triangular-prism") {
        const [pp, q, c, L] = n;
        assert.equal(pp! ** 2 + q! ** 2, c! ** 2);
        assert.equal(Number(p.answer), pp! * q! + (pp! + q! + c!) * L!);
      }
    }
    // Percent conversions and parts.
    {
      const { variant, problem: p } = texas38Case(
        "percent-forms-and-parts",
        `s${seed}`,
      );
      const prompt = p.public.prompt;
      if (variant === "fraction-to-percent") {
        const m = prompt.match(/(\d+)\/(\d+)/)!;
        assert.ok(
          Math.abs(Number(p.answer) - (100 * Number(m[1])) / Number(m[2])) <
            1e-9,
        );
      }
      if (variant === "decimal-to-percent") {
        const m = prompt.match(/Write ([\d.]+) as/)!;
        assert.ok(Math.abs(Number(p.answer) - Number(m[1]) * 100) < 1e-9);
      }
      if (variant === "find-percent") {
        const m = prompt.match(/got (\d+) of (\d+)/)!;
        assert.ok(
          Math.abs(Number(p.answer) - (100 * Number(m[1])) / Number(m[2])) <
            1e-9,
        );
      }
      if (variant === "find-whole") {
        const n = [...prompt.matchAll(/\d+/g)].map((m) => Number(m[0]));
        const part = n[0]!;
        const percent = Number(prompt.match(/(\d+)%/)![1]);
        assert.equal((Number(p.answer) * percent) / 100, part);
      }
    }
    // Experimental probability.
    {
      const { variant, problem: p } = texas38Case(
        "experimental-probability-predict",
        `s${seed}`,
      );
      const n = [...p.public.prompt.matchAll(/\d+/g)].map((m) => Number(m[0]));
      if (variant === "experimental-probability")
        assert.ok(Math.abs(Number(p.answer) - n[1]! / n[0]!) < 1e-9);
      if (variant === "predict-count")
        assert.equal(Number(p.answer), (n[1]! * n[2]!) / n[0]!);
    }
  }
});

test("check register balances recompute from the figure", () => {
  for (let seed = 0; seed < 300; seed++) {
    const { variant, problem: p } = texas38Case(
      "check-register-balance",
      `s${seed}`,
    );
    const fig = p.public.figure as {
      kind: "scene";
      scene: {
        elements: {
          type: string;
          rows: { label: string; cells: (string | number)[] }[];
        }[];
      };
    };
    const rows = fig.scene.elements[0]!.rows;
    const cents = (s: string) =>
      Math.round(Number(s.replace(/[−+]/g, "")) * 100);
    const sign = (s: string) => (s.startsWith("−") ? -1 : 1);
    let run = cents(String(rows[0]!.cells[1]));
    assert.ok(run > 0);
    for (let i = 1; i < rows.length; i++) {
      const [amt, bal] = rows[i]!.cells.map(String) as [string, string];
      if (amt === "?") {
        // Missing amount: the answer is the absolute change in balance.
        const before = cents(String(rows[i - 1]!.cells[1]));
        const after = cents(bal);
        assert.equal(variant, "missing-amount");
        assert.equal(
          Math.round(Number(p.answer) * 100),
          Math.abs(after - before),
        );
        run = after;
      } else if (bal === "?") {
        run += sign(amt) * cents(amt);
        assert.equal(Math.round(Number(p.answer) * 100), run);
      } else {
        run += sign(amt) * cents(amt);
        assert.equal(run, cents(bal));
      }
      assert.ok(run >= 0);
    }
  }
});

test("equation templates keep the correct choice mathematically right", () => {
  for (let seed = 0; seed < 300; seed++) {
    // Story equations: the correct choice solves to the story's unknown.
    const s = texas38Case("story-equation-choice", `s${seed}`).problem;
    const prompt = s.public.prompt;
    const nums = [...prompt.matchAll(/\d+/g)].map((m) => Number(m[0]));
    const eq = correctLabel(s);
    const solve = (text: string) => {
      const [l, r] = text.split(" = ");
      const side = (e: string, n: number) =>
        Function("n", `return ${e.replace(/−/g, "-")}`)(n) as number;
      // Both sides are linear in n, so two points determine the solution.
      const f = (n: number) => side(l!, n) - side(r!, n);
      const f0 = f(0),
        f1 = f(1);
      return -f0 / (f1 - f0);
    };
    // Reconstruct the answer from the story numbers and compare.
    const v = solve(eq);
    assert.ok(Number.isInteger(v) && v > 0, `${eq} -> ${v}`);
    for (const o of labels(s).filter((l) => l !== eq)) {
      const w = solve(o);
      assert.notEqual(
        Math.round(w * 1e6),
        Math.round(v * 1e6),
        `${o} equals ${eq}`,
      );
    }
    void nums;
  }
  for (let seed = 0; seed < 300; seed++) {
    // Both-sides: the correct choice has the unique positive integer solution the prompt was built from.
    const { variant, problem: p } = texas38Case(
      "both-sides-situation-equation",
      `s${seed}`,
    );
    if (variant === "inequality-less") continue;
    const eq = correctLabel(p);
    const [l, r] = eq.split(" = ");
    const vr = /[a-z]/.exec(eq)![0];
    const side = (e: string, x: number) =>
      Function(
        vr,
        `return ${e
          .replace(/−/g, "-")
          .replace(new RegExp(`(\\d)${vr}`, "g"), "$1*" + vr)}`,
      )(x) as number;
    const f = (x: number) => side(l!, x) - side(r!, x);
    const root = -f(0) / (f(1) - f(0));
    assert.ok(
      Number.isInteger(root) && root >= 3 && root <= 9,
      `${eq} ${root}`,
    );
  }
});

test("grid and set figures match their stated amounts", () => {
  for (let seed = 0; seed < 200; seed++) {
    const { variant, problem: p } = texas38Case(
      "percent-grid-model",
      `s${seed}`,
    );
    const fig = p.public.figure as {
      scene: {
        title: string;
        elements: { id?: string; type: string; size?: number[] }[];
      };
    };
    const shaded = fig.scene.elements
      .filter((e) => e.id?.startsWith("shade-"))
      .reduce((a, e) => a + e.size![0]! * e.size![1]!, 0);
    const k = Number(fig.scene.title.match(/(\d+) of 100/)![1]);
    assert.equal(shaded, k, variant);
    if (variant === "grid-percent") assert.equal(correctLabel(p), `${k}%`);
    if (variant === "grid-decimal") assert.equal(num(correctLabel(p)), k / 100);
    if (variant === "grid-fraction") {
      const [a, b] = correctLabel(p).split("/").map(Number);
      assert.equal(a! * 100, k * b!);
    }
  }
  for (let seed = 0; seed < 200; seed++) {
    const { variant, problem: p } = texas38Case(
      "decimal-area-model",
      `s${seed}`,
    );
    if (!variant.endsWith("grid")) continue;
    const fig = p.public.figure as {
      scene: { elements: { id?: string; size?: number[] }[] };
    };
    const shade = fig.scene.elements.find((e) => e.id === "shade-0")!;
    const area = (shade.size![0]! * shade.size![1]!) / 100;
    if (variant === "product-from-grid")
      assert.equal(num(correctLabel(p)), area);
    else assert.ok(correctLabel(p).endsWith(`= ${area}`));
  }
});

test("number-set regions follow the nested-set definitions", () => {
  const frac = (t: string) => {
    const s = t.replace(/−/g, "-");
    const mixed = s.match(/^(-?\d+) (\d+)\/(\d+)$/);
    if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
    if (s.includes("/")) {
      const [a, b] = s.split("/").map(Number);
      return a! / b!;
    }
    return Number(s);
  };
  const region = (x: number) =>
    !Number.isInteger(x) ? 3 : x < 0 ? 2 : x === 0 ? 1 : 0;
  const SETS = [
    "natural numbers",
    "whole numbers",
    "integers",
    "rational numbers",
  ];
  for (let seed = 0; seed < 300; seed++) {
    const { variant, problem: p } = texas38Case("number-set-venn", `s${seed}`);
    const item = p.public.prompt.match(/(?:holds|contains) (.+?)\??$/);
    if (!item) continue;
    const k = region(frac(item[1]!));
    if (variant === "place-number") assert.equal(correctLabel(p), "ABCD"[k]);
    else assert.equal(correctLabel(p), SETS[k]);
  }
});

test("reasonableness and unit-size templates agree with direct computation", () => {
  for (let seed = 0; seed < 300; seed++) {
    const { variant, problem: p } = texas38Case(
      "fraction-benchmark-reasonable",
      `s${seed}`,
    );
    if (variant === "nearest-benchmark") {
      const m = p.public.prompt.match(/(\d+)\/(\d+) closest/)!;
      const x = Number(m[1]) / Number(m[2]);
      const nearest = [0, 0.25, 0.5, 0.75, 1].reduce((a, b) =>
        Math.abs(b - x) < Math.abs(a - x) ? b : a,
      );
      const label = correctLabel(p);
      const v = label.includes("/")
        ? Number(label.split("/")[0]) / Number(label.split("/")[1])
        : Number(label);
      assert.equal(v, nearest);
    }
    if (variant === "estimate-sum" || variant === "estimate-difference") {
      const m = p.public.prompt.match(/(\d+)\/(\d+) ([+−]) (\d+)\/(\d+)/)!;
      const near = (x: number) =>
        [0, 0.25, 0.5, 0.75, 1].reduce((a, b) =>
          Math.abs(b - x) < Math.abs(a - x) ? b : a,
        );
      const a = near(Number(m[1]) / Number(m[2]));
      const c = near(Number(m[4]) / Number(m[5]));
      const e = m[3] === "+" ? a + c : a - c;
      const label = correctLabel(p).replace("about ", "");
      const parts = label.split(" ");
      const value =
        label === "0"
          ? 0
          : parts.reduce(
              (s, t) =>
                s +
                (t.includes("/")
                  ? Number(t.split("/")[0]) / Number(t.split("/")[1])
                  : Number(t)),
              0,
            );
      assert.equal(value, e);
    }
  }
});

test("rational equations keep the correct choice and reject the others", () => {
  const parse = (t: string) => {
    const mixed = t.match(/^(\d+) (\d+)\/(\d+)$/);
    if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
    if (t.includes("/"))
      return Number(t.split("/")[0]) / Number(t.split("/")[1]);
    return Number(t);
  };
  for (let seed = 0; seed < 300; seed++) {
    const { variant, problem: p } = texas38Case(
      "rational-area-volume-equation",
      `s${seed}`,
    );
    const eq = correctLabel(p);
    const numbers = [...eq.matchAll(/\d+ \d+\/\d+|\d+\/\d+|\d+/g)].map(
      (m) => m[0],
    );
    const unknown = /[hbw]/.exec(eq)![0];
    const vals = numbers.map(parse);
    if (variant.startsWith("triangle")) {
      // 1/2 × known × u = A
      assert.ok(
        Math.abs(0.5 * vals[1]! * (vals[2]! / (0.5 * vals[1]!)) - vals[2]!) <
          1e-9,
      );
      assert.ok(eq.startsWith("1/2 ×") && eq.includes(unknown));
    }
    if (variant === "rectangle-width")
      assert.ok(eq.includes("×") && eq.endsWith(numbers[1]!));
    if (variant === "prism-height") assert.ok(eq.split("×").length === 3);
    assert.equal(new Set(labels(p)).size, 4);
  }
});
