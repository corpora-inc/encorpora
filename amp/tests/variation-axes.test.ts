import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  axisRecord,
  chooseAxes,
  defineAxis,
  enumerateAxes,
  isLegacy,
  legacyAxes,
  restrictAxis,
  surfaceStream,
} from "../src/math/variation/axes";
import {
  defineVariedFamily,
  generateVaried,
  statementSurface,
} from "../src/math/variation/compose";
import {
  orientationAxis,
  resultFirstFlags,
  writeEquation,
} from "../src/math/variation/orientation";
import {
  answerFormatAxis,
  drawStatements,
  orientStatements,
  renderStatementSet,
  type Statement,
} from "../src/math/variation/statement-set";
import { factEquations, targetAxis } from "../src/math/variation/target";
import {
  approximate,
  ex,
  isRational,
  q,
  rationalStyles,
  rationalValue,
  tex,
  texValue,
  valueOf,
  writeRational,
} from "../src/math/variation/number-domain";
import { random } from "../src/math/distribution-practice";
import {
  generatedProblemSchema,
  type TemplateMetadata,
} from "../src/math/contracts";
import { generateProblem, gradeAnswer, templates } from "../src/math/engine";
import { parseSelection } from "../src/math/selection-response";
import { mcasVariedAxes } from "../src/math/mcas-gap-practice";
import { objectiveForSkill } from "../src/curriculum/selection";

const seeds = (n: number, prefix = "v") =>
  Array.from({ length: n }, (_, i) => `${prefix}:${i}`);

test("axes validate their ids, values, weights and legacy value", () => {
  assert.throws(() => defineAxis("Bad", ["a"]), /axis id/);
  assert.throws(() => defineAxis("x", []), /distinct/);
  assert.throws(() => defineAxis("x", ["a", "a"]), /distinct/);
  assert.throws(() => defineAxis("x", ["A"]), /Bad value/);
  assert.throws(() => defineAxis("x", ["a", "b"], { weights: [1] }), /weights/);
  assert.throws(
    () => defineAxis("x", ["a", "b"], { weights: [1, 0] }),
    /weights/,
  );
  assert.equal(defineAxis("x", ["a", "b"]).legacy, "a");
  assert.equal(defineAxis("x", ["a", "b"], { legacy: "b" }).legacy, "b");
  const r = restrictAxis(answerFormatAxis, ["select-all", "true-false-pair"]);
  assert.deepEqual(r.values, ["select-all", "true-false-pair"]);
  assert.equal(r.legacy, "select-all");
  assert.throws(() => restrictAxis(r, ["single-true" as never]), /no value/);
});

test("axis draws are deterministic, independent per axis and follow weights", () => {
  const a = defineAxis("alpha", ["p", "q", "r"]);
  const b = defineAxis("beta", ["s", "t"], { weights: [3, 1] });
  const both = { alpha: a, beta: b };
  const alone = { alpha: a };
  const counts = { s: 0, t: 0 };
  const seen = new Set<string>();
  for (const seed of seeds(800)) {
    const v = chooseAxes("tpl", seed, both);
    assert.deepEqual(v, chooseAxes("tpl", seed, both));
    // Adding an axis never changes the values other axes draw.
    assert.equal(v.alpha, chooseAxes("tpl", seed, alone).alpha);
    counts[v.beta]++;
    seen.add(v.alpha);
  }
  assert.deepEqual([...seen].sort(), ["p", "q", "r"]);
  assert.ok(counts.s > 2.3 * counts.t && counts.s < 3.9 * counts.t);
  assert.notDeepEqual(
    seeds(20).map((s) => chooseAxes("tpl", s, both)),
    seeds(20).map((s) => chooseAxes("other", s, both)),
  );
  assert.equal(enumerateAxes(both).length, 6);
  assert.deepEqual(legacyAxes(both), { alpha: "p", beta: "s" });
  assert.ok(isLegacy(both, { alpha: "p", beta: "s" }));
  assert.deepEqual(Object.keys(axisRecord({ z: "1", a: "2" })), ["a", "z"]);
  assert.throws(
    () => chooseAxes("tpl", "s", { wrong: a } as never),
    /key wrong/,
  );
});

