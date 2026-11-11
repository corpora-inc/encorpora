import { createHash } from "node:crypto";
import { count, nounFor } from "./agreement";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { assemble, random, shuffle, type Random } from "./distribution-practice";
import {
  figureChoiceResponseSchema,
  figureOptionIds,
  figureOptionLetters,
  type FigureChoiceResponse,
} from "./figure-choice";
import {
  gradeStructuredWork,
  gradingFits,
  structuralProblem,
  type StructuredWorkResponse,
  type WorkGrading,
} from "./structured-work";
import {
  multiPartProblem,
  type Built,
  type Slot,
} from "./multi-part-support";
import { generatingVersion } from "./variation/axes";
import type { MultiPartSentence } from "./multi-part-choice";
import {
  pointPlotResponseSchema,
  serializePlot,
  type LatticePoint,
  type PointPlotResponse,
} from "./point-plot";
import { graph, scene } from "./scene/author";
import type { Element, PathOp, Point, Scene } from "./scene/spec";

/**
 * Clause items for area and perimeter whose answer format is not the host
 * template's format. Each template is one response kind.
 */

const senses = {
  glossarySenses: {
    square: "square-shape",
    squares: "square-shape",
    unit: "unit",
    units: "unit",
    side: "side",
    sides: "side",
  },
  glossaryNoLink: ["part", "parts", "whole", "row", "rows", "note", "notes"],
};
const scenes = { requiredFigureCapability: "scenes-v1" as const };
const band35 = "3–5" as const;

type Cell = readonly [number, number];
const squareOps = (x: number, y: number, s = 1): PathOp[] => [
  ["M", x, y],
  ["L", x + s, y],
  ["L", x + s, y + s],
  ["L", x, y + s],
  ["Z"],
];
const gridLines = (cols: number, rows: number): PathOp[] => {
  const lines: PathOp[] = [];
  for (let c = 0; c <= cols; c++) lines.push(["M", c, 0], ["L", c, rows]);
  for (let row = 0; row <= rows; row++) lines.push(["M", 0, row], ["L", cols, row]);
  return lines;
};
const yOf = (row: number, rows: number) => rows - 1 - row;

function shadedScene(
  cells: readonly Cell[],
  cols: number,
  rows: number,
  note: string,
  title?: string,
): Scene {
  const filled = cells.flatMap(([c, row]) => squareOps(c, yOf(row, rows)));
  return scene(
    {
      type: "path",
      id: "cells",
      d: filled,
      fill: "accent-fill",
      stroke: "grid",
      width: 1,
    } satisfies Element,
    {
      type: "path",
      id: "grid",
      d: gridLines(cols, rows),
      fill: "none",
      stroke: "grid",
      width: 1,
    } satisfies Element,
  ).build({ width: 360, maxHeight: 320, note, ...(title ? { title } : {}) });
}

/* -------------------------------------------------- count-square-units */

const UNIT = {
  cm: {
    side: "1 cm",
    length: "1 centimeter",
    area: "1 square centimeter",
    peri: "4 centimeters",
    four: "4 square centimeters",
    word: "cm",
  },
  in: {
    side: "1 in",
    length: "1 inch",
    area: "1 square inch",
    peri: "4 inches",
    four: "4 square inches",
    word: "in",
  },
  m: {
    side: "1 m",
    length: "1 meter",
    area: "1 square meter",
    peri: "4 meters",
    four: "4 square meters",
    word: "m",
  },
  ft: {
    side: "1 ft",
    length: "1 foot",
    area: "1 square foot",
    peri: "4 feet",
    four: "4 square feet",
    word: "ft",
  },
  note: {
    side: "1 note",
    length: "1 note",
    area: "1 square note",
    peri: "4 notes",
    four: "4 square notes",
    word: "note",
  },
} as const;
type UnitId = keyof typeof UNIT;

export const countSquareTemplates: readonly TemplateMetadata[] = [
  {
    id: "define-unit-square",
    version: 1,
    title: "Area of one unit square",
    skillId: "rectangle-area",
    gradeBand: band35,
    requiredResponseCapability: "single-choice-v1",
    ...scenes,
    ...senses,
    description:
      "A square with sides 1 unit long covers one square unit. Choose that area, not the side length or the perimeter.",
  },
  {
    id: "which-is-a-unit-square",
    version: 1,
    title: "Which figure is a unit square",
    skillId: "rectangle-area",
    gradeBand: band35,
    requiredResponseCapability: "figure-choice-v1",
    ...scenes,
    ...senses,
    description:
      "On a unit grid, choose the 1 by 1 square. A 1 by 2 rectangle, a 2 by 2 square, and a 1-unit segment are not unit squares.",
  },
  {
    id: "count-square-units",
    version: 1,
    title: "Count the unit squares in a region",
    skillId: "rectangle-area",
    gradeBand: band35,
    ...scenes,
    ...senses,
    description:
      "Count the unit squares that cover a non-rectangular region with no gaps or overlaps. The count is the area.",
  },
  {
    id: "gaps-overlaps",
    version: 1,
    title: "Which covering measures the area",
    skillId: "rectangle-area",
    gradeBand: band35,
    requiredResponseCapability: "figure-choice-v1",
    ...scenes,
    ...senses,
    description:
      "Choose the covering of a region with no gaps and no overlaps. A gap leaves cells bare. An overlap lays tiles on top of tiles.",
  },
];

const metaOf = (list: readonly TemplateMetadata[], id: string) =>
  list.find((t) => t.id === id)!;

function seedOk(seed: string) {
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
}
const idOf = (templateId: string, seed: string) =>
  createHash("sha256").update(JSON.stringify([templateId, 1, seed])).digest("hex");

function nonRect(r: Random): { cells: Cell[]; cols: number; rows: number } {
  for (let attempt = 0; attempt < 40; attempt++) {
    const cols = r(4, 8);
    const rows = r(3, 6);
    if (r(0, 1) === 0) {
      const nw = r(1, cols - 2);
      const nh = r(1, rows - 2);
      const cells: Cell[] = [];
      for (let row = 0; row < rows; row++)
        for (let c = 0; c < cols; c++)
          if (!(c >= cols - nw && row < nh)) cells.push([c, row]);
      if (cells.length >= 8 && cells.length <= 30) return { cells, cols, rows };
    } else {
      const stem = r(1, cols - 2);
      const left = Math.floor((cols - stem) / 2);
      const cells: Cell[] = [];
      for (let c = 0; c < cols; c++) cells.push([c, 0]);
      for (let row = 1; row < rows; row++)
        for (let c = left; c < left + stem; c++) cells.push([c, row]);
      if (cells.length >= 8 && cells.length <= 30) return { cells, cols, rows };
    }
  }
  const cells: Cell[] = [];
  for (let row = 0; row < 4; row++)
    for (let c = 0; c < 6; c++) if (!(c >= 4 && row < 2)) cells.push([c, row]);
  return { cells, cols: 6, rows: 4 };
}
const rowCounts = (cells: readonly Cell[], rows: number) =>
  Array.from({ length: rows }, (_, row) => cells.filter((c) => c[1] === row).length);

