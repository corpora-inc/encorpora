/* Synthetic data for the component gallery. Every name, id and figure here is
   invented; nothing is read from an account or the API. */
import type { PublicProblem } from "../../../math/contracts";
import type { Outcome } from "../../../server/repository";
import type { ProgressSnapshot } from "../../../server/progress";
import type {
  MapResponse,
  ProgressRecord,
  StudentTimeResponse,
  WorkItem,
} from "../../../schools/teacher-contracts";
import type { WorkbookSummary } from "../../../workbook/contracts";
import type { Frontier } from "../../../learning/frontier";
import type { TrendPoint } from "../../../learning/level-check";
import type { AnswerSkill } from "../practice/answer-pathways";

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

/* ---------- Practice ---------- */

export type PracticeFixture = {
  problem: PublicProblem;
  answer: string;
  explanation: string[];
  /** What the learner typed or chose before the result. */
  response: string;
  /** The result showing, or null for an unanswered problem. */
  outcome: "correct" | "wrong" | "skipped" | null;
  mastered?: string;
  error?: string;
};

const typed: PublicProblem = {
  id: "design-typed",
  templateId: "design-multiply-template",
  templateVersion: 1,
  seed: "design",
  prompt:
    "A baker fills 3 trays with 12 muffins on each tray. How many muffins are there in all?",
  skillId: "design-multiply",
  response: { kind: "number", label: "Muffins" },
};

const choice: PublicProblem = {
  id: "design-choice",
  templateId: "design-fraction-template",
  templateVersion: 1,
  seed: "design",
  prompt: "Which fraction is equal to $\\frac{3}{4}$?",
  skillId: "design-equivalent-fractions",
  response: {
    kind: "choice",
    label: "Choose one",
    options: [
      { id: "a", label: "$\\frac{6}{8}$" },
      { id: "b", label: "$\\frac{4}{3}$" },
      { id: "c", label: "$\\frac{3}{8}$" },
      { id: "d", label: "$\\frac{7}{10}$" },
    ],
  },
};

const typedExplanation = [
  "There are 3 trays, and each tray holds 12 muffins.",
  "Equal groups multiply: 3 × 12 = 36.",
];

const longExplanation = [
  "The question asks for the total number of muffins, so we need every muffin on every tray.",
  "Each tray holds the same number, 12. Equal groups like this are multiplication: the number of groups times the size of each group.",
  "There are 3 groups of 12, so the total is 3 × 12.",
  "Break 12 into 10 and 2, which are easier to multiply: 3 × 10 = 30, and 3 × 2 = 6.",
  "Add the two parts back together: 30 + 6 = 36.",
  "Check by adding the trays one at a time: 12 + 12 = 24, and 24 + 12 = 36. Both ways give the same total.",
  "An answer of 15 comes from adding 3 and 12. Adding counts the trays and the muffins on one tray together, which is not the question.",
  "So the baker has 36 muffins in all.",
];

export const practiceFixtures = {
  typed: {
    problem: typed,
    answer: "36",
    explanation: typedExplanation,
    response: "",
    outcome: null,
  },
  choice: {
    problem: choice,
    answer: "a",
    explanation: [
      "Multiply the top and bottom of $\\frac{3}{4}$ by the same number to get an equal fraction.",
      "$\\frac{3 \\times 2}{4 \\times 2} = \\frac{6}{8}$.",
    ],
    response: "a",
    outcome: null,
  },
  correct: {
    problem: typed,
    answer: "36",
    explanation: typedExplanation,
    response: "36",
    outcome: "correct",
  },
  mastered: {
    problem: typed,
    answer: "36",
    explanation: typedExplanation,
    response: "36",
    outcome: "correct",
    mastered: "Multiply a two-digit number by a one-digit number",
  },
  wrong: {
    problem: typed,
    answer: "36",
    explanation: typedExplanation,
    response: "15",
    outcome: "wrong",
  },
  "long-explanation": {
    problem: typed,
    answer: "36",
    explanation: longExplanation,
    response: "15",
    outcome: "wrong",
  },
  "choice-wrong": {
    problem: choice,
    answer: "a",
    explanation: [
      "Multiply the top and bottom of $\\frac{3}{4}$ by the same number to get an equal fraction.",
      "$\\frac{3 \\times 2}{4 \\times 2} = \\frac{6}{8}$.",
      "$\\frac{3}{8}$ keeps the top and changes only the bottom, so it is a smaller amount.",
    ],
    response: "c",
    outcome: "wrong",
  },
  skipped: {
    problem: typed,
    answer: "36",
    explanation: typedExplanation,
    response: "",
    outcome: "skipped",
  },
  error: {
    problem: typed,
    answer: "36",
    explanation: typedExplanation,
    response: "36",
    outcome: null,
    error:
      "Your answer didn't send. Check your connection, then press Check again.",
  },
} satisfies Record<string, PracticeFixture>;
export type PracticeFixtureId = keyof typeof practiceFixtures;

