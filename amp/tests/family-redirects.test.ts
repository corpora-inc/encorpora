import assert from "node:assert/strict";
import test from "node:test";
import type { SignedInMe } from "../src/account/contracts.js";
import {
  familyClassTarget,
  familyOrgTarget,
  parentFamilyAt,
  peopleOf,
} from "../src/web/features/family/redirects.js";

/*
 * Every family row of the continuation table (docs/architecture/spaces.md,
 * "Family-org legacy addresses"): each old `/school/<family>/classes/<class>`
 * leaf opens its `/family/<family>/…` screen with the query, the hash and the
 * layers carried, a child named by their roster person opened as their page,
 * and another family's child left to the tutoring group.
 */

const F = "00000000-0000-4000-8000-000000000001";
const C = "00000000-0000-4000-8000-000000000002";
const P_PIP = "00000000-0000-4000-8000-0000000000a1";
const P_WREN = "00000000-0000-4000-8000-0000000000a2";
const P_ZED = "00000000-0000-4000-8000-0000000000a3";
const people = peopleOf(
  [
    { id: "pip", classes: [{ id: C, personId: P_PIP }] },
    { id: "wren", classes: [{ id: C, personId: P_WREN }, { id: "other", personId: "x" }] },
  ],
  C,
);
const go = (parts: string[], search: Record<string, unknown> = {}, hash?: string) =>
  familyClassTarget({ family: F, parts, search, hash, people });

test("the person→learner map holds only the family's own children in its class", () => {
  assert.deepEqual([...people.entries()], [
    [P_PIP, "pip"],
    [P_WREN, "wren"],
  ]);
});

test("Today: the class root and /today, carrying the devices sheet", () => {
  assert.deepEqual(go([]), { to: `/family/${F}`, search: {} });
  assert.deepEqual(go(["today"], { devices: 1, junk: 2 }), {
    to: `/family/${F}`,
    search: { devices: 1 },
  });
});

test("Map, with its lens and skill; a child's layer becomes their page", () => {
  assert.deepEqual(go(["map"], { lens: "fractions", skill: "add", sort: "student:ascending" }), {
    to: `/family/${F}/map`,
    search: { lens: "fractions", skill: "add", sort: "student:ascending" },
  });
  assert.deepEqual(go(["map"], { open: `student:${P_WREN}` }), {
    to: `/family/${F}/kids/wren`,
    search: {},
  });
  // Their answer stays a layer over their page, with its skill.
  assert.deepEqual(
    go(["map"], { open: `student:${P_WREN},work:${P_WREN}.abcdef12`, skill: "add" }),
    {
      to: `/family/${F}/kids/wren`,
      search: { skill: "add", open: `work:${P_WREN}.abcdef12` },
    },
  );
  // A skill layer on Today stays a layer on Today.
  assert.deepEqual(go(["today"], { open: "skill:add-fractions" }), {
    to: `/family/${F}`,
    search: { open: "skill:add-fractions" },
  });
});

test("the map's older child addresses: map/<person> and map/<person>/work/<attempt>", () => {
  assert.deepEqual(go(["map", P_PIP]), { to: `/family/${F}/kids/pip`, search: {} });
  assert.deepEqual(go(["map", P_PIP, "work", "abcdef12"]), {
    to: `/family/${F}/kids/pip`,
    search: { open: `work:${P_PIP}.abcdef12` },
  });
});

test("another family's child is never opened as this family's: the tutoring group", () => {
  assert.deepEqual(go(["map"], { open: `student:${P_ZED}` }), {
    to: `/family/${F}/group`,
    search: { open: `student:${P_ZED}` },
  });
  assert.deepEqual(go(["map", P_ZED]), {
    to: `/family/${F}/group`,
    search: { open: `student:${P_ZED}` },
  });
});

