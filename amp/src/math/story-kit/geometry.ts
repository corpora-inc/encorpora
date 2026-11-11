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

/** The figure is the protractor, so the prompt stays on ray BA and the degree. */
export function protractorPrompt(seed: string, k: number): string {
  const angle = deg(k);
  const frames = [
    `On this protractor, ray $BA$ is the zero line. Which other ray makes a ${angle} angle with ray $BA$?`,
    `Which ray is ${angle} from ray $BA$?`,
    `Find the ray that opens ${angle} from ray $BA$.`,
    `Ray $BA$ is the ray at zero. Which ray makes a ${angle} angle with ray $BA$?`,
    `Read the scale that starts at zero on ray $BA$. Which ray shows ${angle}?`,
    `One of these rays makes a ${angle} angle with ray $BA$. Which ray is it?`,
    `Ray $BA$ is the zero line. Which ray makes a ${angle} angle with it?`,
    `Which of the labeled rays is ${angle} from ray $BA$?`,
    `Start at ray $BA$ and find the ray at ${angle}. Which ray is that?`,
    `Ray $BA$ reads zero. Follow that scale to ${angle}. Which ray is there?`,
    `The angle between ray $BA$ and one ray is ${angle}. Which ray makes that angle?`,
    `Use ray $BA$ as zero. Which ray is ${angle} along the protractor?`,
  ];
  return spreadPick(seed, "protractor-frame", frames);
}

export function protractorHint(
  seed: string,
  k: number,
  right: boolean,
): string {
  const scale = right ? "inner" : "outer";
  const side = right ? "right" : "left";
  const frames = [
    `Read the scale that starts at zero on ray $BA$. That ray is on the ${side}, so use the ${scale} scale. Follow it to ${deg(k)}.`,
    `Ray $BA$ is on the ${side}, so the ${scale} scale is the row that reads zero there. Follow that row to ${deg(k)}.`,
    `Find zero on ray $BA$. Use the ${scale} scale, then follow it to ${deg(k)}.`,
  ];
  return spreadPick(seed, "protractor-hint", frames);
}

type AdjacentFit = {
  opening: string;
  splitter: "The brace" | "The strut" | "One cut";
};

/** A story only when the whole angle is that object and the middle ray is the split. */
function adjacentFits(whole: number): readonly AdjacentFit[] {
  const fits: AdjacentFit[] = [];
  if (whole >= 30 && whole <= 75)
    fits.push({
      opening: "The ramp rises from the floor at",
      splitter: "The brace",
    });
  if (whole >= 60 && whole <= 75)
    fits.push({
      opening: "The ladder meets the ground at",
      splitter: "The strut",
    });
  if (whole >= 30 && whole <= 45)
    fits.push({
      opening: "The roof rises from the top of the wall at",
      splitter: "The brace",
    });
  if (whole === 30 || whole === 45 || whole === 60 || whole === 90)
    fits.push({
      opening: "The pizza slice opens at",
      splitter: "One cut",
    });
  if (whole >= 30 && whole <= 160)
    fits.push({
      opening: "The door opens from the wall at",
      splitter: "The brace",
    });
  if (whole >= 30 && whole <= 160)
    fits.push({
      opening: "The gate opens from the fence at",
      splitter: "The brace",
    });
  return fits;
}

