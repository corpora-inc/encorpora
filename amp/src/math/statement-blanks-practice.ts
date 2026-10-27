import type { SemanticFigure, TemplateMetadata } from "./contracts";
import { lineTable } from "./scene/author";
import { defineAxis } from "./variation/axes";
import {
  defineGenerate,
  entry,
  frac,
  inlineSentence,
  multiPartCapability,
  multiPartProblem,
  need,
  pick,
  plain,
  shuffle,
  slotOf,
  type Slot,
} from "./multi-part-support";

/** Classify, match or complete with words and numbers (multi-part-choice-v1):
 * a match table whose rows each take one column, and sentences whose gaps
 * each take a term, a name or a number. */
const tables = { requiredFigureCapability: "scenes-v1" as const };
export const statementBlanksTemplates: readonly TemplateMetadata[] = [
  {
    id: "fixed-variable-expense-table",
    version: 1,
    title: "Which expenses change each month",
    skillId: "money-values",
    gradeBand: "3–5",
    ...multiPartCapability,
    description:
      "Mark each of four expenses as one that varies from month to month or one that stays the same, from three months of amounts or from the kind of expense.",
  },
  {
    id: "pythagorean-sort-table",
    version: 1,
    title: "Sort triangles by their sides",
    skillId: "pythagorean-theorem",
    gradeBand: "6–8",
    ...multiPartCapability,
    description:
      "Mark each set of three side lengths as a right triangle or not a right triangle, with sets that are scaled Pythagorean triples and near misses.",
  },
  {
    id: "congruence-claims-table",
    version: 1,
    title: "Which rules keep a figure congruent",
    skillId: "transformation-invariants",
    gradeBand: "9–12",
    ...multiPartCapability,
    description:
      "Mark each coordinate rule (translation, reflection, rotation, dilation, stretch or shear) as one that preserves congruence or one that does not.",
  },
  {
    id: "equivalent-expressions-table",
    version: 1,
    title: "Mark the equivalent expressions",
    skillId: "expression-properties",
    gradeBand: "6–8",
    ...multiPartCapability,
    description:
      "Mark each of four or five expressions as equivalent or not equivalent to a given expression that uses the identity or the associative property; exactly two are equivalent.",
  },
  {
    id: "gross-net-sentence",
    version: 1,
    title: "Gross pay and take-home pay",
    skillId: "decimal-arithmetic",
    gradeBand: "3–5",
    ...multiPartCapability,
    description:
      "Complete the statement that relates gross pay, taxes and deductions and take-home pay, in words or with amounts in dollars.",
  },
  {
    id: "coordinate-terms-slots",
    version: 1,
    title: "Name the parts of a coordinate plane",
    skillId: "coordinate-first-quadrant",
    gradeBand: "3–5",
    ...multiPartCapability,
    description:
      "Match three or four descriptions (the horizontal number line, the vertical number line, the point $(0, 0)$, the first number of a pair, the second number of a pair) to the terms axis, origin and coordinate.",
  },
  {
    id: "point-on-axis-sentence",
    version: 1,
    title: "Describe a point on an axis",
    skillId: "coordinate-first-quadrant",
    gradeBand: "3–5",
    ...multiPartCapability,
    description:
      "Complete a statement about a point with one coordinate 0: the axis it lies on, which coordinate is 0, how many units to move from the origin and in which direction.",
  },
  {
    id: "times-as-many-blanks",
    version: 1,
    title: "Compare counts with times as many",
    skillId: "multiplicative-comparison",
    gradeBand: "3–5",
    ...multiPartCapability,
    ...tables,
    description:
      "From a table of three counts, complete a sentence saying how many times as many of one item there are as another, or which item is more than twice as likely as which.",
  },
  {
    id: "compare-fractions-reason-blanks",
    version: 1,
    title: "Compare two fractions and say why",
    skillId: "fraction-comparison",
    gradeBand: "3–5",
    ...multiPartCapability,
    description:
      "Choose the greater of two fractions with the same numerator or the same denominator and the reason that makes it greater.",
  },
  {
    id: "inequality-number-blanks",
    version: 1,
    title: "Put numbers in two inequalities",
    skillId: "absolute-value",
    gradeBand: "6–8",
    ...multiPartCapability,
    description:
      "From a bank of four signed decimals and fractions, choose the one number that makes each of two inequalities true; each inequality has exactly one solution in the bank.",
  },
];

const tableFigure = (rows: string[][], title: string): SemanticFigure => ({
  kind: "scene",
  scene: lineTable(rows, { header: "row" }).scene({ title }),
});
const columnsOf = (a: string, b: string) => [a, b] as const;

