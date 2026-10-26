import test from "node:test";
import assert from "node:assert/strict";
import {
  k8StateNumberCase,
  k8StateNumberTemplates,
} from "../src/math/k8-state-number-practice";
import { generateProblem, templates } from "../src/math/engine";
import { problemLesson } from "../src/content/problem-lessons";

const VARIANTS: Record<string, string[]> = {
  "divisibility-rule-check": [
    "pick-two-rules",
    "pick-digit-sum",
    "pick-last-digits",
    "missing-digit-sum",
    "missing-digit-even",
  ],
  "prime-composite-sort": [
    "pick-prime-to-100",
    "pick-prime-to-144",
    "pick-composite",
    "neither",
  ],
  "prime-factorization-exponents": [
    "direct-to-100",
    "direct-to-144",
    "tree-start",
  ],
  "prime-factorization-value": ["evaluate", "greatest-prime", "count-factors"],
  "decimal-money-change": [
    "change-one-item",
    "change-two-items",
    "more-needed",
    "unknown-cost",
    "equal-groups",
  ],
  "fewest-coins-change": ["coins-only", "bills-and-coins", "from-a-payment"],
  "compare-money-sets": ["most", "least", "exact-amount"],
  "customary-unit-rename": ["rename", "story", "compare"],
  "customary-unit-reverse": ["rename-up", "whole-units", "two-steps"],
  "customary-mixed-units": [
    "to-single-unit",
    "to-mixed",
    "add-regroup",
    "subtract-regroup",
  ],
  "customary-unit-choice": ["length", "weight", "capacity"],
  "compatible-number-estimate": [
    "divide",
    "multiply-five",
    "multiply-25",
    "front-end",
  ],
  "benchmark-percent-estimate": ["tip", "sales-tax", "discount", "sale-price"],
};

const num = (s: string) => Number(s.replace(/,/g, ""));
const isPrime = (n: number) => {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
};
const correctLabel = (p: ReturnType<typeof generateProblem>) => {
  const r = p.public.response;
  assert.equal(r.kind, "choice");
  if (r.kind !== "choice") throw new Error("choice");
  return r.options.find((o) => o.id === p.answer)!.label;
};
const labels = (p: ReturnType<typeof generateProblem>) => {
  const r = p.public.response;
  return r.kind === "choice" ? r.options.map((o) => o.label) : [];
};
const dollars = (s: string) => Math.round(Number(s) * 100);
/** Fewest pieces by dynamic programming, independent of the greedy generator. */
function fewest(cents: number, values: number[]) {
  const best = [0];
  for (let c = 1; c <= cents; c++)
    best[c] =
      1 + Math.min(...values.filter((v) => v <= c).map((v) => best[c - v]!));
  return best[cents]!;
}

test("every variant is reachable, deterministic and engine-routed", () => {
  for (const t of k8StateNumberTemplates) {
    const seen = new Set<string>();
    for (let seed = 0; seed < 400; seed++) {
      const c = k8StateNumberCase(t.id, `s${seed}`);
      seen.add(c.variant);
      if (seed < 40) {
        const again = generateProblem(t.id, `s${seed}`);
        assert.deepEqual(again, generateProblem(t.id, `s${seed}`));
        assert.equal(again.public.templateId, t.id);
        assert.equal(again.public.skillId, t.skillId);
        assert.equal(again.answer, c.problem.answer);
      }
    }
    assert.deepEqual([...seen].sort(), [...VARIANTS[t.id]!].sort(), t.id);
    assert.ok(templates.some((x) => x.id === t.id));
    assert.ok(problemLesson(t.id, "library").method.length >= 1);
  }
});

