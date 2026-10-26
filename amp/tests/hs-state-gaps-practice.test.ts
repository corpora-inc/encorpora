import test from "node:test";
import assert from "node:assert/strict";
import { generateProblem, templates } from "../src/math/engine";
import {
  generateHsStateGapProblem,
  hsStateGapTemplates,
} from "../src/math/hs-state-gaps-practice";
import { problemLesson } from "../src/content/problem-lessons";

const SEEDS = 400;
const ids = hsStateGapTemplates.map((t) => t.id);

function parts(templateId: string, seed: number) {
  const problem = generateProblem(templateId, `hs:${seed}`);
  const response = problem.public.response;
  assert.equal(response.kind, "choice");
  if (response.kind !== "choice") throw new Error("choice expected");
  const labels = response.options.map((o) => o.label);
  const correct = response.options.find((o) => o.id === problem.answer)!;
  return { problem, labels, correct: correct.label, options: response.options };
}

test("every high-school gap template is deterministic, registered and reaches the engine", () => {
  for (const id of ids) {
    const template = templates.find((t) => t.id === id);
    assert.ok(template, id);
    assert.equal(template.requiredResponseCapability, "single-choice-v1");
    for (let seed = 0; seed < SEEDS; seed++) {
      const a = generateProblem(id, `hs:${seed}`);
      const b = generateHsStateGapProblem(id, `hs:${seed}`);
      assert.deepEqual(a.public, b.public);
      assert.equal(a.answer, b.answer);
      assert.deepEqual(a, generateProblem(id, `hs:${seed}`));
    }
  }
});

test("each problem has four distinct choices, one correct, feedback on every wrong choice and no leaked answer", () => {
  for (const id of ids)
    for (let seed = 0; seed < SEEDS; seed++) {
      const { problem, labels, options, correct } = parts(id, seed);
      assert.equal(labels.length, 4, `${id}:${seed}`);
      assert.equal(new Set(labels).size, 4, `${id}:${seed} ${labels}`);
      for (const o of options)
        if (o.id !== problem.answer)
          assert.ok(
            problem.choiceFeedback?.[o.id]?.trim(),
            `${id}:${seed} feedback for ${o.label}`,
          );
      if (!/^[\d°]+$/.test(correct) && id !== "cone-section-name") {
        assert.ok(
          !problem.public.prompt.includes(correct),
          `${id}:${seed} prompt`,
        );
        assert.ok(
          !problem.hint.includes(correct),
          `${id}:${seed} hint leaks ${correct}`,
        );
      }
      assert.ok(problem.explanation.length >= 2, id);
      assert.ok(problem.hint.length > 20, id);
    }
});

// ---------------------------------------------------------------- 1. gauss
const parseEq = (text: string) => {
  const [lhs, rhs] = text.split("=").map((s) => s.trim());
  const row = [0, 0, 0];
  for (const m of lhs!.matchAll(/([+-]?)\s*(\d*)([xyz])/g)) {
    const value = (m[2] ? Number(m[2]) : 1) * (m[1] === "-" ? -1 : 1);
    row["xyz".indexOf(m[3]!)]! += value;
  }
  return { row, rhs: Number(rhs) };
};
const parseSystem = (prompt: string) => {
  const body = /\\begin\{cases\} (.+?) \\end\{cases\}/.exec(prompt)![1]!;
  return body.split("\\\\").map((e) => parseEq(e));
};
const rank = (rows: number[][]) => {
  const m = rows.map((r) => r.map(Number));
  let rk = 0;
  for (let c = 0; c < m[0]!.length && rk < m.length; c++) {
    const p = m.findIndex((r, i) => i >= rk && Math.abs(r[c]!) > 1e-9);
    if (p < 0) continue;
    [m[rk], m[p]] = [m[p]!, m[rk]!];
    for (let i = 0; i < m.length; i++)
      if (i !== rk) {
        const f = m[i]![c]! / m[rk]![c]!;
        m[i] = m[i]!.map((v, j) => v - f * m[rk]![j]!);
      }
    rk++;
  }
  return rk;
};

