import {
  studyDesignTemplate,
  studyDesignCase,
} from "./study-design-practice.js";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts.js";
import { MAX_STACK, PAIR_STACK, stackHeights } from "./data-display-models.js";
import {
  assemble,
  random,
  rational,
  shown,
  shuffle,
  type Draft,
  type Random,
} from "./distribution-practice.js";

/** Grade 7 statistics: random samples, population estimates, and comparing
 * two distributions by their centers and spreads. */
const charts = { requiredFigureCapability: "data-displays-v1" } as const;
const choice = { requiredResponseCapability: "single-choice-v1" } as const;
export const inferenceTemplates: readonly TemplateMetadata[] = [
  studyDesignTemplate,
  {
    id: "representative-sample-choice",
    version: 1,
    ...choice,
    title: "Choose a representative sample",
    skillId: "sampling",
    gradeBand: "6–8",
    description:
      "Choose the sampling method that gives every member of the population the same chance to be chosen.",
  },
  {
    id: "sample-proportion-estimate",
    version: 1,
    title: "Estimate from a random sample",
    skillId: "sampling",
    gradeBand: "6–8",
    description:
      "Scale the fraction found in a random sample up to the whole population.",
  },
  {
    id: "sample-estimates-plot",
    version: 1,
    ...charts,
    title: "Many samples, one estimate",
    skillId: "sampling",
    gradeBand: "6–8",
    description:
      "Combine the varying counts of ten random samples into a population estimate.",
  },
  {
    id: "means-in-mads",
    version: 1,
    ...charts,
    title: "Gap between means, in MADs",
    skillId: "compare-distributions",
    gradeBand: "6–8",
    description:
      "Express the difference between two means as a multiple of their shared mean absolute deviation.",
  },
  {
    id: "double-box-compare",
    version: 1,
    ...charts,
    title: "Compare two box plots",
    skillId: "compare-distributions",
    gradeBand: "6–8",
    description:
      "Compare the medians and interquartile ranges of two box plots on one scale.",
  },
  {
    id: "compare-distributions-choice",
    version: 1,
    ...charts,
    ...choice,
    title: "Which comparison is true?",
    skillId: "compare-distributions",
    gradeBand: "6–8",
    description:
      "Choose the statement that correctly compares two distributions' medians and interquartile ranges.",
  },
];

const thousands = (n: number) => n.toLocaleString("en-US");
/** "1 minute", "3 minutes": a count with its unit in agreement. */
const units = (n: number, unit: string) =>
  `${n} ${n === 1 ? unit.replace(/s$/, "") : unit}`;
const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

