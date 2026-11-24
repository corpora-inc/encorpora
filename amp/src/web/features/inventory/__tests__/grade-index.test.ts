// @vitest-environment node
// (The server's own difficulty, as the catalog carries it, needs Node.)
import { expect, test } from "vitest";
import { skills } from "../../../../curriculum/catalog";
import { areaOf } from "../../../../curriculum/areas";
import { checkedBucket } from "../../../../family/dashboard";
import { templates } from "../../../../math/engine";
import { skillDifficulty } from "../../../../server/mixed-practice";
import {
  areaSlot,
  bands,
  type Evidence,
  type Frontier,
  type MapSkill,
} from "../../pathways/model";
import {
  gradeIndex,
  inventoryMode,
  ownBand,
  shortBand,
  standingOf,
  teachingOrder,
  viewedBand,
} from "../grade-index";
import { useInventoryViewStore, showByGrade } from "../inventory-view";

// The catalog as the server sends it (server/app.ts `catalogSkills`).
const nodes = new Map(skills.map((skill) => [skill.id, skill]));
const catalog = skills.map((skill) => ({
  ...skill,
  area: areaOf(skill),
  difficulty: skillDifficulty(skill.id, templates, nodes),
})) as unknown as MapSkill[];
const skill = (
  id: string,
  strand: string,
  prerequisites: string[] = [],
  difficulty?: number,
): MapSkill => ({
  id,
  title: id,
  description: "",
  gradeBand: "4",
  strand,
  prerequisites,
  difficulty,
});
const estimate = (level: number, answered = 40) => ({
  level,
  sd: 0.4,
  answered,
  independent: answered,
  low: level - 0.5,
  high: level + 0.5,
});
const frontier = (level: number, answered = 40): Frontier => ({
  expected: 2,
  overall: estimate(level, answered),
  strands: {},
});

test("every grade lists each of its skills once, under the five areas in order", () => {
  let listed = 0;
  for (const band of bands) {
    const inGrade = catalog.filter((entry) => entry.gradeBand === band);
    const ordered = teachingOrder(inGrade, catalog);
    expect(ordered.length).toBe(inGrade.length);
    expect(new Set(ordered.map((entry) => entry.id)).size).toBe(inGrade.length);
    const slots = ordered.map(areaSlot);
    expect(slots).toEqual([...slots].sort((a, b) => a - b));
    listed += ordered.length;
  }
  expect(listed).toBe(skills.length);
});

test("in an area, a skill comes after everything it builds on in that grade", () => {
  const byId = new Map(catalog.map((entry) => [entry.id, entry]));
  const builtOn = (id: string, seen = new Set<string>()): Set<string> => {
    for (const parent of byId.get(id)?.prerequisites ?? [])
      if (!seen.has(parent)) {
        seen.add(parent);
        builtOn(parent, seen);
      }
    return seen;
  };
  for (const band of bands) {
    const ordered = teachingOrder(
      catalog.filter((entry) => entry.gradeBand === band),
      catalog,
    );
    const place = new Map(ordered.map((entry, at) => [entry.id, at]));
    for (const entry of ordered)
      for (const parent of builtOn(entry.id)) {
        const other = byId.get(parent)!;
        if (place.has(parent) && areaSlot(other) === areaSlot(entry))
          expect(
            place.get(parent)! < place.get(entry.id)!,
            `${parent} before ${entry.id}`,
          ).toBe(true);
      }
  }
});

test("free to choose, an area runs strand by strand, the easier first", () => {
  const list = [
    skill("decimals-hard", "decimals", [], 4.6),
    skill("fractions-b", "fractions", [], 4.5),
    skill("place-value", "number", [], 4.4),
    skill("stories", "modeling", [], 4.1),
    skill("fractions-a", "fractions", [], 4.2),
    skill("divide", "operations", [], 4.3),
    skill("angles", "geometry", [], 4.0),
  ].map((entry) => ({
    ...entry,
    area: entry.strand === "geometry" ? "geometry" : "number",
  })) as MapSkill[];
  expect(teachingOrder(list, list).map((entry) => entry.id)).toEqual([
    "place-value",
    "divide",
    "fractions-a",
    "fractions-b",
    "decimals-hard",
    "stories",
    "angles",
  ]);
  // What a skill builds on wins over its strand's turn.
  const built = [
    {
      ...skill("number-late", "number", ["fractions-first"], 4),
      area: "number",
    },
    { ...skill("fractions-first", "fractions", [], 4.9), area: "number" },
  ] as MapSkill[];
  expect(teachingOrder(built, built).map((entry) => entry.id)).toEqual([
    "fractions-first",
    "number-late",
  ]);
});

test("fourth grade reads as it is taught", () => {
  const titles = teachingOrder(
    catalog.filter((entry) => entry.gradeBand === "4"),
    catalog,
  ).map((entry) => entry.title);
  expect(titles[0]).toBe("Place value of large whole numbers");
  const at = (title: string) => {
    expect(titles).toContain(title);
    return titles.indexOf(title);
  };
  expect(at("Adding and subtracting whole numbers")).toBeLessThan(
    at("Dividing by a one-digit number"),
  );
  expect(at("Dividing by a one-digit number")).toBeLessThan(
    at("Generating equivalent fractions"),
  );
  expect(at("Adding and subtracting mixed numbers")).toBeLessThan(
    at("Tenths and hundredths as decimals"),
  );
  expect(at("Money with decimals")).toBeLessThan(at("Measuring angles"));
});

