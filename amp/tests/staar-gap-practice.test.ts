import test from "node:test";
import assert from "node:assert/strict";
import {
  numberWords,
  staarGapCase,
  staarGapTemplateIds,
  staarGapTemplates,
} from "../src/math/staar-gap-practice";
import { generateProblem, gradeAnswer, templates } from "../src/math/engine";
import { problemLesson } from "../src/content/problem-lessons";
import { lessons } from "../src/content/lessons";
import { templateArchetypes } from "../src/curriculum/template-archetypes";

const SEEDS = 400;
type Case = ReturnType<typeof staarGapCase>;
const cache = new Map<string, Case[]>();
const cases = (id: string): Case[] => {
  if (!cache.has(id))
    cache.set(
      id,
      Array.from({ length: SEEDS }, (_, i) => staarGapCase(id, `sg:${i}`)),
    );
  return cache.get(id)!;
};
const ofVariant = (id: string, variant: string) =>
  cases(id).filter((c) => c.variant === variant);
const strip = (s: string) => s.replace(/\$/g, "");
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const choices = (c: Case) => {
  const response = c.problem.public.response;
  assert.equal(response.kind, "choice");
  if (response.kind !== "choice") throw new Error("choice expected");
  return response.options;
};
const correctLabel = (c: Case) =>
  choices(c).find((o) => o.id === c.problem.answer)!.label;
const mentions = (text: string, label: string) =>
  /^-?[\d,.]+$/.test(label)
    ? new RegExp(
        `(?<![\\d.,])${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\d]|[.,]\\d)`,
      ).test(text)
    : text.includes(label);
const nums = (s: string) => (s.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

/** Evaluate the TeX the generators write: numbers, fractions, roots, powers. */
function val(tex: string, x?: number): number {
  let s = tex
    .replace(/\$/g, "")
    .replace(/\{,\}/g, "")
    .replace(/\\ /g, " ")
    .replace(/\\times/g, "*")
    .replace(/\\div/g, "/")
    .replace(/\\%/g, "/100")
    .replace(/\\sqrt\{(\d+)\}/g, "Math.sqrt($1)")
    .replace(/\[/g, "(")
    .replace(/\]/g, ")");
  while (/\\frac\{[^{}]*\}\{[^{}]*\}/.test(s))
    s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "(($1)/($2))");
  s = s.replace(/(\d+(?:\.\d+)?|\((?:[^()]|\([^()]*\))*\))\^\{2\}/g, "($1**2)");
  s = s.replace(/(\d|\))\(/g, "$1*(").replace(/(\d|\))x/g, "$1*x");
  s = s.replace(/(?<![\w.)])x/g, "(x)").replace(/-\(x\)/g, "-1*(x)");
  assert.match(s, /^[0-9+\-*/(). xMath,sqrt]*$/, s);
  return Function("x", `return (${s})`)(x) as number;
}

const wordValues: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};
/** Independent reader of number words (not the generator's writer). */
function wordsToNumber(text: string): number {
  let total = 0;
  let part = 0;
  for (const raw of text.replace(/,/g, "").split(/[\s-]+/)) {
    if (raw === "hundred") part *= 100;
    else if (raw === "thousand") {
      total += part * 1000;
      part = 0;
    } else {
      assert.ok(raw in wordValues, raw);
      part += wordValues[raw]!;
    }
  }
  return total + part;
}