function defineUnit(r: Random): GeneratedProblem {
  const meta = metaOf(countSquareTemplates, "define-unit-square");
  const id = (["cm", "in", "m", "ft", "note"] as const)[r(0, 4)]!;
  const u = UNIT[id];
  const prompt =
    id === "note"
      ? "Each sticky note is a square 1 note on a side. How much area does one sticky note cover?"
      : `Each small square has sides ${u.side} long. How much area does one small square cover?`;
  const figure: SemanticFigure = {
    kind: "scene",
    scene: scene(
      {
        type: "path",
        id: "gold",
        d: squareOps(1, 1),
        fill: "gold-fill",
        stroke: "ink",
        width: 2,
      },
      {
        type: "path",
        id: "grid",
        d: gridLines(3, 3),
        fill: "none",
        stroke: "grid",
        width: 1,
      },
      {
        type: "text",
        id: "side",
        at: [1, 1],
        text: u.side,
        align: [-1, 1],
        size: "sm",
      },
    ).build({
      width: 280,
      maxHeight: 240,
      title: "One square is marked in gold",
      note: `The gold square has sides ${u.side}.`,
    }),
  };
  return assemble(meta, "", r, {
    prompt,
    figure,
    answer: "",
    hint:
      id === "note"
        ? "A note measures length along an edge. The sticky note covers a flat square, so the unit of area names the square."
        : `A ${u.length.replace(/^1 /, "")} measures length. The square covers a flat surface, so name the square unit, not the length around it.`,
    explanation: [
      `A square ${u.side} on each side is a unit square.`,
      `It covers ${u.area}. Squares like it measure area by counting them.`,
      `${u.length} is the side, ${u.peri} is the perimeter, and ${u.four} would be four unit squares.`,
    ],
    choices: [
      { label: u.area, correct: true },
      {
        label: u.length,
        feedback: "That is the length of one side. Area names the square the side covers.",
      },
      {
        label: u.peri,
        feedback: "That adds the four sides. The perimeter is a length, not the area inside.",
      },
      {
        label: u.four,
        feedback: "The square has four sides, but it is still one square, not four.",
      },
    ],
  });
}

function gridCard(cells: readonly Cell[], cols: number, rows: number): Scene {
  return scene(
    {
      type: "path",
      id: "shape",
      d: cells.flatMap(([c, row]) => squareOps(c, yOf(row, rows))),
      fill: "gold-fill",
      stroke: "ink",
      width: 1.5,
    },
    {
      type: "path",
      id: "grid",
      d: gridLines(cols, rows),
      fill: "none",
      stroke: "grid",
      width: 1,
    },
  ).build({ width: 220, maxHeight: 200 });
}

function whichUnit(seed: string, r: Random): GeneratedProblem {
  const meta = metaOf(countSquareTemplates, "which-is-a-unit-square");
  const cols = 3;
  const rows = 3;
  const options: FigureOption[] = [
    {
      description:
        "A square one grid unit wide and one grid unit tall, shaded on the grid.",
      scene: gridCard([[1, 1]], cols, rows),
      correct: true,
    },
    {
      description:
        "A rectangle one grid unit tall and two grid units wide, shaded on the grid.",
      scene: gridCard(
        [
          [1, 1],
          [2, 1],
        ],
        cols,
        rows,
      ),
    },
    {
      description:
        "A square two grid units wide and two grid units tall, shaded on the grid.",
      scene: gridCard(
        [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ],
        cols,
        rows,
      ),
    },
    {
      description:
        "A straight segment one grid unit long, with no square shaded.",
      scene: scene(
        {
          type: "path",
          id: "grid",
          d: gridLines(cols, rows),
          fill: "none",
          stroke: "grid",
          width: 1,
        },
        {
          type: "path",
          id: "segment",
          d: [
            ["M", 1, 1],
            ["L", 2, 1],
          ],
          fill: "none",
          stroke: "ink",
          width: 3,
        },
      ).build({ width: 220, maxHeight: 200 }),
    },
  ];
  return figureProblem(meta, seed, {
    r,
    prompt:
      "Each small square of the grid is one unit on a side. Which figure is a unit square?",
    label: "Choose the unit square",
    options,
    hint: (ordered) =>
      `Start with the first picture: ${ordered[0]!.description} A unit square has sides of length 1. A longer rectangle, a larger square, and a segment do not cover exactly one square unit.`,
    explanation: (name) => [
      "A unit square is a square whose sides are each 1 unit. Its area is 1 square unit.",
      "The 1 by 2 rectangle is two unit squares. The 2 by 2 square has area 4. The segment has length but no area.",
      `${name} is the 1 by 1 square.`,
    ],
    feedback: [
      "That rectangle is two unit squares side by side.",
      "That square is 2 units on a side, so its area is 4 square units.",
      "A segment has length and no area. A unit square covers a flat square.",
    ],
  });
}

function countCover(seed: string, r: Random): GeneratedProblem {
  const meta = metaOf(countSquareTemplates, "count-square-units");
  const region = nonRect(r);
  const counts = rowCounts(region.cells, region.rows);
  const feet = r(0, 3) === 0;
  const n = region.cells.length;
  const unit = feet ? "square feet" : "square units";
  const problem = assemble(meta, seed, r, {
    prompt: `The figure is covered by unit squares with no gaps or overlaps. What is its area, in ${unit}?`,
    answer: String(n),
    hint: `The grid is ${region.cols} across and ${region.rows} down, and the top row has ${counts[0]} shaded squares. Count each row and keep a running total. Skip the empty squares.`,
    explanation: [
      `The shaded counts by row, from the top, are ${counts.join(", ")}.`,
      `The running total is ${counts.join(" + ")} = ${n}.`,
      `There are no gaps and no overlaps, so the area is ${n} ${unit}. The word square is there because each piece is a square.`,
    ],
    figure: {
      kind: "scene",
      scene: shadedScene(
        region.cells,
        region.cols,
        region.rows,
        `Grid ${region.cols} by ${region.rows}. Shaded squares in each row, from the top: ${counts.join(", ")}.${feet ? " Each square is 1 foot on a side." : ""}`,
        feet ? "Region on a 1-foot grid" : "Region on a unit grid",
      ),
    },
  });
  return problem;
}

function tileElements(
  cells: readonly Cell[],
  cols: number,
  rows: number,
  skip: ReadonlySet<string>,
  extra: number,
): Element[] {
  const tiles: Element[] = [];
  let i = 0;
  for (const [c, row] of cells) {
    if (skip.has(`${c},${row}`)) continue;
    tiles.push({
      type: "path",
      id: `tile${i++}`,
      d: squareOps(c, yOf(row, rows)),
      fill: "accent-fill",
      stroke: "ink",
      width: 1,
    });
  }
  for (let k = 0; k < extra; k++) {
    const [c, row] = cells[k]!;
    tiles.push({
      type: "path",
      id: `tile${i++}`,
      d: squareOps(c + 0.35, yOf(row, rows) + 0.35),
      fill: "gold-fill",
      stroke: "gold",
      width: 1,
    });
  }
  return tiles;
}
function coverScene(
  cells: readonly Cell[],
  cols: number,
  rows: number,
  skip: ReadonlySet<string>,
  extra: number,
): Scene {
  return scene(
    ...tileElements(cells, cols, rows, skip, extra),
    {
      type: "path",
      id: "grid",
      d: gridLines(cols, rows),
      fill: "none",
      stroke: "grid",
      width: 1,
    },
    {
      type: "path",
      id: "outline",
      d: cells.flatMap(([c, row]) => squareOps(c, yOf(row, rows))),
      fill: "none",
      stroke: "ink",
      width: 2,
    },
  ).build({ width: 240, maxHeight: 220 });
}

