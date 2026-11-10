import { createHash } from "node:crypto";
import { count, isAre, nounFor } from "./agreement";
import type {
  FigureChoiceResponse,
  GeneratedProblem,
  ProblemResponse,
  SemanticFigure,
  StructuredWorkResponse,
  TemplateMetadata,
  WorkGrading,
} from "./contracts";
import { scene, array as arrayEl, areaModel } from "./scene/author";
import type { Element, Scene } from "./scene/spec";
import {
  figureOptionIds,
  figureOptionLetters,
  type FigureChoiceNoun,
} from "./figure-choice";
import {
  gradeStructuredWork,
  gradingFits,
  normalizeStructuredWork,
} from "./structured-work";
import { serializeSelection } from "./selection-response";

/** Clause families whose answer format is not the host's. Classic hosts stay
 * on their own generators; nothing here draws from those content streams. */

type Random = (low: number, high: number) => number;
const comma = (n: number) => n.toLocaleString("en-US");

function random(id: string, seed: string): Random {
  let counter = 0;
  return (low, high) => {
    const span = high - low + 1;
    const limit = Math.floor(0x100000000 / span) * span;
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
function shuffle<T>(r: Random, items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = r(0, i);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

const noLink = [
  "row",
  "rows",
  "column",
  "columns",
  "left",
  "right",
  "part",
  "parts",
  "place",
  "round",
  "table",
  "model",
  "square",
  "squares",
  "figure",
];

const meta = (
  id: string,
  title: string,
  skillId: string,
  gradeBand: TemplateMetadata["gradeBand"],
  description: string,
  response: TemplateMetadata["requiredResponseCapability"],
  figure = false,
): TemplateMetadata => ({
  id,
  version: 1,
  title,
  skillId,
  gradeBand,
  description,
  glossaryNoLink: noLink,
  ...(response ? { requiredResponseCapability: response } : {}),
  ...(figure ? { requiredFigureCapability: "scenes-v1" as const } : {}),
});

export const storyForExpressionTemplates: readonly TemplateMetadata[] = [
  meta(
    "story-for-expression",
    "Match a story to an expression",
    "division-meaning",
    "3–5",
    "Choose the equal-groups story or the expression that matches a product or a quotient. The cards use the same numbers so the choice is the structure.",
    "single-choice-v1",
  ),
  meta(
    "story-both-interpretations",
    "Sharing and grouping are the same quotient",
    "division-meaning",
    "3–5",
    "Select both the sharing story and the grouping story for one division. A product story and a story that uses the quotient as the divisor are not selected.",
    "multi-select-v1",
  ),
];

export const multiplicationClauseTemplates: readonly TemplateMetadata[] = [
  meta(
    "partition-from-marks",
    "Partition a rectangle from edge marks",
    "arrays",
    "K–2",
    "Count the unit marks on a rectangle's edges and give the rows, the columns and the number of same-size squares.",
    "structured-work-v1",
    true,
  ),
  meta(
    "choose-partition",
    "Choose the equal-square partition",
    "arrays",
    "K–2",
    "Choose the rectangle partitioned into a stated number of rows and columns of same-size squares.",
    "figure-choice-v1",
    true,
  ),
  meta(
    "regions-to-whole",
    "Add the regions of a split array",
    "operation-properties",
    "3–5",
    "Fill the two region products of a split array and add them to get the whole product.",
    "structured-work-v1",
    true,
  ),
  meta(
    "which-split",
    "Choose the facts that add to a product",
    "operation-properties",
    "3–5",
    "Choose the two facts that add to a product. Parts that do not make the factor, a split on the wrong side, and adding the leftover columns are rejected.",
    "single-choice-v1",
  ),
  meta(
    "facts-from-known",
    "Facts that follow from known facts",
    "operation-properties",
    "3–5",
    "Select every fact that follows from two known facts that share a factor: the turn, the distributive sum and the related division.",
    "multi-select-v1",
  ),
  meta(
    "associative-compute",
    "Group a product of three factors both ways",
    "operation-properties",
    "3–5",
    "Compute a product of three factors by grouping either adjacent pair.",
    "structured-work-v1",
  ),
  meta(
    "split-the-dividend",
    "Split a dividend into friendly parts",
    "operation-properties",
    "3–5",
    "Divide a number within 100 by splitting off a multiple of ten times the divisor.",
    "structured-work-v1",
  ),
  meta(
    "complete-area-model",
    "Complete an area model",
    "whole-multiplication",
    "3–5",
    "Write the four partial products of a two-digit area model and their total.",
    "structured-work-v1",
    true,
  ),
  meta(
    "explain-part",
    "Where an area-model part comes from",
    "whole-multiplication",
    "3–5",
    "Name the place-value product that fills one region of an area model.",
    "single-choice-v1",
  ),
  meta(
    "partial-products-by-place",
    "Partial products by place",
    "whole-multiplication",
    "3–5",
    "Write the four place partial products of a four-digit by one-digit product, including a zero place, and their total.",
    "structured-work-v1",
  ),
  meta(
    "standard-algorithm-rows",
    "Rows of the standard multiplication algorithm",
    "multidigit-products",
    "3–5",
    "Write the ones row, the shifted tens row and the sum of a two-digit multiplication.",
    "structured-work-v1",
  ),
  meta(
    "find-the-error",
    "Find the error in a multiplication",
    "multidigit-products",
    "3–5",
    "Choose the statement that names an unshifted tens row or a carry added before multiplying.",
    "single-choice-v1",
  ),
  meta(
    "complete-division-model",
    "Complete a division area model",
    "whole-division",
    "3–5",
    "Fill each chunk's width and area for a one-digit divisor, including a zero place, then the quotient or the remainder.",
    "structured-work-v1",
    true,
  ),
  meta(
    "chunk-model",
    "Chunk a two-digit division",
    "multidigit-quotients",
    "3–5",
    "Fill place-by-place chunk widths and areas for a two-digit divisor, including a zero width, then the quotient or the remainder.",
    "structured-work-v1",
    true,
  ),
  meta(
    "first-chunk-choice",
    "The first chunk of a two-digit division",
    "multidigit-quotients",
    "3–5",
    "Choose the largest multiple of ten that fits as the first width of a two-digit division.",
    "single-choice-v1",
  ),
  meta(
    "list-all-pairs",
    "List every factor pair",
    "factors-multiples",
    "3–5",
    "List every factor pair of a number from 12 to 100, smaller factor first, in increasing order.",
    "structured-work-v1",
  ),
  meta(
    "complete-list-choice",
    "Choose the complete factor-pair list",
    "factors-multiples",
    "3–5",
    "Choose the list that has every factor pair once. A missing pair or a turned repeat is rejected.",
    "single-choice-v1",
  ),
  meta(
    "bracket-steps",
    "Steps of the standard division algorithm",
    "integer-division",
    "6–8",
    "Enter each quotient digit, product, difference and bring-down of a three-digit quotient, including a zero digit.",
    "structured-work-v1",
  ),
  meta(
    "spot-the-error",
    "Find the error in a long division",
    "integer-division",
    "6–8",
    "Choose the statement that fixes a remainder at least as large as the divisor, or a missing zero in the quotient.",
    "single-choice-v1",
  ),
];

type WorkSpec = {
  label: string;
  fields: { label: string; value: string }[];
};
function numberWork(title: string, rows: WorkSpec[]) {
  if (rows.length < 1 || rows.length > 6) throw new Error("row count");
  const response: StructuredWorkResponse = {
    kind: "structured-work",
    label: title,
    layout: "steps",
    mode: "build",
    banks: [],
    rows: rows.map((row, i) => ({
      id: `r${i + 1}`,
      label: row.label,
      fields: row.fields.map((field) => ({
        kind: "number" as const,
        label: field.label,
        maxLength: 8,
      })),
    })),
  };
  const workGrading: WorkGrading = {
    mode: "fields",
    fields: rows.map((row) =>
      row.fields.map((field) => ({ kind: "number" as const, value: field.value })),
    ),
  };
  const answer = JSON.stringify(
    rows.map((row) => row.fields.map((field) => field.value)),
  );
  if (
    !gradingFits(response, workGrading) ||
    normalizeStructuredWork(response, answer) !== answer ||
    !gradeStructuredWork(response, workGrading, answer) ||
    answer.length > 200
  )
    throw new Error("structured-work key");
  return { response, workGrading, answer };
}

type Card = { label: string; feedback: string; correct?: true };
function choiceResponse(r: Random, cards: Card[]) {
  if (cards.filter((c) => c.correct).length !== 1)
    throw new Error("one correct card");
  if (new Set(cards.map((c) => c.label)).size !== cards.length)
    throw new Error("duplicate choice");
  for (const card of cards)
    if (card.label.length < 1 || card.label.length > 120)
      throw new Error(`choice label length ${card.label.length}`);
  const order = shuffle(r, cards);
  const options = order.map((card, i) => ({
    id: `option-${"abcd"[i]}`,
    label: card.label,
  }));
  const answer = options[order.findIndex((c) => c.correct)]!.id;
  const choiceFeedback: Record<string, string> = {};
  order.forEach((card, i) => {
    if (!card.correct) choiceFeedback[`option-${"abcd"[i]}`] = card.feedback;
  });
  return {
    response: {
      kind: "choice" as const,
      label: "Choose one answer",
      options,
    },
    answer,
    choiceFeedback,
  };
}

function multiResponse(
  r: Random,
  correct: string[],
  wrong: { label: string }[],
) {
  const cards = [
    ...correct.map((label) => ({ label, correct: true })),
    ...wrong.map((w) => ({ label: w.label, correct: false })),
  ];
  if (new Set(cards.map((c) => c.label)).size !== cards.length)
    throw new Error("duplicate select");
  if (correct.length < 2 || cards.length <= correct.length)
    throw new Error("select count");
  const order = shuffle(r, cards);
  const options = order.map((card, i) => ({
    id: `option-${"abcdefgh"[i]}`,
    label: card.label,
  }));
  const ids = options.filter((_, i) => order[i]!.correct).map((o) => o.id);
  return {
    response: {
      kind: "multi-select" as const,
      label: `Choose ${correct.length}`,
      selectionCount: correct.length,
      options,
    },
    answer: serializeSelection(ids),
  };
}

function rect(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: "none" | "accent-fill" | "warm-fill" | "gold-fill",
): Element {
  return {
    type: "rect",
    id,
    at: [round3(x), round3(y)],
    size: [round3(w), round3(h)],
    fill,
    stroke: "ink",
    width: 1.5,
  };
}
const round3 = (n: number) => Math.round(n * 1000) / 1000;
function picture(elements: Element[], width = 260): Scene {
  return scene(...elements).build({ width, maxHeight: 240 });
}

function finish(
  template: TemplateMetadata,
  seed: string,
  built: {
    prompt: string;
    response: ProblemResponse;
    answer: string;
    hint: string;
    explanation: string[];
    figure?: SemanticFigure;
    choiceFeedback?: Record<string, string>;
    workGrading?: WorkGrading;
    walkthrough?: Scene;
    family: string;
  },
): GeneratedProblem {
  if (built.hint.length < 20 || built.explanation.length < 2)
    throw new Error("thin teaching");
  const blob = `${built.prompt}\n${built.hint}`;
  if (built.response.kind === "choice" || built.response.kind === "figure-choice") {
    const id = built.answer;
    const label = built.response.options.find((o) => o.id === id)?.label;
    const leaked =
      !!label &&
      (/^\d+$/.test(label)
        ? new RegExp(`(?<![\\d])${label}(?![\\d])`).test(blob.replace(/,/g, ""))
        : blob.includes(label));
    if (!label || leaked) throw new Error(`choice leak: ${label}`);
  }
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([template.id, 1, seed]))
        .digest("hex"),
      templateId: template.id,
      templateVersion: 1,
      seed,
      prompt: built.prompt,
      skillId: template.skillId,
      response: built.response,
      ...(built.figure ? { figure: built.figure } : {}),
    },
    answer: built.answer,
    hint: built.hint,
    explanation: built.explanation,
    ...(built.choiceFeedback ? { choiceFeedback: built.choiceFeedback } : {}),
    ...(built.workGrading ? { workGrading: built.workGrading } : {}),
    ...(built.walkthrough ? { walkthrough: built.walkthrough } : {}),
    variant: { id: built.family },
  };
}

