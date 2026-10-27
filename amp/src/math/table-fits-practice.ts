import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import { chainFamily, choiceSurface, dispatch, pick } from "./chain-kit";
import { draw, shuffled } from "./elementary-gap-kit";

export const tableFitsTemplate: TemplateMetadata = {
  id: "table-fits-description",
  version: 1,
  requiredResponseCapability: "single-choice-v1",
  title: "Which table fits the survey?",
  skillId: "categorical-data",
  gradeBand: "3–5",
  difficultyOffset: 0.2,
  description:
    "Choose the table of counts that fits a survey's total and number of choices, or the two-way table that fits two row totals and a column total.",
};

type R = (lo: number, hi: number) => number;
const surveys = [
  {
    ask: "favorite lunch",
    names: ["Pizza", "Pasta", "Salad", "Soup", "Tacos"],
    noun: "students",
  },
  {
    ask: "favorite pet",
    names: ["Dogs", "Cats", "Fish", "Birds", "Rabbits"],
    noun: "students",
  },
  {
    ask: "favorite sport",
    names: ["Soccer", "Tennis", "Swimming", "Baseball", "Running"],
    noun: "students",
  },
  {
    ask: "favorite color",
    names: ["Red", "Blue", "Green", "Yellow", "Purple"],
    noun: "students",
  },
];

const axes = {
  shape: defineAxis("shape", ["one-way-total", "two-way"] as const),
};

interface OneWay {
  kind: "one-way-total";
  survey: (typeof surveys)[number];
  total: number;
  names: string[];
  counts: number[];
  wrong: { names: string[]; counts: number[]; why: string }[];
}
interface TwoWay {
  kind: "two-way";
  rows: [number, number];
  boys: number;
  /** Correct table: [boys, girls] for grade 4, then grade 5. */
  correct: [number, number, number, number];
  wrong: { table: [number, number, number, number]; why: string }[];
}
type Model = OneWay | TwoWay;

const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);
function split(r: R, total: number, parts: number): number[] {
  // Every part at least 1 and no two equal, so the table has a clear shape.
  for (let t = 0; t < 400; t++) {
    const counts = Array(parts).fill(1) as number[];
    for (let i = 0; i < total - parts; i++) counts[r(0, parts - 1)]!++;
    if (new Set(counts).size === parts) return counts;
  }
  throw new Error("Need three retries");
}

function model(r: R, a: { shape: Model["kind"] }): Model {
  if (a.shape === "one-way-total") {
    const survey = pick(r, surveys);
    const k = pick(r, [3, 4]);
    const total = r(k === 3 ? 12 : 14, 24);
    const names = draw(r, survey.names, k);
    const counts = split(r, total, k);
    // Wrong tables: total one too small, total one too large, wrong number of
    // choices with the right total.
    const miss = r(0, k - 1);
    const small = counts.map((c, i) => (i === miss ? c - 1 : c));
    const big = counts.map((c, i) => (i === miss ? c + 1 : c));
    if (small.some((c) => c < 1)) throw new Error("Need three retries");
    const fewer = k === 4 ? split(r, total, 3) : split(r, total, 4);
    const fewerNames = k === 4 ? names.slice(0, 3) : draw(r, survey.names, 4);
    return {
      kind: a.shape,
      survey,
      total,
      names,
      counts,
      wrong: [
        {
          names,
          counts: small,
          why: `The counts in this table add to ${total - 1}, not ${total}.`,
        },
        {
          names,
          counts: big,
          why: `The counts in this table add to ${total + 1}, not ${total}.`,
        },
        {
          names: fewerNames,
          counts: fewer,
          why: `The counts add to ${total}, but this table has ${fewerNames.length} choices and the survey had ${k}.`,
        },
      ],
    };
  }
  for (let t = 0; t < 400; t++) {
    const b1 = r(5, 14);
    const g1 = r(5, 14);
    const b2 = r(5, 14);
    const g2 = r(5, 14);
    const rows: [number, number] = [b1 + g1, b2 + g2];
    const boys = b1 + b2;
    if (new Set([b1, g1, b2, g2]).size < 4) continue;
    const wrongTables: {
      table: [number, number, number, number];
      why: string;
    }[] = [
      {
        table: [b1, g1 + (r(0, 1) ? 1 : -1) * 2, b2, g2],
        why: "The first row of this table does not add to the first total.",
      },
      {
        table: [b1, g1, b2 + 3, g2],
        why: "The second row of this table does not add to the second total.",
      },
      {
        table: [g1, b1, b2, g2],
        why: "Both rows add to the right totals, but the boys in this table do not add to the total number of boys.",
      },
    ];
    const ok = (t2: number[]) =>
      t2[0]! + t2[1]! === rows[0] &&
      t2[2]! + t2[3]! === rows[1] &&
      t2[0]! + t2[2]! === boys;
    if (wrongTables.some((w) => ok(w.table))) continue;
    if (wrongTables.some((w) => w.table.some((v) => v < 1))) continue;
    return {
      kind: a.shape,
      rows,
      boys,
      correct: [b1, g1, b2, g2],
      wrong: wrongTables,
    };
  }
  throw new Error("Need three retries");
}

