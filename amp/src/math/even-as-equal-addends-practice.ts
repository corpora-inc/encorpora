import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";

/** Choose the equation that writes an even number as two equal addends
 * (2.OA.C.3). Pairing-leftover stays a typed leftover, so this is its own family. */
const choice = { requiredResponseCapability: "single-choice-v1" } as const;

export const evenAsEqualAddendsTemplates: readonly TemplateMetadata[] = [
  {
    id: "even-as-equal-addends",
    version: 1,
    title: "Even number as two equal addends",
    skillId: "odd-and-even",
    gradeBand: "K–2",
    ...choice,
    description:
      "Choose the equation that shows an even number of objects, from 2 to 20, as the sum of two equal addends.",
  },
];

function random(id: string, seed: string) {
  let counter = 0;
  return (low: number, high: number) => {
    const span = high - low + 1,
      limit = Math.floor(0x100000000 / span) * span;
    let value: number;
    do {
      value = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    } while (value >= limit);
    return low + (value % span);
  };
}

const eq = (n: number, parts: number[]) =>
  `$${n} = ${parts.join(" + ")}$`;

export function generateEvenAsEqualAddends(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const meta = evenAsEqualAddendsTemplates.find((t) => t.id === templateId);
  if (!meta) throw new Error(`Unknown even-addend template: ${templateId}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  const n = r(1, 5) <= 4 ? [6, 8, 10, 12, 14, 16, 18, 20][r(0, 7)]! : [2, 4][r(0, 1)]!;
  const half = n / 2;
  const correct = eq(n, [half, half]);
  const unequal = eq(n, [half - 1, half + 1]);
  const empty = eq(n, [n, 0]);
  const pairs =
    n >= 6
      ? eq(n, Array.from({ length: half }, () => 2))
      : n === 4
        ? eq(n, [half + 1, half - 1])
        : eq(n, [1, 1, 0]);
  const cards = [
    { label: correct, feedback: "" },
    {
      label: unequal,
      feedback:
        "Those two groups are not the same size. Equal groups have the same number in each group.",
    },
    {
      label: empty,
      feedback: `${n} + 0 uses two addends, but one group is empty. Both groups need socks.`,
    },
    {
      label: pairs,
      feedback:
        n >= 6
          ? "Those addends are the pairs, not two groups. Two equal groups use two addends."
          : "That sum does not show two groups of the same size.",
    },
  ];
  const order = cards.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = r(0, i);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const ids = ["option-a", "option-b", "option-c", "option-d"] as const;
  const options = order.map((card, index) => ({
    id: ids[index]!,
    label: card.label,
  }));
  const answer = ids[order.findIndex((card) => card.label === correct)]!;
  const choiceFeedback = Object.fromEntries(
    order
      .map((card, index) => [ids[index]!, card.feedback] as const)
      .filter(([, feedback]) => feedback),
  );
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([templateId, 1, seed]))
        .digest("hex"),
      templateId,
      templateVersion: 1,
      seed,
      prompt: `There are ${n} socks. Put them in two equal groups. Which equation shows the ${n} socks?`,
      skillId: meta.skillId,
      response: {
        kind: "choice",
        label: "Choose the equation",
        options,
      },
    },
    answer,
    hint: `There are ${n} socks in pairs. Move one sock from each pair into each group. The two groups must match.`,
    explanation: [
      "The socks make pairs, so the number is even.",
      "One sock from each pair goes to the left group. The other sock goes to the right group.",
      `The two groups have the same number of socks: ${half} and ${half}.`,
      `${n} is ${half} and ${half}, so ${correct}.`,
      `${half} + ${half} is a double.`,
    ],
    choiceFeedback,
    variant: { id: "equation-choice", axes: { form: "equation-choice" } },
  };
}
