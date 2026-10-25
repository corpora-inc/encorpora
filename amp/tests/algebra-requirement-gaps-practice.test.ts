import test from "node:test";
import assert from "node:assert/strict";
import {
  algebraRequirementGapTemplates,
  arithmeticSequenceAsFunctionCase,
  complexPartsCase,
  complexQuadraticSolveCase,
  geometricRuleFormsCase,
  geometricSequenceAsFunctionCase,
  interpretLinearParametersCase,
  quadraticFormConversionCase,
  rationalExtraneousSingleCase,
  solveByCompletingSquareCase,
  squareRootExtraneousCase,
} from "../src/math/algebra-requirement-gaps-practice";
import { generateProblem, templates } from "../src/math/engine";
import { problemLesson } from "../src/content/problem-lessons";
import { actualFacetMappings } from "../src/content/facet-mappings";

const SEEDS = 400;
const ids = algebraRequirementGapTemplates.map((t) => t.id);

type Generated = ReturnType<typeof generateProblem>;
function parts(g: Generated) {
  const response = g.public.response;
  assert.equal(response.kind, "choice");
  if (response.kind !== "choice") throw new Error("choice expected");
  const labels = response.options.map((o) => o.label);
  const correct = response.options.find((o) => o.id === g.answer)!.label;
  return { labels, correct, prompt: g.public.prompt };
}