test("orientation rewrites without changing an equation's truth", () => {
  const eq = { operation: "63\\div9", result: "7" };
  assert.equal(writeEquation(eq, false), "63\\div9=7");
  assert.equal(writeEquation(eq, true), "7=63\\div9");
  for (const seed of seeds(200)) {
    const s = surfaceStream("t", seed);
    for (const n of [2, 3, 6]) {
      assert.ok(!resultFirstFlags("operation-first", n, s).some(Boolean));
      assert.ok(resultFirstFlags("result-first", n, s).every(Boolean));
      const mixed = resultFirstFlags("mixed", n, s);
      assert.equal(mixed.length, n);
      assert.ok(mixed.some(Boolean) && !mixed.every(Boolean));
    }
  }
  const statements: Statement[] = [
    { label: "$63\\div9=7$", holds: true, why: "w", equation: eq },
    { label: "$x$", holds: false, why: "w" },
  ];
  const oriented = orientStatements(statements, [true, true]);
  assert.equal(oriented[0]!.label, "$7=63\\div9$");
  assert.equal(oriented[0]!.holds, true);
  assert.equal(oriented[1]!.label, "$x$", "non-equations are untouched");
});

const sample: Statement[] = [
  { label: "$2+2=4$", holds: true, why: "Two and two make four." },
  { label: "$2+3=6$", holds: false, why: "Two and three make five." },
  { label: "$3+3=6$", holds: true, why: "Three and three make six." },
  { label: "$1+1=3$", holds: false, why: "One and one make two." },
];
const copy = {
  selectPrompt: "Choose the 2 equations that are true.",
  selectLabel: "Choose 2 true equations",
  lead: "Look closely.",
  one: "equation",
};

test("statement-set formats key exactly the statements' truth", () => {
  const all = renderStatementSet("select-all", sample, copy);
  assert.equal(all.prompt, copy.selectPrompt);
  assert.equal(all.answer, '["option-a","option-c"]');
  assert.equal(all.response.kind, "multi-select");
  assert.equal(all.verdicts[1], "$2+3=6$: false. Two and three make five.");

  const three = sample.slice(0, 3);
  const pair = renderStatementSet("true-false-pair", three, copy);
  assert.match(
    pair.prompt,
    /^Look closely\. Decide whether each of the 3 equations/,
  );
  assert.match(
    pair.prompt,
    /choose the correct statement for each equation\.$/,
  );
  if (pair.response.kind !== "multi-select") throw new Error("multi");
  assert.equal(pair.response.selectionCount, 3);
  assert.deepEqual(
    pair.response.options.map((o) => o.label),
    three.flatMap((s) => [`${s.label} is true.`, `${s.label} is false.`]),
  );
  // One claim per pair, and it is the statement's truth.
  const ids = parseSelection(pair.answer)!;
  assert.deepEqual(ids, ["option-a", "option-d", "option-e"]);

  const single = renderStatementSet(
    "single-true",
    [sample[0]!, sample[1]!, sample[3]!],
    copy,
  );
  assert.equal(single.prompt, "Look closely. Which equation is true?");
  assert.equal(single.answer, "option-a");
  assert.deepEqual(Object.keys(single.choiceFeedback!), [
    "option-b",
    "option-c",
  ]);
  const singleFalse = renderStatementSet(
    "single-false",
    [sample[0]!, sample[1]!, sample[2]!],
    copy,
  );
  assert.equal(singleFalse.answer, "option-b");
  assert.match(singleFalse.choiceFeedback!["option-a"]!, /is true/);
  assert.throws(
    () => renderStatementSet("single-true", sample, copy),
    /exactly one/,
  );
  assert.throws(
    () =>
      renderStatementSet(
        "true-false-pair",
        [...sample, ...sample.map((s) => ({ ...s, label: `${s.label}.` }))],
        copy,
      ),
    /Too many/,
  );
});

test("statement draws keep exact true counts and redraw when the pool is short", () => {
  for (const seed of seeds(100)) {
    const drawn = drawStatements(random("t", seed), sample, 3, 1);
    assert.equal(drawn.length, 3);
    assert.equal(drawn.filter((s) => s.holds).length, 1);
  }
  assert.throws(
    () => drawStatements(random("t", "x"), sample, 4, 3),
    /Need three retry/,
  );
});

