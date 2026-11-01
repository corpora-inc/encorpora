import { count as plural } from "./agreement";
import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts.js";
import type { ShapeKind } from "./data-display-models.js";

/** Sorting, picture graphs and scaled bar graphs (K–3 data). */
const charts = { requiredFigureCapability: "data-displays-v1" } as const;
export const earlyDataTemplates: readonly TemplateMetadata[] = [
  {
    id: "sort-shapes-count",
    version: 1,
    ...charts,
    title: "Sort and count",
    skillId: "sort-and-count",
    gradeBand: "K–2",
    description:
      "Sort up to fifteen shapes by kind and count the shapes in one group.",
  },
  {
    id: "sort-shapes-most",
    version: 1,
    ...charts,
    requiredResponseCapability: "single-choice-v1",
    title: "Which group is biggest?",
    skillId: "sort-and-count",
    gradeBand: "K–2",
    description:
      "Sort shapes by kind and choose the group with the most or the fewest.",
  },
  {
    id: "picture-graph-questions",
    version: 1,
    ...charts,
    title: "Read a picture graph",
    skillId: "categorical-data",
    gradeBand: "K–2",
    description:
      "Answer total, how-many-more and how-many-fewer questions from a three-category picture graph.",
  },
  {
    id: "scaled-picture-graph",
    version: 1,
    ...charts,
    title: "Use a picture graph key",
    skillId: "scaled-graphs",
    gradeBand: "3–5",
    description:
      "Read a picture graph whose symbol stands for 2, 5 or 10, including half symbols, and compare categories.",
  },
  {
    id: "scaled-bar-graph",
    version: 1,
    ...charts,
    title: "Read a scaled bar graph",
    skillId: "scaled-graphs",
    gradeBand: "3–5",
    description:
      "Read bars on a scale of 2, 5 or 10, including halfway values, and solve one- and two-step comparisons.",
  },
];

function random(id: string, seed: string) {
  let counter = 0;
  return (lo: number, hi: number) => {
    const span = hi - lo + 1,
      limit = Math.floor(0x100000000 / span) * span;
    let n: number;
    do
      n = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    while (n >= limit);
    return lo + (n % span);
  };
}
type Random = ReturnType<typeof random>;
/** Chosen labels keep their natural order (days, seasons, the list order). */
function choose(r: Random, items: readonly string[], count: number) {
  return pick(r, items, count).sort(
    (a, b) => items.indexOf(a) - items.indexOf(b),
  );
}
function pick<T>(r: Random, items: readonly T[], count: number): T[] {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = r(0, i);
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, count);
}

const shapeNames: Record<ShapeKind, [string, string]> = {
  circle: ["circle", "circles"],
  square: ["square", "squares"],
  triangle: ["triangle", "triangles"],
};
const kinds: ShapeKind[] = ["circle", "square", "triangle"];

/** Who chose what: every picture-graph context counts students. */
const pictureContexts = [
  {
    noun: "fruit",
    labels: ["apple", "banana", "grape", "pear", "peach", "plum"],
  },
  { noun: "pet", labels: ["cat", "dog", "fish", "bird", "rabbit"] },
  { noun: "season", labels: ["spring", "summer", "fall", "winter"] },
  {
    noun: "sport",
    labels: ["soccer", "tennis", "swimming", "running", "biking"],
  },
] as const;
const barContexts = [
  {
    intro: "The bar graph shows how many books each student read.",
    unit: "books",
    one: "book",
    labels: ["Ana", "Ben", "Kai", "Lia", "Omar", "Zoe"],
    more: (a: string, b: string) =>
      `How many more books did ${a} read than ${b}?`,
    fewer: (a: string, b: string) =>
      `How many fewer books did ${a} read than ${b}?`,
    together: (a: string, b: string, c: string) =>
      `How many more books did ${a} and ${b} read together than ${c}?`,
    total: "How many books did the four students read in all?",
  },
  {
    intro: "The bar graph shows how many cans a class collected each day.",
    unit: "cans",
    one: "can",
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    more: (a: string, b: string) =>
      `How many more cans were collected on ${a} than on ${b}?`,
    fewer: (a: string, b: string) =>
      `How many fewer cans were collected on ${a} than on ${b}?`,
    together: (a: string, b: string, c: string) =>
      `How many more cans were collected on ${a} and ${b} together than on ${c}?`,
    total: "How many cans were collected on the four days in all?",
  },
  {
    intro: "The bar graph shows how many laps each runner finished.",
    unit: "laps",
    one: "lap",
    labels: ["Ava", "Eli", "Mia", "Noah", "Sam"],
    more: (a: string, b: string) =>
      `How many more laps did ${a} finish than ${b}?`,
    fewer: (a: string, b: string) =>
      `How many fewer laps did ${a} finish than ${b}?`,
    together: (a: string, b: string, c: string) =>
      `How many more laps did ${a} and ${b} finish together than ${c}?`,
    total: "How many laps did the four runners finish in all?",
  },
] as const;

