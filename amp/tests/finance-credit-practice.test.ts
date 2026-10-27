import test from "node:test";
import assert from "node:assert/strict";
import {
  compoundBalances,
  financeCreditTemplates,
  interestCompareYearsCase,
  loanTotalCostCase,
  loanCompareOptionsCase,
  creditCardBalanceCase,
  creditCostConceptsCase,
  savingsPlanGrowthCase,
  interestTableTypeCase,
  type FinanceCase,
} from "../src/math/finance-credit-practice";
import { generateProblem, templates } from "../src/math/engine";
import { problemLesson } from "../src/content/problem-lessons";

const families: [string, (seed: string) => FinanceCase, string[]][] = [
  [
    "interest-compare-years",
    interestCompareYearsCase,
    ["gap", "which-larger", "table", "year-two"],
  ],
  [
    "loan-total-cost",
    loanTotalCostCase,
    [
      "total-repaid",
      "finance-charge",
      "term-effect",
      "rate-effect",
      "unknown-payment",
      "years-term",
    ],
  ],
  [
    "loan-compare-options",
    loanCompareOptionsCase,
    ["cheaper-total", "fee", "payment-vs-total"],
  ],
  [
    "credit-card-balance",
    creditCardBalanceCase,
    [
      "first-charge",
      "new-balance",
      "two-months",
      "payment-split",
      "total-interest-3",
      "pay-more",
    ],
  ],
  [
    "credit-cost-concepts",
    creditCostConceptsCase,
    [
      "apr-from-monthly",
      "monthly-from-apr",
      "carry-vs-full",
      "two-cards",
      "credit-vs-debit",
      "statement",
    ],
  ],
  [
    "savings-plan-growth",
    savingsPlanGrowthCase,
    [
      "balance-after",
      "months-to-goal",
      "deposit-needed",
      "equal-month",
      "who-leads",
      "table-extend",
    ],
  ],
  [
    "interest-table-type",
    interestTableTypeCase,
    ["identify-extend", "interest-in-year"],
  ],
];

test("finance families: deterministic, every variant reachable, one exact choice, no leakage", () => {
  for (const [id, make, variants] of families) {
    const seen = new Set<string>();
    for (let seed = 0; seed < 400; seed++) {
      const a = make(`s${seed}`);
      const b = make(`s${seed}`);
      assert.deepEqual(a, b);
      seen.add(a.variant);
      const g = generateProblem(id, `s${seed}`);
      assert.equal(g.public.prompt, a.problem.public.prompt);
      assert.equal(g.answer, a.problem.answer);
      const resp = g.public.response;
      assert.equal(resp.kind, "choice");
      if (resp.kind !== "choice") continue;
      const labels = resp.options.map((o) => o.label);
      assert.equal(labels.length, 4);
      assert.equal(new Set(labels).size, 4);
      const correct = resp.options.filter((o) => o.id === g.answer);
      assert.equal(correct.length, 1);
      const esc = correct[0]!.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const leaks = (text: string) =>
        new RegExp(`(?<![\\d.,])${esc}`).test(text);
      assert.ok(!leaks(g.hint), `${id} hint leaks`);
      assert.ok(
        !leaks(g.public.prompt) || id === "credit-cost-concepts",
        `${id} prompt leaks ${correct[0]!.label}`,
      );
      assert.ok(g.explanation.length >= 2);
    }
    assert.deepEqual([...seen].sort(), [...variants].sort(), id);
  }
});

test("independent re-derivation of cent-exact results", () => {
  const round = (num: bigint, den: bigint) => (2n * num + den) / (2n * den);
  for (let seed = 0; seed < 400; seed++) {
    const c = interestCompareYearsCase(`d${seed}`);
    if (c.variant === "gap") {
      const { P, pct, t } = c.given as Record<string, number>;
      let bal = BigInt(P! * 100);
      for (let y = 0; y < t!; y++) bal += round(bal * BigInt(pct!), 100n);
      const simple = (BigInt(P! * 100) * (100n + BigInt(pct! * t!))) / 100n;
      assert.equal(BigInt(c.value), bal - simple);
    }
    if (c.variant === "year-two") {
      const { P, pct } = c.given as Record<string, number>;
      const b1 = (BigInt(P! * 100) * (100n + BigInt(pct!))) / 100n;
      const i2 = round(b1 * BigInt(pct!), 100n);
      assert.equal(BigInt(c.value), i2 - BigInt(P! * pct!));
    }
    const k = creditCardBalanceCase(`d${seed}`);
    if (k.variant === "new-balance") {
      const { B, apr, p } = k.given as Record<string, number>;
      const i = round(BigInt(B!) * BigInt((apr! * 100) / 12), 10000n);
      assert.equal(BigInt(k.value), BigInt(B!) + i - BigInt(p! * 100));
      // No half-cent tie in the interest step.
      assert.notEqual(
        (2n * BigInt(B!) * BigInt((apr! * 100) / 12)) % 20000n,
        10000n,
      );
    }
    if (k.variant === "two-months") {
      const { B, apr, p } = k.given as Record<string, number>;
      let bal = BigInt(B!);
      for (let m = 0; m < 2; m++)
        bal =
          bal +
          round(bal * BigInt((apr! * 100) / 12), 10000n) -
          BigInt(p! * 100);
      assert.equal(BigInt(k.value), bal);
    }
    const l = loanTotalCostCase(`d${seed}`);
    if (l.variant === "finance-charge") {
      const { P, n, p } = l.given as Record<string, number>;
      assert.equal(l.value, (p! * n! - P!) * 100);
    }
    const s = savingsPlanGrowthCase(`d${seed}`);
    if (s.variant === "months-to-goal") {
      const { S, d, G } = s.given as Record<string, number>;
      let months = 0;
      while (S! + d! * months < G!) months++;
      assert.equal(s.value, months);
    }
    if (s.variant === "equal-month") {
      const { SA, dA, SB, dB } = s.given as Record<string, number>;
      assert.equal(SA! + dA! * s.value, SB! + dB! * s.value);
    }
  }
  assert.equal(compoundBalances(100000, 4, 3)![3], 112486);
});

test("finance families bind to existing skills and lessons", () => {
  const skills: Record<string, string> = {
    "interest-compare-years": "exponential-models",
    "loan-total-cost": "linear-models",
    "loan-compare-options": "linear-models",
    "credit-card-balance": "percent-change",
    "credit-cost-concepts": "percent-change",
    "savings-plan-growth": "linear-models",
    "interest-table-type": "percent-change",
  };
  assert.equal(financeCreditTemplates.length, 7);
  for (const [id, skill] of Object.entries(skills)) {
    assert.equal(templates.find((t) => t.id === id)?.skillId, skill);
    const lesson = problemLesson(id, "library");
    assert.ok(lesson.intuition && lesson.principle && lesson.watch);
    assert.ok(lesson.method.length >= 3);
    assert.ok(lesson.example.steps.length >= 3);
  }
});
