import test from "node:test";
import assert from "node:assert/strict";
import { checkTemplate } from "./fixtures/regents-check";
import { generateProblem } from "../src/math/engine";

const options = (p: ReturnType<typeof generateProblem>) =>
  p.public.response.kind === "choice" ? p.public.response.options : [];
const key = (p: ReturnType<typeof generateProblem>) =>
  options(p).find((o) => o.id === p.answer)!.label;

test("missing input", () => {
  checkTemplate("function-missing-input", {
    variants: ["repeated-output", "distinct-outputs"],
    axes: { ask: ["makes-function", "breaks-function"] },
  });
  for (let i = 0; i < 300; i++) {
    const p = generateProblem("function-missing-input", `m:${i}`);
    const pairs = [...p.public.prompt.matchAll(/\((-?\d+|k), (-?\d+)\)/g)].map(
      (m) => [m[1]!, Number(m[2])] as const,
    );
    const makes = p.public.prompt.includes("makes the relation a function");
    for (const o of options(p)) {
      const k = Number(o.label.replaceAll("$", ""));
      const filled = pairs.map(
        ([x, y]) => [x === "k" ? k : Number(x), y] as const,
      );
      const isFunction = filled.every(([x, y]) =>
        filled.every(([x2, y2]) => x !== x2 || y === y2),
      );
      assert.equal(
        isFunction === makes,
        o.id === p.answer,
        `${p.public.prompt} ${k}`,
      );
    }
  }
});

test("shift in function notation", () => {
  checkTemplate("shift-function-notation", {
    variants: ["right-up", "right-down", "left-up", "left-down"],
    axes: { form: ["function-notation", "vertex-form"] },
  });
  for (let i = 0; i < 300; i++) {
    const p = generateProblem("shift-function-notation", `s:${i}`);
    const move = p.public.prompt.match(
      /shifted (\d+) units? to the (right|left) and (\d+) units? (up|down)/,
    )!;
    const h = Number(move[1]) * (move[2] === "right" ? 1 : -1);
    const k = Number(move[3]) * (move[4] === "up" ? 1 : -1);
    const label = key(p).replaceAll("$", "");
    if (p.variant?.axes?.form === "function-notation") {
      const m = label.match(
        /^g\(x\) = f\(x(?: ([+-]) (\d+))?\)(?: ([+-]) (\d+))?$/,
      )!;
      const inner = m[1] ? (m[1] === "-" ? Number(m[2]) : -Number(m[2])) : 0;
      const outer = m[3] ? (m[3] === "+" ? Number(m[4]) : -Number(m[4])) : 0;
      assert.deepEqual([inner, outer], [h, k], label);
    } else {
      const f = p.public.prompt.match(/f\(x\) = ([^$]+)\$/)![1]!;
      const parse = (t: string) => {
        const m = t.match(
          /^(?:\(x(?: ([+-]) (\d+))?\)\^2|x\^2)(?: ([+-]) (\d+))?$/,
        )!;
        const off = m[1] ? (m[1] === "+" ? Number(m[2]) : -Number(m[2])) : 0;
        const c = m[3] ? (m[3] === "+" ? Number(m[4]) : -Number(m[4])) : 0;
        return { vx: -off, vy: c };
      };
      const before = parse(f);
      const after = parse(label.replace(/^g\(x\) = /, ""));
      assert.deepEqual(
        [after.vx - before.vx, after.vy - before.vy],
        [h, k],
        `${f} -> ${label}`,
      );
    }
  }
});

