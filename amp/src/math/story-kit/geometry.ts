// Grade-4 geometry contexts. Names come from names.ts. A trailing number in
// the seed (book-0, book-1, …) walks the list, so twelve samples cover it.

import { createHash } from "node:crypto";
import { storyNames } from "./names.js";

export function spreadPick<T>(
  seed: string,
  salt: string,
  items: readonly T[],
): T {
  const offset = createHash("sha256").update(salt).digest().readUInt32BE(0);
  const tail = /(\d+)\D*$/.exec(seed);
  const n = tail
    ? Number(tail[1])
    : createHash("sha256")
        .update(JSON.stringify([salt, seed]))
        .digest()
        .readUInt32BE(4);
  return items[(n + offset) % items.length]!;
}

export function storyNameFor(seed: string, salt: string): string {
  return spreadPick(seed, salt, storyNames);
}

const deg = (k: number) => `$${k}^\\circ$`;

const protractorPlaces = [
  { id: "ramp", thing: "a skateboard ramp", along: "the ground" },
  { id: "door", thing: "an open door", along: "the closed door" },
  { id: "pizza", thing: "a pizza cut", along: "one cut" },
  { id: "kite", thing: "a kite string", along: "the ground" },
  { id: "roof", thing: "a roof beam", along: "the top of the wall" },
  { id: "ladder", thing: "a ladder", along: "the ground" },
  { id: "scissors", thing: "a pair of scissors", along: "one blade" },
  { id: "sunbeam", thing: "a sunbeam", along: "the window sill" },
  { id: "gate", thing: "a garden gate", along: "the fence" },
  { id: "easel", thing: "an art easel", along: "the floor" },
  { id: "wheelchair", thing: "a wheelchair ramp", along: "the sidewalk" },
  { id: "clock", thing: "the clock hands", along: "the line to 12" },
] as const;

export function protractorPrompt(seed: string, k: number): string {
  const place = spreadPick(seed, "protractor-place", protractorPlaces);
  const name = storyNameFor(seed, "protractor-name");
  const angle = deg(k);
  const frames = [
    `${name} measures ${place.thing} with a protractor. Ray $BA$ lies along ${place.along}. Which other ray makes a ${angle} angle with ray $BA$?`,
    `The protractor sits on ${place.thing}. Ray $BA$ lies along ${place.along}. Which ray is ${angle} from ray $BA$?`,
    `${name} checks ${place.thing}. Follow the protractor from ray $BA$. Which ray shows ${angle}?`,
    `Look at the protractor on ${place.thing}. Ray $BA$ lies along ${place.along}. Find the ray that opens ${angle} from ray $BA$.`,
  ];
  return spreadPick(seed, "protractor-frame", frames);
}

const adjacentScenes = [
  "cuts a pizza slice into two pieces",
  "measures a door held open by a brace",
  "checks a skateboard ramp and its support",
  "marks the opening between two clock hands",
  "opens a pair of scissors around a pencil",
  "leans a ladder and adds a strut",
  "flies a kite and watches the string and the ground",
  "props a window with a stick",
  "builds a roof brace",
  "turns a skateboard and marks the turn",
  "opens a book and marks the covers",
  "sets a garden gate on its hinge",
] as const;

export function adjacentPrompt(
  seed: string,
  wholeName: string,
  knownName: string,
  missingName: string,
  whole: number,
  known: number,
): string {
  const name = storyNameFor(seed, "adjacent-name");
  const scene = spreadPick(seed, "adjacent-scene", adjacentScenes);
  const core = `Angle $${wholeName}$ measures ${whole}°. Angle $${knownName}$ measures ${known}°. The measure of angle $${missingName}$ is $x$ degrees.`;
  const questions = [
    "Which equation is true?",
    "Which equation finds $x$?",
    "Which equation matches these two angles?",
    "Choose the equation that is true.",
  ];
  const question = spreadPick(seed, "adjacent-question", questions);
  return `${name} ${scene}. ${core} ${question}`;
}

