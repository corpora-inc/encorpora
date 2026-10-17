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
    title: "Different pieces, same amount",
    skillId: "fraction-equivalence",
    gradeBand: "3–5",
    description:
      "Select an equivalent name for a proper fraction among scaling and additive misconceptions.",
  },
  {
    id: "equation-solution-count",
    version: 1,
    title: "One, none, or every number?",
    skillId: "linear-equations",
    gradeBand: "6–8",
    description:
      "Classify the solution set of a linear equation with positive integer coefficients on both sides.",
  },
  {
    id: "graph-equation-choice",
    version: 1,
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
      hint =
        "Imagine cutting every piece into the same number of smaller pieces. Does the shaded amount change?";
      explanation = [
        `The whole has ${d} equal pieces, and ${n} of them are shaded.`,
        `Cut each piece into ${k} equal pieces. The whole has ${d} × ${k} = ${d * k} pieces; the shaded part has ${n} × ${k} = ${n * k}.`,
        `No area was added or removed, so ${n}/${d} = ${n * k}/${d * k}. Both counts scale together.`,
      ];
      choices = [
        { label: `${n * k}/${d * k}`, correct: true },
        {
          label: `${n + 1}/${d + 1}`,
          feedback:
            "Adding the same number to the two counts changes the piece size without preserving the shaded amount. Equivalence needs the same scale factor.",
        },
        {
          label: `${n * k}/${d}`,
          feedback: `The denominator stays ${d}, so the pieces stay the same size. Taking ${k} times as many pieces makes the amount ${k} times as large.`,
        },
        {
          label: `${n}/${d * k}`,
          feedback: `There are ${k} times as many pieces in the whole, but the shaded count stays ${n}. That makes the shaded amount smaller.`,
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
      hint =
        "Subtract the x-term on the left from both sides. Then subtract the constant on the left. Is the result a value for x, a contradiction, or an identity?";
      explanation = [
        `Subtract ${a}x and then ${b} from both sides: 0 = ${c - a}x + ${d - b}.`,
        category === 0
          ? `The coefficient ${c - a} is not zero. Exactly one x makes ${c - a}x = ${b - d}.`
          : category === 1
            ? `This says 0 = ${d - b}, which is false for every x. There is no solution.`
            : "This says 0 = 0. It is true for every real number x, so there are infinitely many solutions.",
        "A zero coefficient does not mean x is zero. When all x-terms cancel, check whether the remaining statement is true or false.",
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
                  ? "One solution requires an equation that singles out one value of x. Here the x-terms cancel."
                  : index === 1
                    ? "No solution means the simplified equality is impossible. Cancellation alone does not prove that."
                    : "Infinitely many solutions means both expressions agree for every x. Check both the x-coefficients and the constants.",
            },
      );
      break;
    }
    case "graph-equation-choice": {
      const m = r(1, 3),
        b = r(4, 6);
      prompt = "Which equation matches the line through A and B?";
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
      hint =
        "Find y when x is zero. Then compare the vertical change from A to B with the horizontal change.";
      explanation = [
        `A is (0, ${b}), so the y-intercept is ${b}. The rule must give y = ${b} when x = 0.`,
        `From A to B, x increases by 2 and y increases by ${2 * m}. The slope is ${2 * m}/2 = ${m}.`,
        `The rule is y = ${m}x + ${b}. Check B: ${m} × 2 + ${b} = ${b + 2 * m}.`,
      ];
      choices = [
        { label: `y = ${m}x + ${b}`, correct: true },
        {
          label: `y = ${b}x + ${m}`,
          feedback: `This swaps the slope and intercept. At x = 0 it gives y = ${m}, but A is at y = ${b}.`,
        },
        {
          label: `y = ${m}x`,
          feedback: `This line would pass through (0, 0). The displayed line crosses the y-axis at ${b}.`,
        },
        {
          label: `y = −${m}x + ${b}`,
          feedback:
            "A negative slope falls as x increases. The displayed line rises from A to B.",
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
