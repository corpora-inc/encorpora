import { test } from "node:test";
import assert from "node:assert/strict";
import { methods } from "../src/content/problem-methods";
import { principles } from "../src/content/problem-principles";

// Kindergarten to grade 2 practice screens state their rules in plain words
// and numbers. Each test names the case the earlier wording got wrong.
const screen = (id: string) => {
  const m = methods[id];
  return [
    m?.intuition ?? "",
    ...(m?.method ?? []),
    m?.watch ?? "",
    principles[id] ?? "",
  ].join("\n");
};

const early = [
  "join-within-10",
  "subtract-within-20",
  "make-ten-remainder",
  "subtract-through-ten",
  "unknown-addend-story",
  "ten-more-or-less",
  "add-ones-regroup",
  "subtract-whole-tens",
  "hundreds-model",
  "add-with-regrouping",
  "two-step-change",
];

test("every whole-number sum or difference these screens write is true", () => {
  const wrong: string[] = [];
  for (const id of early)
    for (const m of screen(id).matchAll(
      /(?<![\d.,/$\\])\b(\d+(?: [+−] \d+)+) = (\d+)\b(?![.,/]\d| [+−×÷])/g,
    )) {
      const value = m[1]!
        .split(" ")
        .reduce<[number, string]>(
          ([sum, op], token) =>
            token === "+" || token === "−"
              ? [sum, token]
              : [op === "−" ? sum - Number(token) : sum + Number(token), "+"],
          [0, "+"],
        )[0];
      if (value !== Number(m[2])) wrong.push(`${id}: ${m[0]}`);
    }
  assert.deepEqual(wrong, []);
});

test("ten more than a number with 9 tens makes a new hundred", () => {
  // "Change only the tens digit" fails for 96 + 10 = 106.
  const text = screen("ten-more-or-less");
  assert.doesNotMatch(text, /change only the tens digit/i);
  assert.match(text, /96 \+ 10 = 106/);
});

test("taking away down to 10 first is offered only when it crosses 10", () => {
  // "First down to 10, then the rest" fails for 7 − 2 and 14 − 2.
  const step = methods["subtract-within-20"]!.method.find((s) =>
    /down to 10/.test(s),
  );
  assert.ok(step);
  assert.match(step, /more than 10/);
});

test("a missing part can come first or second", () => {
  // The generator also asks □ + 5 = 12, which "start + ? = total" misses.
  assert.match(screen("unknown-addend-story"), /□ \+ \d+ = \d+/);
});

test("regrouping tens writes the ones digit of the tens sum", () => {
  // 12 tens: write 2 and carry 1 hundred, not "write the tens digit".
  assert.doesNotMatch(
    screen("add-with-regrouping"),
    /write the tens digit and carry/i,
  );
});

test("two changes can come in either order", () => {
  // The bus story takes away first, then adds.
  assert.doesNotMatch(screen("two-step-change"), /\\text\{start\} \+ a\) - b/);
});

test("early principles use numbers, not algebra letters or set language", () => {
  const algebra =
    /\b(?:cardinality|disjoint|distributive|decomposing|subtrahend)\b|\b\d+[a-z]\b|\b[a-z] [+−] [a-z]\b|\babc\b/i;
  const offenders = early.filter((id) => algebra.test(principles[id] ?? ""));
  assert.deepEqual(offenders, []);
});