function gapsOverlaps(seed: string, r: Random): GeneratedProblem {
  const meta = metaOf(countSquareTemplates, "gaps-overlaps");
  const region = nonRect(r);
  const n = region.cells.length;
  const skip = new Set(
    region.cells.slice(0, 2).map(([c, row]) => `${c},${row}`),
  );
  const exact = coverScene(region.cells, region.cols, region.rows, new Set(), 0);
  const gaps = coverScene(region.cells, region.cols, region.rows, skip, 0);
  const overlaps = coverScene(region.cells, region.cols, region.rows, new Set(), 2);
  return figureProblem(meta, seed, {
    r,
    prompt: "Which covering shows the figure's area?",
    label: "Choose the covering",
    options: [
      {
        description: `Every cell of the outline has one tile, and no tile lies on another tile. There are ${n} tiles.`,
        scene: exact,
        correct: true,
      },
      {
        description: `Two cells inside the outline have no tile. There are ${n - 2} tiles.`,
        scene: gaps,
      },
      {
        description: `Two extra tiles lie across other tiles. There are ${n + 2} tiles.`,
        scene: overlaps,
      },
    ],
    hint: `This outline is ${region.cols} squares across and ${region.rows} down. A gap leaves part uncovered, so the count is too small. An overlap counts some of the figure twice, so the count is too large.`,
    explanation: (name) => [
      `The outline has ${n} unit cells.`,
      `The covering with ${n - 2} tiles leaves two cells bare, so its count is too small. The covering with ${n + 2} tiles lays two tiles on top of others, so its count is too large.`,
      `${name} covers each cell once. The area is ${n} square units.`,
    ],
    feedback: [
      "Those two empty cells are part of the figure. A gap makes the count too small.",
      "Two tiles lie on top of other tiles. An overlap counts the same area twice.",
    ],
  });
}

type FigureOption = {
  description: string;
  scene: Scene;
  correct?: true;
};
function figureProblem(
  meta: TemplateMetadata,
  seed: string,
  parts: {
    prompt: string;
    label: string;
    options: FigureOption[];
    hint: string | ((ordered: FigureOption[]) => string);
    explanation: (name: string) => string[];
    feedback: string[];
    r?: Random;
  },
): GeneratedProblem {
  const r = parts.r ?? random(meta.id, seed || "figure");
  const order = shuffle(r, parts.options.map((_, i) => i));
  const response: FigureChoiceResponse = {
    kind: "figure-choice",
    label: parts.label,
    noun: "Picture",
    options: order.map((source, i) => ({
      id: figureOptionIds[i]!,
      label: parts.options[source]!.description,
      scene: parts.options[source]!.scene,
    })),
  };
  figureChoiceResponseSchema.parse(response);
  const orderedOptions = order.map((source) => parts.options[source]!);
  const correctAt = order.findIndex((source) => parts.options[source]!.correct);
  const answer = figureOptionIds[correctAt]!;
  const name = `Picture ${figureOptionLetters[correctAt]}`;
  const feedback: Record<string, string> = {};
  let wrong = 0;
  order.forEach((source, i) => {
    if (parts.options[source]!.correct) return;
    feedback[figureOptionIds[i]!] = parts.feedback[wrong++]!;
  });
  return {
    public: {
      id: idOf(meta.id, seed),
      templateId: meta.id,
      templateVersion: 1,
      seed,
      prompt: parts.prompt,
      skillId: meta.skillId,
      response,
    },
    answer,
    hint:
      typeof parts.hint === "function" ? parts.hint(orderedOptions) : parts.hint,
    explanation: parts.explanation(name),
    choiceFeedback: feedback,
  };
}

export function generateCountSquare(templateId: string, seed: string) {
  seedOk(seed);
  const r = random(templateId, seed);
  if (templateId === "define-unit-square") {
    const problem = defineUnit(r);
    problem.public.seed = seed;
    problem.public.id = idOf(templateId, seed);
    return problem;
  }
  if (templateId === "which-is-a-unit-square") return whichUnit(seed, r);
  if (templateId === "count-square-units") return countCover(seed, r);
  if (templateId === "gaps-overlaps") return gapsOverlaps(seed, r);
  throw new Error(`Unknown count-square template ${templateId}`);
}

/* ----------------------------------------------- area-tiling new kinds */

export const areaTilingClauseTemplates: readonly TemplateMetadata[] = [
  {
    id: "tile-then-multiply",
    version: 2,
    reprintsFrom: 1,
    title: "Count the tiles, then multiply",
    skillId: "rectangle-area",
    gradeBand: band35,
    requiredResponseCapability: "multi-part-choice-v1",
    ...scenes,
    ...senses,
    description:
      "A rectangle has some rows tiled and the rest blank. Fill the squares in one row, the number of rows, the covering count, and the product of the sides.",
  },
  {
    id: "split-tiled-count",
    version: 2,
    reprintsFrom: 1,
    title: "Count both sides of a split rectangle",
    skillId: "rectangle-area",
    gradeBand: band35,
    requiredResponseCapability: "multi-part-choice-v1",
    ...scenes,
    ...senses,
    description:
      "A tiled rectangle is split into widths $b$ and $c$. Count each part, the total, and the product $a \\times (b + c)$.",
  },
  {
    id: "choose-the-split",
    version: 1,
    title: "Which split matches the sum",
    skillId: "rectangle-area",
    gradeBand: band35,
    requiredResponseCapability: "figure-choice-v1",
    ...scenes,
    ...senses,
    description:
      "Choose the column split of a tiled rectangle that shows a × (b + c) = a × b + a × c. A row split and a different column split do not.",
  },
  {
    id: "your-own-cut",
    version: 1,
    title: "Cut an L into two rectangles",
    skillId: "rectangle-area",
    gradeBand: band35,
    requiredResponseCapability: "structured-work-v1",
    ...senses,
    description:
      "An L-shaped figure is drawn with every side labeled and no seam. Enter the areas of two rectangles that make it, in either order, then the total.",
  },
  {
    id: "which-cut",
    version: 1,
    title: "Which cut makes two rectangles",
    skillId: "rectangle-area",
    gradeBand: band35,
    requiredResponseCapability: "figure-choice-v1",
    ...scenes,
    ...senses,
    description:
      "Choose the cut of an L that makes two rectangles sharing no area. A diagonal, a line that misses the inner corner, and two overlapping rectangles do not.",
  },
];

function cardFigure(rows: number, cols: number, splitCol: number | undefined, note: string): SemanticFigure {
  return {
    kind: "scene",
    scene: scene({
      type: "array",
      id: "tiles",
      rows,
      columns: cols,
      ...(splitCol ? { splitAfterColumn: splitCol } : {}),
    }).build({ width: 360, maxHeight: 280, note }),
  };
}

function tray(values: number[], extra: number[]): string[] {
  const labels: string[] = [];
  for (const n of [...values, ...extra]) {
    const label = String(n);
    if (!labels.includes(label)) labels.push(label);
    if (labels.length === 6) break;
  }
  if (labels.length < 2) throw new Error("retry");
  return labels;
}

/** Sorted trays have new option IDs; stored version 1 keeps its original key. */
function tilingCardProblem(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
  built: Built,
): GeneratedProblem {
  const version = generatingVersion() ?? meta.version;
  const problem = multiPartProblem(
    { ...meta, version, reprintsFrom: version },
    seed,
    r,
    version === 1
      ? built
      : {
          ...built,
          slots: built.slots.map((slot) => ({
            ...slot,
            fixed: [...slot.fixed!].sort((a, b) => Number(a) - Number(b)),
          })),
        },
  );
  return {
    ...problem,
    public: { ...problem.public, templateVersion: version },
  };
}

/** Numeric trays are ordered without changing the ids in saved answers. */
function orderedCards(problem: GeneratedProblem): GeneratedProblem {
  if (problem.public.response.kind !== "multi-part-choice")
    throw new Error("Expected a card response");
  for (const blank of problem.public.response.blanks)
    blank.options.sort((a, b) => Number(a.label) - Number(b.label));
  return problem;
}

