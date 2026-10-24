import test from "node:test";
import assert from "node:assert/strict";
import {
  specialAngleCase,
  symmetryCase,
  inverseTrigCase,
  trigEquationCase,
  identityCase,
  periodicModelCase,
  sinusoidCase,
  obliqueCase,
  trigAreaCase,
  trigonometryTemplates,
} from "../src/math/trigonometry-practice";
import { generateProblem, templates } from "../src/math/engine";
import { problemLesson } from "../src/content/problem-lessons";

/** Minimal TeX evaluator for the labels these templates produce. */
function evalTex(input: string): number {
  let s = input.replace(/\\left|\\right|\\,|\\ |\$|\^\\circ/g, "").trim();
  let i = 0;
  const peek = () => s[i];
  function group(): string {
    assert.equal(s[i], "{");
    let depth = 0;
    const start = i + 1;
    for (; i < s.length; i++) {
      if (s[i] === "{") depth++;
      if (s[i] === "}" && --depth === 0) break;
    }
    return s.slice(start, i++);
  }
  function atom(): number {
    if (s.startsWith("\\frac", i)) {
      i += 5;
      const a = evalTex(group());
      const b = evalTex(group());
      return a / b;
    }
    if (s.startsWith("\\sqrt", i)) {
      i += 5;
      return Math.sqrt(evalTex(group()));
    }
    if (s.startsWith("\\pi", i)) {
      i += 3;
      return Math.PI;
    }
    const m = /^\d+(\.\d+)?/.exec(s.slice(i));
    assert.ok(m, `Cannot parse ${s} at ${i}`);
    i += m![0].length;
    return Number(m![0]);
  }
  function term(): number {
    let v = atom();
    while (i < s.length && peek() !== "+" && peek() !== "-") v *= atom();
    return v;
  }
  function expr(): number {
    let sign = 1;
    if (peek() === "-") {
      sign = -1;
      i++;
    }
    let v = sign * term();
    while (i < s.length) {
      const op = s[i++];
      v += (op === "-" ? -1 : 1) * term();
    }
    return v;
  }
  s = s.replace(/−/g, "-");
  return expr();
}

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const SEEDS = 400;

function check(id: string, seed: string) {
  const generated = generateProblem(id, seed);
  const response = generated.public.response;
  assert.equal(response.kind, "choice");
  if (response.kind !== "choice") throw new Error("choice expected");
  const labels = response.options.map((o) => o.label);
  assert.equal(response.options.length, 4);
  assert.equal(new Set(labels).size, 4, `${id} ${seed}: ${labels}`);
  const correct = response.options.find((o) => o.id === generated.answer)!;
  assert.ok(correct);
  assert.equal(Object.keys(generated.choiceFeedback ?? {}).length, 3);
  for (const text of Object.values(generated.choiceFeedback ?? {}))
    assert.ok(text.length > 12, text);
  for (const text of [generated.public.prompt, generated.hint])
    assert.ok(
      correct.label.length <= 4 || !text.includes(correct.label),
      `${id} ${seed}: leaks ${correct.label}`,
    );
  assert.ok(generated.explanation.length >= 2);
  for (const text of [
    generated.public.prompt,
    generated.hint,
    ...generated.explanation,
    ...labels,
  ])
    assert.ok(!/\\(pi|theta|sin|cos|tan)[a-z]/.test(text), `${id}: ${text}`);
  return { generated, correct, labels };
}

test("generation is deterministic and every template is reachable through the engine", () => {
  for (const t of trigonometryTemplates) {
    assert.ok(
      templates.some((x) => x.id === t.id),
      t.id,
    );
    const a = generateProblem(t.id, "same");
    const b = generateProblem(t.id, "same");
    assert.deepEqual(a, b);
    for (let seed = 0; seed < SEEDS; seed++) check(t.id, `t:${seed}`);
  }
});

test("special angle values agree with direct floating-point trigonometry", () => {
  const variants = new Set<number>();
  for (let seed = 0; seed < SEEDS; seed++) {
    const c = specialAngleCase(`o:${seed}`);
    variants.add(c.variant);
    const { correct } = check("special-angle-exact-value", `o:${seed}`);
    if (c.variant === 4) continue;
    if (c.correct === "Undefined") {
      assert.equal(c.fn, "tan");
      assert.ok(Math.abs(Math.cos((c.deg * Math.PI) / 180)) < 1e-9);
    } else {
      const f = Math[c.fn];
      assert.ok(near(evalTex(c.correct), f((c.deg * Math.PI) / 180)));
    }
    void correct;
  }
  assert.deepEqual(
    [...variants].sort(),
    [0, 1, 2, 3, 4].map((x) => x),
  );
});