/* -------------------------------------------------- stories */

const NOUNS = [
  { item: "stickers", pack: "packs", people: "friends", person: "friend" },
  { item: "marbles", pack: "bags", people: "children", person: "child" },
  { item: "apples", pack: "baskets", people: "tables", person: "table" },
  { item: "cards", pack: "envelopes", people: "players", person: "player" },
] as const;

function divisionStories(total: number, div: number, quot: number, noun: (typeof NOUNS)[number]) {
  const share = `${total} ${noun.item} shared equally by ${div} ${noun.people}. How many does each get?`;
  const group = `${total} ${noun.item} in ${noun.pack} of ${div}. How many ${noun.pack}?`;
  const product = `${div} ${noun.pack} with ${total} ${noun.item} in each. How many ${noun.item}?`;
  const take = `${total} ${noun.item}, ${div} given away. How many are left?`;
  const confused = `${total} ${noun.item} shared by ${quot} ${noun.people}. How many does each get?`;
  return { share, group, product, take, confused };
}

function storyChoice(r: Random, family: "quotient-context" | "expression-for-story" | "product-context") {
  const noun = pick(r, NOUNS);
  if (family === "product-context") {
    const pin = r(0, 4) === 0;
    const groups = pin ? 5 : r(2, 9);
    let each = pin ? 7 : r(2, 9);
    if (each === groups) each = each === 9 ? 2 : each + 1;
    const correct = `${groups} groups of ${each} ${noun.item}. How many ${noun.item} are there?`;
    const turned = `${each} groups of ${groups} ${noun.item}. How many ${noun.item} are there?`;
    const cards: Card[] = [
      {
        label: correct,
        correct: true,
        feedback: "",
      },
      {
        label: `${groups} red and ${each} blue ${noun.item}. How many ${noun.item} are there?`,
        feedback: `That story adds ${groups} and ${each}. ${groups} × ${each} is ${groups} groups of ${each}, not a red pile and a blue pile.`,
      },
      {
        label: `${groups * each} ${noun.item} shared by ${groups}. How many does each get?`,
        feedback: `${groups * each} shared by ${groups} is division. ${each} is the answer of that story, not a group size in ${groups} × ${each}.`,
      },
      {
        label: `${each} ${noun.item}, ${groups} given away. How many are left?`,
        feedback: `Giving away is subtraction. ${groups} × ${each} needs ${groups} equal groups of ${each}.`,
      },
    ];
    if (cards.slice(1).some((c) => c.label === turned))
      throw new Error("turned product used");
    return { cards, noun, groups, each, family };
  }
  const pin = r(0, 4) === 0;
  const div = pin ? 8 : r(2, 9);
  let quot = pin ? 7 : r(2, 9);
  if (quot === div) quot = quot === 9 ? 2 : quot + 1;
  const total = div * quot;
  const stories = divisionStories(total, div, quot, noun);
  if (family === "expression-for-story") {
    const sharing = r(0, 1) === 0;
    const story = sharing ? stories.share : stories.group;
    const cards: Card[] = [
      {
        label: `${total} ÷ ${div}`,
        correct: true,
        feedback: "",
      },
      {
        label: `${div} ÷ ${total}`,
        feedback: `${div} ÷ ${total} divides the group size by the total. The story starts with ${total} things.`,
      },
      {
        label: `${total} × ${div}`,
        feedback: `The ${total} ${noun.item} are the total, already known. Multiplying would build a total that the story does not ask for.`,
      },
      {
        label: `${total} − ${div}`,
        feedback: `Nothing is given away. The ${div} names equal groups or the size of a group, so the operation is division.`,
      },
    ];
    return { cards, story, total, div, quot, family, sharing };
  }
  const sharing = r(0, 1) === 0;
  const correct = sharing ? stories.share : stories.group;
  const cards: Card[] = [
    { label: correct, correct: true, feedback: "" },
    {
      label: stories.product,
      feedback: `That story never gives the total ${total}. It builds a total, so it is multiplication, not ${total} ÷ ${div}.`,
    },
    {
      label: stories.confused,
      feedback: `${quot} is the answer of ${total} ÷ ${div}, not the number of groups. Sharing by ${quot} is a different division.`,
    },
    {
      label: stories.take,
      feedback: `Giving ${div} away is subtraction. ${total} ÷ ${div} needs ${div} equal groups or ${div} in each group.`,
    },
  ];
  return { cards, total, div, quot, family, sharing, stories };
}

function storyForExpression(r: Random) {
  const family = pick(r, [
    "quotient-context",
    "expression-for-story",
    "product-context",
  ] as const);
  const built = storyChoice(r, family);
  if (family === "expression-for-story" && "story" in built) {
    const chosen = choiceResponse(r, built.cards);
    return {
      family,
      prompt: `Which expression matches this story? ${built.story}`,
      hint: `The story already has the total, ${built.total}. The other number, ${built.div}, is the number of groups or the number in each group. Division starts from the total.`,
      explanation: [
        `The story gives ${built.total} ${"sharing" in built && built.sharing ? "shared" : "packed"} by ${built.div}.`,
        `${built.total} is the total and ${built.div} is a group count or a group size, so the expression is ${built.total} ÷ ${built.div}.`,
        `${built.div} ÷ ${built.total} swaps the total with the group number.`,
        `${built.total} × ${built.div} would build a new total, and ${built.total} − ${built.div} would give something away.`,
      ],
      ...chosen,
    };
  }
  if (
    family === "product-context" &&
    "groups" in built &&
    built.groups != null &&
    built.each != null
  ) {
    const groups = built.groups;
    const each = built.each;
    const chosen = choiceResponse(r, built.cards);
    return {
      family,
      prompt: `Which story can be written as ${groups} × ${each}?`,
      hint: `${groups} × ${each} means ${groups} equal groups of ${each}. The total is not told in the story. Adding the two numbers, sharing, or taking some away is a different operation.`,
      explanation: [
        `${groups} × ${each} means ${groups} equal groups with ${each} in each group.`,
        `The matching story has ${groups} groups of ${each} and asks for the total.`,
        `${groups} red and ${each} blue is addition.`,
        `A story that starts from ${groups * each} already has the total, so it is division. ${each} groups of ${groups} is not offered, because that story is also ${groups} × ${each}.`,
      ],
      ...chosen,
    };
  }
  if (!("total" in built)) throw new Error("story");
  const chosen = choiceResponse(r, built.cards);
  return {
    family,
    prompt: `Which story can be written as ${built.total} ÷ ${built.div}?`,
    hint: `${built.total} ÷ ${built.div} already knows the total ${built.total}. The story needs ${built.total} things and ${built.div} groups, or ${built.div} in each group. A story with no total is multiplication.`,
    explanation: [
      `In ${built.total} ÷ ${built.div}, ${built.total} is the total and ${built.div} is either the number of groups or the number in each group.`,
      `The matching story has ${built.total} things and ${built.div} as that group number. Both a sharing story and a grouping story can match.`,
      `A story of ${built.div} groups with ${built.total} in each has no total yet, so it is multiplication.`,
      `Sharing by ${built.quot} uses the quotient as the divisor. Giving ${built.div} away is subtraction.`,
    ],
    ...chosen,
  };
}