test("three-variable systems: solutions, row operations and solution counts agree with an independent solver", () => {
  const seen = new Set<string>();
  for (let seed = 0; seed < SEEDS; seed++) {
    const { problem, labels, correct } = parts("gauss-3x3-solve", seed);
    const prompt = problem.public.prompt;
    if (/^Solve the system/.test(prompt)) {
      seen.add("solve");
      const eqs = parseSystem(prompt);
      const holdsFor = (label: string) => {
        const t = label.replace(/[$()]/g, "").split(",").map(Number);
        return eqs.every(
          (e) => e.row.reduce((s, c, i) => s + c * t[i]!, 0) === e.rhs,
        );
      };
      assert.ok(holdsFor(correct));
      assert.equal(labels.filter(holdsFor).length, 1);
    } else if (/row operation/.test(prompt)) {
      seen.add("operation");
      const eqs = parseSystem(prompt);
      const target = Number(/equation (\d) using/.exec(prompt)![1]) - 1;
      const op = (label: string) => {
        const m = /R_(\d) \\to R_\d ([+-]) (\d*)R_1/.exec(label)!;
        assert.equal(Number(m[1]) - 1, target);
        return (m[2] === "-" ? 1 : -1) * Number(m[3] || 1);
      };
      const cancels = (label: string) =>
        eqs[target]!.row[0]! - op(label) * eqs[0]!.row[0]! === 0;
      assert.ok(cancels(correct));
      assert.equal(labels.filter(cancels).length, 1);
    } else if (/How many solutions/.test(prompt)) {
      const eqs = parseSystem(prompt);
      const A = eqs.map((e) => e.row);
      const aug = eqs.map((e) => [...e.row, e.rhs]);
      const [ra, rb] = [rank(A), rank(aug)];
      const truth =
        ra < rb
          ? "No solution"
          : ra === 3
            ? "Exactly one solution"
            : "Infinitely many solutions";
      seen.add(truth);
      assert.equal(correct, truth);
    } else {
      seen.add("back");
      const eqs = parseSystem(prompt);
      const holdsFor = (label: string) => {
        const t = label.replace(/[$()]/g, "").split(",").map(Number);
        return eqs.every(
          (e) => e.row.reduce((s, c, i) => s + c * t[i]!, 0) === e.rhs,
        );
      };
      assert.equal(labels.filter(holdsFor).length, 1);
      assert.ok(holdsFor(correct));
    }
  }
  assert.deepEqual(
    [...seen].sort(),
    [
      "Exactly one solution",
      "Infinitely many solutions",
      "No solution",
      "back",
      "operation",
      "solve",
    ].sort(),
  );
});

// ----------------------------------------------------- 2. quadratic inequality
const toJs = (tex: string) =>
  tex
    .replace(/(\d)x/g, "$1*x")
    .replace(/x\^2/g, "(x*x)")
    .replace(/\s+/g, "")
    .replace(/(\d)\(x\*x\)/g, "$1*(x*x)");
const parseSet = (label: string): ((t: number) => boolean) => {
  const text = label.replace(/\$/g, "");
  if (text === "No real solution") return () => false;
  if (text === "(-\\infty, \\infty)") return () => true;
  let m = /^\\\{(-?\d+)\\\}$/.exec(text);
  if (m) return (t) => t === Number(m![1]);
  m = /^\(-\\infty, (-?\d+)\) \\cup \((-?\d+), \\infty\)$/.exec(text);
  if (m) return (t) => t < Number(m![1]) || t > Number(m![2]);
  const outside =
    /^\(-\\infty, (-?\d+)([\])]) \\cup ([\[(])(-?\d+), \\infty\)$/.exec(text);
  if (outside)
    return (t) =>
      outside[2] === "]"
        ? t <= Number(outside[1]) || t >= Number(outside[4])
        : t < Number(outside[1]) || t > Number(outside[4]);
  const between = /^([\[(])(-?\d+), (-?\d+)([\])])$/.exec(text);
  assert.ok(between, label);
  const [lo, hi] = [Number(between![2]), Number(between![3])];
  return (t) =>
    (between![1] === "[" ? t >= lo : t > lo) &&
    (between![4] === "]" ? t <= hi : t < hi);
};