test("symmetry answers match trigonometry evaluated at the actual angle", () => {
  const variants = new Set<number>();
  for (let seed = 0; seed < SEEDS; seed++) {
    const c = symmetryCase(`o:${seed}`);
    variants.add(c.variant);
    const theta = c.givenFn === "sin" ? Math.asin(c.given) : Math.acos(c.given);
    const angle = c.sigma * theta + c.k * Math.PI;
    const value = c.askFn === "tan" ? Math.tan(angle) : Math[c.askFn](angle);
    const { correct } = check("trig-symmetry-value", `o:${seed}`);
    assert.ok(near(evalTex(correct.label), value), `${seed}`);
  }
  assert.equal(variants.size, 6);
});

test("sinusoid parameters are consistent with the equation", () => {
  const variants = new Set<number>();
  for (let seed = 0; seed < SEEDS; seed++) {
    const c = sinusoidCase(`o:${seed}`);
    variants.add(c.variant);
    const { generated, correct } = check("sinusoid-parameters", `o:${seed}`);
    if (c.variant === 0)
      assert.ok(
        near(evalTex(correct.label), (2 * Math.PI * c.bd) / c.bn),
        correct.label,
      );
    if (c.variant === 5) assert.equal(generated.public.figure?.kind, "scene");
  }
  assert.equal(variants.size, 7);
});

test("inverse values satisfy their restricted range and equation", () => {
  const variants = new Set<number>();
  for (let seed = 0; seed < SEEDS; seed++) {
    const c = inverseTrigCase(`o:${seed}`);
    variants.add(c.variant);
    check("inverse-trig-value", `o:${seed}`);
    if (c.variant === 4) continue;
    const angle = (c.answerTwelfths * Math.PI) / 12;
    if (c.inv === "arcsin") assert.ok(Math.abs(angle) <= Math.PI / 2 + 1e-9);
    if (c.inv === "arccos")
      assert.ok(angle >= -1e-9 && angle <= Math.PI + 1e-9);
    if (c.inv === "arctan") assert.ok(Math.abs(angle) < Math.PI / 2);
    assert.ok(near(evalTex(c.correct), angle));
  }
  assert.equal(variants.size, 5);
});

test("equation solutions are verified by substitution and counts by enumeration", () => {
  const variants = new Set<number>();
  for (let seed = 0; seed < SEEDS; seed++) {
    const c = trigEquationCase(`o:${seed}`);
    variants.add(c.variant);
    check("trig-equation-solutions", `o:${seed}`);
    for (const k of c.solutions) {
      const x = (k * Math.PI) / 12;
      const arg = c.doubled ? 2 * x : x;
      const v = Math[c.fn](arg);
      assert.ok(near(v, c.target), `${seed} ${k}`);
    }
    // Every other multiple of pi/12 fails.
    for (let k = 0; k < 24; k++) {
      if (c.solutions.includes(k)) continue;
      const x = (k * Math.PI) / 12;
      const v = Math[c.fn](c.doubled ? 2 * x : x);
      if (Number.isFinite(v) && Math.abs(v) < 1e8)
        assert.ok(!near(v, c.target));
    }
  }
  assert.equal(variants.size, 5);
});

test("identity answers match numeric evaluation", () => {
  const variants = new Set<number>();
  for (let seed = 0; seed < SEEDS; seed++) {
    const c = identityCase(`o:${seed}`);
    variants.add(c.variant);
    const { correct } = check("trig-identity-value", `o:${seed}`);
    const m = c.model;
    const value = evalTex(correct.label);
    if (c.variant <= 1) {
      const target = m.ask ? m.sinN! / m.cosN! : null;
      if (target !== null) assert.ok(near(value, target));
      else
        assert.ok(near(value, m.sinN! / m.c!) || near(value, m.cosN! / m.c!));
      assert.ok(Math.abs(Math.hypot(m.sinN!, m.cosN!) - m.c!) < 1e-9);
    } else if (c.variant <= 3) {
      const f = m.fn === 0 ? Math.sin : Math.cos;
      assert.ok(near(value, f((m.angle! * Math.PI) / 180)));
    } else {
      const askSin = m.askSin === 1;
      const x = (m.p! * Math.PI) / m.q!;
      const other = askSin ? Math.cos(value) : Math.sin(value);
      assert.ok(near(other, askSin ? Math.sin(x) : Math.cos(x)));
      assert.ok(value > 0 && value < Math.PI / 2);
    }
  }
  assert.equal(variants.size, 5);
});