function storyBoth(r: Random) {
  const pin = r(0, 4) === 0;
  const div = pin ? 8 : r(2, 9);
  let quot = pin ? 7 : r(2, 9);
  if (quot === div) quot = quot === 9 ? 2 : quot + 1;
  const total = div * quot;
  const noun = pick(r, NOUNS);
  const s = divisionStories(total, div, quot, noun);
  const selected = multiResponse(r, [s.share, s.group], [
    { label: s.product },
    { label: s.confused },
  ]);
  return {
    family: "both-interpretations" as const,
    prompt: `Which stories can be written as ${total} ÷ ${div}? Select the two that match.`,
    hint: `${total} ÷ ${div} can mean sharing ${total} into ${div} groups, or packing ${total} into groups of ${div}. Both ask a different question and give the same quotient. A story with no total is a different operation.`,
    explanation: [
      `Sharing ${total} ${noun.item} among ${div} ${noun.people} is ${total} ÷ ${div}.`,
      `Packing ${total} ${noun.item} into ${noun.pack} of ${div} is the same division: it asks how many groups.`,
      `Both stories are selected. The quotient is ${quot} either way.`,
      `${div} ${noun.pack} of ${total} is multiplication. Sharing by ${quot} uses the answer as the divisor.`,
    ],
    ...selected,
  };
}

/* -------------------------------------------------- arrays */

function partitionFromMarks(r: Random) {
  const pin = r(0, 4) === 0;
  let rows = pin ? 3 : r(2, 5);
  let columns = pin ? 4 : r(2, 5);
  if (!pin && r(0, 9) < 7 && rows === columns)
    columns = columns === 5 ? 2 : columns + 1;
  const total = rows * columns;
  const marks: Element[] = [
    rect("outer", 0, 0, columns, rows, "none"),
    rect("unit", 0, 0, 1, 1, "accent-fill"),
  ];
  for (let i = 0; i < columns; i++)
    marks.push(rect(`top-${i}`, i + 0.15, rows + 0.08, 0.7, 0.22, "warm-fill"));
  for (let i = 0; i < rows; i++)
    marks.push(rect(`left-${i}`, -0.3, i + 0.15, 0.22, 0.7, "gold-fill"));
  const cells: Element[] = [];
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < columns; x++)
      cells.push(rect(`cell-${y}-${x}`, x, y, 1, 1, "accent-fill"));
  const work = numberWork("Rows, columns and total", [
    {
      label: "How many rows, and how many columns?",
      fields: [
        { label: "Rows", value: String(rows) },
        { label: "Columns", value: String(columns) },
      ],
    },
    {
      label: "How many squares in all?",
      fields: [{ label: "Squares", value: String(total) }],
    },
  ]);
  return {
    family: "partition-from-marks",
    prompt:
      "Partition this rectangle into squares the size of the shaded one. How many rows? How many columns? How many squares in all?",
    hint: `The left edge has ${rows} marks and the top edge has ${columns} marks. Those marks count the rows and the columns. The total is those two counts multiplied, not added. The shaded square is one cell, not the whole rectangle.`,
    explanation: [
      `The left edge has ${rows} marks, so the rectangle has ${rows} rows.`,
      `The top edge has ${columns} marks, so it has ${columns} columns.`,
      `The grid is ${rows} rows of ${columns}: ${columns} + ${columns}${rows > 2 ? ` and so on, ${rows} times` : ""}. ${rows} × ${columns} = ${total}.`,
      `There are ${total} same-size squares. Adding ${rows} + ${columns} counts only the edge, not the squares.`,
    ],
    figure: { kind: "scene" as const, scene: picture(marks) },
    walkthrough: picture(cells),
    ...work,
  };
}

function cellGrid(
  rows: number,
  cols: number,
  outerW: number,
  outerH: number,
  widths: number[] | null,
): Element[] {
  const els: Element[] = [rect("outer", 0, 0, outerW, outerH, "none")];
  if (!widths) {
    const w = outerW / cols;
    const h = outerH / rows;
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++)
        els.push(rect(`c-${y}-${x}`, x * w, y * h, w, h, y % 2 ? "warm-fill" : "accent-fill"));
    return els;
  }
  const h = outerH / rows;
  for (let y = 0; y < rows; y++) {
    let x0 = 0;
    for (let x = 0; x < widths.length; x++) {
      const w = widths[x]!;
      els.push(rect(`c-${y}-${x}`, x0, y * h, w, h, x % 2 ? "warm-fill" : "accent-fill"));
      x0 += w;
    }
  }
  return els;
}

function unequalWidths(columns: number): number[] {
  if (columns === 2) return [1.5, 0.5];
  if (columns === 3) return [1.5, 1, 0.5];
  if (columns === 4) return [1.5, 1, 1, 0.5];
  return [2, 1, 1, 0.5, 0.5];
}

function choosePartition(r: Random) {
  const pin = r(0, 4) === 0;
  let rows = pin ? 3 : r(2, 5);
  let columns = pin ? 4 : r(2, 5);
  if (rows === columns) columns = columns === 5 ? 2 : columns + 1;
  const outerW = columns;
  const outerH = rows;
  const widths = unequalWidths(columns);
  if (Math.abs(widths.reduce((a, b) => a + b, 0) - columns) > 1e-6)
    throw new Error("widths");
  const correct = cellGrid(rows, columns, outerW, outerH, null);
  const turned = cellGrid(columns, rows, outerW, outerH, null);
  const unequal = cellGrid(rows, widths.length, outerW, outerH, widths);
  const short = cellGrid(rows, columns - 1, outerW, outerH, null);
  const noun: FigureChoiceNoun = "Picture";
  const options = [
    {
      description: `${count(rows, "row")} and ${count(columns, "column")} of equal squares filling the rectangle`,
      scene: picture(correct),
      correct: true as const,
    },
    {
      description: `${count(columns, "row")} and ${count(rows, "column")} of equal rectangles that are not squares, filling the same outer rectangle`,
      scene: picture(turned),
      feedback: "These are not squares: the rows and columns were swapped inside the same outer rectangle, so each piece is stretched.",
    },
    {
      description: `${rows} rows whose columns have unequal widths inside the same outer rectangle`,
      scene: picture(unequal),
      feedback: "The columns are not the same width, so the pieces are not same-size squares.",
    },
    {
      description: `${count(rows, "row")} and ${count(columns - 1, "column")} of equal squares, with an empty strip on the right of the same outer rectangle`,
      scene: picture(short),
      feedback: `That partition has ${count(columns - 1, "column")}, one fewer than ${columns}.`,
    },
  ];
  if (
    new Set(options.map((o) => JSON.stringify(o.scene.elements))).size !== 4 ||
    new Set(options.map((o) => o.description)).size !== 4
  )
    throw new Error("partition figures");
  for (const option of options)
    if (option.description.length < 10) throw new Error("short description");
  const order = shuffle(r, options);
  const response: FigureChoiceResponse = {
    kind: "figure-choice",
    label: "Choose one picture",
    noun,
    options: order.map((option, i) => ({
      id: figureOptionIds[i]!,
      label: option.description,
      scene: option.scene,
    })),
  };
  const at = order.findIndex((o) => "correct" in o && o.correct);
  const answer = figureOptionIds[at]!;
  const choiceFeedback: Record<string, string> = {};
  order.forEach((option, i) => {
    if (!("correct" in option && option.correct))
      choiceFeedback[figureOptionIds[i]!] = option.feedback!;
  });
  const letter = figureOptionLetters[at];
  return {
    family: "choose-partition",
    prompt: `Which rectangle is partitioned into ${count(rows, "row")} and ${count(columns, "column")} of same-size squares?`,
    hint: `The question asks for ${count(rows, "row")} and ${count(columns, "column")} of same-size squares. Count the rows down the side and the columns across the top. Swapping those counts inside the same outer rectangle stretches the pieces.`,
    explanation: [
      `The rectangle is ${columns} units wide and ${rows} units tall, so ${rows} rows of ${columns} unit squares fill it.`,
      `Picture ${letter} shows ${count(rows, "row")} and ${count(columns, "column")} of equal squares.`,
      `The ${columns}-by-${rows} picture uses the same outer rectangle, so its pieces are not squares.`,
      `Unequal column widths are not same-size squares, and ${count(columns - 1, "column")} is a miscount by one.`,
    ],
    response,
    answer,
    choiceFeedback,
    walkthrough: picture(correct),
  };
}

/* -------------------------------------------------- properties */

function factorCut(r: Random) {
  const pin = r(0, 4) === 0;
  const rows = pin ? 8 : r(6, 9);
  let columns = pin ? 7 : r(6, 9);
  const half = !pin && columns % 2 === 0 && r(0, 1) === 0;
  const cut = half ? columns / 2 : 5;
  if (cut >= columns) columns = cut + 1;
  const rest = columns - cut;
  return { rows, columns, cut, rest, product: rows * columns };
}

function regionsToWhole(r: Random) {
  const g = factorCut(r);
  const a = g.rows * g.cut;
  const b = g.rows * g.rest;
  const work = numberWork("Regions and the whole product", [
    {
      label: `${g.rows} × ${g.cut} and ${g.rows} × ${g.rest}`,
      fields: [
        { label: "First region", value: String(a) },
        { label: "Second region", value: String(b) },
      ],
    },
    {
      label: `The addends of ${g.rows} × ${g.columns}`,
      fields: [
        { label: "First addend", value: String(a) },
        { label: "Second addend", value: String(b) },
      ],
    },
    {
      label: "The whole product",
      fields: [{ label: "Product", value: String(g.product) }],
    },
  ]);
  const figure: SemanticFigure = {
    kind: "scene",
    scene: arrayEl(g.rows, g.columns, { splitAfterColumn: g.cut }).scene({
      width: 280,
      maxHeight: 240,
    }),
  };
  return {
    family: "regions-to-whole",
    prompt: `Use the regions to find ${g.rows} × ${g.columns}. ${g.rows} × ${g.cut} = __, ${g.rows} × ${g.rest} = __, so ${g.rows} × ${g.columns} = __ + __ = __.`,
    hint: `The cut is after ${count(g.cut, "column")}, and ${count(g.rest, "column")} ${isAre(g.rest)} left. Multiply ${g.rows} by each part. The whole array is those two regions added; the total number of squares did not change.`,
    explanation: [
      `The line keeps ${g.cut} columns on one side and ${g.rest} on the other. ${g.cut} + ${g.rest} = ${g.columns}.`,
      `${g.rows} × ${g.cut} = ${a} and ${g.rows} × ${g.rest} = ${b}.`,
      `${a} + ${b} = ${g.product}, so ${g.rows} × ${g.columns} = ${g.product}.`,
      `Using ${g.rest + 1} as the second part would add a column that is not there.`,
    ],
    figure,
    ...work,
  };
}