test("choices are distinct, exactly one is correct, and prompts do not reveal the answer", () => {
  for (const t of k8StateNumberTemplates)
    for (let seed = 0; seed < 400; seed++) {
      const { variant, problem: p } = k8StateNumberCase(t.id, `s${seed}`);
      assert.ok(p.hint.length > 20 && p.explanation.length >= 2);
      const r = p.public.response;
      if (r.kind === "number") {
        assert.ok(/^\d+(\.\d\d)?$/.test(p.answer), `${t.id} ${p.answer}`);
        assert.ok(
          !new RegExp(
            `(?<![\\d.,])${p.answer.replace(".", "\\.")}(?![\\d]|[.,]\\d)`,
          ).test(p.public.prompt + p.hint),
          `${t.id} leaks ${p.answer}`,
        );
        continue;
      }
      assert.equal(r.kind, "choice");
      if (r.kind !== "choice") continue;
      const count = t.id === "compare-money-sets" ? 3 : 4;
      assert.equal(r.options.length, count);
      assert.equal(new Set(r.options.map((o) => o.label)).size, count);
      const wrong = r.options.filter((o) => o.id !== p.answer);
      assert.equal(wrong.length, count - 1);
      for (const o of wrong) assert.ok(p.choiceFeedback![o.id]!.length > 10);
      if (variant.startsWith("missing-digit")) continue;
      const label = correctLabel(p);
      if (/^[\d,]+$/.test(label))
        assert.ok(
          !new RegExp(`(?<![\\d.,])${label}(?![\\d]|[.,]\\d)`).test(
            p.public.prompt + p.hint,
          ),
        );
    }
});

test("number theory answers match independent checks", () => {
  for (let seed = 0; seed < 400; seed++) {
    let p = generateProblem("divisibility-rule-check", `s${seed}`);
    let m = /divisible by (\d+)\?$/.exec(p.public.prompt)!;
    const d = Number(m[1]);
    if (/hidden/.test(p.public.prompt)) {
      const shown = /hidden: ([\d▢]+)\./.exec(p.public.prompt)![1]!;
      const ok = labels(p).filter(
        (x) => Number(shown.replace("▢", x)) % d === 0,
      );
      assert.deepEqual(ok, [correctLabel(p)]);
    } else {
      const ok = labels(p).filter((x) => num(x) % d === 0);
      assert.deepEqual(ok, [correctLabel(p)]);
    }
    p = generateProblem("prime-composite-sort", `s${seed}`);
    const ls = labels(p).map(Number);
    const c = Number(correctLabel(p));
    if (/neither/.test(p.public.prompt)) assert.equal(c, 1);
    else if (/prime\?/.test(p.public.prompt)) {
      assert.deepEqual(ls.filter(isPrime), [c]);
      assert.ok(ls.every((x) => x <= 144));
    } else
      assert.deepEqual(
        ls.filter((x) => x > 1 && !isPrime(x)),
        [c],
      );
    p = generateProblem("prime-factorization-exponents", `s${seed}`);
    const n = Number(
      /(?:factorization of|starts with) (\d+)/.exec(p.public.prompt)![1],
    );
    const value = (label: string) => {
      const parts = label.replace(/\$/g, "").split("\\times ");
      return parts.map((x) => {
        const [b, e] = x.replace(/[{}]/g, "").split("^").map(Number);
        return { b: b!, e: e ?? 1 };
      });
    };
    const isFactorization = (label: string) => {
      const f = value(label);
      return (
        f.every((x) => isPrime(x.b)) &&
        f.reduce((a, x) => a * x.b ** x.e, 1) === n &&
        f.every((x, i) => i === 0 || f[i - 1]!.b < x.b)
      );
    };
    assert.deepEqual(labels(p).filter(isFactorization), [correctLabel(p)]);
    p = generateProblem("prime-factorization-value", `s${seed}`);
    const prompt = p.public.prompt;
    if (/has the prime factorization/.test(prompt)) {
      const f = /factorization \$(.*)\$\?/
        .exec(prompt)![1]!
        .split("\\times ")
        .map((x) => x.replace(/[{}]/g, "").split("^").map(Number));
      assert.equal(
        Number(p.answer),
        f.reduce((a, [b, e]) => a * b! ** (e ?? 1), 1),
      );
    } else {
      m = /(\d+)/.exec(prompt)!;
      let k = Number(m[1]);
      const primes: number[] = [];
      for (let q = 2; k > 1; q++)
        while (k % q === 0) {
          primes.push(q);
          k /= q;
        }
      assert.equal(
        Number(p.answer),
        /greatest/.test(prompt) ? Math.max(...primes) : primes.length,
      );
    }
  }
});

