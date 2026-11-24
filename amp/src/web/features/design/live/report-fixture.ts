import type {
  LiveStatus,
  ReportRow,
  SessionReport,
  SkillRef,
} from "../../../../schools/live/contracts";
import { makeClass, START } from "./fixtures";

/* A stopped session's report for the gallery and its check
   (scripts/verify-session-report-ui.ts): the class of fourteen, one of them
   with twenty skills, one with a single skill, two with none. Real names
   from the catalog, at their real lengths. */

export const REPORT_SKILLS: SkillRef[] = [
  ["compare-small-groups", "Comparing two groups by matching", "number"],
  ["sort-and-count", "Sorting and counting", "data"],
  ["tens-and-ones", "Reading and writing tens and ones", "number"],
  ["hundreds-place-value", "Hundreds, tens, and ones", "number"],
  ["odd-and-even", "Odd and even numbers", "number"],
  ["thirds-and-partitions", "Halves, thirds, and quarters", "fractions"],
  [
    "operation-properties",
    "Properties of addition and multiplication",
    "operations",
  ],
  ["fractions-number-line", "Fractions on a number line", "fractions"],
  ["quadrilateral-categories", "Classifying quadrilaterals", "geometry"],
  ["whole-division", "Dividing by a one-digit number", "operations"],
  ["unit-conversion", "Converting to a smaller unit", "measurement"],
  ["fraction-addition", "Adding and subtracting unlike fractions", "fractions"],
  ["shape-hierarchy", "Categories and subcategories of shapes", "geometry"],
  ["signed-numbers", "Positive and negative numbers", "number"],
  ["triangle-area", "Area of triangles and other polygons", "geometry"],
  ["rational-unit-rates", "Unit rates with fractions", "ratio"],
  [
    "linear-expressions",
    "Expanding and factoring linear expressions",
    "algebra",
  ],
  ["composite-measurement", "Area and volume of composite figures", "geometry"],
  ["scientific-notation", "Working in scientific notation", "number"],
  ["dilations-similarity", "Dilations and similarity", "geometry"],
  ["formula-rearrangement", "Rearranging a formula", "algebra"],
  [
    "linear-and-nonlinear-systems",
    "Solving a linear and a nonlinear equation together",
    "algebra",
  ],
].map(([id, title, strand]) => ({ id: id!, title: title!, strand: strand! }));

const at = (ms: number) => new Date(START + ms).toISOString();
const SESSION = "00000000-0000-4000-8000-00000011e5e5";

/** How each of the fourteen ended, and how many skills they met. */
const ENDS: [LiveStatus, number, number, number][] = [
  // status, problems, right, skills
  ["flying", 41, 41, 20],
  ["working", 16, 13, 7],
  ["struggling", 11, 3, 4],
  ["not_signed_in", 0, 0, 0],
  ["working", 19, 15, 9],
  ["idle", 3, 3, 1],
  ["working", 22, 17, 12],
  ["working", 9, 6, 3],
  ["idle", 0, 0, 0],
  ["working", 6, 5, 2],
  ["flying", 38, 37, 16],
  ["working", 21, 14, 8],
  ["struggling", 13, 4, 5],
  ["not_signed_in", 0, 0, 0],
];

function reportRows(count: number): ReportRow[] {
  return makeClass(14)
    .slice(0, count)
    .map((student, index): ReportRow => {
      const [status, problems, correct, met] = ENDS[index]!;
      const skills = Array.from(
        { length: met },
        (_, n) => REPORT_SKILLS[(index * 3 + n) % REPORT_SKILLS.length]!,
      );
      const assisted =
        status === "struggling" ? Math.ceil(problems / 2) : index % 3;
      const answered = problems > 0;
      return {
        personId: student.personId,
        name: student.name,
        problems,
        correct,
        independent: Math.max(0, correct - Math.min(assisted, correct)),
        assisted: Math.min(assisted, problems),
        hints: answered ? (index * 2) % 5 : 0,
        lessons: status === "struggling" ? 3 : 0,
        examples: status === "struggling" ? 12 : index % 2,
        videos: index === 2 ? 1 : 0,
        skills,
        skill: skills.at(-1) ?? null,
        level: status === "not_signed_in" ? null : student.level,
        firstSeenAt:
          status === "not_signed_in" ? null : at(20_000 + index * 4_000),
        firstAnswerAt: answered ? at(60_000 + index * 5_000) : null,
        lastAnswerAt: answered ? at(19 * 60_000 - index * 7_000) : null,
        status,
      };
    });
}

/** A class's stopped session: fourteen students, twenty minutes. */
export function reportFixture(count = 14): SessionReport {
  const rows = reportRows(count);
  const sum = (pick: (row: ReportRow) => number) =>
    rows.reduce((total, row) => total + pick(row), 0);
  return {
    session: {
      id: SESSION,
      classId: "00000000-0000-4000-8000-00000011c1a5",
      startedAt: at(0),
      plannedEndAt: at(20 * 60_000),
      endsAt: at(20 * 60_000),
      endedAt: at(20 * 60_000),
      endReason: "planned_end",
      startedBy: null,
      endedBy: null,
      rulesVersion: 1,
    },
    rows,
    totals: {
      students: rows.length,
      present: rows.filter((row) => row.status !== "not_signed_in").length,
      answering: 0,
      problems: sum((row) => row.problems),
      correct: sum((row) => row.correct),
      independent: sum((row) => row.independent),
      assisted: sum((row) => row.assisted),
      hints: sum((row) => row.hints),
      lessons: sum((row) => row.lessons),
      examples: sum((row) => row.examples),
      videos: sum((row) => row.videos),
    },
  };
}
