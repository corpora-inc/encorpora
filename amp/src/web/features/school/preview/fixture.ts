/**
 * Synthetic data for the AMP for Schools design preview. Every school, teacher
 * and student here is invented. Nothing reads this file in production; later
 * screens replace it with real data.
 */
import { levelScale, type LevelEstimate } from "../../../ui/LevelChart";

export const today = "Friday, November 6";
export const teacher = { name: "Grace Okafor", greeting: "Ms. Okafor" };
export const school = { name: "Alder Street School" };
export const classInfo = { name: "Grade 5 Math" };
/** The course's grade, as the band a class map marks: level 5 rounds to Grade
 * 5 from 4.5 up to 5.5. */
export const course = {
  name: "Grade 5",
  level: 5,
  band: [4.5, 5.5] as const,
};

/** A class's strands in the order the charts draw them: this order keeps
 * neighboring hues apart under color vision deficiency, in both themes. */
export const strands = [
  { id: "fractions", label: "Fractions" },
  { id: "number", label: "Numbers" },
  { id: "measurement", label: "Measurement" },
  { id: "operations", label: "Operations" },
  { id: "geometry", label: "Geometry" },
] as const;
export type StrandId = (typeof strands)[number]["id"];

export type Student = {
  id: string;
  name: string;
  first: string;
  overall: LevelEstimate;
  strands: Record<StrandId, LevelEstimate>;
  /** Components of the term's grade, 0 to 100. */
  course: number;
  growth: number;
  retention: number;
  minutesPerWeek: number;
  minutesThisWeek: number;
  problemsThisWeek: number;
  problemsThisTerm: number;
  /** Too little work this term to suggest a range. */
  notEnoughWork?: boolean;
  joined?: string;
};

/** name, overall, sd, [fractions, numbers, measurement, operations, geometry],
 * course, growth, minutes a week, retention, this week's share of usual */
const rows: [
  string,
  number,
  number,
  [number, number, number, number, number],
  number,
  number,
  number,
  number,
  number,
][] = [
  ["Priya Raman", 6.9, 0.3, [6.8, 7.1, 6.6, 7.2, 6.7], 98, 94, 74, 96, 1.1],
  ["Sam Whitlock", 6.6, 0.32, [6.9, 6.7, 6.2, 6.8, 6.4], 96, 90, 68, 92, 0.9],
  ["Mei Tran", 6.1, 0.3, [5.9, 6.3, 6.0, 6.4, 5.8], 92, 82, 64, 90, 1.0],
  ["Felix Grant", 5.9, 0.34, [5.7, 6.1, 5.8, 6.0, 5.9], 90, 74, 58, 84, 0.85],
  ["Amara Osei", 5.7, 0.3, [5.5, 5.9, 5.6, 5.8, 5.7], 88, 78, 60, 86, 1.05],
  ["Ruth Adeyemi", 5.6, 0.36, [5.8, 5.5, 5.4, 5.7, 5.6], 86, 72, 54, 82, 0.95],
  ["Kai Nakamura", 5.5, 0.33, [5.2, 5.7, 5.6, 5.6, 5.3], 84, 70, 52, 80, 1.1],
  ["Zara Mensah", 5.4, 0.31, [5.6, 5.2, 5.5, 5.3, 5.6], 83, 80, 62, 78, 1.0],
  ["Isaac Moreno", 5.3, 0.35, [5.0, 5.5, 5.4, 5.4, 5.1], 81, 68, 48, 76, 0.8],
  ["Sofia Marin", 5.2, 0.3, [5.1, 5.3, 5.2, 5.4, 5.0], 80, 74, 56, 84, 1.05],
  ["Imani Clarke", 5.1, 0.34, [4.9, 5.2, 5.3, 5.0, 5.2], 78, 76, 60, 74, 0.95],
  ["Tomas Vega", 5.0, 0.38, [4.8, 5.1, 5.2, 4.9, 5.1], 76, 66, 44, 70, 0.7],
  ["Nadia Petrov", 4.9, 0.32, [4.7, 5.0, 5.1, 5.0, 4.8], 74, 82, 58, 72, 1.0],
  ["Eli Novak", 4.8, 0.36, [4.6, 5.0, 4.9, 4.9, 4.7], 72, 60, 42, 68, 0.9],
  ["Lena Fischer", 4.7, 0.33, [3.7, 5.1, 5.0, 4.9, 4.8], 70, 64, 50, 66, 1.0],
  ["Diego Salas", 4.6, 0.35, [3.6, 4.9, 4.8, 4.9, 4.6], 68, 70, 54, 64, 1.15],
  ["Marcus Bell", 4.6, 0.85, [4.4, 4.8, 4.7, 4.6, 4.5], 70, 52, 44, 58, 0],
  ["Hana Sato", 4.5, 0.34, [3.5, 4.8, 4.6, 4.8, 4.7], 66, 76, 56, 70, 1.0],
  ["Owen Hartley", 4.4, 0.37, [3.4, 4.7, 4.7, 4.6, 4.3], 66, 64, 44, 60, 0.75],
  ["Caleb Ortiz", 4.3, 0.36, [4.0, 4.5, 4.4, 4.5, 4.2], 62, 62, 46, 58, 0.9],
  ["Jonah Reyes", 4.2, 0.38, [3.3, 4.6, 4.5, 4.4, 4.1], 60, 68, 48, 62, 1.1],
  ["Noor Haddad", 4.0, 0.4, [3.1, 4.4, 4.2, 4.3, 4.0], 56, 84, 52, 66, 1.2],
  ["Theo Lindqvist", 3.8, 0.42, [3.6, 4.1, 3.9, 4.0, 3.7], 52, 88, 58, 56, 1.0],
  ["Elias Frost", 4.9, 0.95, [4.7, 5.0, 5.0, 4.8, 4.9], 0, 0, 6, 0, 1.3],
];

