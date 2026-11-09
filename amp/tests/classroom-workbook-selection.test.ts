import assert from "node:assert/strict";
import test from "node:test";
import { printableStudents } from "../src/web/features/school/classroom/stack-selection.js";

test("reprints include every issued holder regardless of focus, and never spend another student's exhausted allowance", () => {
  const students = ["a", "b", "c", "d"].map((id) => ({
    id,
    name: id,
    seated: false,
    canReadWorkbooks: true,
    canMakeWorkbook: id === "d",
  }));
  const common = {
    date: "2026-11-09",
    number: 1,
    minutes: 30 as const,
    students: 1,
    marked: 0,
  };
  const sets = [
    { ...common, focus: null, studentIds: ["a"] },
    { ...common, focus: "add-within-20", studentIds: ["b"] },
  ];
  assert.deepEqual(
    printableStudents(students, sets, common.date, 1, 30).map((s) => s.id),
    ["a", "b", "d"],
  );
  assert.deepEqual(
    printableStudents(students, sets, common.date, 2, 30).map((s) => s.id),
    ["d"],
  );
  assert.deepEqual(
    printableStudents(
      students.map((s) => ({
        ...s,
        canReadWorkbooks: false,
        canMakeWorkbook: false,
      })),
      sets,
      common.date,
      1,
      30,
    ),
    [],
  );
});