/* ---------- expenses ---------- */
export const expenseAxes = {
  evidence: defineAxis("evidence", ["amounts-shown", "names-only"] as const),
} as const;
const FIXED_EXPENSES = [
  ["Rent", 650, 1200],
  ["Car payment", 220, 480],
  ["Insurance", 90, 210],
  ["Internet service", 45, 90],
  ["Phone plan", 30, 85],
] as const;
const VARIABLE_EXPENSES = [
  "Groceries",
  "Electricity",
  "Gasoline",
  "Water bill",
  "Eating out",
] as const;

/* ---------- Pythagorean ---------- */
export const pythagoreanAxes = {
  rows: defineAxis("rows", ["four", "five"] as const),
} as const;
const TRIPLES: readonly (readonly [number, number, number])[] = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
  [20, 21, 29],
  [9, 40, 41],
];

/* ---------- congruence ---------- */
export const congruenceAxes = {
  rows: defineAxis("rows", ["four", "five"] as const),
} as const;

/* ---------- equivalent expressions ---------- */
export const equivalentAxes = {
  property: defineAxis("property", ["identity", "associative"] as const),
  rows: defineAxis("rows", ["four", "five"] as const),
} as const;
type Expr = readonly [tex: string, value: (v: number) => number];
const IDENTITY_BASES: readonly {
  base: Expr;
  yes: readonly Expr[];
  no: readonly Expr[];
}[] = [
  {
    base: ["V\\cdot 1", (v) => v],
    yes: [
      ["V", (v) => v],
      ["1\\cdot V", (v) => v],
      ["(V\\cdot 1)\\cdot 1", (v) => v],
      ["V+0", (v) => v],
    ],
    no: [
      ["V+1", (v) => v + 1],
      ["V\\cdot V", (v) => v * v],
      ["1-V", (v) => 1 - v],
      ["2V", (v) => 2 * v],
      ["V-1", (v) => v - 1],
    ],
  },
  {
    base: ["1\\cdot(3V)", (v) => 3 * v],
    yes: [
      ["3V", (v) => 3 * v],
      ["3\\cdot V", (v) => 3 * v],
      ["V\\cdot 3", (v) => 3 * v],
      ["(1\\cdot 3)V", (v) => 3 * v],
    ],
    no: [
      ["3+V", (v) => 3 + v],
      ["V^3", (v) => v ** 3],
      ["3V+1", (v) => 3 * v + 1],
      ["4V", (v) => 4 * v],
      ["V\\div 3", (v) => v / 3],
    ],
  },
];
const ASSOCIATIVE_BASES: typeof IDENTITY_BASES = [
  {
    base: ["(2\\cdot V)\\cdot 3", (v) => 6 * v],
    yes: [
      ["6V", (v) => 6 * v],
      ["2\\cdot(V\\cdot 3)", (v) => 6 * v],
      ["V\\cdot 6", (v) => 6 * v],
      ["3\\cdot(2V)", (v) => 6 * v],
    ],
    no: [
      ["5V", (v) => 5 * v],
      ["2V+3", (v) => 2 * v + 3],
      ["V+6", (v) => v + 6],
      ["8V", (v) => 8 * v],
      ["6+V", (v) => 6 + v],
    ],
  },
  {
    base: ["(V+4)+5", (v) => v + 9],
    yes: [
      ["V+9", (v) => v + 9],
      ["V+(4+5)", (v) => v + 9],
      ["5+(V+4)", (v) => v + 9],
      ["9+V", (v) => v + 9],
    ],
    no: [
      ["9V", (v) => 9 * v],
      ["V+20", (v) => v + 20],
      ["V+1", (v) => v + 1],
      ["(V-4)+5", (v) => v + 1],
      ["V\\cdot 9", (v) => 9 * v],
    ],
  },
];

/* ---------- gross and net ---------- */
export const grossNetAxes = {
  form: defineAxis("form", ["definition", "amounts"] as const),
} as const;

/* ---------- coordinate terms ---------- */
export const coordinateTermAxes = {
  rows: defineAxis("rows", ["three", "four"] as const),
} as const;
const TERMS = [
  { term: "$x$-axis", says: "the horizontal number line of the plane" },
  { term: "$y$-axis", says: "the vertical number line of the plane" },
  { term: "origin", says: "the point $(0, 0)$ where the two axes cross" },
  { term: "$x$-coordinate", says: "the first number of an ordered pair" },
  { term: "$y$-coordinate", says: "the second number of an ordered pair" },
  { term: "ordered pair", says: "two numbers in order that name a point" },
] as const;