export function adjacentPrompt(
  seed: string,
  wholeName: string,
  knownName: string,
  missingName: string,
  whole: number,
  known: number,
): string {
  const questions = [
    "Which equation is true?",
    "Which equation finds $x$?",
    "Which equation matches these two angles?",
    "Choose the equation that is true.",
  ];
  const question = spreadPick(seed, "adjacent-question", questions);
  const cores = [
    `Angle $${wholeName}$ measures ${whole}°. Angle $${knownName}$ measures ${known}°. The measure of angle $${missingName}$ is $x$ degrees.`,
    `The whole angle $${wholeName}$ is ${whole}°. The known part $${knownName}$ is ${known}°. Angle $${missingName}$ is $x$ degrees.`,
    `Angle $${wholeName}$ measures ${whole}°. Inside it, angle $${knownName}$ measures ${known}°. Angle $${missingName}$ is $x$ degrees.`,
    `Angle $${wholeName}$ measures ${whole}°. Inside it, the adjacent angle $${knownName}$ measures ${known}°. Angle $${missingName}$ is $x$ degrees.`,
    `Two adjacent angles make angle $${wholeName}$, which measures ${whole}°. Angle $${knownName}$ measures ${known}°. Angle $${missingName}$ is $x$ degrees.`,
  ];
  const bare = `${spreadPick(seed, "adjacent-core", cores)} ${question}`;
  const voice = spreadPick(seed, "adjacent-voice", [
    "bare",
    "bare",
    "story",
  ] as const);
  if (voice !== "story") return bare;
  const fits = adjacentFits(whole);
  if (fits.length === 0) return bare;
  const fit = spreadPick(seed, "adjacent-fit", fits);
  return `${fit.opening} angle $${wholeName}$, which measures ${whole}°. ${fit.splitter} splits it into angle $${knownName}$ of ${known}° and angle $${missingName}$ of $x$ degrees. ${question}`;
}

type Opening = { line: string; target: string };

/** The drawn degree picks the object. A ladder stays acute with the ground,
 * a laptop screen past vertical tilts back, and a straight opening is a book,
 * a map, a laptop, or a gate, not a hinged door. */
function benchmarkOpenings(measure: number, name: string): readonly Opening[] {
  const door = (line: string): Opening => ({
    line,
    target: "the angle the door makes with the wall",
  });
  const scissors = (line: string): Opening => ({
    line,
    target: "the angle between the blades",
  });
  const book = (line: string): Opening => ({
    line,
    target: "the angle between the covers",
  });
  const gate = (line: string): Opening => ({
    line,
    target: "the angle the gate makes with the fence",
  });
  const ladder = (line: string): Opening => ({
    line,
    target: "the angle the ladder makes with the ground",
  });
  const laptop = (line: string): Opening => ({
    line,
    target: "the angle the screen makes with the keyboard",
  });
  const out: Opening[] = [];
  if (measure <= 40) {
    out.push(
      door(`${name} opens a door a little way.`),
      scissors(`${name} opens a pair of scissors a little.`),
      book(`${name} opens a book a crack.`),
      gate(`${name} opens a garden gate a little.`),
      {
        line: `${name} opens a greeting card a little.`,
        target: "the angle between the two panels",
      },
    );
  }
  if (measure >= 40 && measure <= 55) {
    out.push(
      door(`${name} opens a door partway.`),
      scissors(`${name} opens a pair of scissors partway.`),
      book(`${name} opens a book in a narrow V.`),
      gate(`${name} opens a garden gate partway.`),
      {
        line: `${name} looks at a ramp rising from the floor.`,
        target: "the angle the ramp makes with the floor",
      },
    );
  }
  if (measure >= 50 && measure <= 80) {
    out.push(
      door(`${name} opens a door partway from the wall.`),
      scissors(`${name} opens a pair of scissors.`),
      gate(`${name} opens a garden gate partway.`),
      {
        line: `${name} opens a folder partway.`,
        target: "the angle between the covers",
      },
      {
        line: `${name} looks at a ramp rising from the floor.`,
        target: "the angle the ramp makes with the floor",
      },
    );
  }
  if (measure >= 65 && measure <= 75)
    out.push(ladder(`${name} leans a ladder against a wall.`), {
      line: `${name} flies a kite.`,
      target: "the angle the string makes with the ground",
    });
  if (measure >= 76 && measure < 90) {
    out.push(
      ladder(`${name} leans a ladder steeply against a wall.`),
      door(`${name} opens a door well away from the wall.`),
      laptop(`${name} opens a laptop so the screen rises from the keyboard.`),
      gate(`${name} opens a garden gate well away from the fence.`),
      {
        line: `${name} props a window well open from the sill.`,
        target: "the angle the window makes with the sill",
      },
    );
  }
  if (measure > 90 && measure <= 110) {
    out.push(
      laptop(`${name} tilts a laptop screen back from the keyboard.`),
      door(`${name} swings a door open from the wall.`),
      book(`${name} opens a book so the covers stand apart.`),
      gate(`${name} swings a garden gate open from the fence.`),
      {
        line: `${name} opens a folder so the covers stand apart.`,
        target: "the angle between the covers",
      },
    );
  }
  if (measure >= 165) {
    out.push(
      book(`${name} opens a book wide across the table.`),
      {
        line: `${name} unfolds a newspaper on the table.`,
        target: "the angle at the center fold",
      },
      gate(`${name} swings a garden gate around to the fence.`),
      {
        line: `${name} unfolds a map along its fold.`,
        target: "the angle at the fold",
      },
      {
        line: `${name} opens a folding table.`,
        target: "the angle between the two halves",
      },
    );
  }
  if (out.length === 0)
    throw new Error(`benchmark opening has no object for ${measure}°`);
  return out;
}

