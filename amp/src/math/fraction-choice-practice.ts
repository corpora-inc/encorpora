import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import { chainFamily, choiceSurface, dispatch, gcd, pick } from "./chain-kit";
import { draw } from "./elementary-gap-kit";

export const fractionChoiceTemplate: TemplateMetadata = {
  id: "fraction-choice-compare",
  version: 1,
  requiredResponseCapability: "single-choice-v1",
  title: "Choose the fraction that fits the comparison",
  skillId: "fraction-comparison",
  gradeBand: "3–5",
  difficultyOffset: 0.3,
  description:
    "Among four fractions or mixed numbers, choose the one that is greater than or less than a stated fraction or whole number, or the greatest of four mixed numbers with unlike fraction parts.",
};

type R = (lo: number, hi: number) => number;
interface Frac {
  n: number;
  d: number;
}
const tex = (f: Frac) => `$\\frac{${f.n}}{${f.d}}$`;
const mixedTex = (w: number, f: Frac) => `$${w}\\frac{${f.n}}{${f.d}}$`;
/** Compare a/b with c/d exactly: negative, zero or positive. */
const cmp = (x: Frac, y: Frac) => x.n * y.d - y.n * x.d;
const same = (x: Frac, y: Frac) => cmp(x, y) === 0;

const targets = [
  "greater-than-fraction",
  "less-than-fraction",
  "greater-than-whole",
  "less-than-whole",
  "greatest-mixed",
] as const;
const axes = { target: defineAxis("target", targets) };
interface Model {
  target: (typeof targets)[number];
  /** The stated fraction or whole number (as a fraction with d = 1). */
  anchor: Frac;
  /** Four choices; mixed numbers carry their whole part. */
  choices: { f: Frac; whole: number }[];
  correct: number;
}
const properFraction = (r: R, dens: readonly number[]): Frac => {
  const d = pick(r, dens);
  const n = r(1, d - 1);
  return { n, d };
};
function model(r: R, a: { target: Model["target"] }): Model {
  const dens = [3, 4, 5, 6, 7, 8, 9, 10, 12];
  if (a.target === "greatest-mixed") {
    const whole = r(2, 5);
    const picks: Frac[] = [];
    for (let t = 0; t < 60 && picks.length < 4; t++) {
      const f = properFraction(r, [3, 4, 6, 12]);
      if (gcd(f.n, f.d) !== 1) continue;
      if (picks.some((p) => cmp(p, f) === 0 || p.d === f.d)) continue;
      picks.push(f);
    }
    if (picks.length < 4) throw new Error("Need three retries");
    const best = picks.reduce((i, f, k) => (cmp(f, picks[i]!) > 0 ? k : i), 0);
    return {
      target: a.target,
      anchor: { n: 0, d: 1 },
      choices: picks.map((f) => ({ f, whole })),
      correct: best,
    };
  }
  const whole = a.target.endsWith("whole");
  const greater = a.target.startsWith("greater");
  const anchor: Frac = whole ? { n: r(1, 3), d: 1 } : properFraction(r, dens);
  if (!whole && gcd(anchor.n, anchor.d) !== 1)
    throw new Error("Need three retries");
  const make = (): Frac => {
    if (whole) {
      // Values that straddle the whole number: between w - 1 and w + 1.
      const d = pick(r, [3, 4, 5, 6, 8]);
      const lo = (anchor.n - 1) * d + 1;
      const hi = (anchor.n + 1) * d - 1;
      return { n: r(lo, hi), d };
    }
    return properFraction(r, dens);
  };
  const ok = (f: Frac) => {
    const c = cmp(f, anchor);
    return greater ? c > 0 : c < 0;
  };
  const pool: Frac[] = [];
  for (let t = 0; t < 200 && pool.length < 40; t++) {
    const f = make();
    if (gcd(f.n, f.d) !== 1 || same(f, anchor)) continue;
    if (whole && f.n % f.d === 0) continue;
    if (!pool.some((p) => same(p, f))) pool.push(f);
  }
  const yes = pool.filter(ok);
  const no = pool.filter((f) => !ok(f));
  if (yes.length < 1 || no.length < 3) throw new Error("Need three retries");
  // Include a misleading choice: larger numerator but not larger value, when one exists.
  const trick = no.filter(
    (f) => f.n > anchor.n === greater || f.d < anchor.d === greater,
  );
  const wrong = draw(r, trick.length >= 1 ? trick : no, 1);
  const rest = draw(
    r,
    no.filter((f) => !wrong.includes(f)),
    2,
  );
  const right = pick(r, yes);
  const four = draw(r, [right, ...wrong, ...rest], 4);
  return {
    target: a.target,
    anchor,
    choices: four.map((f) => ({ f, whole: 0 })),
    correct: four.indexOf(right),
  };
}