/** [situation, representative method, [biased method, why it is biased] × 3, the population] */
const sampleBank: [string, string, [string, string][], string][] = [
  [
    "A principal wants to know how all 900 students at her school feel about a longer lunch period.",
    "Choose 60 students at random from a list of all 900 students.",
    [
      [
        "Ask the 60 students on the student council.",
        "Student council members are one small, unusual group, not a picture of the whole school.",
      ],
      [
        "Use the first 60 students who answer an email survey.",
        "Students who choose to answer often feel strongly; quiet students are left out.",
      ],
      [
        "Ask 60 students in the sixth-grade hallway.",
        "Only sixth graders could be chosen, so other grades are not represented.",
      ],
    ],
    "each of the 900 students",
  ],
  [
    "A city wants to estimate the share of its residents who ride the bus to work.",
    "Pick 200 residents at random from a list of every household in the city.",
    [
      [
        "Ask 200 people waiting at bus stops.",
        "People at bus stops are mostly bus riders, so the share would come out too high.",
      ],
      [
        "Ask 200 people leaving a downtown parking garage.",
        "People leaving a garage drove, so the share would come out too low.",
      ],
      [
        "Post an online poll and use the first 200 replies.",
        "People who choose to reply are not chosen by chance and may differ from everyone else.",
      ],
    ],
    "every resident of the city",
  ],
  [
    "A farmer wants to estimate the mean weight of the apples in her orchard.",
    "Weigh 50 apples picked at random from trees across the whole orchard.",
    [
      [
        "Weigh the 50 largest apples she can find.",
        "Choosing the largest apples makes the mean weight come out too high.",
      ],
      [
        "Weigh 50 apples from the one tree nearest the barn.",
        "One tree may grow apples unlike the rest of the orchard.",
      ],
      [
        "Weigh the first 50 apples that fall to the ground.",
        "Apples that fall first may be riper or damaged, unlike the rest.",
      ],
    ],
    "every apple in the orchard",
  ],
  [
    "A librarian wants to know how many books the students at her school read each month.",
    "Survey 80 students chosen at random from the school roster.",
    [
      [
        "Survey 80 students who are in the library after school.",
        "Students in the library after school likely read more than most.",
      ],
      [
        "Survey the 80 members of the book club.",
        "Book club members read more than a typical student.",
      ],
      [
        "Survey the 80 students in one grade’s math classes.",
        "Only one grade could be chosen, so other grades are not represented.",
      ],
    ],
    "every student at the school",
  ],
  [
    "A factory wants to estimate the share of the light bulbs it made today that are defective.",
    "Test 100 bulbs chosen at random from all of today’s bulbs.",
    [
      [
        "Test the first 100 bulbs made this morning.",
        "Bulbs made at one time may share a problem, or miss one, that the rest of the day does not.",
      ],
      [
        "Test 100 bulbs from the box on top of the stack.",
        "One box comes from one short stretch of production, not the whole day.",
      ],
      [
        "Test 100 bulbs that customers returned.",
        "Returned bulbs are more likely to be defective, so the share would come out too high.",
      ],
    ],
    "every bulb made today",
  ],
  [
    "A group of students wants to know the favorite sport of seventh graders in their state.",
    "Survey seventh graders chosen at random from schools across the state.",
    [
      [
        "Survey the seventh graders at a soccer camp.",
        "Students at a soccer camp are more likely to choose soccer.",
      ],
      [
        "Survey the seventh graders in their own class.",
        "One class in one school cannot represent a whole state.",
      ],
      [
        "Survey seventh graders who visit a basketball website.",
        "Visitors to a basketball website are more likely to choose basketball.",
      ],
    ],
    "every seventh grader in the state",
  ],
];

function representativeSample(r: Random): Draft {
  const [situation, fair, biased, population] =
    sampleBank[r(0, sampleBank.length - 1)]!;
  return {
    prompt: `${situation} Which method is most likely to give a representative sample?`,
    answer: "",
    hint: `A sample represents a population when it gives ${population} the same chance of being chosen. Which method does that?`,
    explanation: [
      "A representative sample resembles the population. Choosing at random from the whole population gives every member the same chance, so no group is favored.",
      `“${fair}” chooses at random from everyone the question is about.`,
      "Each other method favors one group: people who are easy to reach, who volunteer, or who are already different from the rest.",
    ],
    choices: [
      { label: fair, correct: true },
      ...biased.map(([label, feedback]) => ({ label, feedback })),
    ],
  };
}

/** [population noun, question about the trait, how the answer is named] */
const proportionContexts = [
  {
    stem: (s: number, p: string, k: number) =>
      `In a random sample of ${s} of the ${p} students at a school, ${k} walk to school.`,
    ask: (p: string) => `About how many of all ${p} students walk to school?`,
    trait: "walk to school",
    populations: [400, 2000],
    share: 0.5,
  },
  {
    stem: (s: number, p: string, k: number) =>
      `A random sample of ${s} of the ${p} light bulbs made today has ${k} defective bulbs.`,
    ask: (p: string) => `About how many of all ${p} bulbs are defective?`,
    trait: "are defective",
    populations: [1000, 5000],
    share: 0.1,
  },
  {
    stem: (s: number, p: string, k: number) =>
      `In a random sample of ${s} of a town’s ${p} voters, ${k} support a new park.`,
    ask: (p: string) => `About how many of all ${p} voters support the park?`,
    trait: "support the park",
    populations: [800, 4000],
    share: 0.8,
  },
  {
    stem: (s: number, p: string, k: number) =>
      `A random sample of ${s} of the ${p} fish in a lake includes ${k} trout.`,
    ask: (p: string) => `About how many of all ${p} fish are trout?`,
    trait: "are trout",
    populations: [400, 1600],
    share: 0.5,
  },
] as const;