test("quadratic inequalities: the correct interval matches brute-force evaluation and every wrong set differs", () => {
  const seen = new Set<string>();
  for (let seed = 0; seed < SEEDS; seed++) {
    const { problem, labels, correct } = parts(
      "quadratic-inequality-interval",
      seed,
    );
    const prompt = problem.public.prompt;
    const m = /^Solve \$(.+?) (<|>|\\le|\\ge) (-?\d+)\$/.exec(prompt)!;
    assert.ok(m, prompt);
    const f = new Function("x", `return ${toJs(m[1]!)};`) as (
      x: number,
    ) => number;
    const rhs = Number(m[3]);
    const test = (t: number) =>
      m[2] === "<"
        ? f(t) < rhs
        : m[2] === ">"
          ? f(t) > rhs
          : m[2] === "\\le"
            ? f(t) <= rhs
            : f(t) >= rhs;
    const points: number[] = [];
    for (let t = -40; t <= 40; t += 0.5) points.push(t);
    assert.ok(
      points.every((t) => parseSet(correct)(t) === test(t)),
      `${prompt} -> ${correct}`,
    );
    for (const label of labels)
      if (label !== correct)
        assert.ok(
          points.some((t) => parseSet(label)(t) !== test(t)),
          `${prompt}: ${label} equals the answer`,
        );
    if (/Choose the solution set\./.test(prompt)) seen.add("no-sign-change");
    else {
      seen.add(rhs === 0 ? "zero-form" : "rearranged");
      seen.add(m[1]!.startsWith("-") ? "negative-leading" : "positive-leading");
      seen.add(m[2]!.includes("e") ? "closed" : "open");
      seen.add(/cup/.test(correct) ? "outside" : "between");
    }
    if (/No real solution/.test(correct)) seen.add("empty");
    if (/\(-\\infty, \\infty\)\$$/.test(correct)) seen.add("all-reals");
  }
  for (const k of [
    "no-sign-change",
    "zero-form",
    "rearranged",
    "negative-leading",
    "positive-leading",
    "closed",
    "open",
    "outside",
    "between",
    "empty",
    "all-reals",
  ])
    assert.ok(seen.has(k), `missing ${k}`);
});

// ------------------------------------------------------------ 3. conditionals
function parseFormula(tex: string): (e: Record<string, boolean>) => boolean {
  const tokens = tex.match(
    /\\neg|\\land|\\lor|\\leftrightarrow|\\to|[PQR()]/g,
  )!;
  let pos = 0;
  const unary = (): ((e: Record<string, boolean>) => boolean) => {
    const t = tokens[pos++]!;
    if (t === "\\neg") {
      const inner = unary();
      return (e) => !inner(e);
    }
    if (t === "(") {
      const inner = expr();
      assert.equal(tokens[pos++], ")");
      return inner;
    }
    return (e) => e[t]!;
  };
  const expr = (): ((e: Record<string, boolean>) => boolean) => {
    const left = unary();
    const op = tokens[pos];
    if (!op || op === ")") return left;
    pos++;
    const right = unary();
    return {
      "\\land": (e: Record<string, boolean>) => left(e) && right(e),
      "\\lor": (e: Record<string, boolean>) => left(e) || right(e),
      "\\to": (e: Record<string, boolean>) => !left(e) || right(e),
      "\\leftrightarrow": (e: Record<string, boolean>) => left(e) === right(e),
    }[op]!;
  };
  const out = expr();
  assert.equal(pos, tokens.length, tex);
  return out;
}

test("conditional statements: every form is built and evaluated correctly", () => {
  const seen = new Set<string>();
  const forms = ["converse", "inverse", "contrapositive"];
  for (let seed = 0; seed < SEEDS; seed++) {
    const { problem, labels, correct } = parts("conditional-statements", seed);
    const prompt = problem.public.prompt;
    let m: RegExpExecArray | null;
    if (
      (m =
        /^Which statement is the (converse|inverse|contrapositive) of “If (.+), then (.+)\.”\?$/.exec(
          prompt,
        ))
    ) {
      seen.add(`form-${m[1]}`);
      const [, kind, a, b] = m;
      if (kind === "converse") assert.equal(correct, `If ${b}, then ${a}.`);
      if (kind === "contrapositive") {
        assert.ok(correct.startsWith("If ") && correct.includes(", then "));
        assert.ok(!correct.includes(`If ${b}`) && !correct.includes(`If ${a}`));
      }
      assert.equal(labels.filter((l) => l === `If ${b}, then ${a}.`).length, 1);
    } else if (/must also be true/.test(prompt)) {
      seen.add("equivalent");
      const orig = /“If (.+), then (.+)\.”/.exec(prompt)!;
      assert.ok(!correct.includes(`If ${orig[2]}, then ${orig[1]}.`));
      assert.ok(correct.startsWith("If ") && forms.length === 3);
    } else if (/^Let \$P\$ be/.test(prompt)) {
      seen.add("biconditional");
      assert.ok(correct.startsWith("$P \\leftrightarrow Q$"));
    } else if (/^Suppose/.test(prompt)) {
      const env = Object.fromEntries(
        [...prompt.matchAll(/\$([PQR])\$ is (true|false)/g)].map((x) => [
          x[1]!,
          x[2] === "true",
        ]),
      );
      const wantTrue = /is true\?$/.test(prompt);
      seen.add(wantTrue ? "compound-true" : "compound-false");
      const texOf = (l: string) => l.replace(/\$/g, "");
      assert.equal(
        labels.filter((l) => parseFormula(texOf(l))(env) === wantTrue).length,
        1,
      );
      assert.equal(parseFormula(texOf(correct))(env), wantTrue);
    } else {
      assert.match(prompt, /negation of/);
      seen.add("negation");
      assert.match(correct, / and /);
    }
  }
  for (const k of [
    "form-converse",
    "form-inverse",
    "form-contrapositive",
    "equivalent",
    "biconditional",
    "compound-true",
    "compound-false",
    "negation",
  ])
    assert.ok(seen.has(k), `missing ${k}`);
});