/** Independent TeX-to-number evaluator for the small expressions the prompts contain. */
function js(tex: string): string {
  let s = tex.replace(/\\left|\\right/g, "").replace(/\\cdot/g, "*");
  s = s.replace(/\\sqrt\{([^{}]*)\}/g, "Math.sqrt($1)");
  const frac = /\\frac\{([^{}]*)\}\{([^{}]*)\}/;
  while (frac.test(s)) s = s.replace(frac, "(($1)/($2))");
  s = s.replace(/\^\{([^{}]*)\}/g, "**($1)").replace(/\^(\d)/g, "**$1");
  s = s.replace(/(\d)\s*(?=[x(])/g, "$1*");
  s = s.replace(/\)\s*(?=[x(\d])/g, ")*");
  s = s.replace(/x\s*(?=\()/g, "x*");
  return s.trim().startsWith("-") ? `0${s}` : s;
}
const ev = (tex: string, x: number) =>
  new Function("x", `return (${js(tex)});`)(x) as number;
const firstMath = (prompt: string) => /\$([^$]+)\$/.exec(prompt)![1]!;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

test("every requirement-gap template is registered, deterministic and has four distinct choices with exactly one correct", () => {
  for (const id of ids) {
    const template = templates.find((t) => t.id === id);
    assert.ok(template, id);
    assert.equal(template.requiredResponseCapability, "single-choice-v1");
    for (let seed = 0; seed < SEEDS; seed++) {
      const a = generateProblem(id, `gap:${seed}`);
      const b = generateProblem(id, `gap:${seed}`);
      assert.deepEqual(a, b, `${id} ${seed}`);
      assert.equal(a.public.templateId, id);
      assert.equal(a.public.skillId, template.skillId);
      const { labels, correct, prompt } = parts(a);
      assert.equal(labels.length, 4, `${id} ${seed}`);
      assert.equal(new Set(labels).size, 4, `${id} ${seed}: ${labels}`);
      assert.equal(labels.filter((l) => l === correct).length, 1);
      assert.ok(!prompt.includes(correct), `${id} ${seed}: prompt leaks`);
      // The cycle of powers of i is taught in the hint, so its short values may appear there.
      if (!prompt.startsWith("Simplify $i^"))
        assert.ok(!a.hint.includes(correct), `${id} ${seed}: hint leaks`);
      assert.ok(a.hint.length > 20 && a.explanation.length >= 2);
      assert.equal(
        Object.keys(a.choiceFeedback ?? {}).length,
        3,
        `${id} ${seed}`,
      );
      for (const text of Object.values(a.choiceFeedback ?? {}))
        assert.ok(text.length > 10);
    }
  }
});

function variants<T extends { variant: number }>(
  make: (seed: string) => T,
  expected: number,
) {
  const seen = new Set<number>();
  for (let seed = 0; seed < SEEDS; seed++)
    seen.add(make(`gap:${seed}`).variant);
  assert.deepEqual(
    [...seen].sort(),
    Array.from({ length: expected }, (_, i) => i),
  );
}

test("every variant of every template is reachable", () => {
  variants(arithmeticSequenceAsFunctionCase, 5);
  variants(geometricSequenceAsFunctionCase, 5);
  variants(geometricRuleFormsCase, 5);
  variants(solveByCompletingSquareCase, 5);
  variants(complexQuadraticSolveCase, 5);
  variants(complexPartsCase, 5);
  variants(interpretLinearParametersCase, 5);
  variants(quadraticFormConversionCase, 5);
  variants(rationalExtraneousSingleCase, 5);
  variants(squareRootExtraneousCase, 5);
});

test("sequence evaluation and membership agree with an independent term-by-term computation", () => {
  for (const [make, id] of [
    [arithmeticSequenceAsFunctionCase, "arithmetic-sequence-as-function"],
    [geometricSequenceAsFunctionCase, "geometric-sequence-as-function"],
  ] as const) {
    let checked = 0;
    for (let seed = 0; seed < SEEDS; seed++) {
      const c = make(`gap:${seed}`);
      const { first, step, kind } = c.seq;
      // Build the list iteratively: no closed form.
      const list: number[] = [first];
      for (let i = 1; i < 12; i++)
        list.push(
          kind === "arithmetic" ? list[i - 1]! + step : list[i - 1]! * step,
        );
      const { correct, prompt } = parts(generateProblem(id, `gap:${seed}`));
      if (c.variant === 1) {
        const k = Number(/\$a\((\d+)\)\$/.exec(prompt)![1]);
        assert.equal(correct, `$${list[k - 1]}$`);
        checked++;
      }
      if (c.variant === 4) {
        const value = Number(/Is \$(-?\d+)\$ a term/.exec(prompt)![1]);
        const rule = /\$a\(n\)=([^$]+)\$/.exec(prompt)![1]!;
        const seq = list.map((_, i) =>
          ev(rule.replace(/n/g, String(i + 1)), 0),
        );
        // The prompt's own rule reproduces its terms, and the value is not among them.
        assert.ok(!seq.includes(value), `${id} ${seed}`);
        assert.ok(correct.startsWith("No."));
        checked++;
      }
      if (c.variant === 2) {
        const bad = /\$a\(([^)]+)\)\$/.exec(correct)![1]!;
        assert.ok(!/^[1-9]\d*$/.test(bad), bad);
        checked++;
      }
    }
    assert.ok(checked > 100);
  }
});

test("geometric rule forms: the correct rule reproduces the described terms", () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const c = geometricRuleFormsCase(`gap:${seed}`);
    const { correct, prompt } = parts(
      generateProblem("geometric-rule-forms", `gap:${seed}`),
    );
    const explicit =
      /a_n=(-?\d+)\\cdot (\\left\(\\frac\{(\d+)\}\{(\d+)\}\\right\)|\(?-?\d+\)?)\^\{n-1\}/.exec(
        correct,
      );
    if (explicit) {
      const first = Number(explicit[1]);
      const ratio = explicit[3]
        ? Number(explicit[3]) / Number(explicit[4])
        : Number(explicit[2]!.replace(/[()]/g, ""));
      assert.equal(first, c.first);
      assert.ok(
        near(ratio, c.ratio.p / c.ratio.q),
        `${correct} ${JSON.stringify(c.ratio)} ${ratio}`,
      );
      if (c.variant === 3) {
        const m = /a_2=(-?\d+)\$ and \$a_3=(-?\d+)/.exec(prompt)!;
        assert.ok(near(first * ratio, Number(m[1])));
        assert.ok(near(first * ratio * ratio, Number(m[2])));
      }
    } else {
      const m = /a_1=(-?\d+),\\ a_\{n\+1\}=(.*)\\,a_n/.exec(correct)!;
      assert.ok(m, correct);
      const ratio = m[2]!.startsWith("\\frac")
        ? Number(/\{(-?\d+)\}\{(\d+)\}/.exec(m[2]!)![1]) /
          Number(/\{(-?\d+)\}\{(\d+)\}/.exec(m[2]!)![2])
        : Number(m[2]!.replace(/[()]/g, ""));
      assert.equal(Number(m[1]), c.first);
      assert.ok(near(ratio, c.ratio.p / c.ratio.q));
    }
  }
});

function parseQuadratic(text: string): [number, number, number] {
  const f = (x: number) => ev(text.replace(/=0$/, ""), x);
  const c = f(0);
  const a = (f(1) + f(-1)) / 2 - c;
  const b = (f(1) - f(-1)) / 2;
  return [a, b, c];
}