test("money answers match independent checks", () => {
  for (let seed = 0; seed < 400; seed++) {
    const { variant, problem: p } = k8StateNumberCase(
      "decimal-money-change",
      `s${seed}`,
    );
    const prompt = p.public.prompt;
    const nums = [
      ...prompt.matchAll(/(\d+(?:\.\d\d)?) dollars?|(\d+)-dollar bill/g),
    ].map((x) => dollars(x[1] ?? x[2]!));
    const bill = (b: RegExpExecArray | null) => Number(b![1]) * 100;
    if (variant === "change-one-item" || variant === "change-two-items") {
      const paid = bill(/(\d+)-dollar bill/.exec(prompt));
      const costs = nums.filter((x) => x !== paid);
      assert.equal(dollars(p.answer), paid - costs.reduce((a, b) => a + b, 0));
    } else if (variant === "more-needed") {
      assert.equal(dollars(p.answer), nums[1]! - nums[0]!);
    } else if (variant === "unknown-cost") {
      const paid = bill(/(\d+)-dollar bill/.exec(prompt));
      assert.equal(
        dollars(p.answer),
        paid - nums.find((x) => x !== paid && x !== undefined)!,
      );
    } else {
      const q = Number(/buys (\d+)/.exec(prompt)![1]);
      const paid = bill(/(\d+)-dollar bill/.exec(prompt));
      const [unit, extra] = nums.filter((x) => x !== paid);
      assert.equal(dollars(p.answer), paid - q * unit! - extra!);
    }
    const f = generateProblem("fewest-coins-change", `s${seed}`);
    let cents: number;
    const cm = /owes (\d+) cents/.exec(f.public.prompt);
    const dm = /owes (\d+\.\d\d) dollars/.exec(f.public.prompt);
    const pm = /costs (\d+\.\d\d) dollars/.exec(f.public.prompt);
    if (cm) cents = Number(cm[1]);
    else if (dm) cents = dollars(dm[1]!);
    else cents = 500 - dollars(pm![1]!);
    const values = cm ? [25, 10, 5, 1] : [100, 25, 10, 5, 1];
    assert.equal(Number(f.answer), fewest(cents, values));
  }
});

test("compared money sets are valued from the drawn pieces", () => {
  const cents: Record<string, number> = {
    dollar: 100,
    quarter: 25,
    dime: 10,
    nickel: 5,
    penny: 1,
  };
  for (let seed = 0; seed < 400; seed++) {
    const p = generateProblem("compare-money-sets", `s${seed}`);
    assert.equal(p.public.figure?.kind, "money-sets");
    if (p.public.figure?.kind !== "money-sets") continue;
    const values = p.public.figure.sets.map((s) =>
      s.items.reduce((a, i) => a + cents[i]!, 0),
    );
    assert.equal(new Set(values).size, 3);
    assert.ok(p.public.figure.sets.every((s) => s.items.length <= 10));
    const chosen = labels(p).indexOf(correctLabel(p));
    const prompt = p.public.prompt;
    const target = /most/.test(prompt)
      ? Math.max(...values)
      : /least/.test(prompt)
        ? Math.min(...values)
        : Math.round(Number(/exactly (\d+\.\d\d)/.exec(prompt)![1]) * 100);
    assert.deepEqual(
      values.filter((v) => v === target),
      [values[chosen]],
    );
  }
});

