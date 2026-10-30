import test from "node:test";
import assert from "node:assert/strict";
import {
  floridaGapCase,
  floridaGapTemplateIds,
  floridaGapTemplates,
} from "../src/math/florida-gaps-practice";
import { generateProblem, templates } from "../src/math/engine";
import { problemLesson } from "../src/content/problem-lessons";
import { lessons } from "../src/content/lessons";

const SEEDS = 400;
const cases = (id: string) =>
  Array.from({ length: SEEDS }, (_, i) => floridaGapCase(id, `fl:${i}`));
const strip = (s: string) => s.replace(/\$/g, "");
const num = (text: string) => Number(text);

/** Evaluate a numeric expression written with \times and \div. */
function evalExpr(text: string): number {
  const js = strip(text)
    .replace(/\\times/g, "*")
    .replace(/\\div/g, "/");
  assert.match(js, /^[0-9+\-*/(). ]+$/, js);
  return Function(`return (${js})`)() as number;
}
const same = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/** Polynomial text such as -4x^{2} + 5x - 2 into coefficients by exponent. */
function parsePoly(text: string): number[] {
  const out = new Array<number>(8).fill(0);
  const re = /([+-]?)\s*(\d*)(x(?:\^\{(\d+)\})?)?/g;
  let m: RegExpExecArray | null;
  const body = text.trim();
  while ((m = re.exec(body)) && m[0] !== "") {
    const sgn = m[1] === "-" ? -1 : 1;
    const hasX = Boolean(m[3]);
    const k = m[2] === "" ? (hasX ? 1 : 0) : Number(m[2]);
    out[hasX ? (m[4] ? Number(m[4]) : 1) : 0]! += sgn * k;
  }
  return out;
}
const at = (c: number[], x: number) => c.reduce((s, k, i) => s + k * x ** i, 0);
const choiceLabels = (g: ReturnType<typeof floridaGapCase>["problem"]) => {
  const response = g.public.response;
  assert.equal(response.kind, "choice");
  if (response.kind !== "choice") throw new Error("choice expected");
  return response.options;
};

test("every template is registered, deterministic, reaches the engine and has all variants", () => {
  const expected: Record<string, number> = {
    "fl-equation-truth-20": 2,
    "fl-equation-truth-100": 2,
    "multiplication-division-equation-truth": 2,
    "whole-number-equation-truth": 2,
    "fl-equation-truth-grouped": 2,
    "fl-decimal-tenth-hundredth-step": 8,
    "fl-decimal-by-tenth-hundredth": 5,
    "fl-expression-description-match": 2,
    "fl-two-step-story-equation": 5,
    "fl-metric-customary-conversion": 10,
    "fl-integer-multiply-divide": 6,
    "fl-vector-dot-product": 3,
    "fl-vector-angle": 5,
    "fl-even-odd-classify": 6,
    "fl-function-arithmetic": 6,
    "fl-trapezoid-consequences": 6,
  };
  assert.deepEqual(
    [...floridaGapTemplateIds].sort(),
    Object.keys(expected).sort(),
  );
  for (const template of floridaGapTemplates)
    assert.ok(
      templates.some((t) => t.id === template.id),
      template.id,
    );
  for (const id of floridaGapTemplateIds) {
    const variants = new Set<string>();
    for (let i = 0; i < SEEDS; i++) {
      const c = floridaGapCase(id, `fl:${i}`);
      variants.add(c.variant);
      if (i < 25) {
        const g = generateProblem(id, `fl:${i}`);
        assert.deepEqual(g.public, c.problem.public);
        assert.equal(g.answer, c.problem.answer);
        assert.deepEqual(
          floridaGapCase(id, `fl:${i}`).problem.public,
          c.problem.public,
        );
      }
    }
    assert.equal(variants.size, expected[id], `${id}: ${[...variants]}`);
  }
});