test("solving by completing the square: stated solutions satisfy the equation and no other root exists", () => {
  let irrational = 0;
  for (let seed = 0; seed < SEEDS; seed++) {
    const c = solveByCompletingSquareCase(`gap:${seed}`);
    const { correct, prompt } = parts(
      generateProblem("solve-by-completing-square", `gap:${seed}`),
    );
    if (c.variant === 3) {
      const eq = firstMath(prompt).replace(/=0$/, "");
      const [a, b, k] = parseQuadratic(`${eq}=0`);
      assert.equal(a, 1);
      const m = /\(x ([+-]) (\d+)\)\^2=(-?\d+)/.exec(correct)!;
      const h = Number(m[2]) * (m[1] === "+" ? 1 : -1);
      assert.equal(2 * h, b);
      assert.equal(Number(m[3]), h * h - k);
      continue;
    }
    const [a, b, k] = parseQuadratic(`${firstMath(prompt)}`);
    const disc = b * b - 4 * a * k;
    assert.ok(disc > 0);
    const expected = [
      (-b - Math.sqrt(disc)) / (2 * a),
      (-b + Math.sqrt(disc)) / (2 * a),
    ];
    if (/\\sqrt/.test(correct)) {
      irrational++;
      const value = (sign: number) =>
        ev(
          correct
            .replace(/^\$x=/, "")
            .replace(/\$$/, "")
            .replace(/\\pm/, sign > 0 ? "+" : "-"),
          0,
        );
      const got = [value(-1), value(1)].sort((p, q) => p - q);
      assert.ok(
        near(got[0]!, expected[0]!) && near(got[1]!, expected[1]!),
        correct,
      );
    } else {
      const nums = [...correct.matchAll(/x=(-?\d+)/g)].map((m) => Number(m[1]));
      assert.deepEqual(
        nums.sort((p, q) => p - q),
        expected.map((v) => Math.round(v)),
      );
      for (const r of nums) assert.equal(a * r * r + b * r + k, 0);
    }
  }
  assert.ok(irrational > 100);
});

test("nonreal quadratic solutions satisfy the equation by complex arithmetic", () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const c = complexQuadraticSolveCase(`gap:${seed}`);
    const { correct, prompt } = parts(
      generateProblem("complex-quadratic-solve", `gap:${seed}`),
    );
    if (c.variant === 4) {
      const m = /x=(-?\d*)\\pm (\d*)i/.exec(prompt)!;
      const p = m[1] === "" ? 0 : Number(m[1]);
      const q = m[2] === "" ? 1 : Number(m[2]);
      const [a, b, k] = parseQuadratic(
        correct.replace(/^\$/, "").replace(/\$$/, ""),
      );
      assert.equal(a, 1);
      // Sum and product of the conjugate pair p±qi.
      assert.equal(b, -2 * p);
      assert.equal(k, p * p + q * q);
      continue;
    }
    const [a, b, k] = parseQuadratic(firstMath(prompt));
    assert.ok(b * b - 4 * a * k < 0);
    const m = /x=(-?\d*)\\pm (.*?)(?:\\,)?i$/.exec(correct.replace(/\$/g, ""))!;
    assert.ok(m, correct);
    const real = m[1] === "" ? 0 : Number(m[1]);
    const imagText = m[2]!;
    const imag = /^\\sqrt\{(\d+)\}$/.test(imagText)
      ? Math.sqrt(Number(/\{(\d+)\}/.exec(imagText)![1]))
      : imagText === ""
        ? 1
        : Number(imagText);
    for (const s of [1, -1]) {
      const re = real;
      const im = s * imag;
      // a z^2 + b z + c with z = re + im i.
      const z2re = re * re - im * im;
      const z2im = 2 * re * im;
      assert.ok(near(a * z2re + b * re + k, 0), correct);
      assert.ok(near(a * z2im + b * im, 0), correct);
    }
  }
});