const FACTS: Record<string, number> = {
  "foot/inches": 12,
  "yard/feet": 3,
  "yard/inches": 36,
  "mile/feet": 5280,
  "mile/yards": 1760,
  "pound/ounces": 16,
  "ton/pounds": 2000,
  "cup/fluid ounces": 8,
  "pint/cups": 2,
  "quart/pints": 2,
  "gallon/quarts": 4,
  "quart/cups": 4,
  "gallon/pints": 8,
  "gallon/cups": 16,
};
const singular = (w: string) =>
  ({
    feet: "foot",
    inches: "inch",
    yards: "yard",
    miles: "mile",
    pounds: "pound",
    ounces: "ounce",
    tons: "ton",
    cups: "cup",
    pints: "pint",
    quarts: "quart",
    gallons: "gallon",
    "fluid ounces": "fluid ounce",
  })[w] ?? w.replace(/s$/, "");
const WORDS =
  "(?:fluid ounces?|inch(?:es)?|f(?:eet|oot)|yards?|miles?|pounds?|ounces?|tons?|cups?|pints?|quarts?|gallons?)";
const factor = (big: string, small: string) => {
  const key = `${singular(big)}/${small.startsWith("foot") || small === "feet" ? "feet" : small}`;
  const k =
    FACTS[key] ??
    FACTS[
      `${singular(big)}/${small.replace(/s$/, "") === small ? small : small}`
    ];
  assert.ok(k, key);
  return k!;
};

test("customary conversions match independent checks", () => {
  for (let seed = 0; seed < 400; seed++) {
    let { variant, problem: p } = k8StateNumberCase(
      "customary-unit-rename",
      `s${seed}`,
    );
    if (variant === "rename") {
      const m = new RegExp(`^(\\d+) (${WORDS}) is how many (${WORDS})\\?`).exec(
        p.public.prompt,
      )!;
      assert.equal(Number(p.answer), Number(m[1]) * factor(m[2]!, m[3]!));
    } else if (variant === "story") {
      const m = new RegExp(`(\\d+) (${WORDS}).*? How many (${WORDS})`).exec(
        p.public.prompt,
      )!;
      assert.equal(Number(p.answer), Number(m[1]) * factor(m[2]!, m[3]!));
    } else {
      const m = new RegExp(
        `is (\\d+) (${WORDS}) and another is ([\\d,]+) (${WORDS})`,
      ).exec(p.public.prompt)!;
      assert.equal(
        Number(p.answer),
        Number(m[1]) * factor(m[2]!, m[4]!) - num(m[3]!),
      );
    }
    ({ variant, problem: p } = k8StateNumberCase(
      "customary-unit-reverse",
      `s${seed}`,
    ));
    if (variant === "rename-up") {
      const m = new RegExp(
        `^([\\d,]+) (${WORDS}) is how many (${WORDS})\\?`,
      ).exec(p.public.prompt)!;
      assert.equal(Number(p.answer), num(m[1]!) / factor(m[3]!, m[2]!));
    } else if (variant === "whole-units") {
      const m = new RegExp(
        `whole (${WORDS}) can be made from ([\\d,]+) (${WORDS})`,
      ).exec(p.public.prompt)!;
      assert.equal(
        Number(p.answer),
        Math.floor(num(m[2]!) / factor(m[1]!, m[3]!)),
      );
    } else {
      const m = new RegExp(
        `How many (${WORDS}) are in (\\d+) (${WORDS})\\? Use 1 \\w+ = ([\\d,]+) (${WORDS}) and 1 \\w+ = (\\d+)`,
      ).exec(p.public.prompt)!;
      assert.equal(Number(p.answer), Number(m[2]) * num(m[4]!) * Number(m[6]));
    }
  }
});

