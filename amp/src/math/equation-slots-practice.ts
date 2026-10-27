import type { SemanticFigure, TemplateMetadata } from "./contracts";
import { lineTable } from "./scene/author";
import { defineAxis } from "./variation/axes";
import {
  defineGenerate,
  entry,
  frac,
  gcd,
  inlineSentence,
  multiPartCapability,
  multiPartProblem,
  need,
  pick,
  shuffle,
  type Slot,
} from "./multi-part-support";

/** Build an equation, inequality, rule or sentence by choosing the piece for
 * each slot (multi-part-choice-v1): the accessible form of dragging numbers,
 * symbols and words into place. Every blank offers the numbers of the story
 * a learner could mistake for its role. */
const tables = { requiredFigureCapability: "scenes-v1" as const };
export const equationSlotsTemplates: readonly TemplateMetadata[] = [
  {
    id: "booth-equation-slots",
    version: 1,
    title: "Build the equation for a rate plus a fee",
    skillId: "two-step-equations",
    gradeBand: "6–8",
    ...multiPartCapability,
    description:
      "Complete the equation $an + c = t$ or $t = an - c$ for a story with a charge per item and a one-time fee or discount, choosing the rate, the operation, the one-time amount and the total, written either way round.",
  },
  {
    id: "budget-inequality-slots",
    version: 1,
    title: "Build the inequality for a money limit",
    skillId: "simple-inequalities",
    gradeBand: "6–8",
    ...multiPartCapability,
    description:
      "Complete an inequality such as $24 + s \\le 60$ for spending within a budget or saving toward a goal by choosing the known amount, the inequality symbol and the limit, with at-most, less-than, at-least and more-than wording.",
  },
  {
    id: "unit-fraction-division-slots",
    version: 1,
    title: "Complete a unit fraction division",
    skillId: "unit-fraction-division",
    gradeBand: "3–5",
    ...multiPartCapability,
    description:
      "Complete the division equation for sharing a unit fraction among equal groups, for the number of unit-fraction pieces in a whole number, or for the denominator of a shared unit fraction, choosing the dividend, divisor and quotient.",
  },
  {
    id: "array-division-slots",
    version: 1,
    title: "Complete the division for an array",
    skillId: "division-facts",
    gradeBand: "3–5",
    ...multiPartCapability,
    description:
      "Complete a division equation that fits an array with up to 12 rows and 9 columns, choosing the total, the divisor and the quotient, finding either the number of rows or the number in each row.",
  },
  {
    id: "story-operations-slots",
    version: 1,
    title: "Choose the operations of a story",
    skillId: "multiplicative-stories",
    gradeBand: "3–5",
    ...multiPartCapability,
    description:
      "Choose the two operations that complete an equation for a story with equal groups plus extras, equal groups with some removed, or three factors; exactly one choice of operations gives the total.",
  },
  {
    id: "delivery-operations-slots",
    version: 1,
    title: "Choose the operations for adding and removing",
    skillId: "multi-operation-stories",
    gradeBand: "3–5",
    ...multiPartCapability,
    description:
      "Choose the three operations that complete an equation for a start amount with two changes and a removal, in orders such as add, add, subtract; exactly one choice of operations gives the amount left.",
  },
  {
    id: "table-equation-slots",
    version: 1,
    title: "Complete the equation of a table",
    skillId: "dependent-variables",
    gradeBand: "6–8",
    ...multiPartCapability,
    ...tables,
    description:
      "Complete $y = ax + b$ or $y = ax - b$ for a table of four or five pairs by choosing the multiplier, the operation and the constant.",
  },
  {
    id: "rule-table-fill-slots",
    version: 1,
    title: "Fill in the missing table values",
    skillId: "rule-patterns",
    gradeBand: "3–5",
    ...multiPartCapability,
    ...tables,
    description:
      "Use a stated rule ($y = x + k$, $y = x - k$ or $y = kx$) to choose the two missing outputs and two missing inputs of a table.",
  },
  {
    id: "unit-price-sentence-slots",
    version: 1,
    title: "Complete the unit price sentence",
    skillId: "unit-rates",
    gradeBand: "6–8",
    ...multiPartCapability,
    description:
      "Complete the sentence that divides a total cost by a number of pairs to get the price for one pair, choosing the total, the count and the unit price, in whole dollars or dollars and cents.",
  },
  {
    id: "cylinder-volume-slots",
    version: 1,
    title: "Fill in the cylinder volume equation",
    skillId: "curved-solid-volume",
    gradeBand: "6–8",
    ...multiPartCapability,
    description:
      "Complete $V = \\pi \\times r \\times r \\times h$ for a round pool or tank given by its diameter or its radius and its depth, choosing the radius twice and the height.",
  },
  {
    id: "dilation-rule-slots",
    version: 1,
    title: "Write the rule of a dilation",
    skillId: "dilations-similarity",
    gradeBand: "6–8",
    ...multiPartCapability,
    description:
      "From a vertex and its image under a dilation centered at the origin, complete the rule $(x, y) \\to (kx, ky)$ by choosing both multipliers, for enlargements and reductions.",
  },
  {
    id: "transformation-rule-slots",
    version: 1,
    title: "Match transformations to their rules",
    skillId: "rigid-motions",
    gradeBand: "6–8",
    ...multiPartCapability,
    description:
      "Match two or three transformations about the origin (reflections in the axes or in the line $y = x$, rotations of 90 or 180 degrees) to their coordinate rules.",
  },
  {
    id: "exponent-quotient-slots",
    version: 1,
    title: "Complete a quotient of powers",
    skillId: "exponent-laws",
    gradeBand: "6–8",
    ...multiPartCapability,
    description:
      "Simplify a quotient of terms with the same base by choosing the coefficient and the exponent of the result, including a negative exponent.",
  },
  {
    id: "square-root-solutions-slots",
    version: 1,
    title: "Choose both solutions of a squared binomial",
    skillId: "quadratic-equations",
    gradeBand: "9–12",
    ...multiPartCapability,
    description:
      "Solve $(x - h)^2 = k^2$ or $(x + h)^2 = k^2$ with a perfect square on the right by choosing the lesser and the greater solution.",
  },
  {
    id: "function-shift-sentence",
    version: 1,
    title: "Describe a function shift",
    skillId: "quadratic-graphs",
    gradeBand: "9–12",
    ...multiPartCapability,
    description:
      "Complete a sentence that describes $g(x) = f(x \\mp h) \\pm k$ as a shift left or right and up or down by choosing both directions and both distances.",
  },
];