test("radical function value", () => {
  checkTemplate("radical-function-value", {
    variants: ["plain", "scaled", "zero-radicand"],
    axes: { form: ["plain", "scaled"] },
  });
  for (let i = 0; i < 300; i++) {
    const p = generateProblem("radical-function-value", `r:${i}`);
    const m = p.public.prompt.match(
      /f\(x\) = (\d*)\\sqrt\{x(?: ([+-]) (\d+))?\}(?: ([+-]) (\d+))?\$\. What is \$f\((-?\d+)\)\$/,
    )!;
    const a = m[1] ? Number(m[1]) : 1;
    const b = m[2] ? (m[2] === "+" ? Number(m[3]) : -Number(m[3])) : 0;
    const c = m[4] ? (m[4] === "+" ? Number(m[5]) : -Number(m[5])) : 0;
    const x = Number(m[6]);
    assert.equal(a * Math.sqrt(x + b) + c, Number(p.answer));
  }
});

test("zeros of product", () => {
  checkTemplate("zeros-of-factored-product", {
    variants: ["zero-among-zeros", "extra-binomial"],
    axes: { form: ["x-times-difference", "binomial-times-difference"] },
  });
  for (let i = 0; i < 300; i++) {
    const p = generateProblem("zeros-of-factored-product", `z:${i}`);
    const f = p.public.prompt.match(
      /f\(x\) = (\d*)(x|\(x [+-] \d+\))\(x\^2 - (\d+)\)/,
    )!;
    const first = f[2]!;
    const sq = Number(f[3]);
    const shift =
      first === "x"
        ? 0
        : (first.includes("+") ? 1 : -1) * Number(first.match(/\d+/)![0]);
    const val = (x: number) => (x + shift) * (x * x - sq);
    const shown = (label: string) =>
      [...label.matchAll(/-?\d+/g)].map((m) => Number(m[0]));
    for (const o of options(p)) {
      const zs = shown(o.label);
      const all =
        zs.every((z) => val(z) === 0) &&
        zs.length ===
          new Set([0 + (shift ? -shift : 0), Math.sqrt(sq), -Math.sqrt(sq)])
            .size;
      assert.equal(all, o.id === p.answer, `${p.public.prompt} ${o.label}`);
    }
  }
});

test("negative output", () => {
  checkTemplate("quadratic-negative-output", {
    variants: ["both-negative", "both-positive", "mixed-signs"],
  });
  for (let i = 0; i < 300; i++) {
    const p = generateProblem("quadratic-negative-output", `n:${i}`);
    const m = p.public.prompt.match(
      /f\(x\) = x\^2(?: ([+-]) (\d*)x)?(?: ([+-]) (\d+))?\$, which values of \$x\$ satisfy \$f\(x\) = -(\d+)\$/,
    )!;
    const b = m[1]
      ? (m[1] === "+" ? 1 : -1) * (m[2] === "" ? 1 : Number(m[2]))
      : 0;
    const c = m[3] ? (m[3] === "+" ? 1 : -1) * Number(m[4]) : 0;
    const out = -Number(m[5]);
    const f = (x: number) => x * x + b * x + c;
    for (const o of options(p)) {
      const xs = [...o.label.matchAll(/-?\d+(?:\.\d+)?/g)].map((q) =>
        Number(q[0]),
      );
      const solves = xs.length === 2 && xs.every((x) => f(x) === out);
      assert.equal(solves, o.id === p.answer, `${p.public.prompt} ${o.label}`);
    }
  }
});

test("axis rule", () => {
  checkTemplate("parabola-axis-rule", {
    variants: ["axis-left", "axis-right"],
  });
  for (let i = 0; i < 300; i++) {
    const p = generateProblem("parabola-axis-rule", `a:${i}`);
    const h = Number(p.public.prompt.match(/x = (-?\d+)/)![1]);
    for (const o of options(p)) {
      const m = o.label.match(
        /^\$y = (-?\d*)x\^2(?: ([+-]) (\d*)x)?(?: [+-] \d+)?\$$/,
      )!;
      const a = m[1] === "" ? 1 : m[1] === "-" ? -1 : Number(m[1]);
      const b = m[2]
        ? (m[2] === "+" ? 1 : -1) * (m[3] === "" ? 1 : Number(m[3]))
        : 0;
      assert.equal(-b / (2 * a) === h, o.id === p.answer, `${h} ${o.label}`);
    }
  }
});