export function tileCards(a: number, b: number, k: number) {
  const ab = a * b;
  const fixed = tray([b, a, ab], [k * b, a + b, 2 * (a + b), k * a]);
  const slots: Slot[] = [
    { id: "onerow", label: "Unit squares in one row", correct: String(b), fixed },
    { id: "allrow", label: "Rows when the rectangle is full", correct: String(a), fixed },
    { id: "cover", label: "Unit squares that cover it", correct: String(ab), fixed },
    { id: "prod", label: "a times b", correct: String(ab), fixed },
  ];
  const sentence: MultiPartSentence = [
    { text: "Unit squares in one row: " },
    { blank: "onerow" },
    { text: "\nRows when the rectangle is full: " },
    { blank: "allrow" },
    { text: "\nUnit squares that cover it: " },
    { blank: "cover" },
    { text: "\na × b = " },
    { blank: "prod" },
  ];
  return { slots, sentence, ab };
}

function tileThen(seed: string, r: Random): GeneratedProblem {
  const meta = metaOf(areaTilingClauseTemplates, "tile-then-multiply");
  for (let attempt = 0; attempt < 40; attempt++) {
    const a = r(3, 9);
    let b = r(3, 10);
    if (b === a) b = b === 10 ? 3 : b + 1;
    if (a === b) continue;
    const k = r(1, a - 1);
    try {
      const built = tileCards(a, b, k);
      return orderedCards(tilingCardProblem(meta, seed, r, {
        prompt: `The rectangle has ${a} rows and ${b} unit squares in each row. ${k} ${k === 1 ? "row is" : "rows are"} tiled and the rest are blank. Fill the cards for the whole rectangle.`,
        layout: "cards",
        reuse: true,
        label: "Put a card in each box",
        slots: built.slots,
        sentence: built.sentence,
        figure: cardFigure(a, b, undefined, `Tiled rows: ${k} of ${a}. Squares in a row: ${b}.`),
        hint: `One full row holds the same number of squares whether or not it is drawn. Use all ${a} rows, not only the tiled ones.`,
        explanation: [
          `Each row holds ${b} unit squares.`,
          `There are ${a} rows, so the running totals are ${Array.from({ length: a }, (_, i) => (i + 1) * b).join(", ")}.`,
          `That is ${a} × ${b} = ${built.ab}. The covering and the product are the same number.`,
        ],
      }));
    } catch (error) {
      if (error instanceof Error && error.message === "retry") continue;
      throw error;
    }
  }
  throw new Error("Could not build tile-then-multiply");
}

export function splitCards(a: number, b: number, c: number) {
  const left = a * b;
  const right = a * c;
  const total = left + right;
  const fixed = tray([left, right, total], [a + b + c, b * c, a * b * c, b + c]);
  const slots: Slot[] = [
    { id: "left", label: "Squares in the left part", correct: String(left), fixed },
    { id: "right", label: "Squares in the right part", correct: String(right), fixed },
    { id: "total", label: "Total squares", correct: String(total), fixed },
    { id: "prod", label: "a times (b + c)", correct: String(total), fixed },
  ];
  const sentence: MultiPartSentence = [
    { text: "Squares in the left part: " },
    { blank: "left" },
    { text: "\nSquares in the right part: " },
    { blank: "right" },
    { text: "\nTotal: " },
    { blank: "total" },
    { text: "\na × (b + c) = " },
    { blank: "prod" },
  ];
  return { slots, sentence, left, right, total };
}

function splitTiled(seed: string, r: Random): GeneratedProblem {
  const meta = metaOf(areaTilingClauseTemplates, "split-tiled-count");
  for (let attempt = 0; attempt < 40; attempt++) {
    const a = r(3, 9);
    const b = r(2, 8);
    let c = r(2, 8);
    if (c === b) c = c === 8 ? 2 : c + 1;
    if (b === c || b + c > 12) continue;
    const built = splitCards(a, b, c);
    return orderedCards(tilingCardProblem(meta, seed, r, {
      prompt: `The rectangle is ${a} units tall and ${b + c} units wide. A line splits the width into ${b} and ${c}. Count the unit squares.`,
      layout: "cards",
      reuse: true,
      label: "Put a card in each box",
      slots: built.slots,
      sentence: built.sentence,
      figure: cardFigure(
        a,
        b + c,
        b,
        `Split after ${b} of ${b + c} columns. Rows: ${a}.`,
      ),
      hint: `The left part is ${a} rows of ${b}. The right part is ${a} rows of ${c}. Add those two counts.`,
      explanation: [
        `Left: ${a} × ${b} = ${built.left}. Right: ${a} × ${c} = ${built.right}.`,
        `Total: ${built.left} + ${built.right} = ${built.total}.`,
        `The same squares are ${a} × (${b} + ${c}) = ${a} × ${b + c} = ${built.total}. So a × (b + c) = a × b + a × c.`,
      ],
    }));
  }
  throw new Error("Could not build split-tiled-count");
}

function splitCard(rows: number, cols: number, split: { row?: number; col?: number }, text: string): Scene {
  return scene({
    type: "array",
    id: "tiles",
    rows,
    columns: cols,
    ...(split.row ? { splitAfterRow: split.row } : {}),
    ...(split.col ? { splitAfterColumn: split.col } : {}),
  }).build({ width: 240, maxHeight: 200 });
}

function chooseSplit(seed: string, r: Random): GeneratedProblem {
  const meta = metaOf(areaTilingClauseTemplates, "choose-the-split");
  for (let attempt = 0; attempt < 40; attempt++) {
    const a = r(3, 9);
    const b = r(2, 8);
    let c = r(2, 8);
    if (c === b) c = c === 8 ? 2 : c + 1;
    if (b === c || b + c > 12) continue;
    const cols = b + c;
    const rowK = b < a ? b : 1;
    if (rowK < 1 || rowK >= a) continue;
    let other = cols % 2 === 0 ? cols / 2 : 1;
    if (other === b || other === c) other = 1;
    while ((other === b || other === c) && other < cols - 1) other++;
    if (other === b || other === c || other >= cols || other < 1) continue;
    const options: FigureOption[] = [
      {
        description: `The tiled rectangle with a heavy line after ${count(b, "column")}.`,
        scene: splitCard(a, cols, { col: b }, ""),
        correct: true,
      },
      {
        description: `The tiled rectangle with a heavy line after ${count(rowK, "row")}.`,
        scene: splitCard(a, cols, { row: rowK }, ""),
      },
      {
        description: `The tiled rectangle with a heavy line after ${count(other, "column")}.`,
        scene: splitCard(a, cols, { col: other }, ""),
      },
    ];
    if (new Set(options.map((o) => JSON.stringify(o.scene.elements))).size < 3)
      continue;
    return figureProblem(meta, seed, {
      prompt: `Which split of the tiled ${a} × ${cols} rectangle shows ${a} × ${cols} = ${a} × ${b} + ${a} × ${c}?`,
      label: "Choose the split",
      options,
      r,
      hint: `The ${b} in ${a} × ${b} is a number of columns, not a number of rows. The other part is the remaining ${c} columns.`,
      explanation: (name) => [
        `${a} × ${b} is ${count(a, "row")} of ${count(b, "column")}, and ${a} × ${c} is ${count(a, "row")} of ${count(c, "column")}.`,
        `Together that is a line after ${count(b, "column")}. A line after ${count(c, "column")} is the same split read from the other end, so it is not offered.`,
        `A line after ${count(rowK, "row")} splits the side of length ${a}, which gives a different sum. ${name} is the column split after ${b}.`,
      ],
      feedback: [
        `That line splits the ${a} rows. ${rowK} × ${cols} + ${a - rowK} × ${cols} is not ${a} × ${b} + ${a} × ${c}.`,
        `That line is after ${count(other, "column")}, so the parts are ${a} × ${other} and ${a} × ${cols - other}, not ${a} × ${b} and ${a} × ${c}.`,
      ],
    });
  }
  throw new Error("Could not build choose-the-split");
}