function whichSplit(r: Random) {
  const g = factorCut(r);
  const correct = `${g.rows} × ${g.cut} and ${g.rows} × ${g.rest}`;
  const over = `${g.rows} × ${g.cut} and ${g.rows} × ${g.rest + 1}`;
  let side = `${g.cut} × ${g.columns} and ${g.rest} × ${g.columns}`;
  const sideValue = g.cut * g.columns + g.rest * g.columns;
  if (sideValue === g.product)
    side = `${g.cut} × ${g.columns} and ${g.rest + 1} × ${g.columns}`;
  const add = `${g.rows} × ${g.cut}, then add ${g.rest}`;
  const cards: Card[] = [
    { label: correct, correct: true, feedback: "" },
    {
      label: over,
      feedback: `${g.cut} + ${g.rest + 1} = ${g.cut + g.rest + 1}, not ${g.columns}. The parts have to make ${g.columns}.`,
    },
    {
      label: side,
      feedback: `That splits ${g.columns} and multiplies the parts by ${g.columns}. The factor that was split is ${g.columns}, and it has to multiply ${g.rows}, the side that stayed whole.`,
    },
    {
      label: add,
      feedback: `The leftover ${count(g.rest, "column")} ${isAre(g.rest)} ${g.rows} × ${g.rest} ${nounFor(g.rest, "square")}, not ${count(g.rest, "square")}. Adding ${g.rest} drops the rows.`,
    },
  ];
  const chosen = choiceResponse(r, cards);
  return {
    family: "which-split",
    prompt: `Which two facts can you add to find ${g.rows} × ${g.columns}?`,
    hint: `One factor stays ${g.rows}. The other factor, ${g.columns}, splits into two parts that add back to ${g.columns}. Add those two products. Do not add the leftover columns as a plain number.`,
    explanation: [
      `${g.columns} = ${g.cut} + ${g.rest}, so ${g.rows} × ${g.columns} = ${g.rows} × ${g.cut} + ${g.rows} × ${g.rest}.`,
      `${g.rows} × ${g.cut} = ${g.rows * g.cut} and ${g.rows} × ${g.rest} = ${g.rows * g.rest}.`,
      `${g.rows * g.cut} + ${g.rows * g.rest} = ${g.product}.`,
      `${over} uses parts that add to ${g.columns + 1}. ${add} adds ${g.rest} instead of ${g.rows} × ${g.rest}.`,
    ],
    ...chosen,
  };
}

function factsFromKnown(r: Random) {
  const pin = r(0, 4) === 0;
  const a = pin ? 6 : r(3, 9);
  let b = pin ? 4 : r(2, 9);
  let c = pin ? 5 : r(2, 9);
  if (b + c > 9) c = Math.max(2, 9 - b);
  if (b + c > 9) {
    b = 2;
    c = 2;
  }
  const p = a * b;
  const q = a * c;
  const both = a * (b + c);
  const turn = `${b} × ${a} = ${p}`;
  const dist = `${a} × ${b + c} = ${both}`;
  const div = `${p} ÷ ${a} = ${b}`;
  const turnedProduct = p + 18;
  const addedFactor = p + c;
  const slip = q + 5;
  const badTurn = `${b} × ${a} = ${turnedProduct}`;
  const badDist = `${a} × ${b + c} = ${addedFactor}`;
  const badSlip = `${c} × ${a} = ${slip}`;
  const truths = [
    [turn, p === b * a],
    [dist, both === a * (b + c)],
    [div, p / a === b],
    [badTurn, turnedProduct === b * a],
    [badDist, addedFactor === a * (b + c)],
    [badSlip, slip === c * a],
  ] as const;
  if (truths.slice(0, 3).some(([, ok]) => !ok) || truths.slice(3).some(([, ok]) => ok))
    throw new Error("fact truth");
  const selected = multiResponse(
    r,
    [turn, dist, div],
    [{ label: badTurn }, { label: badDist }, { label: badSlip }],
  );
  return {
    family: "facts-from-known",
    prompt: `Sam knows ${a} × ${b} = ${p} and ${a} × ${c} = ${q}. Select every fact he can now work out.`,
    hint: `The two known facts share the factor ${a}. Turning a fact keeps the product. Adding the products builds ${a} times the sum of the other factors, when that sum is a one-digit number. Dividing a product by ${a} gets the other factor back.`,
    explanation: [
      `${b} × ${a} = ${p} because the order of the factors does not change the product.`,
      `${a} × ${b + c} = ${a} × ${b} + ${a} × ${c} = ${p} + ${q} = ${both}.`,
      `${p} ÷ ${a} = ${b} because ${a} × ${b} = ${p}.`,
      `${badTurn} changes the product. ${badDist} adds ${c} instead of the product ${q}. ${badSlip} is not ${c} × ${a}.`,
    ],
    ...selected,
  };
}

function associativeCompute(r: Random) {
  let a: number, b: number, c: number;
  if (r(0, 4) === 0) {
    a = 3;
    b = 5;
    c = 2;
  } else if (r(0, 1) === 0) {
    const pair = pick(r, [
      [2, 5],
      [5, 2],
      [4, 5],
      [5, 4],
    ] as const);
    const cap = Math.max(2, Math.floor(100 / (pair[0] * pair[1])));
    const third = r(2, Math.min(9, cap));
    if (r(0, 1) === 0) {
      a = pair[0];
      b = pair[1];
      c = third;
    } else {
      a = third;
      b = pair[0];
      c = pair[1];
    }
  } else {
    a = r(2, 5);
    b = r(2, 5);
    c = r(2, 4);
  }
  if (a * b * c > 100) throw new Error("product cap");
  const ab = a * b;
  const bc = b * c;
  const all = a * b * c;
  const work = numberWork("Both groupings", [
    {
      label: `(${a} × ${b}) × ${c}`,
      fields: [
        { label: "First product", value: String(ab) },
        { label: "First route", value: String(all) },
      ],
    },
    {
      label: `${a} × (${b} × ${c})`,
      fields: [
        { label: "Inner product", value: String(bc) },
        { label: "Second route", value: String(all) },
      ],
    },
  ]);
  return {
    family: "associative-compute",
    prompt: `${a} × ${b} × ${c} = (${a} × ${b}) × ${c} = __ × ${c} = __ and = ${a} × (${b} × ${c}) = ${a} × __ = __.`,
    hint: `Multiply one adjacent pair first. Then multiply by the factor that was waiting. The other grouping multiplies the other adjacent pair first. Both routes count the same ${a} groups of ${b} groups of ${c}.`,
    explanation: [
      `(${a} × ${b}) × ${c} = ${ab} × ${c} = ${all}.`,
      `${a} × (${b} × ${c}) = ${a} × ${bc} = ${all}.`,
      `The parentheses move, and the product stays ${all}.`,
      `Stopping after only one pair leaves a factor out.`,
    ],
    ...work,
  };
}

function splitDividend(r: Random) {
  const pin = r(0, 4) === 0;
  const d = pin ? 6 : r(3, 9);
  let q = pin ? 12 : r(11, 16);
  if (d * q > 100) q = Math.min(16, Math.floor(100 / d));
  if (q < 11) q = 11;
  if (d * q > 100) throw new Error("dividend cap");
  const n = d * q;
  const tens = d * 10;
  const ones = d * (q - 10);
  const work = numberWork("Split the dividend", [
    {
      label: `${tens} ÷ ${d} and ${ones} ÷ ${d}`,
      fields: [
        { label: "Tens quotient", value: "10" },
        { label: "Ones quotient", value: String(q - 10) },
      ],
    },
    {
      label: `${n} ÷ ${d}`,
      fields: [{ label: "Quotient", value: String(q) }],
    },
  ]);
  return {
    family: "split-the-dividend",
    prompt: `${n} ÷ ${d}: split ${n} into ${tens} + ${ones}. ${tens} ÷ ${d} = __, ${ones} ÷ ${d} = __, so ${n} ÷ ${d} = __.`,
    hint: `${tens} is a multiple of ${d} made from tens. Divide that part and divide ${ones} as well, then add the two quotients. Divide each part once; do not divide the whole dividend and the leftover both by ${d} and then divide again.`,
    explanation: [
      `${n} = ${tens} + ${ones}, and both parts divide evenly by ${d}.`,
      `${tens} ÷ ${d} = 10 and ${ones} ÷ ${d} = ${q - 10}.`,
      `10 + ${q - 10} = ${q}, so ${n} ÷ ${d} = ${q}.`,
      `Check: ${d} × ${q} = ${n}. Dividing ${n} by ${d} and also dividing ${ones} by ${d} again would divide the leftover twice.`,
    ],
    ...work,
  };
}

/* -------------------------------------------------- multi-digit multiply */

function twoDigit(r: Random, pin?: [number, number]) {
  if (pin) return pin;
  const a = r(2, 8) * 10 + r(3, 9);
  const b = r(2, 8) * 10 + r(3, 9);
  return [a, b] as [number, number];
}

