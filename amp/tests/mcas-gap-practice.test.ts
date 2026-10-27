import test from "node:test";
import assert from "node:assert/strict";
import {
  mcasGapCase,
  mcasGapTemplateIds,
  mcasGapTemplates,
  type McasGapCase,
} from "../src/math/mcas-gap-practice";
import {
  generateProblem,
  generateProblemFor,
  gradeAnswer,
  templates,
} from "../src/math/engine";
import {
  describeScene,
  layoutScene,
  sceneCapability,
} from "../src/math/scene/index";
import { methods } from "../src/content/problem-methods";
import { principles } from "../src/content/problem-principles";
import { lessons } from "../src/content/lessons";
import { problemLesson } from "../src/content/problem-lessons";
import { actualFacetMappings } from "../src/content/facet-mappings";
import { templateArchetypes } from "../src/curriculum/template-archetypes";
import { parseSelection } from "../src/math/selection-response";

const SEEDS = 400;
const cache = new Map<string, McasGapCase[]>();
const cases = (id: string): McasGapCase[] => {
  if (!cache.has(id))
    cache.set(
      id,
      Array.from({ length: SEEDS }, (_, i) => mcasGapCase(id, `mg:${i}`)),
    );
  return cache.get(id)!;
};

const expectedVariants: Record<string, string[]> = {
  "mcas-true-fact-equations": ["facts", "tens"],
  "mcas-round-hundred-select": ["three-digit", "four-digit", "halfway"],
  "mcas-prime-factor-select": ["primes", "factors"],
  "mcas-comparison-equations-select": ["times", "more"],
  "mcas-true-product-equations": ["small-multiplier", "large-multiplier"],
  "mcas-prism-range-select": ["range", "exact"],
  "mcas-ratio-statements-select": ["three-groups", "two-groups"],
  "mcas-true-quotient-equations": ["two-digit-divisor", "zero-in-quotient"],
  "mcas-cube-prism-statements": [
    "edge-1-over-2",
    "edge-1-over-3",
    "edge-1-over-4",
  ],
  "mcas-statistical-question-select": ["2-of-5", "3-of-5"],
  "mcas-fraction-rate-select": ["three-days"],
  "mcas-negative-fraction-forms": ["negative", "positive"],
  "mcas-markup-price-select": ["markup", "markdown"],
  "mcas-rational-irrational-select": ["radicals", "with-pi"],
  "mcas-sci-notation-select": ["positive", "negative", "mixed"],
  "mcas-table-intercept-select": ["zero-listed", "zero-missing"],
  "mcas-quadratic-zeros-select": ["factored", "standard", "leading"],
  "mcas-congruence-statement-select": ["aligned", "scrambled"],
  "mcas-circle-equation-select": ["circle-center-radius"],
  "mcas-cylinder-scaling-select": ["radius-height-both"],
  "mcas-circle-radius-distance": ["radius", "diameter", "circumference"],
  "mcas-parenthesized-product-statement": [
    "times-sum",
    "times-difference",
    "sum-times",
  ],
  "mcas-slope-sign-description": [
    "falls-as-rises",
    "rises-as-rises",
    "rises-as-falls",
    "falls-as-falls",
    "unchanged",
  ],
  "mcas-rotational-symmetry": ["which-has", "which-lacks"],
  "mcas-product-factor-size": ["greater", "less", "equal"],
};
const singleIds = new Set([
  "mcas-circle-radius-distance",
  "mcas-parenthesized-product-statement",
  "mcas-slope-sign-description",
  "mcas-rotational-symmetry",
  "mcas-product-factor-size",
]);

/** Evaluate the TeX the generators write: numbers, fractions, mixed numbers, roots, pi. */
function tex(source: string): number {
  let t = source
    .replace(/\$/g, "")
    .replace(/\{,\}/g, "")
    .replace(/−/g, "-")
    .replace(/\\times|\\cdot/g, "*")
    .replace(/\\div/g, "/")
    .replace(/\\left|\\right/g, "");
  t = t
    .replace(/\^\{(-?\d+)\}/g, "**($1)")
    .replace(/(\d+)\\frac\{(\d+)\}\{(\d+)\}/g, "($1+$2/$3)")
    .replace(/\\pi/g, "(Math.PI)");
  // Innermost first: roots and fractions nest in either order.
  for (let before = ""; before !== t;) {
    before = t;
    t = t
      .replace(/\\sqrt\[3\]\{([^{}]*)\}/g, "Math.cbrt($1)")
      .replace(/\\sqrt\{([^{}]*)\}/g, "Math.sqrt($1)")
      .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "(($1)/($2))");
  }
  t = t.replace(/(\d|\))\s*(Math|\()/g, "$1*$2").replace(/\)(\d)/g, ")*$1");
  return Function(`return (${t})`)() as number;
}
const near = (a: number, b: number) =>
  Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const int = (s: string) => Number(s.replace(/\{,\}|,/g, ""));
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
/** Rational with a small denominator: used to test rationality of the radicals. */
const isRationalValue = (v: number) =>
  Array.from({ length: 48 }, (_, i) => i + 1).some((q) =>
    near(v * q, Math.round(v * q)),
  );

