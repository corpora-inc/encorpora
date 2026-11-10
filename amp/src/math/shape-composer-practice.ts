import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import { random, shuffle } from "./distribution-practice";
import { shapeComposerScene } from "./shape-composer-scene";
import {
  normalizeShapeAnswer,
  placedCells,
  poseCells,
  shapeGuessChance,
  translated,
  type ShapeCell,
  type ShapeComposerResponse,
  type ShapePiece,
  type ShapePlacement,
  type ShapeStage,
} from "./shape-composer";

const cell = (
  x: number,
  y: number,
  fill: ShapeCell["fill"] = "full",
): ShapeCell => ({ x, y, fill });
const piece = (
  id: string,
  kind: ShapePiece["kind"],
  cells: ShapeCell[],
): ShapePiece => ({
  id,
  kind,
  name: kind,
  cells,
  canRotate: kind !== "square",
  canFlip: id === "RT",
  copies: 1,
});
export const shapePieces = {
  S: piece("S", "square", [cell(0, 0)]),
  R2: piece("R2", "rectangle", [cell(0, 0), cell(1, 0)]),
  R3: piece("R3", "rectangle", [cell(0, 0), cell(1, 0), cell(2, 0)]),
  T1: piece("T1", "triangle", [cell(0, 0, "h:NW")]),
  T2: piece("T2", "triangle", [
    cell(0, 0),
    cell(1, 0, "h:NW"),
    cell(0, 1, "h:NW"),
  ]),
  RT: piece("RT", "trapezoid", [cell(0, 0), cell(1, 0, "h:NW")]),
  IT: piece("IT", "trapezoid", [
    cell(0, 0, "h:NE"),
    cell(1, 0),
    cell(2, 0, "h:NW"),
  ]),
  Q: piece("Q", "quarter-circle", [cell(0, 0, "q:SW")]),
  H: piece("H", "half-circle", [cell(0, 0, "q:SE"), cell(1, 0, "q:SW")]),
};
type Recipe = {
  id: string;
  name: string;
  parts: [keyof typeof shapePieces, number, number, ShapePlacement["rot"]][];
};
export const shapeRecipes: Recipe[] = [
  {
    id: "unit-square",
    name: "square",
    parts: [
      ["T1", 0, 0, 0],
      ["T1", 0, 0, 180],
    ],
  },
  {
    id: "rectangle-2",
    name: "rectangle",
    parts: [
      ["S", 0, 0, 0],
      ["S", 1, 0, 0],
    ],
  },
  {
    id: "turned-triangle",
    name: "triangle",
    parts: [
      ["T1", 0, 0, 180],
      ["T1", 1, 0, 270],
    ],
  },
  {
    id: "right-trapezoid",
    name: "trapezoid",
    parts: [
      ["S", 0, 0, 0],
      ["T1", 1, 0, 0],
    ],
  },
  {
    id: "half-circle",
    name: "half-circle",
    parts: [
      ["Q", 0, 0, 270],
      ["Q", 1, 0, 0],
    ],
  },
  {
    id: "circle-halves",
    name: "circle",
    parts: [
      ["H", 0, 0, 0],
      ["H", 0, 1, 180],
    ],
  },
  {
    id: "square-four",
    name: "square",
    parts: [
      ["S", 0, 0, 0],
      ["S", 1, 0, 0],
      ["S", 0, 1, 0],
      ["S", 1, 1, 0],
    ],
  },
  {
    id: "rectangle-3",
    name: "rectangle",
    parts: [
      ["S", 0, 0, 0],
      ["S", 1, 0, 0],
      ["S", 2, 0, 0],
    ],
  },
  {
    id: "big-triangle",
    name: "triangle",
    parts: [
      ["S", 0, 0, 0],
      ["T1", 1, 0, 0],
      ["T1", 0, 1, 0],
    ],
  },
  {
    id: "trapezoid-three",
    name: "trapezoid",
    parts: [
      ["T1", 0, 0, 90],
      ["S", 1, 0, 0],
      ["T1", 2, 0, 0],
    ],
  },
  {
    id: "circle-quarters",
    name: "circle",
    parts: [
      ["Q", 0, 0, 270],
      ["Q", 1, 0, 0],
      ["Q", 0, 1, 180],
      ["Q", 1, 1, 90],
    ],
  },
  {
    id: "arch",
    name: "arch",
    parts: [
      ["Q", 0, 0, 270],
      ["Q", 1, 0, 0],
      ["R2", 0, 1, 0],
    ],
  },
  {
    id: "house",
    name: "house",
    parts: [
      ["T1", 0, 0, 180],
      ["T1", 1, 0, 270],
      ["S", 0, 1, 0],
      ["S", 1, 1, 0],
    ],
  },
  {
    id: "square-rectangles",
    name: "square",
    parts: [
      ["R2", 0, 0, 0],
      ["R2", 0, 1, 0],
    ],
  },
  {
    id: "square-triangles",
    name: "square",
    parts: [
      ["T2", 0, 0, 0],
      ["T2", 0, 0, 180],
    ],
  },
  {
    id: "hexagon",
    name: "hexagon",
    parts: [
      ["IT", 0, 0, 180],
      ["IT", 0, 1, 0],
    ],
  },
  {
    id: "rectangle-mixed",
    name: "rectangle",
    parts: [
      ["S", 0, 0, 0],
      ["T1", 1, 0, 0],
      ["T1", 1, 0, 180],
    ],
  },
  {
    id: "long-trapezoid",
    name: "trapezoid",
    parts: [
      ["R2", 0, 0, 0],
      ["T1", 2, 0, 0],
    ],
  },
  {
    id: "trapezoid-piece",
    name: "rectangle",
    parts: [
      ["RT", 0, 0, 0],
      ["T1", 1, 0, 180],
    ],
  },
  {
    id: "turned-square",
    name: "square",
    parts: [
      ["T1", 0, 0, 180],
      ["T1", 1, 0, 270],
      ["T1", 0, 1, 90],
      ["T1", 1, 1, 0],
    ],
  },
];
export const shapeComposerTemplates: readonly TemplateMetadata[] = [
  {
    id: "compose-flat-shape",
    version: 1,
    title: "Make the shape",
    skillId: "composite-shapes",
    gradeBand: "K–2",
    description:
      "Place, turn and flip flat pieces to fill an outline, then build with a shape made from smaller pieces.",
    requiredResponseCapability: "shape-composer-v1",
    glossarySenses: {
      square: "square-shape",
      squares: "square-shape",
      side: "side",
      sides: "side",
    },
  },
];
export const shapeComposerVariants = [
  "two-pieces",
  "many-pieces",
  "from-composite",
] as const;

