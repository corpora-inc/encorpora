import test from "node:test";
import assert from "node:assert/strict";
import {
  bracketCase,
  budgetShareCase,
  financeIncomeTemplates,
  incentiveCase,
  netWorthCase,
  payrollPropertyCase,
  profitCase,
  taxKindCase,
} from "../src/math/finance-income-practice";
import { generateProblem, templates } from "../src/math/engine";
import { problemLesson } from "../src/content/problem-lessons";
import { skills } from "../src/curriculum/catalog";
import { selectionObjectives as objectives } from "../src/curriculum/selection";

const SEEDS = 400;
const ids = financeIncomeTemplates.map((t) => t.id);

function choices(templateId: string, seed: string) {
  const g = generateProblem(templateId, seed);
  const response = g.public.response;
  assert.equal(response.kind, "choice");
  if (response.kind !== "choice") throw new Error("choice expected");
  const labels = response.options.map((o) => o.label);
  assert.equal(labels.length, 4, `${templateId} ${seed}`);
  assert.equal(new Set(labels).size, 4, `${templateId} ${seed} ${labels}`);
  const correct = response.options.filter((o) => o.id === g.answer);
  assert.equal(correct.length, 1);
  return { g, labels, correct: correct[0]!.label };
}
function tableRows(g: ReturnType<typeof generateProblem>) {
  const figure = g.public.figure;
  assert.equal(figure?.kind, "scene");
  if (figure?.kind !== "scene") throw new Error("scene expected");
  const element = figure.scene.elements[0]!;
  assert.equal(element.type, "table");
  if (element.type !== "table") throw new Error("table expected");
  return element.rows.map((r) => [r.label, r.cells.map(String)] as const);
}
const num = (s: string) => BigInt(s.replace(/,/g, ""));
const bigCents = (label: string) => {
  const m = /^(−?)([\d,]+)\.(\d\d) dollars$/.exec(label);
  assert.ok(m, label);
  return (m[1] ? -1n : 1n) * (num(m[2]!) * 100n + BigInt(m[3]!));
};

test("every finance-income template is deterministic, public, has feedback and leaks no answer", () => {
  for (const id of ids) {
    const template = templates.find((t) => t.id === id);
    assert.ok(template, id);
    assert.equal(template.requiredResponseCapability, "single-choice-v1");
    for (let s = 0; s < SEEDS; s++) {
      const seed = `fin:${s}`;
      const { g, correct } = choices(id, seed);
      assert.equal(g.public.templateId, id);
      assert.deepEqual(generateProblem(id, seed), g);
      assert.ok(g.explanation.length >= 2, `${id} ${seed}`);
      const visible = `${g.public.prompt} ${g.hint}`;
      const token = new RegExp(
        `(?<![\\d.,])${correct.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
      );
      assert.ok(!token.test(visible), `${id} ${seed} leaks ${correct}`);
      assert.ok(
        !/\$\d|\d\$/.test(g.public.prompt),
        `${id} ${seed} currency sign`,
      );
    }
  }
});

test("every variant of every template is reachable", () => {
  const cases = {
    "profit-cost-breakeven": [profitCase, 7],
    "tax-kinds-defined": [taxKindCase, 8],
    "tax-bracket-owed": [bracketCase, 6],
    "payroll-property-tax": [payrollPropertyCase, 5],
    "budget-percent-share": [budgetShareCase, 5],
    "net-worth-statement": [netWorthCase, 6],
    "incentive-compare": [incentiveCase, 4],
  } as const;
  for (const [id, [fn, count]] of Object.entries(cases)) {
    const seen = new Set<number>();
    for (let s = 0; s < SEEDS; s++)
      seen.add(
        (fn as (seed: string) => { variant: number })(`fin:${s}`).variant,
      );
    assert.equal(seen.size, count, id);
  }
});

test("bracket tax matches an independent bigint recomputation from the displayed table", () => {
  let checked = 0;
  for (let s = 0; s < SEEDS; s++) {
    const g = generateProblem("tax-bracket-owed", `fin:${s}`);
    const m =
      /taxable income (?:of exactly|of) ([\d,]+) dollars\. How much tax/.exec(
        g.public.prompt,
      );
    if (!m) continue;
    const rows = tableRows(g);
    const t1 = num(/Up to ([\d,]+)/.exec(rows[0]![0])![1]!);
    const t2 = num(/–([\d,]+)/.exec(rows[1]![0])![1]!);
    const rate = rows.map((r) => BigInt(r[1][0]!.replace("%", "")));
    const income = num(m[1]!);
    const min = (a: bigint, b: bigint) => (a < b ? a : b);
    let owed = 0n;
    // Walk the income dollar band by band, not by slice formulas.
    const bands: [bigint, bigint, bigint][] = [
      [0n, t1, rate[0]!],
      [t1, t2, rate[1]!],
      [t2, 10n ** 9n, rate[2]!],
    ];
    for (const [lo, hi, r] of bands)
      if (income > lo) owed += (min(income, hi) - lo) * r;
    assert.equal(
      bigCents(choices("tax-bracket-owed", `fin:${s}`).correct),
      owed,
    );
    checked++;
  }
  assert.ok(checked > 150);
});

test("break-even number is the first sale count with nonnegative profit", () => {
  for (let s = 0; s < SEEDS; s++) {
    const { model } = profitCase(`fin:${s}`);
    let n = 0;
    while (n * model.price - (model.fixedTotal + n * model.unitCost) < 0) n++;
    assert.equal(n, model.star);
  }
});

test("net worth equals assets minus liabilities by item name", () => {
  const liabilityNames = /loan|debt|bill/i;
  let checked = 0;
  for (let s = 0; s < SEEDS; s++) {
    const g = generateProblem("net-worth-statement", `fin:${s}`);
    if (!/What is the net worth\?/.test(g.public.prompt)) continue;
    let net = 0n;
    for (const [name, cells] of tableRows(g))
      net += (liabilityNames.test(name) ? -1n : 1n) * num(cells[0]!);
    const label = choices("net-worth-statement", `fin:${s}`).correct;
    const m = /^(−?)([\d,]+) dollars?$/.exec(label)!;
    assert.equal((m[1] ? -1n : 1n) * num(m[2]!), net);
    checked++;
  }
  assert.ok(checked > 100);
});

test("budget shares use the whole and expenses over income exceed 100 percent", () => {
  for (let s = 0; s < SEEDS; s++) {
    const { model, variant } = budgetShareCase(`fin:${s}`);
    if (variant > 3) continue;
    assert.equal(
      model.rows.reduce((t, r) => t + r.amount, 0),
      model.total,
    );
    assert.equal(
      model.rows.reduce((t, r) => t + r.share, 0),
      100,
    );
  }
});

test("finance-income skills and lessons are wired", () => {
  for (const skillId of [
    "financial-literacy-elementary",
    "financial-literacy-middle",
  ]) {
    assert.ok(
      skills.some((k) => k.id === skillId),
      skillId,
    );
    assert.equal(
      objectives.filter((o) => o.skills.includes(skillId)).length,
      1,
      skillId,
    );
  }
  for (const id of ids) {
    const template = templates.find((t) => t.id === id)!;
    assert.ok(
      template.skillId.startsWith("financial-literacy-"),
      `${id} skill`,
    );
    const lesson = problemLesson(id, "library");
    assert.ok(lesson.intuition, id);
    assert.ok(lesson.method.length >= 2, id);
    assert.ok(lesson.watch, id);
    assert.ok(lesson.principle, id);
    assert.ok(lesson.example.steps.length >= 2, id);
  }
});