function completeAreaModel(r: Random) {
  const pin = r(0, 4) === 0;
  const [a, b] = twoDigit(r, pin ? [46, 56] : undefined);
  const aT = Math.floor(a / 10) * 10;
  const aO = a % 10;
  const bT = Math.floor(b / 10) * 10;
  const bO = b % 10;
  const parts = [aT * bT, aT * bO, aO * bT, aO * bO];
  const total = a * b;
  if (parts.reduce((s, n) => s + n, 0) !== total) throw new Error("area parts");
  const work = numberWork("Partial products and the total", [
    {
      label: `${aT} × ${bT} and ${aT} × ${bO}`,
      fields: [
        { label: "First part", value: String(parts[0]) },
        { label: "Second part", value: String(parts[1]) },
      ],
    },
    {
      label: `${aO} × ${bT} and ${aO} × ${bO}`,
      fields: [
        { label: "Third part", value: String(parts[2]) },
        { label: "Fourth part", value: String(parts[3]) },
      ],
    },
    {
      label: "Total",
      fields: [{ label: "Product", value: String(total) }],
    },
  ]);
  const figure: SemanticFigure = {
    kind: "scene",
    scene: areaModel([aT, aO], [bT, bO], {
      products: "none",
      scale: "proportional",
    }).scene({ width: 280, maxHeight: 240 }),
  };
  return {
    family: "complete-area-model",
    prompt: `Complete the area model for ${a} × ${b}. The sides are split into ${aT} and ${aO}, and ${bT} and ${bO}. Write each part's product, then the total.`,
    hint: `Each region is one part of ${a} times one part of ${b}. The largest region is the tens part times the tens part, which is a number of hundreds, not the product of the two tens digits alone. Add the four regions. Do not multiply a whole factor by one part and also count that region again.`,
    explanation: [
      `${a} = ${aT} + ${aO} and ${b} = ${bT} + ${bO}.`,
      `${aT} × ${bT} = ${comma(parts[0]!)}, ${aT} × ${bO} = ${comma(parts[1]!)}, ${aO} × ${bT} = ${comma(parts[2]!)}, and ${aO} × ${bO} = ${parts[3]}.`,
      `The regions add to ${comma(parts[0]!)} + ${comma(parts[1]!)} + ${comma(parts[2]!)} + ${parts[3]} = ${comma(total)}.`,
      `So ${a} × ${b} = ${comma(total)}. Writing ${Math.floor(a / 10)} × ${Math.floor(b / 10)} in the large region drops the hundreds.`,
    ],
    figure,
    ...work,
  };
}

function explainPart(r: Random) {
  const pin = r(0, 4) === 0;
  const [a, b] = twoDigit(r, pin ? [46, 56] : undefined);
  const aT = Math.floor(a / 10) * 10;
  const aO = a % 10;
  const bT = Math.floor(b / 10) * 10;
  const bO = b % 10;
  const big = aT * bT;
  const correct = `${aT} × ${bT}`;
  const digits = `${aT / 10} × ${bT / 10}`;
  const wholeDown = `${a} × ${bT}`;
  const wholeAcross = `${aT} × ${b}`;
  const cards: Card[] = [
    { label: correct, correct: true, feedback: "" },
    {
      label: digits,
      feedback: `${digits} = ${(aT / 10) * (bT / 10)} uses the digits and drops the tens. ${aT} × ${bT} is ${(aT / 10) * (bT / 10)} hundreds.`,
    },
    {
      label: wholeDown,
      feedback: `${a} × ${bT} also includes ${aO} × ${bT}, which is a different region. That overlaps the model.`,
    },
    {
      label: wholeAcross,
      feedback: `${aT} × ${b} also includes ${aT} × ${bO}, which is a different region. That overlaps the model.`,
    },
  ];
  if (new Set(cards.map((c) => c.label)).size !== 4) throw new Error("part labels");
  const chosen = choiceResponse(r, cards);
  return {
    family: "explain-part",
    prompt: `An area model for ${a} × ${b} is split into ${aT} and ${aO} across, and ${bT} and ${bO} down. Where does the ${comma(big)} come from?`,
    hint: `The large region touches the ${aT} part and the ${bT} part only. A product that uses all of ${a} or all of ${b} covers more than one region.`,
    explanation: [
      `The region in the tens-by-tens corner is ${aT} × ${bT}.`,
      `${aT} × ${bT} = ${comma(big)}.`,
      `${digits} = ${(aT / 10) * (bT / 10)}, which drops the place.`,
      `${wholeDown} and ${wholeAcross} each cover two regions, so neither is the source of just ${comma(big)}.`,
    ],
    ...chosen,
  };
}

function partialProducts(r: Random) {
  const pin = r(0, 4);
  let digits: number[];
  let factor: number;
  if (pin === 0) {
    digits = [7, 3, 3, 9];
    factor = 6;
  } else if (pin === 1) {
    digits = [7, 0, 3, 9];
    factor = 6;
  } else {
    factor = r(3, 9);
    digits = [r(1, 9), r(0, 9), r(0, 9), r(0, 9)];
    if (r(0, 4) === 0) digits[r(1, 3)] = 0;
    if (!digits.slice(1).includes(0) && r(0, 4) === 0) digits[2] = 0;
  }
  const places = digits.map((digit, i) => digit * 10 ** (3 - i));
  const parts = places.map((place) => place * factor);
  const n = places.reduce((s, p) => s + p, 0);
  const total = n * factor;
  if (parts.reduce((s, p) => s + p, 0) !== total) throw new Error("partials");
  const work = numberWork("Partial products and the total", [
    {
      label: `${comma(places[0]!)} × ${factor} and ${comma(places[1]!)} × ${factor}`,
      fields: [
        { label: "Thousands product", value: String(parts[0]) },
        { label: "Hundreds product", value: String(parts[1]) },
      ],
    },
    {
      label: `${places[2]} × ${factor} and ${places[3]} × ${factor}`,
      fields: [
        { label: "Tens product", value: String(parts[2]) },
        { label: "Ones product", value: String(parts[3]) },
      ],
    },
    {
      label: "Total",
      fields: [{ label: "Product", value: String(total) }],
    },
  ]);
  return {
    family: "partial-products-by-place",
    prompt: `${comma(n)} × ${factor} = (${comma(places[0]!)} × ${factor}) + (${comma(places[1]!)} × ${factor}) + (${places[2]} × ${factor}) + (${places[3]} × ${factor}). Fill in the four partial products and the total.`,
    hint: `Multiply ${factor} by each place, including a place of 0. A 0 place has product 0; skipping it shifts the other places. Then add the four products.`,
    explanation: [
      `${comma(places[0]!)} × ${factor} = ${comma(parts[0]!)} and ${comma(places[1]!)} × ${factor} = ${comma(parts[1]!)}.`,
      `${places[2]} × ${factor} = ${parts[2]} and ${places[3]} × ${factor} = ${parts[3]}.`,
      `${parts.map((p) => comma(p)).join(" + ")} = ${comma(total)}.`,
      `So ${comma(n)} × ${factor} = ${comma(total)}.`,
    ],
    ...work,
  };
}

function carries(n: number, d: number) {
  let carry = 0;
  let saw = false;
  for (const digit of String(n).split("").reverse()) {
    const prod = Number(digit) * d + carry;
    if (prod >= 10) saw = true;
    carry = Math.floor(prod / 10);
  }
  return saw;
}

function standardRows(r: Random) {
  const pin = r(0, 4) === 0;
  let a: number;
  let b: number;
  if (pin) {
    a = 842;
    b = 69;
  } else {
    const three = r(0, 2) > 0;
    a = three ? r(100, 999) : r(12, 99);
    if (r(0, 2) === 0) {
      const s = String(a).split("");
      const at = r(1, s.length - 1);
      s[at] = "0";
      a = Number(s.join(""));
      if (a < 10) a += 10;
    }
    const tens = r(2, 9);
    let ones = r(1, 9);
    b = tens * 10 + ones;
    let guard = 0;
    while (!carries(a, ones) && !carries(a, tens) && guard < 8) {
      ones = ones === 9 ? 3 : ones + 1;
      b = tens * 10 + ones;
      guard++;
    }
    if (!carries(a, b % 10) && !carries(a, Math.floor(b / 10))) {
      a = 28;
      b = 36;
    }
  }
  const ones = b % 10;
  const tens = Math.floor(b / 10) * 10;
  const onesRow = a * ones;
  const tensRow = a * tens;
  const sum = a * b;
  if (onesRow + tensRow !== sum) throw new Error("rows");
  const work = numberWork("Ones row, tens row and sum", [
    {
      label: "Ones row",
      fields: [{ label: "Ones row", value: String(onesRow) }],
    },
    {
      label: "Tens row",
      fields: [{ label: "Tens row", value: String(tensRow) }],
    },
    {
      label: "Sum",
      fields: [{ label: "Product", value: String(sum) }],
    },
  ]);
  return {
    family: "standard-algorithm-rows",
    prompt: `Complete the standard algorithm for ${comma(a)} × ${b}. Write the ones row, the full tens row, and the sum.`,
    hint: `The ones row is ${comma(a)} × ${ones}. The tens digit is ${tens / 10}, so the tens row is ${comma(a)} × ${tens}, and it starts in the tens place. An unshifted row is ten times too small. Add a carry after you multiply that digit, not before.`,
    explanation: [
      `${comma(a)} × ${ones} = ${comma(onesRow)}. That is the ones row.`,
      `${comma(a)} × ${tens} = ${comma(tensRow)}. The tens row starts in the tens place, so it is not ${comma(tensRow / 10)}.`,
      `${comma(onesRow)} + ${comma(tensRow)} = ${comma(sum)}.`,
      `So ${comma(a)} × ${b} = ${comma(sum)}.`,
    ],
    ...work,
  };
}

function carryBefore(n: number, d: number) {
  const digits = String(n).split("").map(Number).reverse();
  let carry = 0;
  let place = 1;
  let out = 0;
  for (const digit of digits) {
    const prod = (digit + carry) * d;
    out += (prod % 10) * place;
    carry = Math.floor(prod / 10);
    place *= 10;
  }
  return out + carry * place;
}

