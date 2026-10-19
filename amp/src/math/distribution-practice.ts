import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts.js";
import { MAX_STACK, stackHeights } from "./data-display-models.js";

/** Grade 6 statistics: statistical questions, center, distributions and spread. */
const charts = { requiredFigureCapability: "data-displays-v1" } as const;
const choice = { requiredResponseCapability: "single-choice-v1" } as const;
export const distributionTemplates: readonly TemplateMetadata[] = [
  {
    id: "statistical-question-choice",
    version: 1,
    ...choice,
    title: "Is it a statistical question?",
    skillId: "statistical-questions",
    gradeBand: "6–8",
    description:
      "Choose the question that anticipates variability in its answers.",
  },
  {
    id: "dot-plot-mean",
    version: 1,
    ...charts,
    title: "Mean from a dot plot",
    skillId: "mean-median",
    gradeBand: "6–8",
    description:
      "Find the exact mean of whole-number data shown as a dot plot.",
  },
  {
    id: "mean-missing-value",
    version: 1,
    title: "Find the missing value",
    skillId: "mean-median",
    gradeBand: "6–8",
    description:
      "Use a stated mean and all but one value to find the missing value.",
  },
  {
    id: "histogram-read",
    version: 1,
    ...charts,
    title: "Read a histogram",
    skillId: "distribution-plots",
    gradeBand: "6–8",
    description:
      "Count data in one interval, above or below a bin edge, or in all from a histogram.",
  },
  {
    id: "box-plot-read",
    version: 1,
    ...charts,
    title: "Read a box plot",
    skillId: "distribution-plots",
    gradeBand: "6–8",
    description:
      "Read the median, range and interquartile range from a box plot, and the share of data beyond a quartile.",
  },
  {
    id: "dot-plot-mad",
    version: 1,
    ...charts,
    title: "Mean absolute deviation",
    skillId: "variability",
    gradeBand: "6–8",
    description:
      "Find the mean absolute deviation of dot-plot data with a whole-number mean.",
  },
  {
    id: "dot-plot-iqr",
    version: 1,
    ...charts,
    title: "Interquartile range from a dot plot",
    skillId: "variability",
    gradeBand: "6–8",
    description:
      "Find quartiles of dot-plot data by the median-of-halves convention and subtract.",
  },
  {
    id: "typical-value-choice",
    version: 1,
    ...charts,
    ...choice,
    title: "Which value is typical?",
    skillId: "variability",
    gradeBand: "6–8",
    description:
      "Choose the measure that describes a typical value when one value lies far from the rest.",
  },
];