const benchmarkScenes = [
  (name: string) => `${name} opens a door.`,
  (name: string) => `${name} looks at a skateboard ramp.`,
  (name: string) => `${name} holds one slice of pizza.`,
  (name: string) => `${name} opens a pair of scissors.`,
  (name: string) => `${name} leans a ladder against a wall.`,
  (name: string) => `${name} flies a kite.`,
  (name: string) => `The hands on ${name}'s clock form an opening.`,
  (name: string) => `${name} props a window open.`,
  (name: string) => `${name} sets a ramp for a toy car.`,
  (name: string) => `${name} opens a garden gate.`,
  (name: string) => `${name} bends a pipe cleaner.`,
  (name: string) => `${name} turns a skateboard.`,
] as const;

export function benchmarkPrompt(seed: string): string {
  const name = storyNameFor(seed, "benchmark-name");
  const scene = spreadPick(seed, "benchmark-scene", benchmarkScenes)(name);
  const questions = [
    "Which benchmark is this angle nearest?",
    "Which benchmark is closest to this opening?",
    "Estimate the angle. Which benchmark is nearest?",
    "Which benchmark best matches this opening?",
  ];
  return `${scene} ${spreadPick(seed, "benchmark-question", questions)}`;
}

const triangleObjects = [
  "birdhouse roof",
  "sandwich",
  "sail",
  "kite panel",
  "bridge support",
  "pennant",
  "tortilla chip",
  "paper airplane wing",
  "garden flag",
  "scarf corner",
  "ramp brace",
  "nacho",
] as const;

export function trianglePrompt(seed: string): string {
  const name = storyNameFor(seed, "triangle-name");
  const object = spreadPick(seed, "triangle-object", triangleObjects);
  const frames = [
    `${name} built a ${object}. The triangle is marked with tick marks for equal sides and a square for a right angle. Fill in the two blanks.`,
    `Look at the tick marks on ${name}'s ${object}. A square mark means a right angle. Name the triangle by its sides and by its angles.`,
    `${name} cut a triangular ${object}. Tick marks show equal sides, and a square shows a right angle. Fill in both blanks.`,
    `The tick marks on this ${object} show which sides match. ${name} also checks for a square right-angle mark. How should the two blanks be filled?`,
  ];
  return spreadPick(seed, "triangle-frame", frames);
}

const quadObjects = [
  "sign",
  "floor tile",
  "badge",
  "tray",
  "cloth patch",
  "place mat",
  "index card",
  "window",
  "sticker",
  "flag",
  "name tag",
  "garden bed",
] as const;

export function quadrilateralPrompt(seed: string): string {
  const name = storyNameFor(seed, "quad-name");
  const object = spreadPick(seed, "quad-object", quadObjects);
  const frames = [
    `${name} painted a ${object} this shape. What is the most exact name for this quadrilateral?`,
    `Look at the marks on ${name}'s ${object}. What is the most exact name for this quadrilateral?`,
    `${name} is sorting a ${object}. Which is the most exact name for this quadrilateral?`,
    `The arrows and tick marks are drawn on the ${object}. What is the most exact name for this quadrilateral?`,
  ];
  return spreadPick(seed, "quad-frame", frames);
}

export type LengthUnit = "cm" | "m" | "ft" | "in";

export function unitWord(unit: LengthUnit, n: number): string {
  const one = n === 1;
  if (unit === "cm") return one ? "centimeter" : "centimeters";
  if (unit === "m") return one ? "meter" : "meters";
  if (unit === "ft") return one ? "foot" : "feet";
  return one ? "inch" : "inches";
}

export function areaWord(unit: LengthUnit, n: number): string {
  return `square ${unitWord(unit, n)}`;
}

export type CompositeJob = {
  id: string;
  measure: "area" | "perimeter";
  unit: LengthUnit;
  /** Inclusive ranges. Both axes stay at least 6 so each rectangle is real. */
  w: readonly [number, number];
  h: readonly [number, number];
  frames: readonly ((name: string, noun: string) => string)[];
};