const selection = (c: McasGapCase) => {
  const response = c.problem.public.response;
  assert.equal(response.kind, "multi-select");
  if (response.kind !== "multi-select") throw new Error("multi expected");
  return response;
};
const pairClaim = /^(.*) is (true|false)\.$/;
/** True/false pairs list each statement twice, "… is true." then "… is false." */
const isPairs = (c: McasGapCase) =>
  c.axes?.["answer-format"] === "true-false-pair";
/** The displayed statements, whatever the answer format. */
const statementsOf = (c: McasGapCase): string[] => {
  const labels = selection(c).options.map((o) => o.label);
  if (!isPairs(c)) return labels;
  const out: string[] = [];
  for (let i = 0; i < labels.length; i += 2) {
    const t = pairClaim.exec(labels[i]!)!,
      f = pairClaim.exec(labels[i + 1]!)!;
    assert.ok(t && f && t[1] === f[1] && t[2] === "true" && f[2] === "false");
    out.push(t[1]!);
  }
  return out;
};
/** The statements the keyed answer says are true. */
const keyed = (c: McasGapCase): Set<string> => {
  const ids = parseSelection(c.problem.answer);
  assert.ok(ids, "answer parses");
  const chosen = selection(c)
    .options.filter((o) => ids!.includes(o.id))
    .map((o) => o.label);
  if (!isPairs(c)) return new Set(chosen);
  const statements = statementsOf(c);
  assert.equal(chosen.length, statements.length, "one choice per pair");
  return new Set(
    chosen
      .map((label) => pairClaim.exec(label)!)
      .filter((m) => m[2] === "true")
      .map((m) => m[1]!),
  );
};
/** The semantic oracle returns the set of statements that must be keyed. */
const checkTruth = (
  id: string,
  truth: (c: McasGapCase, label: string) => boolean,
) => {
  for (const c of cases(id)) {
    const expected = new Set(
      statementsOf(c).filter((label) => truth(c, label)),
    );
    assert.deepEqual(
      [...keyed(c)].sort(),
      [...expected].sort(),
      `${id} ${c.problem.public.seed}`,
    );
  }
};
const promptOf = (c: McasGapCase) => c.problem.public.prompt;

test("every template reaches every variant over 400 seeds and is deterministic", () => {
  assert.deepEqual(
    mcasGapTemplateIds.sort(),
    Object.keys(expectedVariants).sort(),
  );
  for (const id of mcasGapTemplateIds) {
    const seen = new Set(cases(id).map((c) => c.variant));
    assert.deepEqual([...seen].sort(), [...expectedVariants[id]!].sort(), id);
    for (const seed of ["a", "b", "mg:17"])
      assert.deepEqual(mcasGapCase(id, seed), mcasGapCase(id, seed), id);
    assert.throws(() => mcasGapCase(id, ""), /Seed/);
  }
});

test("multi-select problems have distinct options, one exact keyed set and no leaked statements", () => {
  for (const id of mcasGapTemplateIds.filter((t) => !singleIds.has(t))) {
    const template = mcasGapTemplates.find((t) => t.id === id)!;
    assert.equal(template.requiredResponseCapability, "multi-select-v1");
    for (const c of cases(id)) {
      const response = selection(c);
      const labels = response.options.map((o) => o.label);
      assert.equal(new Set(labels).size, labels.length, id);
      assert.ok(
        labels.every((l) => l.length <= 120),
        `${id} label length`,
      );
      assert.ok(response.options.length >= 3 && response.options.length <= 8);
      const ids = parseSelection(c.problem.answer)!;
      assert.equal(ids.length, response.selectionCount, id);
      assert.ok(response.selectionCount >= 2);
      assert.ok(response.selectionCount < response.options.length);
      const trueLabels = c.options!.filter((o) => o.holds).map((o) => o.label);
      assert.equal(
        isPairs(c) ? c.options!.length : trueLabels.length,
        response.selectionCount,
        id,
      );
      assert.deepEqual(
        [...keyed(c)].sort(),
        [...trueLabels].sort(),
        `${id} keyed set is the set of true statements`,
      );
      const text = `${promptOf(c)}\n${c.problem.hint}`;
      for (const label of trueLabels)
        assert.ok(!text.includes(label), `${id} leaks ${label}`);
      assert.ok(c.problem.hint.length > 20 && c.problem.explanation.length > 1);
      // Exact-set grading through the engine.
      assert.equal(gradeAnswer(c.problem, c.problem.answer), true);
      const wrong = response.options
        .filter((o) => !ids.includes(o.id))
        .map((o) => o.id)[0]!;
      const swapped = JSON.stringify([...ids.slice(1), wrong].sort());
      assert.equal(gradeAnswer(c.problem, swapped), false);
      assert.equal(
        gradeAnswer(c.problem, JSON.stringify(ids.slice(1))),
        false,
        "an incomplete selection is not accepted",
      );
    }
  }
});