test("mixed measures are checked in the smaller unit", () => {
  const pair = (s: string) => {
    const m = /(\d+) (ft|yd|lb|gal|c) (\d+) (in|ft|oz|qt|fl oz)/.exec(s)!;
    return { big: Number(m[1]), small: Number(m[3]), bigUnit: m[2]! };
  };
  const per: Record<string, number> = { ft: 12, yd: 3, lb: 16, gal: 4, c: 8 };
  for (let seed = 0; seed < 400; seed++) {
    const p = generateProblem("customary-mixed-units", `s${seed}`);
    const prompt = p.public.prompt;
    const mixed = [
      ...prompt.matchAll(/(\d+ (?:ft|yd|lb|gal|c) \d+ (?:in|ft|oz|qt|fl oz))/g),
    ].map((x) => pair(x[1]!));
    const k = per[mixed[0]?.bigUnit ?? ""] ?? 0;
    const choices = labels(p);
    const total = (l: string) => {
      const x = pair(l);
      return x.big * per[x.bigUnit]! + x.small;
    };
    if (/Add /.test(prompt)) {
      const want = mixed.reduce((a, x) => a + x.big * k + x.small, 0);
      assert.deepEqual(
        choices.filter((l) => total(l) === want && pair(l).small < k),
        [correctLabel(p)],
      );
    } else if (/Subtract /.test(prompt)) {
      const [sub, from] = mixed as [(typeof mixed)[0], (typeof mixed)[0]];
      const want = from.big * k + from.small - (sub.big * k + sub.small);
      assert.deepEqual(
        choices.filter((l) => total(l) === want && pair(l).small < k),
        [correctLabel(p)],
      );
    } else if (/as .* only/.test(prompt)) {
      const x = mixed[0]!;
      assert.deepEqual(
        choices.filter(
          (l) => parseInt(l.replace(/,/g, ""), 10) === x.big * k + x.small,
        ),
        [correctLabel(p)],
      );
    } else {
      const sm = /^Write ([\d,]+) /.exec(prompt)!;
      const unit = /as (feet|yards|pounds|gallons|cups)/.exec(prompt)![1]!;
      const kk = { feet: 12, yards: 3, pounds: 16, gallons: 4, cups: 8 }[unit]!;
      const want = num(sm[1]!);
      assert.deepEqual(
        choices.filter((l) => {
          const x = pair(l);
          return x.big * kk + x.small === want && x.small < kk;
        }),
        [correctLabel(p)],
      );
    }
  }
});

test("estimates match independent checks", () => {
  for (let seed = 0; seed < 400; seed++) {
    let p = generateProblem("compatible-number-estimate", `s${seed}`);
    let prompt = p.public.prompt;
    const c = num(correctLabel(p));
    let m = /Estimate (\d+) ÷ (\d+) .*multiple of (\d+)/.exec(prompt);
    if (m) {
      const [D, d, s] = [Number(m[1]), Number(m[2]), Number(m[3])];
      const near = [Math.floor(D / s) * s, Math.ceil(D / s) * s].sort(
        (a, b) => Math.abs(a - D) - Math.abs(b - D),
      )[0]!;
      assert.equal(c, near / d);
    } else if (
      (m = /Estimate (\d+) × (\d+) .*multiple of (\d+)/.exec(prompt))
    ) {
      const [x, k, s] = [Number(m[1]), Number(m[2]), Number(m[3])];
      const near = [Math.floor(x / s) * s, Math.ceil(x / s) * s].sort(
        (a, b) => Math.abs(a - x) - Math.abs(b - x),
      )[0]!;
      assert.equal(c, near * k);
    } else {
      const addends = prompt
        .replace(/^.*estimate /, "")
        .replace(/\. Add.*$/, "")
        .split(" + ")
        .map(num);
      assert.equal(
        c,
        addends.reduce(
          (a, x) => a + Number(String(x)[0]) * 10 ** (String(x).length - 1),
          0,
        ),
      );
    }
    p = generateProblem("benchmark-percent-estimate", `s${seed}`);
    prompt = p.public.prompt;
    const got = Number(/about ([\d.]+) dollars/.exec(correctLabel(p))![1]);
    const price = Number(/(\d+\.\d\d) dollars/.exec(prompt)![1]);
    const step = /nearest (\d+) dollars/.exec(prompt)![1]!;
    const base = Math.round(price / Number(step)) * Number(step);
    const pct = Number(
      /(\d+)(?:%)/.exec(prompt.replace(/^.*(?:at|is) (\d+)%/, "$1%"))![1],
    );
    const off = (base * pct) / 100;
    assert.equal(got, /sale price/.test(prompt) ? base - off : off);
  }
});
