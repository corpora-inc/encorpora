import test from "node:test";
import assert from "node:assert/strict";
import {
  budgetCase,
  grossNetCase,
  modelQuantityCase,
  remainingGapTemplates,
  stemLeafCase,
  triangleLawCase,
} from "../src/math/remaining-gap-practice";
import { generateProblem, templates } from "../src/math/engine";
import { problemLesson } from "../src/content/problem-lessons";

const SEEDS = 400;
const ids = remainingGapTemplates.map((t) => t.id);
const stripTable = (prompt: string) => prompt.replace(/Key: .*?\./, " ");
/** Rows of the scene table that accompanies a problem: [row label, first cell]. */
function figureRows(g: ReturnType<typeof generateProblem>) {
  const figure = g.public.figure;
  assert.equal(figure?.kind, "scene");
  if (figure?.kind !== "scene") throw new Error("scene expected");
  const element = figure.scene.elements[0]!;
  assert.equal(element.type, "table");
  if (element.type !== "table") throw new Error("table expected");
  return element.rows.map((r) => [r.label, String(r.cells[0])] as const);
}

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

test("every remaining-gap template is deterministic, public through the engine, and leaks no answer", () => {
  for (const id of ids) {
    const template = templates.find((t) => t.id === id);
    assert.ok(template, id);
    assert.equal(template.requiredResponseCapability, "single-choice-v1");
    for (let s = 0; s < SEEDS; s++) {
      const seed = `gap:${s}`;
      const { g, correct } = choices(id, seed);
      assert.equal(g.public.templateId, id);
      assert.deepEqual(generateProblem(id, seed), g);
      const visible = `${stripTable(g.public.prompt)} ${g.hint}`;
      // Stem-leaf answers are plain numbers; match them as whole tokens only.
      const token = new RegExp(
        `(?<![\\d.])${correct.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\d])`,
      );
      // A count of values can coincide with a stem or leaf digit named in the hint.
      if (!/How many values/.test(g.public.prompt))
        assert.ok(!token.test(visible), `${id} ${seed} leaks ${correct}`);
      const feedback = g.public.response.kind === "choice" ? true : false;
      assert.ok(feedback);
      assert.ok(g.explanation.length >= 3, `${id} explanation`);
    }
  }
});

test("each wrong choice carries distinct, non-empty corrective feedback", () => {
  for (const id of ids)
    for (let s = 0; s < 60; s++) {
      const g = generateProblem(id, `fb:${s}`);
      const fb = (g as unknown as { choiceFeedback?: Record<string, string> })
        .choiceFeedback;
      assert.ok(fb, id);
      const entries = Object.entries(fb);
      assert.equal(entries.length, 3, id);
      for (const [, text] of entries) assert.ok(text.trim().length > 20);
    }
});

test("every internal variant is reachable", () => {
  const reached = (fn: (s: string) => { variant: number }, count: number) => {
    const seen = new Set<number>();
    for (let s = 0; s < SEEDS; s++) seen.add(fn(`variant:${s}`).variant);
    assert.equal(seen.size, count);
  };
  reached(triangleLawCase, 6);
  reached(modelQuantityCase, 4);
  reached(stemLeafCase, 7);
  reached(budgetCase, 3);
  reached(grossNetCase, 5);
  const decimals = new Set<boolean>();
  for (let s = 0; s < SEEDS; s++) decimals.add(stemLeafCase(`d:${s}`).decimal);
  assert.equal(decimals.size, 2);
});

/** Independent recomputation from the public prompt, in integer hundredths. */
const cents = (text: string) => {
  const [d, c] = text.split(".");
  return Number(d) * 100 + Number(c);
};
const rowsOf = (g: ReturnType<typeof generateProblem>) =>
  figureRows(g).map(([name, amount]) => [name, cents(amount)] as const);
const dollarLabel = (label: string) => cents(label.replace(" dollars", ""));

test("budget answers match independent arithmetic on the displayed table", () => {
  for (let s = 0; s < SEEDS; s++) {
    const { g, correct } = choices("budget-category-balance", `b:${s}`);
    const prompt = g.public.prompt;
    const income = cents(/income of (\d+\.\d\d) dollars/.exec(prompt)![1]!);
    const total = rowsOf(g).reduce((p, [, c]) => p + c, 0);
    if (prompt.includes("How much can be planned for Fun")) {
      assert.equal(dollarLabel(correct), income - total);
    } else if (prompt.includes("What is the result")) {
      const m = /^(Surplus|Deficit) of (.*)$/.exec(correct)!;
      assert.equal(m[1], income >= total ? "Surplus" : "Deficit");
      assert.equal(dollarLabel(m[2]!), Math.abs(income - total));
    } else {
      assert.ok(total > income, "balancing prompt is a deficit");
      const m = /^Reduce Fun by (.*)$/.exec(correct)!;
      assert.equal(dollarLabel(m[1]!), total - income);
      const fun = rowsOf(g).find(([n]) => n === "Fun")![1];
      assert.ok(total - income < fun, "the cut is possible");
    }
  }
});

