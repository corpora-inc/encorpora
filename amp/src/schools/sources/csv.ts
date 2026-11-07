import {
  cleanCell,
  looksLikeEmail,
  nameKey,
  parseGrade,
  splitName,
  type RosterClass,
  type RosterIssue,
  type RosterRow,
  type SourceResult,
} from "./rows.js";

/** A delimited file as a table, whatever a spreadsheet or SIS made of it: a BOM,
 * CRLF, semicolons or tabs, quoted commas and newlines, blank lines. */
export type Table = {
  headers: string[];
  rows: string[][];
  /** Each row's line in the file, for pointing at it later. */
  lines: number[];
  headed: boolean;
};

function detectDelimiter(text: string) {
  const firstLine = text.slice(0, text.search(/\r?\n|$/));
  const counts = ["\t", ",", ";", "|"].map((delimiter) => ({
    delimiter,
    count: firstLine.split(delimiter).length - 1,
  }));
  return counts.reduce((best, entry) =>
    entry.count > best.count ? entry : best,
  ).delimiter;
}

/** RFC 4180, leniently. */
export function parseDelimited(input: string): {
  rows: string[][];
  lines: number[];
} {
  const text = input.replace(/^﻿/, "");
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  const lines: number[] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let rowLine = 1;
  const endCell = () => {
    row.push(cell);
    cell = "";
  };
  const endRow = () => {
    endCell();
    if (row.some((value) => value.trim())) {
      rows.push(row);
      lines.push(rowLine);
    }
    row = [];
  };
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!;
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (char === '"') quoted = false;
      else {
        if (char === "\n") line++;
        cell += char;
      }
    } else if (char === '"' && !cell.trim()) {
      cell = "";
      quoted = true;
    } else if (char === delimiter) endCell();
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index++;
      endRow();
      line++;
      rowLine = line;
    } else cell += char;
  }
  if (cell || row.length) endRow();
  return { rows, lines };
}

export const fieldKeys = [
  "ignore",
  "name",
  "givenName",
  "familyName",
  "id",
  "email",
  "grade",
  "class",
  "teacher",
  "teacherEmail",
  "role",
] as const;
export type FieldKey = (typeof fieldKeys)[number];
export const fieldLabels: Record<FieldKey, string> = {
  ignore: "Don’t import",
  name: "Full name",
  givenName: "First name",
  familyName: "Last name",
  id: "Student ID",
  email: "Email",
  grade: "Grade",
  class: "Class",
  teacher: "Teacher",
  teacherEmail: "Teacher email",
  role: "Student or teacher",
};
export type Mapping = Record<number, FieldKey>;