type Draft = {
  prompt: string;
  figure: SemanticFigure;
  answer: number;
  hint: string;
  explanation: string[];
  choices?: { label: string; correct?: true; feedback?: string }[];
};

function sortCount(r: Random): Draft {
  const counts = kinds.map(() => r(1, 5));
  const shapes = pick(
    r,
    kinds.flatMap((k, i) => Array<ShapeKind>(counts[i]!).fill(k)),
    15,
  );
  const target = r(0, 2),
    [, many] = shapeNames[kinds[target]!];
  return {
    prompt: `Sort the shapes by kind. How many ${many} are there?`,
    figure: { kind: "sort-shapes", shapes },
    answer: counts[target]!,
    hint: `Put the shapes into three groups by kind. Count only the ${many}, touching each one once.`,
    explanation: [
      `Sort into groups: ${kinds.map((k, i) => plural(counts[i]!, ...shapeNames[k])).join(", ")}.`,
      `Check: ${counts.join(" + ")} = ${shapes.length}, the number of shapes in the picture.`,
      `The group of ${many} has ${counts[target]}.`,
    ],
  };
}

function sortMost(r: Random): Draft {
  let counts: number[];
  const most = r(0, 1) === 0;
  do counts = kinds.map(() => r(1, 6));
  while (
    counts.filter((c) => c === (most ? Math.max : Math.min)(...counts))
      .length !== 1 ||
    counts.reduce((a, b) => a + b, 0) > 15
  );
  const shapes = pick(
    r,
    kinds.flatMap((k, i) => Array<ShapeKind>(counts[i]!).fill(k)),
    15,
  );
  const extreme = (most ? Math.max : Math.min)(...counts),
    winner = counts.indexOf(extreme),
    word = most ? "most" : "fewest";
  const name = (i: number) => shapeNames[kinds[i]!][1];
  const title = (i: number) => name(i)[0]!.toUpperCase() + name(i).slice(1);
  return {
    prompt: `Sort the shapes by kind. Which kind has the ${word} shapes?`,
    figure: { kind: "sort-shapes", shapes },
    answer: winner,
    hint: `Sort the shapes into ${kinds.map((_, i) => name(i)).join(", ")}, counting each group. Then find the ${most ? "largest" : "smallest"} count.`,
    explanation: [
      `Count each group: ${kinds.map((k, i) => plural(counts[i]!, ...shapeNames[k])).join(", ")}.`,
      `${extreme} is the ${most ? "greatest" : "least"} of ${counts.join(", ")}.`,
      `The ${name(winner)} group has the ${word}.`,
    ],
    choices: kinds.map((_, i) =>
      i === winner
        ? { label: title(i), correct: true }
        : {
            label: title(i),
            feedback: `There ${counts[i] === 1 ? "is" : "are"} ${plural(counts[i]!, ...shapeNames[kinds[i]!])} and ${plural(extreme, ...shapeNames[kinds[winner]!])}. Count every group before comparing.`,
          },
    ),
  };
}

function pictureGraph(r: Random): Draft {
  const context = pictureContexts[r(0, pictureContexts.length - 1)]!;
  const labels = choose(r, context.labels, 3);
  let counts: number[];
  do counts = labels.map(() => r(1, 9));
  while (new Set(counts).size < 3);
  const figure: SemanticFigure = {
    kind: "picture-graph",
    categories: labels.map((label, i) => ({ label, count: counts[i]! })),
    key: 1,
    unit: "students",
  };
  const intro = `The picture graph shows each student’s favorite ${context.noun}.`;
  const read = labels
    .map((l, i) => `${l} has ${counts[i]} symbol${counts[i] === 1 ? "" : "s"}`)
    .join(", ");
  const question = r(0, 2);
  if (question === 0) {
    const total = counts.reduce((a, b) => a + b, 0);
    return {
      prompt: `${intro} How many students are shown in all?`,
      figure,
      answer: total,
      hint: "Each symbol is one student. Count the symbols in each row, then add the three rows.",
      explanation: [
        `Each symbol stands for 1 student: ${read}.`,
        `Add the rows: ${counts.join(" + ")} = ${total}.`,
      ],
    };
  }
  const [i, j] = pick(r, [0, 1, 2], 2).sort((a, b) => counts[b]! - counts[a]!);
  const big = labels[i!]!,
    small = labels[j!]!,
    diff = counts[i!]! - counts[j!]!;
  return {
    prompt:
      question === 1
        ? `${intro} How many more students chose ${big} than ${small}?`
        : `${intro} How many fewer students chose ${small} than ${big}?`,
    figure,
    answer: diff,
    hint: `Line up the ${big} and ${small} rows symbol by symbol. Count the symbols that have no partner.`,
    explanation: [
      `${big} has ${plural(counts[i!]!, "student")}; ${small} has ${plural(counts[j!]!, "student")}.`,
      `Match them one to one. The unmatched symbols show the difference: ${counts[i!]} − ${counts[j!]} = ${diff}.`,
      question === 1
        ? `${diff} more ${diff === 1 ? "student" : "students"} chose ${big}.`
        : `${diff} fewer ${diff === 1 ? "student" : "students"} chose ${small}.`,
    ],
  };
}