test("single-choice problems have one correct choice, feedback on every wrong choice and no leaked answer", () => {
  for (const id of singleIds) {
    for (const c of cases(id)) {
      const response = c.problem.public.response;
      assert.equal(response.kind, "choice");
      if (response.kind !== "choice") continue;
      const labels = response.options.map((o) => o.label);
      assert.equal(new Set(labels).size, 4, id);
      const correct = response.options.find((o) => o.id === c.problem.answer)!;
      assert.ok(correct, id);
      assert.equal(Object.keys(c.problem.choiceFeedback ?? {}).length, 3, id);
      assert.ok(!(correct.id in (c.problem.choiceFeedback ?? {})));
      if (c.variant !== "radius") {
        assert.ok(!promptOf(c).includes(correct.label), `${id} prompt leaks`);
        assert.ok(!c.problem.hint.includes(correct.label), `${id} hint leaks`);
      }
      assert.equal(gradeAnswer(c.problem, c.problem.answer), true);
    }
  }
});

test("engine generation reaches every template and keeps its capability", () => {
  const ids = new Set(templates.map((t) => t.id));
  for (const id of mcasGapTemplateIds) {
    assert.ok(ids.has(id), `${id} is registered`);
    const problem = generateProblem(id, "engine-seed");
    assert.equal(problem.public.templateId, id);
    assert.equal(
      problem.public.response.kind,
      singleIds.has(id) ? "choice" : "multi-select",
    );
    const raw = mcasGapCase(id, "engine-seed").problem;
    assert.deepEqual(
      problem.public.response,
      raw.public.response,
      `${id} engine polish leaves the options unchanged`,
    );
  }
});

test("equation templates agree with independent arithmetic", () => {
  // Either orientation: 63÷9=7 or 7=63÷9.
  const opFirst = /^\$([\d{},]+)\\(times|div)([\d{},]+)=([\d{},]+)\$$/;
  const resultFirst = /^\$([\d{},]+)=([\d{},]+)\\(times|div)([\d{},]+)\$$/;
  const holds = (_: McasGapCase, label: string) => {
    const a = opFirst.exec(label),
      b = resultFirst.exec(label);
    assert.ok(a || b, label);
    const [x, op, y, z] = a
      ? [int(a[1]!), a[2]!, int(a[3]!), int(a[4]!)]
      : [int(b![2]!), b![3]!, int(b![4]!), int(b![1]!)];
    return op === "times" ? x * y === z : x === y * z;
  };
  for (const id of [
    "mcas-true-fact-equations",
    "mcas-true-product-equations",
    "mcas-true-quotient-equations",
  ])
    checkTruth(id, holds);
  for (const c of cases("mcas-true-fact-equations"))
    if (!isPairs(c))
      assert.ok(
        selection(c).options.filter((o) => o.label.includes("\\div")).length >=
          3,
        "at least three divisions",
      );
  for (const id of [
    "mcas-true-fact-equations",
    "mcas-true-product-equations",
    "mcas-true-quotient-equations",
  ]) {
    const seen = new Set(cases(id).map((c) => JSON.stringify(c.axes)));
    assert.equal(seen.size, 6, `${id} reaches every orientation × format`);
    for (const c of cases(id)) {
      const flipped = statementsOf(c).map((l) => resultFirst.test(l));
      const o = c.axes!.orientation;
      if (o === "operation-first") assert.ok(!flipped.some(Boolean));
      if (o === "result-first") assert.ok(flipped.every(Boolean));
      if (o === "mixed")
        assert.ok(flipped.some(Boolean) && !flipped.every(Boolean), id);
    }
  }
  for (const c of cases("mcas-true-quotient-equations"))
    if (c.variant === "zero-in-quotient" && !isPairs(c))
      assert.ok(
        selection(c).options.some(
          (o) => /=\d*0\d*\$/.test(o.label) || /^\$\d*0\d*=/.test(o.label),
        ),
        "a quotient with a zero digit appears",
      );
});

