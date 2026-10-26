import test from "node:test";
import assert from "node:assert/strict";
import {
  regentsGapCase,
  regentsGapTemplateIds,
  regentsGapTemplates,
} from "../src/math/regents-gap-practice";
import { generateProblem, templates } from "../src/math/engine";
import { lessons } from "../src/content/lessons";
import { problemLesson } from "../src/content/problem-lessons";

const SEEDS = 400;
type Case = ReturnType<typeof regentsGapCase>;
const cases = (id: string): Case[] =>
  Array.from({ length: SEEDS }, (_, i) => regentsGapCase(id, `rg:${i}`));
const optionsOf = (c: Case) => {
  const response = c.problem.public.response;
  assert.equal(response.kind, "choice");
  if (response.kind !== "choice") throw new Error("choice expected");
  return response.options;
};
/** The label of the correct choice. */
const correctLabel = (c: Case) =>
  optionsOf(c).find((o) => o.id === c.problem.answer)!.label;
const prompt = (c: Case) => c.problem.public.prompt;
const close = (a: number, b: number, eps = 1e-9) =>
  Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));

/** Independent TeX-to-number evaluator for the expressions these problems print. */
function evalTex(source: string, vars: Record<string, number> = {}): number {
  let s = source
    .replace(/\$/g, "")
    .replace(/\\left|\\right/g, "")
    .replace(/\\cdot/g, "*")
    .replace(/\\ /g, " ");
  for (let guard = 0; guard < 50 && /\\(frac|sqrt)|\^\{/.test(s); guard++) {
    s = s
      .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "(($1)/($2))")
      .replace(/\\sqrt\[(\d+)\]\{([^{}]*)\}/g, "(($2)**(1/$1))")
      .replace(/\\sqrt\{([^{}]*)\}/g, "(($1)**(1/2))")
      .replace(/\^\{([^{}]*)\}/g, "**($1)");
  }
  s = s.replace(/([\dxy)])(?=[xy(])/g, "$1*");
  s = s.replace(/\)(?=\d)/g, ")*");
  assert.match(s, /^[0-9+\-*/(). xy]+$/, `${source} -> ${s}`);
  return Function("x", "y", `return (${s})`)(vars.x, vars.y) as number;
}
const rhsOfEquation = (text: string) => text.split("=").pop()!;

test("every template is registered, deterministic, reaches the engine and has all variants", () => {
  const expected: Record<string, number> = {
    "rg-exponential-base-rate": 4,
    "rg-factor-completely": 3,
    "rg-polynomial-zeros-forms": 2,
    "rg-exponent-monomial-power": 2,
    "rg-rational-exponent-forms": 3,
    "rg-polynomial-build": 2,
    "rg-solid-density": 3,
    "rg-quadrilateral-choice": 3,
    "rg-parallelogram-perpendicular": 3,
    "rg-segment-property-choice": 4,
    "rg-isosceles-right-decimal": 3,
    "rg-triangle-area-sas": 3,
    "rg-triangle-third-side-test": 2,
    "rg-altitude-segment": 1,
  };
  assert.deepEqual(
    [...regentsGapTemplateIds].sort(),
    Object.keys(expected).sort(),
  );
  for (const template of regentsGapTemplates)
    assert.ok(
      templates.some((t) => t.id === template.id),
      template.id,
    );
  for (const id of regentsGapTemplateIds) {
    const variants = new Set<string>();
    for (let i = 0; i < SEEDS; i++) {
      const c = regentsGapCase(id, `rg:${i}`);
      variants.add(c.variant);
      if (i < 25) {
        const g = generateProblem(id, `rg:${i}`);
        assert.deepEqual(g.public, c.problem.public);
        assert.equal(g.answer, c.problem.answer);
        assert.deepEqual(
          regentsGapCase(id, `rg:${i}`).problem.public,
          c.problem.public,
        );
      }
    }
    assert.equal(variants.size, expected[id], `${id}: ${[...variants]}`);
  }
});