/* ---------- point on an axis ---------- */
export const pointOnAxisAxes = {
  axis: defineAxis("axis", ["on-x-axis", "on-y-axis"] as const),
} as const;

/* ---------- times as many ---------- */
export const timesAsManyAxes = {
  form: defineAxis("form", ["count-times", "more-than-twice"] as const),
} as const;
const ITEM_SETS = [
  ["cups", "mugs", "bottles"],
  ["plates", "bowls", "trays"],
  ["pens", "markers", "crayons"],
] as const;
const BOOK_TYPES = [
  ["mystery", "science", "poetry"],
  ["adventure", "history", "cooking"],
] as const;

/* ---------- comparing fractions ---------- */
export const compareReasonAxes = {
  basis: defineAxis("basis", ["same-numerator", "same-denominator"] as const),
} as const;
const REASONS = {
  "same-numerator": {
    right: "the pieces are larger when the denominator is smaller",
    wrong: [
      "a greater denominator makes a greater fraction",
      "the numerators are different",
      "it has more pieces",
    ],
  },
  "same-denominator": {
    right: "it has more pieces of the same size",
    wrong: [
      "the pieces are larger",
      "the denominators are different",
      "a greater denominator makes a greater fraction",
    ],
  },
} as const;

/* ---------- numbers in inequalities ---------- */
export const inequalityNumberAxes = {
  forms: defineAxis("forms", [
    "decimals-and-fractions",
    "mostly-fractions",
  ] as const),
} as const;

export const statementBlanksAxes = {
  "fixed-variable-expense-table": expenseAxes,
  "pythagorean-sort-table": pythagoreanAxes,
  "congruence-claims-table": congruenceAxes,
  "equivalent-expressions-table": equivalentAxes,
  "gross-net-sentence": grossNetAxes,
  "coordinate-terms-slots": coordinateTermAxes,
  "point-on-axis-sentence": pointOnAxisAxes,
  "times-as-many-blanks": timesAsManyAxes,
  "compare-fractions-reason-blanks": compareReasonAxes,
  "inequality-number-blanks": inequalityNumberAxes,
} as const;

/** Rows of a match table: each row picks one of the shared columns. */
function tableSlots(
  rows: readonly { label: string; column: string }[],
  columns: readonly [string, string],
): Slot[] {
  return rows.map((row, i) => ({
    id: `r${i + 1}`,
    label: row.label,
    correct: row.column,
    fixed: columns,
  }));
}

