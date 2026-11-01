import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import {
  assemble,
  constText,
  linearText,
  n,
  nonzero,
  rat,
  seeded,
  termText,
  type Rational,
} from "./algebra-one-kit";

export const radicalEquationTemplates: readonly TemplateMetadata[] = [
  {
    id: "radical-equation-isolated",
    title: "Solve an isolated square root",
    skillId: "square-root-equations",
    difficultyOffset: -1,
    description:
      "Square a nonnegative constant and solve a linear equation exactly.",
  },
  {
    id: "radical-equation-shifted",
    title: "Isolate the square root first",
    skillId: "square-root-equations",
    difficultyOffset: -0.5,
    description: "Undo an outside addition or subtraction before squaring.",
  },
  {
    id: "radical-equation-check",
    title: "Check solutions after squaring",
    skillId: "radical-equations",
    difficultyOffset: 0,
    requiredResponseCapability: "single-choice-v1" as const,
    description:
      "Solve a square-root equation with a linear right side and reject extraneous candidates.",
  },
].map((t) => ({ ...t, version: 1, gradeBand: "9–12" }));

const tex = (q: Rational) =>
  q.d === 1 ? n(q.n) : `${q.n < 0 ? "−" : ""}\\frac{${Math.abs(q.n)}}{${q.d}}`;