export const compositeJobs: readonly CompositeJob[] = [
  {
    id: "dog-run",
    measure: "perimeter",
    unit: "ft",
    w: [12, 18],
    h: [8, 14],
    frames: [
      (name, noun) =>
        `${name} is fencing an L-shaped dog run. The dashed line is where two rectangular pens meet, inside the run. What is the perimeter, in ${noun}?`,
      (name, noun) =>
        `The L-shaped dog run needs fence on every outer side. ${name} marked the join of the two pens with a dashed line. What is the perimeter, in ${noun}?`,
    ],
  },
  {
    id: "garden",
    measure: "perimeter",
    unit: "m",
    w: [8, 14],
    h: [6, 10],
    frames: [
      (name, noun) =>
        `${name} is putting a border around an L-shaped garden. The dashed line splits the garden into two rectangles and stays inside. What is the perimeter, in ${noun}?`,
      (name, noun) =>
        `An L-shaped garden bed needs edging on the outside only. ${name} drew a dashed line where the two rectangles meet. What is the perimeter, in ${noun}?`,
    ],
  },
  {
    id: "playground",
    measure: "perimeter",
    unit: "m",
    w: [10, 16],
    h: [8, 12],
    frames: [
      (name, noun) =>
        `${name} is marking the edge of an L-shaped playground. The dashed line is inside, where two rectangles join. What is the perimeter, in ${noun}?`,
      (name, noun) =>
        `The playground is two rectangles joined in an L. ${name} will walk the outer edge. What is the perimeter, in ${noun}?`,
    ],
  },
  {
    id: "poster",
    measure: "perimeter",
    unit: "cm",
    w: [24, 36],
    h: [18, 28],
    frames: [
      (name, noun) =>
        `${name} is framing an L-shaped poster. The wood goes around the outside. The dashed line is only the seam between two rectangles. What is the perimeter, in ${noun}?`,
      (name, noun) =>
        `An L-shaped poster needs a frame on every outer side. ${name} marked the inner seam with a dashed line. What is the perimeter, in ${noun}?`,
    ],
  },
  {
    id: "photo",
    measure: "perimeter",
    unit: "in",
    w: [10, 16],
    h: [8, 12],
    frames: [
      (name, noun) =>
        `${name} is framing an L-shaped photo. The frame follows the outside. The dashed line is the cut between two rectangles, not part of the frame. What is the perimeter, in ${noun}?`,
      (name, noun) =>
        `The photo print is an L made of two rectangles. ${name} wants the length of the outer frame. What is the perimeter, in ${noun}?`,
    ],
  },
  {
    id: "sandbox",
    measure: "perimeter",
    unit: "ft",
    w: [8, 14],
    h: [6, 10],
    frames: [
      (name, noun) =>
        `${name} is building a rail around an L-shaped sandbox. The dashed line shows where two rectangular boxes meet. What is the perimeter, in ${noun}?`,
      (name, noun) =>
        `The sandbox is L-shaped. ${name} needs rail for the outside only. What is the perimeter, in ${noun}?`,
    ],
  },
  {
    id: "bedroom",
    measure: "area",
    unit: "m",
    w: [6, 10],
    h: [6, 9],
    frames: [
      (name, noun) =>
        `${name} will carpet an L-shaped bedroom. The dashed line splits the floor into two rectangles. What is the area, in ${noun}?`,
      (name, noun) =>
        `The bedroom floor is an L made of two rectangles. ${name} splits it along the dashed line to find the carpet. What is the area, in ${noun}?`,
    ],
  },
  {
    id: "patio",
    measure: "area",
    unit: "ft",
    w: [10, 16],
    h: [8, 12],
    frames: [
      (name, noun) =>
        `${name} is tiling an L-shaped patio. The dashed line splits the patio into two rectangles. What is the area, in ${noun}?`,
      (name, noun) =>
        `The patio is two rectangles joined in an L. ${name} will cover the whole surface with tiles. What is the area, in ${noun}?`,
    ],
  },
  {
    id: "rug",
    measure: "area",
    unit: "ft",
    w: [8, 12],
    h: [6, 10],
    frames: [
      (name, noun) =>
        `${name} is cutting an L-shaped rug. The dashed line shows the two rectangles that make the rug. What is the area, in ${noun}?`,
      (name, noun) =>
        `An L-shaped rug covers two rectangular parts of the floor. ${name} wants the amount of rug. What is the area, in ${noun}?`,
    ],
  },
  {
    id: "desk",
    measure: "area",
    unit: "cm",
    w: [20, 32],
    h: [14, 24],
    frames: [
      (name, noun) =>
        `${name} is covering an L-shaped desk with a mat. The dashed line splits the desktop into two rectangles. What is the area, in ${noun}?`,
      (name, noun) =>
        `The desk top is an L. ${name} splits it along the dashed line to find how much mat to cut. What is the area, in ${noun}?`,
    ],
  },
  {
    id: "stage",
    measure: "area",
    unit: "m",
    w: [8, 12],
    h: [6, 10],
    frames: [
      (name, noun) =>
        `${name} is painting an L-shaped stage floor. The dashed line splits the stage into two rectangles. What is the area, in ${noun}?`,
      (name, noun) =>
        `The stage is two rectangles in an L. ${name} needs the floor space. What is the area, in ${noun}?`,
    ],
  },
  {
    id: "mural",
    measure: "area",
    unit: "cm",
    w: [28, 36],
    h: [18, 28],
    frames: [
      (name, noun) =>
        `${name} is painting an L-shaped mural board. The dashed line splits the board into two rectangles. What is the area, in ${noun}?`,
      (name, noun) =>
        `The mural board is an L made of two rectangles. ${name} wants the painted surface. What is the area, in ${noun}?`,
    ],
  },
];