const oneWayLabel = (names: string[], counts: number[]) =>
  names.map((n, i) => `${n} ${counts[i]}`).join(", ");
const twoWayLabel = (t: number[]) =>
  `Grade 4: ${t[0]} boys, ${t[1]} girls. Grade 5: ${t[2]} boys, ${t[3]} girls`;

export const tableFits = chainFamily({
  template: tableFitsTemplate,
  axes,
  model,
  variant: (m) => m.kind,
  render: (m, _a, r) => {
    if (m.kind === "one-way-total") {
      const k = m.names.length;
      const options = [
        { label: oneWayLabel(m.names, m.counts), correct: true as const },
        ...m.wrong.map((w) => ({
          label: oneWayLabel(w.names, w.counts),
          feedback: w.why,
        })),
      ];
      return choiceSurface(r, {
        prompt: `${m.total} ${m.survey.noun} were asked for their ${m.survey.ask}. Each student chose one of ${k} choices, and the results go in a table. Which table could show the results?`,
        options,
        hint: `Add the counts in each table: the total must be ${m.total}. Then count the choices in the table: there must be ${k}.`,
        explanation: [
          `Each of the ${m.total} students chose exactly one of ${k} choices, so the counts add to ${m.total} and the table has ${k} choices.`,
          `In the table ${oneWayLabel(m.names, m.counts)}, the counts give $${m.counts.join("+")}=${m.total}$ and there are ${k} choices.`,
          "Each other table has a total or a number of choices that does not fit.",
        ],
      });
    }
    const [t1, t2] = m.rows;
    return choiceSurface(r, {
      prompt: `A school counted the students in two grades. Grade 4 has ${t1} students and Grade 5 has ${t2} students. Altogether ${m.boys} of the students are boys. Which table fits all of this?`,
      options: shuffled(r, [
        { label: twoWayLabel(m.correct), correct: true as const },
        ...m.wrong.map((w) => ({
          label: twoWayLabel(w.table),
          feedback: w.why,
        })),
      ]),
      hint: `Check three totals for each table: boys plus girls in Grade 4 must be ${t1}, boys plus girls in Grade 5 must be ${t2}, and the boys of both grades together must be ${m.boys}.`,
      explanation: [
        `Three facts must all hold: Grade 4 has ${t1} students, Grade 5 has ${t2}, and ${m.boys} students are boys in all.`,
        `${twoWayLabel(m.correct)}: $${m.correct[0]}+${m.correct[1]}=${t1}$, $${m.correct[2]}+${m.correct[3]}=${t2}$ and $${m.correct[0]}+${m.correct[2]}=${m.boys}$.`,
        "Each other table breaks at least one of the three totals.",
      ],
    });
  },
});

export const tableFitsTemplates = [tableFitsTemplate] as const;
export const tableFitsGenerate = dispatch(tableFitsTemplates, {
  "table-fits-description": (seed) => tableFits.generate(seed).problem,
});