function scaledPicture(r: Random): Draft {
  const context = pictureContexts[r(0, pictureContexts.length - 1)]!;
  const key = ([2, 5, 10] as const)[r(0, 2)]!;
  const labels = choose(r, context.labels, 4);
  let counts: number[];
  do
    counts = labels.map(
      () => r(1, 8) * key + (key % 2 === 0 && r(0, 2) === 0 ? key / 2 : 0),
    );
  while (new Set(counts).size < 4);
  const figure: SemanticFigure = {
    kind: "picture-graph",
    categories: labels.map((label, i) => ({ label, count: counts[i]! })),
    key,
    unit: "students",
  };
  const intro = `The picture graph shows the favorite ${context.noun} of students in a school.`;
  const readRow = (i: number) => {
    const whole = Math.floor(counts[i]! / key),
      half = counts[i]! % key !== 0;
    return half
      ? `${labels[i]}: ${whole} whole symbol${whole === 1 ? "" : "s"} and a half symbol, ${whole} × ${key} + ${key / 2} = ${counts[i]}`
      : `${labels[i]}: ${whole} symbol${whole === 1 ? "" : "s"}, ${whole} × ${key} = ${counts[i]}`;
  };
  const keyLine = `The key shows that each symbol stands for ${key} students${key % 2 === 0 ? `, so half a symbol stands for ${key / 2}` : ""}.`;
  const question = r(0, 2);
  if (question === 0) {
    const order = pick(r, [0, 1, 2, 3], 4);
    const i = order.find((k) => counts[k]! % key !== 0) ?? order[0]!;
    return {
      prompt: `${intro} How many students chose ${labels[i]}?`,
      figure,
      answer: counts[i]!,
      hint: "Read the key first. Multiply the number of whole symbols by the key, then add half the key for a half symbol.",
      explanation: [keyLine, `${readRow(i)}.`],
    };
  }
  if (question === 1) {
    const [i, j] = pick(r, [0, 1, 2, 3], 2).sort(
      (a, b) => counts[b]! - counts[a]!,
    );
    const diff = counts[i!]! - counts[j!]!;
    return {
      prompt: `${intro} How many more students chose ${labels[i!]} than ${labels[j!]}?`,
      figure,
      answer: diff,
      hint: "Use the key to turn each row of symbols into a number of students. Then subtract.",
      explanation: [
        keyLine,
        `${readRow(i!)}.`,
        `${readRow(j!)}.`,
        `${counts[i!]} − ${counts[j!]} = ${diff}.`,
      ],
    };
  }
  let triple: number[];
  do triple = pick(r, [0, 1, 2, 3], 3);
  while (counts[triple[0]!]! + counts[triple[1]!]! <= counts[triple[2]!]!);
  const [a, b, c] = triple as [number, number, number];
  const sum = counts[a]! + counts[b]!,
    diff = sum - counts[c]!;
  return {
    prompt: `${intro} How many more students chose ${labels[a]} or ${labels[b]} than chose ${labels[c]}?`,
    figure,
    answer: diff,
    hint: `Two steps: add the ${labels[a]} and ${labels[b]} rows, then subtract the ${labels[c]} row. Use the key for every row.`,
    explanation: [
      keyLine,
      `${readRow(a)}.`,
      `${readRow(b)}.`,
      `${readRow(c)}.`,
      `Together: ${counts[a]} + ${counts[b]} = ${sum}. Compare: ${sum} − ${counts[c]} = ${diff}.`,
    ],
  };
}