function proportionEstimate(r: Random): Draft {
  const c = proportionContexts[r(0, proportionContexts.length - 1)]!;
  let s: number, population: number, k: number;
  do {
    s = [20, 25, 40, 50, 80, 100][r(0, 5)]!;
    population = s * r(4, 50);
    k = r(2, Math.floor(s * c.share));
  } while (
    population < c.populations[0] ||
    population > c.populations[1] ||
    population % 100 !== 0
  );
  const p = thousands(population),
    estimate = (k * population) / s;
  return {
    prompt: `${c.stem(s, p, k)} ${c.ask(p)}`,
    answer: `${estimate}`,
    hint: `A random sample should look like the population. The sample has ${k} out of ${s}; find the same fraction of ${p}.`,
    explanation: [
      `In the sample, ${k} of ${s} ${c.trait}: the fraction ${rational(k, s)}.`,
      `A random sample resembles the population, so expect about the same fraction of all ${p}.`,
      `${rational(k, s)} × ${p} = ${thousands(estimate)}.`,
      "This is an estimate: another random sample would give a slightly different fraction.",
    ],
  };
}

const sampleContexts = [
  { trait: "prefer a later start to the school day", short: "a later start" },
  { trait: "have a pet at home", short: "a pet" },
  { trait: "play a musical instrument", short: "an instrument" },
  { trait: "walk or bike to school", short: "walking or biking" },
] as const;

function samplePlot(r: Random): Draft {
  const c = sampleContexts[r(0, sampleContexts.length - 1)]!;
  const population = [400, 600, 800, 1000, 1200][r(0, 4)]!;
  const center = r(5, 14);
  let values: number[];
  do values = Array.from({ length: 10 }, () => center + r(-3, 3));
  while (
    Math.max(...stackHeights(values).values()) > MAX_STACK ||
    new Set(values).size < 4 ||
    Math.max(...values) > 19
  );
  const total = sum(values),
    estimate = (total * population) / 200;
  const lo = Math.min(...values),
    hi = Math.max(...values);
  const start = Math.min(8, Math.max(0, Math.round((lo + hi) / 2) - 6)),
    figure: SemanticFigure = {
      kind: "line-plot",
      denominator: 1,
      start,
      end: start + 12,
      values,
      mark: "dot",
      unit: "count in a sample",
    };
  const p = thousands(population);
  return {
    prompt: `Ten students each took a random sample of 20 students at their school and counted how many ${c.trait}. Using the mean count, estimate how many of all ${p} students ${c.trait}.`,
    figure,
    answer: `${estimate}`,
    hint: `Find the mean of the ten counts: the typical number out of 20. Then take that same fraction of all ${p} students.`,
    explanation: [
      `The counts add to ${total}, so the mean count is ${total} ÷ 10 = ${shown(total, 10)} out of 20.`,
      `${shown(total, 10)} out of 20 is ${rational(total, 200)} of a sample. The same fraction of ${p} is ${rational(total, 200)} × ${p} = ${thousands(estimate)}.`,
      `One sample alone would have estimated anywhere from ${thousands((lo * population) / 20)} (${lo} out of 20) to ${thousands((hi * population) / 20)} (${hi} out of 20). Samples vary; the mean of many samples is a steadier estimate than any one of them.`,
    ],
  };
}