test("oblique triangle answers match independent geometry", () => {
  const variants = new Set<number>();
  const counts = new Set<number>();
  for (let seed = 0; seed < SEEDS; seed++) {
    const c = obliqueCase(`o:${seed}`);
    variants.add(c.variant);
    const { correct, generated } = check("oblique-triangle-solve", `o:${seed}`);
    if (c.variant === 4) {
      const { A, a, b } = c as { A: number; a: number; b: number };
      // Enumerate: sin B = b sin A / a; each valid B in (0, 180 - A) is a triangle.
      const s = (b * Math.sin((A * Math.PI) / 180)) / a;
      let n = 0;
      if (s <= 1 + 1e-12) {
        const B1 = (Math.asin(Math.min(1, s)) * 180) / Math.PI;
        const options = Math.abs(s - 1) < 1e-9 ? [B1] : [B1, 180 - B1];
        n = options.filter((B) => B > 1e-9 && A + B < 180 - 1e-9).length;
      }
      counts.add(n);
      assert.equal(
        correct.label,
        ["No triangle", "Exactly one triangle", "Two different triangles"][n],
      );
    } else {
      const value = evalTex(correct.label);
      assert.ok(
        Math.abs(value - c.truth) <= (c.variant <= 1 ? 0.05 : 0.5) + 1e-9,
      );
    }
    void generated;
  }
  assert.equal(variants.size, 5);
  assert.deepEqual([...counts].sort(), [0, 1, 2]);
});

test("area answers match direct computation", () => {
  const variants = new Set<number>();
  for (let seed = 0; seed < SEEDS; seed++) {
    const c = trigAreaCase(`o:${seed}`);
    variants.add(c.variant);
    const { correct } = check("trig-triangle-area", `o:${seed}`);
    if (c.variant === 0 || c.variant === 1)
      assert.ok(Math.abs(evalTex(correct.label) - c.area) < 0.05 + 1e-9);
  }
  assert.equal(variants.size, 4);
});

test("periodic models reproduce the stated maximum, minimum and start", () => {
  const variants = new Set<number>();
  for (let seed = 0; seed < SEEDS; seed++) {
    const c = periodicModelCase(`o:${seed}`);
    variants.add(c.variant);
    const { correct } = check("sinusoid-model", `o:${seed}`);
    if (c.variant <= 2) {
      const e = c.expected!;
      const f = (t: number) =>
        e.form === "sin"
          ? e.A * Math.sin(e.B * t) + e.k
          : e.A * Math.cos(e.B * t) + e.k;
      const samples = Array.from({ length: 4000 }, (_, i) =>
        f((i * c.P) / 4000),
      );
      assert.ok(
        near(Math.max(...samples), c.max) ||
          Math.abs(Math.max(...samples) - c.max) < 1e-3,
      );
      assert.ok(Math.abs(Math.min(...samples) - c.min) < 1e-3);
      assert.ok(Math.abs(f(c.P) - f(0)) < 1e-9);
      assert.ok(
        Math.abs(
          f(0) - (c.variant === 0 ? c.max : c.variant === 1 ? c.min : c.k),
        ) < 1e-9,
      );
    }
    void correct;
  }
  assert.equal(variants.size, 5);
});

test("each trigonometry family binds a lesson with method and principle", () => {
  for (const t of trigonometryTemplates) {
    const template = templates.find((item) => item.id === t.id);
    assert.ok(template?.skillId);
    const lesson = problemLesson(t.id, "library");
    assert.ok((lesson.intuition ?? "").length > 40);
    assert.ok(lesson.method.length >= 3);
    assert.ok(lesson.watch);
    assert.ok(lesson.principle);
    assert.ok(lesson.example.steps.length >= 3);
  }
});