function scaledBar(r: Random): Draft {
  const context = barContexts[r(0, barContexts.length - 1)]!;
  const step = ([2, 5, 10] as const)[r(0, 2)]!;
  const lines = r(6, 10),
    max = step * lines;
  const labels = choose(r, context.labels, 4);
  const half = step % 2 === 0 ? step / 2 : step;
  let values: number[];
  do values = labels.map(() => r(1, max / half) * half);
  while (new Set(values).size < 4);
  const figure: SemanticFigure = {
    kind: "scaled-bar-graph",
    categories: labels.map((label, i) => ({ label, value: values[i]! })),
    step,
    max,
    unit: context.unit,
  };
  const read = (i: number) => {
    const v = values[i]!;
    return v % step === 0
      ? `${labels[i]}’s bar ends on the ${v} line`
      : `${labels[i]}’s bar ends halfway between ${v - half} and ${v + half}, at ${v}`;
  };
  const scale = `The scale counts by ${step}s${step % 2 === 0 ? `; halfway between two lines is ${half} more` : ""}.`;
  const question = r(0, 3);
  if (question === 3) {
    const total = values.reduce((a, b) => a + b, 0);
    return {
      prompt: `${context.intro} ${context.total}`,
      figure,
      answer: total,
      hint: "Read each bar against the scale, not by counting grid squares as 1. Then add the four values.",
      explanation: [
        scale,
        ...values.map((_, i) => `${read(i)}.`),
        `${values.join(" + ")} = ${total}.`,
      ],
    };
  }
  if (question === 2) {
    let triple: number[];
    do triple = pick(r, [0, 1, 2, 3], 3);
    while (values[triple[0]!]! + values[triple[1]!]! <= values[triple[2]!]!);
    const [a, b, c] = triple as [number, number, number];
    const sum = values[a]! + values[b]!,
      diff = sum - values[c]!;
    return {
      prompt: `${context.intro} ${context.together(labels[a]!, labels[b]!, labels[c]!)}`,
      figure,
      answer: diff,
      hint: `Two steps: add the ${labels[a]} and ${labels[b]} bars, then subtract the ${labels[c]} bar. Read each bar on the scale.`,
      explanation: [
        scale,
        `${read(a)}.`,
        `${read(b)}.`,
        `${read(c)}.`,
        `Together: ${values[a]} + ${values[b]} = ${sum}. Compare: ${sum} − ${values[c]} = ${diff}.`,
      ],
    };
  }
  const [i, j] = pick(r, [0, 1, 2, 3], 2).sort(
    (a, b) => values[b]! - values[a]!,
  );
  const diff = values[i!]! - values[j!]!;
  return {
    prompt: `${context.intro} ${question === 0 ? context.more(labels[i!]!, labels[j!]!) : context.fewer(labels[j!]!, labels[i!]!)}`,
    figure,
    answer: diff,
    hint: "Read each bar’s value on the scale. Subtract the smaller value from the larger.",
    explanation: [
      scale,
      `${read(i!)}.`,
      `${read(j!)}.`,
      `${values[i!]} − ${values[j!]} = ${diff}.`,
    ],
  };
}

export function generateEarlyDataProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const meta = earlyDataTemplates.find((t) => t.id === templateId);
  if (!meta) throw new Error(`Unknown data template ${templateId}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  const draft =
    templateId === "sort-shapes-count"
      ? sortCount(r)
      : templateId === "sort-shapes-most"
        ? sortMost(r)
        : templateId === "picture-graph-questions"
          ? pictureGraph(r)
          : templateId === "scaled-picture-graph"
            ? scaledPicture(r)
            : scaledBar(r);
  const id = createHash("sha256")
    .update(JSON.stringify([templateId, 1, seed]))
    .digest("hex");
  const base = {
    id,
    templateId,
    templateVersion: 1 as const,
    seed,
    prompt: draft.prompt,
    skillId: meta.skillId,
    figure: draft.figure,
  };
  if (!draft.choices)
    return {
      public: { ...base, response: { kind: "number", label: "Answer" } },
      answer: String(draft.answer),
      explanation: draft.explanation,
      hint: draft.hint,
    };
  const choices = [...draft.choices];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = r(0, i);
    [choices[i], choices[j]] = [choices[j]!, choices[i]!];
  }
  let answer = "";
  const choiceFeedback: Record<string, string> = {};
  const options = choices.map((choice, index) => {
    const optionId = `option-${"abcd"[index]}`;
    if (choice.correct) answer = optionId;
    else choiceFeedback[optionId] = choice.feedback!;
    return { id: optionId, label: choice.label };
  });
  return {
    public: {
      ...base,
      response: { kind: "choice", label: "Choose one answer", options },
    },
    answer,
    explanation: draft.explanation,
    hint: draft.hint,
    choiceFeedback,
  };
}