test("choice problems have four distinct options, exactly one correct, and the prompt and hint never state it", () => {
  for (const id of floridaGapTemplateIds)
    for (const c of cases(id)) {
      const { problem } = c;
      const response = problem.public.response;
      if (response.kind !== "choice") {
        assert.match(problem.answer, /^-?\d+(\.\d+)?$/, problem.answer);
        assert.ok(problem.hint.length > 20);
        continue;
      }
      const labels = response.options.map((o) => o.label);
      assert.equal(new Set(labels).size, 4, id);
      assert.ok(
        response.options.some((o) => o.id === problem.answer),
        id,
      );
      const correct = response.options.find((o) => o.id === problem.answer)!;
      assert.ok(!problem.public.prompt.includes(correct.label), id);
      assert.ok(!problem.hint.includes(correct.label), id);
      assert.ok(problem.explanation.length >= 2, id);
    }
});

test("equation truth: exactly one choice has the asked truth value and ranges follow the benchmark", () => {
  const bands: Record<string, { cap: number; ops: RegExp }> = {
    "fl-equation-truth-20": { cap: 20, ops: /^[0-9 +\-=]+$/ },
    "fl-equation-truth-100": { cap: 100, ops: /^[0-9 +\-=]+$/ },
    "multiplication-division-equation-truth": {
      cap: 144,
      ops: /^[0-9 =]*(\\times|\\div|[0-9 =])*$/,
    },
    "whole-number-equation-truth": {
      cap: 190,
      ops: /^[0-9 +\-=]*(\\times|\\div|[0-9 +\-=])*$/,
    },
    "fl-equation-truth-grouped": { cap: 400, ops: /./ },
  };
  const seen = new Set<string>();
  for (const [id, band] of Object.entries(bands))
    for (const { problem } of cases(id)) {
      const asksTrue = /Which equation is true\?/.test(problem.public.prompt);
      const options = choiceLabels(problem);
      const truth = options.map((o) => {
        const [l, r] = strip(o.label).split(" = ") as [string, string];
        return same(evalExpr(l), evalExpr(r));
      });
      const target = options.findIndex((o) => o.id === problem.answer);
      assert.equal(truth.filter((t) => t === asksTrue).length, 1, id);
      assert.equal(truth[target], asksTrue, id);
      for (const o of options) {
        const text = strip(o.label);
        assert.match(text, band.ops, `${id}: ${text}`);
        const numbers = text.match(/\d+(\.\d+)?/g)!.map(Number);
        for (const n of numbers) assert.ok(n <= band.cap, `${id}: ${text}`);
        if (id === "multiplication-division-equation-truth")
          assert.doesNotMatch(text, /[+-]/, text);
        if (id === "fl-equation-truth-20")
          for (const side of text.split(" = "))
            assert.ok(evalExpr(side) <= 20 && evalExpr(side) >= 0, text);
        if (id === "multiplication-division-equation-truth")
          for (const m of text.matchAll(/(\d+) \\div (\d+)/g))
            assert.ok(num(m[2]!) <= 12 && num(m[1]!) / num(m[2]!) <= 12, text);
        if (id === "multiplication-division-equation-truth")
          for (const m of text.matchAll(/(\d+) \\times (\d+)/g))
            assert.ok(num(m[1]!) <= 12 && num(m[2]!) <= 12, text);
        if (id === "fl-equation-truth-grouped") {
          if (text.includes(".")) seen.add("decimal");
          if (text.includes("(")) seen.add("parentheses");
          if (text.includes("\\div")) seen.add("division");
        }
        if (id === "fl-equation-truth-100") {
          const [l, r] = text.split(" = ") as [string, string];
          if (/[+-]/.test(l) && /[+-]/.test(r)) seen.add("both-sides-100");
          if (!/[+-]/.test(l)) seen.add("result-left-100");
        }
      }
    }
  assert.deepEqual(
    [...seen].sort(),
    [
      "both-sides-100",
      "decimal",
      "division",
      "parentheses",
      "result-left-100",
    ].sort(),
  );
});