const OPS = ["$+$", "$-$", "$\\times$", "$\\div$"] as const;
const opTex: Record<string, string> = {
  "+": OPS[0],
  "-": OPS[1],
  "*": OPS[2],
  "/": OPS[3],
};
const sig = (n: number) => (n < 0 ? `−${-n}` : String(n));
/** Pool minus the correct label: the other values a learner could pick. */
const slotOf = (
  id: string,
  label: string,
  correct: string,
  pool: readonly (string | number)[],
  max = 4,
): Slot => ({
  id,
  label,
  correct,
  wrong: pool.map(String).filter((p) => p !== correct),
  max,
});
const tableFigure = (rows: string[][], title: string): SemanticFigure => ({
  kind: "scene",
  scene: lineTable(rows, { header: "column" }).scene({ title }),
});

/* ---------- a rate plus a fee ---------- */
export const boothAxes = {
  story: defineAxis("story", ["fee", "discount"] as const),
  form: defineAxis("form", ["expression-first", "total-first"] as const),
} as const;
const BOOTH_UNITS = [
  ["booth", "booths", "b"],
  ["stall", "stalls", "s"],
  ["tent", "tents", "e"],
  ["kiosk", "kiosks", "k"],
] as const;

/* ---------- a budget ---------- */
export const budgetAxes = {
  context: defineAxis("context", ["spend", "save"] as const),
  strictness: defineAxis("strictness", ["inclusive", "strict"] as const),
} as const;

/* ---------- unit fraction division ---------- */
export const unitFractionAxes = {
  situation: defineAxis("situation", [
    "share-unit-fraction",
    "pieces-in-whole",
    "denominator-of-quotient",
  ] as const),
} as const;
const unitFractionFoods = [
  "cake",
  "pie",
  "pan of cornbread",
  "tray of brownies",
];

/* ---------- arrays ---------- */
export const arrayAxes = {
  ask: defineAxis("ask", ["rows", "columns"] as const),
} as const;

/* ---------- operations ---------- */
export const operationAxes = {
  shape: defineAxis("shape", [
    "groups-and-extra",
    "groups-less-removed",
    "product-of-three",
  ] as const),
} as const;
export const deliveryAxes = {
  order: defineAxis("order", [
    "add-add-subtract",
    "add-subtract-subtract",
    "subtract-add-add",
  ] as const),
} as const;

/** Evaluate `a op1 b op2 c` with the usual order of operations, exactly. */
function evaluate(nums: readonly number[], ops: readonly string[]) {
  const terms: [number, number][] = [[nums[0]!, 1]];
  const adds: string[] = [];
  nums.slice(1).forEach((n, i) => {
    const op = ops[i]!;
    if (op === "*" || op === "/") {
      const [a, b] = terms.at(-1)!;
      terms[terms.length - 1] = op === "*" ? [a * n, b] : [a, b * n];
    } else {
      adds.push(op);
      terms.push([n, 1]);
    }
  });
  let [num, den] = terms[0]!;
  adds.forEach((op, i) => {
    const [a, b] = terms[i + 1]!;
    num = op === "+" ? num * b + a * den : num * b - a * den;
    den *= b;
  });
  const g = gcd(num, den) || 1;
  return den / g === 1 ? num / g : NaN;
}
const OP_CHARS = ["+", "-", "*", "/"] as const;
function solutionsOf(nums: readonly number[], total: number) {
  const out: string[][] = [];
  const count = nums.length - 1;
  const walk = (ops: string[]) => {
    if (ops.length === count) {
      if (evaluate(nums, ops) === total) out.push(ops);
      return;
    }
    for (const op of OP_CHARS) walk([...ops, op]);
  };
  walk([]);
  return out;
}

/* ---------- tables ---------- */
export const tableEquationAxes = {
  shape: defineAxis("shape", ["plus", "minus"] as const),
  size: defineAxis("size", ["four", "five"] as const),
} as const;
export const ruleFillAxes = {
  rule: defineAxis("rule", ["add", "multiply", "subtract"] as const),
} as const;

/* ---------- unit price ---------- */
export const unitPriceAxes = {
  amounts: defineAxis("amounts", [
    "whole-dollars",
    "dollars-and-cents",
  ] as const),
} as const;
const PAIR_ITEMS = [
  ["socks", "pairs of socks"],
  ["gloves", "pairs of gloves"],
  ["sandals", "pairs of sandals"],
  ["laces", "pairs of shoelaces"],
] as const;

/* ---------- cylinder ---------- */
export const cylinderAxes = {
  given: defineAxis("given", ["diameter", "radius"] as const),
} as const;

/* ---------- dilation ---------- */
export const dilationAxes = {
  scale: defineAxis("scale", ["enlargement", "reduction"] as const),
} as const;

/* ---------- transformations ---------- */
export const transformationAxes = {
  rows: defineAxis("rows", ["two", "three"] as const),
} as const;
const MOTIONS = [
  { name: "a reflection across the $x$-axis", rule: "$(x, -y)$" },
  { name: "a reflection across the $y$-axis", rule: "$(-x, y)$" },
  { name: "a reflection across the line $y = x$", rule: "$(y, x)$" },
  { name: "a rotation of 180° about the origin", rule: "$(-x, -y)$" },
  {
    name: "a rotation of 90° counterclockwise about the origin",
    rule: "$(-y, x)$",
  },
  { name: "a rotation of 90° clockwise about the origin", rule: "$(y, -x)$" },
] as const;

/* ---------- quotient of powers ---------- */
export const quotientAxes = {
  exponent: defineAxis("exponent", ["negative", "positive"] as const),
} as const;

/* ---------- squared binomials ---------- */
export const squareRootAxes = {
  sign: defineAxis("sign", ["minus", "plus"] as const),
} as const;

/* ---------- shifts ---------- */
export const shiftAxes = {
  horizontal: defineAxis("horizontal", ["right", "left"] as const),
  vertical: defineAxis("vertical", ["up", "down"] as const),
} as const;

