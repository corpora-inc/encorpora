import { createHash } from "node:crypto";
import { count } from "./agreement";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import { figureOptionIds } from "./figure-choice";
import { scene } from "./scene/author";
import type { Scene } from "./scene/spec";

/**
 * Count out a number from 1 to 20 (K.CC.B.5). The collection figure cannot
 * host multi-select over drawn objects, and point-plot is a different
 * capability. This is fallback B: figure-choice among ten-frames.
 */
const figures = {
  requiredResponseCapability: "figure-choice-v1",
  requiredFigureCapability: "scenes-v1",
} as const;

export const countOutObjectsTemplates: readonly TemplateMetadata[] = [
  {
    id: "count-out-objects",
    version: 1,
    title: "Choose the frame with that many",
    skillId: "count-to-20",
    gradeBand: "K–2",
    ...figures,
    description:
      "Choose the ten-frame that shows a given count from 1 to 20, among frames with one fewer, one more, or only the loose ones.",
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

function frameScene(shown: number): Scene {
  const frames = shown > 10 ? 2 : 1;
  const groups =
    shown > 10
      ? [
          { count: 10, shape: "dot" as const, color: "accent" as const },
          {
            count: shown - 10,
            shape: "dot" as const,
            color: "warm" as const,
          },
        ]
      : [{ count: shown, shape: "dot" as const, color: "accent" as const }];
  return scene({
    type: "tenFrame",
    id: "frame",
    frames,
    groups,
  }).build({ width: 240, maxHeight: frames === 2 ? 280 : 160 });
}

function frameLabel(shown: number, loose: boolean): string {
  if (loose)
    return `A frame that shows ${count(shown, "counter")}, only the loose ones, with no full ten.`;
  if (shown === 0)
    return "A frame that shows 0 counters. Every place is empty.";
  if (shown > 10)
    return `A frame that shows ${count(shown, "counter")}: one full ten and ${count(shown - 10, "more counter")}.`;
  if (shown === 10)
    return "A frame that shows 10 counters. Both rows of the frame are full.";
  return `A frame that shows ${count(shown, "counter")}. The other places are empty.`;
}

export function generateCountOutObjects(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const meta = countOutObjectsTemplates.find((t) => t.id === templateId);
  if (!meta) throw new Error(`Unknown count-out template: ${templateId}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  const n = r(1, 20);
  const cards: { shown: number; loose: boolean; feedback: string }[] = [
    { shown: n, loose: false, feedback: "" },
  ];
  const push = (shown: number, loose: boolean, feedback: string) => {
    if (
      shown < 0 ||
      shown > 20 ||
      shown === n ||
      cards.some((card) => card.shown === shown)
    )
      return;
    cards.push({ shown, loose, feedback });
  };
  push(
    n - 1,
    false,
    "That frame is one short. One more counter is needed.",
  );
  if (n + 1 <= 20)
    push(
      n + 1,
      false,
      `That frame has one too many counters. Stop when you reach ${n}.`,
    );
  else
    push(
      n - 2,
      false,
      "That frame is two short. It is not the count you were asked for.",
    );
  if (n >= 11)
    push(
      n - 10,
      true,
      "That frame shows only the loose counters. The full ten is still part of the number.",
    );
  else if (n !== 10)
    push(
      10,
      false,
      "That counts every place in the frame, not the counters that are there.",
    );
  else
    push(
      5,
      false,
      "That counts one row of the frame, not all of the counters.",
    );
  while (cards.length < 4) {
    for (let extra = 0; extra <= 20 && cards.length < 4; extra++)
      push(extra, false, "That frame shows a different count.");
  }
  const order = cards.slice(0, 4);
  for (let i = order.length - 1; i > 0; i--) {
    const j = r(0, i);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const options = order.map((card, index) => ({
    id: figureOptionIds[index]!,
    label: frameLabel(card.shown, card.loose),
    scene: frameScene(card.shown),
  }));
  const answer = options[order.findIndex((card) => card.shown === n)]!.id;
  const choiceFeedback = Object.fromEntries(
    order
      .map((card, index) => [figureOptionIds[index]!, card.feedback] as const)
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
      prompt: `Which frame shows ${count(n, "counter")}?`,
      skillId: meta.skillId,
      response: {
        kind: "figure-choice",
        label: "Choose the frame",
        noun: "Picture",
        options,
      },
    },
    answer,
    hint: `The question asks for ${n}. Count the counters in each frame, not the empty places.`,
    explanation: [
      `You were asked for ${count(n, "counter")}.`,
      n > 10
        ? `A full ten-frame is 10. The loose counters are ${n - 10}. 10 + ${n - 10} = ${n}.`
        : "Count the counters in the frame. Empty places are not counters.",
      n + 1 <= 20
        ? `${n + 1} is one too many. Stop at ${n}.`
        : `${n - 1} is one short of ${n}.`,
      "The frame you want is the one whose counters match that number.",
    ],
    choiceFeedback,
  };
}