test("quadratic formula", () => {
  checkTemplate("quadratic-formula-positive", {
    variants: ["negative-constant", "positive-constant"],
    axes: { form: ["zero-form", "constant-on-right"] },
  });
  for (let i = 0; i < 300; i++) {
    const p = generateProblem("quadratic-formula-positive", `q:${i}`);
    const m = p.public.prompt.match(
      /\$(\d*)x\^2(?: ([+-]) (\d*)x)?(?: ([+-]) (\d+))? = (-?\d+)\$/,
    )!;
    const a = Number(m[1] || 1);
    const b = m[2]
      ? (m[2] === "+" ? 1 : -1) * (m[3] === "" ? 1 : Number(m[3]))
      : 0;
    const rhs = Number(m[6]);
    const c = m[4] ? (m[4] === "+" ? 1 : -1) * Number(m[5]) - rhs : -rhs;
    const d = b * b - 4 * a * c;
    const parsed = key(p).match(
      /\\frac\{(-?\d+) \\pm \\sqrt\{(\d+)\}\}\{(\d+)\}/,
    )!;
    assert.deepEqual(
      [Number(parsed[1]), Number(parsed[2]), Number(parsed[3])],
      [-b, d, 2 * a],
    );
    assert.ok(Math.sqrt(d) % 1 !== 0);
  }
});

test("factor large trinomial", () => {
  checkTemplate("factor-large-trinomial", {
    variants: ["product-large", "product-medium"],
    axes: { constant: ["negative", "positive"] },
  });
  for (let i = 0; i < 300; i++) {
    const p = generateProblem("factor-large-trinomial", `f:${i}`);
    const t = p.public.prompt.match(
      /equivalent to \$x\^2 ([+-]) (\d*)x ([+-]) (\d+)\$/,
    )!;
    const b = (t[1] === "+" ? 1 : -1) * (t[2] === "" ? 1 : Number(t[2]));
    const c = (t[3] === "+" ? 1 : -1) * Number(t[4]);
    for (const o of options(p)) {
      const f = o.label.match(/\(x ([+-]) (\d+)\)\(x ([+-]) (\d+)\)/)!;
      const s = (f[1] === "+" ? 1 : -1) * Number(f[2]);
      const u = (f[3] === "+" ? 1 : -1) * Number(f[4]);
      assert.equal(s + u === b && s * u === c, o.id === p.answer, o.label);
    }
  }
});

test("negative output: the factoring step names numbers that add to the middle coefficient", () => {
  for (let i = 0; i < 200; i++) {
    const p = generateProblem("quadratic-negative-output", `sum:${i}`);
    const text = p.explanation.join(" ");
    const zero = /\$x\^2 ([+-]) (\d+)x ([+-]) (\d+) = 0\$/.exec(text);
    if (!zero) continue;
    const b = Number(zero[2]) * (zero[1] === "-" ? -1 : 1);
    const claim = /add to \$(-?\d+)\$/.exec(text);
    assert.ok(claim, text);
    assert.equal(Number(claim![1]), b, text);
  }
});

test("linear-system-x elimination steps match the equations when the y coefficients are already equal", () => {
  let checked = 0;
  for (let i = 0; i < 400; i++) {
    const p = generateProblem("linear-system-x", `elim:${i}`);
    const m = /(\d+)x \+ (\d+)y = (-?\d+); (\d+)x \+ (\d+)y = (-?\d+)/.exec(
      p.public.prompt,
    );
    if (!m || m[2] !== m[5]) continue;
    checked++;
    const [a, c] = [Number(m[1]), Number(m[4])];
    assert.ok(
      p.explanation.join(" ").includes(`(${a} − ${c})x`),
      p.explanation.join(" "),
    );
  }
  assert.ok(checked > 0);
});