test("rounding, primes and factors agree with independent arithmetic", () => {
  checkTruth("mcas-round-hundred-select", (c, label) => {
    const target = int(/round to ([\d,]+)/.exec(promptOf(c))![1]!);
    const n = int(/^([\d,]+) /.exec(label)![1]!);
    return Math.floor((n + 50) / 100) * 100 === target;
  });
  for (const c of cases("mcas-round-hundred-select"))
    if (c.variant === "halfway")
      assert.ok(
        selection(c).options.some(
          (o) => int(o.label.split(" ")[0]!) % 100 === 50,
        ),
        "a halfway value appears",
      );
  checkTruth("mcas-prime-factor-select", (c, label) => {
    const n = Number(label);
    if (/prime/.test(promptOf(c)) && !/factors of/.test(promptOf(c))) {
      for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
      return n > 1;
    }
    return int(/factors of (\d+)\?/.exec(promptOf(c))![1]!) % n === 0;
  });
  const factorCases = cases("mcas-prime-factor-select").filter(
    (c) => c.variant === "factors",
  );
  assert.ok(
    factorCases.some((c) => {
      const N = int(/factors of (\d+)\?/.exec(promptOf(c))![1]!);
      return selection(c).options.some((o) => Number(o.label) > N);
    }),
    "a multiple of the number appears as a distractor",
  );
});

test("comparison equations hold for the stated amount, whichever quantity is unknown", () => {
  const story =
    /^A group has (\d+) (.+?)\. There are (\d+) (times as many|more) (.+?) (?:as|than) (.+?)\. Let \$n\$ be the number of (.+?)\./;
  const unknownValue = (c: McasGapCase) => {
    const [, given, givenNoun, k, relation, big, small, asked] = story.exec(
      promptOf(c),
    )!;
    const g = int(given!),
      m = int(k!);
    const times = relation === "times as many";
    if (givenNoun === small && asked === big) return times ? g * m : g + m;
    assert.ok(givenNoun === big && asked === small, promptOf(c));
    return times ? g / m : g - m;
  };
  checkTruth("mcas-comparison-equations-select", (c, label) => {
    const N = unknownValue(c);
    const [left, right] = label.replace(/\$/g, "").split("=");
    const side = (s: string) => tex(s.replace(/n/g, `(${N})`));
    return near(side(left!), side(right!));
  });
  const targets = new Set(
    cases("mcas-comparison-equations-select").map((c) => c.axes!.unknown),
  );
  assert.deepEqual([...targets].sort(), ["larger", "smaller"]);
  for (const c of cases("mcas-comparison-equations-select"))
    if (c.axes!.unknown === "smaller")
      assert.ok(
        Number.isInteger(unknownValue(c)) &&
          c.problem.explanation.some((l) =>
            l.includes(`$n=${unknownValue(c)}$`),
          ),
      );
});

test("prism pairs are unique and meet the stated condition", () => {
  for (const c of cases("mcas-prism-range-select")) {
    const response = selection(c);
    const vols = response.options.map((o) => {
      if (c.axes!.prisms === "unit-cubes") return drawnPrismVolume(c, o.label);
      const m = /\$(\d+)\\times(\d+)\\times(\d+)\$/.exec(o.label)!;
      return Number(m[1]) * Number(m[2]) * Number(m[3]);
    });
    const range = /greater than (\d+) and less than (\d+)/.exec(promptOf(c));
    const exact = /equal (\d+) cubic/.exec(promptOf(c));
    const fits = (s: number) =>
      range
        ? s > Number(range[1]) && s < Number(range[2])
        : s === Number(exact![1]);
    const pairs: string[] = [];
    for (let i = 0; i < vols.length; i++)
      for (let j = i + 1; j < vols.length; j++)
        if (fits(vols[i]! + vols[j]!))
          pairs.push(
            [response.options[i]!.id, response.options[j]!.id].sort().join(),
          );
    assert.equal(pairs.length, 1);
    assert.equal(parseSelection(c.problem.answer)!.sort().join(), pairs[0]);
    const names = response.options.map((o) => o.label.slice(0, 7));
    assert.deepEqual(names, [...names].sort(), "prisms are listed in order");
  }
});

test("ratio statements agree with the counts", () => {
  checkTruth("mcas-ratio-statements-select", (c, label) => {
    const model = c.model as {
      groups: { name: string; n: number }[];
      all: { name: string; n: number };
    };
    const m = /^The ratio of (.+) to (.+) is \$(\d+):(\d+)\$\.$/.exec(label)!;
    const count = (name: string) =>
      [...model.groups, model.all].find((g) => g.name === name)!.n;
    return count(m[1]!) * Number(m[4]) === count(m[2]!) * Number(m[3]);
  });
  const kinds = new Set<string>();
  for (const c of cases("mcas-ratio-statements-select"))
    for (const o of selection(c).options) {
      kinds.add(
        /ratio of all the/.test(o.label)
          ? "whole-to-part"
          : /to all the/.test(o.label)
            ? "part-to-whole"
            : "part-to-part",
      );
    }
  assert.deepEqual([...kinds].sort(), [
    "part-to-part",
    "part-to-whole",
    "whole-to-part",
  ]);
});

