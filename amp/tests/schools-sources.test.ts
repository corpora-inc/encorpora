import test from "node:test";
import assert from "node:assert/strict";
import { strToU8, zipSync } from "fflate";
import {
  csvRows,
  guessMapping,
  mappingHasName,
  parseDelimited,
  readTable,
} from "../src/schools/sources/csv.js";
import {
  isOneRoster,
  oneRosterRows,
  oneRosterSchools,
  readOneRosterZip,
} from "../src/schools/sources/oneroster.js";
import {
  courseBandsFor,
  parseGrade,
  rosterRowSchema,
  splitName,
} from "../src/schools/sources/rows.js";

const fromCsv = (text: string, fallbackClass?: string) => {
  const table = readTable(text);
  const mapping = guessMapping(table);
  return { table, mapping, ...csvRows(table, mapping, { fallbackClass }) };
};
const named = (rows: { givenName: string; familyName?: string }[]) =>
  rows.map((row) => [row.givenName, row.familyName].filter(Boolean).join(" "));

test("reads a messy spreadsheet export", () => {
  const text =
    '﻿Grade,"Last, First",Student ID,Teacher,Teacher Email,Period\r\n' +
    '5,"Ruiz, Ana Maria",1001,Ms. Okafor,okafor@alder.example,"Period 1, Math"\r\n' +
    '05,Noor Haddad,1002,Ms. Okafor,okafor@alder.example,"Period 1, Math"\r\n' +
    "\r\n" +
    ",,,,,\r\n" +
    'Kindergarten,Cher,1003,Mr. Hale,,"Room 2"\r\n' +
    '6th,"van der Berg, Lena",1004,Ms. Okafor,okafor@alder.example,"Line one\nline two"\r\n';
  const { rows, issues, mapping, table } = fromCsv(text);
  assert.equal(table.headed, true);
  assert.equal(mappingHasName(mapping), true);
  assert.deepEqual(issues, []);
  const students = rows.filter((row) => row.role === "student");
  assert.deepEqual(named(students), [
    "Ana Maria Ruiz",
    "Noor Haddad",
    "Cher",
    "Lena van der Berg",
  ]);
  assert.equal(students[0]!.gradeLevel, 5);
  assert.equal(students[1]!.gradeLevel, 5);
  assert.equal(students[2]!.gradeLevel, 0);
  assert.equal(students[2]!.familyName, undefined, "one name stays one name");
  assert.equal(students[3]!.gradeLevel, 6);
  assert.equal(students[0]!.identifier, "1001");
  assert.equal(students[0]!.classes[0]!.name, "Period 1, Math");
  assert.equal(students[3]!.classes[0]!.name, "Line one line two");
  const teachers = rows.filter((row) => row.role === "teacher");
  assert.deepEqual(teachers.map((row) => row.givenName).sort(), [
    "Mr. Hale",
    "Ms. Okafor",
  ]);
  assert.equal(
    teachers.find((row) => row.email)!.classes.length,
    2,
    "a teacher is one person across every class they appear beside",
  );
  for (const row of rows) rosterRowSchema.parse(row);
  assert.equal(
    new Set(rows.map((row) => row.line)).size,
    rows.length,
    "a dry run's answer finds each row by its line",
  );
});

test("column order and delimiters don't matter", () => {
  const a = fromCsv("First Name,Last Name,Grade\nAna,Ruiz,5\n");
  const b = fromCsv("grade;LAST_NAME;first_name\n5;Ruiz;Ana\n");
  const c = fromCsv("Surname\tGiven\tGr\nRuiz\tAna\t5\n");
  for (const { rows } of [a, b, c]) {
    assert.deepEqual(named(rows), ["Ana Ruiz"]);
    assert.equal(rows[0]!.gradeLevel, 5);
  }
  assert.equal(a.rows[0]!.sourcedId, b.rows[0]!.sourcedId);
});

test("a paste with no header row is still read", () => {
  const { rows, table } = fromCsv("Ana Ruiz\t5\nNoor Haddad\t5\nCher\t4\n");
  assert.equal(table.headed, false);
  assert.deepEqual(named(rows), ["Ana Ruiz", "Noor Haddad", "Cher"]);
  assert.equal(rows[2]!.gradeLevel, 4);
});

test("identical names require IDs, while siblings can share an address", () => {
  const text =
    "Name,Grade,Email,Class\n" +
    "Ava Chen,3,chen.family@example.com,Room 2\n" +
    "Mia Chen,3,chen.family@example.com,Room 2\n" +
    "Sam Lee,3,,Room 2\n" +
    "Sam Lee,3,,Room 2\n";
  const { rows, issues } = fromCsv(text);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.email, rows[1]!.email);
  assert.deepEqual(
    issues.map(({ line, code }) => [line, code]),
    [
      [4, "ambiguous_identity"],
      [5, "ambiguous_identity"],
    ],
  );
  assert.deepEqual(rows, fromCsv(text).rows);
  const resolved = fromCsv(
    "ID,Name,Class\n1,Sam Lee,Room 2\n2,Sam Lee,Room 2\n",
  );
  assert.equal(resolved.rows.length, 2);
  assert.equal(resolved.issues.length, 0);
});