test("choice problems have four distinct options with feedback, exactly one correct, and prompt and hint never state it", () => {
  for (const id of regentsGapTemplateIds)
    for (const c of cases(id)) {
      const { problem } = c;
      const response = problem.public.response;
      assert.ok(problem.hint.length > 20 && problem.explanation.length >= 2);
      if (response.kind !== "choice") {
        assert.match(problem.answer, /^-?\d+(\.\d+)?$/, problem.answer);
        continue;
      }
      const labels = response.options.map((o) => o.label);
      assert.equal(new Set(labels).size, 4, `${id}: ${labels}`);
      assert.ok(
        response.options.some((o) => o.id === problem.answer),
        id,
      );
      const feedback = problem.choiceFeedback ?? {};
      for (const o of response.options)
        if (o.id !== problem.answer)
          assert.ok(feedback[o.id]!.length > 10, `${id} ${o.label}`);
      const correct = correctLabel(c);
      const states = (text: string) =>
        /^-?\d+(\.\d+)?$/.test(correct)
          ? new RegExp(`(?<![\\d.])${correct}(?![\\d]|\\.\\d)`).test(text)
          : text.includes(correct);
      assert.ok(!states(problem.public.prompt), id);
      assert.ok(!states(problem.hint), id);
    }
});

test("exponential base: the percent, direction and period match the model", () => {
  for (const c of cases("rg-exponential-base-rate")) {
    const text = correctLabel(c);
    if (c.variant === "half-life") {
      const h = Number(/half every (\d+) hours/.exec(prompt(c))![1]);
      const d = Number(/patient takes (\d+) mg/.exec(prompt(c))![1]);
      const [, d2, h2] = /A\(t\)=(\d+)\(0\.5\)\^\{t\/(\d+)\}/
        .exec(text)!
        .map(Number);
      assert.deepEqual([d2, h2], [d, h]);
      continue;
    }
    const base = Number(/\((\d\.\d+)\)\^/.exec(prompt(c))![1]);
    const [, dir, pct, every] =
      /(increases|decreases) by ([\d.]+)% (each|every) /.exec(text)!;
    assert.ok(close(Number(pct) / 100, Math.abs(base - 1), 1e-9), text);
    assert.equal(dir === "increases", base > 1);
    if (c.variant === "per-period") {
      const k = Number(/t\/(\d+)\}/.exec(prompt(c))![1]);
      assert.equal(every, "every");
      assert.ok(text.includes(`every ${k} `), text);
    } else assert.equal(every, "each");
  }
});

test("factoring: the correct choice multiplies back to the expression and is complete", () => {
  for (const c of cases("rg-factor-completely")) {
    const given = /\$([^$]+)\$ (written|factored)/.exec(prompt(c))![1]!;
    const right = correctLabel(c);
    for (const [x, y] of [
      [1.7, 0.4],
      [-2.3, 1.9],
      [3, -2],
    ])
      assert.ok(
        close(evalTex(given, { x, y }), evalTex(right, { x, y })),
        `${given} vs ${right}`,
      );
    // A wrong choice is either a different expression or an incomplete factoring that still has a difference of squares.
    for (const o of optionsOf(c))
      if (o.label !== right) {
        const differs = [
          [1.7, 0.4],
          [-2.3, 1.9],
        ].some(
          ([x, y]) =>
            !close(
              evalTex(given, { x: x!, y: y! }),
              evalTex(o.label, { x: x!, y: y! }),
            ),
        );
        assert.ok(
          differs || /\([^()]*\^\{2\}-[^()]*\)\$$/.test(o.label),
          `${o.label} equals ${given}`,
        );
      }
    // Complete: no remaining binomial factor is a difference of squares.
    assert.ok(!/\^\{2\}-\d+(y\^\{2\})?\)$/.test(right), right);
  }
});