export function benchmarkPrompt(seed: string, measure: number): string {
  const name = storyNameFor(seed, "benchmark-name");
  const opening = spreadPick(
    seed,
    "benchmark-opening",
    benchmarkOpenings(measure, name),
  );
  const target = opening.target;
  const asks = [
    `Which benchmark is closest to ${target}?`,
    `Which benchmark best matches ${target}?`,
    `Estimate ${target}. Which benchmark is nearest?`,
  ];
  return `${opening.line} ${spreadPick(seed, "benchmark-question", asks)}`;
}

/** Version 1 names the marks and leaves a non-right corner to be compared
 * with the corner of a page. Version 2 names the labeled widest angle too. */
const legacyTriangleFrames = [
  "Tick marks show equal sides. A square mark shows a right angle when one is there. Name this triangle by its sides and by its angles.",
  "Look at the tick marks and the corner marks. Fill in the two blanks: one for the sides and one for the angles.",
  "Equal sides share tick marks. A square mark means a right angle. How should the two blanks be filled?",
  "The tick marks show which sides match. A square mark shows a right angle. What names fill the two blanks?",
  "Name the triangle by its sides and by its angles. Tick marks show equal sides, and a square mark shows a right angle.",
  "Count the matching tick marks, then check for a square right-angle mark. Fill in both blanks.",
  "The triangle is marked with tick marks for equal sides. A square mark, if there is one, shows a right angle. Fill in the two blanks.",
  "Use the tick marks to name the sides, and the corner marks to name the angles. Fill in both blanks.",
  "Which names fit? Tick marks show equal sides, and a square mark shows a right angle.",
  "Fill in the side name and the angle name. Matching tick marks mean equal sides.",
  "Read the tick marks first. Then see whether any corner has a square right-angle mark. Fill in the two blanks.",
  "Two blanks name this triangle. Tick marks show the equal sides, and a square mark shows a right angle.",
] as const;

const triangleFrames = [
  "Tick marks show equal sides. A square mark shows a right angle when one is there. If there is no square mark, the widest angle's measure is labeled. Name this triangle by its sides and by its angles.",
  "Look at the tick marks and the corner marks. If there is no square mark, the widest angle is labeled. Fill in the two blanks: one for the sides and one for the angles.",
  "Equal sides share tick marks. A square mark means a right angle. Otherwise the widest angle's measure is labeled. How should the two blanks be filled?",
  "The tick marks show which sides match. A square mark shows a right angle, and the widest angle's measure is labeled when the triangle is not right. What names fill the two blanks?",
  "Name the triangle by its sides and by its angles. Tick marks show equal sides, a square mark shows a right angle, and the widest angle is labeled when it is not a right angle.",
  "Count the matching tick marks, then check for a square right-angle mark. If there is none, read the labeled measure of the widest angle. Fill in both blanks.",
  "The triangle is marked with tick marks for equal sides. A square mark shows a right angle. When there is no square mark, the widest angle's measure is labeled. Fill in the two blanks.",
  "Use the tick marks to name the sides. Use a square mark, or the labeled widest angle, to name the angles. Fill in both blanks.",
  "Which names fit? Tick marks show equal sides. A square mark shows a right angle, and the widest angle's measure is labeled when the triangle is not right.",
  "Fill in the side name and the angle name. Matching tick marks mean equal sides. The angle name comes from a square mark or from the labeled widest angle.",
  "Read the tick marks first. Then read the angle given: a square mark, or the labeled measure of the widest angle. Fill in the two blanks.",
  "Two blanks name this triangle. Tick marks show the equal sides. A square mark shows a right angle, and the widest angle's measure is labeled when there is no square mark.",
] as const;

