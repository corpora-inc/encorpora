import { test } from "node:test";
import assert from "node:assert/strict";
import {
  rationalExponentMeaningGenerate as generate,
  rationalExponentMeaningTemplates,
} from "../src/math/rational-exponent-meaning-practice";
import type { GeneratedProblem } from "../src/math/contracts";

/**
 * Independent checks: every option is evaluated from its own TeX by a small
 * evaluator written here (not the generator's code), so a correct option
 * must be numerically true and a distractor must contain a false claim.
 */

const IDS = rationalExponentMeaningTemplates.map((t) => t.id);
const SEEDS = 600;
const sample = (id: string, n = SEEDS) =>
  Array.from({ length: n }, (_, i) => generate(id, `rem-${i}`));

/* ------------------------------------------------ a tiny TeX evaluator */

/** TeX of a number expression → a JavaScript expression. */
function toJs(tex: string): string {
  const s = tex
    .replace(/\\left|\\right/g, "")
    .replace(/\{,\}/g, "")
    .replace(/\s+/g, "");
  let i = 0;
  const group = (): string => {
    if (s[i] !== "{") return s[i++]!;
    i++;
    const out = seq("}");
    i++;
    return out;
  };
  function seq(end: string): string {
    let out = "";
    let prev = false;
    while (i < s.length && s[i] !== end) {
      let atom: string;
      if (s.startsWith("\\frac", i)) {
        i += 5;
        const a = group();
        const b = group();
        atom = `((${a})/(${b}))`;
      } else if (s.startsWith("\\sqrt", i)) {
        i += 5;
        let index = "2";
        if (s[i] === "[") {
          const j = s.indexOf("]", i);
          index = s.slice(i + 1, j);
          i = j + 1;
        }
        atom = `Math.pow(${group()},1/(${index}))`;
      } else if (s.startsWith("\\cdot", i)) {
        i += 5;
        out += "*";
        prev = false;
        continue;
      } else if (s[i] === "^") {
        i++;
        out += `**(${group()})`;
        prev = true;
        continue;
      } else if (/[0-9.]/.test(s[i]!)) {
        let j = i;
        while (j < s.length && /[0-9.]/.test(s[j]!)) j++;
        atom = s.slice(i, j);
        i = j;
      } else if (s[i] === "(") {
        i++;
        atom = `(${seq(")")})`;
        i++;
      } else if ("+-/".includes(s[i]!)) {
        out += s[i++];
        prev = false;
        continue;
      } else throw new Error(`Cannot read ${s.slice(i)} in ${tex}`);
      out += (prev ? "*" : "") + atom;
      prev = true;
    }
    return out;
  }
  return seq("");
}
const value = (tex: string): number =>
  Function(`return (${toJs(tex)});`)() as number;
const same = (a: number, b: number) =>
  Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const maths = (text: string) =>
  [...text.matchAll(/\$([^$]+)\$/g)].map((m) => m[1]!);
/** Every claim a sentence makes about numbers: each "=" chain holds, and
 * "A is not B" (or "…, which is not B") holds. */
function claimsHold(text: string): boolean {
  const parts = text.split(/(\$[^$]+\$)/);
  let last: string | null = null;
  let ok = true;
  for (let k = 0; k < parts.length; k++) {
    const p = parts[k]!;
    if (!p.startsWith("$")) continue;
    const tex = p.slice(1, -1);
    // A law stated with letters, such as (x^p)^q=x^{pq}, is not a number claim.
    if (/[a-z]/.test(tex.replace(/\\[a-zA-Z]+/g, ""))) continue;
    const before = parts[k - 1] ?? "";
    const sides = tex.split("=");
    if (/is not\s*$/.test(before) && last !== null)
      ok &&= !same(value(last), value(sides[0]!));
    if (sides.length > 1)
      ok &&= sides.every((x) => same(value(x), value(sides[0]!)));
    last = sides.at(-1)!;
  }
  return ok;
}

const optionsOf = (p: GeneratedProblem) => {
  const r = p.public.response;
  assert.equal(r.kind, "choice");
  return r.kind === "choice" ? r.options : [];
};
const correctLabel = (p: GeneratedProblem) =>
  optionsOf(p).find((o) => o.id === p.answer)!.label;
const words = (s: string) =>
  s
    .replace(/\$[^$]*\$/g, "M")
    .trim()
    .split(/\s+/).length;
/** b and n of a prompt's first unit-fraction or fraction power. */
function powerOf(prompt: string) {
  const m = /(\d+)\^\{(\d+)\/(\d+)\}/.exec(prompt)!;
  return { b: Number(m[1]), m: Number(m[2]), n: Number(m[3]) };
}

