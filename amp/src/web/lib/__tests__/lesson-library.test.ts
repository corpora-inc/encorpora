import { describe, expect, it } from "vitest";
import {
  attachTerms,
  buildLibrary,
  matchingTerms,
  normalize,
  visibleIds,
} from "../lesson-library";
import type { GlossaryEntry } from "../../../glossary/types";

const skills = [
  {
    id: "pyth",
    gradeBand: "8",
    strand: "geometry",
    title: "Pythagorean theorem",
  },
  { id: "add", gradeBand: "1", strand: "operations", title: "Add within 20" },
];
const templates = [
  { id: "pyth-missing", title: "Find a missing side", skillId: "pyth" },
  { id: "add-facts", title: "Addition facts", skillId: "add" },
];
const lessons = [
  {
    id: "lesson.pyth",
    title: "Right triangles",
    summary: "The two short sides and the longest side are related.",
    templateIds: ["pyth-missing"],
    sections: [
      {
        title: "Squares on sides",
        paragraphs: ["The hypotenuses face the right angle."],
      },
    ],
  },
  {
    id: "lesson.add",
    title: "Adding by counting on",
    summary: "Start at the larger number and count on.",
    templateIds: ["add-facts"],
  },
];
const glossary: GlossaryEntry[] = [
  {
    id: "hypotenuse",
    term: "hypotenuse",
    forms: ["hypotenuse", "hypotenuses"],
    plain:
      "The longest side of a right triangle, across from the square corner.",
    uses: [],
    band: "8",
  },
];
const order = ["K", "1", "8"];

describe("lesson library index", () => {
  const items = buildLibrary(lessons, templates, skills, order);

  it("places lessons and problem types in their band and area", () => {
    expect(items.find((i) => i.id === "lesson.pyth")).toMatchObject({
      kind: "lesson",
      band: "8",
      strand: "geometry",
    });
    expect(items.find((i) => i.id === "add-facts")).toMatchObject({
      kind: "type",
      band: "1",
      strand: "operations",
    });
  });

  it("matches every query word at the start of a word, ignoring case and accents", () => {
    expect(normalize("Counting-On, Ádding!")).toBe("counting on adding");
    expect(visibleIds(items, "count", "")).toEqual(
      new Set(["lesson:lesson.add"]),
    );
    expect(visibleIds(items, "RIGHT tri", "")).toEqual(
      new Set(["lesson:lesson.pyth"]),
    );
    expect(visibleIds(items, "ount", "").size).toBe(0);
  });

  it("filters by math area, and an empty query shows the whole area", () => {
    expect(visibleIds(items, "", "geometry")).toEqual(
      new Set(["lesson:lesson.pyth", "type:pyth-missing"]),
    );
    expect(visibleIds(items, "", "").size).toBe(4);
  });

  it("finds lessons by the glossary terms they use, plural forms included", () => {
    const withTerms = attachTerms(items, glossary);
    expect(withTerms.find((i) => i.id === "lesson.pyth")!.terms).toEqual([
      "hypotenuse",
    ]);
    expect(visibleIds(withTerms, "hypotenuse", "")).toEqual(
      new Set(["lesson:lesson.pyth"]),
    );
  });

  it("names the glossary entry a query asks about", () => {
    expect(matchingTerms(glossary, "hypot").map((e) => e.id)).toEqual([
      "hypotenuse",
    ]);
    expect(matchingTerms(glossary, "hy")).toEqual([]);
  });
});