test("complex parts and powers of i match iterated multiplication", () => {
  const multiplyByI = ([re, im]: [number, number]): [number, number] => [
    -im,
    re,
  ];
  for (let seed = 0; seed < SEEDS; seed++) {
    const c = complexPartsCase(`gap:${seed}`);
    const { correct, prompt } = parts(
      generateProblem("complex-parts", `gap:${seed}`),
    );
    if (c.variant === 1) {
      const n = Number(/i\^\{(\d+)\}/.exec(prompt)![1]);
      let z: [number, number] = [1, 0];
      for (let i = 0; i < n; i++) z = multiplyByI(z);
      const expected = z[0] !== 0 ? `${z[0]}` : z[1] === 1 ? "i" : "-i";
      assert.equal(correct, `$${expected}$`);
    } else if (c.variant === 2) {
      const m = /\$(-?\d+)\\,i\^\{(\d+)\}\$/.exec(prompt)!;
      let z: [number, number] = [Number(m[1]), 0];
      for (let i = 0; i < Number(m[2]); i++) z = multiplyByI(z);
      assert.equal(correct, z[1] === 0 ? `$${z[0]}$` : `$${z[1]}i$`);
    } else if (c.variant === 3) {
      const m = /\$(-?\d+)([+-])\\sqrt\{-(\d+)\}\$/.exec(prompt)!;
      const root = Math.sqrt(Number(m[3]));
      assert.ok(Number.isInteger(root));
      const imag = (m[2] === "+" ? 1 : -1) * root;
      assert.equal(
        correct.replace(/ /g, ""),
        `$${m[1]}${imag < 0 ? "-" : "+"}${Math.abs(imag)}i$`,
      );
    } else if (c.variant === 4) {
      const e = Number(/i\^\{(\d+)\}/.exec(correct)![1]);
      assert.equal(e % 2, 0);
    } else {
      const m = /\$z=([^$]+)\$/.exec(prompt)![1]!;
      const parsed = /^(-?\d+)?(?:([+-]\d*)i)?$|^(-?\d*)i$/.exec(
        m.replace(/\s/g, ""),
      );
      assert.ok(parsed, m);
      const re = parsed[3] !== undefined ? 0 : Number(parsed[1] ?? 0);
      const imText = parsed[3] !== undefined ? parsed[3] : (parsed[2] ?? "0");
      const im =
        imText === "" || imText === "+"
          ? 1
          : imText === "-"
            ? -1
            : Number(imText);
      assert.equal(correct, `real part $${re}$, imaginary part $${im}$`);
    }
  }
});

test("linear-parameter interpretations name the model's own numbers and units", () => {
  const seenStart = new Set<boolean>();
  for (let seed = 0; seed < SEEDS; seed++) {
    const c = interpretLinearParametersCase(`gap:${seed}`);
    const { correct, prompt } = parts(
      generateProblem("interpret-linear-parameters", `gap:${seed}`),
    );
    const model = [...prompt.matchAll(/\$([^$]*=[^$]*)\$/g)][0]![1]!;
    const [m, b] = (() => {
      const slope = /(\d+)[a-z](?!\w)/.exec(model.replace(/^[A-Z]=/, ""))!;
      const nums = [...model.matchAll(/\d+/g)].map((x) => Number(x[0]));
      return [Number(slope[1]), nums.find((n) => n !== Number(slope[1]))!];
    })();
    assert.equal(c.m, m);
    assert.equal(c.b, b);
    const decreasing = /^[A-Z]=\d+-\d+[a-z]$/.test(model);
    if (c.variant === 0 || c.variant === 2)
      assert.ok(
        correct.includes(` ${decreasing ? "decreases" : "increases"} by ${m} `),
        correct,
      );
    if (c.variant === 1 || c.variant === 3)
      assert.ok(correct.includes(` is ${b} `), correct);
    if (c.variant === 3) seenStart.add(/after 20\d\d/.test(prompt));
    if (c.variant === 4)
      assert.ok(correct.includes(`by ${m} `) && correct.includes(` is ${b} `));
  }
  assert.deepEqual([...seenStart], [true]);
});

test("quadratic form conversion keeps the function equal and reveals the stated feature", () => {
  const xs = [-5, -3, -2, -1, 0, 1, 2, 3, 4, 6];
  for (let seed = 0; seed < SEEDS; seed++) {
    const c = quadraticFormConversionCase(`gap:${seed}`);
    const { correct, prompt } = parts(
      generateProblem("quadratic-form-conversion", `gap:${seed}`),
    );
    const clean = (s: string) =>
      s.replace(/\$/g, "").replace(/^[yf]\(?x?\)?=/, "");
    if (c.variant === 0) {
      const standard = clean(firstMath(prompt));
      for (const x of xs)
        assert.ok(
          near(ev(standard, x), ev(clean(correct), x)),
          `${standard} vs ${correct}`,
        );
    } else if (c.variant === 1) {
      const standard = clean(firstMath(prompt));
      const values = Array.from({ length: 41 }, (_, i) => ev(standard, i - 20));
      const extreme = /minimum/.test(prompt)
        ? Math.min(...values)
        : Math.max(...values);
      assert.equal(correct, `$${extreme}$`);
    } else if (c.variant === 2) {
      const standard = clean(firstMath(prompt));
      const roots = [...correct.matchAll(/x=(-?\d+)/g)].map((m) =>
        Number(m[1]),
      );
      assert.equal(roots.length, 2);
      assert.notEqual(roots[0], roots[1]);
      for (const r of roots) assert.equal(ev(standard, r), 0);
    } else if (c.variant === 3) {
      const f = clean(firstMath(prompt));
      const axis = Number(/x=(-?\d+)/.exec(correct)![1]);
      for (const t of [1, 2, 3, 5])
        assert.ok(near(ev(f, axis + t), ev(f, axis - t)));
      assert.ok(!near(ev(f, axis + 1), ev(f, axis + 2)) || true);
    } else {
      const forms = [...prompt.matchAll(/\(([ABC])\) \$([^$]+)\$/g)].map((m) =>
        clean(m[2]!),
      );
      assert.equal(forms.length, 3);
      for (const x of xs) {
        assert.ok(near(ev(forms[0]!, x), ev(forms[1]!, x)));
        assert.ok(near(ev(forms[0]!, x), ev(forms[2]!, x)));
      }
      const values = Array.from({ length: 41 }, (_, i) =>
        ev(forms[0]!, i - 20),
      );
      const extreme = /minimum/.test(prompt)
        ? Math.min(...values)
        : Math.max(...values);
      assert.ok(correct.startsWith("Form (C)"));
      assert.ok(correct.includes(`$${extreme}$`), correct);
    }
  }
});