export function practiceOutcome(
  fixture: PracticeFixture,
  response: string,
  kind: "correct" | "wrong" | "skipped",
): Outcome {
  return {
    id: `design-${fixture.problem.id}-${kind}`,
    ...(kind === "skipped" ? { skipped: true as const } : {}),
    problemId: fixture.problem.id,
    requestId: "design",
    skillId: fixture.problem.skillId,
    templateId: fixture.problem.templateId,
    correct: kind === "correct",
    assisted: false,
    response,
    explanation: fixture.explanation,
    answer: fixture.answer,
    createdAt: "2026-11-10T15:00:00.000Z",
  };
}

/** The skills an answer's feedback names and links to. */
export const answerSkills: AnswerSkill[] = [
  {
    id: "design-multiply",
    title: "Multiply a two-digit number by a one-digit number",
    description: "Equal groups with a larger group size.",
    gradeBand: "3–5",
    prerequisites: ["design-facts"],
  },
  {
    id: "design-facts",
    title: "Multiplication facts to 10 × 10",
    description: "Recall products of single-digit numbers.",
    gradeBand: "3–5",
  },
  {
    id: "design-equivalent-fractions",
    title: "Equivalent fractions",
    description: "Name the same amount with different fractions.",
    gradeBand: "3–5",
  },
  {
    id: "design-area",
    title: "Area of a rectangle",
    description: "Multiply side lengths to find area.",
    gradeBand: "3–5",
    prerequisites: ["design-multiply"],
  },
];
export const answerTemplates = answerSkills.map((skill) => ({
  id: `${skill.id}-template`,
  skillId: skill.id,
}));

export const answerProgress: ProgressSnapshot = {
  asOf: "2026-11-10T15:00:00.000Z",
  skills: [
    {
      skillId: "design-multiply",
      attempts: 9,
      independentCorrect: 6,
      recentIndependentCorrect: 3,
      independentOccasions: 4,
      status: "practicing",
      lastPracticedAt: "2026-11-10T15:00:00.000Z",
      reviewDueAt: null,
      recent: [
        { correct: true, assisted: false, at: "2026-11-10T14:40:00.000Z" },
        { correct: false, assisted: false, at: "2026-11-10T14:44:00.000Z" },
        { correct: true, assisted: true, at: "2026-11-10T14:50:00.000Z" },
        { correct: true, assisted: false, at: "2026-11-10T14:55:00.000Z" },
        { correct: true, assisted: false, at: "2026-11-10T15:00:00.000Z" },
      ],
    },
  ],
};

/* ---------- Levels ---------- */

export const strandIds = [
  "number",
  "operations",
  "fractions",
  "measurement",
  "geometry",
  "data",
] as const;

export const frontier: Frontier = {
  expected: 4,
  overall: { level: 4.4, sd: 0.35, answered: 212, independent: 171 },
  strands: {
    number: { level: 5.1, sd: 0.3, answered: 48, independent: 44 },
    operations: { level: 4.6, sd: 0.25, answered: 71, independent: 60 },
    fractions: { level: 3.4, sd: 0.45, answered: 39, independent: 27 },
    measurement: { level: 4.1, sd: 0.6, answered: 22, independent: 17 },
    geometry: { level: 4.8, sd: 0.9, answered: 9, independent: 8 },
    data: { level: 4.4, sd: 1.4, answered: 0, independent: 0 },
  },
};

export const trend: TrendPoint[] = [
  { answered: 0, level: 4, sd: 1.6 },
  { answered: 20, level: 4.6, sd: 1.1 },
  { answered: 40, level: 4.2, sd: 0.8 },
  { answered: 60, level: 4.5, sd: 0.6 },
  { answered: 80, level: 4.3, sd: 0.45 },
  { answered: 100, level: 4.4, sd: 0.35 },
];