/** Piece areas of an L with outer width W, outer height H, and inner corner (w1, h1). */
export function lCutPieces(W: number, H: number, w1: number, h1: number) {
  const horizontal: [number, number] = [W * h1, w1 * (H - h1)];
  const vertical: [number, number] = [w1 * H, (W - w1) * h1];
  return {
    horizontal,
    vertical,
    total: horizontal[0] + horizontal[1],
    box: W * H,
  };
}

function lFigure(W: number, H: number, w1: number, h1: number, unit: "cm" | "m" | "in" | "ft"): SemanticFigure {
  return {
    kind: "measured-polygon",
    unit,
    vertices: [
      [0, 0],
      [W, 0],
      [W, h1],
      [w1, h1],
      [w1, H],
      [0, H],
    ],
    sides: [W, h1, W - w1, H - h1, w1, H],
    heights: [],
    guides: [],
    rightAngles: [0, 1, 4, 5],
  };
}

function workProblem(
  meta: TemplateMetadata,
  seed: string,
  parts: {
    prompt: string;
    figure?: SemanticFigure;
    rows: { id: string; label: string; unit: string }[];
    grading: WorkGrading;
    answer: string;
    hint: string;
    explanation: string[];
  },
): GeneratedProblem {
  const response: StructuredWorkResponse = {
    kind: "structured-work",
    label: "Enter each number",
    layout: "steps",
    mode: "build",
    banks: [],
    rows: parts.rows.map((row) => ({
      id: row.id,
      label: row.label,
      fields: [{ kind: "number", label: row.label, unit: row.unit }],
    })),
  };
  const problem = structuralProblem(response);
  if (problem) throw new Error(problem);
  if (!gradingFits(response, parts.grading)) throw new Error("Rule does not fit");
  if (!gradeStructuredWork(response, parts.grading, parts.answer))
    throw new Error("Answer key is not credited");
  return {
    public: {
      id: idOf(meta.id, seed),
      templateId: meta.id,
      templateVersion: 1,
      seed,
      prompt: parts.prompt,
      skillId: meta.skillId,
      response,
      ...(parts.figure ? { figure: parts.figure } : {}),
    },
    answer: parts.answer,
    hint: parts.hint,
    explanation: parts.explanation,
    workGrading: parts.grading,
  };
}

function ownCut(seed: string, r: Random): GeneratedProblem {
  const meta = metaOf(areaTilingClauseTemplates, "your-own-cut");
  let W = 10, H = 8, w1 = 6, h1 = 5;
  for (let attempt = 0; attempt < 40; attempt++) {
    W = r(6, 12);
    H = r(6, 12);
    const nw = r(3, Math.max(3, W - 3));
    const nh = r(3, Math.max(3, H - 3));
    if (nw > W - 3 || nh > H - 3) continue;
    w1 = W - nw;
    h1 = H - nh;
    const sides = [W, h1, nw, nh, w1, H];
    if (sides.some((s) => s < 3 || s > 12)) continue;
    const pieces = lCutPieces(W, H, w1, h1);
    const key = (p: [number, number]) => [...p].sort((a, c) => a - c).join(",");
    if (key(pieces.horizontal) === key(pieces.vertical)) continue;
    const unit = (["cm", "m", "in", "ft"] as const)[r(0, 3)]!;
    const [p1, p2] = pieces.horizontal;
    return workProblem(meta, seed, {
      prompt: `All corners are right angles. No seam is drawn. Cut the figure into two rectangles any way you like. Enter the area of each piece, then the total. Lengths are in ${unit === "cm" ? "centimeters" : unit === "m" ? "meters" : unit === "in" ? "inches" : "feet"}.`,
      figure: lFigure(W, H, w1, h1, unit),
      rows: [
        { id: "r1", label: "Area of one rectangle", unit: "square units" },
        { id: "r2", label: "Area of the other rectangle", unit: "square units" },
        { id: "r3", label: "Total area", unit: "square units" },
      ],
      grading: {
        mode: "rectangle-work",
        task: "l-cut",
        target: pieces.total,
        given: [W, H],
        pairs: [pieces.horizontal, pieces.vertical],
        box: pieces.box,
      },
      answer: JSON.stringify([[String(p1)], [String(p2)], [String(pieces.total)]]),
      hint: `The outer sides are ${W} and ${H}, and the step-in uses ${w1} and ${h1}. One cut goes across from the inner corner to a side. The two pieces must be rectangles, and the total is their sum, not the box around the L.`,
      explanation: [
        `A horizontal cut gives ${W} × ${h1} = ${pieces.horizontal[0]} and ${w1} × ${H - h1} = ${pieces.horizontal[1]}.`,
        `A vertical cut gives ${w1} × ${H} = ${pieces.vertical[0]} and ${W - w1} × ${h1} = ${pieces.vertical[1]}.`,
        `Either pair totals ${pieces.total}. The box ${W} × ${H} = ${pieces.box} includes the missing corner.`,
      ],
    });
  }
  throw new Error("Could not build your-own-cut");
}

const LPTS: [number, number][] = [
  [0, 0],
  [5, 0],
  [5, 2],
  [3, 2],
  [3, 4],
  [0, 4],
];
function cutScene(extra: Element[]): Scene {
  return scene(
    {
      type: "polygon",
      id: "ell",
      points: LPTS,
      fill: "accent-fill",
      stroke: "ink",
      width: 2,
    },
    ...extra,
  ).build({ width: 220, maxHeight: 200 });
}

function whichCut(seed: string, r: Random): GeneratedProblem {
  const meta = metaOf(areaTilingClauseTemplates, "which-cut");
  const seg = (id: string, from: [number, number], to: [number, number]): Element => ({
    type: "segment",
    id,
    from,
    to,
    stroke: "gold",
    width: 2.5,
  });
  return figureProblem(meta, seed, {
    prompt:
      "Which cut splits the L into two rectangles that do not overlap?",
    label: "Choose the cut",
    r,
    options: [
      {
        description:
          "One straight cut from the inner corner across to the opposite side.",
        scene: cutScene([seg("cut", [3, 2], [0, 2])]),
        correct: true,
      },
      {
        description:
          "A slanted cut from a bottom corner to an upper vertex, so the pieces are not rectangles.",
        scene: cutScene([seg("cut", [0, 0], [3, 4])]),
      },
      {
        description:
          "A vertical cut that misses the inner corner, leaving a rectangle and a smaller L-shaped figure.",
        scene: cutScene([seg("cut", [1, 0], [1, 4])]),
      },
      {
        description:
          "Two rectangle outlines that both cover the inner corner, so that corner is counted twice.",
        scene: cutScene([
          {
            type: "polygon",
            id: "wide",
            points: [
              [0, 0],
              [5, 0],
              [5, 2],
              [0, 2],
            ],
            fill: "none",
            stroke: "gold",
            width: 2,
          },
          {
            type: "polygon",
            id: "tall",
            points: [
              [0, 0],
              [3, 0],
              [3, 4],
              [0, 4],
            ],
            fill: "none",
            stroke: "warm",
            width: 2,
          },
        ]),
      },
    ],
    hint: (ordered) =>
      `Start with the first picture: ${ordered[0]!.description} A rectangle cut meets the inner corner and runs straight to a side. A slanted line, a line that misses the corner, and two outlines that share the corner do not.`,
    explanation: (name) => [
      "The inner corner is where the outline steps in. A straight cut from that corner to the opposite side makes two rectangles.",
      "A diagonal makes pieces that are not rectangles. A vertical line that misses the corner leaves a smaller L-shaped figure. Two outlines that both cover the corner count that corner twice.",
      `${name} is the straight cut from the inner corner.`,
    ],
    feedback: [
      "The pieces on either side of a slanted cut are not rectangles.",
      "That line misses the inner corner, so one piece is still an L-shaped figure.",
      "Those two rectangles both cover the inner corner, so that area would be counted twice.",
    ],
  });
}