/** The figure is a marked triangle, so the prompt stays on the marks. */
export function trianglePrompt(seed: string, version = 2): string {
  return spreadPick(
    seed,
    "triangle-frame",
    version >= 2 ? triangleFrames : legacyTriangleFrames,
  );
}

/** The figure is a marked quadrilateral. The prompt must not name the answer. */
export function quadrilateralPrompt(seed: string): string {
  const frames = [
    "Matching arrows show parallel sides. Tick marks show equal sides. A right-angle mark shows a right angle. What is the most exact name for this quadrilateral?",
    "Use the arrows, the tick marks, and the right-angle marks. What is the most exact name for this quadrilateral?",
    "Which is the most exact name for this quadrilateral? Read the parallel marks, the equal-side marks, and the right-angle marks.",
    "The arrows show parallel sides and the tick marks show equal sides. What is the most exact name for this quadrilateral?",
    "Look at the marks on this quadrilateral. What is the most exact name?",
    "Give the most exact name for this quadrilateral. Count the pairs of parallel sides, the right angles, and the equal sides.",
    "What is the most exact name for this quadrilateral? The arrows, tick marks, and right-angle marks are the evidence.",
    "Name this quadrilateral with the most exact name. Check parallel sides, right angles, and equal sides.",
    "The marks are the clues. What is the most exact name for this quadrilateral?",
    "The marks decide the name. What is the most exact name for this quadrilateral?",
    "From the parallel marks and the right-angle marks, what is the most exact name for this quadrilateral?",
    "What is the most exact name for this quadrilateral? Use every mark before you choose.",
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
    w: [12, 20],
    h: [8, 14],
    frames: [
      (name, noun) =>
        `${name} needs fence around a dog run made of two rectangles. The dashed line is the join inside the run, so it gets no fence. What is the perimeter, in ${noun}?`,
      (name, noun) =>
        `How much fence does ${name} need for the dog run? The dashed line marks where the two pens meet, and that join stays inside. What is the perimeter, in ${noun}?`,
    ],
  },
  {
    id: "pool-deck",
    measure: "area",
    unit: "ft",
    w: [16, 28],
    h: [12, 20],
    frames: [
      (name, noun) =>
        `${name} is laying boards on a pool deck made of two rectangles. The dashed line is the join. What is the area, in ${noun}?`,
      (name, noun) =>
        `The pool deck is two rectangles joined along the dashed line. ${name} will cover the whole deck. What is the area, in ${noun}?`,
    ],
  },
  {
    id: "vegetable-bed",
    measure: "perimeter",
    unit: "ft",
    w: [8, 14],
    h: [6, 10],
    frames: [
      (name, noun) =>
        `${name} is putting edging around a vegetable bed made of two rectangles. The dashed line stays inside the soil. What is the perimeter, in ${noun}?`,
      (name, noun) =>
        `The vegetable bed needs edging on the outside only. ${name} marked the inner join with a dashed line. What is the perimeter, in ${noun}?`,
    ],
  },
  {
    id: "classroom-floor",
    measure: "area",
    unit: "ft",
    w: [18, 28],
    h: [14, 22],
    frames: [
      (name, noun) =>
        `${name} is finding the floor space of a classroom made of two rectangles. The dashed line splits the floor. What is the area, in ${noun}?`,
      (name, noun) =>
        `The classroom floor is two rectangles joined along the dashed line. ${name} needs the whole floor. What is the area, in ${noun}?`,
    ],
  },
  {
    id: "picture-mat",
    measure: "perimeter",
    unit: "in",
    w: [12, 18],
    h: [8, 14],
    frames: [
      (name, noun) =>
        `${name} is cutting the outside edge of a picture mat made of two rectangles. The dashed line is only the seam. What is the perimeter, in ${noun}?`,
      (name, noun) =>
        `A picture mat is two rectangles. ${name} wants the outer edge. The dashed line is not part of that edge. What is the perimeter, in ${noun}?`,
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
        `${name} is putting a border around a garden made of two rectangles. The dashed line stays in the soil. What is the perimeter, in ${noun}?`,
      (name, noun) =>
        `The garden border goes around the outside. ${name} drew a dashed line where the two rectangles meet. What is the perimeter, in ${noun}?`,
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
        `${name} is framing a poster made of two rectangles. The wood goes around the outside, and the dashed line is the seam. What is the perimeter, in ${noun}?`,
      (name, noun) =>
        `The poster frame follows every outer side. ${name} marked the inner seam with a dashed line. What is the perimeter, in ${noun}?`,
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
        `${name} is framing a photo print made of two rectangles. The frame follows the outside. What is the perimeter, in ${noun}?`,
      (name, noun) =>
        `The photo print is two rectangles joined along a dashed seam. ${name} needs the outer frame. What is the perimeter, in ${noun}?`,
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
        `${name} will carpet a bedroom floor made of two rectangles. The dashed line splits the floor. What is the area, in ${noun}?`,
      (name, noun) =>
        `The bedroom floor is two rectangles. ${name} splits it along the dashed line to find the carpet. What is the area, in ${noun}?`,
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
        `${name} is tiling a patio made of two rectangles. The dashed line splits the patio. What is the area, in ${noun}?`,
      (name, noun) =>
        `The patio is two rectangles joined along the dashed line. ${name} will cover the whole surface. What is the area, in ${noun}?`,
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
        `${name} is cutting a rug made of two rectangles. The dashed line shows the two parts. What is the area, in ${noun}?`,
      (name, noun) =>
        `The rug covers two rectangular parts of the floor. ${name} wants the area of the rug. What is the area, in ${noun}?`,
    ],
  },
  {
    id: "cutting-mat",
    measure: "area",
    unit: "cm",
    w: [20, 32],
    h: [14, 24],
    frames: [
      (name, noun) =>
        `${name} is gluing two rectangular pieces into a cutting mat. The dashed line is the join. What is the area, in ${noun}?`,
      (name, noun) =>
        `The cutting mat is two rectangles glued along the dashed line. ${name} wants the area of the mat. What is the area, in ${noun}?`,
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
    length: [8, 14],
    width: [4, 7],
    lead: (name) =>
      `${name} is buying fence to go around a rectangular dog run. Length $l$ and width $w$ are labeled in meters.`,
  },
  {
    id: "picture-mat",
    measure: "perimeter",
    unit: "cm",
    length: [24, 40],
    width: [16, 28],
    lead: (name) =>
      `${name} is cutting the outer edge of a rectangular picture mat. The figure labels length $l$ and width $w$ in centimeters.`,
  },
  {
    id: "vegetable-border",
    measure: "perimeter",
    unit: "m",
    length: [4, 9],
    width: [2, 5],
    lead: (name) =>
      `${name} is putting a border around a rectangular vegetable bed. $l$ is the length and $w$ is the width, in meters.`,
  },
  {
    id: "poster-ribbon",
    measure: "perimeter",
    unit: "cm",
    length: [30, 48],
    width: [18, 32],
    lead: (name) =>
      `${name} is putting ribbon around a rectangular poster. The length $l$ and the width $w$ are in centimeters.`,
  },
  {
    id: "court",
    measure: "perimeter",
    unit: "m",
    length: [12, 20],
    width: [6, 10],
    lead: (name) =>
      `${name} walks around a rectangular court. The length $l$ and the width $w$ are in meters.`,
  },
  {
    id: "frame",
    measure: "perimeter",
    unit: "cm",
    length: [18, 32],
    width: [12, 22],
    lead: (name) =>
      `${name} is making a wood frame for a rectangular photo. The length $l$ and the width $w$ are the outer sides, in centimeters.`,
  },
  {
    id: "pool-deck",
    measure: "area",
    unit: "m",
    length: [6, 12],
    width: [3, 6],
    lead: (name) =>
      `${name} is covering a rectangular pool deck. Use the labeled length $l$ and width $w$, in meters.`,
  },
  {
    id: "classroom-floor",
    measure: "area",
    unit: "m",
    length: [8, 12],
    width: [6, 9],
    lead: (name) =>
      `${name} is measuring a rectangular classroom floor. $l$ and $w$ are the side lengths, in meters.`,
  },
  {
    id: "carpet",
    measure: "area",
    unit: "m",
    length: [5, 8],
    width: [3, 5],
    lead: (name) =>
      `${name} is carpeting a rectangular room. The length $l$ and the width $w$ are in meters.`,
  },
  {
    id: "patio-tiles",
    measure: "area",
    unit: "m",
    length: [4, 8],
    width: [3, 6],
    lead: (name) =>
      `${name} is tiling a rectangular patio. The length $l$ and the width $w$ are in meters.`,
  },
  {
    id: "poster-paper",
    measure: "area",
    unit: "cm",
    length: [28, 42],
    width: [18, 30],
    lead: (name) =>
      `${name} is cutting paper for a rectangular poster. The length $l$ and the width $w$ are in centimeters.`,
  },
  {
    id: "vegetable-soil",
    measure: "area",
    unit: "m",
    length: [3, 7],
    width: [2, 4],
    lead: (name) =>
      `${name} is covering a rectangular vegetable bed with soil. Length $l$ and width $w$ are labeled in meters.`,
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

/** Six lines per kind, so the three samples of one kind in a book of 12 do not repeat.
 * Each line matches that kind: a leaning ladder is acute with the ground, a
 * screen tilted back is obtuse, and a right angle is a real square corner. */
const classifyByKind: Record<string, readonly ((name: string) => string)[]> = {
  acute: [
    (name) =>
      `${name} leans a ladder against a wall. What kind of angle does the ladder make with the ground?`,
    (name) =>
      `${name} opens a pair of scissors partway. What kind of angle is between the blades?`,
    (name) =>
      `${name} opens a door partway. What kind of angle does the door make with the wall?`,
    (name) =>
      `${name} opens a garden gate partway. What kind of angle does the gate make with the fence?`,
    (name) =>
      `${name} opens a book partway. What kind of angle do the covers make?`,
    (name) =>
      `${name} looks at a ramp rising from the floor. What kind of angle does the ramp make with the floor?`,
  ],
  right: [
    (name) =>
      `${name} opens a door out from the wall. What kind of angle does the door make with the wall?`,
    (name) =>
      `${name} opens a garden gate out from the fence. What kind of angle does the gate make with the fence?`,
    (name) =>
      `${name} stands a bookshelf against the wall. What kind of angle does the side make with the floor?`,
    (name) =>
      `${name} looks at a corner of a picture frame. What kind of angle is that corner?`,
    (name) =>
      `${name} opens a laptop so the screen rises from the keyboard. What kind of angle does the screen make with the keyboard?`,
    (name) =>
      `${name} props a window open from the sill. What kind of angle does the window make with the sill?`,
  ],
  obtuse: [
    (name) =>
      `${name} tilts a laptop screen back from the keyboard. What kind of angle does the screen make with the keyboard?`,
    (name) =>
      `${name} swings a door wide from the wall. What kind of angle does the door make with the wall?`,
    (name) =>
      `${name} swings a garden gate wide from the fence. What kind of angle does the gate make with the fence?`,
    (name) =>
      `${name} opens a book wide. What kind of angle do the covers make?`,
    (name) =>
      `${name} props a window wide from the sill. What kind of angle does the window make with the sill?`,
    (name) =>
      `${name} opens a toy-box lid wide. What kind of angle does the lid make with the box?`,
  ],
  straight: [
    (name) =>
      `${name} opens a book all the way. What kind of angle do the covers make?`,
    (name) =>
      `${name} unfolds a letter along its crease. What kind of angle does the crease make?`,
    (name) =>
      `${name} opens a laptop all the way from the keyboard. What kind of angle does the screen make with the keyboard?`,
    (name) =>
      `${name} stretches both arms out to opposite sides. What kind of angle do the arms make?`,
    (name) =>
      `${name} unfolds a map at its center fold. What kind of angle does the fold make?`,
    (name) =>
      `${name} swings a garden gate from its closed place around to the fence. What kind of angle does the gate make with its closed position?`,
  ],
};

const reflexLines = [
  "The arc goes the long way past a straight line. What kind of angle is this?",
  "Follow the long arc, not the short opening. What kind of angle is it?",
  "This opening passes a straight line and stops before a full turn. What kind of angle is this?",
  "The mark takes the long way around. What kind of angle is it?",
] as const;

/** Story surface for angle-classify. The bare axis value keeps the old prompt.
 * The scene fits the kind: a ramp is not called straight, and a flat book is
 * not called a bend. */
export function classifyPrompt(
  seed: string,
  reflex: boolean,
  kind = "acute",
): string {
  if (reflex) return spreadPick(seed, "classify-reflex", reflexLines);
  const name = storyNameFor(seed, "classify-name");
  const pool = classifyByKind[kind] ?? classifyByKind.acute!;
  return spreadPick(seed, "classify-scene", pool)(name);
}

const shapeNeeds: Record<string, readonly ((name: string) => string)[]> = {
  parallel: [
    (name) =>
      `${name} is choosing floor tiles that will sit in straight rows, so a pair of sides must stay the same distance apart.`,
    (name) =>
      `${name} is lining up pattern blocks. A pair of sides has to stay the same distance apart so the row stays straight.`,
    (name) =>
      `${name} is laying a border of shapes. The sides in a pair need to stay the same distance apart.`,
    (name) =>
      `${name} is picking signs that can hang in a straight row. A pair of sides must never meet.`,
    (name) =>
      `${name} is sorting quilt pieces that can line up edge to edge. A pair of sides must stay the same distance apart.`,
  ],
  perpendicular: [
    (name) =>
      `${name} is picking patches that meet the edge of a page in a square corner.`,
    (name) =>
      `${name} is cutting felt for a banner. A piece works when two sides meet like the corner of a page.`,
    (name) =>
      `${name} is choosing tiles that can sit against the corner of the room.`,
    (name) =>
      `${name} is matching cards to the corner of a notebook. Two sides need to meet like that corner.`,
    (name) =>
      `${name} is building a frame. Two sides of a piece need to meet the way a page corner does.`,
  ],
  obtuse: [
    (name) =>
      `${name} is sorting pattern blocks and keeping the ones with a corner wider than a square corner.`,
    (name) =>
      `${name} is choosing signs with a wide corner, wider than the corner of a page and short of a straight line.`,
    (name) =>
      `${name} is cutting felt pieces that need one wide corner, past a square corner and not yet straight.`,
    (name) =>
      `${name} is laying stickers and wants the ones with a wide corner.`,
    (name) =>
      `${name} is sorting cards. A card stays in the pile when one corner is wider than a square corner.`,
  ],
  "no-right": [
    (name) => `${name} is cutting quilt pieces that have no square corner.`,
    (name) => `${name} is picking stickers with no square corner for a poster.`,
    (name) =>
      `${name} is sorting pattern blocks and setting aside every piece with no square corner.`,
    (name) => `${name} is choosing flags that have no square corner.`,
    (name) =>
      `${name} is cutting paper shapes with no square corner for a collage.`,
  ],
};

/** The drawn polygons are the shapes the person is choosing. */
export function shapeStory(
  seed: string,
  property: "parallel" | "perpendicular" | "obtuse" | "no-right",
): string {
  const name = storyNameFor(seed, "shape-name");
  const lines = shapeNeeds[property] ?? shapeNeeds.parallel!;
  return spreadPick(seed, `shape-story-${property}`, lines)(name);
}