const day = (offset: number) =>
  new Date(Date.UTC(2026, 10, 10) - offset * 86_400_000)
    .toISOString()
    .slice(0, 10);

const work: WorkItem[] = [
  {
    id: "w1",
    day: day(0),
    at: `${day(0)}T14:42:00.000Z`,
    prompt:
      "A baker fills 3 trays with 12 muffins on each tray. How many muffins?",
    answer: "36",
    response: "36",
    result: "independent",
    review: false,
    skill: "Multiply by a one-digit number",
    strand: "operations",
  },
  {
    id: "w2",
    day: day(0),
    at: `${day(0)}T14:40:00.000Z`,
    prompt: "Which fraction is equal to $\\frac{3}{4}$?",
    answer: "$\\frac{6}{8}$",
    response: "$\\frac{3}{8}$",
    result: "missed",
    review: false,
    skill: "Equivalent fractions",
    strand: "fractions",
  },
  {
    id: "w3",
    day: day(1),
    at: `${day(1)}T15:05:00.000Z`,
    prompt: "Round 4,862 to the nearest hundred.",
    answer: "4,900",
    response: "4,900",
    result: "hint",
    review: true,
    skill: "Round whole numbers",
    strand: "number",
  },
  {
    id: "w4",
    day: day(2),
    at: `${day(2)}T09:30:00.000Z`,
    prompt:
      "A rectangular garden is 14 feet long and 9 feet wide. A path 2 feet wide runs around the outside of the garden. What is the area of the path alone, in square feet?",
    answer: "108",
    response: "108",
    result: "paper",
    review: false,
    skill: "Area of composite rectangles",
    strand: "measurement",
  },
];

export const record: ProgressRecord = {
  level: {
    overall: { level: 4.4, sd: 0.35 },
    strands: {
      number: { level: 5.1, sd: 0.3 },
      operations: { level: 4.6, sd: 0.25 },
      fractions: { level: 3.4, sd: 0.45 },
      measurement: { level: 4.1, sd: 0.6 },
      geometry: { level: 4.8, sd: 0.9 },
    },
  },
  reference: { from: 4, to: 5 },
  strands: [
    { id: "number", label: "Numbers" },
    { id: "operations", label: "Operations" },
    { id: "fractions", label: "Fractions" },
    { id: "measurement", label: "Measurement" },
    { id: "geometry", label: "Geometry" },
  ],
  weeks: Array.from({ length: 12 }, (_, index) => ({
    week: day((11 - index) * 7),
    minutes: [0, 42, 65, 30, 0, 88, 120, 95, 61, 140, 102, 76][index]!,
  })),
  objectives: [
    {
      skillId: "o1",
      title: "Multiply a two-digit number by a one-digit number",
      strand: "operations",
      day: day(1),
    },
    {
      skillId: "o2",
      title: "Compare fractions with like denominators",
      strand: "fractions",
      day: day(6),
    },
    {
      skillId: "o3",
      title: "Round whole numbers to any place",
      strand: "number",
      day: day(13),
    },
  ],
  work,
};

export const emptyRecord: ProgressRecord = {
  level: null,
  reference: null,
  strands: [],
  weeks: Array.from({ length: 12 }, (_, index) => ({
    week: day((11 - index) * 7),
    minutes: 0,
  })),
  objectives: [],
  work: [],
};

export const time: Pick<StudentTimeResponse, "range" | "days" | "skills"> = {
  range: { from: day(41), to: day(0) },
  days: Array.from({ length: 24 }, (_, index) => ({
    day: day(index * 1.7 > 41 ? 41 : Math.round(index * 1.7)),
    minutes: [12, 25, 18, 40, 9, 31, 22, 15, 28, 35, 19, 26][index % 12]!,
    problems: 10 + (index % 7),
  })).filter(
    (entry, index, all) => all.findIndex((e) => e.day === entry.day) === index,
  ),
  skills: [
    {
      skillId: "s1",
      title: "Multiply by a one-digit number",
      strand: "operations",
      minutes: 96,
      problems: 61,
    },
    {
      skillId: "s2",
      title: "Equivalent fractions",
      strand: "fractions",
      minutes: 58,
      problems: 40,
    },
    {
      skillId: "s3",
      title: "Area of composite rectangles drawn on a grid",
      strand: "measurement",
      minutes: 21,
      problems: 12,
    },
  ],
};