export const equationSlotsAxes = {
  "booth-equation-slots": boothAxes,
  "budget-inequality-slots": budgetAxes,
  "unit-fraction-division-slots": unitFractionAxes,
  "array-division-slots": arrayAxes,
  "story-operations-slots": operationAxes,
  "delivery-operations-slots": deliveryAxes,
  "table-equation-slots": tableEquationAxes,
  "rule-table-fill-slots": ruleFillAxes,
  "unit-price-sentence-slots": unitPriceAxes,
  "cylinder-volume-slots": cylinderAxes,
  "dilation-rule-slots": dilationAxes,
  "transformation-rule-slots": transformationAxes,
  "exponent-quotient-slots": quotientAxes,
  "square-root-solutions-slots": squareRootAxes,
  "function-shift-sentence": shiftAxes,
} as const;

const VARS = ["x", "y", "w"] as const;

export const equationSlotsGenerate = defineGenerate(equationSlotsTemplates, {
  "booth-equation-slots": entry(boothAxes, ({ meta, seed, r, axes }) => {
    const [unit, units, v] = pick(r, BOOTH_UNITS);
    const rate = r(4, 18);
    const count = r(3, 12);
    const one = r(5, 60);
    const fee = axes.story === "fee";
    const total = fee ? rate * count + one : rate * count - one;
    need(
      total > 1 && one !== rate && total !== rate * 10 && one > 1,
      "distinct amounts",
    );
    need(new Set([rate, one, total, count]).size === 4, "distinct values");
    const opLabel = fee ? OPS[0] : OPS[1];
    const a = slotOf("rate", `The amount for each ${unit}`, String(rate), [
      one,
      total,
      count,
      rate + one,
    ]);
    const op = {
      id: "op",
      label: "The operation",
      correct: opLabel,
      fixed: [OPS[0], OPS[1]],
    } as Slot;
    const c = slotOf(
      "once",
      fee ? "The fixed fee" : "The discount",
      String(one),
      [rate, total, count, total - rate],
    );
    const t = slotOf("total", "The total", String(total), [
      total - one,
      total + one,
      rate * count,
      one,
    ]);
    const built =
      axes.form === "expression-first"
        ? inlineSentence([a, ` $${v}$ `, op, " ", c, " $=$ ", t])
        : inlineSentence([t, ` $=$ `, a, ` $${v}$ `, op, " ", c]);
    return multiPartProblem(meta, seed, r, {
      prompt: `A fair charges ${rate} dollars for each ${unit} and ${fee ? `a fixed fee of ${one} dollars` : `gives a discount of ${one} dollars`}. A group pays ${total} dollars in all for $${v}$ ${units}. Complete the equation.`,
      layout: "inline",
      label: "Choose the number or symbol for each gap",
      slots: built.slots,
      sentence: built.sentence,
      hint: `${rate} dollars is charged for each ${unit}, so it is multiplied by $${v}$. Ask whether the ${one} dollars changes with $${v}$ or is paid only once.`,
      explanation: [
        `The charge for $${v}$ ${units} is $${rate}${v}$, because each ${unit} costs ${rate} dollars.`,
        `The ${fee ? "fixed fee" : "discount"} of ${one} dollars happens once, so it is ${fee ? "added to" : "subtracted from"} $${rate}${v}$.`,
        `The total is ${total} dollars, so the equation is $${axes.form === "expression-first" ? `${rate}${v}${fee ? "+" : "-"}${one}=${total}` : `${total}=${rate}${v}${fee ? "+" : "-"}${one}`}$.`,
      ],
    });
  }),

  "budget-inequality-slots": entry(budgetAxes, ({ meta, seed, r, axes }) => {
    const known = r(8, 45);
    const limit = known + r(10, 40);
    need(known !== limit, "distinct amounts");
    const strict = axes.strictness === "strict";
    const spend = axes.context === "spend";
    const symbol = spend
      ? strict
        ? "$<$"
        : "$\\le$"
      : strict
        ? "$>$"
        : "$\\ge$";
    const bank = ["$<$", "$\\le$", "$>$", "$\\ge$"];
    const v = spend ? "s" : "d";
    const wording = spend
      ? strict
        ? "less than"
        : "at most"
      : strict
        ? "more than"
        : "at least";
    const k = slotOf(
      "known",
      spend ? "The ticket price" : "The amount saved",
      String(known),
      [limit, limit - known, limit + known],
    );
    const sym = {
      id: "sym",
      label: "The inequality symbol",
      correct: symbol,
      fixed: bank,
    } as Slot;
    const l = slotOf(
      "limit",
      spend ? "The money to spend" : "The goal",
      String(limit),
      [known, limit - known, limit + known],
    );
    const built = inlineSentence([k, ` $+ ${v}$ `, sym, " ", l]);
    return multiPartProblem(meta, seed, r, {
      prompt: spend
        ? `Jo has ${limit} dollars. A ticket costs ${known} dollars. Jo will spend $s$ dollars on snacks, and the ticket and the snacks together must cost ${wording} the ${limit} dollars Jo has. Complete the inequality.`
        : `Lena has saved ${known} dollars toward a bike that costs ${limit} dollars. She will save $d$ dollars more, and she wants to have ${wording} ${limit} dollars. Complete the inequality.`,
      layout: "inline",
      label: "Choose the number or symbol for each gap",
      slots: built.slots,
      sentence: built.sentence,
      hint: `The words "${wording}" name the inequality symbol: ask whether the amounts can be equal to ${limit} dollars. The ${known} dollars is added to $${v}$.`,
      explanation: [
        spend
          ? `The ticket and the snacks cost $${known}+s$ dollars together.`
          : `The money after saving more is $${known}+d$ dollars.`,
        `"${wording}" means ${wording === "at most" ? "less than or equal to" : wording === "at least" ? "greater than or equal to" : wording} ${limit}, so the symbol is ${symbol}.`,
        `The inequality is $${known}+${v}${wording === "at most" ? "\\le" : wording === "at least" ? "\\ge" : wording === "less than" ? "<" : ">"}${limit}$.`,
      ],
    });
  }),

  "unit-fraction-division-slots": entry(
    unitFractionAxes,
    ({ meta, seed, r, axes }) => {
      const f = (n: number, d: number) => `$${frac(n, d)}$`;
      const food = pick(r, unitFractionFoods);
      if (axes.situation === "share-unit-fraction") {
        const d = r(3, 8);
        const g = r(2, 5);
        need(g !== d, "different numbers");
        const pool = [
          f(1, d),
          String(g),
          f(1, d * g),
          f(g, d),
          String(d),
          String(d * g),
          f(1, d + g),
        ];
        const parts = [
          slotOf("whole", "The amount shared", f(1, d), pool),
          slotOf("by", "The number of people", String(g), pool),
          slotOf("each", "Each person's share", f(1, d * g), pool),
        ];
        const built = inlineSentence([
          parts[0]!,
          " $\\div$ ",
          parts[1]!,
          " $=$ ",
          parts[2]!,
        ]);
        return multiPartProblem(meta, seed, r, {
          prompt: `A baker has $${frac(1, d)}$ of a ${food} left and shares it equally among ${g} people. Complete the equation that finds each person's share.`,
          layout: "inline",
          label: "Choose a number for each gap",
          slots: built.slots,
          sentence: built.sentence,
          hint: `Sharing $${frac(1, d)}$ equally among ${g} people cuts each of those parts into ${g} smaller equal parts. Decide which operation does that.`,
          explanation: [
            `Sharing equally is division: the amount, $${frac(1, d)}$, is divided by the number of people, ${g}.`,
            `Cutting each part into ${g} smaller parts makes parts of size $${frac(1, d * g)}$, so $${frac(1, d)}\\div ${g}=${frac(1, d * g)}$.`,
          ],
        });
      }
      if (axes.situation === "pieces-in-whole") {
        const d = r(2, 6);
        const w = r(2, 6);
        need(w !== d, "different numbers");
        const pool = [
          String(w),
          f(1, d),
          String(w * d),
          f(1, w * d),
          f(w, d),
          String(d),
          String(w + d),
        ];
        const parts = [
          slotOf("whole", "The total distance", String(w), pool),
          slotOf("piece", "The length of one lap", f(1, d), pool),
          slotOf("count", "The number of laps", String(w * d), pool),
        ];
        const built = inlineSentence([
          parts[0]!,
          " $\\div$ ",
          parts[1]!,
          " $=$ ",
          parts[2]!,
        ]);
        return multiPartProblem(meta, seed, r, {
          prompt: `A trail is ${w} miles long, and one lap of a track is $${frac(1, d)}$ mile. Complete the equation that finds how many laps make ${w} miles.`,
          layout: "inline",
          label: "Choose a number for each gap",
          slots: built.slots,
          sentence: built.sentence,
          hint: `Each mile holds $${d}$ laps of $${frac(1, d)}$ mile. To count how many laps of $${frac(1, d)}$ mile fit in ${w} miles, decide whether to divide or multiply.`,
          explanation: [
            `The number of laps is the distance divided by the length of one lap: $${w}\\div ${frac(1, d)}$.`,
            `Each mile has ${d} laps, so ${w} miles have $${w}\\times ${d}=${w * d}$ laps.`,
          ],
        });
      }
      const d = r(2, 6);
      const g = r(2, 6);
      need(g !== d, "different numbers");
      const parts = [
        slotOf("by", "The number of people", String(g), [
          g,
          d,
          d * g,
          d + g,
          g + 1,
        ]),
        slotOf("den", "The denominator of each share", String(d * g), [
          d,
          g,
          d + g,
          d * g + 1,
          d * g - 1,
        ]),
      ];
      const built = inlineSentence([
        `Each person gets $${frac(1, d)}\\div$ `,
        parts[0]!,
        " of a liter, which is the unit fraction with denominator ",
        parts[1]!,
        ".",
      ]);
      return multiPartProblem(meta, seed, r, {
        prompt: `A jug holds $${frac(1, d)}$ liter of juice. It is shared equally among ${g} people. Complete the sentence.`,
        layout: "inline",
        label: "Choose a number for each gap",
        slots: built.slots,
        sentence: built.sentence,
        hint: `The jug is $${frac(1, d)}$ liter, and each of its parts is cut into as many smaller parts as there are people. Count how many of the smaller parts make a whole liter.`,
        explanation: [
          `Dividing $${frac(1, d)}$ liter among ${g} people cuts each of the ${d} parts of a liter into ${g} smaller parts.`,
          `A whole liter then has $${d}\\times ${g}=${d * g}$ of the smaller parts, so each share is $${frac(1, d * g)}$ liter.`,
        ],
      });
    },
  ),

  "array-division-slots": entry(arrayAxes, ({ meta, seed, r, axes }) => {
    const rows = r(3, 12);
    const cols = r(2, 9);
    need(rows !== cols && rows * cols <= 100, "an array within 100");
    const total = rows * cols;
    const divisor = axes.ask === "rows" ? cols : rows;
    const quotient = axes.ask === "rows" ? rows : cols;
    const pool = [rows, cols, total, rows + cols, total - rows, total + cols];
    const parts = [
      slotOf("total", "The number of counters", String(total), pool),
      slotOf(
        "by",
        axes.ask === "rows" ? "The number in each row" : "The number of rows",
        String(divisor),
        pool,
      ),
      slotOf(
        "quot",
        axes.ask === "rows" ? "The number of rows" : "The number in each row",
        String(quotient),
        pool,
      ),
    ];
    const built = inlineSentence([
      parts[0]!,
      " $\\div$ ",
      parts[1]!,
      " $=$ ",
      parts[2]!,
    ]);
    return multiPartProblem(meta, seed, r, {
      prompt: `Counters are arranged in an array of ${rows} rows with ${cols} counters in each row. Complete the division equation that ${axes.ask === "rows" ? "uses the number in each row to find the number of rows" : "uses the number of rows to find the number in each row"}.`,
      layout: "inline",
      label: "Choose a number for each gap",
      slots: built.slots,
      sentence: built.sentence,
      hint: `The array has ${rows} rows and ${cols} counters in each row. First find how many counters there are in all, then ask which of the two numbers you divide by.`,
      explanation: [
        `The array holds $${rows}\\times ${cols}=${total}$ counters.`,
        `Dividing the total by ${divisor} ${axes.ask === "rows" ? "counters in a row" : "rows"} gives ${quotient}, so $${total}\\div ${divisor}=${quotient}$.`,
      ],
    });
  }),

  "story-operations-slots": entry(operationAxes, ({ meta, seed, r, axes }) => {
    let nums: number[];
    let want: string[];
    let story: string;
    let words: string;
    if (axes.shape === "groups-and-extra") {
      nums = [r(3, 9), r(3, 9), r(2, 12)];
      want = ["*", "+"];
      story = `A coach buys ${nums[0]} bags of tennis balls with ${nums[1]} balls in each bag, and ${nums[2]} more loose balls. Choose the operations that find the total number of balls.`;
      words =
        "bags of equal size are multiplied, and the loose balls are added";
    } else if (axes.shape === "groups-less-removed") {
      nums = [r(3, 9), r(5, 12), r(2, 8)];
      want = ["*", "-"];
      story = `A school has ${nums[0]} boxes of markers with ${nums[1]} markers in each box. ${nums[2]} markers are given away. Choose the operations that find how many markers are left.`;
      words =
        "the boxes are multiplied, and the markers given away are subtracted";
    } else {
      nums = [r(2, 6), r(2, 6), r(2, 6)];
      want = ["*", "*"];
      story = `A club has ${nums[0]} courts. Each court has ${nums[1]} bags, and each bag holds ${nums[2]} balls. Choose the operations that find the total number of balls.`;
      words = "each group size multiplies the count again";
    }
    const total = evaluate(nums, want);
    const hits = solutionsOf(nums, total);
    need(hits.length === 1 && Number.isInteger(total), "one set of operations");
    const slots: Slot[] = want.map((op, i) => ({
      id: `op${i + 1}`,
      label: `The operation after ${nums[i]}`,
      correct: opTex[op]!,
      fixed: OPS,
    }));
    const built = inlineSentence([
      `$${nums[0]}$ `,
      slots[0]!,
      ` $${nums[1]}$ `,
      slots[1]!,
      ` $${nums[2]}$ $=${total}$`,
    ]);
    return multiPartProblem(meta, seed, r, {
      prompt: story,
      layout: "inline",
      label: "Choose an operation for each gap",
      slots: built.slots,
      sentence: built.sentence,
      hint: `Think about what ${nums[0]} and ${nums[1]} stand for in the story, and whether they are groups of the same size or amounts to combine.`,
      explanation: [
        `In this story ${words}.`,
        `The equation is $${nums[0]}${axes.shape === "product-of-three" ? "\\times" : want[0] === "*" ? "\\times" : "+"}${nums[1]}${want[1] === "*" ? "\\times" : want[1] === "+" ? "+" : "-"}${nums[2]}=${total}$.`,
      ],
    });
  }),

  "delivery-operations-slots": entry(
    deliveryAxes,
    ({ meta, seed, r, axes }) => {
      const start = r(20, 60);
      const a = r(5, 30);
      const b = r(5, 30);
      const c = r(3, 25);
      let nums: number[];
      let want: string[];
      let story: string;
      if (axes.order === "add-add-subtract") {
        nums = [start, a, b, c];
        want = ["+", "+", "-"];
        story = `A flower shop has ${start} tulips. One farm delivers ${a} more, a second farm delivers ${b} more, and then ${c} tulips are sold. Choose the operations that find how many tulips are left.`;
      } else if (axes.order === "add-subtract-subtract") {
        nums = [start, a, b, c];
        want = ["+", "-", "-"];
        story = `A flower shop has ${start} tulips. A delivery adds ${a} more, then ${b} tulips are sold in the morning and ${c} more in the afternoon. Choose the operations that find how many tulips are left.`;
      } else {
        nums = [start + a + b, a, b, c];
        want = ["-", "+", "+"];
        story = `A flower shop has ${nums[0]} tulips. ${a} wilt and are thrown away, then two deliveries bring ${b} and ${c} more. Choose the operations that find how many tulips the shop has now.`;
      }
      const total = evaluate(nums, want);
      need(
        total > 0 && solutionsOf(nums, total).length === 1,
        "one set of operations",
      );
      const slots: Slot[] = want.map((op, i) => ({
        id: `op${i + 1}`,
        label: `The operation after ${nums[i]}`,
        correct: opTex[op]!,
        fixed: OPS,
      }));
      const built = inlineSentence([
        `$${nums[0]}$ `,
        slots[0]!,
        ` $${nums[1]}$ `,
        slots[1]!,
        ` $${nums[2]}$ `,
        slots[2]!,
        ` $${nums[3]}$ $=${total}$`,
      ]);
      return multiPartProblem(meta, seed, r, {
        prompt: story,
        layout: "inline",
        label: "Choose an operation for each gap",
        slots: built.slots,
        sentence: built.sentence,
        hint: `Start from ${nums[0]} tulips and read the story in order. For each number that follows, ask whether it adds tulips to the shop or takes them away.`,
        explanation: [
          `Read the story in order: ${want.map((op, i) => `${op === "+" ? "add" : "subtract"} ${nums[i + 1]}`).join(", ")}.`,
          `The equation is $${nums[0]}${want.map((op, i) => `${op}${nums[i + 1]}`).join("")}=${total}$.`,
        ],
      });
    },
  ),

  "table-equation-slots": entry(
    tableEquationAxes,
    ({ meta, seed, r, axes }) => {
      const a = r(2, 9);
      const b = r(1, 9);
      const minus = axes.shape === "minus";
      const n = axes.size === "five" ? 5 : 4;
      const start = minus ? r(2, 4) : r(1, 4);
      const step = r(1, 2);
      const xs = Array.from({ length: n }, (_, i) => start + i * step);
      const ys = xs.map((x) => a * x + (minus ? -b : b));
      need(ys.every((y) => y > 0) && b !== a, "a table of positive outputs");
      const slotsList = [
        slotOf("mult", "The number multiplied by $x$", String(a), [
          b,
          ys[0]!,
          xs[0]! + 1,
          a + b,
          ys[1]! - ys[0]!,
        ]),
        {
          id: "op",
          label: "The operation",
          correct: minus ? OPS[1] : OPS[0],
          fixed: [OPS[0], OPS[1]],
        } as Slot,
        slotOf("const", "The constant", String(b), [
          a,
          ys[0]!,
          xs[0]!,
          a + b,
          ys[0]! - a,
        ]),
      ];
      const built = inlineSentence([
        "$y=$ ",
        slotsList[0]!,
        " $x$ ",
        slotsList[1]!,
        " ",
        slotsList[2]!,
      ]);
      return multiPartProblem(meta, seed, r, {
        prompt:
          "The table shows pairs of $x$ and $y$ values that follow one equation. Complete the equation.",
        layout: "inline",
        label: "Choose a number or symbol for each gap",
        slots: built.slots,
        sentence: built.sentence,
        figure: tableFigure(
          [
            ["x", ...xs.map(String)],
            ["y", ...ys.map(String)],
          ],
          "Table of x and y values",
        ),
        hint: `${
          step === 1
            ? "When $x$ goes up by 1, look at how much $y$ goes up. Use that change to find the number multiplied by $x$,"
            : `When $x$ goes up by ${step}, $y$ goes up by ${ys[1]! - ys[0]!}. Use that to find the number multiplied by $x$,`
        } then use the first pair, $x = ${xs[0]}$ and $y = ${ys[0]}$, to find the constant.`,
        explanation: [
          `Each time $x$ increases by ${step}, $y$ increases by ${a * step}, so the multiplier is $${a * step}\\div ${step}=${a}$.`,
          `For $x=${xs[0]}$: $${a}\\cdot ${xs[0]}=${a * xs[0]!}$, and $y=${ys[0]}$, so the constant is ${minus ? "subtracted" : "added"}: ${b}.`,
          `The equation is $y=${a}x${minus ? "-" : "+"}${b}$, which fits every pair.`,
        ],
      });
    },
  ),

  "rule-table-fill-slots": entry(ruleFillAxes, ({ meta, seed, r, axes }) => {
    const k = axes.rule === "multiply" ? r(2, 9) : r(2, 15);
    const rule =
      axes.rule === "multiply"
        ? `y=${k}x`
        : axes.rule === "add"
          ? `y=x+${k}`
          : `y=x-${k}`;
    const forward = (x: number) =>
      axes.rule === "multiply" ? k * x : axes.rule === "add" ? x + k : x - k;
    const backward = (y: number) =>
      axes.rule === "multiply" ? y / k : axes.rule === "add" ? y - k : y + k;
    const base = axes.rule === "subtract" ? r(k + 1, k + 10) : r(1, 9);
    const xs = shuffle(
      r,
      Array.from(
        { length: 6 },
        (_, i) => base + i * (axes.rule === "multiply" ? 1 : 2),
      ),
    ).slice(0, 4);
    need(new Set(xs).size === 4, "four inputs");
    const ys = xs.map(forward);
    need(
      ys.every((y) => y > 0),
      "positive outputs",
    );
    // The first two columns hide y; the last two hide x.
    const header: string[][] = [
      ["x", ...xs.map((x, i) => (i < 2 ? String(x) : "?"))],
      ["y", ...ys.map((y, i) => (i < 2 ? "?" : String(y)))],
    ];
    const wrongForward = (x: number) =>
      axes.rule === "multiply"
        ? [x + k, x * (k + 1), k]
        : axes.rule === "add"
          ? [x - k, x * k, x + k + 1]
          : [x + k, x * k, x - k - 1];
    const slots: Slot[] = [
      ...[0, 1].map((i) =>
        slotOf(`y${i + 1}`, `$y$ when $x=${xs[i]}$`, String(ys[i]), [
          ...wrongForward(xs[i]!),
          xs[i]!,
          ys[i]! + 1,
        ]),
      ),
      ...[2, 3].map((i) =>
        slotOf(
          `x${i - 1}`,
          `$x$ when $y=${ys[i]}$`,
          String(xs[i]),
          [
            forward(ys[i]!),
            ys[i]! + k,
            ys[i]! - k,
            ys[i]!,
            xs[i]! + 1,
            xs[i]! - 1,
          ].filter((v) => v > 0),
        ),
      ),
    ];
    const first = xs[0]!;
    return multiPartProblem(meta, seed, r, {
      prompt: `Use the rule $${rule}$ to complete the table. Choose each missing value.`,
      layout: "slots",
      label: "Choose each missing value",
      slots,
      figure: tableFigure(header, `Table for the rule ${rule}`),
      hint: `To find $y$ for $x=${first}$, put ${first} into the rule $${rule}$. To find $x$ when $y$ is known, undo the rule with the opposite operation.`,
      explanation: [
        `For each missing $y$, put $x$ into $${rule}$: ${[0, 1].map((i) => `$x=${xs[i]}$ gives $y=${ys[i]}$`).join(", ")}.`,
        `For each missing $x$, undo the rule: ${[2, 3].map((i) => `$y=${ys[i]}$ gives $x=${xs[i]}$`).join(", ")}.`,
      ],
    });
  }),

  "unit-price-sentence-slots": entry(
    unitPriceAxes,
    ({ meta, seed, r, axes }) => {
      const [, item] = pick(r, PAIR_ITEMS);
      const count = r(3, 9);
      const cents = axes.amounts === "dollars-and-cents";
      const unit = cents ? r(150, 1250) : r(3, 24) * 100;
      need(!cents || unit % 100 !== 0, "a price with cents");
      const total = (unit * count) / 100;
      need(
        Number.isInteger(unit * count) &&
          total === Math.round(total * 100) / 100,
        "exact amounts",
      );
      const show = (n: number) => (cents ? n.toFixed(2) : String(n));
      const u = unit / 100;
      const money = (v: number) =>
        cents ? v.toFixed(2) : String(Math.round(v));
      const parts = [
        slotOf(
          "total",
          "The total cost in dollars",
          money(total),
          [u, total + count, total - u, total + 1].map(money),
        ),
        slotOf(
          "count",
          "The number of pairs",
          String(count),
          [count + 1, count - 1, count + 2, Math.round(u)].map(String),
        ),
        slotOf(
          "unit",
          "The price of one pair in dollars",
          money(u),
          [total, total / (count + 1), total / 2, u + 1].map(money),
        ),
      ];
      const built = inlineSentence([
        parts[0]!,
        " dollars $\\div$ ",
        parts[1]!,
        " pairs $=$ ",
        parts[2]!,
        " dollars per pair",
      ]);
      return multiPartProblem(meta, seed, r, {
        prompt: `${count} ${item} cost ${show(total)} dollars in all, and every pair costs the same. Complete the sentence that finds the price of one pair.`,
        layout: "inline",
        label: "Choose a number for each gap",
        slots: built.slots,
        sentence: built.sentence,
        hint: `The price of one pair is the ${show(total)} dollars shared equally among the ${count} pairs. Decide which number is divided and which number it is divided by.`,
        explanation: [
          `A unit price is the total cost divided by the number of items: ${show(total)} dollars $\\div$ ${count} pairs.`,
          `$${show(total)}\\div ${count}=${show(u)}$, so one pair costs ${show(u)} dollars.`,
        ],
      });
    },
  ),

  "cylinder-volume-slots": entry(cylinderAxes, ({ meta, seed, r, axes }) => {
    const radius = r(2, 12);
    const depth = r(2, 9);
    need(
      depth !== radius && depth !== 2 * radius && radius !== 2 * depth,
      "distinct measures",
    );
    const diameter = radius * 2;
    const shown = axes.given === "diameter" ? diameter : radius;
    const pool = [
      radius,
      diameter,
      depth,
      radius * 2 + depth,
      radius + depth,
      depth * 2,
    ];
    const parts = [
      slotOf("r1", "The first radius", String(radius), pool),
      slotOf("r2", "The second radius", String(radius), pool),
      slotOf("h", "The height", String(depth), pool),
    ];
    const built = inlineSentence([
      "$V=\\pi\\times$ ",
      parts[0]!,
      " $\\times$ ",
      parts[1]!,
      " $\\times$ ",
      parts[2]!,
    ]);
    return multiPartProblem(meta, seed, r, {
      prompt: `A round pool is ${shown} feet ${axes.given === "diameter" ? "across" : "from its center to its edge"} and ${depth} feet deep. Complete the equation for the volume $V$ of the pool in cubic feet.`,
      layout: "inline",
      label: "Choose a number for each gap",
      slots: built.slots,
      sentence: built.sentence,
      hint: `The base of the pool is a circle with area $\\pi r^2$. The pool is ${shown} feet ${axes.given === "diameter" ? "across" : "from center to edge"}: decide whether that length is the radius $r$ before you use it.`,
      explanation: [
        axes.given === "diameter"
          ? `${shown} feet is the distance across the circle, the diameter, so the radius is $${shown}\\div 2=${radius}$ feet.`
          : `${shown} feet is the radius.`,
        `The volume of a cylinder is the area of the base times the height: $V=\\pi\\times ${radius}\\times ${radius}\\times ${depth}$.`,
      ],
    });
  }),

  "dilation-rule-slots": entry(dilationAxes, ({ meta, seed, r, axes }) => {
    const enlarge = axes.scale === "enlargement";
    const k: [number, number] = enlarge ? [r(2, 5), 1] : [1, r(2, 4)];
    const x0 = enlarge ? r(1, 6) : r(1, 5) * k[1];
    const y0 = enlarge ? r(1, 6) : r(1, 5) * k[1];
    need(x0 !== y0, "different coordinates");
    const x1 = (x0 * k[0]) / k[1];
    const y1 = (y0 * k[0]) / k[1];
    const label = (n: number, d: number) =>
      d === 1 ? String(n) : `$${frac(n, d)}$`;
    const correct = label(k[0], k[1]);
    const pool = [
      label(k[1], k[0]),
      label(k[0] + 1, 1),
      label(k[0] * k[0], 1),
      label(-k[0], k[1]),
    ];
    const parts = [
      slotOf("kx", "The multiplier of $x$", correct, pool),
      slotOf("ky", "The multiplier of $y$", correct, pool),
    ];
    const built = inlineSentence([
      "$(x, y)\\to ($",
      parts[0]!,
      " $x,$ ",
      parts[1]!,
      " $y)$",
    ]);
    return multiPartProblem(meta, seed, r, {
      prompt: `A dilation centered at the origin takes the vertex $A(${x0}, ${y0})$ to its image $A'(${x1}, ${y1})$. Complete the rule of the dilation.`,
      layout: "inline",
      label: "Choose the multiplier for each coordinate",
      slots: built.slots,
      sentence: built.sentence,
      hint: `Compare the $x$-coordinate ${x0} of $A$ with the $x$-coordinate ${x1} of $A'$: by what number is ${x0} multiplied to get ${x1}? Check it on the $y$-coordinates.`,
      explanation: [
        `A dilation centered at the origin multiplies both coordinates by the scale factor $k$.`,
        `$${x1}\\div ${x0}$ and $${y1}\\div ${y0}$ both equal $${enlarge ? k[0] : frac(1, k[1])}$, so $k=${enlarge ? k[0] : frac(1, k[1])}$.`,
        `The rule is $(x, y)\\to(${enlarge ? k[0] : frac(1, k[1])}x, ${enlarge ? k[0] : frac(1, k[1])}y)$.`,
      ],
    });
  }),

  "transformation-rule-slots": entry(
    transformationAxes,
    ({ meta, seed, r, axes }) => {
      const count = axes.rows === "three" ? 3 : 2;
      // A reflection, a rotation, and (for three rows) one more of either kind.
      const reflections = shuffle(r, MOTIONS.slice(0, 3));
      const rotations = shuffle(r, MOTIONS.slice(3));
      const chosen =
        count === 2
          ? [reflections[0]!, rotations[0]!]
          : [
              reflections[0]!,
              rotations[0]!,
              r(0, 1) ? reflections[1]! : rotations[1]!,
            ];
      const bank = shuffle(
        r,
        [
          ...chosen.map((m) => m.rule),
          ...MOTIONS.map((m) => m.rule).filter(
            (x) => !chosen.some((c) => c.rule === x),
          ),
        ].slice(0, 5),
      );
      const probe = [r(2, 6), r(1, 5)] as const;
      need(probe[0] !== probe[1], "a test point off the line y = x");
      const slots: Slot[] = shuffle(r, [...chosen]).map((m, i) => ({
        id: `m${i + 1}`,
        label: `The rule for ${m.name}`,
        correct: m.rule,
        fixed: bank,
      }));
      return multiPartProblem(meta, seed, r, {
        prompt:
          "Each rule below turns a point $(x, y)$ into its image. Match each transformation to its rule.",
        layout: "slots",
        label: "Choose the rule for each transformation",
        slots,
        hint: `Test a point such as $(${probe[0]}, ${probe[1]})$. Where does ${slots[0]!.label.replace("The rule for ", "")} send it, and which rule gives that image?`,
        explanation: slots.map((s) => {
          const name = s.label.replace("The rule for ", "");
          return `${name[0]!.toUpperCase()}${name.slice(1)} gives $(x, y)\\to ${s.correct.replaceAll("$", "")}$.`;
        }),
      });
    },
  ),

  "exponent-quotient-slots": entry(quotientAxes, ({ meta, seed, r, axes }) => {
    const v = pick(r, VARS);
    const b = r(2, 6);
    const q = r(2, 5);
    const a = b * q;
    const m = r(2, 9);
    const n =
      axes.exponent === "negative" ? m + r(1, 6) : Math.max(1, m - r(1, 6));
    need(n !== m && a !== b, "different exponents");
    const e = m - n;
    const parts = [
      slotOf(
        "coef",
        "The coefficient",
        String(q),
        [a - b, a * b, b, a, q + 1].filter((x) => x > 0),
      ),
      slotOf(
        "exp",
        `The exponent of $${v}$`,
        sig(e),
        [n - m, m + n, m * n, m, n].map(sig),
      ),
    ];
    const built = inlineSentence([
      "The quotient equals a coefficient of ",
      parts[0]!,
      ` times $${v}$ raised to the exponent `,
      parts[1]!,
      ".",
    ]);
    return multiPartProblem(meta, seed, r, {
      prompt: `Write $\\dfrac{${a}${v}^{${m}}}{${b}${v}^{${n}}}$ in the form $c\\,${v}^{p}$ with a coefficient $c$ and an exponent $p$. Complete the sentence.`,
      layout: "inline",
      label: "Choose the coefficient and the exponent",
      slots: built.slots,
      sentence: built.sentence,
      hint: `Treat the coefficients ${a} and ${b} and the powers of $${v}$ separately. Divide ${a} by ${b}, and for the powers $${v}^{${m}}$ and $${v}^{${n}}$ subtract the exponents in the right order.`,
      explanation: [
        `Divide the coefficients: $${a}\\div ${b}=${q}$.`,
        `Divide the powers with the same base by subtracting exponents, numerator minus denominator: $${v}^{${m}}\\div ${v}^{${n}}=${v}^{${m}-${n}}=${v}^{${e}}$.`,
        `So the quotient is $${q}${v}^{${e}}$.`,
      ],
    });
  }),

  "square-root-solutions-slots": entry(
    squareRootAxes,
    ({ meta, seed, r, axes }) => {
      const h = r(1, 9);
      const k = pick(r, [3, 4, 5, 6, 7, 8, 9]);
      need(h !== k, "different numbers");
      const minus = axes.sign === "minus";
      const center = minus ? h : -h;
      const low = center - k;
      const high = center + k;
      const pool = [
        center - k,
        center + k,
        -center - k,
        -center + k,
        k,
        -k,
        k + h,
        h - k,
      ].map(sig);
      const sol = [
        slotOf("low", "The lesser solution", sig(low), pool),
        slotOf("high", "The greater solution", sig(high), pool),
      ];
      const built = inlineSentence(["$x=$ ", sol[0]!, " or $x=$ ", sol[1]!]);
      return multiPartProblem(meta, seed, r, {
        prompt: `Solve $(x ${minus ? "-" : "+"} ${h})^2 = ${k * k}$. Choose the lesser and the greater solution.`,
        layout: "inline",
        label: "Choose the two solutions",
        slots: built.slots,
        sentence: built.sentence,
        hint: `The square of $x ${minus ? "-" : "+"} ${h}$ is ${k * k}. Take the square root of both sides, remembering that there are two square roots of ${k * k}, then solve for $x$.`,
        explanation: [
          `Take the square root of both sides: $x ${minus ? "-" : "+"} ${h} = \\pm ${k}$.`,
          `Solve $x ${minus ? "-" : "+"} ${h} = ${k}$: $x=${high}$. Solve $x ${minus ? "-" : "+"} ${h} = -${k}$: $x=${low}$.`,
          `Check: $(${high} ${minus ? "-" : "+"} ${h})^2 = ${k * k}$ and $(${low} ${minus ? "-" : "+"} ${h})^2 = ${k * k}$.`,
        ],
      });
    },
  ),

  "function-shift-sentence": entry(shiftAxes, ({ meta, seed, r, axes }) => {
    const h = r(2, 9);
    const k = r(2, 9);
    need(h !== k, "different shifts");
    const right = axes.horizontal === "right";
    const up = axes.vertical === "up";
    const rule = `g(x)=f(x${right ? "-" : "+"}${h})${up ? "+" : "-"}${k}`;
    const parts = [
      {
        id: "hdir",
        label: "The horizontal direction",
        correct: right ? "right" : "left",
        fixed: ["left", "right"],
      } as Slot,
      slotOf("hamt", "The horizontal distance", String(h), [
        k,
        h + k,
        Math.abs(h - k),
        h + 1,
      ]),
      {
        id: "vdir",
        label: "The vertical direction",
        correct: up ? "up" : "down",
        fixed: ["up", "down"],
      } as Slot,
      slotOf("vamt", "The vertical distance", String(k), [
        h,
        h + k,
        Math.abs(h - k),
        k + 1,
      ]),
    ];
    const built = inlineSentence([
      "The graph of $g$ is the graph of $f$ shifted ",
      parts[0]!,
      " by ",
      parts[1]!,
      " units and ",
      parts[2]!,
      " by ",
      parts[3]!,
      " units.",
    ]);
    return multiPartProblem(meta, seed, r, {
      prompt: `The function $g$ is defined by $${rule}$. Describe how its graph is related to the graph of $f$.`,
      layout: "inline",
      label: "Choose a direction or a distance for each gap",
      slots: built.slots,
      sentence: built.sentence,
      hint: `In $${rule}$, the number inside the parentheses with $x$ moves the graph sideways, and the number added or subtracted outside moves it vertically. Look at the sign of ${h} and decide which way it moves the graph.`,
      explanation: [
        `A change inside the parentheses, $f(x ${right ? "-" : "+"} ${h})$, shifts the graph ${right ? "right" : "left"} by ${h}, opposite to the sign.`,
        `A change outside, $${up ? "+" : "-"}${k}$, shifts the graph ${up ? "up" : "down"} by ${k}.`,
      ],
    });
  }),
});
