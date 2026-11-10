import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import { random, shuffle } from "./distribution-practice";
import { counterThings } from "./counter-builder";
import { counterObjectPaths } from "./counter-objects";
import { scene } from "./scene/author";
import type { Element, PathOp } from "./scene/spec";
import {
  equalAddendsGuessChance,
  type EqualAddendsResponse,
  type EqualAddendsAnswer,
} from "./equal-addends";

export const equalAddendsTemplates: readonly TemplateMetadata[] = [
  {
    id: "array-equal-addends-equation",
    version: 1,
    title: "Build an array and its addition sentence",
    skillId: "arrays",
    gradeBand: "K–2",
    description:
      "Build or group arrays up to 5 by 5 and write their totals as sums of equal addends.",
    requiredResponseCapability: "equal-addends-v1",
    fallbackCapabilities: { response: "single-choice-v1", figure: "scenes-v1" },
  },
];
export const equalAddendsVariants = [
  "rows-or-columns",
  "square",
  "by-columns",
  "build-array",
] as const;
export const equalAddendsEquation = (
  a: Pick<EqualAddendsAnswer, "addends" | "total">,
) => `${a.addends.join(" + ")} = ${a.total}`;

/** The same friendly silhouettes as the interactive counter board, for lessons,
 * worksheets and clients using the choice fallback. */
export function equalAddendsScene(
  thing: EqualAddendsResponse["thing"],
  rows: number,
  columns: number,
) {
  const elements: Element[] = [];
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < columns; column++) {
      counterObjectPaths[thing].forEach((ops, i) =>
        elements.push({
          type: "path",
          d: ops.map(
            (op) =>
              [
                op[0],
                ...op
                  .slice(1)
                  .map((v, index) =>
                    index % 2 === 0
                      ? column * 44 + Number(v)
                      : -row * 44 - Number(v),
                  ),
              ] as PathOp,
          ),
          fill: i ? "none" : "accent",
          stroke: "ink",
          width: 1.4,
        }),
      );
    }
  return scene(...elements).build({
    width: 280,
    maxHeight: 240,
    title: `${rows} rows of ${columns} ${thing}s`,
  });
}
export function generateEqualAddends(
  _id: string,
  seed: string,
): GeneratedProblem {
  const meta = equalAddendsTemplates[0]!,
    rand = random(meta.id, seed);
  const variant = equalAddendsVariants[rand(0, 3)]!;
  const rows = rand(2, 5);
  let columns = rows;
  if (variant !== "square") {
    const other = [2, 3, 4, 5].filter((n) => n !== rows);
    columns = other[rand(0, other.length - 1)]!;
  }
  const thing = counterThings[rand(0, counterThings.length - 1)]!;
  const config = {
    mode: variant === "build-array" ? ("build" as const) : ("given" as const),
    orientation:
      variant === "by-columns" ? ("columns" as const) : ("either" as const),
    ...(variant === "build-array" ? {} : { rows, columns }),
  };
  const response: EqualAddendsResponse = {
    kind: "equal-addends",
    label: "Build the addition sentence",
    thing,
    ...config,
    maxAddends: 5,
    guessChance: equalAddendsGuessChance(config),
  };
  const byColumns = variant === "by-columns";
  const count = byColumns ? columns : rows,
    addend = byColumns ? rows : columns;
  const a: EqualAddendsAnswer = {
    rows,
    columns,
    addends: Array(count).fill(addend),
    total: rows * columns,
  };
  const unit = byColumns ? "column" : "row";
  const other = {
    addends: Array(byColumns ? rows : columns).fill(byColumns ? columns : rows),
    total: a.total,
  };
  return {
    public: {
      id: createHash("sha256").update(`${meta.id}:1:${seed}`).digest("hex"),
      templateId: meta.id,
      templateVersion: 1,
      seed,
      skillId: "arrays",
      response,
      prompt:
        variant === "build-array"
          ? `Arrange ${thing}s in ${rows} rows with ${columns} in each row. Build the array and an addition sentence for the total.`
          : byColumns
            ? `This array has ${columns} columns. Add the columns. Build an addition sentence for the total number of ${thing}s.`
            : `This array has ${rows} rows. Add the rows or the columns. Build an addition sentence for the total number of ${thing}s.`,
    },
    answer: JSON.stringify(a),
    variant: { id: variant },
    hint: byColumns
      ? `There are ${columns} columns. A column goes down. Count one column, then use that number for each column.`
      : `There are ${rows} rows. A row goes across. Count one row, then use that number for each row.`,
    explanation: [
      `An array has equal rows going across and equal columns going down. Here it has ${rows} rows of ${columns}.`,
      `Each ${unit} has ${addend} ${thing}s. An addend is a number being added, so each addend is ${addend}.`,
      `There are ${count} ${unit}s, so write ${count} addends. Add one ${unit} at a time: ${Array.from({ length: count }, (_, i) => (i + 1) * addend).join(", ")}.`,
      `$${equalAddendsEquation(a)}$. The equals sign means both sides name the same amount.`,
      ...(rows !== columns
        ? [
            `The other direction gives $${equalAddendsEquation(other)}$. It counts the same ${a.total} objects.${byColumns ? " This prompt asks for columns." : " Either direction works here."}`,
          ]
        : []),
    ],
    walkthrough: equalAddendsScene(thing, rows, columns),
  };
}
/** Preserve the story and array when an older client needs four equations. */
export function generateEqualAddendsFallback(seed: string): GeneratedProblem {
  const p = generateEqualAddends("array-equal-addends-equation", seed);
  const r = p.public.response as EqualAddendsResponse,
    a = JSON.parse(p.answer) as EqualAddendsAnswer;
  const value = a.addends[0]!,
    count = a.addends.length,
    wrongCount = count === 5 ? 4 : count + 1;
  const options = shuffle(random("equal-addends-fallback", seed), [
    { label: `$${equalAddendsEquation(a)}$`, correct: true },
    {
      label: `$${equalAddendsEquation({ addends: Array(wrongCount).fill(value), total: value * wrongCount })}$`,
    },
    { label: `$${equalAddendsEquation({ ...a, total: a.total - 1 })}$` },
    {
      label: `$${equalAddendsEquation({ addends: Array(count).fill(value === 5 ? 4 : value + 1), total: count * (value === 5 ? 4 : value + 1) })}$`,
    },
  ]);
  return {
    ...p,
    public: {
      ...p.public,
      id: createHash("sha256").update(`${p.public.id}:choice`).digest("hex"),
      prompt: `${r.mode === "build" ? `The ${r.thing}s are arranged in ${a.rows} rows with ${a.columns} in each row.` : `This array has ${a.rows} rows and ${a.columns} columns.`} ${r.orientation === "columns" ? "Add the columns. " : ""}Which addition sentence gives the total?`,
      figure: {
        kind: "scene",
        scene: equalAddendsScene(r.thing, a.rows, a.columns),
      },
      response: {
        kind: "choice",
        label: "Choose the addition sentence",
        options: options.map((o, i) => ({
          id: `option-${"abcd"[i]}`,
          label: o.label,
        })),
      },
    },
    answer: `option-${"abcd"[options.findIndex((o) => o.correct)]}`,
    walkthrough: undefined,
    choiceFeedback: Object.fromEntries(
      options.flatMap((o, i) =>
        o.correct
          ? []
          : [
              [
                `option-${"abcd"[i]}`,
                `Check the number in each ${r.orientation === "columns" ? "column" : "row"}, the number of addends, and the total.`,
              ],
            ],
      ),
    ),
  };
}