export function generateAreaTilingClause(templateId: string, seed: string) {
  seedOk(seed);
  const r = random(templateId, seed);
  if (templateId === "tile-then-multiply") return tileThen(seed, r);
  if (templateId === "split-tiled-count") return splitTiled(seed, r);
  if (templateId === "choose-the-split") return chooseSplit(seed, r);
  if (templateId === "your-own-cut") return ownCut(seed, r);
  if (templateId === "which-cut") return whichCut(seed, r);
  throw new Error(`Unknown area-tiling clause template ${templateId}`);
}

/* ---------------------------------------------------- exhibit rectangles */

export const areaExhibitTemplates: readonly TemplateMetadata[] = [
  {
    id: "exhibit-same-perimeter",
    version: 1,
    title: "A different rectangle with the same perimeter",
    skillId: "area-perimeter-models",
    gradeBand: band35,
    requiredResponseCapability: "structured-work-v1",
    ...senses,
    description:
      "Give a different whole-number rectangle with the same perimeter as the one shown, and give its area.",
  },
  {
    id: "exhibit-same-area",
    version: 1,
    title: "A different rectangle with the same area",
    skillId: "area-perimeter-models",
    gradeBand: band35,
    requiredResponseCapability: "structured-work-v1",
    ...senses,
    description:
      "Give a different whole-number rectangle with the same area as the one shown, and give its perimeter.",
  },
];

const AREA_POOL = [12, 16, 18, 20, 24, 30, 36, 40, 48] as const;
function pairsOf(area: number): [number, number][] {
  const pairs: [number, number][] = [];
  for (let w = 1; w * w <= area; w++)
    if (area % w === 0) pairs.push([w, area / w]);
  return pairs;
}

function exhibitPerimeter(seed: string, r: Random): GeneratedProblem {
  const meta = metaOf(areaExhibitTemplates, "exhibit-same-perimeter");
  const half = r(6, 14);
  const unequal = Array.from({ length: half - 1 }, (_, i) => {
    const length = i + 1;
    const width = half - length;
    return [Math.min(length, width), Math.max(length, width)] as [number, number];
  }).filter((p, i, all) => p[0] !== p[1] && all.findIndex((q) => q[0] === p[0] && q[1] === p[1]) === i);
  const given = unequal[r(0, unequal.length - 1)]!;
  const others = unequal.filter((p) => p[0] !== given[0] || p[1] !== given[1]);
  const [length, width] = others[r(0, others.length - 1)]!;
  const squares = unequal.filter((p) => p[0] === p[1]);
  const useSquare = squares.length > 0 && r(0, 4) === 0;
  const pick = useSquare ? squares[0]! : [length, width];
  const area = pick[0] * pick[1];
  return workProblem(meta, seed, {
    prompt: `This rectangle is ${given[0]} cm by ${given[1]} cm. Give the length and width of a different rectangle with the same perimeter, and its area.`,
    rows: [
      { id: "r1", label: "Length", unit: "cm" },
      { id: "r2", label: "Width", unit: "cm" },
      { id: "r3", label: "Area", unit: "square cm" },
    ],
    grading: {
      mode: "rectangle-work",
      task: "same-perimeter",
      target: half,
      given,
    },
    answer: JSON.stringify([[String(pick[0])], [String(pick[1])], [String(area)]]),
    hint: `Half the trip around is ${given[0]} + ${given[1]}. A different pair of whole numbers with that same sum is a different rectangle. The area is the product, not the sum.`,
    explanation: [
      `The perimeter is 2 × (${given[0]} + ${given[1]}) = ${2 * half} cm, so one of each side sums to ${half}.`,
      `${half} = ${given[0]} + ${given[1]} = ${pick[0]} + ${pick[1]}. ${pick[0]} by ${pick[1]} is not ${given[0]} by ${given[1]} turned.`,
      `Its area is ${pick[0]} × ${pick[1]} = ${area}. Same trip around, different amount inside.`,
    ],
  });
}

function exhibitArea(seed: string, r: Random): GeneratedProblem {
  const meta = metaOf(areaExhibitTemplates, "exhibit-same-area");
  const area = AREA_POOL[r(0, AREA_POOL.length - 1)]!;
  const pairs = pairsOf(area).filter((p) => p[0] !== p[1]);
  const given = pairs[r(0, pairs.length - 1)]!;
  const others = pairsOf(area).filter((p) => p[0] !== given[0]);
  const pick = others[r(0, others.length - 1)]!;
  const perimeter = 2 * (pick[0] + pick[1]);
  return workProblem(meta, seed, {
    prompt: `This rectangle is ${given[0]} by ${given[1]}. Give a different rectangle with the same area, and its perimeter.`,
    rows: [
      { id: "r1", label: "Length", unit: "units" },
      { id: "r2", label: "Width", unit: "units" },
      { id: "r3", label: "Perimeter", unit: "units" },
    ],
    grading: {
      mode: "rectangle-work",
      task: "same-area",
      target: area,
      given,
    },
    answer: JSON.stringify([
      [String(pick[0])],
      [String(pick[1])],
      [String(perimeter)],
    ]),
    hint: `This rectangle is ${given[0]} by ${given[1]}. Their product is the area. Find a different factor pair of that product. The perimeter is twice the sum of the sides, not the area.`,
    explanation: [
      `${given[0]} × ${given[1]} = ${area}. Another factor pair is ${pick[0]} × ${pick[1]} = ${area}.`,
      `That is not ${given[0]} by ${given[1]} turned.`,
      `The perimeter is 2 × (${pick[0]} + ${pick[1]}) = ${perimeter}. Same area, different trip around.`,
    ],
  });
}

export function generateAreaExhibit(templateId: string, seed: string) {
  seedOk(seed);
  const r = random(templateId, seed);
  if (templateId === "exhibit-same-perimeter") return exhibitPerimeter(seed, r);
  if (templateId === "exhibit-same-area") return exhibitArea(seed, r);
  throw new Error(`Unknown exhibit template ${templateId}`);
}

/* ------------------------------------------------- coordinate point plots */

const GRID = {
  xMin: -8,
  xMax: 8,
  yMin: -8,
  yMax: 8,
  step: 1,
  xLabel: "x",
  yLabel: "y",
} as const;
const signed = (n: number) => (n < 0 ? `−${-n}` : String(n));
const pairText = (p: LatticePoint) => `(${signed(p[0])}, ${signed(p[1])})`;

export const coordinatePlotTemplates: readonly TemplateMetadata[] = [
  {
    id: "plot-the-polygon",
    version: 1,
    title: "Plot a rectangle from its vertices",
    skillId: "coordinate-polygons",
    gradeBand: "6–8",
    requiredResponseCapability: "point-plot-v1",
    description:
      "Plot the four vertices of an axis-aligned rectangle given by their coordinates. Any order is accepted.",
  },
  {
    id: "missing-vertex",
    version: 1,
    title: "Plot the missing vertex of a rectangle",
    skillId: "coordinate-polygons",
    gradeBand: "6–8",
    requiredResponseCapability: "point-plot-v1",
    description:
      "Three vertices of an axis-aligned rectangle are given. Plot the fourth.",
  },
];

function plotProblem(
  meta: TemplateMetadata,
  seed: string,
  parts: {
    prompt: string;
    response: PointPlotResponse;
    points: LatticePoint[];
    hint: string;
    explanation: string[];
  },
): GeneratedProblem {
  pointPlotResponseSchema.parse(parts.response);
  return {
    public: {
      id: idOf(meta.id, seed),
      templateId: meta.id,
      templateVersion: 1,
      seed,
      prompt: parts.prompt,
      skillId: meta.skillId,
      response: parts.response,
    },
    answer: serializePlot(parts.points, parts.response.ordered),
    hint: parts.hint,
    explanation: parts.explanation,
    pointGrading: { mode: "exact" },
  };
}