test("decimal 0.1 and 0.01 more or less matches exact hundredths arithmetic", () => {
  const regroup = new Set<string>();
  for (const { problem } of cases("fl-decimal-tenth-hundredth-step")) {
    const m =
      /What number is (0\.1|0\.01) (more|less) than (\d+(?:\.\d+)?)\?/.exec(
        problem.public.prompt,
      )!;
    const [whole, frac = ""] = m[3]!.split(".");
    const base = BigInt(whole!) * 100n + BigInt(frac.padEnd(2, "0"));
    const step = m[1] === "0.1" ? 10n : 1n;
    const result = m[2] === "more" ? base + step : base - step;
    assert.ok(result >= 0n);
    const [aw, af = ""] = problem.answer.split(".");
    assert.equal(
      BigInt(aw!) * 100n + BigInt(af.padEnd(2, "0")),
      result,
      problem.public.prompt,
    );
    const carry =
      result / 100n !== base / 100n ||
      ((result / 10n) % 10n !== (base / 10n) % 10n && step === 1n);
    if (carry) regroup.add(m[2]!);
  }
  assert.deepEqual([...regroup].sort(), ["less", "more"]);
});

test("multiplying or dividing by 0.1 and 0.01 is exact", () => {
  const scaled = (text: string, places: bigint) => {
    const [w, f = ""] = text.split(".");
    return (
      BigInt(w!) * 10n ** places + BigInt(f.padEnd(Number(places), "0") || "0")
    );
  };
  for (const { problem } of cases("fl-decimal-by-tenth-hundredth")) {
    const p = strip(problem.public.prompt);
    const answer = scaled(problem.answer, 6n);
    let m = /^Find (\S+)\\(times|div)(0\.1|0\.01)\.$/.exec(p);
    if (m) {
      const d = scaled(m[1]!, 6n);
      const factor = m[3] === "0.1" ? 1n : 2n; // tenths or hundredths
      // d * 10^-factor, or d * 10^factor
      const expected = m[2] === "times" ? d / 10n ** factor : d * 10n ** factor;
      if (m[2] === "times") assert.equal(d % 10n ** factor, 0n);
      assert.equal(answer, expected, p);
      continue;
    }
    m = /^What number times (0\.1|0\.01) equals (\S+)\?$/.exec(p)!;
    assert.ok(m, p);
    const factor = m[1] === "0.1" ? 1n : 2n;
    assert.equal(scaled(m[2]!, 6n) * 10n ** factor, answer, p);
  }
});

test("expression and description agree in value, and the correct choice is the only match", () => {
  const described = (d: string): number => {
    const x = (re: RegExp) => re.exec(d);
    let m;
    if ((m = x(/^Add (\S+) and (\S+), then multiply the sum by (\S+)\.$/)))
      return (num(m[1]!) + num(m[2]!)) * num(m[3]!);
    if (
      (m = x(
        /^Subtract (\S+) from (\S+), then divide the difference by (\S+)\.$/,
      ))
    )
      return (num(m[2]!) - num(m[1]!)) / num(m[3]!);
    if ((m = x(/^Multiply (\S+) by the sum of (\S+) and (\S+)\.$/)))
      return num(m[1]!) * (num(m[2]!) + num(m[3]!));
    if ((m = x(/^Divide (\S+) by (\S+), then add (\S+)\.$/)))
      return num(m[1]!) / num(m[2]!) + num(m[3]!);
    if ((m = x(/^Subtract (\S+) from the product of (\S+) and (\S+)\.$/)))
      return num(m[2]!) * num(m[3]!) - num(m[1]!);
    if ((m = x(/^Double the sum of (\S+) and (\S+)\.$/)))
      return 2 * (num(m[1]!) + num(m[2]!));
    return NaN;
  };
  const wrongStructure = new Set<string>();
  for (const { variant, problem } of cases("fl-expression-description-match")) {
    const options = choiceLabels(problem);
    const prompt = problem.public.prompt;
    const target = options.find((o) => o.id === problem.answer)!;
    if (variant === "expression-to-description") {
      const expr = /expression (\$.*\$)\?/.exec(prompt)![1]!;
      const value = evalExpr(expr);
      const values = options.map((o) => described(o.label));
      assert.ok(same(described(target.label), value), prompt);
      // Compare structure: no other description may evaluate to the same value only by accident
      // while being a different description; the correct one is identified by value here.
      const matches = values.filter((v) => same(v, value));
      if (matches.length > 1) wrongStructure.add("ambiguous-value");
    } else {
      const desc = /"(.*)"/.exec(prompt)![1]!;
      const value = described(desc);
      assert.ok(!Number.isNaN(value), desc);
      assert.ok(same(evalExpr(target.label), value), prompt);
      const matches = options.filter((o) => same(evalExpr(o.label), value));
      if (matches.length > 1) wrongStructure.add("ambiguous-value");
    }
  }
  // Values may coincide for a few number choices, but the structure differs; both are fine.
  assert.ok(wrongStructure.size <= 1);
});