/* ------------------------------------------------------------- tests */

test("generation is deterministic and every problem is a four-option choice", () => {
  for (const id of IDS)
    for (let i = 0; i < 40; i++) {
      const a = generate(id, `det-${i}`);
      assert.deepEqual(a, generate(id, `det-${i}`));
      const options = optionsOf(a);
      assert.equal(options.length, 4);
      assert.equal(new Set(options.map((o) => o.label)).size, 4);
      assert.ok(options.some((o) => o.id === a.answer));
      for (const o of options)
        if (o.id !== a.answer) assert.ok(a.choiceFeedback?.[o.id], id);
      assert.equal(a.public.figure, undefined);
    }
});

test("every variant appears at 5% or more", () => {
  const groups: Record<string, string[]> = {
    "rational-exponent-derivation": [
      "justify-s2",
      "justify-s4",
      "line-s2",
      "line-s3",
      "line-s4",
      "order",
    ],
    "rational-exponent-definition-test": [
      "proposals-perfect",
      "proposals-plain",
      "false-line-f0",
      "false-line-f1",
      "false-line-f2",
      "false-line-f3",
      "false-line-f4",
      "false-line-f5",
    ],
    "radical-exponent-notation-reason": [
      "root-reason",
      "fraction-reason",
      "define-value",
    ],
  };
  for (const id of IDS) {
    const counts = new Map<string, number>();
    for (const p of sample(id)) {
      const v = p.variant!.id;
      const key = groups[id]!.find((g) => v.startsWith(g))!;
      assert.ok(key, `${id}: unexpected variant ${v}`);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const g of groups[id]!)
      assert.ok(
        (counts.get(g) ?? 0) >= 0.05 * SEEDS,
        `${id} ${g}: ${counts.get(g) ?? 0}`,
      );
  }
});

test("numbers stay in range: positive bases, n from 2 to 5, coprime m", () => {
  for (const id of IDS)
    for (const p of sample(id, 300)) {
      const { b, m, n } = powerOf(p.public.prompt);
      assert.ok([2, 3, 4, 5].includes(n), p.public.prompt);
      const root = Math.round(b ** (1 / n));
      const perfect = root ** n === b;
      if (perfect) {
        assert.ok([2, 3, 4, 5].includes(root) && b <= 1000);
        if (m !== 1) assert.ok(root ** m <= 1000);
      } else assert.ok([2, 3, 5, 6, 7, 10].includes(b), `${b}`);
      if (m !== 1) {
        assert.ok([2, 3, 4, 5].includes(m) && m !== n);
        const g = (x: number, y: number): number => (y ? g(y, x % y) : x);
        assert.equal(g(m, n), 1);
      }
    }
});

test("rendering: no index-2 radical, no first power, no n/n exponent", () => {
  for (const id of IDS)
    for (const p of sample(id, 300)) {
      const text = [
        p.public.prompt,
        ...optionsOf(p).map((o) => o.label),
        p.hint,
        ...p.explanation,
        ...Object.values(p.choiceFeedback ?? {}),
      ].join("\n");
      assert.doesNotMatch(text, /\\sqrt\[2\]/);
      assert.doesNotMatch(text, /\^(?:1|\{1\})(?![0-9/.])/);
      assert.doesNotMatch(text, /\\frac\{(\d+)\}\{\1\}/);
    }
});

test("derivation: the correct line holds and every candidate line is false", () => {
  for (const p of sample("rational-exponent-derivation")) {
    const v = p.variant!.id;
    const { b, n } = powerOf(p.public.prompt);
    const correct = correctLabel(p);
    if (v.startsWith("line-")) {
      assert.ok(claimsHold(correct), `${v}: ${correct}`);
      for (const o of optionsOf(p))
        if (o.id !== p.answer)
          assert.ok(!claimsHold(o.label), `${v} ${b},${n}: ${o.label}`);
    }
    if (v.startsWith("justify-s2"))
      assert.match(correct, /power of a power law/);
    if (v.startsWith("justify-s4")) {
      assert.match(correct, /^the definition/);
      // The divide-by-index rule is false for these numbers.
      assert.ok(!same(b / n, b ** (1 / n)), `${b},${n}`);
    }
    if (v.startsWith("order")) {
      const lines = new Map(
        [
          ...p.public.prompt.matchAll(
            /(Statement \d): (.*?)(?= Statement \d: | In which)/g,
          ),
        ].map((m) => [m[1]!, m[2]!]),
      );
      const order = correct.split(", ").map((l) => lines.get(l)!);
      assert.equal(new Set(order).size, 4);
      assert.match(order[0]!, /^We want/);
      assert.match(order[1]!, /^So /);
      assert.match(order[2]!, /^\$\\frac\{1\}/);
      assert.match(order[3]!, /^The positive number/);
      for (const o of optionsOf(p))
        if (o.id !== p.answer) assert.notEqual(o.label, correct);
    }
  }
});