test("standing is the dashboard's own rule, word for word", () => {
  const cases: (Evidence | undefined)[] = [
    undefined,
    ...(["new", "practicing", "review-ready"] as const).flatMap((status) =>
      [0, 1, 6].flatMap((attempts) =>
        [0, 1, 5].map((independentCorrect) => ({
          skillId: "s",
          attempts,
          independentCorrect,
          independentOccasions: independentCorrect,
          status,
          reviewDueAt: null,
        })),
      ),
    ),
  ];
  for (const evidence of cases)
    expect(standingOf(evidence), JSON.stringify(evidence)).toBe(
      checkedBucket(evidence),
    );
  expect(standingOf(undefined)).toBe("notAsked");
});

test("a learner's own grade is their level's best guess, inside the curriculum", () => {
  expect(ownBand(frontier(4.2))).toBe("4");
  expect(ownBand(frontier(0.1))).toBe("K");
  expect(ownBand(frontier(9.3))).toBe("algebra-1");
  expect(ownBand(frontier(14))).toBe("precalculus");
  expect(ownBand(frontier(-2))).toBe("K");
  // Before any answer: where practice starts (the birth year's grade).
  expect(ownBand(frontier(5, 0))).toBe("2");
  expect(ownBand(undefined)).toBe("K");
});

test("a view by grade shows the grade chosen, else the learner's own", () => {
  expect(viewedBand("", frontier(4.2))).toBe("4");
  expect(viewedBand(undefined, frontier(4.2))).toBe("4");
  expect(viewedBand("geometry", frontier(4))).toBe("geometry");
  expect(viewedBand("grade-99", frontier(4.2))).toBe("4");
  expect(bands.map(shortBand)).toEqual([
    "K",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "Alg 1",
    "Geom",
    "Alg 2",
    "Precalc",
  ]);
});

test("a grown-up reading a child's opens by grade; a learner's own, by area", () => {
  expect(inventoryMode("", true)).toBe("grade");
  expect(inventoryMode(undefined, true)).toBe("grade");
  expect(inventoryMode("", false)).toBe("area");
  expect(inventoryMode(undefined, false)).toBe("area");
  // The choice, once made, is kept either way.
  expect(inventoryMode("area", true)).toBe("area");
  expect(inventoryMode("grade", false)).toBe("grade");
  expect(inventoryMode("sideways", true)).toBe("grade");
});

test("a grade's index: area, then skill, then its problem types", () => {
  const types = templates.map(({ id, skillId, title }) => ({
    id,
    skillId,
    title,
  }));
  for (const band of bands) {
    const sections = gradeIndex({ skills: catalog, templates: types }, band);
    const inGrade = catalog.filter((entry) => entry.gradeBand === band);
    // Every skill of the grade once, in teaching order.
    expect(
      sections.flatMap((section) => section.skills.map((row) => row.skill.id)),
    ).toEqual(teachingOrder(inGrade, catalog).map((entry) => entry.id));
    for (const section of sections) {
      expect(section.skills.length).toBeGreaterThan(0);
      for (const row of section.skills) {
        expect(areaOf(row.skill)).toBe(section.area);
        // Every problem type of the skill, in the catalog's order.
        expect(row.types.map((type) => type.id)).toEqual(
          types
            .filter((type) => type.skillId === row.skill.id)
            .map((type) => type.id),
        );
        expect(row.types.length).toBeGreaterThan(0);
      }
    }
  }
  const fourth = gradeIndex({ skills: catalog, templates: types }, "4");
  expect(fourth.map((section) => section.title)).toEqual([
    "Number & operations",
    "Algebra",
    "Geometry",
    "Measurement",
    "Data & probability",
  ]);
  // One area of it; and only what a search found.
  expect(
    gradeIndex({ skills: catalog, templates: types }, "4", "geometry").map(
      (section) => section.area,
    ),
  ).toEqual(["geometry"]);
  const found = gradeIndex(
    { skills: catalog, templates: types },
    "4",
    null,
    new Set(["angle-measure", "whole-division", "count-to-20"]),
  );
  expect(
    found.flatMap((section) => section.skills.map((row) => row.skill.id)),
  ).toEqual(["whole-division", "angle-measure"]);
  expect(
    gradeIndex({ skills: catalog, templates: types }, "4", null, new Set()),
  ).toEqual([]);
});

test("a link to a child's grade sets the view it lands on, and keeps the rest", () => {
  const path =
    "/family/11111111-1111-4111-8111-111111111111/kids/kid/inventory";
  const store = useInventoryViewStore.getState();
  store.set(path, { topic: "angles", collection: "strong", view: "area" });
  showByGrade(path, "5");
  expect(useInventoryViewStore.getState().views[path]).toEqual({
    topic: "angles",
    collection: "strong",
    area: "",
    view: "grade",
    grade: "5",
  });
  // Without a grade: the child's own.
  showByGrade(path);
  expect(useInventoryViewStore.getState().views[path]?.grade).toBe("");
  // Nothing chosen any more: the view is forgotten.
  useInventoryViewStore
    .getState()
    .set(path, { topic: "", collection: "", view: "" });
  expect(useInventoryViewStore.getState().views[path]).toBeUndefined();
});
