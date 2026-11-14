import assert from "node:assert/strict";
import test from "node:test";
import { startSchoolClassSchema } from "../src/schools/pilot-contracts.js";
import { courseFromName } from "../src/web/features/school/courses.js";

test("a class's name suggests its course, and says none when it names none", () => {
  for (const [name, course] of [
    ["Grade 4 Math", "4"],
    ["grade 7 math, period 2", "7"],
    ["3rd grade math", "3"],
    ["Kindergarten", "K"],
    ["Algebra 1", "algebra-1"],
    ["Algebra II honors", "algebra-2"],
    ["Geometry B", "geometry"],
    ["Pre-calculus", "precalculus"],
    ["Math support", null],
    ["Grade 12 Math", null],
    ["Room 4", null],
  ] as const)
    assert.equal(courseFromName(name), course, name);
});

test("a class start carries at most one course, and never needs one", () => {
  const base = {
    requestId: "00000000-0000-4000-8000-000000000001",
    schoolName: "Birchwood Elementary",
    className: "Grade 4 Math",
    timezone: "UTC",
    signerName: "Rosa Lindqvist",
    signerTitle: "Teacher",
    agreementVersion: "1",
    authorized: true,
  };
  assert.ok(startSchoolClassSchema.safeParse(base).success);
  assert.deepEqual(
    startSchoolClassSchema.parse({ ...base, courseBands: ["4"] }).courseBands,
    ["4"],
  );
  assert.ok(
    !startSchoolClassSchema.safeParse({ ...base, courseBands: ["4", "5"] })
      .success,
  );
});
