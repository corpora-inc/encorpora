import { test } from "node:test";
import assert from "node:assert/strict";
import { generateProblem } from "../src/math/engine";
import { multiPartAnswerText } from "../src/math/multi-part-choice";
import type { MultiPartChoiceResponse } from "../src/math/multi-part-choice";

/** The learner's shown text and each blank's keyed label, read only from the
 * public problem and its answer key. */
function view(id: string, seed: string) {
  const problem = generateProblem(id, seed);
  const response = problem.public.response as MultiPartChoiceResponse;
  const key = JSON.parse(problem.answer) as Record<string, string>;
  const chosen = Object.fromEntries(
    response.blanks.map((b) => [b.id, b.options.find((o) => o.id === key[b.id])!.label]),
  );
  const sentence = (response.sentence ?? [])
    .map((p) => ("text" in p ? p.text : `[${p.blank}]`))
    .join("");
  return { problem, response, chosen, sentence, text: `${problem.public.prompt} ${sentence}` };
}
const num = (s: string) => Number(s.replaceAll(",", "").replaceAll("{,}", ""));
const half = (n: number, unit: number) => Math.floor(n / unit + 0.5) * unit;
const SEEDS = 150;

test("digit places are keyed by position from the right", () => {
  const places = ["ones", "tens", "hundreds", "thousands", "ten thousands", "hundred thousands"];
  for (let i = 0; i < SEEDS; i++) {
    const { problem, response, chosen } = view("digit-place-names", `p:${i}`);
    const n = problem.public.prompt.match(/of ([\d,]+) is different/)![1]!.replaceAll(",", "");
    assert.equal(new Set(n).size, n.length);
    response.blanks.forEach((b, k) => {
      assert.equal(b.label, `The place of the digit ${n[k]}`);
      assert.equal(chosen[b.id], places[n.length - 1 - k]);
    });
  }
});

test("roundings of one number match half-up rounding", () => {
  for (let i = 0; i < SEEDS; i++) {
    const { text, chosen } = view("round-place-blanks", `r:${i}`);
    const n = num(text.match(/(\d,\d{3})/)![1]!);
    assert.equal(num(chosen.u1000!), half(n, 1000));
    assert.equal(num(chosen.u100!), half(n, 100));
    assert.equal(num(chosen.u10!), half(n, 10));
  }
  for (let i = 0; i < SEEDS; i++) {
    const { text, chosen } = view("round-decimal-blanks", `d:${i}`);
    const shown = text.match(/(\d+\.\d{3})/)![1]!;
    const thousandths = Math.round(Number(shown) * 1000);
    assert.equal(Number(chosen.tenth), Math.floor(thousandths / 100 + 0.5) / 10);
    assert.equal(Number(chosen.hundth), Math.floor(thousandths / 10 + 0.5) / 100);
  }
  for (let i = 0; i < SEEDS; i++) {
    const { problem, chosen } = view("round-addends-sum", `a:${i}`);
    const m = problem.public.prompt.match(/Estimate ([\d,]+) \+ ([\d,]+) by rounding each addend to the nearest (ten|hundred)/)!;
    const unit = m[3] === "ten" ? 10 : 100;
    const [a, b] = [num(m[1]!), num(m[2]!)];
    assert.equal(num(chosen.a!), half(a, unit));
    assert.equal(num(chosen.b!), half(b, unit));
    assert.equal(num(chosen.sum!), half(a, unit) + half(b, unit));
  }
});

test("expanded sums add back to the number shown, one part per nonzero digit", () => {
  for (const id of ["expanded-whole-slots", "expanded-decimal-slots"])
    for (let i = 0; i < SEEDS; i++) {
      const { sentence, response, chosen } = view(id, `e:${i}`);
      const target = Number(sentence.match(/^\$([\d{},.]+)=\$/)![1]!.replaceAll("{,}", ""));
      const parts = response.blanks.map((b) => {
        const label = chosen[b.id]!;
        const times = label.match(/^\$(\d)\\times (.+)\$$/);
        if (!times) return Number(label.replaceAll(",", ""));
        const unit = times[2]!.startsWith("\\frac")
          ? 1 / Number(times[2]!.match(/\{(\d+)\}$/)![1])
          : Number(times[2]!.replaceAll("{,}", ""));
        return Number(times[1]) * unit;
      });
      assert.ok(Math.abs(parts.reduce((s, v) => s + v, 0) - target) < 1e-9, `${id} ${i}`);
      const nonzero = String(target).replace(".", "").replaceAll("0", "").length;
      assert.ok(parts.length <= nonzero + 0, `${id} ${i}: ${parts.length} parts for ${nonzero} digits`);
      assert.equal(new Set(parts).size, parts.length);
    }
});

test("comparison symbols follow the values of both sides", () => {
  const side = (t: string) =>
    t.replaceAll("{,}", "").split("+").reduce((s, v) => s + Number(v), 0);
  for (let i = 0; i < SEEDS; i++) {
    const { sentence, chosen } = view("compare-symbol-blanks", `c:${i}`);
    const pairs = [...sentence.matchAll(/\$([\d{},+]+)\$ \[(c\d)\] \$([\d{},+]+)\$/g)];
    assert.equal(pairs.length, 2);
    let equal = 0;
    for (const m of pairs) {
      const [l, r] = [side(m[1]!), side(m[3]!)];
      const symbol = l < r ? "$<$" : l === r ? "$=$" : "$>$";
      equal += l === r ? 1 : 0;
      assert.equal(chosen[m[2]!], symbol);
    }
    assert.equal(equal, 1);
  }
});

test("the greater digit is worth the stated multiple of the lower one", () => {
  const places = ["ones", "tens", "hundreds", "thousands", "ten thousands", "hundred thousands"];
  for (let i = 0; i < SEEDS; i++) {
    const { sentence, text, chosen } = view("digit-value-blanks", `v:${i}`);
    const n = text.match(/number ([\d,]+) has/)![1]!.replaceAll(",", "");
    const low = places.indexOf(sentence.match(/as much as the 8 in the (.+) place\.$/)![1]!);
    const high = places.indexOf(chosen.place!);
    assert.equal(n[n.length - 1 - low], "8");
    assert.equal(n[n.length - 1 - high], "8");
    assert.equal(num(chosen.times!), 10 ** (high - low));
  }
});