export function radicalEquationCase(id: string, seed: string) {
  const meta = radicalEquationTemplates.find((t) => t.id === id);
  if (!meta) throw new Error("Unknown radical-equation template");
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = seeded(id, seed);
  if (id !== "radical-equation-check") {
    const a = nonzero(r, -5, 5),
      b = r(-12, 12),
      k = r(0, 9);
    const c = id === "radical-equation-shifted" ? nonzero(r, -8, 8) : 0;
    const d = k + c,
      radicand = linearText(a, b),
      answer = rat(k * k - b, a);
    const equation = `\\sqrt{${radicand}}${constText(c)} = ${n(d)}`;
    return assemble(
      meta,
      seed,
      {
        prompt: `Solve $${equation}$ for $x$ over the real numbers.`,
        answer,
        hint:
          c === 0
            ? `In $${equation}$, the square root is already alone. Its value is nonnegative. Square both sides, then solve the resulting linear equation.`
            : `In $${equation}$, undo the outside ${c > 0 ? "addition" : "subtraction"} of ${Math.abs(c)} on both sides before squaring. Check that the isolated root equals a nonnegative number.`,
        explanation: [
          `The symbol $\\sqrt{\\ }$ means the square root that is zero or positive. Over the real numbers, the expression under it, $${radicand}$, must be zero or more.`,
          ...(c === 0
            ? [`The square root is already alone on the left side.`]
            : [
                `First get the square root alone. ${c > 0 ? "Subtract" : "Add"} ${Math.abs(c)} ${c > 0 ? "from" : "to"} both sides: $\\sqrt{${radicand}} = ${n(k)}$.`,
              ]),
          `Squaring undoes a square root. Both sides are zero or positive, so squaring keeps the equation true and adds no false answers: $${radicand} = ${k * k}$.`,
          `Now solve the linear equation. ${b === 0 ? "" : `${b > 0 ? "Subtract" : "Add"} ${Math.abs(b)} ${b > 0 ? "from" : "to"} both sides: $${linearText(a, 0)} = ${k * k - b}$. `}${a === 1 ? "So" : `Divide by ${n(a)}:`} $x = ${tex(answer)}$.`,
          `Check in the original equation. At this $x$, $${n(a)}\\left(${tex(answer)}\\right)${constText(b)} = ${k * k}$, and $\\sqrt{${k * k}}${constText(c)} = ${k}${constText(c)} = ${n(d)}$. It works.`,
          `The solution is $x = ${tex(answer)}$.`,
        ],
        tags: [
          c === 0
            ? "isolated"
            : c > 0
              ? "outside-addition"
              : "outside-subtraction",
          k === 0 ? "zero-root" : "positive-root",
          a < 0 ? "negative-coefficient" : "positive-coefficient",
          answer.d === 1 ? "integer-answer" : "fraction-answer",
        ],
      },
      r,
      "x",
      "fraction",
    );
  }

  const c = r(-5, 5),
    mode = r(0, 2);
  // Construct distinct squared-equation roots on either side of the sign boundary.
  let lo: number, hi: number, a: number;
  do {
    lo = -c + (mode === 2 ? r(0, 4) : -r(1, 6));
    hi = mode === 0 ? lo - r(1, 4) : -c + r(1, 6);
    if (lo > hi) [lo, hi] = [hi, lo];
    if (lo === hi) hi++;
    a = lo + hi + 2 * c;
  } while (a === 0);
  const b = c * c - lo * hi,
    radicand = linearText(a, b),
    right = linearText(1, c);
  const accepted = [lo, hi].filter((x) => x + c >= 0);
  const labels = [
    `$x = ${n(lo)}$ or $x = ${n(hi)}$`,
    `$x = ${n(lo)}$`,
    `$x = ${n(hi)}$`,
    "There are no real solutions.",
  ];
  const correct =
    accepted.length === 2
      ? 0
      : accepted.length === 0
        ? 3
        : accepted[0] === lo
          ? 1
          : 2;
  const check = (x: number) => {
    const rhs = x + c,
      value = a * x + b;
    return `For $x = ${n(x)}$, the radicand is $${n(a)}(${n(x)})${constText(b)} = ${value}$. The original left side is $\\sqrt{${value}} = ${Math.abs(rhs)}$, while the right side is $${n(x)}${constText(c)} = ${n(rhs)}$. ${rhs >= 0 ? "The sides agree: keep this solution." : "The sides differ: reject this extraneous candidate."}`;
  };
  return assemble(
    meta,
    seed,
    {
      prompt: `Solve $\\sqrt{${radicand}} = ${right}$ over the real numbers. Which statement describes all solutions?`,
      choices: labels.map((label, i) => ({
        label,
        ...(i === correct
          ? { correct: true as const }
          : {
              feedback:
                i === 0
                  ? `This keeps both candidates from the squared equation without checking them. Squaring can add false answers. A square root is never negative, so reject any $x$ that makes $${right}$ negative.`
                  : i === 3
                    ? `This rejects every candidate, but at least one works. Put each candidate into $\\sqrt{${radicand}} = ${right}$: keep it when the right side is zero or positive.`
                    : accepted.length === 2
                      ? `This drops a candidate that works. Check both in the original equation: each gives a right side that is zero or positive, so both are solutions.`
                      : accepted.length === 0
                        ? `This keeps a candidate that fails: it makes $${right}$ negative, and a square root is never negative. Neither candidate works.`
                        : `This keeps the wrong candidate. A square root is never negative, so the right side $${right}$ must be zero or positive. Check each candidate in the original equation.`,
            }),
      })),
      hint: `In $\\sqrt{${radicand}} = ${right}$, require both $${radicand} \\ge 0$ and $${right} \\ge 0$. Squaring gives candidates; keep only those that satisfy the original equation.`,
      explanation: [
        `A square root, $\\sqrt{\\ }$, is never negative. So a real solution needs the inside, $${radicand}$, to be zero or more, and the right side, $${right}$, to be zero or more.`,
        `Squaring both sides undoes the root: $${radicand} = (${right})^2$. Multiply out the right side and move every term there: $0 = x^2${termText(2 * c - a, "x", false)}${constText(c * c - b)}$.`,
        `Factor: $0 = (${linearText(1, -lo)})(${linearText(1, -hi)})$. A product is zero only when a factor is zero, so the candidates are $x = ${n(lo)}$ and $x = ${n(hi)}$.`,
        `Squaring can add false answers, called extraneous solutions, because $(-3)^2$ and $3^2$ are both 9. So check each candidate in the original equation.`,
        check(lo),
        check(hi),
        accepted.length === 0
          ? "Neither candidate works, so there are no real solutions."
          : `The complete solution set is ${accepted.map((x) => `$x = ${n(x)}$`).join(" or ")}.`,
      ],
      tags: [
        accepted.length === 0
          ? "no-solutions"
          : accepted.length === 1
            ? "one-solution"
            : "two-solutions",
        accepted.length < 2 ? "extraneous-candidate" : "both-valid",
        [lo, hi].some((x) => x + c === 0) ? "zero-boundary" : "nonzero-roots",
      ],
    },
    r,
    "Solution set",
  );
}

export function generateRadicalEquationProblem(
  id: string,
  seed: string,
): GeneratedProblem {
  return radicalEquationCase(id, seed).problem;
}