test("cube prism statements agree with the packing arithmetic", () => {
  checkTruth("mcas-cube-prism-statements", (c, label) => {
    const {
      n,
      a,
      b,
      c: h,
    } = c.model as { n: number; a: number; b: number; c: number };
    let m: RegExpExecArray | null;
    if ((m = /^(\d+) cubes fit along the length\.$/.exec(label)))
      return Number(m[1]) === a;
    if (
      (m = /^The prism is \$?(.+?)\$? units (long|wide|tall)\.$/.exec(label))
    ) {
      const count = { long: a, wide: b, tall: h }[m[2] as "long"];
      return near(tex(m[1]!), count / n);
    }
    if ((m = /Each small cube has a volume of \$(.+)\$ cubic unit/.exec(label)))
      return near(tex(m[1]!), 1 / n ** 3);
    if ((m = /^It takes (\d+) cubes/.exec(label)))
      return Number(m[1]) === a * b * h;
    if ((m = /The volume of the prism is \$(.+)\$ cubic units/.exec(label)))
      return near(tex(m[1]!), (a * b * h) / n ** 3);
    if ((m = /The volume of the prism is (\d+) cubic units/.exec(label)))
      return near(Number(m[1]), (a * b * h) / n ** 3);
    if (/^Multiplying the three edge lengths/.test(label)) return true;
    if (/^Adding the three edge lengths/.test(label)) return false;
    throw new Error(`Unrecognized statement ${label}`);
  });
});

test("statistical questions are exactly those with varying answers", () => {
  const single = [
    /^What time/,
    /^Is the/,
    /^What is the price/,
    /^How many (screens|floors|lanes|ovens|lifeguards)/,
    /^How many seats are in/,
    /^How deep/,
    /^How many books did Jada/,
    /^How many cakes were ordered for Sam/,
  ];
  checkTruth(
    "mcas-statistical-question-select",
    (_, label) => !single.some((p) => p.test(label)),
  );
});

test("fraction rates agree with distance divided by time", () => {
  checkTruth("mcas-fraction-rate-select", (c, label) => {
    const rows = c.model as {
      day: string;
      s: readonly [number, number];
      t: readonly [number, number];
      d: readonly [number, number];
    }[];
    const m = /^(\w+): \$(.+)\$ miles per hour$/.exec(label)!;
    const row = rows.find((r) => r.day === m[1])!;
    return near(tex(m[2]!), row.d[0] / row.d[1] / (row.t[0] / row.t[1]));
  });
  for (const c of cases("mcas-fraction-rate-select")) {
    // The data in the prompt is the data the answer was computed from.
    const trips = [
      ...promptOf(c).matchAll(
        /On (\w+) the hiker walked \$(.+?)\$ miles in \$(.+?)\$ hours/g,
      ),
    ];
    assert.equal(trips.length, 3);
    for (const [, day, d, t] of trips) {
      const row = (
        c.model as { day: string; d: [number, number]; t: [number, number] }[]
      ).find((r) => r.day === day)!;
      assert.ok(
        near(tex(d!), row.d[0] / row.d[1]) &&
          near(tex(t!), row.t[0] / row.t[1]),
      );
    }
  }
});

test("negative fraction forms evaluate to the stated value", () => {
  checkTruth("mcas-negative-fraction-forms", (c, label) => {
    const target = tex(/equal to (\$.+\$)\?/.exec(promptOf(c))![1]!);
    return near(tex(label), target);
  });
  for (const c of cases("mcas-negative-fraction-forms"))
    assert.ok(
      selection(c).options.some(
        (o) =>
          /\\frac\{-?\d+\}\{-?\d+\}/.test(o.label) &&
          /\\frac\{-\d+\}\{\d+\}|\\frac\{\d+\}\{-\d+\}/.test(o.label),
      ),
    );
});

test("markup prices agree with the percent change", () => {
  checkTruth("mcas-markup-price-select", (c, label) => {
    const p = int(/(\d+) percent (above|below)/.exec(promptOf(c))![1]!);
    const up = /above/.test(promptOf(c));
    const m = /cost (\d+) dollars, selling price (\d+) dollars/.exec(label)!;
    const cost = Number(m[1]);
    return near(Number(m[2]), cost * (1 + ((up ? 1 : -1) * p) / 100));
  });
});

test("rational and irrational selections match numeric rationality", () => {
  checkTruth("mcas-rational-irrational-select", (_, label) =>
    isRationalValue(tex(label)),
  );
  for (const c of cases("mcas-rational-irrational-select"))
    if (c.axes!["number-domain"] === "with-powers") {
      const powers = statementsOf(c).filter((l) => l.includes("^{"));
      assert.ok(
        powers.some((l) => c.options!.find((o) => o.label === l)!.holds) &&
          powers.some((l) => !c.options!.find((o) => o.label === l)!.holds),
        "a rational and an irrational power appear",
      );
    }
});