const slug = (name: string) => name.toLowerCase().replace(/\s+/g, "-");

export const students: Student[] = rows.map((row) => {
  const [name, level, sd, marks, course, growth, minutes, retention, share] =
    row;
  const estimate = (mark: number): LevelEstimate => ({
    level: mark,
    sd: sd + 0.12,
  });
  const minutesThisWeek = Math.round(minutes * share);
  return {
    id: slug(name),
    name,
    first: name.split(" ")[0]!,
    overall: { level, sd: sd + 0.08 },
    strands: {
      fractions: estimate(marks[0]),
      number: estimate(marks[1]),
      measurement: estimate(marks[2]),
      operations: estimate(marks[3]),
      geometry: estimate(marks[4]),
    },
    course,
    growth,
    retention,
    minutesPerWeek: minutes,
    minutesThisWeek,
    problemsThisWeek: Math.round(minutesThisWeek * 2.9),
    problemsThisTerm: Math.round(minutes * 2.9 * 3),
    ...(course === 0
      ? { notEnoughWork: true, joined: "October 28" }
      : undefined),
  };
});

export const studentById = (id: string | undefined) =>
  students.find((student) => student.id === id);
export const fullNames = (ids: readonly string[]) =>
  ids.map((id) => studentById(id)!.name);

/** One scale for every band on the class map, so all columns read alike. */
export const scale = levelScale(
  course.level,
  students.flatMap((student) => [
    student.overall,
    ...Object.values(student.strands),
  ]),
);

export const week = {
  minutes: students.reduce((sum, s) => sum + s.minutesThisWeek, 0),
  problems: students.reduce((sum, s) => sum + s.problemsThisWeek, 0),
  working: students.filter((s) => s.minutesThisWeek > 0).length,
};

export type Todo = {
  id: string;
  title: string;
  detail: string;
  students: readonly string[];
};
const stuck = [
  "noor-haddad",
  "diego-salas",
  "lena-fischer",
  "jonah-reyes",
  "owen-hartley",
  "hana-sato",
];
export const todos: readonly Todo[] = [
  {
    id: "stuck-fractions",
    title: "6 students are stuck on equivalent fractions",
    detail:
      "Noor, Diego, Lena, Jonah, Owen and Hana keep changing only the denominator. A short lesson together should clear it.",
    students: stuck,
  },
  {
    id: "marcus",
    title: "Marcus hasn’t practiced this week",
    detail:
      "His last session was Thursday, October 29. Before that he averaged 44 minutes a week.",
    students: ["marcus-bell"],
  },
  {
    id: "ready",
    title: "Priya and Sam are ready for more",
    detail:
      "Both are past Grade 5 in every strand, and they keep getting spaced review right without help.",
    students: ["priya-raman", "sam-whitlock"],
  },
];

export const lesson = {
  id: "equivalent-fractions",
  title: "Equivalent fractions",
  minutes: 12,
  steps: [
    "Fold a paper strip into thirds and shade 2 of them.",
    "Fold each third into 4 equal parts, then count again: 8 of 12 parts are shaded.",
    "Write what happened: multiply the top and the bottom by 4, so 2/3 = 8/12.",
  ],
  slip: "The slip to watch for: changing only the bottom. 2/12 is a much smaller amount than 2/3.",
};

