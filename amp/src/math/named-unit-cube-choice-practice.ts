import { createHash } from "node:crypto";
import type { GeneratedProblem, SemanticFigure, TemplateMetadata } from "./contracts.js";
import { geometryScene } from "./geometry-scenes.js";
import { visiblePrismCubes } from "./volume-coordinate-practice.js";

/** Which description is the volume: named units or an improvised count.
 * Single choice, because the numeric host cannot carry a choice response. */
export const namedUnitCubeChoiceTemplates: readonly TemplateMetadata[] = [
  {
    id: "named-unit-cube-choice",
    version: 1,
    title: "Which words name the volume",
    skillId: "volume-cubes",
    gradeBand: "3–5",
    description:
      "Choose the volume of a cube-built prism in cubic centimeters, cubic inches, cubic feet, or an improvised unit. Distractors use a square unit, a length, or only the cubes with a visible face.",
    requiredResponseCapability: "single-choice-v1",
    requiredFigureCapability: "scenes-v1",
    glossarySenses: { cubes: "cube", solid: "solid-shape", volume: "volume" },
    glossaryNoLink: ["square"],
  },
];

function clauseDraw(id: string, seed: string) {
  let counter = 0;
  return (lo: number, hi: number) => {
    const span = hi - lo + 1,
      limit = Math.floor(0x100000000 / span) * span;
    let value: number;
    do
      value = createHash("sha256")
        .update(JSON.stringify([id, "clause-family", seed, counter++]))
        .digest()
        .readUInt32BE(0);
    while (value >= limit);
    return lo + (value % span);
  };
}

const UNITS = ["cm", "in", "ft", "improvised"] as const;
type Unit = (typeof UNITS)[number];
const CUBIC = {
  cm: "cubic centimeters",
  in: "cubic inches",
  ft: "cubic feet",
} as const;
const SQUARE = {
  cm: "square centimeters",
  in: "square inches",
  ft: "square feet",
} as const;
const LENGTH = {
  cm: "centimeters",
  in: "inches",
  ft: "feet",
} as const;
const EDGE = {
  cm: "1-centimeter",
  in: "1-inch",
  ft: "1-foot",
} as const;
const OBJECTS = [
  { many: "blocks", held: "shoebox" },
  { many: "sugar cubes", held: "box" },
  { many: "dice", held: "box" },
  { many: "ice cubes", held: "cooler" },
  { many: "bales", held: "trailer" },
] as const;

export function generateNamedUnitCubeChoice(
  templateId: string,
  seed: string,
): GeneratedProblem {
  if (templateId !== "named-unit-cube-choice")
    throw new Error(`Unknown template ${templateId}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const cr = clauseDraw(templateId, seed);
  const unit: Unit = UNITS[cr(0, 3)]!;
  let l: number, w: number, h: number;
  do {
    l = cr(2, 6);
    w = cr(2, 6);
    h = cr(2, 6);
  } while (l * w * h > 150);
  const volume = l * w * h;
  const visible = visiblePrismCubes(l, w, h);
  if (visible === volume || visible < 1)
    throw new Error("Visible cube count must differ from the volume");
  const object = OBJECTS[cr(0, OBJECTS.length - 1)]!;
  const unitPhrase = unit === "improvised" ? object.many : CUBIC[unit];
  const squarePhrase =
    unit === "improvised" ? `square ${object.many}` : SQUARE[unit];
  const lengthPhrase = unit === "improvised" ? "inches" : LENGTH[unit];
  const context = cr(0, 2);
  let prompt: string;
  if (unit === "ft") {
    const lead =
      context === 0
        ? "A shipping crate is packed with cubes that have 1-foot edges, with no gaps."
        : context === 1
          ? "A storage cube is packed with cubes that have 1-foot edges, with no gaps."
          : "A trailer is packed with hay bales that have 1-foot edges, with no gaps.";
    prompt = `${lead} Which describes its volume, in cubic feet?`;
  } else if (unit === "improvised") {
    prompt = `Maya packs a ${object.held} with identical ${object.many}, no gaps. Which describes the volume of the ${object.held}, in ${object.many}?`;
  } else if (unit === "in" && context === 0) {
    prompt =
      "Each block is 1 cubic inch. The blocks fill this rectangular prism with no gaps. Which describes its volume, in cubic inches?";
  } else {
    prompt = `Each small cube has ${EDGE[unit]} edges. Which describes the volume of this rectangular prism, in ${unitPhrase}?`;
  }
  const correct = `${volume} ${unitPhrase}`;
  const options: { label: string; correct?: true; feedback: string }[] = [
    { label: correct, correct: true, feedback: "" },
    {
      label: `${volume} ${squarePhrase}`,
      feedback: `${volume} ${squarePhrase} is an area. Volume counts cubes, so the unit is ${unitPhrase}.`,
    },
    {
      label: `${volume} ${lengthPhrase}`,
      feedback: `${volume} ${lengthPhrase} is a length. Volume counts cubes, so the unit is ${unitPhrase}.`,
    },
    {
      label: `${visible} ${unitPhrase}`,
      feedback: `${visible} ${unitPhrase} counts only cubes with a face you can see. Hidden cubes fill the solid too, so that is not the volume.`,
    },
  ];
  if (new Set(options.map((o) => o.label)).size !== 4)
    throw new Error("Choice labels collide");
  for (let i = options.length - 1; i > 0; i--) {
    const j = cr(0, i);
    [options[i], options[j]] = [options[j]!, options[i]!];
  }
  const choiceFeedback: Record<string, string> = {};
  let answer = "";
  const response = {
    kind: "choice" as const,
    label: "Choose one answer",
    options: options.map((o, i) => {
      const id = `option-${"abcd"[i]}`;
      if (o.correct) answer = id;
      else choiceFeedback[id] = o.feedback;
      return { id, label: o.label };
    }),
  };
  const figure: SemanticFigure = geometryScene({
    kind: "cube-prism",
    length: l,
    width: w,
    height: h,
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
      skillId: "volume-cubes",
      response,
      figure,
    },
    answer,
    hint: `Each small cube's edge is 1 of the named unit, and the prism is ${l} by ${w} by ${h}. A square unit measures a flat cover, and a length is a distance. Cubes you cannot see still fill the solid.`,
    explanation: [
      `The prism is ${l} by ${w} by ${h}. One layer holds $${l} \\times ${w} = ${l * w}$ ${unit === "improvised" ? object.many : "cubes"}.`,
      `There are ${h} layers, so the volume is $${l * w} \\times ${h} = ${volume}$ ${unitPhrase}.`,
      `${visible} ${unitPhrase} counts only the cubes with a face toward you. The hidden ones still fill the solid, so that count is not the volume.`,
      `The volume is ${correct}.`,
    ],
    choiceFeedback,
    variant: { id: unit },
  };
}