/** Seeded, deterministic integers in [lo, hi], shared by the statistics families. */
export function random(id: string, seed: string) {
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
export type Random = ReturnType<typeof random>;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/** Exact rational text, reduced: "7/2", "4". */
export function rational(n: number, d: number) {
  const g = gcd(Math.abs(n), d) || 1;
  return d / g === 1 ? `${n / g}` : `${n / g}/${d / g}`;
}
/** Exact decimal when the value terminates, else the fraction: 3.5, 2.25, 7/3. */
export function shown(n: number, d: number) {
  const g = gcd(Math.abs(n), d) || 1,
    den = d / g;
  let rest = den;
  for (const p of [2, 5]) while (rest % p === 0) rest /= p;
  if (rest !== 1) return rational(n, d);
  return String(Number((n / d).toFixed(6)));
}
const list = (values: number[]) =>
  values.length < 2
    ? values.join("")
    : `${values.slice(0, -1).join(", ")} and ${values.at(-1)}`;
export function shuffle<T>(r: Random, items: T[]) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = r(0, i);
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

/** Whole-number data on a 0–12 dot plot. */
const dotContexts = [
  {
    intro: (n: number) =>
      `The dot plot shows how many goals a soccer team scored in each of its ${n} games.`,
    unit: "goals",
    typical: "number of goals per game",
    lo: 0,
    hi: 7,
  },
  {
    intro: (n: number) =>
      `The dot plot shows how many books each of ${n} students read over the summer.`,
    unit: "books",
    typical: "number of books a student read",
    lo: 0,
    hi: 10,
  },
  {
    intro: (n: number) =>
      `The dot plot shows how many hours each of ${n} students slept last night.`,
    unit: "hours",
    typical: "number of hours a student slept",
    lo: 5,
    hi: 11,
  },
  {
    intro: (n: number) =>
      `The dot plot shows how many pets each of ${n} students has at home.`,
    unit: "pets",
    typical: "number of pets a student has",
    lo: 0,
    hi: 6,
  },
] as const;

export type Draft = {
  prompt: string;
  figure?: SemanticFigure;
  answer: string;
  fraction?: boolean;
  hint: string;
  explanation: string[];
  choices?: { label: string; correct?: true; feedback?: string }[];
};

function dotData(
  r: Random,
  count: [number, number],
  accept: (v: number[]) => boolean,
) {
  const context = dotContexts[r(0, dotContexts.length - 1)]!;
  let values: number[];
  do {
    const n = r(count[0], count[1]);
    values = Array.from({ length: n }, () => r(context.lo, context.hi));
  } while (
    Math.max(...stackHeights(values).values()) > MAX_STACK ||
    new Set(values).size < 3 ||
    !accept(values)
  );
  const figure: SemanticFigure = {
    kind: "line-plot",
    denominator: 1,
    start: Math.max(0, context.lo - 1),
    end: context.hi + 1,
    values,
    mark: "dot",
    unit: context.unit,
  };
  return { context, values, figure, sorted: [...values].sort((a, b) => a - b) };
}
const sumText = (values: number[]) =>
  `${values.join(" + ")} = ${values.reduce((a, b) => a + b, 0)}`;

const statisticalBank: [string, string, string, string][] = [
  [
    "How many hours of sleep do the students in my class get on a school night?",
    "How many hours did I sleep last night?",
    "How many students are in my class?",
    "What time does my school day begin?",
  ],
  [
    "How long are the songs on my favorite album?",
    "How long is the first song on my favorite album?",
    "How many songs are on my favorite album?",
    "What is the title of my favorite album?",
  ],
  [
    "How much do the dogs at the animal shelter weigh?",
    "How much does my dog weigh?",
    "How many dogs are at the animal shelter today?",
    "What time does the animal shelter open?",
  ],
  [
    "How many pages are in the books on this shelf?",
    "How many pages are in this book?",
    "How many books are on this shelf?",
    "Which book on this shelf did I read first?",
  ],
  [
    "How many minutes do students at our school spend getting to school?",
    "How many minutes did it take me to get to school today?",
    "How far is our school from the library?",
    "How many buses does our school have?",
  ],
  [
    "How tall are the sunflowers in our garden?",
    "How tall is the sunflower by the gate?",
    "How many sunflowers are in our garden?",
    "When did we plant the sunflowers?",
  ],
  [
    "How many goals did each player on the team score this season?",
    "How many goals did Maya score this season?",
    "How many players are on the team?",
    "What color are the team’s shirts?",
  ],
  [
    "What were the high temperatures in our town each day last month?",
    "What was the high temperature in our town yesterday?",
    "How many days were in last month?",
    "What is the name of our town?",
  ],
];

function statisticalQuestion(r: Random): Draft {
  const [yes, ...no] = statisticalBank[r(0, statisticalBank.length - 1)]!;
  return {
    prompt: "Which is a statistical question?",
    answer: "",
    hint: `“${no[0]}” has one answer. Look for the question whose answer collects many values that differ from one another.`,
    explanation: [
      "A statistical question anticipates variability: answering it collects many data values that differ from one another.",
      `“${yes}” collects one value from each member of a group, and those values vary.`,
      "Each of the other questions has a single answer.",
    ],
    choices: [
      { label: yes, correct: true },
      ...no.map((label) => ({
        label,
        feedback:
          "This question has one answer, so there is no variability to describe. A statistical question collects many answers that are expected to differ.",
      })),
    ],
  };
}

function dotMean(r: Random): Draft {
  const { context, values, figure } = dotData(r, [6, 10], () => true);
  const n = values.length,
    sum = values.reduce((a, b) => a + b, 0);
  const columns = [...stackHeights(values)].sort((a, b) => a[0] - b[0]);
  return {
    prompt: `${context.intro(n)} What is the mean number of ${context.unit} per ${context.unit === "goals" ? "game" : "student"}?`,
    figure,
    answer: rational(sum, n),
    fraction: true,
    hint: `Add the value of every dot; a stack of 3 dots counts its value three times. Then share that total among the ${n} dots.`,
    explanation: [
      `Add every dot: ${columns.map(([v, c]) => (c === 1 ? `${v}` : `${c} × ${v}`)).join(" + ")} = ${sum}.`,
      `There are ${n} dots: ${sum} ÷ ${n} = ${shown(sum, n)}.`,
      "The mean is the balance point: the distances of the dots below it add up to the distances of the dots above it.",
    ],
  };
}

function missingValue(r: Random): Draft {
  let n: number, mean: number, known: number[], missing: number;
  do {
    n = r(4, 6);
    mean = r(70, 92);
    known = Array.from({ length: n - 1 }, () => mean + r(-12, 12));
    missing = n * mean - known.reduce((a, b) => a + b, 0);
  } while (missing < 50 || missing > 100 || known.includes(missing));
  const total = n * mean,
    sum = known.reduce((a, b) => a + b, 0);
  return {
    prompt: `The mean of ${n} quiz scores is ${mean}. ${["Three", "Four", "Five"][n - 4]} of the scores are ${list(known)}. What is the other score?`,
    answer: `${missing}`,
    hint: `A mean of ${mean} for ${n} scores means the scores add to ${n} × ${mean}. Subtract the scores you know.`,
    explanation: [
      `The total of all ${n} scores is ${n} × ${mean} = ${total}.`,
      `The known scores add to ${sumText(known).split(" = ")[0]} = ${sum}.`,
      `The other score is ${total} − ${sum} = ${missing}.`,
      `Check: (${sum} + ${missing}) ÷ ${n} = ${mean}.`,
    ],
  };
}

const histogramContexts = [
  {
    intro:
      "The histogram shows how many minutes each student spent reading last night.",
    unit: "minutes",
    start: 0,
    width: 10,
    bins: 6,
    ask: (cond: string) => `How many students read for ${cond}?`,
    total: "How many students are shown in the histogram?",
  },
  {
    intro:
      "The histogram shows the heights of the plants in a garden, in centimeters.",
    unit: "centimeters",
    start: 10,
    width: 5,
    bins: 5,
    ask: (cond: string) => `How many plants are ${cond} tall?`,
    total: "How many plants are shown in the histogram?",
  },
  {
    intro: "The histogram shows the points each player scored in a season.",
    unit: "points",
    start: 20,
    width: 10,
    bins: 5,
    ask: (cond: string) => `How many players scored ${cond}?`,
    total: "How many players are shown in the histogram?",
  },
] as const;

function histogram(r: Random): Draft {
  const c = histogramContexts[r(0, histogramContexts.length - 1)]!;
  const counts = Array.from({ length: c.bins }, () => r(1, 9));
  const figure: SemanticFigure = {
    kind: "histogram",
    start: c.start,
    width: c.width,
    counts,
    unit: c.unit,
  };
  const edge = (i: number) => c.start + i * c.width;
  const question = r(0, 3);
  const bar = (i: number) => `${edge(i)} to ${edge(i + 1) - 1}: ${counts[i]}`;
  if (question === 3) {
    const total = counts.reduce((a, b) => a + b, 0);
    return {
      prompt: `${c.intro} ${c.total}`,
      figure,
      answer: `${total}`,
      hint: "A bar’s height is how many data values fall in its interval. Add the heights of all the bars.",
      explanation: [
        `Bar heights: ${counts.join(", ")}.`,
        `${counts.join(" + ")} = ${total}.`,
      ],
    };
  }
  if (question === 2) {
    const i = r(0, c.bins - 1);
    return {
      prompt: `${c.intro} ${c.ask(`from ${edge(i)} to ${edge(i + 1) - 1} ${c.unit}`)}`,
      figure,
      answer: `${counts[i]}`,
      hint: `Find the bar that starts at ${edge(i)}. Its height on the count scale is the answer.`,
      explanation: [
        `The interval from ${edge(i)} to ${edge(i + 1) - 1} is the bar from ${edge(i)} up to ${edge(i + 1)}.`,
        `Its height is ${counts[i]}.`,
      ],
    };
  }
  const k = r(1, c.bins - 1),
    atLeast = question === 0;
  const chosen = atLeast ? counts.slice(k) : counts.slice(0, k);
  const total = chosen.reduce((a, b) => a + b, 0);
  const less = c.unit === "centimeters" ? "less than" : "fewer than";
  return {
    prompt: `${c.intro} ${c.ask(`${atLeast ? "at least" : less} ${edge(k)} ${c.unit}`)}`,
    figure,
    answer: `${total}`,
    hint: atLeast
      ? `“At least ${edge(k)}” includes ${edge(k)} itself: use every bar that starts at ${edge(k)} or later.`
      : `“${less[0]!.toUpperCase()}${less.slice(1)} ${edge(k)}” stops before ${edge(k)}: use every bar that ends at ${edge(k)} or earlier.`,
    explanation: [
      `${atLeast ? `At least ${edge(k)}` : `${less[0]!.toUpperCase()}${less.slice(1)} ${edge(k)}`} means the bars ${atLeast ? `from ${edge(k)} up` : `below ${edge(k)}`}: ${(atLeast ? counts.map((_, i) => i).slice(k) : counts.map((_, i) => i).slice(0, k)).map(bar).join("; ")}.`,
      chosen.length > 1
        ? `${chosen.join(" + ")} = ${total}.`
        : `That is ${total}.`,
    ],
  };
}

const boxContexts = [
  {
    describe: "the scores of the students in a class on a test",
    what: "score",
    things: "scores",
    unit: "points",
    start: 40,
    end: 100,
    step: 5,
  },
  {
    describe: "how many minutes students take to get to school",
    what: "travel time",
    things: "travel times",
    unit: "minutes",
    start: 0,
    end: 60,
    step: 5,
  },
  {
    describe: "the heights of the players in a basketball league, in inches",
    what: "height",
    things: "heights",
    unit: "inches",
    start: 52,
    end: 76,
    step: 2,
  },
] as const;

function boxPlot(r: Random): Draft {
  const c = boxContexts[r(0, boxContexts.length - 1)]!;
  const slots = (c.end - c.start) / c.step;
  const picks = new Set<number>();
  while (picks.size < 5) picks.add(r(1, slots - 1));
  const summary = [...picks]
    .sort((a, b) => a - b)
    .map((i) => c.start + i * c.step) as [
    number,
    number,
    number,
    number,
    number,
  ];
  const [min, q1, median, q3, max] = summary;
  const figure: SemanticFigure = {
    kind: "box-plot",
    start: c.start,
    end: c.end,
    step: c.step,
    summary,
    unit: c.unit,
  };
  const intro = `The box plot summarizes ${c.describe}.`;
  const five = `Minimum ${min}, lower quartile ${q1}, median ${median}, upper quartile ${q3}, maximum ${max}.`;
  const question = r(0, 5);
  if (question === 0)
    return {
      prompt: `${intro} What is the median ${c.what}?`,
      figure,
      answer: `${median}`,
      hint: `The line inside the box marks the median. Read where it sits on the ${c.unit} scale.`,
      explanation: [five, `The line inside the box is at ${median}.`],
    };
  if (question === 1)
    return {
      prompt: `${intro} What is the interquartile range of the ${c.things}?`,
      figure,
      answer: `${q3 - q1}`,
      hint: `The box runs from the lower quartile to the upper quartile. Read both ends of the box on the ${c.unit} scale and subtract.`,
      explanation: [five, `IQR = ${q3} − ${q1} = ${q3 - q1}.`],
    };
  if (question === 2)
    return {
      prompt: `${intro} What is the range of the ${c.things}?`,
      figure,
      answer: `${max - min}`,
      hint: `The whiskers end at the least and greatest ${c.things}. Read both ends on the ${c.unit} scale and subtract.`,
      explanation: [five, `Range = ${max} − ${min} = ${max - min}.`],
    };
  const [phrase, percent, why] = [
    [
      `greater than ${q3}`,
      25,
      `Above the upper quartile is the top quarter of the data.`,
    ],
    [
      `between ${q1} and ${q3}`,
      50,
      "The box holds the middle half of the data: the second and third quarters.",
    ],
    [
      `less than ${median}`,
      50,
      "The median splits the data into a lower half and an upper half.",
    ],
  ][question - 3] as [string, number, string];
  return {
    prompt: `${intro} About what percent of the ${c.things} are ${phrase}?`,
    figure,
    answer: `${percent}`,
    hint: `The five marks split the ${c.things} into four parts, each about one quarter of the data. How many quarters are ${phrase}?`,
    explanation: [
      five,
      why,
      `About ${percent}% of the ${c.things} are ${phrase}.`,
    ],
  };
}

function dotMad(r: Random): Draft {
  const { context, values, figure } = dotData(
    r,
    [5, 8],
    (v) => v.reduce((a, b) => a + b, 0) % v.length === 0,
  );
  const n = values.length,
    mean = values.reduce((a, b) => a + b, 0) / n;
  const sorted = [...values].sort((a, b) => a - b);
  const distances = sorted.map((v) => Math.abs(v - mean)),
    total = distances.reduce((a, b) => a + b, 0);
  return {
    prompt: `${context.intro(n)} What is the mean absolute deviation of the data?`,
    figure,
    answer: rational(total, n),
    fraction: true,
    hint: `First find the mean of the ${n} values. Then find how far each dot is from the mean, and average those ${n} distances.`,
    explanation: [
      `Mean: (${sorted.join(" + ")}) ÷ ${n} = ${mean * n} ÷ ${n} = ${mean}.`,
      `Distances from ${mean}: ${distances.join(", ")}.`,
      `Mean distance: ${total} ÷ ${n} = ${shown(total, n)}.`,
      "Distances are never negative; the mean absolute deviation is the typical distance from the mean.",
    ],
  };
}

function middle(values: number[]) {
  const k = Math.floor(values.length / 2);
  return values.length % 2
    ? { n: 2 * values[k]!, text: `${values[k]}` }
    : {
        n: values[k - 1]! + values[k]!,
        text: `(${values[k - 1]} + ${values[k]}) ÷ 2 = ${shown(values[k - 1]! + values[k]!, 2)}`,
      };
}
function dotIqr(r: Random): Draft {
  const { context, values, figure, sorted } = dotData(r, [7, 12], () => true);
  const n = values.length,
    half = Math.floor(n / 2);
  const lower = sorted.slice(0, half),
    upper = sorted.slice(Math.ceil(n / 2));
  const q1 = middle(lower),
    q3 = middle(upper);
  return {
    prompt: `${context.intro(n)} What is the interquartile range? Use the median of each half, leaving out the overall median when the count is odd.`,
    figure,
    answer: rational(q3.n - q1.n, 2),
    fraction: true,
    hint: `List the ${n} values in order from left to right. ${n % 2 ? "Leave out the middle one, then split" : "Split"} them into a lower and an upper half of ${half} values each, and find the median of each half.`,
    explanation: [
      `In order: ${sorted.join(", ")}.`,
      n % 2
        ? `${n} values: leave out the middle one, ${sorted[half]}. Lower half: ${lower.join(", ")}. Upper half: ${upper.join(", ")}.`
        : `${n} values split evenly. Lower half: ${lower.join(", ")}. Upper half: ${upper.join(", ")}.`,
      `Q1 = ${q1.text}. Q3 = ${q3.text}.`,
      `IQR = ${shown(q3.n, 2)} − ${shown(q1.n, 2)} = ${shown(q3.n - q1.n, 2)}.`,
    ],
  };
}

function typicalValue(r: Random): Draft {
  const context = dotContexts[1];
  let cluster: number[], outlier: number, values: number[];
  let n: number, sum: number;
  do {
    n = [5, 10][r(0, 1)]!;
    cluster = Array.from({ length: n - 1 }, () => r(1, 4));
    outlier = r(10, 12);
    values = [...cluster, outlier];
    sum = values.reduce((a, b) => a + b, 0);
  } while (
    Math.max(...stackHeights(values).values()) > MAX_STACK ||
    new Set(cluster).size < 2 ||
    sum / n <= Math.max(...cluster)
  );
  shuffle(r, values);
  const sorted = [...values].sort((a, b) => a - b);
  const m = middle(sorted);
  const median = shown(m.n, 2),
    mean = shown(sum, n);
  const figure: SemanticFigure = {
    kind: "line-plot",
    denominator: 1,
    start: 0,
    end: 12,
    values,
    mark: "dot",
    unit: context.unit,
  };
  return {
    prompt: `${context.intro(n)} Which value best describes the typical ${context.typical}?`,
    figure,
    answer: "",
    hint: `One of the ${n} students read ${outlier} books, far from everyone else. Which summary would jump if that one value changed, and which would barely move?`,
    explanation: [
      `One student read ${outlier} books; every other student read ${Math.min(...cluster)} to ${Math.max(...cluster)}.`,
      `The mean, ${mean}, is pulled up by that one value: it is greater than every other student’s number.`,
      `The median, ${median}, depends only on the middle of the ordered data, so it stays among the typical values.`,
    ],
    choices: [
      { label: `The median, ${median}`, correct: true },
      {
        label: `The mean, ${mean}`,
        feedback: `The mean includes the ${outlier} at full size. It is larger than ${n - 1} of the ${n} values, so it does not describe a typical student.`,
      },
      {
        label: `The maximum, ${Math.max(...values)}`,
        feedback:
          "The maximum describes only the single greatest value, the most unusual one here.",
      },
      {
        label: `The range, ${Math.max(...values) - Math.min(...values)}`,
        feedback:
          "The range measures spread, not a typical value; it is large here because of one value.",
      },
    ],
  };
}

export function generateDistributionProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const meta = distributionTemplates.find((t) => t.id === templateId);
  if (!meta) throw new Error(`Unknown statistics template ${templateId}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  const build: Record<string, (r: Random) => Draft> = {
    "statistical-question-choice": statisticalQuestion,
    "dot-plot-mean": dotMean,
    "mean-missing-value": missingValue,
    "histogram-read": histogram,
    "box-plot-read": boxPlot,
    "dot-plot-mad": dotMad,
    "dot-plot-iqr": dotIqr,
    "typical-value-choice": typicalValue,
  };
  return assemble(meta, seed, r, build[templateId]!(r));
}

/** A draft becomes a public problem: number or fraction entry, or shuffled choices. */
export function assemble(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
  draft: Draft,
): GeneratedProblem {
  const templateId = meta.id;
  const base = {
    id: createHash("sha256")
      .update(JSON.stringify([templateId, 1, seed]))
      .digest("hex"),
    templateId,
    templateVersion: 1 as const,
    seed,
    prompt: draft.prompt,
    skillId: meta.skillId,
    ...(draft.figure ? { figure: draft.figure } : {}),
  };
  if (!draft.choices)
    return {
      public: {
        ...base,
        response: draft.fraction
          ? {
              kind: "fraction",
              label: "Answer (fraction, decimal, or whole number)",
            }
          : { kind: "number", label: "Answer" },
      },
      answer: draft.answer,
      explanation: draft.explanation,
      hint: draft.hint,
    };
  const choices = shuffle(r, [...draft.choices]);
  let answer = "";
  const choiceFeedback: Record<string, string> = {};
  const options = choices.map((c, i) => {
    const id = `option-${"abcd"[i]}`;
    if (c.correct) answer = id;
    else choiceFeedback[id] = c.feedback!;
    return { id, label: c.label };
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