/* The gradebook */
export type TermId = "q1" | "q2" | "q3" | "q4";
export type Term = {
  id: TermId;
  label: string;
  name: string;
  dates: string;
  state: "closed" | "open" | "upcoming";
  starts?: string;
};
export const terms: readonly Term[] = [
  {
    id: "q1",
    label: "Q1",
    name: "Quarter 1",
    dates: "August 17 to October 16",
    state: "closed",
  },
  {
    id: "q2",
    label: "Q2",
    name: "Quarter 2",
    dates: "October 19 to December 18",
    state: "open",
  },
  {
    id: "q3",
    label: "Q3",
    name: "Quarter 3",
    dates: "January 5 to March 12",
    state: "upcoming",
    starts: "January 5",
  },
  {
    id: "q4",
    label: "Q4",
    name: "Quarter 4",
    dates: "March 22 to May 28",
    state: "upcoming",
    starts: "March 22",
  },
];

const letters: [number, string][] = [
  [97, "A+"],
  [93, "A"],
  [90, "A−"],
  [87, "B+"],
  [83, "B"],
  [80, "B−"],
  [77, "C+"],
  [73, "C"],
  [70, "C−"],
  [67, "D+"],
  [63, "D"],
  [60, "D−"],
  [0, "F"],
];
export const letterFor = (percent: number) =>
  letters.find(([floor]) => percent >= floor)![1];

export type Components = {
  course: number;
  growth: number;
  practice: number;
  retention: number;
};
/** The term's four components. A closed term keeps what it had. */
export function componentsFor(
  student: Student,
  target: number,
  term: TermId,
): Components {
  const frozen = term === "q1";
  const practice = Math.min(
    100,
    Math.round((student.minutesPerWeek / (frozen ? 60 : target)) * 100),
  );
  if (frozen)
    return {
      course: Math.max(0, student.course - 7),
      growth: Math.min(100, student.growth + 3),
      practice: Math.min(100, practice + 4),
      retention: Math.max(0, student.retention - 2),
    };
  return {
    course: student.course,
    growth: student.growth,
    practice,
    retention: student.retention,
  };
}

export type Suggestion = {
  low: number;
  high: number;
  letters: string;
  percent: string;
};
/** The suggested range, from the design's fixed weights. Too little work
 * suggests nothing: never a low grade. */
export function suggestionFor(
  student: Student,
  target: number,
  term: TermId,
): Suggestion | null {
  if (student.notEnoughWork) return null;
  const c = componentsFor(student, target, term);
  const score =
    0.4 * c.course + 0.3 * c.growth + 0.2 * c.practice + 0.1 * c.retention;
  const low = Math.max(0, Math.round(score - 3)),
    high = Math.min(100, Math.round(score + 4));
  const from = letterFor(low),
    to = letterFor(high);
  return {
    low,
    high,
    letters: from === to ? from : `${from} to ${to}`,
    percent: `${low}–${high}`,
  };
}

/** Final grades the teacher has typed so far this quarter, in the forms a
 * school might use. */
export const seededFinals: Record<string, string> = {
  "priya-raman": "A",
  "sam-whitlock": "A",
  "mei-tran": "A−",
  "felix-grant": "A−",
  "amara-osei": "B+",
  "ruth-adeyemi": "B+",
  "kai-nakamura": "B",
  "zara-mensah": "B",
  "sofia-marin": "B−",
};
/** A closed term's finals: the middle of its range, frozen. */
export function closedFinal(student: Student) {
  const suggestion = suggestionFor(student, 60, "q1");
  return suggestion
    ? letterFor(Math.round((suggestion.low + suggestion.high) / 2))
    : "";
}

/* Evidence behind a suggested range */
export type ProblemResult = "correct" | "hint" | "missed";
export type Evidence = {
  lines: { label: string; value: number | null; text: string }[];
  objectives: { date: string; text: string; strand: StrandId }[];
  problems: {
    date: string;
    prompt: string;
    answer: string;
    result: ProblemResult;
  }[];
};
const objectivePool: { text: string; strand: StrandId }[] = [
  { text: "Add fractions with unlike denominators", strand: "fractions" },
  { text: "Compare decimals to thousandths", strand: "number" },
  { text: "Find volume by packing unit cubes", strand: "measurement" },
  { text: "Divide by two-digit divisors", strand: "operations" },
  { text: "Graph points in the first quadrant", strand: "geometry" },
  { text: "Multiply a fraction by a whole number", strand: "fractions" },
  { text: "Round decimals to any place", strand: "number" },
  { text: "Convert between metric units", strand: "measurement" },
  { text: "Evaluate expressions with parentheses", strand: "operations" },
  { text: "Classify two-dimensional figures", strand: "geometry" },
];
const objectiveDates = ["Nov 5", "Nov 3", "Oct 30", "Oct 28"];
const problemPool: Omit<Evidence["problems"][number], "date">[] = [
  { prompt: "3/4 + 1/6", answer: "11/12", result: "correct" },
  {
    prompt: "Which is greater, 0.405 or 0.45?",
    answer: "0.45",
    result: "correct",
  },
  { prompt: "2/3 × 12", answer: "8", result: "hint" },
  {
    prompt: "A box is 4 cm by 3 cm by 5 cm. What is its volume?",
    answer: "60 cubic cm",
    result: "correct",
  },
  { prompt: "1,248 ÷ 24", answer: "52", result: "correct" },
];
const problemDates = ["Nov 4", "Nov 2", "Oct 29"];
const stuckProblem: Evidence["problems"][number] = {
  date: "Nov 5",
  prompt: "Write 2/3 with a denominator of 12.",
  answer: "2/12",
  result: "missed",
};