function findTheError(r: Random) {
  const shift = r(0, 1) === 0;
  if (shift) {
    const pin = r(0, 1) === 0;
    const a = pin ? 31 : r(12, 99);
    const onesDigit = pin ? 4 : r(2, 9);
    const tensDigit = pin ? 7 : r(2, 9);
    const b = tensDigit * 10 + onesDigit;
    const onesRow = a * onesDigit;
    const unshifted = a * tensDigit;
    const shown = onesRow + unshifted;
    const correct = `${comma(unshifted)} should be ${comma(unshifted * 10)}; the tens row starts in the tens place`;
    const cards: Card[] = [
      { label: correct, correct: true, feedback: "" },
      {
        label: `${comma(onesRow)} is wrong; ${a} × ${onesDigit} = ${comma(onesRow + 10)}`,
        feedback: `${a} × ${onesDigit} = ${comma(onesRow)}. The ones row was multiplied correctly.`,
      },
      {
        label: `${comma(shown)} is the right product`,
        feedback: `${comma(shown)} adds the tens row before shifting it. ${comma(a)} × ${b} = ${comma(a * b)}.`,
      },
      {
        label: "The rows are right but were added wrong",
        feedback: `${comma(onesRow)} + ${comma(unshifted)} = ${comma(shown)}, so the addition of the written rows is right. The tens row itself was not shifted.`,
      },
    ];
    const chosen = choiceResponse(r, cards);
    return {
      family: "unshifted-tens",
      prompt: `A worked multiplication shows ${a} × ${b} as ${comma(onesRow)} on the ones row, ${comma(unshifted)} on the tens row, and ${comma(shown)} as the sum. Which statement is right?`,
      hint: `Check the ones row by multiplying ${a} × ${onesDigit}. Then ask whether the tens row was written one place to the left. Adding the written rows can be correct even when one row is in the wrong place.`,
      explanation: [
        `${a} × ${onesDigit} = ${comma(onesRow)}, so the ones row is right.`,
        `The tens digit is ${tensDigit}, so the tens row is ${a} × ${tensDigit * 10} = ${comma(unshifted * 10)}, not ${comma(unshifted)}.`,
        `${comma(onesRow)} + ${comma(unshifted)} really is ${comma(shown)}, so the rows were not added wrong.`,
        `${comma(a)} × ${b} = ${comma(a * b)}.`,
      ],
      ...chosen,
    };
  }
  const pin = r(0, 1) === 0;
  let n = pin ? 754 : r(120, 899);
  let d = pin ? 9 : r(3, 9);
  let wrong = carryBefore(n, d);
  if (wrong === n * d) {
    n = 754;
    d = 9;
    wrong = carryBefore(n, d);
  }
  const ones = n % 10;
  const carry = Math.floor((ones * d) / 10);
  const tensDigit = Math.floor(n / 10) % 10;
  const correct = `The carry is added after multiplying: ${tensDigit} × ${d} + ${carry}`;
  const cards: Card[] = [
    { label: correct, correct: true, feedback: "" },
    {
      label: `${comma(wrong)} is the right product`,
      feedback: `${comma(n)} × ${d} = ${comma(n * d)}, not ${comma(wrong)}.`,
    },
    {
      label: `The ones digit is wrong because ${ones} × ${d} = ${ones * d + 10}`,
      feedback: `${ones} × ${d} = ${ones * d}. The ones digit of that product is written first. The carry is not added before that multiplication.`,
    },
    {
      label: `Add the carry to ${d} before multiplying any digit`,
      feedback: `The carry belongs to the next digit of ${comma(n)}, after that digit has been multiplied, not to the factor ${d}.`,
    },
  ];
  if (wrong === n * d) throw new Error("carry example is actually right");
  const chosen = choiceResponse(r, cards);
  return {
    family: "carry-before",
    prompt: `${comma(n)} × ${d} is shown as ${comma(wrong)}. The carry was added to the next digit before that digit was multiplied. Which statement is right?`,
    hint: `Multiply a digit first, then add the carry from the place on its right. Look at the tens digit of ${comma(n)} and the carry from the ones.`,
    explanation: [
      `${ones} × ${d} = ${ones * d}. Write ${ones * d % 10} and carry ${carry}.`,
      `The tens digit is multiplied next: ${tensDigit} × ${d} = ${tensDigit * d}, then add the carry ${carry}.`,
      `Adding the carry before multiplying the tens digit changes the product.`,
      `${comma(n)} × ${d} = ${comma(n * d)}, not ${comma(wrong)}.`,
    ],
    ...chosen,
  };
}

/* -------------------------------------------------- division models */

type Chunk = { width: number; area: number };
function chunksOf(n: number, d: number, places: number): Chunk[] {
  let rest = n;
  const out: Chunk[] = [];
  for (let p = places - 1; p >= 0; p--) {
    const unit = 10 ** p;
    const digit = Math.floor(rest / (d * unit));
    const width = digit * unit;
    const area = width * d;
    out.push({ width, area });
    rest -= area;
  }
  return out;
}

function divisionFigure(d: number, chunks: Chunk[]): SemanticFigure {
  const across = chunks.map((c) => c.width).filter((w) => w > 0);
  return {
    kind: "scene",
    scene: areaModel(across, [d], { products: "none", scale: "proportional" }).scene({
      width: 280,
      maxHeight: 220,
    }),
  };
}

function completeDivisionModel(r: Random) {
  const pin = r(0, 9);
  let d: number;
  let q: number;
  let rem: number;
  if (pin === 0) {
    d = 3;
    q = 363;
    rem = 0;
  } else if (pin === 1) {
    d = 4;
    q = 604;
    rem = 0;
  } else if (pin === 2) {
    d = 8;
    q = 61;
    rem = 5;
  } else {
    d = r(2, 9);
    const three = r(0, 4) < 2;
    const zero = r(0, 4) === 0;
    const hundreds = three ? r(1, 9) : 0;
    let tens = r(0, 9);
    let ones = r(0, 9);
    if (zero) tens = 0;
    if (!three && tens === 0 && ones === 0) ones = r(1, 9);
    q = hundreds * 100 + tens * 10 + ones;
    if (q < 11) q = 12;
    rem = r(0, 9) < 4 ? r(1, d - 1) : 0;
  }
  const places = q >= 100 ? 3 : 2;
  const n = d * q + rem;
  const chunks = chunksOf(n, d, places);
  if (chunks.reduce((s, c) => s + c.width, 0) !== q) throw new Error("widths");
  const rows: WorkSpec[] = [];
  for (let i = 0; i < chunks.length; i += 1) {
    const place = ["Hundreds", "Tens", "Ones"].slice(chunks.length === 2 ? 1 : 0);
    rows.push({
      label: `${place[i]} chunk`,
      fields: [
        { label: "Width", value: String(chunks[i]!.width) },
        { label: "Area", value: String(chunks[i]!.area) },
      ],
    });
  }
  rows.push(
    rem
      ? {
          label: "Quotient and remainder",
          fields: [
            { label: "Quotient", value: String(q) },
            { label: "Remainder", value: String(rem) },
          ],
        }
      : {
          label: "Quotient",
          fields: [{ label: "Quotient", value: String(q) }],
        },
  );
  const work = numberWork("Chunk widths, areas and quotient", rows);
  const zero = chunks.find((c) => c.width === 0);
  return {
    family: rem ? "with-remainder" : "exact",
    prompt: rem
      ? `Fill in each chunk's width and area for ${comma(n)} ÷ ${d}, then the quotient and remainder. A place that does not fit has width 0 and area 0.`
      : `Fill in each chunk's width and area for ${comma(n)} ÷ ${d}, then the quotient. A place that does not fit has width 0 and area 0.`,
    hint: `Share the largest place first. The chunk width is the largest multiple of that place whose area is not more than what is left. A leftover at least as large as ${d} means another chunk fits. A place that does not fit is written 0, not skipped.`,
    explanation: [
      ...chunks.map(
        (c, i) =>
          `${["The first", "The next", "The last"][Math.min(i, 2)]} chunk is width ${comma(c.width)} and area ${comma(c.area)}, because ${d} × ${comma(c.width)} = ${comma(c.area)}.`,
      ),
      rem
        ? `${comma(n)} − ${comma(d * q)} = ${rem}, and ${rem} is less than ${d}. ${comma(n)} ÷ ${d} = ${q} R ${rem}. Check: ${d} × ${q} + ${rem} = ${comma(n)}.`
        : `The widths add to ${q}. Check: ${d} × ${q} = ${comma(n)}.`,
      zero
        ? `The width 0 is required. Skipping that place would drop a zero from ${q}.`
        : `Every place had a nonzero chunk.`,
    ],
    figure: divisionFigure(d, chunks),
    ...work,
  };
}

