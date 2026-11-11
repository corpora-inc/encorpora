import { expect, test } from "vitest";
import { namedByTab } from "../shell-frame";

const klass = "/school/o1/classes/c1";

test("a title the open tab already says is named by the tab", () => {
  expect(namedByTab(`${klass}/time`, "Time")).toBe(true);
  expect(namedByTab(`${klass}/settings`, "Settings")).toBe(true);
  expect(namedByTab(`${klass}/roster`, "People")).toBe(true);
  expect(namedByTab(`${klass}/map`, "Class map")).toBe(true);
  expect(namedByTab("/family/security", "Sign-in")).toBe(true);
  expect(namedByTab("/inventory", "Inventory")).toBe(true);
  expect(namedByTab("/school/o1/activity", "Activity")).toBe(true);
});

test("a title that says more than its tab keeps showing", () => {
  expect(namedByTab(`${klass}/today`, "Grade 5 Math")).toBe(false);
  expect(namedByTab(`${klass}/gradebook`, "Semester 1 grades")).toBe(false);
  expect(namedByTab("/school/o1", "Brightwater Elementary")).toBe(false);
  expect(namedByTab("/family/privacy", "Download your records")).toBe(false);
  expect(namedByTab("/me/profiles", "Practice as someone else")).toBe(false);
});