test("only a supplied ID joins student rows across classes", () => {
  const noId = fromCsv(
    "Name,Grade,Class\nAna Ruiz,5,Math\nAna Ruiz,5,Intervention\n",
  );
  assert.equal(noId.rows.length, 0);
  assert.deepEqual(
    noId.issues.map(({ code }) => code),
    ["ambiguous_identity", "ambiguous_identity"],
  );
  const withId = fromCsv(
    "ID,Name,Class\n7,Ana Ruiz,Math\n7,Ana Ruiz,Support\n",
  );
  assert.equal(withId.rows.length, 1);
  assert.equal(withId.rows[0]!.classes.length, 2);
  assert.equal(withId.issues.length, 0);
});

test("name-only identity survives grade changes and row order, but never spans classes", () => {
  const before = fromCsv(
    "Name,Grade,Class\nAna Ruiz,5,Math\nNoor Haddad,5,Math\n",
  );
  const after = fromCsv(
    "Name,Grade,Class\nNoor Haddad,6,Math\nAna Ruiz,6,Math\n",
  );
  assert.equal(before.rows[0]!.sourcedId, after.rows[1]!.sourcedId);
  assert.equal(before.rows[1]!.sourcedId, after.rows[0]!.sourcedId);
  const other = fromCsv("Name,Class\nAna Ruiz,Support\n");
  assert.notEqual(before.rows[0]!.sourcedId, other.rows[0]!.sourcedId);
});

test("conflicting supplied IDs and incomplete same-name IDs are exceptions", () => {
  const conflict = fromCsv(
    "ID,Name,Class\n7,Ana Ruiz,Math\n7,Noor Haddad,Support\n7,Ana Ruiz,Support\n",
  );
  assert.equal(conflict.rows.length, 0);
  assert.deepEqual(
    conflict.issues.map(({ code }) => code),
    ["conflicting_identity", "conflicting_identity"],
  );
  const partial = fromCsv(
    "ID,Name,Class\n7,Ana Ruiz,Math\n,Ana Ruiz,Support\n",
  );
  assert.equal(partial.rows.length, 1);
  assert.equal(partial.issues[0]!.code, "ambiguous_identity");
});

test("problems come back with the row, not as a thrown file", () => {
  const { rows, issues } = fromCsv(
    "ID,Name,Grade,Email\n1,,5,\n2,Ana Ruiz,Fifth-ish,ana@\n3,Noor Haddad,5,noor@example.com\n",
  );
  assert.deepEqual(named(rows), ["Ana Ruiz", "Noor Haddad"]);
  assert.deepEqual(
    issues.map((issue) => [issue.line, issue.code]),
    [
      [2, "missing_name"],
      [3, "unknown_grade"],
      [3, "invalid_email"],
    ],
  );
  assert.equal(rows[0]!.gradeLevel, undefined);
  assert.equal(rows[0]!.email, undefined);
});

test("everyone goes in one class when the file names none", () => {
  const { rows } = fromCsv("Name\nAna Ruiz\nCher\n", "My class");
  assert.deepEqual(
    rows.map((row) => row.classes[0]?.name),
    ["My class", "My class"],
  );
});

test("parsers on their own", () => {
  assert.deepEqual(parseDelimited('a,"b ""q"" c",d\r\n1,2,3').rows, [
    ["a", 'b "q" c', "d"],
    ["1", "2", "3"],
  ]);
  assert.deepEqual(splitName("Ms. Okafor"), { givenName: "Ms. Okafor" });
  assert.deepEqual(splitName("Juan de la Cruz"), {
    givenName: "Juan",
    familyName: "de la Cruz",
  });
  for (const [raw, grade] of [
    ["K", 0],
    ["KG", 0],
    ["01", 1],
    ["Grade 5", 5],
    ["5th", 5],
    ["Eighth", 8],
    ["Junior", 11],
    ["13", 13],
    ["14", null],
    ["Other", null],
  ] as const)
    assert.equal(parseGrade(raw), grade, raw);
  assert.deepEqual(courseBandsFor(["05", "06"]), ["5", "6"]);
  assert.deepEqual(courseBandsFor(["KG"]), ["K"]);
  assert.deepEqual(courseBandsFor(["10"], "Algebra II"), ["algebra-2"]);
  assert.deepEqual(courseBandsFor(["10"]), ["geometry"]);
});