const parseNumber = (s: string) => evalTex(s);
test("zeros: a product's correct set is exactly its zeros, and a cubic's choice is a zero", () => {
  for (const c of cases("rg-polynomial-zeros-forms")) {
    const fText = /f\(x\)=([^$]+)\$/.exec(prompt(c))![1]!;
    if (c.variant === "variable-times-nonmonic") {
      const zeros = correctLabel(c)
        .replace(/\$/g, "")
        .split(",\\ ")
        .map(parseNumber);
      assert.equal(zeros.length, 3);
      for (const z of zeros)
        assert.ok(close(evalTex(fText, { x: z }), 0, 1e-9), fText);
      // Correct set sorted ascending and distinct.
      assert.deepEqual(
        [...zeros].sort((a, b) => a - b),
        zeros,
      );
      assert.equal(new Set(zeros.map((z) => z.toFixed(9))).size, 3);
      // No wrong set is entirely zeros.
      for (const o of optionsOf(c))
        if (o.label !== correctLabel(c)) {
          const ws = o.label.replace(/\$/g, "").split(",\\ ").map(parseNumber);
          assert.ok(
            ws.some((z) => !close(evalTex(fText, { x: z }), 0, 1e-9)) ||
              ws.length < 3,
            o.label,
          );
        }
    } else {
      assert.ok(
        close(evalTex(fText, { x: Number(correctLabel(c)) }), 0),
        fText,
      );
      for (const o of optionsOf(c))
        if (o.label !== correctLabel(c))
          assert.notEqual(
            evalTex(fText, { x: Number(o.label) }),
            0,
            `${o.label} is a zero of ${fText}`,
          );
    }
  }
});

test("monomial powers and rational exponents agree with numeric evaluation", () => {
  for (const c of cases("rg-exponent-monomial-power")) {
    const given = /equivalent to (\$[^$]+\$)\?/.exec(prompt(c))![1]!;
    const right = correctLabel(c);
    for (const [x, y] of [
      [1.3, 0.8],
      [2.1, 1.1],
    ])
      assert.ok(
        close(evalTex(given, { x, y }), evalTex(right, { x, y })),
        `${given} vs ${right}`,
      );
    for (const o of optionsOf(c))
      if (o.label !== right)
        assert.ok(
          !close(
            evalTex(given, { x: 1.3, y: 0.8 }),
            evalTex(o.label, { x: 1.3, y: 0.8 }),
          ),
          o.label,
        );
  }
  for (const c of cases("rg-rational-exponent-forms")) {
    const right = correctLabel(c);
    if (c.variant === "combine") {
      const given = /equivalent to (\$[^$]+\$)/.exec(prompt(c))![1]!;
      for (const x of [1.9, 4.2])
        assert.ok(
          close(evalTex(given, { x }), evalTex(right, { x })),
          `${given} vs ${right}`,
        );
      for (const o of optionsOf(c))
        if (o.label !== right)
          assert.ok(
            !close(evalTex(given, { x: 1.9 }), evalTex(o.label, { x: 1.9 })),
            o.label,
          );
    } else if (c.variant === "negative-fraction-radical") {
      const given = /Which expression is (\$[^$]+\$)/.exec(prompt(c))![1]!;
      for (const [x, y] of [
        [1.9, 0.6],
        [3.3, 2.2],
      ])
        assert.ok(
          close(evalTex(given, { x, y }), evalTex(right, { x, y })),
          `${given} vs ${right}`,
        );
      for (const o of optionsOf(c))
        if (o.label !== right)
          assert.ok(
            !close(
              evalTex(given, { x: 1.9, y: 0.6 }),
              evalTex(o.label, { x: 1.9, y: 0.6 }),
            ),
            o.label,
          );
    } else {
      const given = /value of (\$[^$]+\$)\?/.exec(prompt(c))![1]!;
      assert.ok(close(evalTex(given), evalTex(right)), `${given} vs ${right}`);
      for (const o of optionsOf(c))
        if (o.label !== right)
          assert.ok(!close(evalTex(given), evalTex(o.label)), o.label);
    }
  }
});

