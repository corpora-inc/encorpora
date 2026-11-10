import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canAddStudents } from "../src/web/features/school/permissions";

const org = (patch: object) => ({ can: [], teaches: [], ...patch }) as never;

test("Add student is offered only where adding a student can succeed", () => {
  // An admin, by the org's own permission.
  assert.equal(canAddStudents(org({ can: ["students.add"] }), "c1"), true);
  // A teacher, for a class they teach.
  assert.equal(canAddStudents(org({ teaches: ["c1"] }), "c1"), true);
  assert.equal(canAddStudents(org({ teaches: ["c1"] }), "c2"), false);
  assert.equal(canAddStudents(org({ teaches: ["c1"] })), true);
  // A demo never adds a real child, so it never offers to.
  assert.equal(
    canAddStudents(org({ demo: true, teaches: ["c1"] }), "c1"),
    false,
  );
  assert.equal(canAddStudents(org({ demo: true, teaches: ["c1"] })), false);
});

test("the demo migration validates the grant channel check apart, under a weaker lock", () => {
  const sql = readFileSync(
    new URL("../migrations/0102-school-demo.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /amp_grants_channel_check[\s\S]*NOT VALID/);
  assert.match(sql, /VALIDATE CONSTRAINT amp_grants_channel_check/);
});