function oneRosterZip() {
  return zipSync({
    "bulk/orgs.csv": strToU8(
      "sourcedId,status,dateLastModified,name,type,identifier,parentSourcedId\n" +
        "org-1,,,Alder Street School,school,,dist\n" +
        "org-2,,,Birch Road School,school,,dist\n" +
        "dist,,,Fixture District,district,,\n",
    ),
    "bulk/academicSessions.csv": strToU8(
      "sourcedId,status,dateLastModified,title,type,startDate,endDate,parentSourcedId,schoolYear\n" +
        "y1,,,2026-27,schoolYear,2026-08-15,2027-06-15,,2027\n" +
        "t1,,,Semester 1,semester,2026-08-15,2027-01-10,y1,2027\n",
    ),
    "bulk/courses.csv": strToU8(
      "sourcedId,status,dateLastModified,schoolYearSourcedId,title,courseCode,grades,orgSourcedId,subjects,subjectCodes\n" +
        "c1,,,y1,Math 5,M5,05,org-1,,\n" +
        "c2,,,y1,Algebra I,A1,09,org-1,,\n",
    ),
    "bulk/classes.csv": strToU8(
      "sourcedId,status,dateLastModified,title,grades,courseSourcedId,classCode,classType,location,schoolSourcedId,termSourcedIds,subjects,subjectCodes,periods\n" +
        "k1,,,Math 5 Period 1,,c1,,scheduled,,org-1,t1,,,1\n" +
        "k2,,,Algebra I Period 3,,c2,,scheduled,,org-1,t1,,,3\n" +
        "k3,,,Other School Math,,c1,,scheduled,,org-2,t1,,,1\n",
    ),
    "bulk/users.csv": strToU8(
      "sourcedId,status,dateLastModified,enabledUser,username,userIds,givenName,familyName,middleName,identifier,email,sms,phone,agentSourcedIds,grades,password,userMasterIdentifier,resourceSourcedIds,preferredFirstName,preferredMiddleName,preferredLastName,primaryOrgSourcedId,pronouns\n" +
        "u1,,,true,,,Ana,Ruiz,,S-1,,,,,05,,,,,,,org-1,\n" +
        "u2,,,true,,,Noor,Haddad,,S-2,,,,,KG,,,,,,,org-1,\n" +
        "u3,tobedeleted,,true,,,Gone,Student,,S-3,,,,,05,,,,,,,org-1,\n" +
        "t1,,,true,,,Grace,Okafor,,,okafor@alder.example,,,,,,,,,,,org-1,\n" +
        "p1,,,true,,,Pat,Parent,,,pat@example.com,,,,,,,,,,,org-1,\n" +
        "u9,,,true,,,Far,Away,,S-9,,,,,05,,,,,,,org-2,\n",
    ),
    "bulk/enrollments.csv": strToU8(
      "sourcedId,status,dateLastModified,classSourcedId,schoolSourcedId,userSourcedId,role,primary,beginDate,endDate\n" +
        "e1,,,k1,org-1,u1,student,,,\n" +
        "e2,,,k2,org-1,u1,student,,,\n" +
        "e3,,,k1,org-1,u2,student,,,\n" +
        "e4,,,k1,org-1,t1,teacher,true,,\n" +
        "e5,,,k3,org-2,u9,student,,,\n" +
        "e6,tobedeleted,,k1,org-1,u3,student,,,\n",
    ),
    "bulk/readme.txt": strToU8("not a roster"),
  });
}

test("OneRoster: a ZIP becomes the same rows a CSV does", () => {
  const files = readOneRosterZip(oneRosterZip());
  assert.equal(isOneRoster(files), true);
  assert.deepEqual(
    oneRosterSchools(files).map((school) => school.name),
    ["Alder Street School", "Birch Road School"],
  );
  const { rows, skipped, inactive } = oneRosterRows(files, {
    schoolSourcedId: "org-1",
  });
  for (const row of rows) rosterRowSchema.parse(row);
  assert.equal(inactive, 1, "tobedeleted rows don't come in");
  assert.equal(skipped, 1, "a parent isn't rostered");
  const ana = rows.find((row) => row.givenName === "Ana")!;
  assert.equal(ana.role, "student");
  assert.equal(ana.identifier, "S-1");
  assert.equal(ana.gradeLevel, 5);
  assert.deepEqual(
    ana.classes.map((klass) => klass.courseBands),
    [["5"], ["algebra-1"]],
    "courses.grades and the course title map to bands",
  );
  assert.equal(ana.classes[0]!.gradingKind, "semester");
  assert.equal(ana.classes[0]!.session?.name, "Semester 1");
  assert.equal(ana.classes[0]!.year?.kind, "year");
  assert.equal(rows.find((row) => row.givenName === "Noor")!.gradeLevel, 0);
  const grace = rows.find((row) => row.givenName === "Grace")!;
  assert.equal(grace.role, "teacher");
  assert.equal(grace.email, "okafor@alder.example");
  assert.equal(
    rows.some((row) => row.givenName === "Far"),
    false,
    "a chosen school leaves the other one out",
  );
  assert.equal(oneRosterRows(files).rows.length, 0);
});

test("a ZIP that isn't a roster says so instead of half-reading", () => {
  const files = readOneRosterZip(zipSync({ "notes.csv": strToU8("a,b\n1,2") }));
  assert.equal(isOneRoster(files), false);
  assert.throws(() => readOneRosterZip(strToU8("not a zip at all")));
});