test("target forms compute every candidate's truth for whichever quantity is unknown", () => {
  const product = { op: "product" as const, whole: 36, first: 4, second: 9 };
  const larger = factEquations(product, "whole");
  assert.equal(larger[0]!.label, "$n=4\\times9$");
  assert.equal(larger.filter((e) => e.holds).length, 5);
  const smaller = factEquations(product, "second");
  assert.deepEqual(
    smaller.filter((e) => e.holds).map((e) => e.label),
    [
      "$36=4\\times n$",
      "$36=n\\times4$",
      "$n\\times4=36$",
      "$36\\div4=n$",
      "$36\\div n=4$",
    ],
  );
  // Independently: substitute the unknown and evaluate both sides.
  for (const rel of [
    product,
    { op: "sum" as const, whole: 17, first: 5, second: 12 },
  ])
    for (const slot of ["whole", "first", "second"] as const)
      for (const e of factEquations(rel, slot)) {
        const body = e.label
          .replace(/\$/g, "")
          .replace(/\\times/g, "*")
          .replace(/\\div/g, "/")
          .replace(/n/g, `(${rel[slot]})`);
        const [l, r] = body.split("=");
        const lv = Function(`return ${l}`)() as number,
          rv = Function(`return ${r}`)() as number;
        assert.equal(Math.abs(lv - rv) < 1e-12, e.holds, e.label);
      }
  const t = targetAxis({ big: "whole", small: "second" } as const, "big");
  assert.equal(t.axis.id, "unknown");
  assert.equal(t.slot("small"), "second");
});

test("number-domain model decides rationality exactly", () => {
  const cases: [ReturnType<typeof ex.pow>, boolean, string][] = [
    [ex.pow(ex.root(5), 2), true, "5"],
    [ex.pow(ex.root(2), 3), false, "2\\sqrt{2}"],
    [ex.pow(ex.root(3, 3), 3), true, "3"],
    [ex.pow(ex.root(4, 3), 2), false, "2\\sqrt[3]{2}"],
    [ex.pow(ex.pi, 2), false, "\\pi^{2}"],
    [ex.frac(ex.pow(ex.pi, 3), ex.pi), false, "\\pi^{2}"],
    [ex.frac(ex.mul(ex.num(4), ex.pow(ex.pi, 2)), ex.pow(ex.pi, 2)), true, "4"],
    [ex.mul(ex.root(3), ex.root(12)), true, "6"],
    [ex.add(ex.root(2), ex.root(8)), false, "3\\sqrt{2}"],
    [ex.sub(ex.root(8), ex.mul(ex.num(2), ex.root(2))), true, "0"],
    [ex.add(ex.pi, ex.num(1)), false, "\\pi+1"],
    [ex.frac(ex.num(1), ex.root(2)), false, "\\frac{1}{2}\\sqrt{2}"],
    [ex.pow(ex.mul(ex.num(2), ex.root(3)), 2), true, "12"],
  ];
  for (const [e, rational, value] of cases) {
    const v = valueOf(e);
    assert.equal(isRational(v), rational, tex(e));
    assert.equal(texValue(v), value, tex(e));
    const numeric = Function(
      `return ${tex(e)
        .replace(/\\left|\\right/g, "")
        .replace(/\\pi/g, "Math.PI")
        .replace(/\^\{(\d+)\}/g, "**$1")}`
        .replace(/\\sqrt\[3\]\{(\d+)\}/g, "Math.cbrt($1)")
        .replace(/\\sqrt\{(\d+)\}/g, "Math.sqrt($1)")
        .replace(/\\frac\{(.+)\}\{(.+)\}$/, "($1)/($2)")
        .replace(/\\cdot/g, "*")
        .replace(/(\d)(Math)/g, "$1*$2"),
    )() as number;
    assert.ok(Math.abs(numeric - approximate(v)) < 1e-9, tex(e));
  }
  assert.equal(tex(ex.pow(ex.root(5), 3)), "\\left(\\sqrt{5}\\right)^{3}");
  assert.equal(tex(ex.pow(ex.pi, 2)), "\\pi^{2}");
  assert.equal(tex(ex.mul(ex.num(3), ex.root(2))), "3\\sqrt{2}");
  assert.deepEqual(rationalValue(valueOf(ex.pow(ex.root(7), 4))), [49, 1]);
  assert.throws(() => valueOf(ex.mul(ex.root(2), ex.root(2, 3))), /mixed/);
});

test("rational display domains write one exact value in each style", () => {
  const v = q(-7, 4);
  assert.deepEqual(rationalStyles(v), [
    "fraction",
    "mixed",
    "decimal",
    "signed",
  ]);
  assert.equal(writeRational(v, "fraction"), "-\\frac{7}{4}");
  assert.equal(writeRational(v, "mixed"), "-1\\frac{3}{4}");
  assert.equal(writeRational(v, "decimal"), "-1.75");
  assert.equal(writeRational(q(3, 40), "decimal"), "0.075");
  assert.equal(writeRational(q(5), "signed"), "+5");
  assert.deepEqual(rationalStyles(q(1, 3)), ["fraction", "signed"]);
  assert.throws(() => writeRational(q(1, 3), "decimal"), /terminating/);
});

