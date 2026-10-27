import test from "node:test";
import assert from "node:assert/strict";
import { generateProblem, gradeAnswer, templates } from "../src/math/engine";
import { methods } from "../src/content/problem-methods";
import { principles } from "../src/content/problem-principles";
import { lessons } from "../src/content/lessons";
import { actualFacetMappings } from "../src/content/facet-mappings";
import {
  percentChain,
  percentChainTemplates,
} from "../src/math/percent-chain-practice";
import {
  shareRemainderFractions,
  shareRemainderPercent,
} from "../src/math/share-remainder-practice";
import {
  walletPurchase,
  mixedQuantityDiscount,
} from "../src/math/purchase-chain-practice";
import { conversionChain } from "../src/math/conversion-chain-practice";
import { feePlan, feeRule, feeBudget } from "../src/math/fee-chain-practice";
import { heightModelChain } from "../src/math/height-model-chain-practice";
import { countRelation } from "../src/math/count-relation-practice";
import { similarSolidChain } from "../src/math/similar-solid-chain-practice";
import { perimeterAreaChain } from "../src/math/perimeter-area-chain-practice";
import {
  linkedDivision,
  linkedTime,
} from "../src/math/linked-equation-practice";
import {
  bagTotals,
  fractionTotalMinusParts,
} from "../src/math/total-minus-parts-practice";
import { enumerateAxes } from "../src/math/variation/axes";