function recipeStage(recipe: Recipe): {
  stage: ShapeStage;
  answer: ShapePlacement[];
} {
  const tray: ShapePiece[] = [],
    answer: ShapePlacement[] = [];
  for (const [id, x, y, rot] of recipe.parts) {
    let p = tray.find((p) => p.id === id);
    if (!p) {
      p = { ...shapePieces[id], copies: 0 };
      tray.push(p);
    }
    answer.push({ pieceId: id, copy: p.copies++, x, y, rot, flip: false });
  }
  const target = answer.flatMap((p) =>
    placedCells(
      tray.find((t) => t.id === p.pieceId)!,
      p,
    ),
  );
  return {
    stage: {
      prompt: "Fill the outline. You may not need every piece.",
      target,
      tray,
    },
    answer,
  };
}
/** Rotate the complete construction and move it to a seeded grid offset.
 * Individual bounding boxes transform together, preserving every seam. */
function arrange(
  stage: ShapeStage,
  answer: ShapePlacement[],
  turn: number,
  x: number,
  y: number,
) {
  const target = poseCells(stage.target, turn);
  let minX = Infinity,
    minY = Infinity;
  const raw = stage.target.map((c) => {
    let a = c.x,
      b = c.y;
    for (let i = 0; i < turn / 90; i++) [a, b] = [-b - 1, a];
    minX = Math.min(minX, a);
    minY = Math.min(minY, b);
    return [a, b];
  });
  void raw;
  const out = answer.map((p) => {
    const source = placedCells(
      stage.tray.find((t) => t.id === p.pieceId)!,
      p,
    );
    const pts = source.map((c) => {
      let a = c.x,
        b = c.y;
      for (let i = 0; i < turn / 90; i++) [a, b] = [-b - 1, a];
      return [a, b];
    });
    const piece = stage.tray.find((t) => t.id === p.pieceId)!;
    return {
      ...p,
      rot: (piece.canRotate
        ? (p.rot + turn) % 360
        : 0) as ShapePlacement["rot"],
      x: Math.min(...pts.map((v) => v[0]!)) - minX + x,
      y: Math.min(...pts.map((v) => v[1]!)) - minY + y,
    };
  });
  return { stage: { ...stage, target: translated(target, x, y) }, answer: out };
}

