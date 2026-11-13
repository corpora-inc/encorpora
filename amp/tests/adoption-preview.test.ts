import test from "node:test";
import assert from "node:assert/strict";
import { schoolAdoptionCleverPreview } from "../src/schools/adoption.js";
import { adoptionCleverPreview } from "../src/schools/adoption-contracts.js";
import type { Snapshot } from "../src/schools/clever/model.js";

const id = (n: number) => n.toString(16).padStart(24, "0");
test("Clever adoption choices distinguish duplicate names using only selected-school context", () => {
  const district = id(1),
    school = id(2),
    otherSchool = id(3);
  const snapshot: Snapshot = {
    district: { id: district, name: "District" },
    schools: [
      { id: school, district, name: "School" },
      { id: otherSchool, district, name: "Other school" },
    ],
    users: [
      {
        id: id(4),
        district,
        name: { first: "Alex", last: "Lee" },
        roles: { student: { school, grade: "4" } },
      },
      {
        id: id(5),
        district,
        name: { first: "Alex", last: "Lee" },
        roles: { student: { school, grade: "5" } },
      },
      {
        id: id(6),
        district,
        name: { first: "Morgan", last: "Wong" },
        roles: { teacher: { school } },
      },
      {
        id: id(7),
        district,
        name: { first: "Hidden", last: "Student" },
        roles: { student: { school: otherSchool, grade: "6" } },
      },
    ],
    courses: [{ id: id(8), district, name: "Mathematics" }],
    terms: [],
    sections: [
      {
        id: id(9),
        district,
        school,
        name: "Morning math",
        grade: "4",
        course: id(8),
        students: [id(4)],
        teachers: [id(6)],
        teacher: id(6),
      },
      {
        id: id(10),
        district,
        school,
        name: "Afternoon math",
        grade: "5",
        students: [id(5)],
        teachers: [id(6)],
      },
      {
        id: id(11),
        district,
        school: otherSchool,
        name: "Hidden class",
        students: [id(7)],
        teachers: [id(6)],
      },
    ],
  };
  const preview = adoptionCleverPreview.parse(
    schoolAdoptionCleverPreview(snapshot, school),
  );
  assert.deepEqual(
    preview.users.find((u) => u.id === id(4)),
    {
      id: id(4),
      name: "Alex Lee",
      student: true,
      grade: "4",
      classNames: ["Morning math"],
      teacherNames: ["Morgan Wong"],
    },
  );
  assert.deepEqual(preview.users.find((u) => u.id === id(5))?.classNames, [
    "Afternoon math",
  ]);
  assert.deepEqual(preview.sections[0], {
    id: id(9),
    name: "Morning math",
    grade: "4",
    courseName: "Mathematics",
    teacherNames: ["Morgan Wong"],
  });
  assert.equal(preview.sections[1]?.courseName, null);
  assert.equal(
    preview.users.some((u) => u.id === id(7)),
    false,
  );
  assert.ok(!JSON.stringify(preview.users).includes("Hidden"));
  assert.deepEqual(schoolAdoptionCleverPreview(snapshot).users, []);
  assert.deepEqual(schoolAdoptionCleverPreview(snapshot).sections, []);
});