test("Grades and report cards are the family's records, with their term and year", () => {
  assert.deepEqual(go(["gradebook"], { term: "t1", year: "y", student: P_PIP, x: 1 }), {
    to: `/family/${F}/reports/grades`,
    search: { term: "t1", year: "y", student: P_PIP },
  });
  assert.deepEqual(go(["report-cards"], { term: "t1", year: "y" }), {
    to: `/family/${F}/reports`,
    search: { term: "t1", year: "y" },
  });
});

test("Time, with its week and range", () => {
  assert.deepEqual(go(["time"], { week: "2026-11-09", from: "a", to: "b", student: P_PIP }), {
    to: `/family/${F}/time`,
    search: { week: "2026-11-09", from: "a", to: "b", student: P_PIP },
  });
});

test("Workbooks and a day's marking, with everything their screens read", () => {
  assert.deepEqual(go(["workbooks"], { students: `${P_PIP},${P_WREN}`, skill: "add" }), {
    to: `/family/${F}/workbooks`,
    search: { students: `${P_PIP},${P_WREN}`, skill: "add" },
  });
  assert.deepEqual(go(["workbooks", "2026-11-12"], { student: P_PIP }), {
    to: `/family/${F}/workbooks/2026-11-12`,
    search: { student: P_PIP },
  });
});

test("People, cards and the sign-in board are People and their own devices", () => {
  assert.deepEqual(go(["roster"]), { to: `/family/${F}/people`, search: {} });
  assert.deepEqual(go(["cards"], { student: P_PIP }), {
    to: `/family/${F}/people`,
    search: { devices: 1 },
  });
  assert.deepEqual(go(["start"]), { to: `/family/${F}`, search: { devices: 1 } });
});

test("Settings and what children see are Settings, the hash carried", () => {
  assert.deepEqual(go(["settings"], {}, "school-year"), {
    to: `/family/${F}/settings`,
    search: {},
    hash: "school-year",
  });
  assert.deepEqual(go(["experience"]), { to: `/family/${F}/settings`, search: {} });
});

test("import and unknown leaves land on the family's own not-found page", () => {
  assert.deepEqual(go(["import"]), { to: `/family/${F}/import`, search: {} });
  assert.deepEqual(go(["nope"]), { to: `/family/${F}/nope`, search: {} });
});

test("a malformed or oversized layer stack is dropped, never forwarded", () => {
  assert.deepEqual(go(["map"], { open: "student:not-a-uuid" }), {
    to: `/family/${F}/map`,
    search: {},
  });
  assert.deepEqual(go(["map"], { open: "x".repeat(2000) }), {
    to: `/family/${F}/map`,
    search: {},
  });
});

test("school-level pages of a family org: the family's equivalent, all search and hash", () => {
  assert.deepEqual(
    familyOrgTarget({ family: F, page: "roster", search: { a: 1, open: "skill:add" }, hash: "h" }),
    { to: `/family/${F}/people`, search: { a: 1, open: "skill:add" }, hash: "h" },
  );
  assert.deepEqual(familyOrgTarget({ family: F, page: "map", search: {} }), {
    to: `/family/${F}/map`,
    search: {},
  });
  assert.deepEqual(familyOrgTarget({ family: F, page: "settings", search: {} }).to, `/family/${F}/settings`);
  assert.deepEqual(familyOrgTarget({ family: F, page: "today", search: {} }).to, `/family/${F}`);
});

test("only a parent of that family is redirected; a co-teacher keeps the class", () => {
  const holder = { familyClass: { orgId: F, classId: C, className: "x", notice: false } } as SignedInMe;
  const second = { secondParentOf: [{ orgId: F, classId: C, className: "x", learners: [] }] } as unknown as SignedInMe;
  const teacher = { staffOf: [{ orgId: F, orgName: "x", role: "teacher" }] } as unknown as SignedInMe;
  assert.deepEqual(parentFamilyAt(holder, F), { family: F, classId: C });
  assert.deepEqual(parentFamilyAt(second, F), { family: F, classId: C });
  assert.equal(parentFamilyAt(teacher, F), null);
  assert.equal(parentFamilyAt(null, F), null);
});
