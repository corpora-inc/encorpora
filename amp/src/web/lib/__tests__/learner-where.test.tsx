import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import type { ProgressRecord } from "../../../schools/teacher-contracts";
import { earnedCount } from "../../../learning/earned";
import { skills } from "../../../curriculum/catalog";
import {
  RecordLevels,
  RecordObjectives,
} from "../../features/school/classes/ProgressRecord";
import {
  bands,
  bandsHere,
  frontierRange,
  hereBand,
  levelRegion,
  planRows,
  skillState,
  type Evidence,
  type Frontier,
  type MapSkill,
} from "../../features/pathways/model";
import { learnerWhere } from "../learner-where";

afterEach(cleanup);

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

/*
 * The learner from the product grabs (2026-11-17, #15, #16): Algebra 1 is
 * the best guess, likely Grade 7 to Geometry, with Grade 5 skills earned
 * along the way. Every surface reads the same fixture and must agree.
 */
const overall = {
  level: 9.2,
  sd: 0.9,
  answered: 14,
  independent: 13,
  low: 7.1,
  high: 10.3,
};
const frontier: Frontier = {
  expected: 4,
  overall,
  strands: { number: { ...overall, level: 5.2, low: 4.6, high: 5.8 } },
};
const record: ProgressRecord = {
  level: { overall, strands: {} },
  reference: null,
  strands: [],
  weeks: [],
  earned: 3,
  objectives: [
    { skillId: "a", title: "Multiplying fractions", strand: "fractions", day: "2026-11-17" },
    { skillId: "b", title: "Powers of 10", strand: "number", day: "2026-11-17" },
    { skillId: "c", title: "Dividing by a two-digit number", strand: "operations", day: "2026-11-17" },
  ],
  work: [],
};
const map = skills as unknown as MapSkill[];
const grade5 = map.filter((s) => s.gradeBand === "5").slice(0, 3);
const evidence: Evidence[] = [
  ...grade5.map((s) => ({
    skillId: s.id,
    attempts: 1,
    independentCorrect: 1,
    independentOccasions: 1,
    status: "practicing" as const,
    reviewDueAt: null,
  })),
  {
    skillId: map.find((s) => s.gradeBand === "7")!.id,
    attempts: 2,
    independentCorrect: 0,
    independentOccasions: 0,
    status: "practicing",
    reviewDueAt: null,
  },
];

test("where the learner is: one answer on the child page, the grades view and the 3D map", () => {
  const where = learnerWhere(overall)!;
  expect(where.bestName).toBe("Algebra 1");
  expect([where.range.from, where.range.to]).toEqual([7, 10]);

  // The child page's estimate, in words.
  render(<RecordLevels record={record} empty="" plain />);
  expect(
    screen.getByLabelText(
      "Overall: best guess Algebra 1, likely Grade 7 to Geometry",
    ),
  ).toBeTruthy();

  // Pathways reads the frontier: the same range and best guess.
  const range = frontierRange(frontier)!;
  expect(range).toMatchObject({ lo: 7, hi: 10, best: where.best });
  // Grades view: the likely range's bands, and "Where you are" on the best
  // guess, never the range's first band.
  const rows = planRows(map);
  const inRange = bandsHere(range, rows);
  expect([...inRange].sort((a, b) => a - b)).toEqual([7, 8, 9, 10]);
  expect(hereBand(range, rows, inRange)).toBe(bands[where.best]);
  // 3D: "Where you are" frames only the likely range's skills; earned Grade 5
  // skills light the map but never pull the camera to Grade 5.
  const region = levelRegion(map, frontier)!;
  for (const id of [...region.wide, ...region.close]) {
    const band = bands.indexOf(map.find((s) => s.id === id)!.gradeBand);
    expect(band).toBeGreaterThanOrEqual(where.range.from);
    expect(band).toBeLessThanOrEqual(where.range.to);
  }
});

test("before any answer there is no 'where', only the starting guess", () => {
  expect(learnerWhere({ ...overall, answered: 0 })).toBeNull();
  expect(
    frontierRange({ ...frontier, overall: { ...overall, answered: 0 } }),
  ).toBeNull();
});

test("skills earned: one count on Pathways, the grades view and the child page", () => {
  // Pathways' "n of 335 skills earned" and its grades view's dots.
  expect(earnedCount(evidence)).toBe(3);
  expect(evidence.filter((e) => skillState(e) === "earned")).toHaveLength(3);
  // The child page states the record's count (the server's, from the same
  // definition), never "None yet this year" beside Pathways' count.
  render(<RecordObjectives record={record} />);
  expect(screen.getByText("3 skills earned")).toBeTruthy();
  expect(screen.queryByText(/None yet/)).toBeNull();
  cleanup();
  render(
    <RecordObjectives record={{ ...record, earned: 0, objectives: [] }} />,
  );
  expect(screen.getByText("None yet.")).toBeTruthy();
});