// -------------------------------------------------------------- 4. cube roots
const labelValue = (label: string) => {
  const m = /x = (-?)(?:(\d+)|\\frac\{(\d+)\}\{(\d+)\})/.exec(label)!;
  return (m[1] ? -1 : 1) * (m[2] ? Number(m[2]) : Number(m[3]) / Number(m[4]));
};
test("cube-root equations: the marked solution satisfies the equation and no other choice does", () => {
  const seen = new Set<string>();
  for (let seed = 0; seed < SEEDS; seed++) {
    const { problem, labels, correct } = parts("cube-root-equation", seed);
    const prompt = problem.public.prompt;
    let m: RegExpExecArray | null;
    if (
      (m = /^Solve \$\\sqrt\[3\]\{(.+?)\}(?: ([+-]) (\d+))? = (-?\d+)\$/.exec(
        prompt,
      ))
    ) {
      seen.add(m[2] ? "isolate" : "direct");
      const rad = new Function("x", `return ${toJs(m[1]!)};`) as (
        x: number,
      ) => number;
      const lhs = (x: number) =>
        Math.cbrt(rad(x)) +
        (m![2] ? (m![2] === "-" ? -1 : 1) * Number(m![3]) : 0);
      const ok = (label: string) =>
        /x = /.test(label) &&
        Math.abs(lhs(labelValue(label)) - Number(m![4])) < 1e-9;
      assert.ok(ok(correct), prompt);
      assert.equal(labels.filter(ok).length, 1, prompt);
    } else if (
      (m = /^Find all real solutions of \$(.+?) = (-?\d+)\$/.exec(prompt))
    ) {
      seen.add("power");
      const f = new Function(
        "x",
        `return ${m[1]!.replace(/(\d)x/g, "$1*x").replace(/x\^3/g, "(x*x*x)").replace(/\s+/g, "")};`,
      ) as (x: number) => number;
      const sol = (label: string) =>
        label
          .replace(/[${}\\]|\\\{|\\\}/g, "")
          .replace(/\\\{|\\\}/g, "")
          .split(",")
          .map((s) => Number(s.replace(/[^\d-]/g, "")));
      const good = (label: string) => {
        const roots = sol(label);
        return roots.every((x) => f(x) === Number(m![2])) && roots.length === 1;
      };
      assert.ok(good(correct), `${prompt} ${correct}`);
      assert.equal(labels.filter(good).length, 1, `${prompt} ${labels}`);
    } else {
      seen.add("check");
      assert.match(prompt, /student cubes both sides/);
      assert.match(correct, /is a solution/);
    }
  }
  assert.deepEqual([...seen].sort(), ["check", "direct", "isolate", "power"]);
});