test("definition test: only the root survives, and the first false line is the answer", () => {
  let noneFalse = 0;
  let scripts = 0;
  for (const p of sample("rational-exponent-definition-test")) {
    const v = p.variant!.id;
    const { b, n } = powerOf(p.public.prompt);
    if (v.startsWith("proposals")) {
      const meanings = optionsOf(p).map((o) =>
        o.label.split("=")[1]!.replace(/\$$/, ""),
      );
      const survive = optionsOf(p).filter((o) => {
        const meaning = o.label.split("=")[1]!.replace(/\$$/, "");
        return same(value(meaning) ** n, b);
      });
      assert.equal(survive.length, 1, `${b},${n}: ${meanings.join(" | ")}`);
      assert.equal(survive[0]!.id, p.answer);
      const values = meanings.map(value);
      for (let i = 0; i < 4; i++)
        for (let j = i + 1; j < 4; j++)
          assert.ok(!same(values[i]!, values[j]!), meanings.join(" | "));
      continue;
    }
    scripts++;
    const options = optionsOf(p);
    assert.deepEqual(
      options.map((o) => o.label),
      ["Line 1", "Line 2", "Line 3", "No line is false"],
    );
    const lines = [
      ...p.public.prompt.matchAll(/Line \d: (.*?)\.(?= Line \d:| Which)/g),
    ].map((m) => m[1]!);
    assert.equal(lines.length, 3, p.public.prompt);
    const first = lines.findIndex((l) => !claimsHold(l));
    const expected = first === -1 ? "No line is false" : `Line ${first + 1}`;
    assert.equal(correctLabel(p), expected, p.public.prompt);
    if (first === -1) noneFalse++;
  }
  const share = noneFalse / scripts;
  assert.ok(share >= 0.1 && share <= 0.25, `No line is false: ${share}`);
});

test("notation reasons: the key is true, distractors are false or only restate", () => {
  for (const p of sample("radical-exponent-notation-reason")) {
    const v = p.variant!.id;
    const correct = correctLabel(p);
    assert.ok(claimsHold(correct), `${v}: ${correct}`);
    for (const o of optionsOf(p)) {
      if (o.id === p.answer) continue;
      if (v.startsWith("root-reason") && /goes in the exponent/.test(o.label)) {
        // A true rule restated without a reason: incomplete, not false.
        assert.ok(claimsHold(o.label));
        continue;
      }
      assert.ok(!claimsHold(o.label), `${v}: ${o.label}`);
    }
    if (v === "define-value") {
      const { b, m, n } = powerOf(p.public.prompt);
      const values = optionsOf(p).map((o) =>
        value(maths(o.label).at(-1)!.split("=")[1]!),
      );
      for (let i = 0; i < 4; i++)
        for (let j = i + 1; j < 4; j++)
          assert.ok(!same(values[i]!, values[j]!));
      const key = maths(correct).at(-1)!.split("=")[1]!;
      assert.ok(same(value(key) ** n, b ** m));
    }
  }
});

test("reason options are within 30% of the mean word count", () => {
  const spread = (p: GeneratedProblem) => {
    const counts = optionsOf(p).map((o) => words(o.label));
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    return counts.every((c) => Math.abs(c - mean) <= 0.3 * mean);
  };
  for (const p of sample("rational-exponent-derivation"))
    if (p.variant!.id.startsWith("justify"))
      assert.ok(spread(p), JSON.stringify(optionsOf(p)));
  for (const p of sample("radical-exponent-notation-reason"))
    if (p.variant!.id !== "define-value")
      assert.ok(spread(p), JSON.stringify(optionsOf(p)));
});

test("the divide-by-index hazard never appears: 4/2 equals the square root of 4", () => {
  for (const id of IDS)
    for (const p of sample(id, 300)) {
      const { b, n } = powerOf(p.public.prompt);
      const offers = optionsOf(p).some((o) =>
        o.label.includes(`\\frac{${b}}{${n}}`),
      );
      if (offers) assert.ok(!(b === 4 && n === 2), p.public.prompt);
    }
});

test("hints name the problem's numbers and never single out the answer", () => {
  for (const id of IDS)
    for (const p of sample(id, 60)) {
      const { b } = powerOf(p.public.prompt);
      assert.ok(p.hint.includes(String(b)), p.hint);
      assert.ok(!p.hint.includes(correctLabel(p)), p.hint);
    }
});