/** Two groups with the same MAD; the gap between means is a whole or half multiple of it. */
const pairContexts = [
  {
    intro:
      "The dot plots show how many push-ups each student in two gym classes did.",
    labels: ["Morning", "Afternoon"],
    unit: "push-ups",
  },
  {
    intro:
      "The dot plots show how many minutes each student in two classes took to finish a puzzle.",
    labels: ["Class A", "Class B"],
    unit: "minutes",
  },
  {
    intro:
      "The dot plots show how many hits each player on two softball teams got this month.",
    labels: ["Hawks", "Owls"],
    unit: "hits",
  },
  {
    intro:
      "The dot plots show how many points each student scored on a quiz in two classes.",
    labels: ["Class 1", "Class 2"],
    unit: "points",
  },
] as const;
const deviation = (values: readonly number[]) => {
  const mean = sum(values) / values.length;
  return sum(values.map((v) => Math.abs(v - mean))) / values.length;
};

function meansInMads(r: Random): Draft {
  const c = pairContexts[r(0, pairContexts.length - 1)]!;
  let a: number[], b: number[], mad: number, gap: number, start: number;
  for (;;) {
    const n = r(6, 10),
      base = r(1, 8);
    a = Array.from({ length: n }, () => base + r(0, 8));
    const total = sum(a);
    mad = deviation(a);
    if (
      total % n !== 0 ||
      !Number.isInteger(mad) ||
      mad < 1 ||
      mad > 3 ||
      Math.max(...stackHeights(a).values()) > PAIR_STACK
    )
      continue;
    const mean = total / n;
    // Half multiples only where the gap stays a whole number.
    const multiples = mad % 2 === 0 ? [1, 1.5, 2, 2.5, 3] : [1, 2, 3];
    gap = mad * multiples[r(0, multiples.length - 1)]!;
    // Mirror the data about its mean half the time: a new shape, the same MAD.
    const mirror = r(0, 1) === 1;
    b = a.map((v) => (mirror ? 2 * mean - v : v) + gap);
    start = Math.max(0, Math.min(...a) - 1);
    if (Math.min(...b) >= start && Math.max(...a, ...b) + 1 - start <= 20)
      break;
  }
  shuffle(r, b);
  const swap = r(0, 1) === 1;
  const [first, second] = swap ? [b, a] : [a, b];
  const end = Math.max(start + 10, Math.max(...a, ...b) + 1);
  const figure: SemanticFigure = {
    kind: "double-dot-plot",
    start,
    end,
    groups: [
      { label: c.labels[0], values: first },
      { label: c.labels[1], values: second },
    ],
    unit: c.unit,
  };
  const meanOf = (v: number[]) => sum(v) / v.length;
  const [m1, m2] = [meanOf(first), meanOf(second)];
  const k = rational(gap * 2, mad * 2);
  return {
    prompt: `${c.intro} Both groups have a mean absolute deviation of ${units(mad, c.unit)}. The difference between the two means is how many times the MAD?`,
    figure,
    answer: k,
    fraction: true,
    hint: `Find each group’s mean. Then divide the distance between the two means by the MAD, ${mad}.`,
    explanation: [
      `The mean of a group is its total shared equally: add the values, then divide by how many there are.`,
      `${c.labels[0]}: ${sum(first)} ÷ ${first.length} = ${m1}. ${c.labels[1]}: ${sum(second)} ÷ ${second.length} = ${m2}.`,
      `The means are ${Math.max(m1, m2)} − ${Math.min(m1, m2)} = ${units(gap, c.unit)} apart.`,
      `The MAD (mean absolute deviation) is the typical distance of a value from its group's mean, here ${units(mad, c.unit)}. Dividing the gap by the MAD tells how many typical distances apart the means are.`,
      `${gap} ÷ ${mad} = ${shown(gap, mad)}, so the means are ${shown(gap, mad)} ${shown(gap, mad) === "1" ? "MAD" : "MADs"} apart.`,
      "The more MADs apart the means are, the less the two groups overlap.",
    ],
  };
}