test("every template is registered, deterministic, reaches the engine and has all variants", () => {
  const expected: Record<string, number> = {
    "staar-nested-grouping": 4,
    "staar-signed-exponent-order": 4,
    "staar-number-word-form": 3,
    "staar-rename-percent-fraction-decimal": 4,
    "staar-ratio-statements": 3,
    "staar-story-model-choice": 4,
    "staar-rate-equation-choice": 1,
    "staar-order-decimals": 3,
    "staar-order-mixed-forms": 3,
    "staar-decimal-operations": 4,
    "staar-salary-percent": 3,
    "staar-measure-chains": 3,
    "staar-multistep-stories": 5,
    "staar-line-from-points": 3,
    "staar-stem-leaf-combine": 2,
    "staar-dot-plot-threshold": 3,
    "staar-money-vocabulary": 3,
    "staar-table-rule-choice": 2,
    "staar-multistep-equations": 3,
    "staar-experiment-probability": 2,
    "staar-number-sets": 3,
  };
  assert.deepEqual(
    [...staarGapTemplateIds].sort(),
    Object.keys(expected).sort(),
  );
  for (const template of staarGapTemplates) {
    assert.ok(
      templates.some((t) => t.id === template.id),
      template.id,
    );
    assert.ok(templateArchetypes[template.id]?.length, template.id);
  }
  for (const id of staarGapTemplateIds) {
    assert.equal(
      new Set(cases(id).map((c) => c.variant)).size,
      expected[id],
      id,
    );
    for (let i = 0; i < 25; i++) {
      const g = generateProblem(id, `sg:${i}`);
      assert.deepEqual(g.public, cases(id)[i]!.problem.public);
      assert.equal(g.answer, cases(id)[i]!.problem.answer);
      assert.deepEqual(
        staarGapCase(id, `sg:${i}`).problem.public,
        cases(id)[i]!.problem.public,
      );
    }
  }
});

test("choice problems have four distinct options with feedback, one correct, and no leaked answer", () => {
  for (const id of staarGapTemplateIds)
    for (const c of cases(id)) {
      const { problem } = c;
      const response = problem.public.response;
      if (response.kind !== "choice") {
        assert.match(problem.answer, /^-?\d+(\.\d+)?(\/\d+)?$/, id);
        assert.ok(problem.hint.length > 20, id);
        assert.ok(gradeAnswer(problem, problem.answer), id);
        continue;
      }
      const labels = response.options.map((o) => o.label);
      assert.equal(new Set(labels).size, 4, `${id}: ${labels}`);
      assert.equal(
        response.options.filter((o) => o.id === problem.answer).length,
        1,
        id,
      );
      for (const o of response.options)
        if (o.id !== problem.answer)
          assert.ok(problem.choiceFeedback?.[o.id]?.length, `${id} ${o.label}`);
      const correct = correctLabel(c);
      assert.ok(!mentions(problem.hint, correct), `${id}: ${problem.hint}`);
      // The answer of an ordering-by-position question is one of the listed values.
      if (c.variant !== "kth")
        assert.ok(!mentions(problem.public.prompt, correct), `${id}`);
      assert.ok(problem.explanation.length >= 2, id);
    }
});