const SEEDS = 400;
const ids = [
  "percent-chain",
  "share-remainder-fractions",
  "share-remainder-percent",
  "wallet-purchase-chain",
  "mixed-quantity-discount",
  "conversion-chain-story",
  "fee-plan-chain",
  "fee-rule-choice",
  "fee-budget-inequality",
  "quadratic-model-chain",
  "count-relation-chain",
  "similar-solid-scale-chain",
  "perimeter-area-chain",
  "linked-division-equations",
  "linked-time-equations",
  "bag-totals-chain",
  "fraction-total-minus-parts",
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Gen = {
  family: { axes: any };
  generate: (
    seed: string,
    force?: any,
  ) => { model: any; axes: any; problem: ReturnType<typeof generateProblem> };
};
const gens: Record<string, Gen> = {
  "percent-chain": percentChain,
  "share-remainder-fractions": shareRemainderFractions,
  "share-remainder-percent": shareRemainderPercent,
  "wallet-purchase-chain": walletPurchase,
  "mixed-quantity-discount": mixedQuantityDiscount,
  "conversion-chain-story": conversionChain,
  "fee-plan-chain": feePlan,
  "fee-rule-choice": feeRule,
  "fee-budget-inequality": feeBudget,
  "quadratic-model-chain": heightModelChain,
  "count-relation-chain": countRelation,
  "similar-solid-scale-chain": similarSolidChain,
  "perimeter-area-chain": perimeterAreaChain,
  "linked-division-equations": linkedDivision,
  "linked-time-equations": linkedTime,
  "bag-totals-chain": bagTotals,
  "fraction-total-minus-parts": fractionTotalMinusParts,
} as unknown as Record<string, Gen>;

const cache = new Map<string, ReturnType<Gen["generate"]>[]>();
const cases = (id: string) => {
  if (!cache.has(id))
    cache.set(
      id,
      Array.from({ length: SEEDS }, (_, i) => gens[id]!.generate(`mc:${i}`)),
    );
  return cache.get(id)!;
};
const value = (answer: string) => {
  const [n, d] = answer.split("/");
  return d ? Number(n) / Number(d) : Number(answer);
};
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;

test("every chain template is registered with lesson, method, principle and facet", () => {
  for (const id of ids) {
    assert.ok(
      templates.some((t) => t.id === id),
      id,
    );
    assert.ok(methods[id]?.watch, `${id} method`);
    assert.ok(principles[id], `${id} principle`);
    assert.ok(
      actualFacetMappings.some(
        (f) => f.templateId === id && f.extent === "partial",
      ),
      `${id} facet`,
    );
    assert.equal(
      lessons.filter((l) => l.templateIds.includes(id)).length,
      1,
      `${id} lesson`,
    );
  }
  assert.equal(percentChainTemplates.length, 1);
});

test("generation is deterministic, reaches the engine and every axis value and variant", () => {
  for (const id of ids) {
    const g = gens[id]!;
    const reached = new Map<string, Set<string>>();
    const variants = new Set<string>();
    for (const [i, c] of cases(id).entries()) {
      const again = generateProblem(id, `mc:${i}`);
      assert.deepEqual(again, c.problem, `${id} deterministic`);
      assert.equal(c.problem.public.templateId, id);
      variants.add(c.problem.variant!.id);
      for (const [axis, v] of Object.entries(c.problem.variant!.axes ?? {}))
        (reached.get(axis) ?? reached.set(axis, new Set()).get(axis)!).add(v);
    }
    for (const [axis, def] of Object.entries<{ values: string[] }>(
      g.family.axes,
    ))
      assert.deepEqual(
        [...(reached.get(axis) ?? [])].sort(),
        [...def.values].sort(),
        `${id} axis ${axis}`,
      );
    assert.ok(
      variants.size >= 2 ||
        id === "linked-time-equations" ||
        id === "percent-chain",
      `${id} variants ${[...variants]}`,
    );
    assert.ok(enumerateAxes(g.family.axes).length >= 2);
  }
});

test("the keyed answer is the only accepted answer and choices are well formed", () => {
  for (const id of ids)
    for (const c of cases(id)) {
      const p = c.problem;
      assert.ok(gradeAnswer(p, p.answer), id);
      const r = p.public.response;
      if (r.kind === "choice") {
        assert.equal(r.options.length, 4, id);
        assert.equal(
          new Set(r.options.map((o) => o.label)).size,
          4,
          `${id} distinct`,
        );
        assert.ok(r.options.some((o) => o.id === p.answer));
        const wrong = r.options.filter((o) => o.id !== p.answer);
        for (const o of wrong)
          assert.ok(p.choiceFeedback?.[o.id]?.length, `${id} feedback`);
        const label = r.options.find((o) => o.id === p.answer)!.label;
        assert.ok(!p.public.prompt.includes(label), `${id} prompt leaks`);
        assert.ok(!p.hint.includes(label), `${id} hint leaks`);
      }
      assert.ok(p.explanation.length >= 2, id);
    }
});

test("hints vary across seeds and prompts avoid dollar signs outside math", () => {
  for (const id of ids) {
    assert.ok(
      new Set(cases(id).map((c) => c.problem.hint)).size > 20,
      `${id} hints`,
    );
    for (const c of cases(id))
      for (const text of [c.problem.public.prompt, c.problem.hint])
        assert.ok(
          !/\$\d/.test(text) || /^\$/.test(text.match(/\$\d.*/)?.[0] ?? ""),
          `${id}: ${text}`,
        );
  }
});

/* ------------------------------------------------ independent oracles */
test("percent-chain: answers match independent derivations", () => {
  for (const { model: m, problem } of cases("percent-chain")) {
    const a = value(problem.answer);
    if (m.ask === "original-cost") {
      // Search the original price by forward simulation.
      const found: number[] = [];
      for (let o = 1; o <= 30000; o++) {
        const sale = (o * (100 - m.first)) / 100;
        const end = (sale * (100 + m.second)) / 100;
        if (end === m.end) found.push(o);
      }
      assert.deepEqual(found, [a]);
    } else if (m.ask === "earlier-cost") {
      const found: number[] = [];
      for (let c = 1; c <= 30000; c++)
        if ((c * (100 + m.second)) / 100 === (m.end * (100 - m.first)) / 100)
          found.push(c);
      assert.deepEqual(found, [a]);
    } else if (m.ask === "overall-multiplier") {
      assert.ok(close(a, (1 + m.first / 100) * (1 + m.second / 100)));
    } else {
      assert.equal(
        Math.round(m.start * (1 + m.first / 100) * (1 - m.second / 100)),
        a,
      );
    }
  }
});

test("share-remainder: remainders, differences and totals", () => {
  for (const { model: m, problem } of cases("share-remainder-fractions")) {
    const a = value(problem.answer);
    if (m.ask === "remaining-part")
      assert.ok(
        close(a, Math.round(m.whole * (1 - m.k1 / m.d1 - m.k2 / m.d2))),
      );
    else assert.ok(close(a, Math.round((m.whole * m.k1 * m.count) / m.d1)));
    assert.ok(Number.isInteger(a) && a > 0);
  }
  for (const { model: m, problem } of cases("share-remainder-percent")) {
    const [p1, p2, p3, p4] = m.shares as number[];
    assert.equal(p1! + p2! + p3! + p4!, 100);
    const a = value(problem.answer);
    const expected =
      m.ask === "remaining-share"
        ? (m.total * (100 - p1! - p2! - p3!)) / 100
        : (m.total * (p1! - p4!)) / 100;
    assert.ok(close(a, expected) && a > 0);
  }
});

test("purchase chains: cents arithmetic", () => {
  for (const { model: m, problem } of cases("wallet-purchase-chain")) {
    const a = value(problem.answer);
    if (m.setup === "prices-then-coupon")
      assert.ok(close(a, (m.first + m.second - m.third) / 100));
    else {
      const wallet =
        500 * m.fives +
        100 * m.ones +
        25 * m.quarters +
        10 * m.dimes +
        5 * m.nickels;
      assert.equal(wallet, m.first);
      assert.ok(close(a, (wallet - m.third) / 100) && a > 0);
    }
  }
  for (const { model: m, problem } of cases("mixed-quantity-discount")) {
    const quantity = m.whole + m.quarters / 4;
    const before = (quantity * m.cents) / 100;
    assert.ok(
      close(value(problem.answer), before * (1 - m.discount.n / m.discount.d)),
    );
    assert.ok(
      Number.isInteger(Math.round(value(problem.answer) * 100 * 1e6) / 1e6),
    );
  }
});

test("conversion-chain-story: chained factors and whole pieces", () => {
  for (const { model: m, problem } of cases("conversion-chain-story")) {
    const units = m.quarters / 4;
    const a = value(problem.answer);
    if (m.kind === "capacity-chart")
      assert.equal(a, m.target === "pints" ? units * 8 : units * 16);
    else if (m.kind === "length-recalled")
      assert.equal(a, units * 5.5 * 3 * 12);
    else {
      assert.equal(a, Math.floor((units * 100) / m.piece));
      assert.ok((units * 100) % m.piece !== 0);
    }
  }
});

test("fee chains: plans, rules and budgets", () => {
  for (const { model: m, problem } of cases("fee-plan-chain")) {
    const a = value(problem.answer);
    if (m.kind === "extra-rate") {
      const rates: number[] = [];
      for (let r = 1; r <= 5000; r++)
        if (m.flat + r * (m.booked - m.allowance) === m.total) rates.push(r);
      assert.equal(rates.length, 1);
      assert.ok(close(a, (m.flat + rates[0]! * (m.next - m.allowance)) / 100));
    } else if (m.kind === "compare-plans") {
      const t = (p: number[]) => m.months * p[0]! + p[1]! * p[2]!;
      assert.ok(t(m.b) > t(m.a));
      assert.ok(close(a, (t(m.b) - t(m.a)) / 100));
    } else assert.ok(close(a, ((m.start - m.end) * m.per) / 10));
  }
  // Evaluate each displayed rule at several hours.
  const evaluate = (label: string, h: number) =>
    Function(
      "h",
      `return ${label
        .replace(/\$/g, "")
        .replace(/^C=/, "")
        .replace(/(\d)\(/g, "$1*(")
        .replace(/(\d)h/g, "$1*h")}`,
    )(h);
  for (const { model: m, problem } of cases("fee-rule-choice")) {
    const r = problem.public.response;
    assert.equal(r.kind, "choice");
    if (r.kind !== "choice") continue;
    const truth = (h: number) => m.flat + m.rate * (h - m.allowance);
    const matching = r.options.filter((o) =>
      [0, 1, 2, 3, 5].every(
        (k) => evaluate(o.label, m.allowance + k) === truth(m.allowance + k),
      ),
    );
    assert.equal(matching.length, 1);
    assert.equal(matching[0]!.id, problem.answer);
    if (m.kind === "recovered-rate")
      assert.ok(
        Number.isInteger(m.rate) &&
          m.total === m.flat + m.rate * (m.booked - m.allowance),
      );
  }
  const truthSet = (label: string) =>
    Array.from({ length: 41 }, (_, x) => x).filter((x) =>
      Function(
        "x",
        `return ${label.replace(/\$/g, "").replace(/\\le/g, "<=").replace(/\\ge/g, ">=").replace(/\\lt/g, "<").replace(/\\gt/g, ">").replace(/(\d)x/g, "$1*x")}`,
      )(x),
    );
  for (const { model: m, axes, problem } of cases("fee-budget-inequality")) {
    const r = problem.public.response;
    if (r.kind !== "choice") throw new Error("choice");
    const budget = m.fee + m.rate * m.limit;
    const expected = Array.from({ length: 41 }, (_, x) => x).filter((x) =>
      axes.bound === "under"
        ? m.fee + m.rate * x < budget
        : m.fee + m.rate * x <= budget,
    );
    const matching = r.options.filter(
      (o) => JSON.stringify(truthSet(o.label)) === JSON.stringify(expected),
    );
    assert.equal(matching.length, 1, problem.public.prompt);
    assert.equal(matching[0]!.id, problem.answer);
  }
});

test("quadratic-model-chain: landing time and rounded height", () => {
  for (const { model: m, problem } of cases("quadratic-model-chain")) {
    const a = value(problem.answer);
    if (m.kind === "drop-landing") {
      const c = m.coefficient * m.time * m.time;
      let first = -1;
      for (let t = 1; t < 60 && first < 0; t++)
        if (c - m.coefficient * t * t <= 0) first = t;
      assert.equal(a, first);
      assert.equal(c - m.coefficient * a * a, 0);
    } else {
      const slope = -m.peak / (m.halfWidth * m.halfWidth);
      const y = slope * m.offset * m.offset + m.peak;
      assert.ok(close(a, Math.round(y * 10) / 10), `${a} vs ${y}`);
      assert.ok(Math.abs(y * 10 - Math.floor(y * 10) - 0.5) > 1e-6);
    }
  }
});

test("count-relation-chain: brute-force the counts", () => {
  for (const { model: m, axes, problem } of cases("count-relation-chain")) {
    const a = value(problem.answer);
    if (m.kind === "times-as-many") {
      const xs = Array.from({ length: 300 }, (_, i) => i + 1).filter(
        (x) => m.a * x - x === (m.a - 1) * m.first,
      );
      assert.deepEqual(xs, [m.first]);
      const expected = {
        target: m.first,
        partner: m.a * m.first,
        combined: (m.a + 1) * m.first,
      }[axes.ask as "target"];
      assert.equal(a, expected);
    } else {
      const value2 = m.a * m.first + m.b * m.second;
      const pairs: number[][] = [];
      for (let p = 0; p <= 60; p++)
        for (let q = 0; q <= 60; q++)
          if (
            m.a * p + m.b * q === value2 &&
            (axes.ask === "partner" ? q === m.second : p === m.first)
          )
            pairs.push([p, q]);
      assert.equal(pairs.length, 1);
      const [p, q] = pairs[0]!;
      assert.equal(
        a,
        axes.ask === "target" ? q : axes.ask === "partner" ? p : p! + q!,
      );
    }
  }
});

test("similar-solid-scale-chain: scale from the ratio of areas", () => {
  for (const { model: m, axes, problem } of cases(
    "similar-solid-scale-chain",
  )) {
    const a = value(problem.answer);
    const sa = [m.areaUnit * m.small ** 2, m.areaUnit * m.large ** 2];
    const k = Math.sqrt(sa[1]! / sa[0]!);
    assert.ok(close(k, m.large / m.small));
    const v = [m.volumeUnit * m.small ** 3, m.volumeUnit * m.large ** 3];
    assert.ok(close(v[1]! / v[0]!, k ** 3));
    const expected =
      axes.ask === "total-volume"
        ? v[0]! + v[1]!
        : axes.ask === "other-volume"
          ? v[m.knownLarge ? 0 : 1]!
          : sa[m.knownLarge ? 0 : 1]!;
    assert.equal(a, expected);
  }
});

test("perimeter-area-chain: search the side lengths", () => {
  for (const { model: m, axes, problem } of cases("perimeter-area-chain")) {
    const a = value(problem.answer);
    const text = problem.public.prompt;
    const given = Number(text.match(/(?:perimeter|area) of (\d+)/)![1]);
    const side = Number(text.match(/width of (\d+)/)?.[1] ?? 0);
    const found: number[] = [];
    for (let l = 1; l <= 80; l++) {
      if (m.shape === "square") {
        if (axes.given === "perimeter" ? 4 * l === given : l * l === given)
          found.push(axes.given === "perimeter" ? l * l : 4 * l);
      } else if (
        axes.given === "perimeter"
          ? 2 * (l + side) === given
          : l * side === given
      )
        found.push(axes.given === "perimeter" ? l * side : 2 * (l + side));
    }
    assert.deepEqual(found, [a], text);
  }
});

test("linked equations: exactly one option evaluates to the story's value", () => {
  const evalStep = (expr: string, scope: Record<string, number> = {}) =>
    Function(
      ...Object.keys(scope),
      `return ${expr.replace(/\\div/g, "/").replace(/\\times/g, "*")}`,
    )(...Object.values(scope));
  const resultOf = (label: string) => {
    const parts = label.split(" and ").map((s) => s.replace(/\$/g, ""));
    if (parts.length === 1) return evalStep(parts[0]!.split("=")[0]!);
    const scope: Record<string, number> = {};
    let last = NaN;
    for (const p of parts) {
      const [lhsRaw, name] = p.split("=");
      const lhs = lhsRaw!.replace(/\\div/g, "/").replace(/\\times/g, "*");
      const names = Object.keys(scope);
      const expr = names.length
        ? lhs.replace(
            new RegExp(`\\b${names[0]!}\\b`, "g"),
            String(scope[names[0]!]),
          )
        : lhs;
      last = evalStep(expr);
      scope[name!] = last;
    }
    return last;
  };
  for (const id of [
    "linked-division-equations",
    "linked-time-equations",
  ] as const)
    for (const { problem } of cases(id)) {
      const r = problem.public.response;
      if (r.kind !== "choice") throw new Error("choice");
      const keyed = r.options.find((o) => o.id === problem.answer)!;
      const target = resultOf(keyed.label);
      const matching = r.options.filter((o) => resultOf(o.label) === target);
      assert.equal(
        matching.length,
        1,
        `${id}: ${r.options.map((o) => o.label).join(" | ")}`,
      );
      assert.ok(Number.isInteger(target) && target > 0);
      // The keyed value appears in the explanation.
      assert.ok(problem.explanation.join(" ").includes(String(target)));
    }
});

test("total-minus-parts: whole numbers and exact fractions", () => {
  for (const { model: m, axes, problem } of cases("bag-totals-chain")) {
    const a = value(problem.answer);
    assert.equal(
      a,
      axes.shape === "add-then-subtract"
        ? m.a + m.b - m.c
        : m.total - (m.a + m.b),
    );
    assert.ok(a > 0 && a < 1000);
  }
  for (const { model: m, problem } of cases("fraction-total-minus-parts")) {
    const a = value(problem.answer);
    if (m.mixed) assert.ok(close(a, (m.total - m.a - m.b) / 16));
    else assert.ok(close(a, (m.total - m.a - m.b) / 100));
    assert.ok(a > 0);
  }
});