export function generateShapeComposer(
  _id: string,
  seed: string,
): GeneratedProblem {
  const r = random("compose-flat-shape", seed),
    variant = shapeComposerVariants[r(0, 2)]!;
  const candidates = shapeRecipes.filter((p) =>
    variant === "many-pieces" ? p.parts.length >= 3 : p.parts.length === 2,
  );
  const stagedIds = [
    "unit-square",
    "half-circle",
    "rectangle-2",
    "trapezoid-three",
    "turned-triangle",
  ];
  const stagedId =
    variant === "from-composite"
      ? stagedIds[r(0, stagedIds.length - 1)]
      : undefined;
  const recipe = stagedId
    ? shapeRecipes.find((p) => p.id === stagedId)!
    : candidates[r(0, candidates.length - 1)]!;
  const built = [recipeStage(recipe)];
  if (variant === "from-composite") {
    const composite: ShapePiece = {
      id: "joined",
      name: recipe.name,
      kind: "composite",
      cells: poseCells(built[0]!.stage.target),
      canRotate: true,
      canFlip: false,
      copies: 2,
    };
    const width = Math.max(...composite.cells.map((c) => c.x)) + 1,
      height = Math.max(...composite.cells.map((c) => c.y)) + 1;
    const curved = recipe.id === "half-circle",
      trapezoid = recipe.id === "trapezoid-three",
      triangle = recipe.id === "turned-triangle";
    const answer: ShapePlacement[] = [
      { pieceId: "joined", copy: 0, x: 0, y: 0, rot: 0, flip: false },
      {
        pieceId: "joined",
        copy: 1,
        x: recipe.id === "unit-square" ? width : 0,
        y: recipe.id === "unit-square" ? 0 : height,
        rot: curved || trapezoid || triangle ? 180 : 0,
        flip: false,
      },
    ];
    if (trapezoid) {
      answer[0]!.rot = 180;
      answer[1]!.rot = 0;
    }
    built.push({
      stage: {
        prompt: "Use the shape you made as one piece. Make the bigger shape.",
        target: answer.flatMap((p) => placedCells(composite, p)),
        tray: [composite],
        required: [{ pieceId: "joined", count: 2 }],
      },
      answer,
    });
  }
  const stages: ShapeStage[] = [],
    answers: ShapePlacement[][] = [];
  for (const [i, b] of built.entries()) {
    const turn = r(0, 3) * 90,
      target = poseCells(b.stage.target, turn),
      w = Math.max(...target.map((c) => c.x)) + 1,
      h = Math.max(...target.map((c) => c.y)) + 1;
    const positioned = arrange(
      b.stage,
      b.answer,
      turn,
      r(0, 5 - w),
      r(0, 4 - h),
    );
    // A curved piece cannot tile a straight target; a full square cannot
    // tile a target made only of quarter disks. Search tests prove inertness.
    if (variant === "many-pieces" || r(0, 1)) {
      const curved = positioned.stage.target.some((c) =>
        c.fill.startsWith("q:"),
      );
      const distractor = structuredClone(
        curved ? shapePieces.T2 : shapePieces.Q,
      );
      distractor.id = "extra";
      positioned.stage.tray.push(distractor);
    }
    positioned.stage.tray = shuffle(r, positioned.stage.tray);
    if (i === 0 && r(0, 2) === 0) {
      positioned.stage.required = b.stage.tray
        .filter((p) => p.id !== "extra")
        .map((p) => ({ pieceId: p.id, count: p.copies }));
      positioned.stage.prompt = `Use ${positioned.stage.required.map((q) => `${q.count} ${b.stage.tray.find((p) => p.id === q.pieceId)!.name}${q.count === 1 ? "" : "s"}`).join(" and ")} to fill the outline.`;
    }
    stages.push(positioned.stage);
    answers.push(positioned.answer);
  }
  const base = {
    kind: "shape-composer" as const,
    label: "Fill the outline with pieces",
    lattice: { w: 5 as const, h: 4 as const },
    stages,
  };
  const response: ShapeComposerResponse = {
    ...base,
    guessChance: shapeGuessChance(base),
  };
  const answer = normalizeShapeAnswer(response, JSON.stringify(answers))!;
  return {
    public: {
      id: createHash("sha256")
        .update(`compose-flat-shape:1:${seed}`)
        .digest("hex"),
      templateId: "compose-flat-shape",
      templateVersion: 1,
      skillId: "composite-shapes",
      seed,
      prompt: "Put pieces together to make the shape.",
      response,
    },
    answer,
    walkthrough: shapeComposerScene(response, answer),
    variant: { id: variant, axes: { recipe: recipe.id } },
    hint: `Look at the ${stages[0]!.tray.find((p) => p.id !== "extra")!.name}. Turn it to match a corner or curve of the outline.`,
    explanation: [
      "The outline shows the outside edge of the shape to make.",
      "Turn the pieces so their sides meet. Cover every part inside the outline without covering another piece.",
      `The pieces together make a ${recipe.name}.`,
      ...(variant === "from-composite"
        ? [
            "A shape made from smaller pieces is a composite shape. Use each copy as one whole piece to make the bigger shape.",
          ]
        : []),
    ],
  };
}