export function compositeJob(seed: string): CompositeJob {
  return spreadPick(seed, "composite-job", compositeJobs);
}

export type FormulaScene = {
  id: string;
  measure: "area" | "perimeter";
  unit: "cm" | "m";
  length: readonly [number, number];
  width: readonly [number, number];
  lead: (name: string) => string;
};

export const formulaScenes: readonly FormulaScene[] = [
  {
    id: "dog-fence",
    measure: "perimeter",
    unit: "m",
    length: [6, 12],
    width: [3, 8],
    lead: (name) =>
      `${name} is fencing a rectangular dog run. The length $l$ is the long side and the width $w$ is the short side, both in meters.`,
  },
  {
    id: "frame",
    measure: "perimeter",
    unit: "cm",
    length: [20, 36],
    width: [12, 24],
    lead: (name) =>
      `${name} is making a wood frame for a photo. The length $l$ and the width $w$ are the outer sides, in centimeters.`,
  },
  {
    id: "garden-border",
    measure: "perimeter",
    unit: "m",
    length: [5, 10],
    width: [3, 7],
    lead: (name) =>
      `${name} is edging a rectangular garden. The length $l$ and the width $w$ are in meters.`,
  },
  {
    id: "poster-ribbon",
    measure: "perimeter",
    unit: "cm",
    length: [24, 40],
    width: [16, 28],
    lead: (name) =>
      `${name} is putting ribbon around a rectangular poster. The length $l$ and the width $w$ are in centimeters.`,
  },
  {
    id: "court",
    measure: "perimeter",
    unit: "m",
    length: [8, 14],
    width: [4, 9],
    lead: (name) =>
      `${name} walks the edge of a rectangular court. The length $l$ and the width $w$ are in meters.`,
  },
  {
    id: "mat-tape",
    measure: "perimeter",
    unit: "cm",
    length: [30, 48],
    width: [18, 32],
    lead: (name) =>
      `${name} is taping the edge of a rectangular desk mat. The length $l$ and the width $w$ are in centimeters.`,
  },
  {
    id: "carpet",
    measure: "area",
    unit: "m",
    length: [4, 8],
    width: [3, 6],
    lead: (name) =>
      `${name} is carpeting a rectangular room. The length $l$ and the width $w$ are in meters.`,
  },
  {
    id: "patio-tiles",
    measure: "area",
    unit: "m",
    length: [5, 9],
    width: [3, 6],
    lead: (name) =>
      `${name} is tiling a rectangular patio. The length $l$ and the width $w$ are in meters.`,
  },
  {
    id: "poster-paper",
    measure: "area",
    unit: "cm",
    length: [22, 36],
    width: [14, 26],
    lead: (name) =>
      `${name} is cutting paper for a rectangular poster. The length $l$ and the width $w$ are in centimeters.`,
  },
  {
    id: "banner",
    measure: "area",
    unit: "cm",
    length: [40, 60],
    width: [20, 36],
    lead: (name) =>
      `${name} is cutting fabric for a rectangular banner. The length $l$ and the width $w$ are in centimeters.`,
  },
  {
    id: "wall",
    measure: "area",
    unit: "m",
    length: [4, 7],
    width: [2, 4],
    lead: (name) =>
      `${name} is painting a rectangular wall. The length $l$ and the width $w$ are in meters.`,
  },
  {
    id: "garden-soil",
    measure: "area",
    unit: "m",
    length: [3, 8],
    width: [2, 5],
    lead: (name) =>
      `${name} is covering a rectangular garden bed. The length $l$ and the width $w$ are in meters.`,
  },
];