/** Coefficients by exponent for text such as -3x^{4}+5x^{2}-2. */
function parsePoly(text: string): Map<number, number> {
  const out = new Map<number, number>();
  const re = /([+-]?)(\d*)(x(?:\^\{(\d+)\})?)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) && m[0] !== "") {
    const hasX = Boolean(m[3]);
    const k = m[2] === "" ? 1 : Number(m[2]);
    const e = hasX ? (m[4] ? Number(m[4]) : 1) : 0;
    out.set(e, (out.get(e) ?? 0) + (m[1] === "-" ? -k : k));
  }
  return out;
}
test("polynomial structure: the chosen polynomial or statement has the stated properties", () => {
  for (const c of cases("rg-polynomial-build")) {
    const right = correctLabel(c);
    if (c.variant === "build") {
      const [, words, deg, lead, konst] =
        /is a ([a-z-]+(?: polynomial)?) of degree (\d+) with a leading coefficient of \$(-?\d+)\$ and a constant term of \$(-?\d+)\$/.exec(
          prompt(c),
        )!;
      const poly = parsePoly(right.replace(/\$/g, ""));
      const exps = [...poly.keys()].filter((e) => poly.get(e) !== 0);
      assert.equal(Math.max(...exps), Number(deg));
      assert.equal(poly.get(Number(deg)), Number(lead));
      assert.equal(poly.get(0), Number(konst));
      const count = { binomial: 2, trinomial: 3, "four-term polynomial": 4 }[
        words!
      ]!;
      assert.equal(exps.length, count);
      // Each wrong choice breaks at least one property.
      for (const o of optionsOf(c))
        if (o.label !== right) {
          const w = parsePoly(o.label.replace(/\$/g, ""));
          const we = [...w.keys()].filter((e) => w.get(e) !== 0);
          const ok =
            Math.max(...we) === Number(deg) &&
            w.get(Number(deg)) === Number(lead) &&
            (w.get(0) ?? 0) === Number(konst) &&
            we.length === count;
          assert.ok(!ok, o.label);
        }
    } else {
      const given = /P\(x\)=([^$]+)\$/.exec(prompt(c))![1]!;
      const poly = parsePoly(given);
      const exps = [...poly.keys()];
      const d = Math.max(...exps);
      assert.equal(
        right,
        `Degree ${d}, leading coefficient ${poly.get(d)}, constant term ${poly.get(0)}`,
      );
    }
  }
});

test("solids: weight, count and liters are recomputed from the prompt", () => {
  for (const c of cases("rg-solid-density")) {
    const p = prompt(c);
    const answer = Number(c.problem.answer);
    if (c.variant === "log-weight") {
      const [, d, h, rho] =
        /diameter of (\d+) inches and a height of (\d+) feet. The wood weighs (\d+) pounds/
          .exec(p)!
          .map(Number);
      const weight = Math.PI * (d! / 24) ** 2 * h! * rho!;
      assert.equal(answer, Math.round(weight));
      assert.ok(Math.abs(weight - Math.round(weight)) < 0.47);
    } else if (c.variant === "clay-pyramids") {
      const [, kg, rho, s, h] =
        /has (\d+) kilograms of clay. The clay has a density of ([\d.]+) grams.*side (\d+) centimeters and a height of (\d+)/
          .exec(p)!
          .map(Number);
      const grams = kg! * 1000;
      const each = ((s! * s! * h!) / 3) * rho!;
      assert.equal(answer, Math.floor(grams / each));
      assert.ok(
        grams / each - Math.floor(grams / each) > 0.5,
        "rounding to nearest would differ",
      );
    } else {
      const [, l, w, hh, gap] =
        /(\d+) centimeters long, (\d+) centimeters wide and (\d+) centimeters high.*level (\d+) centimeters below/
          .exec(p)!
          .map(Number);
      assert.ok(close(answer, (l! * w! * (hh! - gap!)) / 1000));
    }
  }
});

