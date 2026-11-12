import { withArticle } from "./agreement";
import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts.js";
import {
  figureOptionIds,
  figureOptionLetters,
  type FigureChoiceResponse,
} from "./figure-choice.js";
import { geometryScene } from "./geometry-scenes.js";
import { sceneSchema, type Scene } from "./scene/spec.js";
import { serializeSelection } from "./selection-response.js";
import {
  gradeStructuredWork,
  gradingFits,
  normalizeStructuredWork,
  structuralProblem,
  type StructuredWorkResponse,
  type WorkGrading,
} from "./structured-work.js";

/** Packing a prism with unit cubes gives the same count as the edge product. */
export const packEqualsProductTemplates: readonly TemplateMetadata[] = [
  {
    id: "pack-equals-product-work",
    version: 1,
    title: "Layers and the edge product",
    skillId: "volume-cubes",
    gradeBand: "3–5",
    description:
      "Enter the cubes in one layer, the number of layers, the volume from the layers, and the product of the three edges, then say whether those volumes match.",
    requiredResponseCapability: "structured-work-v1",
    requiredFigureCapability: "scenes-v1",
    glossarySenses: {
      cube: "cube",
      layer: "volume",
      product: "product-multiply",
      volume: "volume",
    },
  },
  {
    id: "pack-equals-product-select",
    version: 1,
    title: "Expressions that count the cubes",
    skillId: "volume-cubes",
    gradeBand: "3–5",
    description:
      "Choose every product of the three edges that counts the cubes. Sums and a product of only two edges do not.",
    requiredResponseCapability: "multi-select-v1",
    requiredFigureCapability: "scenes-v1",
    glossarySenses: {
      cube: "cube",
      product: "product-multiply",
      volume: "volume",
    },
  },
  {
    id: "pack-equals-product-picture",
    version: 1,
    title: "Which solid is these layers",
    skillId: "volume-cubes",
    gradeBand: "3–5",
    description:
      "Choose the lifted-layer prism whose layer count times its base count is the product asked for.",
    requiredResponseCapability: "figure-choice-v1",
    requiredFigureCapability: "scenes-v1",
    glossarySenses: { cube: "cube", layer: "volume", volume: "volume" },
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

function shuffle<T>(
  r: (lo: number, hi: number) => number,
  items: readonly T[],
): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = r(0, i);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Three distinct edges from 2 to 6. Their product is at most 120. */
function distinctEdges(cr: (lo: number, hi: number) => number) {
  let l: number, w: number, h: number;
  do {
    l = cr(2, 6);
    w = cr(2, 6);
    h = cr(2, 6);
  } while (new Set([l, w, h]).size < 3);
  return { l, w, h, volume: l * w * h };
}

function prismFigure(l: number, w: number, h: number): SemanticFigure {
  return geometryScene(
    { kind: "cube-prism", length: l, width: w, height: h },
    (scene) => ({
      ...scene,
      steps: [
        {
          caption: "The bottom layer covers the base.",
          actions: [{ do: "fill", target: "prism.layer.0", fill: "warm-fill" }],
        },
      ],
    }),
  );
}

function idOf(templateId: string, seed: string) {
  return createHash("sha256")
    .update(JSON.stringify([templateId, 1, seed]))
    .digest("hex");
}

function workProblem(seed: string): GeneratedProblem {
  const templateId = "pack-equals-product-work";
  const cr = clauseDraw(templateId, seed);
  const { l, w, h, volume } = distinctEdges(cr);
  const layer = l * w;
  const claims = shuffle(cr, [
    { id: "eq", label: "equal" },
    { id: "ne", label: "not equal" },
  ]);
  const response: StructuredWorkResponse = {
    kind: "structured-work",
    label: "Count, then multiply",
    layout: "steps",
    mode: "build",
    banks: [
      {
        id: "match",
        label: "Compare the two volumes",
        options: claims,
      },
    ],
    rows: [
      {
        id: "r1",
        label: "Cubes in the bottom layer",
        fields: [{ kind: "number", label: "Cubes" }],
      },
      {
        id: "r2",
        label: "Number of layers",
        fields: [{ kind: "number", label: "Layers" }],
      },
      {
        id: "r3",
        label: "Volume from the layers",
        fields: [{ kind: "number", label: "Cubes" }],
      },
      {
        id: "r4",
        label: "Product of the three edges",
        fields: [{ kind: "number", label: "Cubes" }],
      },
      {
        id: "r5",
        label: "The layer count and the edge product are",
        fields: [{ kind: "choice", label: "Comparison", bank: "match" }],
      },
    ],
  };
  const workGrading: WorkGrading = {
    mode: "fields",
    fields: [
      [{ kind: "number", value: String(layer) }],
      [{ kind: "number", value: String(h) }],
      [{ kind: "number", value: String(volume) }],
      [{ kind: "number", value: String(volume) }],
      [{ kind: "choice", accept: ["eq"] }],
    ],
  };
  const answer = JSON.stringify([
    [String(layer)],
    [String(h)],
    [String(volume)],
    [String(volume)],
    ["eq"],
  ]);
  const problem = structuralProblem(response);
  if (problem) throw new Error(problem);
  if (!gradingFits(response, workGrading)) throw new Error("Rule does not fit");
  if (normalizeStructuredWork(response, answer) !== answer)
    throw new Error("Answer key is not canonical");
  if (!gradeStructuredWork(response, workGrading, answer))
    throw new Error("Answer key is not credited");
  return {
    public: {
      id: idOf(templateId, seed),
      templateId,
      templateVersion: 1,
      seed,
      prompt: `This prism is ${l} cubes long, ${w} cubes wide and ${h} cubes high. Find the cubes in the bottom layer, the number of layers, the volume from the layers, and the product of the three edges.`,
      skillId: "volume-cubes",
      response,
      figure: prismFigure(l, w, h),
    },
    answer,
    workGrading,
    hint: `This prism is ${l} cubes long, ${w} wide and ${h} high. The bottom layer is the length times the width. The height is the number of layers. Multiply those, and multiply the three edges. Then compare the two results.`,
    explanation: [
      `The bottom layer is $${l} \\times ${w} = ${layer}$ cubes.`,
      `The prism is ${h} cubes high, so it has ${h} layers: $${layer} \\times ${h} = ${volume}$.`,
      `The three edges multiply to $${l} \\times ${w} \\times ${h} = ${volume}$.`,
      `Both ways count the same cubes, so the layer count and the edge product are equal.`,
    ],
    variant: { id: "layers" },
  };
}

function selectProblem(seed: string): GeneratedProblem {
  const templateId = "pack-equals-product-select";
  const cr = clauseDraw(templateId, seed);
  const { l, w, h, volume } = distinctEdges(cr);
  const layer = l * w;
  const correct = [
    {
      label: `${h} × (${l} × ${w})`,
      value: h * l * w,
      why: `${h} layers of ${l} by ${w}`,
    },
    {
      label: `${l} × (${w} × ${h})`,
      value: l * w * h,
      why: `${l} layers of ${w} by ${h}`,
    },
    {
      label: `(${l} × ${h}) × ${w}`,
      value: l * h * w,
      why: `${w} layers of ${l} by ${h}`,
    },
  ];
  const distractors = [
    { label: `${l} + ${w} + ${h}`, value: l + w + h, why: "adds the edges" },
    { label: `${l} × ${w}`, value: layer, why: "only the bottom layer" },
    {
      label: `${l} × ${w} + ${h}`,
      value: layer + h,
      why: "adds the height to the base",
    },
  ];
  if (correct.some((c) => c.value !== volume))
    throw new Error("A grouping missed the volume");
  if (distractors.some((d) => d.value === volume))
    throw new Error("A distractor equals the volume");
  const cards = shuffle(cr, [
    ...correct.map((c) => ({ ...c, correct: true as const })),
    ...distractors.map((d) => ({ ...d, correct: false as const })),
  ]);
  if (new Set(cards.map((c) => c.label)).size !== cards.length)
    throw new Error("Expression labels collide");
  const responseOptions = cards.map((c, i) => ({
    id: `option-${"abcdef"[i]}`,
    label: c.label,
  }));
  const keyed = responseOptions.filter((_, i) => cards[i]!.correct);
  if (keyed.length !== 3) throw new Error("Need three correct expressions");
  return {
    public: {
      id: idOf(templateId, seed),
      templateId,
      templateVersion: 1,
      seed,
      prompt: `This prism is ${l} cubes long, ${w} cubes wide and ${h} cubes high. Choose every expression that gives the number of cubes in this box.`,
      skillId: "volume-cubes",
      response: {
        kind: "multi-select",
        label: "Choose every expression",
        selectionCount: 3,
        options: responseOptions,
      },
      figure: prismFigure(l, w, h),
    },
    answer: serializeSelection(keyed.map((o) => o.id)),
    hint: `This prism is ${l} cubes long, ${w} wide and ${h} high. A product of all three edges counts the cubes, in any grouping. Adding an edge, or stopping after two edges, does not.`,
    explanation: [
      `One layer is $${l} \\times ${w} = ${layer}$ cubes, and ${h} layers make $${layer} \\times ${h} = ${volume}$.`,
      `${h} × (${l} × ${w}) is ${h} layers of ${layer}. ${l} × (${w} × ${h}) turns the box onto ${withArticle(w)} by ${h} face. (${l} × ${h}) × ${w} makes ${w} layers of ${l * h}.`,
      `Each product is ${volume}. ${l} + ${w} + ${h} adds the edges, ${l} × ${w} is only the bottom layer, and ${l} × ${w} + ${h} adds the height instead of multiplying by it.`,
    ],
    variant: { id: "groupings" },
  };
}

type Card = {
  l: number;
  w: number;
  h: number;
  description: string;
  feedback?: string;
};

function lifted(l: number, w: number, h: number): Scene {
  return sceneSchema.parse({
    v: 1,
    width: 260,
    maxHeight: 240,
    elements: [
      {
        type: "isoSolid",
        id: "prism",
        solid: { form: "cubes", length: l, width: w, height: h, lift: 0.45 },
      },
    ],
  });
}

function pictureProblem(seed: string): GeneratedProblem {
  const templateId = "pack-equals-product-picture";
  const cr = clauseDraw(templateId, seed);
  const { l, w, h } = distinctEdges(cr);
  const turns = [
    [l, w, h],
    [w, h, l],
    [h, l, w],
  ] as const;
  const [bl, bw, layers] = turns[cr(0, 2)]!;
  const base = bl * bw;
  const volume = base * layers;
  const describe = (a: number, b: number, c: number) =>
    `${c} layers of cubes. The base is ${a} cubes by ${b} cubes.`;
  const correct: Card = {
    l: bl,
    w: bw,
    h: layers,
    description: describe(bl, bw, layers),
  };
  const used = new Set([`${bl}x${bw}x${layers}`]);
  const wrong: Card[] = [];
  const add = (a: number, b: number, c: number, feedback: string) => {
    if (a < 2 || a > 6 || b < 2 || b > 6 || c < 2 || c > 6) return false;
    if (a * b * c === volume) return false;
    const key = `${a}x${b}x${c}`;
    if (used.has(key)) return false;
    used.add(key);
    wrong.push({
      l: a,
      w: b,
      h: c,
      description: describe(a, b, c),
      feedback,
    });
    return true;
  };
  const taller = layers === 6 ? 5 : layers + 1;
  const shorter = layers === 2 ? 3 : layers - 1;
  add(bl, bw, taller, `This picture has ${taller} layers, not ${layers}.`) ||
    add(bl, bw, shorter, `This picture has ${shorter} layers, not ${layers}.`);
  const wider = bl === 6 ? 5 : bl + 1;
  const narrower = bl === 2 ? 3 : bl - 1;
  add(
    wider,
    bw,
    layers,
    `This base is ${wider} by ${bw}, so a layer is not ${base} cubes.`,
  ) ||
    add(
      narrower,
      bw,
      layers,
      `This base is ${narrower} by ${bw}, so a layer is not ${base} cubes.`,
    );
  let square = 2,
    best = Infinity;
  for (let s = 2; s <= 6; s++) {
    if (s * s === base) continue;
    const diff = Math.abs(s * s - base);
    if (diff < best) {
      best = diff;
      square = s;
    }
  }
  add(
    square,
    square,
    layers,
    `This base is ${withArticle(square)} by ${square} square. The layer you want holds ${base} cubes, not ${square * square}.`,
  );
  for (let a = 2; a <= 6 && wrong.length < 3; a++)
    for (let b = 2; b <= 6 && wrong.length < 3; b++)
      for (let c = 2; c <= 6 && wrong.length < 3; c++)
        add(a, b, c, "Count the cubes in one layer, then the layers.");
  if (wrong.length < 3) throw new Error("Need three other prisms");
  const cards = shuffle(cr, [correct, ...wrong.slice(0, 3)]);
  if (new Set(cards.map((c) => c.description)).size !== 4)
    throw new Error("Picture descriptions collide");
  const response: FigureChoiceResponse = {
    kind: "figure-choice",
    label: "Choose the solid",
    noun: "Picture",
    options: cards.map((c, i) => ({
      id: figureOptionIds[i]!,
      label: c.description,
      scene: lifted(c.l, c.w, c.h),
    })),
  };
  const answer = figureOptionIds[cards.indexOf(correct)]!;
  const choiceFeedback: Record<string, string> = {};
  cards.forEach((c, i) => {
    if (c !== correct) choiceFeedback[figureOptionIds[i]!] = c.feedback!;
  });
  const letter = figureOptionLetters[cards.indexOf(correct)]!;
  return {
    public: {
      id: idOf(templateId, seed),
      templateId,
      templateVersion: 1,
      seed,
      prompt: `Which solid is ${layers} layers of ${base} cubes?`,
      skillId: "volume-cubes",
      response,
    },
    answer,
    choiceFeedback,
    hint: `Count the cubes in one layer of each picture, then count its layers. You want ${layers} layers, and ${base} cubes in a layer.`,
    explanation: [
      `${layers} layers of ${base} is a base of ${bl} by ${bw}, stacked ${layers} high: $${bl} \\times ${bw} \\times ${layers} = ${volume}$.`,
      `Picture ${letter} shows ${layers} layers on ${withArticle(bl)} by ${bw} base.`,
      `The other pictures change the layer count or the base, so their layer count times their base count is not ${base} × ${layers}.`,
    ],
    variant: { id: "layers" },
  };
}

export function generatePackEqualsProduct(
  templateId: string,
  seed: string,
): GeneratedProblem {
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  if (templateId === "pack-equals-product-work") return workProblem(seed);
  if (templateId === "pack-equals-product-select") return selectProblem(seed);
  if (templateId === "pack-equals-product-picture") return pictureProblem(seed);
  throw new Error(`Unknown template ${templateId}`);
}