test("nested grouping and signed order of operations match an independent evaluation", () => {
  for (const c of cases("staar-nested-grouping")) {
    const prompt = c.problem.public.prompt;
    if (c.variant.startsWith("verbal")) {
      const [big, b, d] = nums(prompt);
      assert.equal(
        Number(c.problem.answer),
        big! * (c.variant === "verbal-sum" ? b! + d! : b! - d!),
      );
    } else {
      const expression = /\$(.*)\$/.exec(prompt)![1]!.replace(/^Evaluate /, "");
      assert.equal(Number(c.problem.answer), val(expression));
    }
  }
  for (const c of cases("staar-signed-exponent-order")) {
    const expression = /\$(.*)\$/.exec(c.problem.public.prompt)![1]!;
    assert.equal(Number(c.problem.answer), val(expression));
  }
  const bases = ofVariant("staar-signed-exponent-order", "negative-base");
  assert.ok(bases.every((c) => /-\d+\^\{2\}/.test(c.problem.public.prompt)));
  assert.ok(
    ofVariant("staar-nested-grouping", "bracket").every((c) =>
      /\[\(/.test(c.problem.public.prompt),
    ),
  );
});

test("number words agree with an independent reader and place-value counts", () => {
  for (const n of [1, 21, 100, 305, 1000, 12062, 100000, 999999])
    assert.equal(wordsToNumber(numberWords(n)), n);
  for (const c of ofVariant("staar-number-word-form", "whole-words")) {
    const sum = val(
      c.problem.public.prompt.replace(/^[^$]*\$/, "").replace(/\$.*$/, ""),
    );
    assert.equal(wordsToNumber(correctLabel(c)), sum);
    for (const o of choices(c))
      if (o.label !== correctLabel(c))
        assert.notEqual(wordsToNumber(o.label), sum);
  }
  for (const c of ofVariant("staar-number-word-form", "decimal-words")) {
    const terms = /\$(.*)\$/.exec(c.problem.public.prompt)![1]!;
    const value = val(terms);
    const [whole, rest] = correctLabel(c).split(" and ") as [string, string];
    const milli = wordsToNumber(rest.replace(" thousandths", ""));
    assert.ok(near(wordsToNumber(whole) + milli / 1000, value), terms);
    assert.ok(rest.endsWith("thousandths"));
  }
  for (const c of ofVariant("staar-number-word-form", "place-units")) {
    const [hundreds, tens, ones] = nums(c.problem.public.prompt);
    assert.equal(
      Number(correctLabel(c).replace(",", "")),
      hundreds! * 100 + tens! * 10 + ones!,
    );
    assert.ok(hundreds! >= 11, "counts of hundreds exceed nine");
  }
});

test("renaming forms are exact", () => {
  for (const c of cases("staar-rename-percent-fraction-decimal")) {
    const prompt = c.problem.public.prompt;
    const label = correctLabel(c);
    if (c.variant === "percent-to-decimal") {
      const p = Number(/equal to ([\d.]+)%/.exec(prompt)![1]);
      assert.ok(near(Number(label), p / 100), prompt);
    } else if (c.variant === "decimal-to-mixed") {
      const [lhs, rhs] = strip(label).split("=") as [string, string];
      const m = /^(\d+)\\frac\{(\d+)\}\{(\d+)\}$/.exec(rhs)!;
      assert.ok(
        near(Number(lhs), Number(m[1]) + Number(m[2]) / Number(m[3])),
        label,
      );
      for (const o of choices(c)) {
        if (o.label === label) continue;
        const [l2, r2] = strip(o.label).split("=") as [string, string];
        assert.ok(
          !near(val(l2), val(r2.replace(/^(\d+)\\frac/, "$1+\\frac"))),
          o.label,
        );
      }
    } else {
      const [n, d] = nums(prompt.replace(/\\frac/g, ""));
      const truth = n! / d!;
      assert.ok(truth > 1);
      const got =
        c.variant === "fraction-to-decimal"
          ? Number(label)
          : val(label.replace("%", "\\%"));
      assert.ok(near(got, truth), `${prompt} ${label}`);
    }
  }
});

test("ratio statements are exact", () => {
  for (const c of ofVariant("staar-ratio-statements", "simplest")) {
    const [a, b] = nums(c.problem.public.prompt);
    const [p, q] = strip(correctLabel(c)).split(":").map(Number) as [
      number,
      number,
    ];
    assert.equal(p * b!, q * a!);
    const g = (x: number, y: number): number => (y ? g(y, x % y) : x);
    assert.equal(g(p, q), 1);
    assert.ok(/ratio of (\S+( \S+)?) to/.test(c.problem.public.prompt));
  }
  for (const c of ofVariant("staar-ratio-statements", "part-total")) {
    const [a, b, total] = nums(c.problem.public.prompt);
    assert.equal(Number(correctLabel(c)) * (a! + b!), total! * a!);
  }
  for (const c of ofVariant("staar-ratio-statements", "unit-rate")) {
    const [a, b] = nums(c.problem.public.prompt);
    const m = /^(\d+) (\w+) per (\w+)$/.exec(correctLabel(c))!;
    assert.equal(Number(m[1]) * b!, a!);
    assert.ok(c.problem.public.prompt.includes(`in ${m[2]} per ${m[3]}`));
  }
});

test("unit rates sometimes offer a unit-order trap", () => {
  const trapped = ofVariant("staar-ratio-statements", "unit-rate").filter(
    (c) => {
      const right = /^(\d+) (\w+) per (\w+)$/.exec(correctLabel(c))!;
      return choices(c).some((o) => {
        const m = /^(\d+) (\w+) per (\w+)$/.exec(o.label);
        return !!m && m[2] !== right[2];
      });
    },
  );
  assert.ok(trapped.length > 20);
});

test("story models: the right equation holds and the others do not", () => {
  for (const c of ofVariant(
    "staar-story-model-choice",
    "share-unknown-factor",
  )) {
    const [total, g] = nums(c.problem.public.prompt);
    const n = total! / g!;
    const holds = (label: string) => {
      const [l, r] = strip(label).split("=") as [string, string];
      const sub = (t: string) => t.replace(/\bn\b/g, `(${n})`);
      return near(val(sub(l)), val(sub(r)));
    };
    assert.ok(holds(correctLabel(c)));
    for (const o of choices(c))
      if (o.label !== correctLabel(c)) assert.ok(!holds(o.label));
    assert.match(correctLabel(c), /\\times n=/);
  }
  for (const c of ofVariant("staar-story-model-choice", "unknown-part")) {
    const [a, b, total] = nums(c.problem.public.prompt.replace(/\$f\$/g, ""));
    const f = Math.round((total! - a! - b!) * 100) / 100;
    const holds = (label: string) => {
      const [l, r] = strip(label).split("=") as [string, string];
      const sub = (t: string) => t.replace(/\bf\b/g, `(${f})`);
      return near(val(sub(l)), val(sub(r)));
    };
    assert.ok(holds(correctLabel(c)));
    for (const o of choices(c))
      if (o.label !== correctLabel(c)) assert.ok(!holds(o.label));
  }
  for (const v of ["not-equation", "not-expression"])
    for (const c of ofVariant("staar-story-model-choice", v)) {
      const [total, b] = nums(c.problem.public.prompt);
      const m = total! / b!;
      const holds = (label: string) => {
        const t = strip(label);
        if (!t.includes("=")) return near(val(t), m);
        const [l, r] = t.split("=") as [string, string];
        const sub = (s: string) => s.replace(/\bm\b/g, `(${m})`);
        return near(val(sub(l)), val(sub(r)));
      };
      assert.ok(!holds(correctLabel(c)), "the asked-for choice does not fit");
      for (const o of choices(c))
        if (o.label !== correctLabel(c)) assert.ok(holds(o.label));
    }
  for (const c of cases("staar-rate-equation-choice")) {
    const [total, periods] = nums(c.problem.public.prompt);
    const k = total! / periods!;
    const label = strip(correctLabel(c));
    assert.ok(near(val(label.split("=")[1]!.replace(/[a-z]$/, "")), k), label);
    for (const o of choices(c)) {
      if (o.label === correctLabel(c)) continue;
      const rhs = strip(o.label).split("=")[1]!;
      assert.ok(
        !near(
          val(rhs.replace(/[a-z]$/, "").replace(/^[a-z]\+|\+.*$/, "") || "0"),
          k,
        ) || /\+/.test(rhs),
        o.label,
      );
    }
  }
});

test("ordering families sort correctly in the stated direction", () => {
  for (const c of ofVariant("staar-order-decimals", "list-ascending").concat(
    ofVariant("staar-order-decimals", "list-descending"),
  )) {
    const given = /numbers ([\d., ]+) in order/
      .exec(c.problem.public.prompt)![1]!
      .split(", ")
      .map(Number);
    const listed = strip(correctLabel(c)).split(",\\ ").map(Number);
    assert.deepEqual(
      [...listed].sort((x, y) => x - y),
      [...given].sort((x, y) => x - y),
    );
    const ascending = c.variant === "list-ascending";
    for (let i = 1; i < listed.length; i++)
      assert.ok(
        ascending ? listed[i]! > listed[i - 1]! : listed[i]! < listed[i - 1]!,
      );
    assert.ok(new Set(given).size === 4);
  }
  for (const c of ofVariant("staar-order-decimals", "kth")) {
    const prompt = c.problem.public.prompt;
    const given = /are ([\d., ]+) \w+\./
      .exec(prompt)![1]!
      .split(", ")
      .map(Number);
    const word = /which is (\w+)\?/.exec(prompt)![1]!;
    const position = { second: 2, third: 3 }[word as "second"]!;
    assert.equal(
      Number(correctLabel(c)),
      [...given].sort((x, y) => x - y)[position - 1],
    );
  }
  for (const v of ["signed-list", "four-forms"])
    for (const c of ofVariant("staar-order-mixed-forms", v)) {
      const given = (c.problem.public.prompt.match(/\$[^$]+\$/g) ?? []).map(
        (t) => val(t),
      );
      const listed = strip(correctLabel(c))
        .split(",\\ ")
        .map((t) => val(t));
      assert.equal(listed.length, given.length);
      for (let i = 1; i < listed.length; i++)
        assert.ok(listed[i]! > listed[i - 1]!, correctLabel(c));
      assert.deepEqual(
        [...listed].sort((x, y) => x - y).map((x) => x.toFixed(9)),
        [...given].sort((x, y) => x - y).map((x) => x.toFixed(9)),
      );
    }
  for (const c of ofVariant("staar-order-mixed-forms", "true-comparison")) {
    const holds = (label: string) => {
      const m = /^(.*?)([<>])(.*)$/.exec(strip(label))!;
      const [l, r] = [val(m[1]!), val(m[3]!)];
      return m[2] === "<" ? l < r : l > r;
    };
    assert.ok(holds(correctLabel(c)));
    for (const o of choices(c))
      if (o.label !== correctLabel(c)) assert.ok(!holds(o.label));
  }
  const fourForms = ofVariant("staar-order-mixed-forms", "four-forms");
  assert.ok(
    fourForms.every(
      (c) =>
        /\\sqrt/.test(c.problem.public.prompt) &&
        /\\%/.test(c.problem.public.prompt),
    ),
  );
});

test("decimal operations, salaries, measurement and stories match independent arithmetic", () => {
  const exact = (c: Case) => Number(c.problem.answer);
  for (const c of ofVariant(
    "staar-decimal-operations",
    "whole-times-hundredths",
  )) {
    const [n, each] = nums(c.problem.public.prompt);
    assert.ok(near(exact(c), Math.round(n! * each! * 100) / 100));
  }
  for (const c of ofVariant(
    "staar-decimal-operations",
    "total-divided-by-whole",
  )) {
    const [total, weeks] = nums(c.problem.public.prompt);
    assert.ok(near(exact(c) * weeks!, total!));
    assert.ok(gradeAnswer(c.problem, c.problem.answer));
  }
  for (const c of ofVariant("staar-decimal-operations", "whole-minus-tenths")) {
    const [w, used, other] = nums(c.problem.public.prompt);
    assert.ok(near(exact(c), Math.round((w! - used! - other!) * 10) / 10));
    assert.ok(exact(c) > 0);
  }
  for (const c of ofVariant(
    "staar-decimal-operations",
    "decimal-minus-unit-fraction",
  )) {
    const m = /\$([\d.]+)-\\frac\{1\}\{(\d+)\}\$/.exec(
      c.problem.public.prompt,
    )!;
    assert.ok(near(exact(c), Number(m[1]) - 1 / Number(m[2])));
  }
  assert.ok(
    ofVariant("staar-decimal-operations", "decimal-minus-unit-fraction").some(
      (c) => exact(c) < 0,
    ),
    "negative results appear",
  );
  for (const c of ofVariant("staar-salary-percent", "raise")) {
    const [salary, p] = nums(c.problem.public.prompt.replace(/,/g, ""));
    assert.equal(exact(c), (salary! * p!) / 100);
  }
  for (const c of ofVariant("staar-salary-percent", "new-salary")) {
    const [salary, p] = nums(c.problem.public.prompt.replace(/,/g, ""));
    assert.equal(exact(c), salary! + (salary! * p!) / 100);
  }
  for (const c of ofVariant("staar-salary-percent", "years-difference")) {
    const figure = JSON.stringify(c.problem.public.figure);
    const [a, b] = (figure.match(/\d{2},\d{3}/g) ?? []).map((t) =>
      Number(t.replace(",", "")),
    );
    const years = nums(c.problem.public.prompt.replace(/,/g, "")).at(-1)!;
    assert.equal(exact(c), (a! - b!) * years);
  }
  for (const c of ofVariant("staar-measure-chains", "perimeter-to-area")) {
    const [perimeter, length] = nums(c.problem.public.prompt);
    assert.equal(exact(c), length! * (perimeter! / 2 - length!));
  }
  for (const c of ofVariant("staar-measure-chains", "decimal-perimeter")) {
    const [l, w] = nums(c.problem.public.prompt);
    assert.ok(near(exact(c), Math.round(2 * (l! + w!) * 100) / 100));
    assert.ok(/\d\.\d/.test(c.problem.public.prompt));
  }
  for (const c of ofVariant("staar-measure-chains", "square-area")) {
    const [perimeter] = nums(c.problem.public.prompt);
    assert.ok(near(exact(c), (perimeter! / 4) ** 2));
  }
  for (const c of ofVariant("staar-multistep-stories", "add-then-subtract")) {
    const [fall, winter, spring] = nums(c.problem.public.prompt);
    assert.equal(exact(c), fall! + winter! - spring!);
  }
  for (const c of ofVariant("staar-multistep-stories", "share-then-regroup")) {
    const [total, friends, pile] = nums(c.problem.public.prompt);
    assert.equal(exact(c), total! / friends! / pile!);
  }
  for (const c of ofVariant(
    "staar-multistep-stories",
    "product-then-servings",
  )) {
    const [pizzas, slices, serving] = nums(c.problem.public.prompt);
    assert.equal(exact(c), Math.floor((pizzas! * slices!) / serving!));
    assert.notEqual((pizzas! * slices!) % serving!, 0);
  }
  for (const c of ofVariant(
    "staar-multistep-stories",
    "liters-to-milliliters",
  )) {
    const [liters, glasses] = nums(c.problem.public.prompt);
    assert.ok(near(exact(c), Math.round(liters! * glasses! * 1000)));
  }
  for (const c of ofVariant("staar-multistep-stories", "conversion-row")) {
    const m = /that (\d+) \w+ = ([\d,]+) \w+\. How many \w+ are in (\d+)/.exec(
      c.problem.public.prompt,
    )!;
    assert.equal(
      exact(c),
      (Number(m[2]!.replace(",", "")) / Number(m[1])) * Number(m[3]),
    );
  }
});

test("lines from points are exact", () => {
  for (const c of ofVariant("staar-line-from-points", "two-points")) {
    const [x1, y1, x2, y2] = nums(
      c.problem.public.prompt.replace(/\\\w+/g, ""),
    );
    const m = (y2! - y1!) / (x2! - x1!);
    const b = y1! - m * x1!;
    assert.equal(strip(correctLabel(c)), `m=${m},\\ b=${b}`);
  }
  for (const c of ofVariant("staar-line-from-points", "slope-and-point")) {
    const prompt = c.problem.public.prompt;
    const sm =
      /slope \$(-?)\\frac\{(\d+)\}\{(\d+)\}\$ and passes through \$\((-?\d+), (-?\d+)\)\$/.exec(
        prompt,
      )!;
    const slope = (sm[1] ? -1 : 1) * (Number(sm[2]) / Number(sm[3]));
    const [x1, y1] = [Number(sm[4]), Number(sm[5])];
    const line = (label: string) => {
      const t = strip(label).replace(/^y=/, "");
      return (x: number) => val(t, x);
    };
    assert.ok(near(line(correctLabel(c))(x1), y1));
    assert.ok(near(line(correctLabel(c))(x1 + 1) - y1, slope));
    for (const o of choices(c))
      if (o.label !== correctLabel(c))
        assert.ok(!near(line(o.label)(x1), y1), o.label);
  }
  for (const c of ofVariant("staar-line-from-points", "standard-form")) {
    const [A, B] = nums(
      /\$(.*?)\$/
        .exec(c.problem.public.prompt)![1]!
        .replace(/y=.*/, "")
        .replace(/x([+-])/, "x $1"),
    );
    const sign = /x-/.test(c.problem.public.prompt) ? -1 : 1;
    assert.ok(near(val(strip(correctLabel(c))), -A! / (sign * Math.abs(B!))));
  }
  const fractional = ofVariant("staar-line-from-points", "slope-and-point");
  assert.ok(
    fractional.some((c) => /slope \$-/.test(c.problem.public.prompt)),
    "negative fractional slopes appear",
  );
});

test("plots, tables, equations and probability match independent derivations", () => {
  for (const c of cases("staar-stem-leaf-combine")) {
    const { values } = c.model as { values: number[] };
    const s = [...values].sort((a, b) => a - b);
    const n = s.length;
    assert.equal(
      Number(c.problem.answer),
      c.variant === "sum-two-greatest"
        ? s[n - 1]! + s[n - 2]!
        : s[n - 1]! - s[1]!,
    );
    const figure = JSON.stringify(c.problem.public.figure);
    // Every leaf of the figure belongs to the model's values.
    assert.ok(figure.includes("plot"));
    assert.ok(c.problem.public.prompt.includes("Key:"));
  }
  for (const c of cases("staar-dot-plot-threshold")) {
    const figure = c.problem.public.figure as { values: number[] };
    const t = nums(
      c.problem.public.prompt
        .replace(/The dot plot.*?\.\s/, "")
        .replace(/Each dot.*?How many/, ""),
    ).at(-1)!;
    const phrase = /had an? \w+ (less than|at least|greater than) (\d+)\?/.exec(
      c.problem.public.prompt,
    )!;
    const bound = Number(phrase[2]);
    assert.equal(t, bound);
    const count = figure.values.filter((v) =>
      phrase[1] === "less than"
        ? v < bound
        : phrase[1] === "at least"
          ? v >= bound
          : v > bound,
    ).length;
    assert.equal(Number(c.problem.answer), count);
  }
  for (const c of cases("staar-table-rule-choice")) {
    const prompt = c.problem.public.prompt;
    const mul = /times its input/.test(prompt);
    const k = Number(
      /(\d+) times|x\+(\d+)/.exec(strip(prompt))!.slice(1).find(Boolean),
    );
    const parse = (label: string) => {
      const m = /x&([\d&]+)\\\\\\hline y&([\d&]+)/.exec(label)!;
      return [
        m[1]!.split("&").map(Number),
        m[2]!.split("&").map(Number),
      ] as const;
    };
    const fits = (label: string) => {
      const [xs, ys] = parse(label);
      return xs.every((x, i) => ys[i] === (mul ? k * x : x + k));
    };
    assert.ok(fits(correctLabel(c)));
    for (const o of choices(c))
      if (o.label !== correctLabel(c)) assert.ok(!fits(o.label));
  }
  for (const c of cases("staar-multistep-equations")) {
    const t = strip(
      /\$(.*)\$/.exec(c.problem.public.prompt)![1]!.replace(/^Solve /, ""),
    );
    const [l, r] = t.split("=") as [string, string];
    const f = (x: number) => val(l, x) - val(r, x);
    const answer = Number(c.problem.answer);
    assert.ok(near(f(answer), 0), `${t} x=${answer}`);
    assert.ok(!near(f(answer + 1), 0), "unique solution");
    assert.ok(Number.isInteger(answer));
  }
  const eq = (v: string) => ofVariant("staar-multistep-equations", v);
  assert.ok(
    eq("distribute-negative").every((c) =>
      /^Solve \$-\d+\(/.test(c.problem.public.prompt),
    ),
  );
  assert.ok(
    eq("fraction-coefficients").every((c) =>
      /\\frac/.test(c.problem.public.prompt),
    ),
  );
  for (const c of ofVariant("staar-experiment-probability", "experimental")) {
    const { counts, i, j, trials } = c.model as {
      counts: number[];
      i: number;
      j: number;
      trials: number;
    };
    assert.equal(
      counts.reduce((a, b) => a + b, 0),
      trials,
    );
    const [n, d] = c.problem.answer.split("/").map(Number) as [number, number];
    assert.ok(near((n ?? 0) / (d ?? 1), (counts[i]! + counts[j]!) / trials));
  }
  for (const c of ofVariant(
    "staar-experiment-probability",
    "with-replacement",
  )) {
    const [cards, red, zero] = nums(c.problem.public.prompt);
    const [n, d] = c.problem.answer.split("/").map(Number) as [number, number];
    assert.ok(near(n / d, (red! / cards!) * (zero! / cards!)));
    assert.ok(gradeAnswer(c.problem, `${red! * zero!}/${cards! * cards!}`));
  }
});

test("number sets, money words and vocabulary stay mathematically honest", () => {
  const kind = (label: string) => {
    const v = val(
      strip(label)
        .replace(/^\\frac\{-(\d+)\}\{(\d+)\}$/, "-($1/$2)")
        .replace(/\\frac\{(\d+)\}\{(\d+)\}$/, "($1/$2)"),
    );
    if (Number.isInteger(v) && v >= 0) return "whole";
    if (Number.isInteger(v)) return "integer";
    return "rational";
  };
  const wanted: Record<string, string> = {
    "whole numbers": "whole",
    "integers that are not whole numbers": "integer",
    "rational numbers that are not integers": "rational",
  };
  for (const c of ofVariant("staar-number-sets", "belongs")) {
    const region = /region for (.*)\?/.exec(c.problem.public.prompt)![1]!;
    assert.equal(kind(correctLabel(c)), wanted[region], correctLabel(c));
    for (const o of choices(c))
      if (o.label !== correctLabel(c))
        assert.notEqual(kind(o.label), wanted[region]);
  }
  for (const c of ofVariant("staar-number-sets", "not-in-set")) {
    const integers = /for the integers/.test(c.problem.public.prompt);
    const inside = (label: string) =>
      integers ? kind(label) !== "rational" : kind(label) === "whole";
    assert.ok(!inside(correctLabel(c)));
    for (const o of choices(c))
      if (o.label !== correctLabel(c)) assert.ok(inside(o.label));
  }
  for (const c of ofVariant("staar-number-sets", "fix-placement")) {
    const m = /student put (\$.*?\$) in the region for (.*?)\. Which/.exec(
      c.problem.public.prompt,
    )!;
    const actual = kind(m[1]!);
    assert.notEqual(actual, wanted[m[2]!], "the student's placement is wrong");
    const target = /Move it to the region for (.*)\./.exec(
      correctLabel(c),
    )![1]!;
    assert.equal(wanted[target], actual);
  }
  for (const c of cases("staar-money-vocabulary").filter(
    (x) => x.variant !== "credit",
  )) {
    const { rows, target, wantVariable } = c.model as {
      rows: { name: string; amounts: number[]; fixed: boolean }[];
      target: { name: string; amounts: number[] };
      wantVariable: boolean;
    };
    const varies = (r: { amounts: number[] }) => new Set(r.amounts).size > 1;
    assert.equal(varies(target), wantVariable);
    assert.equal(rows.filter((r) => varies(r) === wantVariable).length, 1);
    assert.equal(correctLabel(c), target.name);
  }
  for (const c of ofVariant("staar-money-vocabulary", "credit")) {
    assert.match(
      correctLabel(c),
      /pay the store back|pays the card company back later/,
    );
    assert.ok(
      choices(c).some((o) => /sales tax/.test(o.label)),
      "the tax distractor is always offered",
    );
  }
});

test("every new template is bound to one reference lesson, a method and a worked example", () => {
  for (const id of staarGapTemplateIds) {
    assert.equal(
      lessons.filter((l) => l.templateIds.includes(id)).length,
      1,
      id,
    );
    const lesson = problemLesson(id, "lesson-seed");
    assert.ok(lesson.example.steps.length > 0, id);
    assert.ok(lesson.principle, id);
    assert.ok(lesson.goal.length <= 140, `${id}: ${lesson.goal.length}`);
    assert.ok(lesson.method.length >= 3, id);
  }
});
