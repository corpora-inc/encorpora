import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  clientCanDraw,
  generatedProblemSchema,
  responseCapabilities,
} from "../src/math/contracts";
import {
  generateProblem,
  gradeAnswer,
  isValidResponse,
  templates,
} from "../src/math/engine";
import {
  normalizeUnitSquareMarking,
  unitSquareMarkingResponseSchema,
  unitSquareRowDescription,
} from "../src/math/unit-square-marking";
import { guessChance } from "../src/math/guess-chance";
import { problemLesson } from "../src/content/problem-lessons";
import { PrintExerciseBody } from "../src/content/print-exercise";
import { workbookHtml } from "../src/workbook/render";
import { recordPaperResults, resultRows } from "../src/workbook/results";
import type { WorkbookRecord } from "../src/workbook/contracts";
import type { LearnerTransaction, Outcome } from "../src/server/repository";
import { defaultPracticeSettings } from "../src/learning/practice-settings";

const ids = ["mark-unit-squares", "mark-improvised-units"];

test("only the independent whole-number area is submitted and graded exactly", () => {
  const problem = generateProblem(ids[0]!, "marking-grade");
  for (const raw of [
    problem.answer,
    `00${problem.answer}`,
    ` ${problem.answer}.00 `,
  ]) {
    assert.ok(isValidResponse(problem.public, raw));
    assert.ok(gradeAnswer(problem, raw));
  }
  for (const raw of [
    "0",
    String(Number(problem.answer) + 1),
    "999999999999999999",
  ]) {
    assert.ok(isValidResponse(problem.public, raw));
    assert.equal(gradeAnswer(problem, raw), false);
  }
  for (const raw of [
    "",
    " ",
    "-1",
    "1/2",
    "6.1",
    "6e0",
    "NaN",
    "Infinity",
    "6+0",
    "1".repeat(101),
    JSON.stringify({ area: problem.answer, marks: [] }),
  ]) {
    assert.equal(normalizeUnitSquareMarking(raw), null, raw);
    assert.equal(gradeAnswer(problem, raw), false);
  }
});

test("schema rejects duplicate, off-grid, oversized and answer-bearing surfaces", () => {
  const problem = generateProblem(ids[0]!, "marking-schema");
  const r = problem.public.response;
  assert.equal(r.kind, "unit-square-marking");
  if (r.kind !== "unit-square-marking") throw new Error("response");
  for (const change of [
    { cells: [...r.cells, r.cells[0]] },
    { cells: [[r.cols, 0], ...r.cells.slice(1)] },
    { cols: 6 },
    { rows: 7 },
    { cells: [[0.5, 0], ...r.cells.slice(1)] },
    { answer: problem.answer },
    { marks: [] },
  ])
    assert.equal(
      unitSquareMarkingResponseSchema.safeParse({ ...r, ...change }).success,
      false,
    );
  assert.equal(
    generatedProblemSchema.safeParse({ ...problem, answer: "999" }).success,
    false,
  );
});

