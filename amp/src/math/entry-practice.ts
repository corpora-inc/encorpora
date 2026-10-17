import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts.js";
import type { EntryFigure } from "./entry-models.js";

export const entryTemplates: readonly TemplateMetadata[] = [
  {
    id: "compare-aligned-lengths",
    version: 1,
    title: "Line up and compare",
    skillId: "compare-attributes",
    gradeBand: "K–2",
    description:
      "Compare two aligned lengths, including equal lengths; no counting or units required.",
    requiredFigureCapability: "entry-models-v1",
    requiredResponseCapability: "single-choice-v1",
  },
  {
    id: "identify-basic-shape",
    version: 1,
    title: "Meet a shape",
    skillId: "name-shapes",
    gradeBand: "K–2",
    description:
      "Identify circles, triangles and squares across size and orientation; written choices may need adult read-aloud support.",
    requiredFigureCapability: "entry-models-v1",
    requiredResponseCapability: "single-choice-v1",
  },
];
export function generateEntryProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const meta = entryTemplates.find((t) => t.id === templateId);
  if (!meta) throw new Error("Unknown entry template");
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  let counter = 0;
  const r = (min: number, max: number) => {
    const span = max - min + 1,
      limit = Math.floor(0x100000000 / span) * span;
    let n: number;
    do {
      n = createHash("sha256")
        .update(JSON.stringify([templateId, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    } while (n >= limit);
    return min + (n % span);
  };
  let prompt: string,
    correct: string,
    hint: string,
    explanation: string[],
    figure: EntryFigure,
    labels: string[];
  if (templateId === "compare-aligned-lengths") {
    const shorter = r(2, 4) * 40,
      longer = shorter + r(1, (240 - shorter) / 40) * 40;
    const relation = r(0, 2),
      lengths: [number, number] =
        relation === 0
          ? [shorter, longer]
          : relation === 1
            ? [longer, shorter]
            : [shorter, shorter];
    const asksLonger = !!r(0, 1);
    figure = {
      kind: "aligned-strips",
      lengths,
      tone: r(0, 1) ? "teal-first" : "coral-first",
    };
    prompt = `Which strip is ${asksLonger ? "longer" : "shorter"}?`;
    correct =
      relation === 2
        ? "Same length"
        : lengths[0] > lengths[1] === asksLonger
          ? "Strip A"
          : "Strip B";
    labels = ["Strip A", "Strip B", "Same length"];
    hint =
      "The left ends line up. Compare the other ends: farther means longer; sooner means shorter.";
    explanation = [
      "The left ends line up.",
      relation === 2
        ? "Their other ends line up too. The strips have the same length."
        : `Strip ${lengths[0] > lengths[1] ? "A" : "B"} reaches farther. Strip ${lengths[0] < lengths[1] ? "A" : "B"} stops sooner.`,
      `Choose ${correct}.`,
    ];
  } else {
    const shape = r(0, 2),
      size = r(36, 54),
      angle = (r(0, 11) * Math.PI) / 6;
    labels = ["Circle", "Triangle", "Square"];
    correct = labels[shape]!;
    const rotate = ([x, y]: [number, number]): [number, number] => [
      160 + x * Math.cos(angle) - y * Math.sin(angle),
      90 + x * Math.sin(angle) + y * Math.cos(angle),
    ];
    const triangle: [number, number][][] = [
      [
        [0, -size],
        [size, size],
        [-size, size],
      ],
      [
        [-size, -size],
        [size, -size],
        [-size, size],
      ],
      [
        [-size, -size],
        [size, -size / 3],
        [-size / 4, size],
      ],
    ];
    figure = {
      kind: "shape-outline",
      tone: r(0, 1) ? "teal" : "coral",
      outline:
        shape === 0
          ? { form: "round", radius: size }
          : {
              form: "polygon",
              vertices: (shape === 1
                ? triangle[r(0, 2)]!
                : ([
                    [-size, -size],
                    [size, -size],
                    [size, size],
                    [-size, size],
                  ] as [number, number][])
              ).map(rotate),
            },
    };
    prompt = "What is this shape called?";
    hint =
      "Look at the boundary. Is it curved, or made of straight sides? Count the corners if there are any.";
    explanation =
      shape === 0
        ? [
            "The boundary is a smooth curve, with no straight sides or corners.",
            "Every point on it is equally far from the center. This is a circle.",
          ]
        : shape === 1
          ? [
              "Trace the boundary: three straight sides meet at three corners.",
              "This is a triangle. Triangles can have different side lengths; turning does not change their name.",
            ]
          : [
              "Four equal straight sides meet at right angles, like the corners of a sheet of paper.",
              "This is a square. Turning it does not change its side lengths or angles.",
            ];
  }
  const shuffled = [...labels];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = r(0, i);
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  const options = shuffled.map((label, i) => ({
    id: `option-${String.fromCharCode(97 + i)}`,
    label,
  }));
  const answer = options.find((o) => o.label === correct)!.id;
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
      response: { kind: "choice", label: "Choose one", options },
      figure,
    },
    answer,
    hint,
    explanation,
    choiceFeedback: Object.fromEntries(
      options
        .filter((o) => o.id !== answer)
        .map((o) => [
          o.id,
          templateId === "compare-aligned-lengths"
            ? "Start at the line. Compare the other ends."
            : "Look for straight sides and corners, or a curved boundary.",
        ]),
    ),
  };
}