test("quadrilaterals: shape facts follow a truth table and trapezoid angles satisfy the equation", () => {
  // Which statements prove each special parallelogram (independent truth table).
  const proves: Record<string, string[]> = {
    "Its diagonals are perpendicular.": ["rhombus"],
    "Two consecutive sides are congruent.": ["rhombus"],
    "A diagonal bisects a pair of opposite angles.": ["rhombus"],
    "Its diagonals are congruent.": ["rectangle"],
    "One of its angles is a right angle.": ["rectangle"],
    "Its opposite sides are congruent.": [],
    "Its opposite angles are congruent.": [],
    "Its diagonals bisect each other.": [],
  };
  for (const c of cases("rg-quadrilateral-choice")) {
    if (c.variant === "rhombus" || c.variant === "rectangle") {
      for (const o of optionsOf(c))
        assert.equal(
          proves[o.label]!.includes(c.variant),
          o.id === c.problem.answer,
          `${c.variant}: ${o.label}`,
        );
    } else {
      const [, a, b, cc, d] =
        /m\\angle A=\((\d*)x([+-]\d+)\)\^\\circ\$ and \$m\\angle D=\((\d*)x([+-]\d+)\)/.exec(
          prompt(c),
        )!;
      const A = [Number(a || 1), Number(b)];
      const D = [Number(cc || 1), Number(d)];
      const x = (180 - A[1]! - D[1]!) / (A[0]! + D[0]!);
      assert.ok(Number.isInteger(x));
      const asked = /What is \$m\\angle ([AD])\$/.exec(prompt(c))![1];
      const value = asked === "A" ? A[0]! * x + A[1]! : D[0]! * x + D[1]!;
      assert.equal(correctLabel(c), `${value}°`);
    }
  }
});

test("parallelogram perpendicular: coordinates give the angle", () => {
  const angleAt = (
    v: [number, number],
    p: [number, number],
    q: [number, number],
  ) => {
    const a = [p[0] - v[0], p[1] - v[1]] as const;
    const b = [q[0] - v[0], q[1] - v[1]] as const;
    const cos =
      (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b));
    return (Math.acos(cos) * 180) / Math.PI;
  };
  for (const c of cases("rg-parallelogram-perpendicular")) {
    const given = Number(/\\angle A[BD]C=(\d+)/.exec(prompt(c))![1]);
    // Vertex V at the origin, C on the positive x-axis, A at the given angle.
    const rad = (given * Math.PI) / 180;
    const A: [number, number] = [Math.cos(rad), Math.sin(rad)];
    const E: [number, number] = [A[0], 0]; // foot of the perpendicular from A to line VC
    const V: [number, number] = [0, 0];
    const expected = angleAt(A, V, E); // angle at A between the vertex and the foot
    assert.ok(
      close(expected, Number(c.problem.answer), 1e-9),
      `${prompt(c)} ${expected}`,
    );
    assert.equal(E[0] < 0, c.variant !== "acute-inside"); // foot beyond the vertex for obtuse angles
  }
});

test("segment properties: algebraic lengths satisfy the theorem", () => {
  for (const c of cases("rg-segment-property-choice")) {
    if (c.variant === "bisector-algebra") {
      const [, a, b, cc, d] =
        /PA=(\d+)x\+(\d+)\$ and \$PB=(\d*)x([+-]\d+)\$/.exec(prompt(c))!;
      const x = (Number(d) - Number(b)) / (Number(a) - Number(cc || 1));
      assert.ok(Number.isInteger(x) && x > 0);
      assert.equal(correctLabel(c), String(Number(a) * x + Number(b)));
    } else if (c.variant === "midsegment-algebra") {
      const [, de1, de2, bc1, bc2] =
        /=(\d*)x\+(\d+)\$ and \$[A-Z]{2}=(\d*)x([+-]\d+)\$/.exec(prompt(c))!;
      const x =
        (2 * Number(de2) - Number(bc2)) /
        (Number(bc1 || 1) - 2 * Number(de1 || 1));
      assert.ok(Number.isInteger(x) && x > 0);
      assert.equal(
        Number(correctLabel(c)),
        2 * (Number(de1 || 1) * x + Number(de2)),
      );
    }
  }
});