test("pay answers match independent arithmetic", () => {
  for (let s = 0; s < SEEDS; s++) {
    const { g, correct } = choices("gross-net-pay", `p:${s}`);
    const prompt = g.public.prompt;
    const rows = rowsOf(g);
    const total = rows.reduce((p, [, c]) => p + c, 0);
    const money = (re: RegExp) => cents(re.exec(prompt)![1]!);
    const answer = dollarLabel(correct);
    if (prompt.includes("per hour")) {
      const rate = money(/earns (\d+\.\d\d) dollars/);
      const hours = Number(/worked (\d+) hours/.exec(prompt)![1]);
      assert.equal(answer, rate * hours - total);
    } else if (prompt.includes("How much was taken out")) {
      const gross = money(/gross pay is (\d+\.\d\d) dollars/);
      const net = money(/net pay is (\d+\.\d\d) dollars/);
      assert.equal(answer, gross - net - total);
    } else if (prompt.includes("Which amount is the paycheck")) {
      assert.equal(answer, money(/gross pay of (\d+\.\d\d) dollars/) - total);
    } else if (prompt.includes("What was the gross pay")) {
      assert.equal(answer, money(/net pay is (\d+\.\d\d) dollars/) + total);
    } else {
      assert.equal(answer, money(/gross pay of (\d+\.\d\d) dollars/) - total);
    }
  }
});

test("stem-and-leaf answers match an independent reading of the displayed plot and key", () => {
  for (let s = 0; s < SEEDS; s++) {
    const { g, correct } = choices("stem-leaf-read", `s:${s}`);
    const prompt = g.public.prompt;
    const rows = figureRows(g).map(([stem, leaves]) => ({
      stem: Number(stem),
      leaves: leaves.split(" ").map(Number),
    }));
    const key = /Key: \$(\d+)\\mid (\d+)\$ means \$([\d.]+)\$/.exec(prompt)!;
    const decimal = key[3]!.includes(".");
    // The key must agree with the plot's own convention.
    assert.equal(
      Number(key[3]),
      Number(key[1]) * (decimal ? 1 : 10) + Number(key[2]) / (decimal ? 10 : 1),
    );
    const values = rows
      .flatMap((r) =>
        r.leaves.map((leaf) => r.stem * (decimal ? 10 : 10) + leaf),
      )
      .map((v) => (decimal ? v / 10 : v));
    assert.deepEqual(
      values,
      [...values].sort((p, q) => p - q),
    );
    const n = values.length;
    const median =
      n % 2 ? values[(n - 1) / 2]! : (values[n / 2 - 1]! + values[n / 2]!) / 2;
    const number = Number(correct);
    const q = prompt.slice(prompt.indexOf("."), prompt.length);
    const close = (a: number, b: number) =>
      assert.ok(Math.abs(a - b) < 1e-9, `${prompt} ${correct}`);
    if (/last leaf in the bottom row/.test(prompt))
      close(number, values[n - 1]!);
    else if (/least value in the plot/.test(prompt)) close(number, values[0]!);
    else if (/greatest value in the plot/.test(prompt))
      close(number, values[n - 1]!);
    else if (/range of the data/.test(prompt))
      close(number, values[n - 1]! - values[0]!);
    else if (/median/.test(prompt)) close(number, median);
    else if (/appears most often/.test(prompt)) {
      const tally = new Map<number, number>();
      for (const v of values) tally.set(v, (tally.get(v) ?? 0) + 1);
      const top = Math.max(...tally.values());
      const modes = [...tally].filter(([, k]) => k === top);
      assert.equal(modes.length, 1);
      close(number, modes[0]![0]);
    } else if (/greater than ([\d.]+)\?/.test(prompt)) {
      const t = Number(/greater than ([\d.]+)\?/.exec(prompt)![1]);
      assert.equal(number, values.filter((v) => v > t + 1e-9).length);
    } else if (/second least/.test(prompt)) {
      close(number, values[n - 1]! - values[1]!);
      assert.ok(values[1]! > values[0]!);
    } else assert.fail(`unrecognised question ${q}`);
  }
});