const boxPairContexts = [
  {
    intro: "The box plots compare the test scores of two classes.",
    labels: ["Class A", "Class B"],
    names: ["Class A", "Class B"],
    unit: "points",
    things: "scores",
    start: 40,
    end: 100,
    step: 5,
  },
  {
    intro:
      "The box plots compare how many minutes runners from two clubs took to finish a race.",
    labels: ["Red Club", "Blue Club"],
    names: ["the Red Club", "the Blue Club"],
    unit: "minutes",
    things: "times",
    start: 14,
    end: 46,
    step: 2,
  },
  {
    intro:
      "The box plots compare the heights of bean plants grown in a sunny bed and a shady bed.",
    labels: ["Sunny bed", "Shady bed"],
    names: ["the sunny bed", "the shady bed"],
    unit: "centimeters",
    things: "heights",
    start: 0,
    end: 60,
    step: 5,
  },
] as const;
type Five = [number, number, number, number, number];

function boxPair(r: Random, equalIqr = false) {
  const c = boxPairContexts[r(0, boxPairContexts.length - 1)]!;
  const slots = (c.end - c.start) / c.step;
  const draw = (): Five => {
    const picks = new Set<number>();
    while (picks.size < 5) picks.add(r(1, slots - 1));
    return [...picks]
      .sort((a, b) => a - b)
      .map((i) => c.start + i * c.step) as Five;
  };
  let a: Five, b: Five;
  do {
    a = draw();
    b = draw();
  } while (
    a[2] === b[2] ||
    (equalIqr ? a[3] - a[1] !== b[3] - b[1] : a[3] - a[1] === b[3] - b[1]) ||
    (equalIqr &&
      Math.abs(a[2] - b[2]) % (a[3] - a[1]) !== 0 &&
      (2 * Math.abs(a[2] - b[2])) % (a[3] - a[1]) !== 0)
  );
  const figure: SemanticFigure = {
    kind: "double-box-plot",
    start: c.start,
    end: c.end,
    step: c.step,
    groups: [
      { label: c.labels[0], summary: a },
      { label: c.labels[1], summary: b },
    ],
    unit: c.unit,
  };
  const read = (label: string, s: Five) =>
    `${label}: median ${s[2]}, box from ${s[1]} to ${s[3]} (IQR ${s[3] - s[1]}).`;
  return {
    c,
    a,
    b,
    figure,
    reading: [read(c.labels[0], a), read(c.labels[1], b)].join(" "),
  };
}