/* ---------- A class ---------- */

const people = [
  ["Ada Okafor", 4.6, 0.3, false],
  ["Ben Liu", 3.2, 0.4, false],
  ["Chloé Martin", 5.4, 0.35, false],
  ["Dev Raman", 4.1, 0.9, true],
  ["Esperanza Villanueva-Castellanos", 4.9, 0.3, false],
  ["Finn Byrne", 2.6, 0.5, false],
  ["Grace Kim", 6.3, 0.3, false],
  ["Hugo Silva", null, 0, false],
] as const;

export const classMap: MapResponse = {
  class: {
    id: uuid(1),
    orgId: uuid(2),
    name: "Room 4B",
    orgName: "Maple Grove Family School",
    course: { label: "Grade 4", level: 4, from: 4, to: 5 },
  },
  strands: [
    { id: "operations", label: "Operations" },
    { id: "fractions", label: "Fractions" },
    { id: "number", label: "Numbers" },
    { id: "measurement", label: "Measurement" },
  ],
  students: people.map(([name, level, sd, provisional], index) => ({
    id: uuid(100 + index),
    name,
    first: name.split(" ")[0]!,
    gradeLevel: 4,
    provisional,
    reference: { from: 4, to: 5 },
    level:
      level === null
        ? null
        : {
            overall: { level, sd },
            strands: {
              operations: { level: level + 0.3, sd },
              fractions: { level: level - 0.6, sd: sd + 0.1 },
              number: { level: level + 0.5, sd },
              measurement: { level: level - 0.2, sd: sd + 0.3 },
            },
          },
  })),
  teachers: [
    {
      id: uuid(200),
      name: "Sam Rivera",
      first: "Sam",
      you: true,
      level: {
        overall: { level: 9.4, sd: 0.4 },
        strands: { operations: { level: 9.8, sd: 0.4 } },
      },
      provisional: false,
      reference: { from: 4, to: 5 },
    },
  ],
};

/** A roster row as a table draws it. */
export type RosterRow = {
  id: string;
  name: string;
  level: number | null;
  minutes: number;
  accuracy: number;
  lastSeen: string | null;
};
export const roster: RosterRow[] = people.map(([name, level], index) => ({
  id: uuid(300 + index),
  name,
  level,
  minutes: [312, 95, 488, 40, 260, 0, 1204, 0][index]!,
  accuracy: [86, 71, 93, 64, 88, 0, 97, 0][index]!,
  lastSeen: index === 5 || index === 7 ? null : day(index % 3),
}));

/* ---------- Workbooks ---------- */

export const workbooks: WorkbookSummary[] = [
  {
    id: "wb1",
    date: day(0),
    number: 2,
    minutes: 45,
    paper: "letter",
    code: "K7M-24Q",
    createdAt: `${day(0)}T15:00:00.000Z`,
    estimatedMinutes: 42,
    choices: {
      areas: ["fractions", "measurement"],
      lean: "stretch",
      lesson: true,
    },
    problems: 24,
    sections: [
      { kind: "warm-up", problems: 4, title: null },
      {
        kind: "lesson",
        problems: 3,
        title: "Equal fractions on a number line",
      },
      { kind: "practice", problems: 12, title: null },
      { kind: "review", problems: 5, title: null },
    ],
  },
  {
    id: "wb2",
    date: day(0),
    number: 1,
    minutes: 30,
    paper: "letter",
    code: "P2X-9RB",
    createdAt: `${day(0)}T13:00:00.000Z`,
    estimatedMinutes: 30,
    choices: { areas: [], lean: "level", lesson: true },
    problems: 16,
    sections: [
      { kind: "warm-up", problems: 3, title: null },
      { kind: "practice", problems: 13, title: null },
    ],
  },
  {
    id: "wb3",
    date: day(6),
    number: 1,
    minutes: 60,
    paper: "a4",
    code: "D4T-7WE",
    createdAt: `${day(6)}T13:00:00.000Z`,
    estimatedMinutes: 58,
    choices: { areas: [], lean: "easier", lesson: false },
    problems: 1,
    sections: [{ kind: "practice", problems: 1, title: null }],
  },
];

/** People whose names stress a layout. */
export const names = {
  short: "Ada",
  regular: "Ada Okafor",
  long: "Esperanza Villanueva-Castellanos",
  single: "Cher",
};