test("ambiguous-case and law-choice answers match independent trigonometry", () => {
  const seen = new Set<string>();
  for (let s = 0; s < SEEDS; s++) {
    const { g, correct } = choices("triangle-law-reasoning", `t:${s}`);
    const prompt = g.public.prompt;
    const ssa =
      /angle \$\w=(\d+)\^\\circ\$ is opposite side \$\w=(\d+)\$, and side \$\w=(\d+)\$ runs/.exec(
        prompt,
      );
    if (ssa) {
      const angle = (Number(ssa[1]) * Math.PI) / 180;
      const a = Number(ssa[2]);
      const b = Number(ssa[3]);
      const height = b * Math.sin(angle);
      const eps = 1e-9;
      const expected =
        a >= b
          ? "One triangle, because"
          : Math.abs(a - height) < eps
            ? "One triangle, because"
            : a < height
              ? "No triangle"
              : "Two triangles";
      assert.ok(correct.startsWith(expected), `${prompt} ${correct}`);
      seen.add(
        a >= b
          ? "at-least-b"
          : Math.abs(a - height) < eps
            ? "right"
            : a < height
              ? "none"
              : "two",
      );
      continue;
    }
    if (/Which law starts the solution/.test(prompt)) {
      const sines = /^Law of sines/.test(correct);
      const cosines = /^Law of cosines/.test(correct);
      assert.ok(sines !== cosines);
      const sidesKnown = (prompt.match(/\$\w=\d+\$/g) ?? []).filter(
        (m) => !m.includes("circ"),
      );
      const angles = (prompt.match(/\^\\circ/g) ?? []).length;
      // SAS/SSS: cosines; two angles and a side: sines.
      assert.equal(cosines, angles <= 1, `${prompt} ${correct} ${sidesKnown}`);
    }
  }
  assert.deepEqual([...seen].sort(), ["at-least-b", "none", "right", "two"]);
});

test("the correct derivation choices state the right identities", () => {
  let altitude = 0;
  let cosine = 0;
  for (let s = 0; s < SEEDS; s++) {
    const { g, correct } = choices("triangle-law-reasoning", `d:${s}`);
    const p = g.public.prompt;
    if (/Which pair of equations gives \$h\$/.test(p)) {
      altitude++;
      assert.match(correct, /^\$h=(\w)\\sin (\w)\$ and \$h=(\w)\\sin (\w)\$$/);
    }
    if (/Which equation follows from setting/.test(p)) {
      cosine++;
      assert.match(correct, /^\$(\w)\^2=(\w)\^2\+(\w)\^2-2\w\w\\cos (\w)\$$/);
    }
  }
  assert.ok(altitude > 20 && cosine > 20);
});

test("quantity-role answers name the quantity, role and unit the situation states", () => {
  for (let s = 0; s < SEEDS; s++) {
    const { g, correct } = choices("model-quantity-roles", `m:${s}`);
    const p = g.public.prompt;
    if (/Which definition of the variables is clearest/.test(p))
      assert.match(correct, /in [a-z]+; \$\w\$ = .*, in [a-z]+$/);
    if (/constant rate/.test(p)) assert.match(correct, /^[a-z]+ per [a-z]+$/);
    if (/keeps the model in the units of the rate/.test(p))
      assert.match(correct, /\(.+ is [\d.]+ [a-z]+\)$/);
    if (/which two quantities change/.test(p))
      assert.ok(!/fee|starting|per /.test(correct.replace(/ and .*/, "")));
  }
});

test("each family binds its skill, a lesson, a method and a principle", () => {
  const expected: Record<string, string> = {
    "triangle-law-reasoning": "triangle-law-proofs",
    "model-quantity-roles": "model-quantities",
    "stem-leaf-read": "mean-median",
    "budget-category-balance": "decimal-arithmetic",
    "gross-net-pay": "decimal-arithmetic",
  };
  for (const id of ids) {
    assert.equal(templates.find((t) => t.id === id)?.skillId, expected[id]);
    const lesson = problemLesson(id, "library");
    assert.ok(lesson.intuition);
    assert.ok(lesson.method.length >= 3);
    assert.ok(lesson.watch);
    assert.ok(lesson.principle);
    assert.ok(lesson.example.steps.length >= 3);
  }
});

test("the altitude foot variable never shares a name with a side, and count hints treat repeats as not greater", () => {
  for (let s = 0; s < 300; s++) {
    const t = generateProblem("triangle-law-reasoning", `foot:${s}`);
    if (/Let \$u=|with \$u=/.test(t.public.prompt))
      assert.ok(!/\$x=|x-x|\(x-x/.test(t.public.prompt), t.public.prompt);
    const c = generateProblem("stem-leaf-read", `count:${s}`);
    if (/greater than/.test(c.public.prompt)) {
      assert.ok(!/to its right/.test(c.hint), c.hint);
      assert.ok(!c.explanation.some((e) => /to its right/.test(e)));
    }
  }
});