export function evidenceFor(
  student: Student,
  target: number,
  term: TermId,
): Evidence {
  const index = students.indexOf(student);
  const pick = <T>(pool: readonly T[], count: number) =>
    Array.from(
      { length: count },
      (_, i) => pool[(index * 3 + i * 2) % pool.length]!,
    );
  const problems = (count: number) =>
    pick(problemPool, count).map((problem, i) => ({
      ...problem,
      date: problemDates[i]!,
    }));
  if (student.notEnoughWork)
    return {
      lines: [
        {
          label: "Course progress",
          value: null,
          text: `Joined ${student.joined}, about ${student.problemsThisTerm} problems so far.`,
        },
        {
          label: "Growth",
          value: null,
          text: "Too early to measure against the start of the term.",
        },
        {
          label: "Practice",
          value: null,
          text: `${student.minutesPerWeek} of ${target} minutes a week since joining.`,
        },
        {
          label: "Retention",
          value: null,
          text: "No spaced review has come due yet.",
        },
      ],
      objectives: [
        {
          date: "Nov 2",
          text: "Compare decimals to thousandths",
          strand: "number",
        },
      ],
      problems: problems(2),
    };
  const c = componentsFor(student, target, term);
  const objectives = Math.max(1, Math.round(c.growth / 8));
  const gained = ((c.growth / 100) * 0.45).toFixed(1);
  const isStuck = stuck.includes(student.id);
  return {
    lines: [
      {
        label: "Course progress",
        value: c.course,
        text: `Working around grade ${student.overall.level.toFixed(1)}, against ${course.level + 0.3} for this point in the course.`,
      },
      {
        label: "Growth",
        value: c.growth,
        text: `${objectives} new objectives and ${gained} grades gained this term.`,
      },
      {
        label: "Practice",
        value: c.practice,
        text: `${student.minutesPerWeek} of ${target} minutes a week, ${student.problemsThisTerm} problems so far.`,
      },
      {
        label: "Retention",
        value: c.retention,
        text: `${Math.round(c.retention * 0.3)} of 30 spaced reviews right without help.`,
      },
    ],
    objectives: pick(objectivePool, 4).map((objective, i) => ({
      ...objective,
      date: objectiveDates[i]!,
    })),
    problems: isStuck ? [stuckProblem, ...problems(2)] : problems(3),
  };
}

/** A long synthetic roster: a whole school, for the virtualized grid. */
const givenNames =
  "Ada Ben Cora Dev Esme Finn Gia Hugo Iris Jude Kira Leo Maya Nico Opal Pia Quinn Rafi Sana Tess Uma Vik Wren Yara Zane".split(
    " ",
  );
const familyNames =
  "Abara Boyd Castillo Dang Ellis Farouk Gupta Holm Ibarra Jensen Kaur Lowe Mbeki Nolan Ortega Park Quist Rossi Silva Tanaka Usman Vance Wu Yilmaz Zhou".split(
    " ",
  );
export type RosterRow = {
  id: string;
  name: string;
  grade: number;
  teacher: string;
  room: number;
  minutes: number;
  problems: number;
  overall: number;
};
export const roster: RosterRow[] = Array.from({ length: 420 }, (_, i) => {
  const name = `${givenNames[(i * 7) % givenNames.length]} ${familyNames[(i * 11 + Math.floor(i / 25)) % familyNames.length]}`;
  const grade = 3 + (i % 4);
  const minutes = 20 + ((i * 13) % 70);
  return {
    id: `${slug(name)}-${i}`,
    name,
    grade,
    teacher: ["Ms. Okafor", "Mr. Lund", "Ms. Abreu", "Mr. Tate"][i % 4]!,
    room: 10 + (i % 12),
    minutes,
    problems: Math.round(minutes * 2.9),
    overall: Math.round((grade - 1 + ((i * 17) % 30) / 10) * 10) / 10,
  };
});