/** Most specific first, so "Teacher Email" never lands on Email. */
const HEADER_PATTERNS: [FieldKey, RegExp][] = [
  ["teacherEmail", /^(teacher|instructor|staff)\s*(e-?mail)/],
  ["teacher", /^(teacher|instructor|staff)(\s*(name|full name))?$/],
  [
    "familyName",
    /^((student|learner)\s*)?(last|family|sur)\s*-?(name)?$|^lname$/,
  ],
  [
    "givenName",
    /^((student|learner)\s*)?(first|given|preferred|fore)\s*-?(name)?$|^fname$/,
  ],
  [
    "name",
    /^((student|learner|child)(\s*(full\s*)?name)?|(full\s*)?name|last,?\s*first)$/,
  ],
  ["email", /(^|\s)e-?mail(\s*address)?$/],
  [
    "id",
    /^((student|sis|state|local|school|user|person)\s*)?(id|number|no\.?|#|identifier|sourced\s*id|code)$/,
  ],
  ["grade", /^(current\s*)?(grade|gr|grade\s*level|level|year\s*group)$/],
  [
    "class",
    /^(class|section|course|period|homeroom|room|group|class\s*name|section\s*name|course\s*name)$/,
  ],
  ["role", /^(role|type|user\s*type|person\s*type)$/],
];
const headerKey = (header: string) =>
  cleanCell(header)
    .toLowerCase()
    .replace(/[_.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
function fieldFromHeader(header: string): FieldKey | null {
  const key = headerKey(header);
  for (const [field, pattern] of HEADER_PATTERNS)
    if (pattern.test(key)) return field;
  return null;
}

/** From what a column holds, for a paste with no header row. */
function fieldFromValues(values: readonly string[]): FieldKey {
  const sample = values.map(cleanCell).filter(Boolean).slice(0, 20);
  if (!sample.length) return "ignore";
  const share = (test: (value: string) => boolean) =>
    sample.filter(test).length / sample.length;
  if (share(looksLikeEmail) > 0.7) return "email";
  if (share((value) => parseGrade(value) !== null) > 0.7) return "grade";
  if (share((value) => /^[\p{L}][\p{L} .,'’-]*$/u.test(value)) > 0.7)
    return "name";
  return "ignore";
}

export function readTable(text: string): Table {
  const { rows, lines } = parseDelimited(text);
  if (!rows.length) return { headers: [], rows: [], lines: [], headed: false };
  const width = Math.max(...rows.map((row) => row.length));
  const pad = (row: string[]) =>
    Array.from({ length: width }, (_, index) => row[index] ?? "");
  const first = rows[0]!;
  const headed = first.some((cell) => fieldFromHeader(cell));
  return headed
    ? {
        headers: pad(first).map((cell) => cleanCell(cell)),
        rows: rows.slice(1).map(pad),
        lines: lines.slice(1),
        headed,
      }
    : {
        headers: Array.from(
          { length: width },
          (_, index) => `Column ${index + 1}`,
        ),
        rows: rows.map(pad),
        lines,
        headed,
      };
}

/** A first reading of the columns, which the person can correct. One column per
 * field: when two claim it, the first keeps it. */
export function guessMapping(table: Table): Mapping {
  const taken = new Set<FieldKey>();
  const mapping: Mapping = {};
  table.headers.forEach((header, index) => {
    const field = table.headed
      ? (fieldFromHeader(header) ?? "ignore")
      : fieldFromValues(table.rows.map((row) => row[index] ?? ""));
    if (field !== "ignore" && taken.has(field)) mapping[index] = "ignore";
    else {
      mapping[index] = field;
      taken.add(field);
    }
  });
  if (mapping && Object.values(mapping).includes("name")) {
    // A full name beside first and last columns would read everyone twice.
    const split =
      Object.values(mapping).includes("givenName") ||
      Object.values(mapping).includes("familyName");
    if (split)
      for (const [index, field] of Object.entries(mapping))
        if (field === "name") mapping[Number(index)] = "ignore";
  }
  return mapping;
}
/** Whether this mapping can produce people: it needs to know their names. */
export const mappingHasName = (mapping: Mapping) => {
  const fields = Object.values(mapping);
  return fields.includes("name") || fields.includes("givenName");
};

function classFrom(name: string): RosterClass {
  return {
    sourcedId: `name:${nameKey(name)}`,
    name: name.slice(0, 100),
    courseBands: [],
  };
}

type Draft = RosterRow & { classKeys: Set<string> };

/** Rows from a mapped table. A person with an ID is one person however many
 * rows they have; without one, the same name and grade in another class is the
 * same student, and the same name in the same class is a second student
 * (twins are real), kept apart by which occurrence they are, in file order, so
 * re-importing the file lands on the same people. */
export function csvRows(
  table: Table,
  mapping: Mapping,
  options: { fallbackClass?: string } = {},
): SourceResult {
  const columns: Partial<Record<FieldKey, number>> = {};
  for (const [index, field] of Object.entries(mapping))
    if (field !== "ignore") columns[field] = Number(index);
  const read = (row: string[], field: FieldKey) => {
    const index = columns[field];
    return index === undefined ? "" : cleanCell(row[index] ?? "");
  };
  const fallback = cleanCell(options.fallbackClass ?? "");
  const issues: RosterIssue[] = [];
  const people = new Map<string, Draft>();
  const teachers = new Map<string, Draft>();
  const nameOccurrences = new Map<string, number>();
  let skipped = 0;
  const addClass = (person: Draft, klass: RosterClass | null) => {
    if (!klass || person.classKeys.has(klass.sourcedId)) return;
    person.classKeys.add(klass.sourcedId);
    person.classes.push(klass);
  };
  const addTeacher = (
    line: number,
    teacherName: string,
    teacherEmail: string,
    klass: RosterClass | null,
    role: "teacher" | "aide" = "teacher",
  ) => {
    const email = looksLikeEmail(teacherEmail)
      ? teacherEmail.toLowerCase()
      : undefined;
    const display = teacherName || (email ? email.split("@")[0]! : "");
    if (!display) return;
    const key = email ?? `name:${nameKey(display)}`;
    let teacher = teachers.get(key);
    if (!teacher) {
      const { givenName, familyName } = splitName(display);
      teacher = {
        line,
        role,
        sourcedId: key,
        givenName: givenName.slice(0, 100),
        ...(familyName ? { familyName: familyName.slice(0, 100) } : {}),
        ...(email ? { email } : {}),
        classes: [],
        classKeys: new Set(),
      };
      teachers.set(key, teacher);
    }
    addClass(teacher, klass);
  };
  table.rows.forEach((row, index) => {
    const line = table.lines[index] ?? index + 2;
    const className = read(row, "class") || fallback;
    const klass = className ? classFrom(className) : null;
    const roleCell = read(row, "role").toLowerCase();
    const email = read(row, "email");
    const fullName = read(row, "name");
    const given = read(row, "givenName");
    const family = read(row, "familyName");
    const parts = given
      ? { givenName: given, ...(family ? { familyName: family } : {}) }
      : fullName
        ? splitName(fullName)
        : family
          ? { givenName: family }
          : null;
    if (/^(teacher|instructor|staff|aide)/.test(roleCell)) {
      if (parts)
        addTeacher(
          line,
          [parts.givenName, parts.familyName].filter(Boolean).join(" "),
          email,
          klass,
          roleCell.startsWith("aide") ? "aide" : "teacher",
        );
      return;
    }
    if (
      /^(parent|guardian|relative|admin|administrator|proctor)/.test(roleCell)
    ) {
      skipped++;
      return;
    }
    addTeacher(line, read(row, "teacher"), read(row, "teacherEmail"), klass);
    const id = read(row, "id");
    const gradeCell = read(row, "grade");
    const gradeLevel = gradeCell ? parseGrade(gradeCell) : null;
    const validEmail = email && looksLikeEmail(email) ? email : undefined;
    const shared = {
      line,
      role: "student" as const,
      ...(gradeLevel !== null ? { gradeLevel } : {}),
      ...(validEmail ? { email: validEmail.toLowerCase() } : {}),
      ...(id ? { identifier: id.slice(0, 100) } : {}),
    };
    const base = {
      ...shared,
      sourcedId: id,
      classes: klass ? [klass] : [],
    };
    if (!parts) {
      if (id && people.has(id)) {
        addClass(people.get(id)!, klass);
        return;
      }
      issues.push({ line, code: "missing_name", value: "", row: base });
      return;
    }
    const tooLong =
      parts.givenName.length > 100 || (parts.familyName?.length ?? 0) > 100;
    if (tooLong) {
      issues.push({
        line,
        code: "name_too_long",
        value: `${parts.givenName} ${parts.familyName ?? ""}`.trim(),
        row: base,
      });
      return;
    }
    let sourcedId = id;
    if (!sourcedId) {
      const nameId = `name:${nameKey(`${parts.givenName} ${parts.familyName ?? ""}`)}|${gradeLevel ?? ""}`;
      const classKey = `${nameId}|${klass?.sourcedId ?? ""}`;
      const occurrence = (nameOccurrences.get(classKey) ?? 0) + 1;
      nameOccurrences.set(classKey, occurrence);
      sourcedId = occurrence === 1 ? nameId : `${nameId}#${occurrence}`;
    }
    let person = people.get(sourcedId);
    if (!person) {
      person = {
        ...shared,
        sourcedId,
        ...parts,
        classes: [],
        classKeys: new Set(),
      };
      people.set(sourcedId, person);
      if (gradeCell && gradeLevel === null)
        issues.push({
          line,
          code: "unknown_grade",
          value: gradeCell,
          row: person,
        });
      if (email && !validEmail)
        issues.push({
          line,
          code: "invalid_email",
          value: email,
          row: person,
        });
    }
    addClass(person, klass);
  });
  const strip = ({ classKeys: _keys, ...row }: Draft): RosterRow => row;
  // A teacher came from a student's row, so that line is taken: every row keeps
  // a line of its own, which is how a dry run's answer finds it again.
  const end = Math.max(1, ...table.lines);
  return {
    rows: [
      ...people.values(),
      ...[...teachers.values()].map((teacher, index) => ({
        ...teacher,
        line: end + index + 1,
      })),
    ].map(strip),
    issues,
    skipped,
    inactive: 0,
  };
}
