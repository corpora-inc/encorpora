import assert from "node:assert/strict";
import test from "node:test";
import { adoptionLabels } from "../src/web/features/school/adoption-labels.js";

test("duplicate people and classes use recognizable roster context", () => {
  const people = adoptionLabels([
    {
      id: "private-one",
      name: "Alex Lee",
      grade: "3",
      classNames: ["Oak"],
      teacherNames: ["Pat Rivera"],
      student: true,
    },
    {
      id: "private-two",
      name: "alex  lee",
      grade: "4",
      classNames: ["Elm"],
      teacherNames: ["Jo Kim"],
      student: true,
    },
    { id: "private-three", name: "Noor Ali", grade: "3", student: true },
  ]);
  assert.match(people[0]!.label, /Grade 3 · Oak · Pat Rivera/);
  assert.match(people[1]!.label, /Grade 4 · Elm · Jo Kim/);
  assert.equal(people[2]!.label, "Noor Ali");
  // The kind is said only where it tells two apart.
  assert.ok(people.every((p) => !p.label.endsWith("· Student")));
  const mixed = adoptionLabels([
    { id: "a", name: "Sam Ortiz", grade: "5", student: true },
    { id: "b", name: "Sam Ortiz", grade: "5", student: false },
  ]);
  assert.ok(mixed.every((m) => !m.ambiguous));
  assert.match(mixed[0]!.label, /· Student$/);
  assert.ok(people.every((p) => !p.ambiguous && !p.label.includes("private-")));
  const classes = adoptionLabels([
    { id: "one", name: "Math", grade: "3", teacherNames: ["Pat Rivera"] },
    { id: "two", name: "Math", grade: "3", teacherNames: ["Jo Kim"] },
  ]);
  assert.ok(classes.every((c) => !c.ambiguous));
  assert.match(classes[0]!.label, /Pat Rivera/);
});

test("indistinguishable records cannot be matched by an opaque ID", () => {
  const records = adoptionLabels([
    { id: "one", name: "Alex Lee", grade: "3" },
    { id: "two", name: "Alex Lee", grade: "3" },
  ]);
  assert.ok(records.every((r) => r.ambiguous));
  assert.equal(records[0]!.label, records[1]!.label);
});

test("ordering the same roster context differently never disambiguates a person", () => {
  const records = adoptionLabels([
    {
      id: "one",
      name: "Alex Lee",
      classNames: ["Oak", "Elm"],
      teacherNames: ["Pat", "Jo"],
    },
    {
      id: "two",
      name: "Alex Lee",
      classNames: ["Elm", "Oak"],
      teacherNames: ["Jo", "Pat"],
    },
  ]);
  assert.ok(records.every((r) => r.ambiguous));
});

test("school-assigned identifiers distinguish legitimate classmates with the same name", () => {
  const records = adoptionLabels([
    {
      id: "opaque-one",
      name: "Alex Lee",
      student: true,
      grade: "3",
      classNames: ["Math"],
      identifier: "S1001",
    },
    {
      id: "opaque-two",
      name: "Alex Lee",
      student: true,
      grade: "3",
      classNames: ["Math"],
      identifier: "S1002",
    },
  ]);
  assert.ok(records.every((r) => !r.ambiguous && !r.label.includes("opaque")));
  assert.match(records[0]!.label, /Student ID S1001/);
  const sections = adoptionLabels([
    { id: "one", name: "Math", period: "1", sectionNumber: "M101" },
    { id: "two", name: "Math", period: "2", sectionNumber: "M102" },
  ]);
  assert.ok(sections.every((r) => !r.ambiguous));
  assert.match(sections[0]!.label, /Period 1 · Section M101/);
});