test("triangle lengths and areas are recomputed from the prompt", () => {
  for (const c of cases("rg-isosceles-right-decimal")) {
    const n = Number(/(\d+) (?:centimeters|inches|feet)/.exec(prompt(c))![1]);
    const exact =
      c.variant === "hypotenuse-from-leg" ? n * Math.SQRT2 : n / Math.SQRT2;
    assert.equal(c.problem.answer, (Math.round(exact * 10) / 10).toFixed(1));
  }
  for (const c of cases("rg-triangle-area-sas")) {
    const p = prompt(c);
    const nums =
      c.variant === "land-story"
        ? /(\d+) feet and (\d+) feet that meet at an angle of (\d+)/.exec(p)!
        : /AB=(\d+)\$, \$BC=(\d+)\$ and \$m\\angle B=(\d+)/.exec(p)!;
    const [a, b, t] = [Number(nums[1]), Number(nums[2]), Number(nums[3])];
    assert.equal(
      c.problem.answer,
      (0.5 * a * b * Math.sin((t * Math.PI) / 180)).toFixed(1),
    );
    assert.equal(t > 90, c.variant === "obtuse");
  }
  for (const c of cases("rg-triangle-third-side-test")) {
    const [, a, b] = /lengths (\d+) and (\d+)/.exec(prompt(c))!.map(Number);
    const possible = (v: number) => v > Math.abs(a! - b!) && v < a! + b!;
    const could = c.variant === "could";
    for (const o of optionsOf(c))
      assert.equal(
        possible(Number(o.label)) === could,
        o.id === c.problem.answer,
        `${a},${b}: ${o.label}`,
      );
  }
  for (const c of cases("rg-altitude-segment")) {
    const [, leg, m] = /AC=(\d+)\$ and \$AD=(\d+)\$/
      .exec(prompt(c))!
      .map(Number);
    // Right angle at C=(0,0), A=(leg,0), B=(0,q) chosen so that the foot D satisfies AD = m.
    const hyp = (leg! * leg!) / m!;
    const q = Math.sqrt(hyp * hyp - leg! * leg!);
    const A = [leg!, 0] as const;
    const B = [0, q] as const;
    const t =
      ((0 - A[0]) * (B[0] - A[0]) + (0 - A[1]) * (B[1] - A[1])) /
      ((B[0] - A[0]) ** 2 + (B[1] - A[1]) ** 2);
    const foot = [A[0] + t * (B[0] - A[0]), t * B[1]] as const;
    const AD = Math.hypot(foot[0] - A[0], foot[1] - A[1]);
    assert.ok(close(AD, m!, 1e-9), `AD ${AD} vs ${m}`);
    assert.equal(
      c.problem.answer,
      Math.hypot(B[0] - foot[0], B[1] - foot[1]).toFixed(1),
    );
  }
});

test("every template has exactly one library lesson and a worked problem lesson", () => {
  for (const id of regentsGapTemplateIds) {
    assert.equal(
      lessons.filter((l) => l.templateIds.includes(id)).length,
      1,
      id,
    );
    const p = generateProblem(id, "learner-seed");
    const lesson = problemLesson(id, p.public.seed, p.public.prompt);
    assert.equal(lesson.templateId, id);
    assert.ok(lesson.example.steps.length > 0);
  }
});