function chunkModel(r: Random) {
  const pin = r(0, 9);
  let d: number;
  let q: number;
  let rem: number;
  let style: "exact-2" | "exact-3" | "rem-2" | "rem-3";
  if (pin === 0) {
    d = 31;
    q = 29;
    rem = 0;
    style = "exact-2";
  } else if (pin === 1) {
    d = 16;
    q = 107;
    rem = 14;
    style = "rem-3";
  } else {
    const roll = r(0, 9);
    style =
      roll < 5 ? "exact-2" : roll < 6 ? "exact-3" : roll < 9 ? "rem-2" : "rem-3";
    d = r(11, 89);
    if (style === "exact-2" || style === "rem-2") {
      q = r(11, 99);
    } else if (style === "exact-3") {
      const tens = r(0, 3) === 0 ? 0 : r(0, 9);
      q = r(1, 9) * 100 + tens * 10 + r(0, 9);
    } else {
      q = r(1, 9) * 100 + r(1, 9);
    }
    rem = style.startsWith("rem") ? r(1, d - 1) : 0;
    while (d * q + rem > 9999 && q > 200) q -= style.endsWith("3") ? 100 : 1;
    if (d * q + rem > 9999) {
      d = 12;
      q = style.endsWith("3") ? 101 : 24;
      rem = style.startsWith("rem") ? 5 : 0;
    }
    if (style === "rem-3") q = Math.floor(q / 100) * 100 + (q % 10 || 1);
    if (style.endsWith("3") && q < 100) q += 100;
    if (style.endsWith("2") && q > 99) q = 24;
  }
  const places = q >= 100 ? 3 : 2;
  const n = d * q + rem;
  const chunks = chunksOf(n, d, places);
  if (chunks.reduce((s, c) => s + c.width, 0) !== q) throw new Error("chunk widths");
  let rows: WorkSpec[];
  if (style === "rem-3") {
    const [h, t, o] = chunks;
    if (!h || !t || !o || t.width !== 0) throw new Error("zero tens");
    rows = [
      {
        label: "Hundreds chunk",
        fields: [
          { label: "Width", value: String(h.width) },
          { label: "Area", value: String(h.area) },
        ],
      },
      {
        label: "Tens width and ones width",
        fields: [
          { label: "Tens width", value: "0" },
          { label: "Ones width", value: String(o.width) },
        ],
      },
      {
        label: "Ones area and leftover",
        fields: [
          { label: "Ones area", value: String(o.area) },
          { label: "Remainder", value: String(rem) },
        ],
      },
    ];
  } else if (style === "rem-2") {
    rows = [
      {
        label: "Tens chunk",
        fields: [
          { label: "Width", value: String(chunks[0]!.width) },
          { label: "Area", value: String(chunks[0]!.area) },
        ],
      },
      {
        label: "Ones chunk",
        fields: [
          { label: "Width", value: String(chunks[1]!.width) },
          { label: "Area", value: String(chunks[1]!.area) },
        ],
      },
      {
        label: "Quotient and remainder",
        fields: [
          { label: "Quotient", value: String(q) },
          { label: "Remainder", value: String(rem) },
        ],
      },
    ];
  } else if (style === "exact-3") {
    const names = ["Hundreds", "Tens", "Ones"];
    rows = chunks.map((c, i) => ({
      label: `${names[i]} chunk`,
      fields: [
        { label: "Width", value: String(c.width) },
        { label: "Area", value: String(c.area) },
      ],
    }));
    rows.push({
      label: "Quotient",
      fields: [{ label: "Quotient", value: String(q) }],
    });
  } else {
    rows = [
      {
        label: "Tens chunk",
        fields: [
          { label: "Width", value: String(chunks[0]!.width) },
          { label: "Area", value: String(chunks[0]!.area) },
        ],
      },
      {
        label: "Ones chunk",
        fields: [
          { label: "Width", value: String(chunks[1]!.width) },
          { label: "Area", value: String(chunks[1]!.area) },
        ],
      },
      {
        label: "Quotient",
        fields: [{ label: "Quotient", value: String(q) }],
      },
    ];
  }
  const work = numberWork("Chunk widths and areas", rows);
  return {
    family: style,
    prompt:
      style === "rem-3"
        ? `Fill the rectangle for ${comma(n)} ÷ ${d} in place-value chunks. Write the hundreds width and area, the tens width (0 when that place does not fit), the ones width, the ones area, and the leftover.`
        : `Fill the rectangle for ${comma(n)} ÷ ${d} in chunks: the largest place first, then the smaller places. Write each width and area${rem ? ", then the quotient and the leftover" : ", then the quotient"}. A place that does not fit has width 0 and area 0.`,
    hint: `Round ${d} to estimate, then check. The first width is the largest multiple of its place whose product with ${d} is not more than ${comma(n)}. A later place that does not fit is 0. The leftover must be less than ${d}.`,
    explanation: [
      ...chunks.map(
        (c) =>
          `${d} × ${comma(c.width)} = ${comma(c.area)}.`,
      ),
      rem
        ? `The widths add to ${q}, and ${comma(n)} − ${comma(d * q)} = ${rem}. ${d} × ${q} + ${rem} = ${comma(n)}.`
        : `The widths add to ${q}. ${d} × ${q} = ${comma(n)}.`,
      `A difference of ${d} or more would mean another group of ${d} still fits.`,
    ],
    figure: divisionFigure(d, chunks),
    ...work,
  };
}

function firstChunkChoice(r: Random) {
  const pin = r(0, 4) === 0;
  let d = pin ? 31 : r(11, 89);
  let q = pin ? 29 : r(11, 99);
  let width = Math.floor(q / 10) * 10;
  if (d === width) d = d >= 80 ? 31 : d + 11;
  let n = d * q;
  const given = `${n} ${d}`.replace(/,/g, "");
  if (new RegExp(`(?<![\\d])${width}(?![\\d])`).test(given)) {
    q = q >= 90 ? q - 10 : q + 10;
    width = Math.floor(q / 10) * 10;
    if (d === width) d = 31;
    n = d * q;
  }
  const too = width + 10;
  const small = width / 10;
  const huge = width * 10;
  const cards: Card[] = [
    { label: String(width), correct: true, feedback: "" },
    {
      label: String(too),
      feedback: `${d} × ${too} = ${comma(d * too)}, which is more than ${comma(n)}. The estimate was not checked.`,
    },
    {
      label: String(small),
      feedback: `${count(small, "one")} is ${count(width, "ten")} written in the ones place. The first width is ${width}.`,
    },
    {
      label: String(huge),
      feedback: `${huge} is ${width} tens written as hundreds. ${d} × ${huge} is far more than ${comma(n)}.`,
    },
  ];
  const chosen = choiceResponse(r, cards);
  return {
    family: "first-chunk-choice",
    prompt: `For ${comma(n)} ÷ ${d}, what is the largest multiple of ten that fits as the first width?`,
    hint: `Try the next ten above your estimate. If ${d} times that width is more than ${comma(n)}, it does not fit. Do not drop a zero or add an extra zero.`,
    explanation: [
      `${d} × ${width} = ${comma(d * width)}, and ${comma(d * width)} is not more than ${comma(n)}.`,
      `${d} × ${too} = ${comma(d * too)}, which is more than ${comma(n)}.`,
      `${width} is the largest multiple of ten that fits.`,
      `${small} and ${huge} are the same digits with the place shifted.`,
    ],
    ...chosen,
  };
}

/* -------------------------------------------------- factor pairs */

function pairsOf(n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 1; i * i <= n; i++)
    if (n % i === 0) out.push([i, n / i]);
  return out;
}
const PRIMES = [13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
const SQUARES = [16, 25, 36, 49, 64, 81, 100];
const MANY = Array.from({ length: 89 }, (_, i) => i + 12).filter(
  (n) => pairsOf(n).length >= 3,
);

function pairNumber(r: Random) {
  const pin = r(0, 4);
  if (pin === 0) return 36;
  if (pin === 1) return 40;
  const roll = r(0, 9);
  if (roll === 0) return pick(r, PRIMES);
  if (roll <= 2) return pick(r, SQUARES);
  return pick(r, MANY);
}
const pairText = (pairs: [number, number][]) =>
  pairs.map(([a, b]) => `${a} × ${b}`).join(", ");

function listAllPairs(r: Random) {
  const n = pairNumber(r);
  const pairs = pairsOf(n);
  const rows: WorkSpec[] = pairs.map(([a, b], i) => ({
    label: `Pair ${i + 1}`,
    fields: [
      { label: "Smaller factor", value: String(a) },
      { label: "Partner", value: String(b) },
    ],
  }));
  const work = numberWork("Factor pairs", rows);
  return {
    family: pairs.length >= 3 ? "several-pairs" : pairs.length === 1 ? "prime" : "two-pairs",
    prompt: `List every factor pair of ${n}, smaller number first, in increasing order of the smaller factor. A square pair is entered once. Do not list a turned pair again.`,
    hint: `Try 1, then 2, then 3, and so on. When a number divides ${n}, its partner is ${n} divided by that number. Stop when the partner would be smaller than the number you are trying. ${n} is not tested by multiplying two numbers that do not divide it.`,
    explanation: [
      `The factor pairs of ${n} are ${pairText(pairs)}.`,
      `They are in increasing order of the smaller factor, and each pair multiplies to ${n}.`,
      pairs.some(([a, b]) => a === b)
        ? `${Math.sqrt(n)} × ${Math.sqrt(n)} is entered once because ${n} is a square.`
        : `No pair uses the same factor twice, because ${n} is not a square.`,
      `A turned pair, such as the partner written first, is the same pair again. A product that is not ${n} is not a factor pair.`,
    ],
    ...work,
  };
}

function completeListChoice(r: Random) {
  const n = r(0, 2) === 0 ? 40 : pairNumber(r);
  const pairs = pairsOf(n);
  const correct = pairText(pairs);
  const forgot = pairText(pairs.slice(1));
  const missed =
    pairs.length >= 3
      ? pairText(pairs.filter((_, i) => i !== 2))
      : pairs.length === 2
        ? pairText(pairs.slice(0, 1))
        : `${n} × ${n}`;
  const last = pairs[pairs.length - 1]!;
  const turned =
    last[0] === last[1]
      ? `${correct}, ${last[0] + 1} × ${n}`
      : `${correct}, ${last[1]} × ${last[0]}`;
  const cards: Card[] = [
    { label: correct, correct: true, feedback: "" },
    {
      label: forgot || `${n} × 1`,
      feedback: `The list leaves out 1 × ${n}. One and the number itself are a factor pair.`,
    },
    {
      label: missed,
      feedback: `A pair in the middle is missing. Stopping early does not list every pair.`,
    },
    {
      label: turned,
      feedback:
        last[0] === last[1]
          ? `The extra pair does not multiply to ${n}.`
          : `${last[1]} × ${last[0]} is ${last[0]} × ${last[1]} turned. It is already listed.`,
    },
  ];
  if (cards.some((c) => c.label.length > 120)) throw new Error("pair list length");
  const chosen = choiceResponse(r, cards);
  return {
    family: n === 40 ? "forty" : "other",
    prompt: `Which list shows all the factor pairs of ${n}?`,
    hint: `Start at 1 and ${n}, then the next divisor. Each pair is written smaller factor first, once. A pair written the other way is not a new pair.`,
    explanation: [
      `The factor pairs of ${n} are ${correct}.`,
      `Leaving out 1 × ${n} drops the number itself.`,
      `Stopping before every divisor misses a pair.`,
      last[0] === last[1]
        ? `The square pair is already a single pair.`
        : `${last[1]} × ${last[0]} is ${last[0]} × ${last[1]} turned, so the longer list double-counts.`,
    ],
    ...chosen,
  };
}

/* -------------------------------------------------- long division */

/** Quotient digits, products, differences and bring-downs, 11 cells for a
 * three-digit quotient. Bring-down values sit after each difference except
 * the last. */
export function bracketCells(n: number, d: number): number[] {
  const s = String(n);
  let acc = 0;
  let started = false;
  const steps: { digit: number; product: number; diff: number }[] = [];
  for (const ch of s) {
    acc = acc * 10 + Number(ch);
    const digit = Math.floor(acc / d);
    if (!started && digit === 0) continue;
    started = true;
    const product = digit * d;
    const diff = acc - product;
    steps.push({ digit, product, diff });
    acc = diff;
  }
  if (steps.length !== 3) throw new Error(`${n} ÷ ${d} did not make 3 digits`);
  const cells: number[] = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    cells.push(step.digit, step.product, step.diff);
    if (i < steps.length - 1) {
      const next = steps[i + 1]!;
      cells.push(next.product + next.diff);
    }
  }
  return cells;
}