function boxCompare(r: Random): Draft {
  const question = r(0, 2);
  const { c, a, b, figure, reading } = boxPair(r, question === 2);
  const [hi, lo] = a[2] > b[2] ? [0, 1] : [1, 0];
  const s = [a, b];
  if (question === 0)
    return {
      prompt: `${c.intro} How much greater is the median of ${c.names[hi]} than the median of ${c.names[lo]}?`,
      figure,
      answer: `${s[hi]![2] - s[lo]![2]}`,
      hint: "The line inside each box is its median. Read both on the shared scale and subtract.",
      explanation: [
        "In a box plot, the line inside the box marks the median: the middle value when the data are in order.",
        reading,
        `Subtract the medians to compare them: ${s[hi]![2]} − ${s[lo]![2]} = ${units(s[hi]![2] - s[lo]![2], c.unit)}.`,
        `The median of ${c.names[hi]} is ${units(s[hi]![2] - s[lo]![2], c.unit)} greater.`,
      ],
    };
  if (question === 1) {
    const iqr = s.map((x) => x[3] - x[1]);
    const [wide, narrow] = iqr[0]! > iqr[1]! ? [0, 1] : [1, 0];
    return {
      prompt: `${c.intro} How much greater is the interquartile range of ${c.names[wide]} than that of ${c.names[narrow]}?`,
      figure,
      answer: `${iqr[wide]! - iqr[narrow]!}`,
      hint: "Each box runs from Q1 to Q3, so its length is the IQR. Find both lengths and subtract.",
      explanation: [
        "A box runs from the lower quartile (Q1) to the upper quartile (Q3), so its length is the interquartile range (IQR): the spread of the middle half of the data.",
        reading,
        `IQRs: ${iqr[wide]} and ${iqr[narrow]}. ${iqr[wide]} − ${iqr[narrow]} = ${units(iqr[wide]! - iqr[narrow]!, c.unit)}.`,
        `The ${c.things} of ${c.names[wide]} are more spread out in the middle half.`,
      ],
    };
  }
  const iqr = a[3] - a[1],
    gap = s[hi]![2] - s[lo]![2];
  return {
    prompt: `${c.intro} The two boxes have the same interquartile range. The difference between the medians is how many times that IQR?`,
    figure,
    answer: rational(gap, iqr),
    fraction: true,
    hint: "Subtract the medians. Then divide by the length of one box.",
    explanation: [
      "The line inside each box is the median; the box length is the interquartile range (IQR), the spread of the middle half.",
      reading,
      `The medians differ by ${s[hi]![2]} − ${s[lo]![2]} = ${gap}; each IQR is ${iqr}.`,
      `${gap} ÷ ${iqr} = ${shown(gap, iqr)}, so the medians are ${shown(gap, iqr)} ${shown(gap, iqr) === "1" ? "IQR" : "IQRs"} apart.`,
    ],
  };
}

function compareChoice(r: Random): Draft {
  const { c, a, b, figure, reading } = boxPair(r);
  const [p, q] = c.names;
  const cap = (t: string) => t[0]!.toUpperCase() + t.slice(1);
  const medianHigh = a[2] > b[2] ? p : q,
    iqrHigh = a[3] - a[1] > b[3] - b[1] ? p : q;
  const statement = (m: string, i: string) =>
    m === i
      ? `${cap(m)} has both the greater median and the greater interquartile range.`
      : `${cap(m)} has the greater median, and ${i} has the greater interquartile range.`;
  const choices = [p, q].flatMap((m) =>
    [p, q].map((i) => {
      const label = statement(m, i);
      if (m === medianHigh && i === iqrHigh)
        return { label, correct: true as const };
      return {
        label,
        feedback:
          m !== medianHigh
            ? `Compare the lines inside the boxes: ${medianHigh} has the greater median.`
            : `Compare the box lengths: ${iqrHigh} has the greater interquartile range.`,
      };
    }),
  );
  return {
    prompt: `${c.intro} Which statement is true?`,
    figure,
    answer: "",
    hint: `Compare ${p} with ${q} twice: first the median lines inside the boxes, then the box lengths, which are the IQRs.`,
    explanation: [
      reading,
      `${cap(medianHigh)} has the greater median: its ${c.things} are typically greater.`,
      `${cap(iqrHigh)} has the longer box: the middle half of its ${c.things} is more spread out.`,
    ],
    choices,
  };
}

export function generateInferenceProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  if (templateId === studyDesignTemplate.id)
    return studyDesignCase(seed).problem;
  const meta = inferenceTemplates.find((t) => t.id === templateId);
  if (!meta) throw new Error(`Unknown statistics template ${templateId}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  const build: Record<string, (r: Random) => Draft> = {
    "representative-sample-choice": representativeSample,
    "sample-proportion-estimate": proportionEstimate,
    "sample-estimates-plot": samplePlot,
    "means-in-mads": meansInMads,
    "double-box-compare": boxCompare,
    "compare-distributions-choice": compareChoice,
  };
  return assemble(meta, seed, r, build[templateId]!(r));
}