test("seeded shapes, every unit, lesson, capability and numeric guessing behavior", () => {
  assert.ok(responseCapabilities.includes("unit-square-marking-v1"));
  for (const id of ids) {
    const template = templates.find((t) => t.id === id)!;
    assert.equal(guessChance(template), 0);
    assert.equal(
      clientCanDraw(template, {
        responseCapabilities: [],
        figureCapabilities: ["scenes-v1"],
      }),
      false,
    );
    assert.ok(
      clientCanDraw(template, {
        responseCapabilities: ["unit-square-marking-v1"],
        figureCapabilities: ["scenes-v1"],
      }),
    );
    const variants = new Set<string>(),
      units = new Set<string>();
    for (let i = 0; i < 256; i++) {
      const p = generateProblem(id, `marking-${i}`);
      assert.deepEqual(generateProblem(id, `marking-${i}`), p);
      generatedProblemSchema.parse(p);
      const r = p.public.response;
      if (r.kind !== "unit-square-marking") throw new Error("response");
      assert.equal(p.public.skillId, "area-by-counting-squares");
      assert.ok(gradeAnswer(p, p.answer));
      assert.equal(r.cells.length, Number(p.answer));
      assert.equal(
        (unitSquareRowDescription(r).match(/: (\d+) /g) ?? []).reduce(
          (n, count) => n + Number(count.match(/\d+/)![0]),
          0,
        ),
        Number(p.answer),
      );
      variants.add(p.variant!.id);
      units.add(r.unit);
    }
    assert.equal(units.size, id === "mark-unit-squares" ? 4 : 5);
    if (id === "mark-unit-squares") {
      for (const variant of ["rectangle", "polyomino"])
        assert.ok(variants.has(variant), variant);
      assert.ok([...variants].some((v) => v.startsWith("hole-")));
      assert.ok([...variants].some((v) => v.startsWith("composite-")));
    }
    const lesson = problemLesson(id, "marking-lesson");
    assert.ok(lesson.method.some((step) => step.includes("Tap")));
    assert.equal(lesson.example.figure?.kind, "scene");
    const print = renderToStaticMarkup(
      React.createElement(PrintExerciseBody, {
        number: 1,
        problem: generateProblem(id, "print"),
        solutions: false,
      }),
    );
    assert.match(print, /<svg/);
    assert.ok(
      !print.includes("square-marking-cell"),
      "Paper uses the existing printable scene",
    );
  }
});

test("independent oracle recounts 512 surfaces and rejects corrupt geometry and units", () => {
  const cases = ids.flatMap((id) =>
    Array.from({ length: 256 }, (_, i) => generateProblem(id, `oracle-${i}`)),
  );
  const result = spawnSync(
    "python3",
    [
      "-c",
      "import json,sys; sys.path.insert(0,'scripts'); import unit_square_marking_math_oracle as o; print(o.self_test()); cases=json.load(sys.stdin); [o.review_problem(p) for p in cases]; print(len(cases))",
    ],
    {
      input: JSON.stringify(cases),
      encoding: "utf8",
      timeout: 120000,
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /'mutations': 7/);
  assert.match(result.stdout, /512/);
});

test("paper keeps a numeric answer box and exact full-weight grading", async () => {
  const record: WorkbookRecord = {
    id: "marking-workbook",
    date: "2026-11-09",
    number: 1,
    minutes: 30,
    paper: "letter",
    code: "MARKING",
    createdAt: "2026-11-09T12:00:00Z",
    spec: {
      version: 2,
      date: "2026-11-09",
      number: 1,
      minutes: 30,
      level: 3,
      sections: [
        {
          kind: "practice",
          items: ids.map((templateId) => ({
            templateId,
            templateVersion: 1,
            seed: "paper-marking",
            skillId: "area-by-counting-squares",
            strand: "measurement",
            grade: 3,
            minutes: 2,
            space: "standard" as const,
          })),
        },
      ],
    },
  };
  const attempts: Outcome[] = [];
  const tx = {
    attemptByRequest: async (id: string) =>
      attempts.find((a) => a.requestId === id),
    attemptByProblem: async (id: string) =>
      attempts.find((a) => a.problemId === id),
    practiceSettings: async () => defaultPracticeSettings(),
    saveProblem: async () => {},
    saveAttempt: async (outcome: Outcome) => {
      attempts.push(outcome);
    },
    onSchoolRoster: async () => false,
    isAdult: async () => false,
  } as unknown as LearnerTransaction;
  assert.deepEqual(
    (await resultRows(tx, record)).map((row) => row.entry),
    ["number", "number"],
  );
  const entries = ids.map((id, i) => ({
    n: i + 1,
    answer: String(Number(generateProblem(id, "paper-marking").answer) + i),
  }));
  assert.equal(
    await recordPaperResults(tx, record, entries, new Date(record.createdAt)),
    2,
  );
  assert.deepEqual(
    attempts.map((a) => [a.correct, a.evidenceWeight ?? 1]),
    [
      [true, 1],
      [false, 1],
    ],
  );
  assert.equal(
    await recordPaperResults(tx, record, entries, new Date(record.createdAt)),
    0,
  );
  const html = workbookHtml(record.spec, {
    lessons: [],
    skillTitle: () => "Count squares",
  });
  assert.equal((html.match(/class="wb-answer-box"/g) ?? []).length, 2);
});
