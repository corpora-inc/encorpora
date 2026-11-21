import assert from "node:assert/strict";
import test from "node:test";
import { strandAreas } from "../src/curriculum/areas";
import {
  areaLevels,
  CHECKED_GRADES,
  checkedBelow,
  checkedBucket,
  FOCUS_WINDOW,
  focusKey,
  focusMix,
  NEAREST_NOT_ASKED,
  practiceCatalog,
  type DashboardSkill,
  type FocusAnswer,
} from "../src/family/dashboard";
import {
  familyDashboardSchema,
  focusKeys,
} from "../src/family/projection-contracts";
import { templates } from "../src/math/engine";

const answer = (
  reason: string | null,
  skillId: string | null = "s",
  extra: Partial<FocusAnswer> = {},
): FocusAnswer => ({
  skillId,
  reason,
  purpose: null,
  focusSkillId: null,
  ...extra,
});

test("focusKey maps every stored reason to a stable key", () => {
  assert.equal(focusKey(answer("prerequisite")), "catching-up");
  assert.equal(focusKey(answer("revisit")), "catching-up");
  assert.equal(focusKey(answer("review")), "reviewing");
  assert.equal(focusKey(answer("frontier")), "new-ground");
  assert.equal(focusKey(answer("explore")), "new-ground");
  assert.equal(
    focusKey(answer("frontier", "s", { purpose: "foundation" })),
    "checking-earlier",
  );
  assert.equal(
    focusKey(answer("explore", "s", { purpose: "foundation" })),
    "checking-earlier",
  );
  assert.equal(
    focusKey(answer("frontier", "s", { purpose: "probe" })),
    "new-ground",
  );
  // Repair and a due review say more than the plan's purpose.
  assert.equal(
    focusKey(answer("prerequisite", "s", { purpose: "foundation" })),
    "catching-up",
  );
  assert.equal(
    focusKey(answer("review", "s", { purpose: "foundation" })),
    "reviewing",
  );
  // A chosen skill wins over everything.
  assert.equal(focusKey(answer("focus")), "chosen");
  assert.equal(
    focusKey(answer("revisit", "s", { focusSkillId: "s" })),
    "chosen",
  );
  // Paper marks and unknown reasons have no key.
  assert.equal(focusKey(answer(null)), null);
  assert.equal(focusKey(answer("resume")), null);
});

test("focusMix counts the last answers, in key order, with the skills behind each", () => {
  const title = (id: string) => ({ id, title: id.toUpperCase() });
  const answers: FocusAnswer[] = [
    answer("review", "b"),
    answer("prerequisite", "a"),
    answer("frontier", "c"),
    answer("revisit", "d"),
    answer("prerequisite", "a"),
    answer(null, "paper"),
    answer("explore", "e", { purpose: "foundation" }),
    answer("frontier", "f"),
    answer("frontier", "c"),
  ];
  const mix = focusMix(answers, title);
  assert.equal(mix.answered, 9);
  assert.deepEqual(mix.mix, [
    {
      key: "catching-up",
      count: 3,
      // `a` twice; then `d`.
      skills: [title("a"), title("d")],
    },
    { key: "reviewing", count: 1, skills: [title("b")] },
    { key: "checking-earlier", count: 1, skills: [title("e")] },
    // `c` twice beats `f`.
    { key: "new-ground", count: 3, skills: [title("c"), title("f")] },
  ]);
  // Ties keep the most recent first.
  assert.deepEqual(
    focusMix([answer("review", "x"), answer("review", "y")], title).mix[0]!
      .skills,
    [title("x"), title("y")],
  );
  // Only the newest FOCUS_WINDOW answers count.
  const many = [
    ...Array.from({ length: FOCUS_WINDOW }, () => answer("frontier")),
    answer("review"),
  ];
  assert.deepEqual(
    focusMix(many, title).mix.map((entry) => [entry.key, entry.count]),
    [["new-ground", FOCUS_WINDOW]],
  );
  assert.deepEqual(focusMix([], title), { answered: 0, mix: [] });
  // Keys come only from the contract.
  for (const entry of focusMix(answers, title).mix)
    assert.ok(focusKeys.includes(entry.key));
});

test("areaLevels folds strands into the five areas by answers", () => {
  const rows = areaLevels(
    {
      number: {
        level: 4,
        sd: 0.5,
        answered: 30,
        independent: 20,
        low: 3,
        high: 5,
      },
      fractions: {
        level: 6,
        sd: 0.5,
        answered: 10,
        independent: 5,
        low: 5,
        high: 7,
      },
      algebra: { level: 7, sd: 1, answered: 0, independent: 0 },
      geometry: { level: 5, sd: 0.5, answered: 8, independent: 4 },
      modeling: { level: 9, sd: 0.5, answered: 50, independent: 40 },
    },
    (strand) => strandAreas[strand],
  );
  assert.deepEqual(Object.keys(rows), [
    "number",
    "algebra",
    "geometry",
    "measurement",
    "data",
  ]);
  assert.deepEqual(rows.number, {
    level: 4.5,
    low: 3.5,
    high: 5.5,
    answered: 40,
  });
  // A strand with no answers is not a level.
  assert.equal(rows.algebra, null);
  assert.equal(rows.measurement, null);
  // No stored range: level ± z·sd.
  assert.equal(rows.geometry!.answered, 8);
  assert.ok(Math.abs(rows.geometry!.low - (5 - 1.28 * 0.5)) < 1e-9);
  assert.ok(Math.abs(rows.geometry!.high - (5 + 1.28 * 0.5)) < 1e-9);
});

