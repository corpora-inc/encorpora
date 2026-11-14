import test from "node:test";
import assert from "node:assert/strict";
import { strToU8, zipSync } from "fflate";
import {
  oneRosterRows,
  readOneRosterZip,
} from "../src/schools/sources/oneroster.js";
import { rosterRowSchema } from "../src/schools/sources/rows.js";
import { oneRosterFixture } from "./fixtures/oneroster.js";

test("OneRoster preserves all roles, school scopes, enrollment dates and class terms", () => {
  const result = oneRosterRows(oneRosterFixture(), { schoolSourcedId: "a" });
  assert.equal(result.rows.length, 2);
  for (const row of result.rows) rosterRowSchema.parse(row);
  const teacher = result.rows[0]!;
  assert.equal(teacher.givenName, "Tessa");
  assert.deepEqual(
    teacher.sourceEvidence!.roles.map((r) => [r.orgSourcedId, r.role]),
    [
      ["a", "teacher"],
      ["a", "staff"],
      ["b", "teacher"],
    ],
  );
  assert.deepEqual(
    teacher.sourceEvidence!.enrollments.map((e) => [
      e.classSourcedId,
      e.role,
      e.startsOn,
      e.endsOn,
    ]),
    [
      ["k1", "teacher", "2020-01-01", "2099-01-01"],
      ["k2", "aide", "2020-01-01", "2099-01-01"],
    ],
  );
  assert.deepEqual(teacher.classes[0]!.termSourcedIds, ["s1", "s2"]);
  assert.equal(teacher.classes[0]!.session!.sourcedId, "y");
  assert.deepEqual(
    new Set(teacher.classes[0]!.sessions!.map((s) => s.sourcedId)),
    new Set(["s1", "s2", "y"]),
  );
  assert.equal(
    teacher.classes[0]!.sessions!.find((s) => s.sourcedId === "s1")!
      .parentSourcedId,
    "y",
  );
  assert.ok(
    result.issues.some(
      (i) => i.code === "unsupported_role" && i.value === "staff",
    ),
  );
  const second = oneRosterRows(oneRosterFixture(), { schoolSourcedId: "b" });
  assert.equal(second.rows.length, 1);
  assert.deepEqual(
    second.rows[0]!.classes.map((c) => c.sourcedId),
    ["k3"],
  );
  const noSchool = oneRosterRows(oneRosterFixture());
  assert.equal(noSchool.rows.length, 0);
  assert.ok(noSchool.issues.every((i) => i.code === "source_conflict"));
});
test("OneRoster holds mixed identity roles and invalid/ambiguous calendars rather than picking a value", () => {
  for (const mutate of [
    (f: ReturnType<typeof oneRosterFixture>) => {
      f.roles += "mixed,t,a,student,secondary,,\n";
    },
    (f: ReturnType<typeof oneRosterFixture>) => {
      f.classes = f.classes!.replace('"s1,s2"', '"s1,missing"');
    },
    (f: ReturnType<typeof oneRosterFixture>) => {
      f.academicSessions = f.academicSessions!.replace(
        "2027-07-31,\n",
        "2027-07-31,s1\n",
      );
    },
    (f: ReturnType<typeof oneRosterFixture>) => {
      f.enrollments += "duplicate,t,k1,a,teacher,2021-01-01,2022-01-01\n";
    },
    (f: ReturnType<typeof oneRosterFixture>) => {
      f.roles = f.roles!.replace("2020-01-01", "2020-02-30");
    },
    (f: ReturnType<typeof oneRosterFixture>) => {
      f.roles = f.roles!.replace("2020-01-01", "2020-01-01garbage");
    },
    (f: ReturnType<typeof oneRosterFixture>) => {
      f.roles = f.roles!.replace("rt,t,a,teacher,primary", "rt,t,a,,primary");
    },
    (f: ReturnType<typeof oneRosterFixture>) => {
      f.roles += "rt,u,a,student,secondary,,\n";
    },
    (f: ReturnType<typeof oneRosterFixture>) => {
      f.enrollments += "et,u,k1,a,student,2999-01-01,2999-12-31\n";
    },
    (f: ReturnType<typeof oneRosterFixture>) => {
      f.academicSessions += "s1,Other fall,semester,2026-08-01,2027-01-01,y\n";
    },
    (f: ReturnType<typeof oneRosterFixture>) => {
      f.courses += "c,Other math,5,y\n";
    },
    (f: ReturnType<typeof oneRosterFixture>) => {
      f.enrollments += "missing,t,missing,a,teacher,,\n";
    },
    (f: ReturnType<typeof oneRosterFixture>) => {
      f.classes += "k1,Wrong school,c,b,s1\n";
    },
  ]) {
    const file = oneRosterFixture();
    mutate(file);
    const result = oneRosterRows(file, { schoolSourcedId: "a" });
    assert.ok(!result.rows.some((row) => row.sourcedId === "t"));
    assert.ok(
      result.issues.some(
        (issue) =>
          issue.row.sourcedId === "t" && issue.code === "source_conflict",
      ),
    );
  }
});

test("OneRoster ZIP reading rejects duplicate known files and ignores unrelated CSVs", () => {
  const users = strToU8("sourcedId,givenName\nu,Fixture\n");
  assert.throws(
    () =>
      readOneRosterZip(zipSync({ "a/users.csv": users, "b/Users.csv": users })),
    /oneroster_duplicate_file/,
  );
  assert.deepEqual(
    readOneRosterZip(
      zipSync({
        "export/users.csv": users,
        "demographics.csv": strToU8("not rostered"),
      }),
    ),
    { users: "sourcedId,givenName\nu,Fixture\n" },
  );
});