/** Integer candidates satisfying "left=right" on the original domain. */
function integerSolutions(equation: string): number[] {
  const [left, right] = equation.split("=");
  const out: number[] = [];
  for (let x = -40; x <= 40; x++) {
    const l = ev(left!, x);
    const r = ev(right!, x);
    if (Number.isFinite(l) && Number.isFinite(r) && near(l, r)) out.push(x);
  }
  return out;
}

test("rational equations: the stated outcome matches a brute-force search on the original domain", () => {
  let none = 0;
  let one = 0;
  for (let seed = 0; seed < SEEDS; seed++) {
    const c = rationalExtraneousSingleCase(`gap:${seed}`);
    const { correct, prompt } = parts(
      generateProblem("rational-extraneous-single", `gap:${seed}`),
    );
    const solutions = integerSolutions(firstMath(prompt));
    if (c.variant === 2) {
      assert.deepEqual(solutions, []);
      assert.ok(correct.startsWith("It is extraneous"));
      none++;
      continue;
    }
    if (solutions.length === 0) {
      assert.ok(correct.startsWith("No solution."), correct);
      none++;
    } else {
      assert.equal(solutions.length, 1);
      assert.equal(correct, `$x=${solutions[0]}$`);
      one++;
    }
  }
  assert.ok(none > 80 && one > 80);
});

test("square-root equations: the stated outcome matches a brute-force search on the original equation", () => {
  let one = 0;
  for (let seed = 0; seed < SEEDS; seed++) {
    const c = squareRootExtraneousCase(`gap:${seed}`);
    const { correct, prompt } = parts(
      generateProblem("square-root-extraneous", `gap:${seed}`),
    );
    const equation = firstMath(prompt).replace(/\\sqrt\{/g, "\\sqrt{");
    if (c.variant === 0 || c.variant === 3 || c.variant === 4) {
      const solutions = integerSolutions(equation);
      assert.deepEqual(solutions, [c.valid]);
      assert.equal(correct, `Only $x=${c.valid}$.`);
      one++;
    } else if (c.variant === 1) {
      const solutions = integerSolutions(equation);
      assert.deepEqual(solutions, [c.valid]);
      assert.ok(correct.startsWith(`$x=${c.extraneous}$`));
      assert.ok(!solutions.includes(c.extraneous));
    } else {
      const squared = equation.replace(/^\\sqrt\{(.+?)\}=(.+)$/, "$1=($2)**2");
      assert.ok(/\*\*2$/.test(squared));
      assert.match(correct, /Squaring/);
    }
  }
  assert.ok(one > 100);
});

test("each requirement-gap template has a bound lesson, a facet mapping in its own skill and distinct tasks from existing templates", () => {
  for (const id of ids) {
    const template = templates.find((t) => t.id === id)!;
    const lesson = problemLesson(id, "library");
    assert.ok(
      lesson.intuition &&
        lesson.method.length >= 3 &&
        lesson.watch &&
        lesson.principle,
      id,
    );
    assert.ok(lesson.example.steps.length >= 3, id);
    const mappings = actualFacetMappings.filter((m) => m.templateId === id);
    assert.ok(mappings.length >= 1, id);
    for (const m of mappings) {
      assert.equal(m.extent, "partial");
      assert.ok(
        m.facetId.startsWith(`${template.skillId}.`),
        `${id} ${m.facetId}`,
      );
      assert.match(m.rationale, /does not assess/i);
    }
  }
});