test("checkedBelow buckets the grades just below the level", () => {
  const skill = (
    id: string,
    grade: number,
    area = "number",
  ): DashboardSkill => ({
    id,
    title: `Title ${id}`,
    area: area as DashboardSkill["area"],
    grade,
  });
  const catalog = [
    skill("k1", 0),
    skill("g2a", 2),
    skill("g3a", 3),
    skill("g3b", 3),
    skill("g4a", 4),
    skill("g4b", 4),
    skill("g4c", 4),
    skill("g4d", 4),
    skill("g5a", 5),
    skill("geo3", 3, "geometry"),
  ];
  const evidence = new Map([
    ["g4a", { attempts: 6, independentCorrect: 5, status: "review-ready" }],
    ["g4b", { attempts: 2, independentCorrect: 1, status: "practicing" }],
    ["g3a", { attempts: 3, independentCorrect: 0, status: "practicing" }],
    ["g5a", { attempts: 6, independentCorrect: 6, status: "review-ready" }],
  ]);
  // 4.6 rounds to 5: grades 3 and 4 are checked.
  const checked = checkedBelow("number", 4.6, evidence, catalog)!;
  assert.equal(CHECKED_GRADES, 2);
  assert.deepEqual(checked, {
    from: 3,
    to: 4,
    skills: 6,
    strong: 1,
    earned: 1,
    tried: 1,
    notAsked: 3,
    // Nearest the level first: grade 4, then grade 3, catalog order within.
    nearestNotAsked: [
      { id: "g4c", title: "Title g4c" },
      { id: "g4d", title: "Title g4d" },
      { id: "g3b", title: "Title g3b" },
    ],
  });
  // 4.4 rounds to 4: grades 2 and 3.
  assert.deepEqual(
    [
      checkedBelow("number", 4.4, evidence, catalog)!.from,
      checkedBelow("number", 4.4, evidence, catalog)!.to,
    ],
    [2, 3],
  );
  // Kindergarten has nothing below it; no level, no check.
  assert.equal(checkedBelow("number", 0.4, evidence, catalog), null);
  assert.equal(checkedBelow("number", null, evidence, catalog), null);
  // One grade below first grade: from 0.
  assert.deepEqual(
    checkedBelow("number", 1.2, evidence, catalog)!.nearestNotAsked,
    [{ id: "k1", title: "Title k1" }],
  );
  // Another area's skills never count.
  assert.equal(checkedBelow("geometry", 4.6, evidence, catalog)!.skills, 1);
});

test("checkedBucket: strong, earned, tried, not asked", () => {
  assert.equal(checkedBucket(undefined), "notAsked");
  assert.equal(
    checkedBucket({ attempts: 0, independentCorrect: 0, status: null }),
    "notAsked",
  );
  assert.equal(
    checkedBucket({
      attempts: 5,
      independentCorrect: 5,
      status: "review-ready",
    }),
    "strong",
  );
  assert.equal(
    checkedBucket({ attempts: 9, independentCorrect: 1, status: "practicing" }),
    "earned",
  );
  assert.equal(
    checkedBucket({ attempts: 9, independentCorrect: 0, status: "practicing" }),
    "tried",
  );
});

test("the real catalog: only skills with problems, each in an area and a grade", () => {
  const asked = new Set(templates.map((template) => template.skillId));
  assert.ok(practiceCatalog.length > 100);
  for (const skill of practiceCatalog) {
    assert.ok(asked.has(skill.id), skill.id);
    assert.ok(skill.grade >= 0 && skill.grade <= 12, skill.id);
    assert.ok(skill.title && skill.title !== skill.id, skill.id);
  }
  const checked = checkedBelow("number", 5, new Map())!;
  assert.equal(checked.notAsked, checked.skills);
  assert.ok(checked.nearestNotAsked.length <= NEAREST_NOT_ASKED);
});

test("familyDashboardSchema accepts a dashboard and refuses unknown keys' values", () => {
  const level = { level: 4.2, low: 3.6, high: 4.9, answered: 40 };
  const valid = {
    familyId: "00000000-0000-4000-8000-000000000001",
    today: "2026-11-20",
    week: { from: "2026-11-16", to: "2026-11-20" },
    join: { code: "ABC-234", path: "/join/ABC-234" },
    children: [
      {
        id: "learner-1",
        name: "Child",
        gradeLevelShown: false,
        week: {
          days: 3,
          minutes: 42.5,
          problems: 61,
          correct: 54,
          independent: 50,
          lastPracticed: "2026-11-19",
        },
        daily: [{ day: "2026-11-16", minutes: 0, problems: 0 }],
        level,
        areas: [
          {
            area: "number",
            title: "Number & operations",
            level,
            checked: {
              from: 2,
              to: 3,
              skills: 20,
              strong: 5,
              earned: 4,
              tried: 2,
              notAsked: 9,
              nearestNotAsked: [{ id: "s", title: "S" }],
            },
          },
        ],
        focus: {
          answered: 20,
          mix: [
            { key: "catching-up", count: 4, skills: [{ id: "s", title: "S" }] },
          ],
        },
      },
    ],
  };
  assert.deepEqual(familyDashboardSchema.parse(valid), valid);
  const wrongKey = structuredClone(valid);
  (wrongKey.children[0]!.focus.mix[0] as { key: string }).key = "Catching up";
  assert.throws(() => familyDashboardSchema.parse(wrongKey));
  const wrongArea = structuredClone(valid);
  (wrongArea.children[0]!.areas[0] as { area: string }).area = "fractions";
  assert.throws(() => familyDashboardSchema.parse(wrongArea));
  assert.deepEqual(
    familyDashboardSchema.parse({ ...valid, join: null, children: [] }).join,
    null,
  );
});