function rectangleOf(r: Random) {
  const w = r(2, 10);
  const h = r(2, 10);
  const x = r(-8, 8 - w);
  const y = r(-8, 8 - h);
  const A: LatticePoint = [x, y + h];
  const B: LatticePoint = [x + w, y + h];
  const C: LatticePoint = [x + w, y];
  const D: LatticePoint = [x, y];
  return { A, B, C, D, w, h };
}

export function generateCoordinatePlot(templateId: string, seed: string) {
  seedOk(seed);
  const r = random(templateId, seed);
  const rect = rectangleOf(r);
  if (templateId === "plot-the-polygon") {
    const meta = metaOf(coordinatePlotTemplates, templateId);
    const names = ["A", "B", "C", "D"] as const;
    const pts = [rect.A, rect.B, rect.C, rect.D];
    return plotProblem(meta, seed, {
      prompt: `Plot the vertices of rectangle $ABCD$: ${names.map((name, i) => `$${name}${pairText(pts[i]!)}$`).join(", ")}.`,
      response: {
        kind: "point-plot",
        label: "Plot the four vertices",
        grid: GRID,
        pointCount: 4,
        ordered: false,
        connect: "none",
      },
      points: pts,
      hint: `The vertices are ${names.map((name, i) => `$${name}${pairText(pts[i]!)}`).join(", ")}. The first number in each pair is the $x$-coordinate, right if positive and left if negative. Plot each vertex. The order does not matter.`,
      explanation: [
        `Rectangle $ABCD$ is ${rect.w} units wide and ${rect.h} units tall.`,
        ...pts.map((p, i) => `$${names[i]}${pairText(p)}$ sits ${p[0]} across and ${p[1]} up from the origin.`),
        "All four vertices, in any order, are the rectangle.",
      ],
    });
  }
  if (templateId === "missing-vertex") {
    const meta = metaOf(coordinatePlotTemplates, templateId);
    const named = [
      ["A", rect.A],
      ["B", rect.B],
      ["C", rect.C],
      ["D", rect.D],
    ] as const;
    const missingAt = r(0, 3);
    const missing = named[missingAt]!;
    const known = named.filter((_, i) => i !== missingAt);
    const swapped: LatticePoint = [missing[1][1], missing[1][0]];
    return plotProblem(meta, seed, {
      prompt: `Three vertices of rectangle $ABCD$ are ${known.map(([name, p]) => `$${name}${pairText(p)}$`).join(", ")}. Plot the missing vertex $${missing[0]}$.`,
      response: {
        kind: "point-plot",
        label: "Plot the missing vertex",
        grid: GRID,
        pointCount: 1,
        ordered: false,
        connect: "none",
        given: {
          vertices: known.map(([name, p]) => ({ x: p[0], y: p[1], label: name })),
          closed: false,
        },
      },
      points: [missing[1]],
      hint: `$${missing[0]}$ shares one coordinate with the vertex beside it and the other with the vertex above or below it. Swapping them, as in ${pairText(swapped)}, is not on the rectangle.`,
      explanation: [
        `The given vertices fix the horizontal sides and the vertical sides.`,
        `$${missing[0]}$ is ${pairText(missing[1])}: it lines up with its neighbors, one coordinate from each.`,
        `${pairText(swapped)} swaps those coordinates, so it is not the missing corner.`,
      ],
    });
  }
  throw new Error(`Unknown coordinate plot template ${templateId}`);
}

/* --------------------------------------------------------- solid numeric */

export const solidSectionTemplates: readonly TemplateMetadata[] = [
  {
    id: "cone-section-area",
    version: 1,
    title: "Cone and pyramid cross-section and volume",
    skillId: "measurement-formula-proofs",
    gradeBand: "9–12",
    description:
      "Find the cross-section of a pyramid halfway up, or the volume of a cone with the same base area and height.",
  },
  {
    id: "cavalieri-coin-stack",
    version: 1,
    title: "Volume of a slanted stack of coins",
    skillId: "measurement-formula-proofs",
    gradeBand: "9–12",
    description:
      "A stack of equal coins is pushed into a slant. The volume is the number of coins times the volume of one coin.",
  },
];

export function generateSolidSection(templateId: string, seed: string) {
  seedOk(seed);
  const r = random(templateId, seed);
  if (templateId === "cone-section-area") {
    const meta = metaOf(solidSectionTemplates, templateId);
    const section = r(0, 1) === 0;
    const pair = section
      ? ([[60, 10], [40, 8], [36, 6], [24, 8], [48, 10]] as const)[r(0, 4)]!
      : ([[60, 10], [30, 6], [24, 9], [48, 6], [36, 8]] as const)[r(0, 4)]!;
    const [base, height] = pair;
    if (section) {
      const level = height / 2;
      const area = (base * level * level) / (height * height);
      return assemble(meta, seed, r, {
        prompt: `A pyramid has base area ${base} and height ${height}. A plane parallel to the base at height ${level} from the apex cuts a cross-section. Each length on that plane is ${level}/${height} of the base. What is the area of the cross-section?`,
        answer: String(area),
        hint: `The scale from the apex is ${level} out of ${height}. Area scales by that fraction squared, then multiply the base area ${base}.`,
        explanation: [
          `The plane is ${level} from the apex and the height is ${height}, so the scale is ${level}/${height}.`,
          `Area uses the square of the scale: $\\frac{${level}}{${height}}^2 = ${(level / height) ** 2}$.`,
          `${base} × ${(level / height) ** 2} = ${area}.`,
        ],
      });
    }
    const volume = (base * height) / 3;
    return assemble(meta, seed, r, {
      prompt: `A cone has base area ${base} and height ${height}. Its volume is one third of base area times height. What is the volume?`,
      answer: String(volume),
      hint: `Multiply the base area ${base} by the height ${height}, then take one third.`,
      explanation: [
        `A cone is one third of the cylinder, or prism, with the same base area and height.`,
        `Base area times height is ${base} × ${height} = ${base * height}.`,
        `One third of that is ${volume}.`,
      ],
    });
  }
  if (templateId === "cavalieri-coin-stack") {
    const meta = metaOf(solidSectionTemplates, templateId);
    let count = 30;
    let tenths = 15;
    if (r(0, 3) !== 0) {
      do {
        count = r(10, 40);
        tenths = r(5, 30);
      } while ((count * tenths) % 10 !== 0);
    }
    const volume = (count * tenths) / 10;
    const each = tenths % 10 === 0 ? String(tenths / 10) : (tenths / 10).toFixed(1);
    return assemble(meta, seed, r, {
      prompt: `A stack of ${count} coins, each of volume ${each} ${nounFor(Number(each), "cubic centimeter")}, is pushed into a slanted stack. What is the volume of the slanted stack, in cubic centimeters?`,
      answer: String(volume),
      hint: `There are ${count} coins, and each has volume ${each} ${nounFor(each, "cubic centimeter")}. The slant does not change any layer. Multiply the number of coins by the volume of one coin.`,
      explanation: [
        `Each coin has volume ${each} ${nounFor(Number(each), "cubic centimeter")}, and there are ${count} coins.`,
        `Pushing the stack sideways keeps every coin. The volume is ${count} × ${each} = ${volume}.`,
      ],
    });
  }
  throw new Error(`Unknown solid-section template ${templateId}`);
}

/* ---------------------------------------------------- tilted rectangle */

