import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";

type Random = (low: number, high: number) => number;
const definitions = [
  [
    "multiply-facts",
    "Multiplication facts",
    "multiplication-facts",
    "Multiply one-digit factors from an equation, a covered dot array, or a story of equal rows.",
  ],
  [
    "divide-facts",
    "Division facts",
    "division-facts",
    "Divide within 100 by thinking of the related multiplication fact and a covered dot array.",
  ],
  [
    "missing-factor-fact",
    "Find the missing factor",
    "missing-factor",
    "Find the unknown factor or divisor in a multiplication or division equation within 100.",
  ],
  [
    "share-or-group",
    "Share or make groups",
    "division-meaning",
    "Find the size of each share or the number of equal groups, from counters or a story.",
  ],
  [
    "times-table-pattern",
    "Patterns in the multiplication table",
    "arithmetic-patterns",
    "Use a pattern in part of a multiplication table to find a missing product.",
  ],
] as const;
export const factArrayTemplates: readonly TemplateMetadata[] = definitions.map(
  ([id, title, skillId, description]) => ({
    id,
    title,
    skillId,
    description,
    gradeBand: "3–5",
    version: 1,
  }),
);

function random(id: string, seed: string): Random {
  let counter = 0;
  return (low, high) => {
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
const pick = <T>(r: Random, items: readonly T[]) =>
  items[r(0, items.length - 1)]!;
/** Half the factors come from 6–9, where recall is hardest. */
const factor = (r: Random) => (r(0, 1) ? r(6, 9) : r(2, 10));
const skip = (step: number, count: number) =>
  Array.from({ length: count }, (_, i) => step * (i + 1)).join(", ");

/** The known-fact route for a × b: one step that uses the givens and stops
 * short of the product. */
export function factHint(a: number, b: number) {
  const pair = (k: number) =>
    a === k ? { n: b } : b === k ? { n: a } : undefined;
  let p;
  if ((p = pair(2))) return `Double ${p.n}.`;
  if ((p = pair(10))) return `Ten groups of ${p.n} make ${p.n} tens.`;
  if ((p = pair(5))) return `Find ${p.n} × 10, then take half of it.`;
  if ((p = pair(9)))
    return `Find ${p.n} × 10, then take away one group of ${p.n}.`;
  if ((p = pair(4))) return `Double ${p.n}, then double the result.`;
  if ((p = pair(3))) return `Double ${p.n}, then add one more ${p.n}.`;
  if (a === 1 || b === 1) return "One group keeps its size.";
  const big = Math.max(a, b),
    small = Math.min(a, b);
  return `Split ${big} into 5 and ${big - 5}: find 5 × ${small} and ${big - 5} × ${small}, then add.`;
}
function factSteps(a: number, b: number): string {
  const p = a * b;
  const pair = (k: number) => (a === k ? b : b === k ? a : undefined);
  let n;
  if ((n = pair(2)) !== undefined)
    return `2 groups of ${n} is ${n} doubled: ${n} + ${n} = ${p}.`;
  if ((n = pair(10)) !== undefined)
    return `10 groups of ${n} make ${n} tens, and ${n} tens are ${p}.`;
  if ((n = pair(5)) !== undefined)
    return `5 is half of 10, so find ${n} × 10 = ${n * 10} and take half: ${p}.`;
  if ((n = pair(9)) !== undefined)
    return `9 is one less than 10, so find ${n} × 10 = ${n * 10} and take away one ${n}: ${n * 10} − ${n} = ${p}.`;
  if ((n = pair(4)) !== undefined)
    return `4 is 2 doubled, so double ${n} to get ${2 * n}, then double again to get ${p}.`;
  if ((n = pair(3)) !== undefined)
    return `3 groups are 2 groups and 1 more: double ${n} is ${2 * n}, and ${2 * n} + ${n} = ${p}.`;
  const big = Math.max(a, b),
    small = Math.min(a, b),
    rest = big - 5;
  return `Split ${big} into 5 and ${rest}, two facts you know: 5 × ${small} = ${5 * small} and ${rest} × ${small} = ${rest * small}. Add them: ${5 * small} + ${rest * small} = ${p}.`;
}

const rowStories = [
  [
    "A hall has",
    "rows of chairs, with",
    "chairs in each row. How many chairs are in the hall?",
  ],
  [
    "A garden has",
    "rows of bean plants, with",
    "plants in each row. How many bean plants are in the garden?",
  ],
  [
    "A baker fills",
    "rows on a tray, with",
    "rolls in each row. How many rolls are on the tray?",
  ],
  [
    "A wall has",
    "rows of tiles, with",
    "tiles in each row. How many tiles are on the wall?",
  ],
] as const;
const shareStories = [
  (n: number, g: number) =>
    `${n} stickers are shared equally by ${g} friends. How many stickers does each friend get?`,
  (n: number, g: number) =>
    `${n} grapes are shared equally on ${g} plates. How many grapes are on each plate?`,
  (n: number, g: number) =>
    `A teacher puts ${n} books on ${g} shelves, the same number on each shelf. How many books are on each shelf?`,
];
const measureStories = [
  (n: number, s: number) =>
    `${n} eggs are packed ${s} to a box. How many boxes are filled?`,
  (n: number, s: number) =>
    `A coach puts ${n} players into teams of ${s}. How many teams are there?`,
  (n: number, s: number) =>
    `${n} apples are put in bags of ${s}. How many bags are filled?`,
];

export function generateFactArrayProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const meta = factArrayTemplates.find((t) => t.id === templateId);
  if (!meta) throw new Error(`Unknown fact-array template: ${templateId}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  let prompt = "",
    answer = 0,
    hint = "",
    explanation: string[] = [],
    figure: SemanticFigure;
  switch (templateId) {
    case "multiply-facts": {
      const a = factor(r);
      let b = factor(r);
      const frame = r(0, 3);
      if (frame === 3 && a === b) b = a >= 9 ? a - 1 : a + 1;
      const p = a * b;
      answer = p;
      figure = { kind: "dot-array", show: "edges", rows: a, columns: b };
      const rows = `${a} × ${b} means ${a} equal groups of ${b}, like ${a} rows of ${b} dots.`;
      if (frame === 0) {
        prompt = `What is ${a} × ${b}?`;
        hint = factHint(a, b);
        explanation = [rows, factSteps(a, b), `So ${a} × ${b} = ${p}.`];
      } else if (frame === 1) {
        prompt =
          "A card covers part of this array of dots. How many dots are in the whole array?";
        hint =
          "The top row shows how many dots are in each row; the left column shows how many rows there are. Multiply the two counts.";
        explanation = [
          `An array is dots in equal rows, so every row has as many dots as the top row.`,
          `The top row has ${b} dots and the left column has ${a}, so the array is ${a} rows of ${b}: ${a} × ${b}.`,
          factSteps(a, b),
          `The whole array has ${p} dots.`,
        ];
      } else if (frame === 2) {
        const [lead, middle, end] = pick(r, rowStories);
        const noun = end.split(" ")[0];
        prompt = `${lead} ${a} ${middle} ${b} ${end}`;
        hint = `${a} equal rows of ${b} is ${a} × ${b}.`;
        explanation = [
          `Every row has the same number, so the total is ${a} equal groups of ${b}: ${a} × ${b}.`,
          factSteps(a, b),
          `There are ${p} ${noun} in all.`,
        ];
      } else {
        prompt = `The array shows ${a} rows of ${b} dots. Use it to find ${b} × ${a}.`;
        hint = `Turn the array a quarter turn: ${b} rows of ${a} use the same dots as ${a} rows of ${b}.`;
        explanation = [
          `Turned a quarter turn, the ${a} rows of ${b} become ${b} rows of ${a}. No dot is added or lost.`,
          `So ${b} × ${a} and ${a} × ${b} count the same dots: the order of the factors (the numbers multiplied) does not change the total.`,
          factSteps(a, b),
          `So ${b} × ${a} = ${p}.`,
        ];
      }
      break;
    }
    case "divide-facts": {
      const d = factor(r),
        q = factor(r),
        n = d * q,
        frame = r(0, 4);
      const think = `${n} ÷ ${d} asks: ${d} times what number is ${n}?`;
      if (frame === 2) {
        // A given fact, then the division by its second factor.
        prompt = `${d} × ${q} = ${n}. Use this fact to find ${n} ÷ ${q}.`;
        answer = d;
        figure = { kind: "dot-array", show: "first-row", columns: q, total: n };
        hint = `${n} ÷ ${q} = □ means □ × ${q} = ${n}. Compare it with the fact you were given.`;
        explanation = [
          `Division undoes multiplication: ${n} ÷ ${q} asks how many groups of ${q} make ${n}.`,
          `The fact ${d} × ${q} = ${n} says ${d} groups of ${q} make ${n}.`,
          `That answers the question, so ${n} ÷ ${q} = ${d}.`,
        ];
        break;
      }
      if (frame === 4) {
        // Measuring: the row length is known; count the rows.
        prompt = `${n} chairs are set out in rows of ${q}. How many rows are there?`;
        answer = d;
        figure = { kind: "dot-array", show: "first-row", columns: q, total: n };
        hint = `Skip-count by ${q} until you reach ${n}; each count is one row.`;
        explanation = [
          `Each row holds ${q} chairs, so the question is how many groups of ${q} make ${n}: ${n} ÷ ${q}.`,
          `Skip-count by ${q}, one count per row: ${skip(q, d)}.`,
          `That is ${d} counts, and ${d} × ${q} = ${n} checks it.`,
          `There are ${d} rows.`,
        ];
        break;
      }
      answer = q;
      figure = { kind: "dot-array", show: "first-column", rows: d, total: n };
      prompt =
        frame === 0
          ? `What is ${n} ÷ ${d}?`
          : frame === 1
            ? `This array has ${n} dots in ${d} equal rows. How many dots are in each row?`
            : `A teacher sets out ${n} chairs in ${d} equal rows. How many chairs are in each row?`;
      hint = `Think of the multiplication: ${d} × □ = ${n}.`;
      explanation = [
        `Division splits a total into equal groups. It undoes multiplication.`,
        think,
        `You know ${d} × ${q} = ${n}, so the missing number is ${q}.`,
        frame === 0
          ? `So ${n} ÷ ${d} = ${q}.`
          : `So ${n} ÷ ${d} = ${q}: there are ${q} ${frame === 1 ? "dots" : "chairs"} in each row.`,
      ];
      break;
    }
    case "missing-factor-fact": {
      const a = factor(r),
        b = factor(r),
        n = a * b,
        frame = r(0, 3);
      if (frame === 0 || frame === 2) {
        prompt =
          frame === 0
            ? `${a} × □ = ${n}. What number belongs in the box?`
            : `${n} = ${a} × □. What number belongs in the box?`;
        answer = b;
        figure = { kind: "dot-array", show: "first-column", rows: a, total: n };
        hint = `Skip-count by ${a} until you reach ${n}, and count the skips.`;
        explanation = [
          `${a} × □ = ${n} asks: ${a} times what number makes ${n}?`,
          `Skip-count by ${a} until you reach ${n}, because each skip adds one more ${a}: ${skip(a, b)}.`,
          `That is ${b} skips, so ${a} × ${b} = ${n}.`,
          `The box holds ${b}.`,
        ];
      } else if (frame === 1) {
        prompt = `□ × ${b} = ${n}. What number belongs in the box?`;
        answer = a;
        figure = { kind: "dot-array", show: "first-row", columns: b, total: n };
        hint = `Skip-count by ${b} until you reach ${n}, and count the skips.`;
        explanation = [
          `□ × ${b} = ${n} asks: how many groups of ${b} make ${n}?`,
          `Skip-count by ${b} until you reach ${n}, because each skip is one more group: ${skip(b, a)}.`,
          `That is ${a} skips, so ${a} × ${b} = ${n}.`,
          `The box holds ${a}.`,
        ];
      } else {
        // The divisor is unknown: n ÷ □ = b means □ rows of b make n.
        prompt = `${n} ÷ □ = ${b}. What number belongs in the box?`;
        answer = a;
        figure = { kind: "dot-array", show: "first-row", columns: b, total: n };
        hint = `${n} ÷ □ = ${b} means □ × ${b} = ${n}. Skip-count by ${b} to ${n}.`;
        explanation = [
          `${n} ÷ □ = ${b} says ${n} split into □ equal groups gives ${b} in each.`,
          `Division undoes multiplication, so this is the same as □ × ${b} = ${n}.`,
          `Skip-count by ${b}, one count per group: ${skip(b, a)}. That is ${a} groups.`,
          `Check: ${n} ÷ ${a} = ${b}. The box holds ${a}.`,
        ];
      }
      break;
    }
    case "share-or-group": {
      const frame = r(0, 3),
        share = frame % 2 === 0;
      const count = share ? r(2, 8) : r(2, 9),
        each = r(2, Math.min(9, Math.floor(60 / count))),
        n = count * each;
      answer = each;
      figure = {
        kind: "share-model",
        mode: share ? "share" : "measure",
        total: n,
        count,
      };
      if (share) {
        prompt =
          frame === 0
            ? `Share ${n} counters equally among ${count} groups. How many counters are in each group?`
            : pick(r, shareStories)(n, count);
        hint =
          frame === 0
            ? `Deal the ${n} counters one at a time, one to each of the ${count} groups, until none are left.`
            : `The number of groups is ${count}. Think: ${count} × □ = ${n}.`;
        explanation = [
          `Sharing equally means every group gets the same number. We know there are ${count} groups.`,
          `Deal one to each group in rounds. Each round uses ${count}: ${skip(count, each)}.`,
          `That is ${each} rounds, so each group gets ${each}.`,
          `This is division: ${n} ÷ ${count} = ${each}. Each group gets ${each}.`,
        ];
      } else {
        prompt =
          frame === 1
            ? `Put ${n} counters into groups of ${count}. How many groups can you make?`
            : pick(r, measureStories)(n, count);
        hint =
          frame === 1
            ? `Fill one group of ${count} at a time until all ${n} counters are used, then count the groups.`
            : `Each group holds ${count}. Skip-count by ${count} until you reach ${n}.`;
        explanation = [
          `Each group holds ${count}, and we want to know how many groups fit.`,
          `Skip-count by ${count}, one count per group, until you reach ${n}: ${skip(count, each)}.`,
          `That is ${each} counts, so ${each} groups fit.`,
          `This is division: ${n} ÷ ${count} = ${each}. You can make ${each} groups.`,
        ];
      }
      break;
    }
    case "times-table-pattern": {
      const frame = r(0, 3);
      let rows: number[],
        columns: number[],
        ask: [number, number],
        blank: [number, number][] = [];
      if (frame === 0) {
        const r0 = r(2, 8),
          c0 = r(2, 7);
        rows = [r0, r0 + 1, r0 + 2];
        columns = [c0, c0 + 1, c0 + 2, c0 + 3];
        ask = [r(0, 2), r(1, 3)];
        const [i, j] = ask,
          R = rows[i]!,
          C = columns[j]!;
        answer = R * C;
        prompt =
          "This part of a multiplication table has one empty cell. What product belongs in it?";
        hint = `Across the row for ${R}, each product is ${R} more than the one before it. Start from ${R} × ${C - 1} = ${R * (C - 1)}.`;
        explanation = [
          `Each cell holds its row number times its column number. That result is called the product.`,
          `The empty cell is in the row for ${R} and the column for ${C}, so it holds ${R} × ${C}.`,
          `Its left neighbor is ${R} × ${C - 1} = ${R * (C - 1)}. One more column adds one more ${R}.`,
          `${R * (C - 1)} + ${R} = ${answer}, so the product ${answer} belongs in the cell.`,
        ];
      } else if (frame === 1) {
        const R = r(3, 9),
          C = r(5, 10);
        rows = [R];
        columns = [C - 3, C - 2, C - 1, C];
        ask = [0, 3];
        answer = R * C;
        prompt = `In the row for ${R} in a multiplication table, each product is ${R} more than the one before it. ${R} × ${C - 1} = ${R * (C - 1)}. What is ${R} × ${C}?`;
        hint = `Add one more ${R} to ${R * (C - 1)}.`;
        explanation = [
          `${R} × ${C} means ${C} groups of ${R}, which is one more group of ${R} than ${R} × ${C - 1}.`,
          `So add one more ${R} to the product you know: ${R * (C - 1)} + ${R} = ${answer}.`,
          `${R} × ${C} = ${answer}.`,
        ];
      } else if (frame === 2) {
        const h = r(2, 5),
          c0 = r(2, 7);
        rows = [h, 2 * h];
        columns = [c0, c0 + 1, c0 + 2, c0 + 3];
        const j = r(0, 3),
          C = columns[j]!;
        ask = [1, j];
        blank = columns
          .map((_, k) => [1, k] as [number, number])
          .filter(([, k]) => k !== j);
        answer = 2 * h * C;
        prompt = `Each product in the row for ${2 * h} is double the product above it, in the row for ${h}. What product belongs in the cell with the question mark?`;
        hint = `Find the product above the question mark, ${h} × ${C}, then double it.`;
        explanation = [
          `The cell holds ${2 * h} × ${C}, its row number times its column number.`,
          `${2 * h} is double ${h}, so ${2 * h} groups of ${C} are double ${h} groups of ${C}.`,
          `The cell above holds ${h} × ${C} = ${h * C}. Double it: ${h * C} + ${h * C} = ${answer}.`,
          `${answer} belongs in the cell with the question mark.`,
        ];
      } else {
        const a = r(2, 4),
          b = r(a + 1, Math.min(10 - a, 7)),
          c0 = r(2, 8);
        rows = [a, b, a + b];
        columns = [c0, c0 + 1, c0 + 2];
        const j = r(0, 2),
          C = columns[j]!;
        ask = [2, j];
        blank = columns
          .map((_, k) => [2, k] as [number, number])
          .filter(([, k]) => k !== j);
        answer = (a + b) * C;
        prompt = `Each product in the row for ${a + b} is the sum of the two products above it. What product belongs in the cell with the question mark?`;
        hint = `The row for ${a + b} is the row for ${a} plus the row for ${b}: add ${a} × ${C} and ${b} × ${C}.`;
        explanation = [
          `The cell holds ${a + b} × ${C}, its row number times its column number.`,
          `${a + b} groups of ${C} are ${a} groups of ${C} and ${b} more groups of ${C}.`,
          `The cells above hold ${a} × ${C} = ${a * C} and ${b} × ${C} = ${b * C}. Add them: ${a * C} + ${b * C} = ${answer}.`,
          `${answer} belongs in the cell with the question mark.`,
        ];
      }
      figure = { kind: "times-table", rows, columns, ask, blank };
      break;
    }
    default:
      throw new Error(`Unknown fact-array template: ${templateId}`);
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
      response: { kind: "number", label: "Answer" },
      figure,
    },
    answer: String(answer),
    hint,
    explanation,
  };
}