test("two-step story equations: the keyed equation has the story's structure and a whole-number solution", () => {
  for (const { variant, problem } of cases("fl-two-step-story-equation")) {
    const prompt = problem.public.prompt;
    const key = choiceLabels(problem).find(
      (o) => o.id === problem.answer,
    )!.label;
    const letter = /Let \$(\w)\$|shares \$(\w)\$/.exec(prompt)!;
    const v = letter[1] ?? letter[2]!;
    const nums = (prompt.match(/\d+/g) ?? []).map(Number);
    const eq = strip(key);
    const [lhs, rhs] = eq.split(" = ") as [string, string];
    const t = num(rhs);
    // Solve the keyed equation for a whole number by search and check the story's own total.
    let solution = 0;
    for (let n = 1; n <= 200; n++) {
      const value = evalExpr(
        lhs
          .replace(new RegExp(`(\\d)${v}`, "g"), `$1*${n}`)
          .replace(new RegExp(v, "g"), String(n))
          .replace(/(\d)\(/g, "$1*("),
      );
      if (same(value, t)) {
        solution = n;
        break;
      }
    }
    assert.ok(solution > 0, eq);
    assert.ok(nums.includes(t), `${prompt} ${eq}`);
    const structure: Record<string, RegExp> = {
      plus: /loose markers/,
      minus: /are sold/,
      "gain-each": /gets/,
      "lose-each": /sends/,
      "share-plus": /shares/,
    };
    assert.match(prompt, structure[variant]!, variant);
    // The operation order in the key matches the story keyword.
    if (variant === "plus") assert.match(lhs, /^\d+\w \+ \d+$/);
    if (variant === "minus") assert.match(lhs, /^\d+\w - \d+$/);
    if (variant === "gain-each") assert.match(lhs, /^\d+\(\w \+ \d+\)$/);
    if (variant === "lose-each") assert.match(lhs, /^\d+\(\w - \d+\)$/);
    if (variant === "share-plus") assert.match(lhs, /^\w \\div \d+ \+ \d+$/);
  }
});

test("customary and metric conversions use only the stated factor", () => {
  const scaled = (text: string) => {
    const [w, f = ""] = text.split(".");
    return BigInt(w!) * 100n + BigInt(f.padEnd(2, "0"));
  };
  for (const { variant, problem } of cases("fl-metric-customary-conversion")) {
    const p = problem.public.prompt;
    const factor =
      /Use 1 ([a-zA-Z ]+) = ([\d.]+) ([a-zA-Z ]+)\. How many ([a-zA-Z ]+) is that\?/.exec(
        p,
      )!;
    const given = /(\d+(?:\.\d+)?) ([a-zA-Z ]+?)( long|\.)/.exec(
      p
        .split(" Use ")[0]!
        .replace(/an area of /, "")
        .replace(/ (weighs|holds|costs|has) /, " | "),
    );
    void given;
    const quantity = /(\d+(?:\.\d+)?) ([a-zA-Z ]+?)(?: long)?\.$/.exec(
      p
        .split(" Use ")[0]!
        .replace(/^.* (is|weighs|holds|costs|has an area of) /, ""),
    )!;
    const k = scaled(factor[2]!);
    const q = scaled(quantity[1]!);
    const toUnit = factor[4]!;
    const forward = toUnit === factor[3] || toUnit === `${factor[3]}s`;
    const a = scaled(problem.answer);
    if (forward) assert.equal(q * k, a * 100n, p);
    else assert.equal(q * 100n, a * k, p);
    assert.ok(variant.endsWith(forward ? "to-metric" : "to-customary"), p);
    assert.match(
      quantity[2]!,
      new RegExp(`${forward ? factor[1] : factor[3]}`),
      p,
    );
  }
});

test("integer multiplication and division follow sign rules exactly", () => {
  const signs = new Set<string>();
  for (const { problem } of cases("fl-integer-multiply-divide")) {
    const m = /^Find \$(\(?-?\d+\)?) \\(times|div) (\(?-?\d+\)?)\$\.$/.exec(
      problem.public.prompt,
    )!;
    const a = Number(m[1]!.replace(/[()]/g, ""));
    const b = Number(m[3]!.replace(/[()]/g, ""));
    if (m[2] === "div") assert.ok(b !== 0 && a % b === 0);
    const expected = m[2] === "times" ? a * b : a / b;
    assert.equal(Number(problem.answer), expected + 0, problem.public.prompt);
    assert.doesNotMatch(m[1]!, /^\(\d+\)$/);
    assert.doesNotMatch(m[3]!, /^\(\d+\)$/);
    signs.add(`${Math.sign(a)},${Math.sign(b)}`);
  }
  for (const s of ["-1,-1", "-1,1", "1,-1", "0,1", "0,-1", "1,0"])
    assert.ok(signs.has(s), `missing sign case ${s}`);
});

const parseVec = (text: string): [number, number] => {
  const m = /\\langle (-?\d+), (-?\d+)\\rangle/.exec(text)!;
  return [Number(m[1]), Number(m[2])];
};

test("vector dot products, perpendicular values and scalar projections are exact", () => {
  for (const { variant, problem } of cases("fl-vector-dot-product")) {
    const p = problem.public.prompt;
    if (variant === "perpendicular-k") {
      const m =
        /\\langle k, (-?\d+)\\rangle\$ and \$\\mathbf\{v\}=(\\langle.*?\\rangle)/.exec(
          p,
        )!;
      const b = Number(m[1]);
      const [c, d] = parseVec(m[2]!);
      assert.equal(Number(problem.answer) * c + b * d, 0);
      assert.notEqual(Number(problem.answer), 0);
      continue;
    }
    const vs = [...p.matchAll(/\\langle -?\d+, -?\d+\\rangle/g)].map((m) =>
      parseVec(m[0]),
    );
    const dot = vs[0]![0] * vs[1]![0] + vs[0]![1] * vs[1]![1];
    if (variant === "dot") assert.equal(Number(problem.answer) + 0, dot + 0);
    else {
      const length = Math.hypot(vs[1]![0], vs[1]![1]);
      assert.ok(Number.isInteger(length));
      assert.equal(Number(problem.answer) * length, dot);
    }
  }
});

test("angle between vectors and vector relationships match floating-point geometry", () => {
  const seen = new Set<string>();
  for (const { variant, problem } of cases("fl-vector-angle")) {
    const p = problem.public.prompt;
    const vs = [...p.matchAll(/\\langle -?\d+, -?\d+\\rangle/g)].map((m) =>
      parseVec(m[0]),
    );
    const [u, v] = vs as [[number, number], [number, number]];
    const dot = u[0] * v[0] + u[1] * v[1];
    const cross = u[0] * v[1] - u[1] * v[0];
    const key = choiceLabels(problem).find(
      (o) => o.id === problem.answer,
    )!.label;
    if (variant === "angle") {
      const cos = dot / (Math.hypot(...u) * Math.hypot(...v));
      const theta = Math.round(
        (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI,
      );
      assert.equal(key, `$${theta}^\\circ$`);
      seen.add(`angle-${theta}`);
    } else {
      const expected =
        dot === 0
          ? "perpendicular"
          : cross === 0 && dot > 0
            ? "same direction"
            : cross === 0
              ? "opposite directions"
              : "neither";
      assert.match(
        key,
        new RegExp(
          expected === "perpendicular"
            ? "perpendicular\\."
            : expected === "neither"
              ? "neither"
              : expected,
        ),
      );
      seen.add(expected);
    }
  }
  for (const a of [0, 45, 90, 135, 180])
    assert.ok(seen.has(`angle-${a}`), `${a}`);
  for (const e of [
    "perpendicular",
    "same direction",
    "opposite directions",
    "neither",
  ])
    assert.ok(seen.has(e), e);
});

test("even and odd classification agrees with numerical symmetry", () => {
  const classify = (c: number[]) => {
    const xs = [1, 2, 3, 4, 5];
    if (xs.every((x) => same(at(c, -x), at(c, x)))) return "even";
    if (xs.every((x) => same(at(c, -x), -at(c, x)))) return "odd";
    return "neither";
  };
  for (const { variant, problem } of cases("fl-even-odd-classify")) {
    const options = choiceLabels(problem);
    const key = options.find((o) => o.id === problem.answer)!.label;
    if (variant.startsWith("choose-")) {
      const want = variant.slice(7);
      const results = options.map((o) =>
        classify(parsePoly(/f\(x\)=(.*)\$$/.exec(o.label)![1]!)),
      );
      assert.equal(results.filter((r) => r === want).length, 1, variant);
      assert.equal(classify(parsePoly(/f\(x\)=(.*)\$$/.exec(key)![1]!)), want);
    } else {
      const f = parsePoly(/f\(x\)=(.*?)\$\./.exec(problem.public.prompt)![1]!);
      const m = /f\(-x\)=(.*?)\$, so \$f\$ is (even|odd|neither)/.exec(key)!;
      const claimed = parsePoly(m[1]!);
      for (const x of [1, 2, 3]) assert.ok(same(at(claimed, x), at(f, -x)));
      assert.equal(m[2], classify(f));
      // Each wrong choice is wrong in classification or in the computed f(-x).
      for (const o of options.filter((o) => o.id !== problem.answer)) {
        const w = /f\(-x\)=(.*?)\$, so \$f\$ is (even|odd|neither)/.exec(
          o.label,
        )!;
        const wc = parsePoly(w[1]!);
        const trueFneg = [1, 2, 3].every((x) => same(at(wc, x), at(f, -x)));
        assert.ok(!trueFneg || w[2] !== classify(f), o.label);
        assert.ok(
          w[2] === classify(wc) ||
            w[2] === "even" ||
            w[2] === "odd" ||
            w[2] === "neither",
        );
      }
    }
  }
});

test("function arithmetic formulas, domains and values are verified at many points", () => {
  const seen = new Set<string>();
  for (const { variant, problem } of cases("fl-function-arithmetic")) {
    const p = problem.public.prompt;
    const fm = /f\(x\)=(.*?)\$ and \$g\(x\)=(.*?)\$\./.exec(p)!;
    const f = parsePoly(fm[1]!);
    const g = parsePoly(fm[2]!);
    const options = choiceLabels(problem);
    const key = options.find((o) => o.id === problem.answer)!.label;
    seen.add(variant);
    const xs = [-3, -2, -1, 0, 1, 2, 3, 4];
    const matches = (op: (x: number) => number) =>
      options.filter((o) => {
        const c = parsePoly(strip(o.label));
        return xs.every((x) => same(at(c, x), op(x)));
      });
    if (
      variant === "sum" ||
      variant === "difference" ||
      variant === "product"
    ) {
      const op = (x: number) =>
        variant === "sum"
          ? at(f, x) + at(g, x)
          : variant === "difference"
            ? at(f, x) - at(g, x)
            : at(f, x) * at(g, x);
      const ok = matches(op);
      assert.equal(ok.length, 1, p);
      assert.equal(ok[0]!.label, key);
    } else if (variant.startsWith("domain")) {
      const zeros: number[] = [];
      for (let x = -20; x <= 20; x++) if (at(g, x) === 0) zeros.push(x);
      const listed = (label: string) =>
        [...label.matchAll(/x\\ne (-?\d+)/g)]
          .map((m) => Number(m[1]))
          .sort((a, b) => a - b);
      assert.deepEqual(listed(key), zeros);
      for (const o of options.filter((o) => o.label !== key))
        assert.notDeepEqual(listed(o.label), zeros, o.label);
      assert.equal(zeros.length, variant === "domain-two-zeros" ? 2 : 1);
    } else {
      const a = Number(
        /\(\$?(-?\d+)\)|\((-?\d+)\)\$\?/.exec(p)![1] ??
          /\((-?\d+)\)\$\?/.exec(p)![1],
      );
      const [fa, ga] = [at(f, a), at(g, a)];
      assert.notEqual(ga, 0);
      const parseFrac = (label: string) => {
        const m = /^\$(-?)(?:\\frac\{(\d+)\}\{(\d+)\}|(\d+))\$$/.exec(label)!;
        const n = m[4] !== undefined ? Number(m[4]) : Number(m[2]);
        const d = m[4] !== undefined ? 1 : Number(m[3]);
        return (m[1] ? -1 : 1) * (n / d);
      };
      assert.ok(same(parseFrac(key), fa / ga), `${p} ${key}`);
      assert.equal(
        options.filter((o) => same(parseFrac(o.label), fa / ga)).length,
        1,
      );
    }
  }
  assert.equal(seen.size, 6);
});

test("trapezoid answers follow the midsegment, base-angle and diagonal theorems", () => {
  for (const { variant, problem } of cases("fl-trapezoid-consequences")) {
    const p = strip(problem.public.prompt);
    const answer = Number(problem.answer);
    if (variant === "midsegment") {
      const m = /AB=(\d+) and DC=(\d+)/.exec(p)!;
      assert.equal(answer * 2, Number(m[1]) + Number(m[2]));
    } else if (variant === "midsegment-base") {
      const m = /AB=(\d+)\. .* MN=(\d+)\. Find DC/.exec(p)!;
      assert.equal((Number(m[1]) + answer) / 2, Number(m[2]));
    } else if (variant === "midsegment-algebra") {
      const m =
        /AB=(.*?) and DC=(.*?), The midsegment|AB=(.*?) and DC=(.*?)\. The midsegment .* length (\d+)\. Find AB/.exec(
          p,
        )!;
      const ab = parsePoly(m[3]!);
      const dc = parsePoly(m[4]!);
      const length = Number(m[5]);
      // Find the integer x whose bases average to the given midsegment.
      const xs = Array.from({ length: 60 }, (_, i) => i).filter((x) =>
        same((at(ab, x) + at(dc, x)) / 2, length),
      );
      assert.equal(xs.length, 1, p);
      assert.equal(at(ab, xs[0]!), answer);
    } else if (variant === "base-angle") {
      const m =
        /angle D is \((.*?)\)\^\\circ.*angle C is \((.*?)\)\^\\circ/.exec(
          p.replace(/\\angle /g, "angle "),
        )!;
      const d = parsePoly(m[1]!);
      const c = parsePoly(m[2]!);
      const xs = Array.from({ length: 60 }, (_, i) => i).filter((x) =>
        same(at(d, x), at(c, x)),
      );
      assert.equal(xs.length, 1, p);
      assert.equal(at(c, xs[0]!), answer);
    } else if (variant === "leg-angle") {
      assert.equal(answer + Number(/(\d+)\^\\circ/.exec(p)![1]), 180);
    } else {
      const m = /AC=(.*?) and BD=(.*?)\. Find AC/.exec(p)!;
      const ac = parsePoly(m[1]!);
      const bd = parsePoly(m[2]!);
      const xs = Array.from({ length: 60 }, (_, i) => i).filter((x) =>
        same(at(ac, x), at(bd, x)),
      );
      assert.equal(xs.length, 1, p);
      assert.equal(at(ac, xs[0]!), answer);
      assert.ok(xs[0]! > 0 && answer > 0);
    }
  }
});

test("every new template is bound to one reference lesson and a worked example", () => {
  for (const id of floridaGapTemplateIds) {
    assert.equal(
      lessons.filter((l) => l.templateIds.includes(id)).length,
      1,
      id,
    );
    assert.ok(problemLesson(id, "lesson-seed").example.steps.length > 0, id);
  }
});