function bracketSteps(r: Random) {
  const pin = r(0, 4);
  let n: number;
  let d: number;
  if (pin === 0) {
    n = 15312;
    d = 48;
  } else if (pin === 1) {
    n = 18672;
    d = 62;
  } else {
    d = r(12, 89);
    const zero = r(0, 3) === 0;
    const q = zero ? r(1, 9) * 100 + r(1, 9) : r(100, 999);
    const rem = r(0, 1) === 0 ? r(1, d - 1) : 0;
    n = d * q + rem;
  }
  const cells = bracketCells(n, d);
  if (cells.length !== 11) throw new Error("cell count");
  const q = cells[0]! * 100 + cells[4]! * 10 + cells[8]!;
  const rem = cells[10]!;
  if (d * q + rem !== n || rem >= d) throw new Error("bracket check");
  const labels = [
    ["First quotient digit", "First product"],
    ["First difference", "First bring-down"],
    ["Second quotient digit", "Second product"],
    ["Second difference", "Second bring-down"],
    ["Third quotient digit", "Third product"],
    ["Last difference"],
  ];
  const rows: WorkSpec[] = [];
  let k = 0;
  for (const pair of labels) {
    rows.push({
      label: pair.join(" and "),
      fields: pair.map((label) => ({ label, value: String(cells[k++]!) })),
    });
  }
  const work = numberWork("Long-division cells", rows);
  return {
    family: rem ? "remainder" : "exact",
    prompt: `Complete the long division ${comma(n)} ÷ ${d}. Enter the eleven cells in order: first quotient digit, first product, first difference, first bring-down, second quotient digit, second product, second difference, second bring-down, third quotient digit, third product, last difference. A place that does not fit has quotient digit 0.`,
    hint: `Start at the left. The first part of ${comma(n)} that is at least ${d} gives the first digit. Multiply, subtract, and bring down the next digit. Each difference has to be less than ${d}; a larger difference means another ${d} fits. A place that will not share is written 0.`,
    explanation: [
      `The quotient digits are ${cells[0]}, ${cells[4]} and ${cells[8]}, so the quotient is ${q}.`,
      `The products are ${comma(cells[1]!)}, ${comma(cells[5]!)} and ${comma(cells[9]!)}.`,
      `The differences are ${cells[2]}, ${cells[6]} and ${cells[10]}, each less than ${d}.`,
      rem
        ? `${d} × ${q} + ${rem} = ${comma(n)}, so the remainder is ${rem}.`
        : `${d} × ${q} = ${comma(n)}.`,
    ],
    ...work,
  };
}

function spotTheError(r: Random) {
  const kind = r(0, 1) === 0 ? "remainder" : "zero";
  if (kind === "remainder") {
    const pin = r(0, 1) === 0;
    const d = pin ? 79 : r(12, 89);
    const q = pin ? 77 : r(12, 200);
    const rem = pin ? 17 : r(0, d - 1);
    const n = d * q + rem;
    const shownQ = q - 1;
    const shownR = rem + d;
    const correct = `${comma(shownR)} is bigger than ${d}, so another ${d} fits: ${q} R ${rem}`;
    const cards: Card[] = [
      { label: correct, correct: true, feedback: "" },
      {
        label: `${shownQ} × ${d} was multiplied wrong`,
        feedback: `${shownQ} × ${d} = ${comma(shownQ * d)}, and ${comma(n)} − ${comma(shownQ * d)} = ${comma(shownR)}. The multiplication matches the written remainder. The remainder is too big.`,
      },
      {
        label: `The remainder should be written 0.${shownR}`,
        feedback: `A remainder is a whole number of leftover objects, not a decimal attached to the quotient.`,
      },
      {
        label: "It is correct",
        feedback: `${comma(shownR)} is not less than ${d}, so another group of ${d} fits.`,
      },
    ];
    const chosen = choiceResponse(r, cards);
    return {
      family: "big-remainder",
      prompt: `${comma(n)} ÷ ${d} is shown as ${shownQ} R ${shownR}. Which statement is right?`,
      hint: `Compare the written remainder with ${d}. If the remainder is at least ${d}, the last quotient digit can go up by one.`,
      explanation: [
        `${d} × ${shownQ} = ${comma(d * shownQ)}, and ${comma(n)} − ${comma(d * shownQ)} = ${comma(shownR)}.`,
        `${comma(shownR)} is bigger than ${d}, so another ${d} fits.`,
        `${d} × ${q} = ${comma(d * q)}, and ${comma(n)} − ${comma(d * q)} = ${rem}.`,
        `The quotient is ${q} R ${rem}.`,
      ],
      ...chosen,
    };
  }
  const pin = r(0, 1) === 0;
  const d = pin ? 62 : r(12, 89);
  const q = pin ? 301 : r(1, 9) * 100 + r(1, 9);
  const rem = pin ? 10 : r(1, d - 1);
  const n = d * q + rem;
  const shown = Math.floor(q / 100) * 10 + (q % 10);
  const correct = `The tens place would not share and needs a 0: ${q} R ${rem}`;
  const guess = Math.round(d / 10) * 10;
  const cards: Card[] = [
    { label: correct, correct: true, feedback: "" },
    {
      label: "The remainder should be 0",
      feedback: `${comma(n)} − ${d} × ${q} = ${rem}, so the remainder is ${rem}, not 0.`,
    },
    {
      label: "It is correct",
      feedback: `${shown} R ${rem} drops the tens digit. ${d} × ${shown} is not close to ${comma(n)}.`,
    },
    {
      label: `Estimate the divisor as ${guess}, giving ${shown + 1}`,
      feedback: `Estimating ${d} as ${guess} does not make the quotient ${shown + 1}. The missing digit is 0 in the tens place.`,
    },
  ];
  const chosen = choiceResponse(r, cards);
  return {
    family: "missing-zero",
    prompt: `${comma(n)} ÷ ${d} is shown as ${shown} R ${rem}. Which statement is right?`,
    hint: `After the hundreds digit, look at the next place. If what is left is less than ${d}, that place is 0 in the quotient and the next digit is brought down.`,
    explanation: [
      `${d} × ${q} = ${comma(d * q)}, and ${comma(n)} − ${comma(d * q)} = ${rem}.`,
      `The tens digit of ${q} is 0 because that place would not share.`,
      `Writing ${shown} drops that 0, so the hundreds digit slides into the tens place.`,
      `The quotient is ${q} R ${rem}.`,
    ],
    ...chosen,
  };
}

/* -------------------------------------------------- dispatch */

const storyTemplates = new Map(storyForExpressionTemplates.map((t) => [t.id, t]));
const clauseTemplates = new Map(multiplicationClauseTemplates.map((t) => [t.id, t]));

export function generateStoryForExpression(templateId: string, seed: string) {
  const template = storyTemplates.get(templateId);
  if (!template) throw new Error(`Unknown story template ${templateId}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  const built =
    templateId === "story-both-interpretations" ? storyBoth(r) : storyForExpression(r);
  return finish(template, seed, built);
}

const builders: Record<string, (r: Random) => Parameters<typeof finish>[2]> = {
  "partition-from-marks": partitionFromMarks,
  "choose-partition": choosePartition,
  "regions-to-whole": regionsToWhole,
  "which-split": whichSplit,
  "facts-from-known": factsFromKnown,
  "associative-compute": associativeCompute,
  "split-the-dividend": splitDividend,
  "complete-area-model": completeAreaModel,
  "explain-part": explainPart,
  "partial-products-by-place": partialProducts,
  "standard-algorithm-rows": standardRows,
  "find-the-error": findTheError,
  "complete-division-model": completeDivisionModel,
  "chunk-model": chunkModel,
  "first-chunk-choice": firstChunkChoice,
  "list-all-pairs": listAllPairs,
  "complete-list-choice": completeListChoice,
  "bracket-steps": bracketSteps,
  "spot-the-error": spotTheError,
};

export function generateMultiplicationClause(templateId: string, seed: string) {
  const template = clauseTemplates.get(templateId);
  const build = builders[templateId];
  if (!template || !build) throw new Error(`Unknown clause template ${templateId}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  return finish(template, seed, build(r));
}