test("a varied family composes model and surface deterministically and records its axes", () => {
  const template: TemplateMetadata = {
    id: "variation-demo",
    version: 1,
    title: "Demo",
    skillId: "equality",
    gradeBand: "3–5",
    description: "Demo family for the variation layer.",
    requiredResponseCapability: "multi-select-v1",
  };
  const axes = {
    orientation: orientationAxis,
    "answer-format": restrictAxis(answerFormatAxis, [
      "select-all",
      "true-false-pair",
    ]),
  };
  const family = defineVariedFamily({
    template,
    axes,
    model: (r) => {
      const pool: Statement[] = Array.from({ length: 6 }, (_, i) => {
        const a = r(2, 9),
          b = r(2, 9);
        const shown = i < 3 ? a * b : a * b + 1;
        return {
          label: `$${a}\\times${b}=${shown}$`,
          holds: a * b === shown,
          why: `$${a}\\times${b}=${a * b}$.`,
          equation: { operation: `${a}\\times${b}`, result: `${shown}` },
        };
      });
      return { pool };
    },
    variant: () => "demo",
    render: (m, values, r, surface) =>
      statementSurface(
        {
          variant: "demo",
          pool: m.pool,
          total: 4,
          k: 2,
          hint: "Multiply each pair yourself.",
          copy: ({ k }) => ({
            ...copy,
            selectPrompt: `Choose the ${k} equations that are true.`,
            selectLabel: `Choose ${k} true equations`,
            lead: "",
          }),
        },
        values,
        r,
        surface,
      ),
  });
  const seen = new Set<string>();
  for (const seed of seeds(120)) {
    const c = generateVaried(family, seed);
    assert.deepEqual(c, generateVaried(family, seed));
    generatedProblemSchema.parse(c.problem);
    assert.deepEqual(c.problem.variant, {
      id: "demo",
      axes: axisRecord(c.axes),
    });
    assert.ok(!JSON.stringify(c.problem.public).includes("variant"));
    seen.add(JSON.stringify(c.axes));
    assert.equal(gradeAnswer(c.problem, c.problem.answer), true);
  }
  assert.equal(seen.size, 6);
  const forced = generateVaried(family, "v:1", {
    "answer-format": "true-false-pair",
    orientation: "result-first",
  });
  assert.equal(
    forced.problem.variant!.axes!["answer-format"],
    "true-false-pair",
  );
  assert.throws(
    () => generateVaried(family, "v:1", { orientation: "sideways" as never }),
    /no axis value/,
  );
  // Formats must use the template's one response protocol.
  assert.throws(
    () =>
      defineVariedFamily({
        ...family,
        axes: { "answer-format": answerFormatAxis },
      } as never),
    /single-choice-v1/,
  );
});

test("migrated families keep every pre-axis output byte for byte at legacy axis values", () => {
  const golden = JSON.parse(
    readFileSync(
      new URL("./fixtures/variation-legacy-digests.json", import.meta.url),
      "utf8",
    ),
  ) as Record<string, string[]>;
  assert.deepEqual(
    Object.keys(golden).sort(),
    Object.keys(mcasVariedAxes).sort(),
  );
  for (const [id, digests] of Object.entries(golden)) {
    let legacy = 0;
    digests.forEach((digest, i) => {
      const problem = generateProblem(id, `legacy:${i}`);
      generatedProblemSchema.parse(problem);
      const axes = problem.variant!.axes!;
      assert.deepEqual(
        Object.keys(axes).sort(),
        Object.keys(mcasVariedAxes[id]!).sort(),
      );
      if (
        !Object.entries(mcasVariedAxes[id]!).every(
          ([k, a]) => axes[k] === a.legacy,
        )
      )
        return;
      legacy++;
      const { variant, ...before } = problem;
      void variant;
      assert.equal(
        createHash("sha256")
          .update(JSON.stringify(before))
          .digest("hex")
          .slice(0, 16),
        digest,
        `${id} legacy:${i}`,
      );
    });
    assert.ok(legacy >= 30, `${id} reaches its legacy surface (${legacy})`);
  }
});

test("axes add no templates: migrated families keep their ids, skills and exposure objective", () => {
  for (const id of Object.keys(mcasVariedAxes)) {
    const matches = templates.filter((t) => t.id === id);
    assert.equal(matches.length, 1, id);
    assert.ok(objectiveForSkill(matches[0]!.skillId), id);
    assert.ok(!templates.some((t) => t.id.startsWith(`${id}-`)), id);
  }
});
