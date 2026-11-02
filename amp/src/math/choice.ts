import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts.js";

export const choiceTemplates: readonly TemplateMetadata[] = [
  {
    id: "fraction-equivalence-choice",
    version: 1,
    requiredResponseCapability: "single-choice-v1",
    title: "Different pieces, same amount",
    skillId: "fraction-equivalence",
    gradeBand: "3–5",
    description:
      "Select an equivalent name for a proper fraction among scaling and additive misconceptions.",
  },
  {
    id: "equation-solution-count",
    version: 1,
    requiredResponseCapability: "single-choice-v1",
    title: "One, none, or every number?",
    skillId: "linear-equations",
    gradeBand: "6–8",
    description:
      "Classify the solution set of a linear equation with positive integer coefficients on both sides.",
  },
  {
    id: "graph-equation-choice",
    version: 1,
    requiredResponseCapability: "single-choice-v1",
    title: "Find the graph’s rule",
    skillId: "linear-models",
    gradeBand: "6–8",
    description:
      "Match an increasing line with positive integer slope and intercept to its equation.",
  },
];
function random(id: string, seed: string) {
  let counter = 0;
  return (low: number, high: number) => {
    const range = high - low + 1;
    const ceiling = Math.floor(0x100000000 / range) * range;
    let value: number;
    do {
      value = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    } while (value >= ceiling);
    return low + (value % range);
  };
}
type Choice = { label: string; correct?: true; feedback?: string };
export function generateChoiceProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const meta = choiceTemplates.find((template) => template.id === templateId);
  if (!meta) throw new Error(`Unknown choice template: ${templateId}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  let prompt: string, hint: string, explanation: string[], choices: Choice[];
  let figure: SemanticFigure | undefined;
  switch (templateId) {
    case "fraction-equivalence-choice": {
      const d = [2, 3, 4, 6][r(0, 3)]!,
        n = r(1, d - 1),
        k = r(2, 3);
      prompt = `Which fraction names the same amount as ${n}/${d}?`;
      figure = {
        kind: "fraction-strips",
        parts: d,
        wholes: 1,
        rows: [{ selected: n, label: `${n}/${d}` }],
        unit: "one whole",
      };
      hint = `Cut each of the ${d} pieces of ${n}/${d} into the same number of smaller pieces. The shaded amount stays the same, so the shaded count and the whole count grow by the same factor.`;
      explanation = [
        `Equivalent fractions name the same amount with different numbers.`,
        `In ${n}/${d}, the bottom number (denominator) says the whole has ${d} equal pieces; the top number (numerator) says ${n} ${n === 1 ? "is" : "are"} shaded.`,
        `Cut each piece into ${k} equal pieces. The whole now has ${d} × ${k} = ${d * k} pieces, and the shaded part has ${n} × ${k} = ${n * k}.`,
        `Cutting adds no area and removes none, so the shaded amount is the same. Top and bottom were both multiplied by ${k}.`,
        `So ${n * k}/${d * k} names the same amount as ${n}/${d}.`,
      ];
      choices = [
        { label: `${n * k}/${d * k}`, correct: true },
        {
          label: `${n + 1}/${d + 1}`,
          feedback: `You added 1 to the top and the bottom. Adding changes the amount: ${n + 1}/${d + 1} is not the same as ${n}/${d}. Multiply the top and bottom by the same number instead.`,
        },
        {
          label: `${n * k}/${d}`,
          feedback: `You multiplied only the top by ${k}. The bottom stays ${d}, so the pieces stay the same size, and ${k} times as many of them is ${k} times as much. Multiply the bottom by ${k} too.`,
        },
        {
          label: `${n}/${d * k}`,
          feedback: `You multiplied only the bottom by ${k}. The pieces got ${k} times smaller, but the shaded count stayed ${n}, so the amount shrank. Multiply the top by ${k} too.`,
        },
      ];
      break;
    }
    case "equation-solution-count": {
      const a = r(2, 8),
        b = r(1, 9),
        category = r(0, 2);
      const c = category === 0 ? a + r(1, 4) : a;
      const d = category === 2 ? b : b + r(1, 6);
      prompt = `How many real-number solutions does ${a}x + ${b} = ${c}x + ${d} have?`;
      hint = `Subtract ${a}x and ${b} from both sides of ${a}x + ${b} = ${c}x + ${d}. Is what is left a value for $x$, a false statement, or true for every $x$?`;
      explanation = [
        `A solution is a value of $x$ that makes both sides equal. Simplify the equation to see how many there are.`,
        `Subtract $${a}x$ and then ${b} from both sides, which keeps them equal: $0 = ${c - a}x + ${d - b}$.`,
        category === 0
          ? `The number multiplying $x$ (its coefficient) is ${c - a}, not zero. So $${c - a}x = ${b - d}$ picks out exactly one value of $x$.`
          : category === 1
            ? `The $x$-terms canceled, leaving $0 = ${d - b}$. That is false whatever $x$ is.`
            : "The $x$-terms canceled, leaving $0 = 0$. That is true whatever $x$ is.",
        category === 0
          ? "The equation has exactly one solution."
          : category === 1
            ? "So no value of $x$ works: the equation has no solution."
            : "So every real number works: the equation has infinitely many solutions.",
      ];
      choices = [
        "Exactly one solution",
        "No solution",
        "Infinitely many solutions",
      ].map((label, index) =>
        index === category
          ? { label, correct: true }
          : {
              label,
              feedback:
                index === 0
                  ? `Both sides have the same $x$-term, $${a}x$, so the $x$-terms cancel and no single value of $x$ is picked out. Check whether what is left is true or false.`
                  : index === 1
                    ? category === 0
                      ? `The $x$-terms do not cancel here: $${a}x$ and $${c}x$ differ. Subtracting leaves one equation for $x$, so it has one solution.`
                      : `The $x$-terms cancel, but what is left, $0 = 0$, is true. A false statement would mean no solution.`
                    : category === 0
                      ? `The $x$-terms do not cancel here: $${a}x$ and $${c}x$ differ. Only one value of $x$ makes the sides equal.`
                      : `The $x$-terms cancel, but the constants ${b} and ${d} differ, leaving the false $0 = ${d - b}$. Both the $x$-terms and the constants must match for every $x$ to work.`,
            },
      );
      break;
    }
    case "graph-equation-choice": {
      const m = r(1, 3),
        b = r(4, 6);
      prompt = "Which equation matches the line through $A$ and $B$?";
      figure = {
        kind: "coordinate-plane",
        xMin: -1,
        xMax: 4,
        yMin: -1,
        yMax: b + 2 * m + 2,
        points: [
          { x: 0, y: b, label: "A" },
          { x: 2, y: b + 2 * m, label: "B" },
        ],
        lines: [{ m, b }],
      };
      hint = `A sits on the $y$-axis at ${b}, so the line crosses the $y$-axis there. From $A$ to $B$, $x$ goes up by 2: how much does $y$ go up?`;
      explanation = [
        `An equation $y = mx + b$ describes a line: $m$ is the slope, its steepness, and $b$ is where it crosses the $y$-axis (the $y$-intercept).`,
        `$A$ is $(0, ${b})$, on the $y$-axis, so the $y$-intercept is ${b}.`,
        `From $A$ to $B$, $x$ goes up by 2 and $y$ goes up by ${2 * m}. Slope is rise over run: ${2 * m}/2 = ${m}.`,
        `So the equation is $y = ${m === 1 ? "" : m}x + ${b}$. Check $B$: $${m} \\times 2 + ${b} = ${b + 2 * m}$.`,
      ];
      choices = [
        { label: `y = ${m}x + ${b}`, correct: true },
        {
          label: `y = ${b}x + ${m}`,
          feedback: `This swaps the slope and intercept. At x = 0 it gives y = ${m}, but $A$ is at y = ${b}.`,
        },
        {
          label: `y = ${m}x`,
          feedback: `This line would pass through (0, 0). The displayed line crosses the $y$-axis at ${b}.`,
        },
        {
          label: `y = −${m}x + ${b}`,
          feedback:
            "A negative slope falls as $x$ increases. The displayed line rises from $A$ to $B$.",
        },
      ];
      break;
    }
    default:
      throw new Error("Missing choice generator");
  }
  // Shuffle the semantic choices before assigning position IDs: IDs reveal no answer category.
  for (let i = choices.length - 1; i > 0; i--) {
    const j = r(0, i);
    [choices[i], choices[j]] = [choices[j]!, choices[i]!];
  }
  let answer = "";
  const choiceFeedback: Record<string, string> = {};
  const options = choices.map((choice, index) => {
    const id = `option-${"abcd"[index]}`;
    if (choice.correct) answer = id;
    else choiceFeedback[id] = choice.feedback!;
    return { id, label: choice.label };
  });
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([templateId, 1, seed]))
        .digest("hex"),
      templateId,
      templateVersion: 1,
      seed,
      prompt,
      skillId: meta.skillId,
      response: { kind: "choice", label: "Choose one answer", options },
      ...(figure ? { figure } : {}),
    },
    answer,
    hint,
    explanation,
    choiceFeedback,
  };
}