test("scientific notation equations are exactly equal to their numerals", () => {
  checkTruth("mcas-sci-notation-select", (_, label) => {
    const m = /^\$(\d)\\times10\^\{(-?\d+)\}=(.+)\$$/.exec(label)!;
    return near(Number(m[1]) * 10 ** Number(m[2]), tex(m[3]!));
  });
  for (const c of cases("mcas-sci-notation-select"))
    if (c.variant === "negative")
      assert.ok(
        selection(c).options.every((o) => /10\^\{-\d+\}/.test(o.label)),
      );
});

test("tables are linear and compare their own intercept with the stated one", () => {
  checkTruth("mcas-table-intercept-select", (c, label) => {
    const b = Number(/intercept of (-?\d+)\./.exec(promptOf(c))![1]);
    const less = /intercept is less than/.test(promptOf(c));
    const m = /^\$x\$: ([\d, ]+) and \$y\$: (.+)$/.exec(label)!;
    const xs = m[1]!.split(", ").map(Number);
    const ys = m[2]!.split(", ").map((v) => Number(v.replace("−", "-")));
    const slope = (ys[1]! - ys[0]!) / (xs[1]! - xs[0]!);
    xs.forEach((x, i) =>
      assert.ok(near(ys[i]!, ys[0]! + slope * (x - xs[0]!))),
    );
    const intercept = ys[0]! - slope * xs[0]!;
    return less ? intercept < b : intercept > b;
  });
  for (const c of cases("mcas-table-intercept-select"))
    if (c.variant === "zero-missing")
      assert.ok(!selection(c).options.some((o) => o.label.includes("$x$: 0")));
});

test("quadratic zeros are the values that make the expression zero", () => {
  const f = (expr: string) =>
    Function(
      "x",
      `return (${expr
        .replace(/\$/g, "")
        .replace(/\^\{2\}/g, "**2")
        .replace(/(\d)x/g, "$1*x")
        .replace(/(\d|\)|x)\(/g, "$1*(")
        .replace(/\)x/g, ")*x")})`,
    ) as (x: number) => number;
  checkTruth("mcas-quadratic-zeros-select", (c, label) => {
    const expr = /expression \$(.+)\$ equal/.exec(promptOf(c))![1]!;
    return f(expr)(Number(/x=(-?\d+)/.exec(label)![1])) === 0;
  });
  for (const c of cases("mcas-quadratic-zeros-select"))
    if (c.variant === "leading")
      assert.match(promptOf(c), /expression \$[23]x\^\{2\}/);
});

test("congruence statements match corresponding vertices by position", () => {
  checkTruth("mcas-congruence-statement-select", (c, label) => {
    const t = /\\triangle (\w{3})\\cong\\triangle (\w{3})/.exec(promptOf(c))!;
    const to = (ch: string) => t[2]![t[1]!.indexOf(ch)]!;
    let m: RegExpExecArray | null;
    if ((m = /^\$\\angle (\w)\\cong\\angle (\w)\$$/.exec(label)))
      return to(m[1]!) === m[2];
    m = /^\$\\overline\{(\w)(\w)\}\\cong\\overline\{(\w)(\w)\}\$$/.exec(label)!;
    const mapped = [to(m[1]!), to(m[2]!)].sort().join("");
    return mapped === [m[3], m[4]].sort().join("");
  });
  for (const c of cases("mcas-congruence-statement-select"))
    if (c.variant === "aligned")
      assert.match(promptOf(c), /triangle [A-Z]{3}\\cong\\triangle [A-Z]{3}/);
});

test("circle equation statements agree with the center and radius", () => {
  checkTruth("mcas-circle-equation-select", (c, label) => {
    const e = /\(x([+-])(\d+)\)\^\{2\}\+\(y([+-])(\d+)\)\^\{2\}=(\d+)/.exec(
      promptOf(c),
    )!;
    const h = (e[1] === "+" ? -1 : 1) * Number(e[2]);
    const k = (e[3] === "+" ? -1 : 1) * Number(e[4]);
    const r2 = Number(e[5]);
    const r = Math.sqrt(r2);
    let m: RegExpExecArray | null;
    if (
      (m =
        /^The center is the point \$\\left\((-?\d+),(-?\d+)\\right\)\$\.$/.exec(
          label,
        ))
    )
      return Number(m[1]) === h && Number(m[2]) === k;
    if ((m = /^The radius is (\d+)\.$/.exec(label))) return Number(m[1]) === r;
    if ((m = /^The diameter is (\d+)\.$/.exec(label)))
      return Number(m[1]) === 2 * r;
    if (
      (m =
        /^The point \$\\left\((-?\d+),(-?\d+)\\right\)\$ is on the circle\.$/.exec(
          label,
        ))
    )
      return (Number(m[1]) - h) ** 2 + (Number(m[2]) - k) ** 2 === r2;
    if (label === "The origin is inside the circle.") return h * h + k * k < r2;
    if (label === "The origin is outside the circle.")
      return h * h + k * k > r2;
    throw new Error(`Unrecognized statement ${label}`);
  });
});