export function formulaScene(seed: string): FormulaScene {
  return spreadPick(seed, "formula-scene", formulaScenes);
}

export function formulaAsk(
  seed: string,
  n: number,
  measure: "area" | "perimeter",
): string {
  const noun = n === 1 ? "expression" : "expressions";
  const frames =
    measure === "perimeter"
      ? [
          `Select the ${n} ${noun} that equal the perimeter.`,
          `Which ${n} ${noun} equal the perimeter?`,
          `Choose the ${n} ${noun} that equal the perimeter.`,
          `Find the ${n} ${noun} that equal the perimeter.`,
        ]
      : [
          `Select the ${n} ${noun} that equal the area.`,
          `Which ${n} ${noun} equal the area?`,
          `Choose the ${n} ${noun} that equal the area.`,
          `Find the ${n} ${noun} that equal the area.`,
        ];
  return spreadPick(seed, "formula-ask", frames);
}

const classifyScenes = [
  (name: string) =>
    `${name} opens a door. What kind of angle does the door make with the wall?`,
  (name: string) =>
    `${name} looks at a skateboard ramp. What kind of angle does the ramp make with the ground?`,
  (name: string) =>
    `The hands on ${name}'s clock form this opening. What kind of angle is it?`,
  (name: string) =>
    `${name} opens a pair of scissors. What kind of angle is between the blades?`,
  (name: string) =>
    `${name} looks at the tip of a pizza slice. What kind of angle is it?`,
  (name: string) =>
    `${name} leans a ladder on a wall. What kind of angle does the ladder make with the ground?`,
  (name: string) =>
    `${name} flies a kite. What kind of angle does the string make with the ground?`,
  (name: string) =>
    `${name} props a window open. What kind of angle does it make with the sill?`,
  (name: string) =>
    `${name} sets a ramp for a toy car. What kind of angle does the ramp make with the floor?`,
  (name: string) =>
    `${name} bends a pipe cleaner. What kind of angle is at the bend?`,
  (name: string) =>
    `${name} opens a book. What kind of angle do the covers make?`,
  (name: string) =>
    `${name} turns a skateboard. What kind of angle is the turn?`,
] as const;

const reflexLines = [
  "The arc goes the long way past a straight line. What kind of angle is this?",
  "Follow the long arc, not the short opening. What kind of angle is it?",
  "This opening passes a straight line and stops before a full turn. What kind of angle is this?",
  "The mark takes the long way around. What kind of angle is it?",
] as const;

/** Story surface for angle-classify. The bare axis value keeps the old prompt. */
export function classifyPrompt(seed: string, reflex: boolean): string {
  if (reflex) return spreadPick(seed, "classify-reflex", reflexLines);
  const name = storyNameFor(seed, "classify-name");
  return spreadPick(seed, "classify-scene", classifyScenes)(name);
}

export const shapeStories = [
  (name: string) => `${name} is cutting paper shapes for a collage.`,
  (name: string) => `${name} is choosing floor tiles.`,
  (name: string) => `${name} is drawing parts for a robot.`,
  (name: string) => `${name} is picking signs for a school fair.`,
  (name: string) => `${name} is sorting flags for field day.`,
  (name: string) => `${name} is building with pattern blocks.`,
  (name: string) => `${name} is laying out stickers for a poster.`,
  (name: string) => `${name} is choosing patches for a backpack.`,
  (name: string) => `${name} is cutting felt for a banner.`,
  (name: string) => `${name} is matching cards in a shape game.`,
  (name: string) => `${name} is designing a playground mural.`,
  (name: string) => `${name} is packing crackers that come in these shapes.`,
] as const;

export function shapeStory(seed: string): string {
  const name = storyNameFor(seed, "shape-name");
  return spreadPick(seed, "shape-story", shapeStories)(name);
}