// ---------------------------------------------------------------- 5. polar
test("polar graphs: petal counts, extreme distances and symmetry agree with sampling", () => {
  const seen = new Set<string>();
  for (let seed = 0; seed < SEEDS; seed++) {
    const { problem, correct } = parts("polar-graph-identify", seed);
    const prompt = problem.public.prompt;
    let m: RegExpExecArray | null;
    if (
      (m =
        /^How many petals does the graph of \$r = -?(\d+) \\(?:sin|cos)\((\d+)\\theta\)\$ have\?$/.exec(
          prompt,
        ))
    ) {
      seen.add("petals");
      const n = Number(m[2]);
      assert.equal(correct, `${n % 2 ? n : 2 * n} petals`);
    } else if (
      (m = /^What is the greatest distance .* \$r = (.+)\$\?$/.exec(prompt))
    ) {
      seen.add("distance");
      const expr = m[1]!
        .replace(/\\theta/g, "t")
        .replace(/\\sin\(?(\d*)t\)?/g, (_, k) => `Math.sin(${k || 1}*t)`)
        .replace(/\\cos\(?(\d*)t\)?/g, (_, k) => `Math.cos(${k || 1}*t)`)
        .replace(/(\d)Math/g, "$1*Math")
        .replace(/(\d) Math/g, "$1*Math")
        .replace(/-(\d+)\*?/g, "-$1*")
        .replace(/\s+/g, "");
      const f = new Function(
        "t",
        `return ${expr.replace(/\*\*/g, "*").replace(/\+\*/g, "+").replace(/--/g, "+")};`,
      ) as (t: number) => number;
      let max = 0;
      for (let k = 0; k < 20000; k++)
        max = Math.max(max, Math.abs(f((k / 20000) * 2 * Math.PI)));
      assert.ok(
        Math.abs(max - Number(correct)) < 1e-3,
        `${prompt} ${max} ${correct}`,
      );
    } else if (/symmetric about/.test(prompt)) {
      seen.add("symmetry");
      const cos = /\\cos/.test(prompt);
      assert.match(correct, cos ? /polar axis/ : /\\frac\{\\pi\}\{2\}/);
    } else {
      seen.add("identify");
      assert.match(prompt, /^Which description matches/);
    }
  }
  assert.deepEqual([...seen].sort(), [
    "distance",
    "identify",
    "petals",
    "symmetry",
  ]);
});

// ----------------------------------------------------------------- 6. cone
test("cone sections: names follow the angle comparison, including degenerate sections", () => {
  const seen = new Set<string>();
  for (let seed = 0; seed < SEEDS; seed++) {
    const { problem, correct } = parts("cone-section-name", seed);
    const prompt = problem.public.prompt;
    const alpha = Number(/angle of (\d+)° with its axis/.exec(prompt)?.[1]);
    let m: RegExpExecArray | null;
    if (
      (m =
        /does not pass through the vertex cuts the cone at (\d+)° to the axis/.exec(
          prompt,
        ))
    ) {
      const beta = Number(m[1]);
      const expected =
        beta === 90
          ? "A circle"
          : beta > alpha
            ? "An ellipse"
            : beta === alpha
              ? "A parabola"
              : "A hyperbola";
      assert.equal(correct, expected, prompt);
      seen.add(expected);
    } else if (
      (m = /passes through the vertex and makes an angle of (\d+)°/.exec(
        prompt,
      ))
    ) {
      const beta = Number(m[1]);
      assert.equal(
        correct,
        beta > alpha
          ? "A single point"
          : beta === alpha
            ? "A single line"
            : "Two intersecting lines",
      );
      seen.add("degenerate");
    } else if (/For which value of \$\\beta\$/.test(prompt)) {
      const beta = Number(/(\d+)°/.exec(correct)![1]);
      const want =
        /intersection (a circle|an ellipse|a parabola|a hyperbola)\?/.exec(
          prompt,
        )![1]!;
      const got =
        beta === 90
          ? "a circle"
          : beta > alpha
            ? "an ellipse"
            : beta === alpha
              ? "a parabola"
              : "a hyperbola";
      assert.equal(got, want);
      seen.add("reverse");
    } else {
      seen.add("description");
    }
  }
  for (const k of [
    "A circle",
    "An ellipse",
    "A parabola",
    "A hyperbola",
    "degenerate",
    "reverse",
    "description",
  ])
    assert.ok(seen.has(k), `missing ${k}`);
});

test("each family has a lesson with method, principle and a worked example", () => {
  for (const id of ids) {
    const lesson = problemLesson(id, "library");
    assert.ok(lesson.intuition?.trim(), id);
    assert.ok(lesson.method.length >= 2, id);
    assert.ok(lesson.watch, id);
    assert.ok(lesson.principle, id);
    assert.ok(lesson.example.steps.length >= 2, id);
  }
});