test("cylinder scaling statements multiply the radius squared and the height", () => {
  checkTruth("mcas-cylinder-scaling-select", (_, label) => {
    const radius = /the radius is multiplied by \$(.+?)\$/.exec(label);
    const height = /the height is multiplied by \$(.+?)\$/.exec(label);
    const result = /volume is multiplied by \$(.+?)\$\.$/.exec(label)!;
    const factor =
      (radius ? tex(radius[1]!) ** 2 : 1) * (height ? tex(height[1]!) : 1);
    return near(factor, tex(result[1]!));
  });
});

test("single-choice answers agree with independent reasoning", () => {
  const correctLabel = (c: McasGapCase) => {
    const response = c.problem.public.response;
    if (response.kind !== "choice") throw new Error("choice expected");
    return response.options.find((o) => o.id === c.problem.answer)!.label;
  };
  for (const c of cases("mcas-circle-radius-distance")) {
    const p = promptOf(c);
    const expected =
      c.variant === "radius"
        ? int(/radius (\d+) cm/.exec(p)![1]!)
        : c.variant === "diameter"
          ? int(/diameter of (\d+) cm/.exec(p)![1]!) / 2
          : int(/circumference of \$(\d+)\\pi\$/.exec(p)![1]!) / 2;
    assert.equal(correctLabel(c), `${expected} cm`);
  }
  for (const c of cases("mcas-parenthesized-product-statement")) {
    const expr = /expression \$(.+)\$ without/.exec(promptOf(c))![1]!;
    const [a, b] = (/\((\d+)([+-])(\d+)\)/.exec(expr) ?? []).filter(
      (_, i) => i === 1 || i === 3,
    );
    const n = /\\times(\d+)$|^(\d+)\\times/.exec(expr)!;
    const word = expr.includes("+") ? "sum" : "difference";
    assert.equal(
      correctLabel(c),
      `${n[1] ?? n[2]} times as large as the ${word} of ${a} and ${b}`,
    );
    assert.equal(c.problem.public.response.kind, "choice");
  }
  for (const c of cases("mcas-slope-sign-description")) {
    const m =
      /As .+? (increases|decreases), .+? (increases|decreases|stays the same)\./.exec(
        promptOf(c),
      )!;
    const expected =
      m[2] === "stays the same"
        ? "Zero"
        : m[1] === m[2]
          ? "Positive"
          : "Negative";
    assert.equal(correctLabel(c), expected);
  }
  const rotates = /rectangle|parallelogram|rhombus|regular|equilateral|square/i;
  const rigid = /trapezoid|kite|scalene|isosceles triangle|right triangle/i;
  for (const c of cases("mcas-rotational-symmetry")) {
    const response = c.problem.public.response;
    if (response.kind !== "choice") throw new Error("choice expected");
    const has = (label: string) => {
      assert.ok(rotates.test(label) || rigid.test(label), label);
      return !rigid.test(label);
    };
    const flags = response.options.map((o) => has(o.label));
    assert.equal(
      flags.filter(Boolean).length,
      c.variant === "which-has" ? 1 : 3,
    );
    assert.equal(has(correctLabel(c)), c.variant === "which-has");
  }
  for (const c of cases("mcas-product-factor-size")) {
    const response = c.problem.public.response;
    if (response.kind !== "choice") throw new Error("choice expected");
    const f = tex(/\$(.+)\$\?$/.exec(promptOf(c))![1]!);
    const ok = (label: string) => {
      const value = tex(label);
      return c.variant === "greater"
        ? value > f + 1e-12
        : c.variant === "less"
          ? value < f - 1e-12
          : near(value, f);
    };
    assert.deepEqual(
      response.options.filter((o) => ok(o.label)).map((o) => o.id),
      [c.problem.answer],
    );
  }
});

test("every family has a method, principle, lesson, one partial facet mapping and archetype links", () => {
  for (const t of mcasGapTemplates) {
    const method = methods[t.id]!;
    assert.ok(method, `${t.id} method`);
    assert.ok(method.goal.length <= 140, `${t.id} goal length`);
    assert.ok(method.intuition && method.watch && method.method.length >= 2);
    assert.ok(principles[t.id], `${t.id} principle`);
    const bound = lessons.filter((l) => l.templateIds.includes(t.id));
    assert.equal(bound.length, 1, `${t.id} has one lesson`);
    assert.ok(bound[0]!.sections.some((s) => s.stage === "intuition"));
    assert.ok(bound[0]!.closingSections?.some((s) => s.stage === "method"));
    const mappings = actualFacetMappings.filter((m) => m.templateId === t.id);
    assert.equal(mappings.length, 1, `${t.id} facet mapping`);
    assert.equal(mappings[0]!.extent, "partial");
    assert.match(mappings[0]!.rationale, /Does not assess/);
    assert.ok(templateArchetypes[t.id]?.length, `${t.id} archetype`);
    const lesson = problemLesson(
      t.id,
      "learner",
      generateProblem(t.id, "learner").public.prompt,
    );
    assert.ok(lesson.intuition?.trim() && lesson.example.steps.length > 0);
  }
});