export const statementBlanksGenerate = defineGenerate(
  statementBlanksTemplates,
  {
    "fixed-variable-expense-table": entry(
      expenseAxes,
      ({ meta, seed, r, axes }) => {
        const varying = r(1, 3);
        const fixed = shuffle(r, [...FIXED_EXPENSES]).slice(0, 4 - varying);
        const variable = shuffle(r, [...VARIABLE_EXPENSES]).slice(0, varying);
        const months = ["Jan", "Feb", "Mar"];
        const rows = shuffle(r, [
          ...fixed.map(([name, lo, hi]) => ({
            name,
            vary: false,
            amounts: [r(lo, hi)],
          })),
          ...variable.map((name) => ({
            name,
            vary: true,
            amounts: [r(40, 400), r(40, 400), r(40, 400)],
          })),
        ]).map((row) => {
          const amounts = row.vary
            ? row.amounts
            : [row.amounts[0]!, row.amounts[0]!, row.amounts[0]!];
          return { ...row, amounts };
        });
        for (const row of rows)
          if (row.vary)
            need(new Set(row.amounts).size === 3, "three different amounts");
        const cols = columnsOf("Varies", "Stays the same");
        const shown = axes.evidence === "amounts-shown";
        const slots = tableSlots(
          rows.map((row) => ({
            label: shown
              ? `${row.name}: ${row.amounts.map((a, i) => `${months[i]} ${a}`).join(", ")}`
              : row.name,
            column: row.vary ? cols[0] : cols[1],
          })),
          cols,
        );
        const first = rows[0]!;
        return multiPartProblem(meta, seed, r, {
          prompt: shown
            ? "A family records what it spends each month, in dollars. Mark each expense as one that varies from month to month or one that stays the same."
            : "Mark each expense as one that varies from month to month or one that stays the same.",
          layout: "table",
          label: "Choose one column in each row",
          rowHeader: "Expense",
          slots,
          hint: shown
            ? `Compare the amounts for ${first.name}: ${first.amounts.map((a, i) => `${months[i]} ${a}`).join(", ")}. An expense changes from month to month when its amounts are not all alike.`
            : `Ask whether the bill for ${first.name} is a set amount agreed in advance or depends on how much is used or bought each month.`,
          explanation: rows.map((row) =>
            shown
              ? `${row.name}: ${row.amounts.join(", ")} ${row.vary ? "are not all the same, so it varies" : "are all the same, so it stays the same"}.`
              : `${row.name} ${row.vary ? "depends on how much is used or bought each month, so it varies" : "is a set amount each month, so it stays the same"}.`,
          ),
        });
      },
    ),

    "pythagorean-sort-table": entry(
      pythagoreanAxes,
      ({ meta, seed, r, axes }) => {
        const count = axes.rows === "five" ? 5 : 4;
        const right = r(1, count - 1);
        const chosen = shuffle(r, [...TRIPLES]).slice(0, count);
        const sets = chosen.map((t, i) => {
          const k = pick(r, [1, 2, 3]);
          const [a, b, c] = t.map((v) => v * (t[0] > 9 ? 1 : k)) as [
            number,
            number,
            number,
          ];
          if (i < right)
            return {
              sides: [a, b, c] as [number, number, number],
              right: true,
            };
          const slip = pick(r, [-2, -1, 1, 2]);
          return {
            sides: [a, b, c + slip] as [number, number, number],
            right: false,
          };
        });
        for (const s of sets) {
          const [a, b, c] = s.sides;
          need(
            (a * a + b * b === c * c) === s.right &&
              c > Math.max(a, b) &&
              a + b > c,
            "a valid triangle",
          );
        }
        const cols = columnsOf("Right triangle", "Not a right triangle");
        const rows = shuffle(r, sets);
        const first = rows[0]!.sides;
        return multiPartProblem(meta, seed, r, {
          prompt:
            "Each row gives the three side lengths of a triangle. Mark each triangle as a right triangle or not a right triangle.",
          layout: "table",
          label: "Choose one column in each row",
          rowHeader: "Side lengths",
          slots: tableSlots(
            rows.map((s) => ({
              label: s.sides.join(", "),
              column: s.right ? cols[0] : cols[1],
            })),
            cols,
          ),
          hint: `For the sides ${first.join(", ")}, square the two shorter sides and add the squares, then square the longest side and compare the two results.`,
          explanation: rows.map((s) => {
            const [a, b, c] = s.sides;
            return `${s.sides.join(", ")}: $${a}^2+${b}^2=${a * a + b * b}$ and $${c}^2=${c * c}$, which are ${s.right ? "equal, so it is a right triangle" : "not equal, so it is not a right triangle"}.`;
          }),
        });
      },
    ),

    "congruence-claims-table": entry(
      congruenceAxes,
      ({ meta, seed, r, axes }) => {
        const count = axes.rows === "five" ? 5 : 4;
        const s = () => pick(r, [2, 3, 4]);
        const keep: [string, string][] = [
          [`(x + ${s()}, y - ${s()})`, "a translation"],
          ["(x, -y)", "a reflection"],
          ["(-x, y)", "a reflection"],
          ["(y, x)", "a reflection"],
          ["(-x, -y)", "a rotation"],
          ["(-y, x)", "a rotation"],
        ];
        const k = s();
        const lose: [string, string][] = [
          [`(${k}x, ${k}y)`, "a dilation"],
          [`(x, ${k}y)`, "a stretch"],
          [`(${k}x, y)`, "a stretch"],
          ["(x + y, y)", "a shear"],
        ];
        const nLose = r(1, count - 1);
        const picked = [
          ...shuffle(r, keep)
            .slice(0, count - nLose)
            .map(([rule, kind]) => ({ rule, kind, keeps: true })),
          ...shuffle(r, lose)
            .slice(0, nLose)
            .map(([rule, kind]) => ({ rule, kind, keeps: false })),
        ];
        const rows = shuffle(r, picked);
        const cols = columnsOf("Preserves congruence", "Does not preserve");
        const first = rows[0]!;
        return multiPartProblem(meta, seed, r, {
          prompt:
            "Each rule turns a point $(x, y)$ of a figure into a point of its image. Mark each rule as one that always gives a congruent image or one that does not.",
          layout: "table",
          label: "Choose one column in each row",
          rowHeader: "Rule",
          slots: tableSlots(
            rows.map((row) => ({
              label: `$(x, y)\\to ${row.rule}$`,
              column: row.keeps ? cols[0] : cols[1],
            })),
            cols,
          ),
          hint: `Test the rule $(x, y)\\to ${first.rule}$ on two points such as $(0, 0)$ and $(1, 0)$ and compare the distance between them with the distance between their images.`,
          explanation: rows.map(
            (row) =>
              `$(x, y)\\to ${row.rule}$ is ${row.kind}, which ${row.keeps ? "keeps every distance and angle, so the image is congruent" : "changes distances, so the image is not congruent"}.`,
          ),
        });
      },
    ),

    "equivalent-expressions-table": entry(
      equivalentAxes,
      ({ meta, seed, r, axes }) => {
        const count = axes.rows === "five" ? 5 : 4;
        const v = pick(r, ["x", "n", "w", "p"]);
        const { base, yes, no } = pick(
          r,
          axes.property === "identity" ? IDENTITY_BASES : ASSOCIATIVE_BASES,
        );
        const rowsSrc = [
          ...shuffle(r, [...yes])
            .slice(0, 2)
            .map((e) => ({ e, equivalent: true })),
          ...shuffle(r, [...no])
            .slice(0, count - 2)
            .map((e) => ({ e, equivalent: false })),
        ];
        // Verify the truth of every row from the values of the expressions.
        for (const row of rowsSrc) {
          const same = [2, 3, 5, -1].every(
            (t) => Math.abs(row.e[1](t) - base[1](t)) < 1e-9,
          );
          need(same === row.equivalent, "a correctly labeled row");
        }
        const rows = shuffle(r, rowsSrc);
        const tex = (e: Expr) => e[0].replaceAll("V", v);
        const cols = columnsOf("Equivalent", "Not equivalent");
        return multiPartProblem(meta, seed, r, {
          prompt: `Mark each expression as equivalent or not equivalent to $${tex(base)}$.`,
          layout: "table",
          label: "Choose one column in each row",
          rowHeader: "Expression",
          slots: tableSlots(
            rows.map((row) => ({
              label: `$${tex(row.e)}$`,
              column: row.equivalent ? cols[0] : cols[1],
            })),
            cols,
          ),
          hint: `${axes.property === "identity" ? "Multiplying by 1 or adding 0 does not change a value." : "Regrouping a product or a sum does not change its value."} Simplify $${tex(base)}$ first, then try the same value, such as $${v} = 3$, in each row.`,
          explanation: [
            `Simplify the given expression: $${tex(base)}$ equals $${tex([...rows].filter((x) => x.equivalent).sort((p, q) => p.e[0].length - q.e[0].length)[0]!.e)}$ for every value of $${v}$.`,
            ...rows.map(
              (row) =>
                `$${tex(row.e)}$ ${row.equivalent ? "has the same value as" : "does not always have the same value as"} $${tex(base)}$. Try $${v} = 3$: ${plain(row.e[1](3))} and ${plain(base[1](3))}.`,
            ),
          ],
        });
      },
    ),

    "gross-net-sentence": entry(grossNetAxes, ({ meta, seed, r, axes }) => {
      if (axes.form === "definition") {
        const slots = [
          {
            id: "when",
            label: "When gross pay is counted",
            correct: "before",
            fixed: ["before", "after"],
          } as Slot,
          {
            id: "op",
            label: "How take-home pay is found",
            correct: "minus",
            fixed: ["minus", "plus"],
          } as Slot,
        ];
        const built = inlineSentence([
          "Gross pay is the money earned ",
          slots[0]!,
          " taxes and deductions are taken out. Take-home pay is gross pay ",
          slots[1]!,
          " taxes and deductions.",
        ]);
        return multiPartProblem(meta, seed, r, {
          prompt: "Complete the statement about gross pay and take-home pay.",
          layout: "inline",
          label: "Choose a word for each gap",
          slots: built.slots,
          sentence: built.sentence,
          hint: "Think about a paycheck: the total a worker earned is larger than the money the worker actually receives. Ask what is taken out of the larger amount to reach the smaller one.",
          explanation: [
            "Gross pay is all the money earned, counted before anything is taken out.",
            "Taxes and deductions are taken out of gross pay, so take-home pay is gross pay minus taxes and deductions.",
          ],
        });
      }
      const gross = r(40, 120) * 10;
      const tax = r(5, 18) * 10;
      const other = r(2, 9) * 10;
      need(tax !== other && gross - tax - other > 0, "different amounts");
      const out = tax + other;
      const net = gross - out;
      const built = inlineSentence([
        "Taxes and deductions together take out ",
        slotOf("out", "The total taken out in dollars", out, [
          gross,
          tax,
          other,
          gross - tax,
          net,
        ]),
        " dollars, so take-home pay is ",
        slotOf("net", "The take-home pay in dollars", net, [
          gross + out,
          gross - tax,
          gross - other,
          out,
          gross,
        ]),
        " dollars.",
      ]);
      return multiPartProblem(meta, seed, r, {
        prompt: `A worker has gross pay of ${gross} dollars. Taxes are ${tax} dollars and other deductions are ${other} dollars. Complete the sentence.`,
        layout: "inline",
        label: "Choose a number for each gap",
        slots: built.slots,
        sentence: built.sentence,
        hint: `Add the taxes, ${tax} dollars, and the other deductions, ${other} dollars, to see everything that is taken out. Then compare that with the gross pay of ${gross} dollars.`,
        explanation: [
          `Taxes and deductions together: $${tax}+${other}=${out}$ dollars.`,
          `Take-home pay is gross pay minus what is taken out: $${gross}-${out}=${net}$ dollars.`,
        ],
      });
    }),

    "coordinate-terms-slots": entry(
      coordinateTermAxes,
      ({ meta, seed, r, axes }) => {
        const count = axes.rows === "four" ? 4 : 3;
        const picked = shuffle(r, [...TERMS]).slice(0, count);
        const extra = shuffle(
          r,
          TERMS.filter((t) => !picked.includes(t)),
        ).slice(0, 6 - count > 2 ? 2 : 1);
        const bank = shuffle(
          r,
          [...picked, ...extra].map((t) => t.term),
        );
        const slots: Slot[] = picked.map((t, i) => ({
          id: `t${i + 1}`,
          label: `The term for ${t.says}`,
          correct: t.term,
          fixed: bank,
        }));
        return multiPartProblem(meta, seed, r, {
          prompt:
            "Match each description of a part of a coordinate plane to its name.",
          layout: "slots",
          label: "Choose the term for each description",
          slots,
          hint: `Picture the coordinate plane. For ${picked[0]!.says}, ask whether it is a line, a point or a number, and which direction it runs.`,
          explanation: picked.map(
            (t) =>
              `${t.says[0]!.toUpperCase()}${t.says.slice(1)} is the ${t.term}.`,
          ),
        });
      },
    ),

    "point-on-axis-sentence": entry(
      pointOnAxisAxes,
      ({ meta, seed, r, axes }) => {
        const n = r(2, 20);
        const onX = axes.axis === "on-x-axis";
        const point = onX ? `(${n}, 0)` : `(0, ${n})`;
        const built = inlineSentence([
          `The point $${point}$ lies on the `,
          {
            id: "axis",
            label: "The axis the point lies on",
            correct: onX ? "$x$-axis" : "$y$-axis",
            fixed: ["$x$-axis", "$y$-axis"],
          } as Slot,
          " because its ",
          {
            id: "which",
            label: "The coordinate that is 0",
            correct: onX ? "second" : "first",
            fixed: ["first", "second"],
          } as Slot,
          " coordinate is 0. To reach it from the origin, move ",
          slotOf("units", "The number of units to move", n, [
            0,
            n + 1,
            n - 1,
            n * 2,
          ]),
          " units ",
          {
            id: "dir",
            label: "The direction to move",
            correct: onX ? "right" : "up",
            fixed: ["right", "up"],
          } as Slot,
          ".",
        ]);
        return multiPartProblem(meta, seed, r, {
          prompt: `Complete the statement about the point $${point}$ in the coordinate plane.`,
          layout: "inline",
          label: "Choose a word or number for each gap",
          slots: built.slots,
          sentence: built.sentence,
          hint: `The numbers of $${point}$ are written in the order across, then up from the origin. Decide which of the two numbers is ${n} and which is 0.`,
          explanation: [
            `In $${point}$, the ${onX ? "first" : "second"} coordinate is ${n} and the ${onX ? "second" : "first"} is 0.`,
            onX
              ? `A point with $y=0$ is on the $x$-axis, and the first coordinate ${n} says to move ${n} units right from the origin.`
              : `A point with $x=0$ is on the $y$-axis, and the second coordinate ${n} says to move ${n} units up from the origin.`,
          ],
        });
      },
    ),

    "times-as-many-blanks": entry(
      timesAsManyAxes,
      ({ meta, seed, r, axes }) => {
        if (axes.form === "count-times") {
          const names = shuffle(r, [...pick(r, ITEM_SETS)]);
          const k = r(2, 6);
          const small = r(2, 9);
          const counts = [small, small * k, 0];
          counts[2] = r(2, 40);
          need(
            !counts.slice(0, 2).includes(counts[2]!),
            "three different counts",
          );
          need(
            counts[2]! % small !== 0 &&
              (small * k) % counts[2]! !== 0 &&
              counts[2]! % (small * k) !== 0 &&
              (small * k) % counts[2]! !== 0,
            "one whole-number comparison",
          );
          const pairs = names.flatMap((a, i) =>
            names.flatMap((b, j) =>
              i !== j &&
              counts[i]! % counts[j]! === 0 &&
              counts[i]! / counts[j]! >= 2
                ? [[a, b]]
                : [],
            ),
          );
          need(pairs.length === 1, "one pair of items");
          const [bigName, smallName] = pairs[0]!;
          const shuffled = shuffle(
            r,
            names.map((n, i) => ({ n, c: counts[i]! })),
          );
          const built = inlineSentence([
            "There are ",
            slotOf(
              "k",
              "How many times as many",
              k,
              [k + 1, k - 1, small * k - small, small, 2].filter((x) => x >= 2),
            ),
            " times as many ",
            {
              id: "big",
              label: "The item there are more of",
              correct: bigName!,
              fixed: shuffled.map((x) => x.n),
            } as Slot,
            " as ",
            {
              id: "small",
              label: "The item there are fewer of",
              correct: smallName!,
              fixed: shuffled.map((x) => x.n),
            } as Slot,
            ".",
          ]);
          return multiPartProblem(meta, seed, r, {
            prompt:
              "The table shows how many of each item a class collected. Complete the sentence.",
            layout: "inline",
            label: "Choose a number or an item for each gap",
            slots: built.slots,
            sentence: built.sentence,
            figure: tableFigure(
              [
                ["Item", ...shuffled.map((x) => x.n)],
                ["Count", ...shuffled.map((x) => String(x.c))],
              ],
              "Counts of three items",
            ),
            hint: `Look for a count that is a whole number of times another count. Try dividing the greater counts, such as ${Math.max(...counts)}, by the lesser ones.`,
            explanation: [
              `$${small * k}\\div ${small}=${k}$, so the count of ${bigName} is ${k} times the count of ${smallName}.`,
              `The third count, ${counts[2]}, is not a whole number of times either of the others.`,
            ],
          });
        }
        const names = shuffle(r, [...pick(r, BOOK_TYPES)]);
        let counts: number[] = [];
        let pair: [number, number] | null = null;
        for (let attempt = 0; attempt < 200 && !pair; attempt++) {
          counts = names.map(() => r(6, 40));
          if (new Set(counts).size !== 3) continue;
          const hits: [number, number][] = [];
          counts.forEach((a, i) =>
            counts.forEach((b, j) => i !== j && a > 2 * b && hits.push([i, j])),
          );
          if (hits.length === 1) pair = hits[0]!;
        }
        need(pair !== null, "one pair more than twice as likely");
        const [bi, si] = pair!;
        const total = counts.reduce((s, c) => s + c, 0);
        const built = inlineSentence([
          {
            id: "more",
            label: "The type that is more likely",
            correct: names[bi]!,
            fixed: names,
          } as Slot,
          " books are more than twice as likely to be chosen as ",
          {
            id: "less",
            label: "The type that is less likely",
            correct: names[si]!,
            fixed: names,
          } as Slot,
          " books.",
        ]);
        return multiPartProblem(meta, seed, r, {
          prompt: `A shelf has ${total} books, and one book is chosen at random. The table shows how many books there are of each type. Complete the sentence.`,
          layout: "inline",
          label: "Choose a book type for each gap",
          slots: built.slots,
          sentence: built.sentence,
          figure: tableFigure(
            [
              ["Type", ...names],
              ["Books", ...counts.map(String)],
            ],
            "Books of each type",
          ),
          hint: `Of the ${total} books, a type is more than twice as likely as another when its count is more than double the other count. Double ${Math.min(...counts)}, the least count, and compare it with the other counts.`,
          explanation: [
            `The chance of a type is proportional to its count, so compare counts: ${names.map((n, i) => `${n} ${counts[i]}`).join(", ")}.`,
            `${counts[bi]} is more than $2\\times ${counts[si]}=${2 * counts[si]!}$, and no other pair of counts has this property.`,
          ],
        });
      },
    ),

    "compare-fractions-reason-blanks": entry(
      compareReasonAxes,
      ({ meta, seed, r, axes }) => {
        const same = axes.basis === "same-numerator";
        let first: [number, number];
        let second: [number, number];
        if (same) {
          const n = r(1, 5);
          const d1 = r(n + 1, 9);
          const d2 = r(n + 1, 9);
          need(d1 !== d2, "different denominators");
          first = [n, d1];
          second = [n, d2];
        } else {
          const den = r(7, 12);
          const n1 = r(1, den - 2);
          const n2 = r(1, den - 1);
          need(n1 !== n2, "different numerators");
          first = [n1, den];
          second = [n2, den];
        }
        const bigger =
          first[0] * second[1] > second[0] * first[1] ? first : second;
        const tex = (f: [number, number]) => `$${frac(f[0], f[1])}$`;
        const reasons = REASONS[axes.basis];
        const built = inlineSentence([
          "",
          {
            id: "bigger",
            label: "The greater fraction",
            correct: tex(bigger),
            fixed: [tex(first), tex(second)],
          } as Slot,
          " is the greater fraction because ",
          {
            id: "why",
            label: "The reason",
            correct: reasons.right,
            wrong: reasons.wrong,
            max: 4,
          } as Slot,
          ".",
        ]);
        return multiPartProblem(meta, seed, r, {
          prompt: `Compare ${tex(first)} and ${tex(second)}. Complete the sentence.`,
          layout: "inline",
          label: "Choose the fraction and the reason",
          slots: built.slots,
          sentence: built.sentence,
          hint: same
            ? `Both fractions have the numerator ${first[0]}, so each has the same number of pieces. Compare the size of the pieces made by the denominators ${first[1]} and ${second[1]}.`
            : `Both fractions have the denominator ${first[1]}, so their pieces are the same size. Compare how many pieces each fraction has: ${first[0]} and ${second[0]}.`,
          explanation: same
            ? [
                `Both fractions have ${first[0]} piece${first[0] === 1 ? "" : "s"}, but the whole is cut into ${first[1]} equal parts in one and ${second[1]} in the other.`,
                `A smaller denominator cuts the whole into larger pieces, so ${tex(bigger)} is the greater fraction.`,
              ]
            : [
                `Both fractions are made of pieces of size $${frac(1, first[1])}$.`,
                `${tex(bigger)} has more of these pieces, so it is the greater fraction.`,
              ],
        });
      },
    ),

    "inequality-number-blanks": entry(
      inequalityNumberAxes,
      ({ meta, seed, r, axes }) => {
        type Num = { tex: string; value: number };
        const decimals: Num[] = [
          -1.5, -1.2, -0.8, -0.6, -0.4, -0.25, 0.3, 0.5, 0.75, 1.2,
        ].map((v) => ({ tex: String(v), value: v }));
        const fractions: Num[] = [
          [-3, 2],
          [-5, 4],
          [-3, 4],
          [-1, 2],
          [-2, 5],
          [-1, 4],
          [1, 4],
          [2, 5],
          [3, 4],
          [5, 4],
        ].map(([n, d]) => ({ tex: frac(n!, d!), value: n! / d! }));
        const pool = shuffle(
          r,
          axes.forms === "mostly-fractions"
            ? [...fractions, ...decimals.slice(0, 3)]
            : [...decimals, ...fractions],
        );
        const bank: Num[] = [];
        for (const item of pool)
          if (bank.every((b) => Math.abs(b.value - item.value) > 1e-9))
            bank.push(item);
        const four = bank.slice(0, 4);
        need(
          four.some((x) => x.tex.includes("frac")) &&
            four.some((x) => !x.tex.includes("frac")),
          "decimals and fractions together",
        );
        const sorted = [...four].sort((a, b) => a.value - b.value);
        const [b1, b2, b3, b4] = sorted as [Num, Num, Num, Num];
        const labels = shuffle(
          r,
          four.map((x) => `$${x.tex}$`),
        );
        const built = inlineSentence([
          "First statement: ",
          {
            id: "less",
            label: "The number for the first statement",
            correct: `$${b1.tex}$`,
            fixed: labels,
          } as Slot,
          ` $<${b2.tex}$. Second statement: `,
          {
            id: "more",
            label: "The number for the second statement",
            correct: `$${b4.tex}$`,
            fixed: labels,
          } as Slot,
          ` $>${b3.tex}$.`,
        ]);
        return multiPartProblem(meta, seed, r, {
          prompt:
            "Choose a number from the bank to make each inequality true. Each statement has exactly one number that works.",
          layout: "inline",
          label: "Choose a number for each statement",
          slots: built.slots,
          sentence: built.sentence,
          hint: `Compare each bank number with $${b2.tex}$ for the first statement: only one number is to the left of it on the number line. For the second statement, compare with $${b3.tex}$ and look to the right.`,
          explanation: [
            `In order from least to greatest the numbers are $${sorted.map((x) => x.tex).join("<")}$.`,
            `Only $${b1.tex}$ is less than $${b2.tex}$ among the numbers in the bank, so it fills the first statement.`,
            `Only $${b4.tex}$ is greater than $${b3.tex}$, so it fills the second statement.`,
          ],
        });
      },
    ),
  },
);
