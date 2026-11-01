import { createHash } from "node:crypto";
import { geometryScene } from "./geometry-scenes.js";
import { sceneSchema, type Scene } from "./scene/spec.js";
import type {
  GeneratedProblem,
  ProblemVariant,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts.js";
import { sweepChoose, sweepVariant } from "./number-domain-axes.js";

const definitions: [string, string, string, string, boolean][] = [
  [
    "unit-cube-volume",
    "Volume from unit cubes",
    "volume-cubes",
    "Find the volume of a prism built from unit cubes, including hidden cubes.",
    false,
  ],
  [
    "cube-layer-count",
    "One layer of cubes",
    "volume-cubes",
    "Count the unit cubes in the bottom layer of a prism.",
    false,
  ],
  [
    "prism-volume-edges",
    "Volume from edge lengths",
    "prism-volume",
    "Find the volume of a rectangular prism from its labeled edges.",
    false,
  ],
  [
    "prism-missing-edge",
    "Missing edge from volume",
    "prism-volume",
    "Find a missing edge of a rectangular prism from its volume and two edges.",
    false,
  ],
  [
    "composite-prism-volume",
    "Volume of a joined solid",
    "prism-volume",
    "Add the volumes of two non-overlapping rectangular prisms.",
    false,
  ],
  [
    "first-quadrant-locate",
    "Find the point at a pair",
    "coordinate-first-quadrant",
    "Choose the plotted point named by an ordered pair.",
    true,
  ],
  [
    "first-quadrant-coordinates",
    "Name a point's coordinates",
    "coordinate-first-quadrant",
    "Choose the ordered pair of a plotted point.",
    true,
  ],
  [
    "coordinate-move",
    "Move on the grid",
    "coordinate-first-quadrant",
    "Find the coordinates reached by moving right and up from a point.",
    true,
  ],
];
export const volumeCoordinateTemplates: readonly TemplateMetadata[] =
  definitions.map(([id, title, skillId, description, choice]) => ({
    id,
    title,
    skillId,
    description,
    version: 1,
    gradeBand: "3–5",
    requiredFigureCapability: "scenes-v1",
    ...(choice
      ? { requiredResponseCapability: "single-choice-v1" as const }
      : {}),
  }));

function random(id: string, seed: string) {
  let counter = 0;
  return (lo: number, hi: number) => {
    const span = hi - lo + 1,
      limit = Math.floor(0x100000000 / span) * span;
    let value: number;
    do
      value = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    while (value >= limit);
    return lo + (value % span);
  };
}
const count = (n: number, noun: string) =>
  `${n} ${n === 1 ? noun : `${noun}s`}`;
const pair = (x: number, y: number) => `(${x}, ${y})`;
type Choice = { label: string; correct?: true; feedback?: string };

export function generateVolumeCoordinateProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const meta = volumeCoordinateTemplates.find((t) => t.id === templateId);
  if (!meta)
    throw new Error(`Unknown volume or coordinate template ${templateId}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  let prompt = "",
    answer = "",
    hint = "",
    label = "Answer",
    explanation: string[] = [],
    figure: SemanticFigure,
    choices: Choice[] | undefined,
    keepOrder = false,
    edit: ((scene: Scene) => Scene) | undefined,
    variant: ProblemVariant | undefined;
  switch (templateId) {
    case "unit-cube-volume":
    case "cube-layer-count": {
      const axes =
        templateId === "unit-cube-volume"
          ? sweepChoose("unit-cube-volume", seed)
          : undefined;
      if (axes) variant = sweepVariant(axes.solid, axes);
      if (axes?.solid === "steps") {
        // A stepped solid, not a full prism: columns from back to front, each
        // no taller than the one behind it, so every column shows.
        let depth = 0,
          columns: number[] = [];
        do {
          depth = r(2, 4);
          const n = r(3, 5);
          columns = Array.from({ length: n }, () => r(1, 5)).sort(
            (a, b) => b - a,
          );
        } while (
          columns[0] === columns.at(-1) ||
          depth * columns.reduce((a, b) => a + b, 0) < 12 ||
          depth * columns.reduce((a, b) => a + b, 0) > 45
        );
        const front = columns.reduce((a, b) => a + b, 0),
          total = depth * front;
        figure = {
          kind: "scene",
          scene: sceneSchema.parse({
            v: 1,
            width: 320,
            elements: [
              {
                type: "isoSolid",
                id: "solid",
                solid: { form: "steps", width: depth, columns },
              },
            ],
          }),
        };
        prompt =
          "This solid is built from 1-unit cubes, and every column is filled to the bottom. What is its volume, in cubic units?";
        answer = String(total);
        label = "Volume in cubic units";
        hint = `Some cubes are hidden. The solid is ${depth} cubes thick, and every slice through it matches the face that shows the steps. Count the cubes on that face, column by column, then multiply by the thickness.`;
        explanation = [
          `Volume is how many unit cubes fill a solid. Hidden cubes count too.`,
          `The face that shows the steps has ${columns.length} columns. Their heights in cubes are ${columns.join(", ")}: $${columns.join(" + ")} = ${front}$ cubes.`,
          `The solid is ${depth} cubes thick, and every slice behind that face has the same ${front} cubes.`,
          `$${front} \\times ${depth} = ${total}$, so the volume is ${total} cubic units.`,
        ];
        break;
      }
      const l = r(2, 5),
        w = r(2, 4),
        h = r(2, 4),
        layer = l * w;
      figure = { kind: "cube-prism", length: l, width: w, height: h };
      // Cubes fill the prism layer by layer: each layer turns warm and its
      // running total appears beside it (masked in hints).
      edit = (scene) => ({
        ...scene,
        elements: scene.elements.map((e) =>
          e.type === "isoSolid" && e.solid.form === "cubes"
            ? { ...e, solid: { ...e.solid, counts: true } }
            : e,
        ),
        steps: Array.from({ length: h }, (_, k) => ({
          caption:
            k === 0
              ? "The bottom layer: count along the length and the width, then multiply. {prism.count.0} cubes."
              : k === h - 1
                ? `Layer ${k + 1} is the same. With every layer: {prism.count.${k}} cubes.`
                : `Layer ${k + 1} is the same: {prism.count.${k}} cubes so far.`,
          actions: [
            {
              do: "fill" as const,
              target: `prism.layer.${k}`,
              fill: "warm-fill" as const,
            },
            { do: "appear" as const, target: `prism.count.${k}` },
          ],
          ...(templateId === "cube-layer-count" && k > 0
            ? { audience: "lesson" as const }
            : {}),
        })),
      });
      if (templateId === "unit-cube-volume") {
        prompt =
          "Each small cube is 1 cubic unit. What is the volume of this rectangular prism, in cubic units?";
        answer = String(layer * h);
        label = "Volume in cubic units";
        hint = `Some cubes are hidden. The top layer is ${l} cubes by ${w} cubes, and every layer below matches it. Count the layers, then multiply.`;
        explanation = [
          `Volume is how many unit cubes fill a solid. Count one layer, then count the layers.`,
          `The top layer has ${l} cubes along one edge and ${w} along the other: $${l} \\times ${w} = ${layer}$ cubes.`,
          `Every layer below it is the same. Count the layers up the side: there are ${h}.`,
          `$${layer} \\times ${h} = ${layer * h}$, so the volume is ${layer * h} cubic units.`,
        ];
      } else {
        prompt =
          "This prism is built from unit cubes. How many cubes are in its bottom layer?";
        answer = String(layer);
        label = "Cubes in one layer";
        hint = `The bottom layer matches the top. Along one top edge there are ${l} cubes; count the cubes along the other top edge, then multiply.`;
        explanation = [
          `A prism has the same shape all the way up, so every layer, top or bottom, has the same cubes.`,
          `The top face shows ${l} cubes along one edge and ${w} along the other: ${l} rows of ${w}.`,
          `So the bottom layer has $${l} \\times ${w} = ${layer}$ cubes.`,
          `There are ${layer} cubes in the bottom layer.`,
        ];
      }
      break;
    }
    case "prism-volume-edges": {
      let l: number, w: number, h: number;
      do {
        l = r(2, 12);
        w = r(2, 9);
        h = r(2, 10);
      } while (l * w * h > 600);
      const base = l * w,
        volume = base * h;
      figure = {
        kind: "box-prism",
        length: { value: l, unit: "cm" },
        width: { value: w, unit: "cm" },
        height: { value: h, unit: "cm" },
      };
      prompt =
        "What is the volume of this rectangular prism, in cubic centimeters?";
      answer = String(volume);
      label = "Volume in cubic cm";
      hint = `One layer of centimeter cubes covers the ${l} cm by ${w} cm base. How many such layers fill the ${h} cm height?`;
      explanation = [
        `Volume is how many centimeter cubes (1 cm on each edge) fill the prism.`,
        `The base is ${l} cm by ${w} cm, so one layer holds $${l} \\times ${w} = ${base}$ centimeter cubes.`,
        `Each layer is 1 cm tall, and the prism is ${h} cm high, so it holds ${h} layers.`,
        `$V = ${base} \\times ${h} = ${volume}$ cubic centimeters.`,
      ];
      break;
    }
    case "prism-missing-edge": {
      let l: number, w: number, h: number;
      do {
        l = r(2, 10);
        w = r(2, 8);
        h = r(2, 9);
      } while (l * w * h > 480);
      const volume = l * w * h,
        missing = (["length", "width", "height"] as const)[r(0, 2)]!;
      const sides = { length: l, width: w, height: h };
      const known = (["length", "width", "height"] as const).filter(
        (side) => side !== missing,
      );
      const [a, b] = known.map((side) => sides[side]) as [number, number];
      const face = a * b;
      figure = {
        kind: "box-prism",
        length: missing === "length" ? null : { value: l, unit: "cm" },
        width: missing === "width" ? null : { value: w, unit: "cm" },
        height: missing === "height" ? null : { value: h, unit: "cm" },
      };
      prompt = `This rectangular prism has a volume of ${volume} cubic centimeters. What is the length of the edge marked ?, in centimeters?`;
      answer = String(sides[missing]);
      label = "Edge length in cm";
      hint = `Volume is the product of the three edges: ${a} × ${b} × ? = ${volume}. Multiply the two known edges first.`;
      explanation = [
        `A rectangular prism's volume is length times width times height: $${a} \\times ${b} \\times ? = ${volume}$.`,
        `Multiply the two known edges first: $${a} \\times ${b} = ${face}$. So $${face} \\times ? = ${volume}$.`,
        `Division undoes multiplication: $${volume} \\div ${face} = ${answer}$.`,
        `Check: $${a} \\times ${b} \\times ${answer} = ${volume}$. The missing edge is ${answer} cm.`,
      ];
      break;
    }
    case "composite-prism-volume": {
      // The taller prism stands behind the shorter one, so both tops show.
      const width = r(2, 5),
        tall = r(4, 8),
        parts = [
          { length: r(2, 6), height: tall },
          { length: r(2, 6), height: r(2, tall - 1) },
        ];
      figure = { kind: "composite-prism", width, parts, unit: "cm" };
      const volumes = parts.map((p) => p.length * width * p.height);
      prompt =
        "This solid is made of two rectangular prisms of the same depth that do not overlap. What is its total volume, in cubic centimeters?";
      answer = String(volumes[0]! + volumes[1]!);
      label = "Volume in cubic cm";
      hint = `Split the solid into its two prisms. The taller one is ${parts[0]!.length} by ${width} by ${parts[0]!.height} cm. Find each volume, then add.`;
      explanation = [
        `The solid splits into two boxes. Find each volume (length times width times height), then add.`,
        `Taller prism: $${parts[0]!.length} \\times ${width} \\times ${parts[0]!.height} = ${volumes[0]}$ cubic centimeters.`,
        `Shorter prism: $${parts[1]!.length} \\times ${width} \\times ${parts[1]!.height} = ${volumes[1]}$ cubic centimeters.`,
        `The prisms do not overlap, so their volumes add: $${volumes[0]} + ${volumes[1]} = ${answer}$ cubic centimeters.`,
      ];
      break;
    }
    case "first-quadrant-locate": {
      const size = r(6, 8);
      let x: number, y: number;
      do {
        x = r(1, size - 1);
        y = r(1, size - 1);
      } while (x === y);
      const target = { x, y };
      // The reversed pair and one off-by-one neighbor are the telling errors;
      // the fourth point stands apart so every label reads clearly.
      const offByOne = r(0, 1)
        ? { x, y: y + (y < size - 1 && r(0, 1) ? 1 : -1), why: "up" }
        : { x: x + (x < size - 1 && r(0, 1) ? 1 : -1), y, why: "across" };
      const unique = [
        { ...target, why: "target" },
        { x: y, y: x, why: "swapped" },
        ...(offByOne.x >= 1 && offByOne.y >= 1 ? [offByOne] : []),
      ];
      while (unique.length < 4) {
        const p = { x: r(1, size - 1), y: r(1, size - 1), why: "other" };
        if (
          unique.every(
            (q) => Math.max(Math.abs(q.x - p.x), Math.abs(q.y - p.y)) >= 2,
          )
        )
          unique.push(p);
      }
      for (let i = unique.length - 1; i > 0; i--) {
        const j = r(0, i);
        [unique[i], unique[j]] = [unique[j]!, unique[i]!];
      }
      const names = ["P", "Q", "R", "S"] as const;
      figure = {
        kind: "quadrant-grid",
        size,
        points: unique.map((p, i) => ({ x: p.x, y: p.y, label: names[i]! })),
      };
      const named = unique.map((p, i) => ({ ...p, label: names[i]! }));
      const right = named.find((p) => p.why === "target")!;
      prompt = `Which point is at ${pair(x, y)}?`;
      hint = `For ${pair(x, y)}, start at 0. Go ${x} to the right first, then ${y} up.`;
      explanation = [
        `A point's coordinates are an ordered pair: (across, up), both counted from 0 where the axes meet.`,
        `The first number, ${x}, means ${count(x, "unit")} across from 0.`,
        `The second number, ${y}, means ${count(y, "unit")} up.`,
        `Point $${right.label}$ is ${x} right and ${y} up, so it is at ${pair(x, y)}.`,
      ];
      keepOrder = true;
      choices = named.map((p) =>
        p.why === "target"
          ? { label: `$${p.label}$`, correct: true }
          : {
              label: `$${p.label}$`,
              feedback:
                p.why === "swapped"
                  ? `$${p.label}$ is at ${pair(p.x, p.y)}: ${p.x} right and ${p.y} up. That reverses the pair. Go across first, then up.`
                  : p.why === "up"
                    ? `$${p.label}$ is ${x} right but ${p.y} up, not ${y}. Count up from 0 along the vertical axis.`
                    : p.why === "across"
                      ? `$${p.label}$ is ${y} up but ${p.x} right, not ${x}. Count across from 0 along the horizontal axis.`
                      : `$${p.label}$ is at ${pair(p.x, p.y)}, not ${pair(x, y)}. Go ${x} right from 0, then ${y} up.`,
            },
      );
      break;
    }
    case "first-quadrant-coordinates": {
      const size = r(6, 8);
      let x: number, y: number;
      do {
        x = r(1, size - 2);
        y = r(1, size - 2);
      } while (x === y || Math.abs(x - y) === 1);
      figure = {
        kind: "quadrant-grid",
        size,
        points: [{ x, y, label: "P" }],
      };
      // Walk from the origin: across, then up. The distances are derived
      // from the walk itself, so a hint shows "?" for each.
      edit = (scene) => ({
        ...scene,
        elements: [
          ...scene.elements.map((e) =>
            e.type === "graph"
              ? {
                  ...e,
                  slopeTriangles: [
                    {
                      from: [0, 0] as [number, number],
                      to: [x, y] as [number, number],
                      labels: "none" as const,
                      color: "warm" as const,
                    },
                  ],
                }
              : e,
          ),
        ],
        steps: [
          {
            caption:
              "Go across along the horizontal axis until you are straight below $P$. That distance is the first coordinate.",
            actions: [{ do: "trace", target: "grid.slope.0.run" }],
          },
          {
            caption:
              "Then go straight up to $P$. That distance is the second coordinate: across first, then up.",
            actions: [{ do: "trace", target: "grid.slope.0.rise" }],
            audience: "lesson",
          },
        ],
      });
      prompt = "What are the coordinates of point $P$?";
      hint = `From $P$, go straight down to the horizontal axis for the first number, then straight left for the second. $P$ is ${x > y ? "farther across than it is up" : "higher up than it is across"}, so check that its first number is the ${x > y ? "larger" : "smaller"} one.`;
      explanation = [
        `Coordinates are an ordered pair (across, up), counted from 0 where the axes meet.`,
        `Straight below $P$, the horizontal axis reads ${x}. That is the first coordinate.`,
        `Straight left of $P$, the vertical axis reads ${y}. That is the second coordinate.`,
        `$P$ is at ${pair(x, y)}: across first, then up.`,
      ];
      choices = [
        { label: pair(x, y), correct: true },
        {
          label: pair(y, x),
          feedback: `${pair(y, x)} is ${y} right and ${x} up, which is a different point. Write the across distance first.`,
        },
        {
          label: pair(x + 1, y + 1),
          feedback: `${pair(x + 1, y + 1)} counts one extra on each axis. The corner where the axes meet is 0, so count gridlines from 0.`,
        },
        {
          label: pair(y + 1, x + 1),
          feedback: `${pair(y + 1, x + 1)} reverses the order and counts from 1. Go across first, and start counting at 0.`,
        },
      ];
      break;
    }
    case "coordinate-move": {
      const size = 10;
      let x: number, y: number, right: number, up: number;
      do {
        x = r(0, 6);
        y = r(0, 6);
        right = r(1, 4);
        up = r(1, 4);
      } while (
        right === up ||
        x + right > size ||
        y + up > size ||
        (x === 0 && y === 0)
      );
      figure = {
        kind: "quadrant-grid",
        size,
        points: [{ x, y, label: "A" }],
      };
      const end = pair(x + right, y + up);
      prompt = `Start at point $A$. Move ${count(right, "unit")} right and ${count(up, "unit")} up. What are the coordinates of the point where you stop?`;
      hint = `Read A's coordinates first. Moving ${right} right adds ${right} to the first number; moving ${up} up adds ${up} to the second.`;
      explanation = [
        `Coordinates are written (across, up). $A$ is at ${pair(x, y)}.`,
        `Moving right changes only the first coordinate: $${x} + ${right} = ${x + right}$.`,
        `Moving up changes only the second coordinate: $${y} + ${up} = ${y + up}$.`,
        `You stop at ${end}.`,
      ];
      const options: Choice[] = [
        { label: end, correct: true },
        {
          label: pair(x + up, y + right),
          feedback: `${pair(x + up, y + right)} adds the moves to the wrong coordinates. Right changes the first number; up changes the second.`,
        },
        {
          label: pair(y + up, x + right),
          feedback: `${pair(y + up, x + right)} has the right numbers in the wrong order. Write the across coordinate first.`,
        },
        {
          label: pair(right, up),
          feedback: `${pair(right, up)} describes the move, not where it ends. Add the move to A's coordinates.`,
        },
      ];
      choices = options.filter(
        (c, i) => options.findIndex((d) => d.label === c.label) === i,
      );
      if (choices.length < 3)
        choices.push({
          label: pair(x + right, y),
          feedback: `${pair(x + right, y)} moves right but not up. Add the upward move to the second coordinate.`,
        });
      break;
    }
    default:
      throw new Error(`Missing volume or coordinate generator: ${templateId}`);
  }
  let response: GeneratedProblem["public"]["response"] = {
    kind: "number",
    label,
  };
  let choiceFeedback: Record<string, string> | undefined;
  if (choices) {
    if (
      choices.filter((c) => c.correct).length !== 1 ||
      new Set(choices.map((c) => c.label)).size !== choices.length
    )
      throw new Error("Ambiguous choices");
    if (!keepOrder)
      for (let i = choices.length - 1; i > 0; i--) {
        const j = r(0, i);
        [choices[i], choices[j]] = [choices[j]!, choices[i]!];
      }
    choiceFeedback = {};
    response = {
      kind: "choice",
      label: "Choose one answer",
      options: choices.map((c, i) => {
        const id = `option-${"abcd"[i]}`;
        if (c.correct) answer = id;
        else choiceFeedback![id] = c.feedback!;
        return { id, label: c.label };
      }),
    };
  }
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
      response,
      figure: geometryScene(figure, edit),
    },
    answer,
    hint,
    explanation,
    ...(choiceFeedback ? { choiceFeedback } : {}),
    ...(variant ? { variant } : {}),
  };
}