export const tiltedRectangleTemplates: readonly TemplateMetadata[] = [
  {
    id: "tilted-rectangle",
    version: 1,
    title: "Area or perimeter of a tilted rectangle",
    skillId: "coordinate-measurement",
    gradeBand: "9–12",
    requiredResponseCapability: "single-choice-v1",
    ...scenes,
    ...senses,
    description:
      "A rectangle may be tilted on the grid. Use the distance formula on two adjacent sides. The area is the product of the side lengths, and the perimeter is their sum, doubled.",
  },
];

function simplest(coef: number, radicand: number): [number, number] {
  let c = coef;
  let s = radicand;
  for (let f = 2; f * f <= s; f++)
    while (s % (f * f) === 0) {
      s /= f * f;
      c *= f;
    }
  return [c, s];
}
/** Exact radical text, simplified. Integers stay plain. */
export function radicalText(coef: number, radicand: number): string {
  const [c, s] = simplest(coef, radicand);
  if (s === 1) return String(c);
  if (c === 1) return `$\\sqrt{${s}}$`;
  return `$${c}\\sqrt{${s}}$`;
}

export function tiltedFacts(
  ax: number,
  ay: number,
  p: number,
  q: number,
  m: number,
  n: number,
) {
  const s = p * p + q * q;
  const A: Point = [ax, ay];
  const B: Point = [ax + m * p, ay + m * q];
  const D: Point = [ax + n * -q, ay + n * p];
  const C: Point = [B[0] + D[0] - ax, B[1] + D[1] - ay];
  const dot = (B[0] - A[0]) * (D[0] - A[0]) + (B[1] - A[1]) * (D[1] - A[1]);
  const xs = [A[0], B[0], C[0], D[0]];
  const ys = [A[1], B[1], C[1], D[1]];
  const box = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
  const deltas = Math.abs(B[0] - A[0]) * Math.abs(B[1] - A[1]);
  const added = (m * m + n * n) * s;
  const taxicab = 2 * (m + n) * (p + q);
  return {
    A, B, C, D, dot, s, box, deltas, added, taxicab,
    area: m * n * s,
    ab: radicalText(m, s),
    ad: radicalText(n, s),
    perimeter: radicalText(2 * (m + n), s),
    half: radicalText(m + n, s),
    doubled: radicalText(4 * (m + n), s),
  };
}

function windowFor(points: Point[]) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const lo = Math.min(-1, ...xs, ...ys) - 1;
  const hi = Math.max(1, ...xs, ...ys) + 1;
  const span = hi - lo;
  return {
    x: [Math.floor(lo), Math.ceil(hi)] as [number, number],
    y: [Math.floor(lo), Math.ceil(hi)] as [number, number],
    tick: span > 24 ? 4 : span > 12 ? 2 : 1,
  };
}
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));

export function generateTiltedRectangle(templateId: string, seed: string) {
  seedOk(seed);
  if (templateId !== "tilted-rectangle")
    throw new Error(`Unknown tilted-rectangle template ${templateId}`);
  const meta = metaOf(tiltedRectangleTemplates, templateId);
  const r = random(templateId, seed);
  for (let attempt = 0; attempt < 50; attempt++) {
    const useExample = attempt === 0 && r(0, 5) === 0;
    const ax = useExample ? 0 : r(-6, 6);
    const ay = useExample ? 0 : r(-6, 6);
    let p = useExample ? 2 : r(1, 4);
    let q = useExample ? 1 : r(1, 4);
    if (!useExample && gcd(p, q) !== 1) continue;
    const m = useExample ? 2 : r(1, 3);
    const n = useExample ? 1 : r(1, 3);
    const fact = tiltedFacts(ax, ay, p, q, m, n);
    if (fact.dot !== 0) continue;
    const pts = [fact.A, fact.B, fact.C, fact.D];
    if (pts.some(([x, y]) => Math.abs(x) > 10 || Math.abs(y) > 10)) continue;
    const ask = r(0, 1) === 0 ? "area" : "perimeter";
    const addedRoot = radicalText(1, fact.added);
    const areaLabels = [
      `${fact.area} square units`,
      `${fact.box} square units`,
      `${fact.deltas} square units`,
      `${addedRoot === String(fact.area) ? fact.area + fact.s : addedRoot} square units`,
    ];
    const periLabels = [
      fact.perimeter,
      fact.half,
      fact.doubled,
      String(fact.taxicab),
    ];
    const labels = ask === "area" ? areaLabels : periLabels;
    if (new Set(labels).size !== 4) continue;
    if (ask === "area" && labels[0] === labels[3]) continue;
    const w = windowFor(pts);
    let g = graph({ x: w.x, y: w.y, tick: w.tick }).id("g");
    (["A", "B", "C", "D"] as const).forEach((name, i) => {
      g = g.point(pts[i]![0], pts[i]![1], name);
    });
    pts.forEach((p0, i) => {
      g = g.segment(p0, pts[(i + 1) % 4]!);
    });
    const coord = (name: string, p0: Point) =>
      `$${name}(${signed(p0[0])}, ${signed(p0[1])})$`;
    const correct = labels[0]!;
    const wrong =
      ask === "area"
        ? [
            [`${fact.box} square units`, "That is the bounding box, width times height of the grid rectangle around ABCD."],
            [`${fact.deltas} square units`, "Those are the horizontal and vertical gaps of side $AB$, used as if they were the two side lengths."],
            [labels[3]!, "Adding the numbers under the square roots is not multiplying the side lengths."],
          ]
        : [
            [fact.half, "That is one of each side, not the full trip around."],
            [fact.doubled, "That doubles the perimeter a second time."],
            [String(fact.taxicab), "Adding the coordinate gaps of each side measures a path along the grid, not the straight sides."],
          ];
    return {
      ...assemble(meta, seed, r, {
        prompt: `Rectangle $ABCD$ has vertices ${coord("A", fact.A)}, ${coord("B", fact.B)}, ${coord("C", fact.C)} and ${coord("D", fact.D)}. What is its ${ask === "area" ? "area, in square units" : "perimeter"}?`,
        answer: "",
        hint:
          ask === "area"
            ? `The vertices are ${coord("A", fact.A)}, ${coord("B", fact.B)}, ${coord("C", fact.C)} and ${coord("D", fact.D)}. Adjacent sides are perpendicular when the product of their slopes is −1, or when their direction vectors have dot product 0. Multiply the two side lengths.`
            : `The vertices are ${coord("A", fact.A)}, ${coord("B", fact.B)}, ${coord("C", fact.C)} and ${coord("D", fact.D)}. Find the two different side lengths with the distance formula, add them, and double. A grid path along the coordinate gaps is longer than the straight side.`,
        explanation: [
          `Side $AB$ runs ${count(m, "step")} of $(${p}, ${q})$, so its length is ${fact.ab}. Side $AD$ runs ${count(n, "step")} of $(${-q}, ${p})$, so its length is ${fact.ad}.`,
          `The direction vectors have dot product 0, so the angle at $A$ is a right angle.`,
          ask === "area"
            ? `Area = $${fact.ab.replaceAll("$", "")} \\times ${fact.ad.replaceAll("$", "")} = ${fact.area}$. The bounding box has area ${fact.box}, which counts squares outside the rectangle.`
            : `Perimeter = $2(${fact.ab.replaceAll("$", "")} + ${fact.ad.replaceAll("$", "")}) = ${fact.perimeter.replaceAll("$", "")}$.`,
        ],
        figure: {
          kind: "scene",
          scene: g.scene({ title: "Rectangle ABCD" }),
        },
        choices: [
          { label: correct, correct: true as const },
          ...wrong.map(([label, feedback]) => ({ label: label!, feedback: feedback! })),
        ],
      }),
      variant: { id: ask },
    };
  }
  throw new Error("Could not build tilted-rectangle");
}