/* ------------------------------------------- figure-surface sweep axes */

type IsoCubes = {
  type: "isoSolid";
  id: string;
  solid: { form: "cubes"; length: number; width: number; height: number };
};
const sceneOf = (c: McasGapCase) => {
  const figure = c.problem.public.figure;
  assert.equal(figure?.kind, "scene");
  if (figure?.kind !== "scene") throw new Error("scene expected");
  return figure.scene;
};
const isoSolids = (c: McasGapCase) =>
  sceneOf(c).elements.filter((e) => e.type === "isoSolid") as IsoCubes[];
/** Volume of "Prism X" read from its drawn unit cubes, never from the model. */
function drawnPrismVolume(c: McasGapCase, label: string): number {
  const letter = /^Prism ([A-E])$/.exec(label)![1];
  const e = isoSolids(c).find((s) => s.id === `prism${letter}`)!;
  return e.solid.length * e.solid.width * e.solid.height;
}

test("both figure surfaces of the prism families are reached and drawn from the model", () => {
  for (const [id, axis, drawn] of [
    ["mcas-prism-range-select", "prisms", "unit-cubes"],
    ["mcas-cube-prism-statements", "prism", "drawn-cubes"],
  ] as const) {
    const values = new Set(cases(id).map((c) => c.axes?.[axis]));
    assert.equal(values.size, 2, id);
    for (const c of cases(id)) {
      assert.deepEqual(c.problem.variant?.axes, { [axis]: c.axes![axis] });
      if (c.axes![axis] !== drawn) {
        assert.equal(c.problem.public.figure, undefined, id);
        continue;
      }
      const scene = sceneOf(c);
      assert.equal(sceneCapability(scene), "scenes-v1", id);
      // The figure and its description never state a volume.
      const said = describeScene(scene);
      assert.doesNotMatch(said, /volume|cubic/i, id);
      assert.doesNotMatch(JSON.stringify(scene), /cubic/, id);
    }
  }
  for (const c of cases("mcas-prism-range-select")) {
    if (c.axes!.prisms !== "unit-cubes") continue;
    const model = c.model as { dims: number[][] };
    assert.deepEqual(
      isoSolids(c).map((e) => [e.solid.length, e.solid.width, e.solid.height]),
      model.dims,
    );
    for (const o of selection(c).options)
      assert.match(o.label, /^Prism [A-E]$/);
    assert.match(promptOf(c), /1-centimeter cubes/);
  }
  for (const c of cases("mcas-cube-prism-statements")) {
    if (c.axes!.prism !== "drawn-cubes") continue;
    const m = c.model as { n: number; a: number; b: number; c: number };
    const [solid] = isoSolids(c);
    assert.deepEqual(
      [solid!.solid.length, solid!.solid.width, solid!.solid.height],
      [m.a, m.b, m.c],
    );
    const brace = sceneOf(c).elements.find((e) => e.type === "brace");
    assert.equal(brace && "label" in brace && brace.label, `1/${m.n}`);
    // The prompt no longer states the prism's dimensions.
    assert.doesNotMatch(promptOf(c), /units long/);
    assert.ok(
      selection(c).options.some((o) =>
        /^The prism is .* units (long|wide|tall)\.$/.test(o.label),
      ),
      "a measured-edge statement is shown",
    );
  }
});

test("drawn prisms stay countable on a 288 px phone stage", () => {
  for (const id of ["mcas-prism-range-select", "mcas-cube-prism-statements"])
    for (const c of cases(id)) {
      const figure = c.problem.public.figure;
      if (figure?.kind !== "scene") continue;
      const layout = layoutScene({ ...figure.scene, width: 288 });
      // One math unit is one cube edge.
      assert.ok(
        layout.scale >= 12,
        `${id} ${c.problem.public.seed}: ${layout.scale}`,
      );
      assert.ok(layout.width <= 288 && layout.dropped.length === 0, id);
    }
});

test("a client without scenes-v1 always receives the legacy prism surfaces", () => {
  for (const id of ["mcas-prism-range-select", "mcas-cube-prism-statements"])
    for (let i = 0; i < 60; i++) {
      const seed = `mg:${i}`;
      const old = generateProblemFor(id, seed, []);
      assert.equal(old.public.figure, undefined, `${id} ${seed}`);
      assert.deepEqual(
        old.public,
        mcasGapCase(id, seed, legacyOf(id)).problem.public,
      );
      const current = generateProblemFor(id, seed, ["scenes-v1"]);
      assert.deepEqual(current.public, generateProblem(id, seed).public);
    }
});
const legacyOf = (id: string): Record<string, string> =>
  id === "mcas-prism-range-select"
    ? { prisms: "edge-lengths" }
    : { prism: "stated-edges" };