const label = (m: Model, i: number) =>
  m.target === "greatest-mixed"
    ? mixedTex(m.choices[i]!.whole, m.choices[i]!.f)
    : tex(m.choices[i]!.f);
const anchorText = (m: Model) =>
  m.target.endsWith("whole") ? String(m.anchor.n) : tex(m.anchor);

export const fractionChoice = chainFamily({
  template: fractionChoiceTemplate,
  axes,
  model,
  variant: (m) => m.target,
  render: (m, _a, r) => {
    const A = m.anchor;
    const isMixed = m.target === "greatest-mixed";
    const greater = m.target.startsWith("greater");
    const prompt = isMixed
      ? `Four plants have heights, in inches, that are written as mixed numbers. Which height is the greatest?`
      : `Which of these fractions is ${greater ? "greater" : "less"} than ${anchorText(m)}?`;
    const options = m.choices.map((c, i) => {
      if (i === m.correct)
        return { label: label(m, i), correct: true as const };
      const lab = label(m, i);
      if (isMixed) {
        const best = m.choices[m.correct]!.f;
        return {
          label: lab,
          feedback: `With the same whole number, compare the fractions with a common denominator. ${tex(c.f)} is less than ${tex(best)}, so ${lab} is not the greatest.`,
        };
      }
      const rel = cmp(c.f, A) > 0 ? "greater" : "less";
      const why = m.target.endsWith("whole")
        ? `${tex(c.f)} is ${rel} than ${A.n}: ${A.n} equals $\\frac{${A.n * c.f.d}}{${c.f.d}}$, and ${c.f.n} is ${rel === "greater" ? "more" : "fewer"} than ${A.n * c.f.d}.`
        : `Use a common denominator ${A.d * c.f.d}: ${tex(c.f)} is $\\frac{${c.f.n * A.d}}{${A.d * c.f.d}}$ and ${tex(A)} is $\\frac{${A.n * c.f.d}}{${A.d * c.f.d}}$, so ${tex(c.f)} is ${rel} than ${tex(A)}.`;
      return {
        label: lab,
        feedback: `This is not ${greater ? "greater" : "less"} than ${anchorText(m)}. ${why}`,
      };
    });
    const right = m.choices[m.correct]!;
    // The hint works through choices that are not the answer.
    const [w1, w2] = m.choices.filter((_, i) => i !== m.correct) as [
      (typeof m.choices)[number],
      (typeof m.choices)[number],
    ];
    return choiceSurface(r, {
      prompt,
      options,
      hint: isMixed
        ? `Every number has the whole part ${m.choices[0]!.whole}, so compare only the fractions. Start with ${tex(w1.f)} and ${tex(w2.f)}: rewrite them with a common denominator.`
        : m.target.endsWith("whole")
          ? `Rewrite the whole number ${A.n} with the denominator of a choice: ${A.n} is the same as $\\frac{${A.n * w1.f.d}}{${w1.f.d}}$. Then compare the numerators of ${tex(w1.f)} and that fraction.`
          : `Compare ${tex(A)} with a choice by rewriting both with a common denominator, for example ${A.d * w1.f.d} for ${tex(w1.f)}. Then compare the numerators.`,
      explanation: isMixed
        ? [
            `Each number has the whole part ${m.choices[0]!.whole}, so the greatest one has the greatest fraction part.`,
            `Rewrite the fractions with the common denominator 12: ${m.choices.map((c) => `$\\frac{${c.f.n}}{${c.f.d}}=\\frac{${(c.f.n * 12) / c.f.d}}{12}$`).join(", ")}.`,
            `The greatest is ${label(m, m.correct)}.`,
          ]
        : [
            m.target.endsWith("whole")
              ? `${A.n} is the same as $\\frac{${A.n * right.f.d}}{${right.f.d}}$, so compare ${tex(right.f)} with it.`
              : `Use the common denominator ${A.d * right.f.d} for ${tex(A)} and ${tex(right.f)}.`,
            m.target.endsWith("whole")
              ? `${right.f.n} is ${greater ? "more" : "fewer"} than ${A.n * right.f.d}, so ${tex(right.f)} is ${greater ? "greater" : "less"} than ${A.n}.`
              : `${tex(A)} is $\\frac{${A.n * right.f.d}}{${A.d * right.f.d}}$ and ${tex(right.f)} is $\\frac{${right.f.n * A.d}}{${A.d * right.f.d}}$, so ${tex(right.f)} is ${greater ? "greater" : "less"}.`,
            `The answer is ${label(m, m.correct)}.`,
          ],
    });
  },
});

export const fractionChoiceTemplates = [fractionChoiceTemplate] as const;
export const fractionChoiceGenerate = dispatch(fractionChoiceTemplates, {
  "fraction-choice-compare": (seed) => fractionChoice.generate(seed).problem,
});
