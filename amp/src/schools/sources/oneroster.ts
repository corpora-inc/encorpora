import { strFromU8, unzipSync } from "fflate";
import type { GradingKind } from "../contracts.js";
import { parseDelimited } from "./csv.js";
import {
  cleanCell,
  courseBandsFor,
  looksLikeEmail,
  parseGrade,
  type RosterClass,
  type RosterIssue,
  type RosterRow,
  type RosterSession,
  type SourceResult,
} from "./rows.js";

/** OneRoster 1.2's CSV binding, from a bulk export: `orgs`, `users`, `classes`,
 * `courses`, `enrollments`, `academicSessions`, joined into roster rows. */
const FILES = [
  "orgs",
  "users",
  "classes",
  "courses",
  "enrollments",
  "academicSessions",
  "roles",
] as const;
export type OneRosterFiles = Partial<Record<(typeof FILES)[number], string>>;
const MAX_FILE_BYTES = 64 * 1024 * 1024;

/** The CSV files inside a ZIP, wherever the exporter put them. Throws on
 * something that isn't a ZIP; refuses to expand a suspiciously large file. */
export function readOneRosterZip(bytes: Uint8Array): OneRosterFiles {
  const entries = unzipSync(bytes, {
    filter: (file) =>
      /\.csv$/i.test(file.name) && file.originalSize <= MAX_FILE_BYTES,
  });
  const files: OneRosterFiles = {};
  for (const [path, content] of Object.entries(entries)) {
    const base = path
      .split("/")
      .pop()!
      .replace(/\.csv$/i, "")
      .toLowerCase();
    const known = FILES.find((name) => name.toLowerCase() === base);
    if (known) files[known] = strFromU8(content);
  }
  return files;
}
export const isOneRoster = (files: OneRosterFiles) =>
  !!files.users && !!files.enrollments && !!files.classes;

type Record_ = Record<string, string> & { __line: string };
/** Rows by lower-cased column name, so a reordered or recased export reads the
 * same. Bulk files have no status; `tobedeleted` rows are skipped. */
function records(text: string | undefined): Record_[] {
  if (!text) return [];
  const { rows, lines } = parseDelimited(text);
  const header = rows[0]?.map((cell) => cleanCell(cell).toLowerCase()) ?? [];
  return rows.slice(1).map((row, rowIndex) => {
    const entry = { __line: String(lines[rowIndex + 1] ?? 0) } as Record_;
    header.forEach((column, index) => {
      entry[column] = (row[index] ?? "").trim();
    });
    return entry;
  });
}
const current = (row: Record_) =>
  (row.status ?? "").toLowerCase() !== "tobedeleted";
const list = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

/** The schools a multi-school export covers, so a person can pick theirs. */
export function oneRosterSchools(files: OneRosterFiles) {
  return records(files.orgs)
    .filter(
      (org) => current(org) && (org.type ?? "").toLowerCase() === "school",
    )
    .map((org) => ({
      sourcedId: org.sourcedid ?? "",
      name: cleanCell(org.name ?? ""),
    }));
}

const SESSION_KINDS: Record<string, GradingKind> = {
  schoolyear: "year",
  year: "year",
  semester: "semester",
  trimester: "trimester",
  quarter: "quarter",
};
function sessionKind(type: string, title: string): GradingKind {
  const direct = SESSION_KINDS[type.toLowerCase()];
  if (direct) return direct;
  const named = title.toLowerCase();
  if (/quarter|\bq[1-4]\b/.test(named)) return "quarter";
  if (/trimester|\bt[1-3]\b/.test(named)) return "trimester";
  if (/semester|\bs[12]\b/.test(named)) return "semester";
  return "custom";
}
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}/.test(value);

const STUDENT_ROLES = new Set(["student"]);
const STAFF_ROLES = new Map<string, "teacher" | "aide">([
  ["teacher", "teacher"],
  ["aide", "aide"],
]);

export function oneRosterRows(
  files: OneRosterFiles,
  options: { schoolSourcedId?: string } = {},
): SourceResult {
  const school = options.schoolSourcedId;
  const sessions = new Map(
    records(files.academicSessions)
      .filter(current)
      .map((session) => [session.sourcedid ?? "", session]),
  );
  const sessionFrom = (
    id: string | undefined,
  ): (RosterSession & { parent?: string }) | undefined => {
    const row = id ? sessions.get(id) : undefined;
    if (
      !row?.sourcedid ||
      !validDate(row.startdate ?? "") ||
      !validDate(row.enddate ?? "")
    )
      return undefined;
    const title = cleanCell(row.title ?? "") || row.sourcedid;
    return {
      sourcedId: row.sourcedid,
      name: title.slice(0, 100),
      kind: sessionKind(row.type ?? "", title),
      startsOn: row.startdate!.slice(0, 10),
      endsOn: row.enddate!.slice(0, 10),
      ...(row.parentsourcedid ? { parent: row.parentsourcedid } : {}),
    };
  };
  const courses = new Map(
    records(files.courses)
      .filter(current)
      .map((course) => [course.sourcedid ?? "", course]),
  );
  const classes = new Map<string, RosterClass>();
  for (const row of records(files.classes)) {
    if (!current(row) || !row.sourcedid) continue;
    if (school && row.schoolsourcedid && row.schoolsourcedid !== school)
      continue;
    const course = courses.get(row.coursesourcedid ?? "");
    const title = cleanCell(row.title ?? "") || row.sourcedid;
    const grades = list(row.grades).length
      ? list(row.grades)
      : list(course?.grades);
    const term = sessionFrom(list(row.termsourcedids)[0]);
    const year =
      term?.kind === "year" ? term : (sessionFrom(term?.parent) ?? undefined);
    const strip = (session: RosterSession & { parent?: string }) => {
      const { parent: _parent, ...rest } = session;
      return rest;
    };
    classes.set(row.sourcedid, {
      sourcedId: row.sourcedid,
      name: title.slice(0, 100),
      courseBands: courseBandsFor(grades, cleanCell(course?.title ?? title)),
      ...(term && term.kind !== "custom" ? { gradingKind: term.kind } : {}),
      ...(term ? { session: strip(term) } : {}),
      ...(year ? { year: strip(year) } : {}),
    });
  }
  const memberships = new Map<
    string,
    { classes: Set<string>; roles: Set<string> }
  >();
  for (const row of records(files.enrollments)) {
    if (!current(row) || !row.usersourcedid || !row.classsourcedid) continue;
    if (!classes.has(row.classsourcedid)) continue;
    const entry = memberships.get(row.usersourcedid) ?? {
      classes: new Set<string>(),
      roles: new Set<string>(),
    };
    entry.classes.add(row.classsourcedid);
    entry.roles.add((row.role ?? "").toLowerCase());
    memberships.set(row.usersourcedid, entry);
  }
  const heldRoles = new Map<string, string>();
  for (const row of records(files.roles))
    if (current(row) && row.usersourcedid)
      heldRoles.set(row.usersourcedid, (row.role ?? "").toLowerCase());
  const rows: RosterRow[] = [];
  const issues: RosterIssue[] = [];
  let skipped = 0;
  let inactive = 0;
  for (const user of records(files.users)) {
    if (!user.sourcedid) continue;
    if (!current(user) || (user.enableduser ?? "").toLowerCase() === "false") {
      inactive++;
      continue;
    }
    const member = memberships.get(user.sourcedid);
    if (school) {
      const orgs = [
        ...list(user.primaryorgsourcedid),
        ...list(user.orgsourcedids),
      ];
      if (!member && !orgs.includes(school)) continue;
    }
    const role = (
      user.role ||
      heldRoles.get(user.sourcedid) ||
      [...(member?.roles ?? [])].find(
        (value) => STUDENT_ROLES.has(value) || STAFF_ROLES.has(value),
      ) ||
      ""
    ).toLowerCase();
    const staff = STAFF_ROLES.get(role);
    if (!STUDENT_ROLES.has(role) && !staff) {
      skipped++;
      continue;
    }
    const line = Number(user.__line) || 1;
    const emailCell = cleanCell(user.email ?? "");
    const email =
      emailCell && looksLikeEmail(emailCell)
        ? emailCell.toLowerCase()
        : undefined;
    const gradeCell = list(user.grades)[0] ?? "";
    const gradeLevel = gradeCell ? parseGrade(gradeCell) : null;
    const identifier = cleanCell(user.identifier ?? "").slice(0, 100);
    const base = {
      line,
      role: staff ?? ("student" as const),
      sourcedId: user.sourcedid,
      ...(email ? { email } : {}),
      ...(identifier && !staff ? { identifier } : {}),
      ...(gradeLevel !== null && !staff ? { gradeLevel } : {}),
      classes: [...(member?.classes ?? [])].map((id) => classes.get(id)!),
    };
    const given = cleanCell(user.preferredfirstname || user.givenname || "");
    const family = cleanCell(user.preferredlastname || user.familyname || "");
    const givenName = given || family;
    if (!givenName) {
      issues.push({ line, code: "missing_name", value: "", row: base });
      continue;
    }
    if (givenName.length > 100 || family.length > 100) {
      issues.push({
        line,
        code: "name_too_long",
        value: `${given} ${family}`.trim(),
        row: base,
      });
      continue;
    }
    const row: RosterRow = {
      ...base,
      givenName,
      ...(given && family ? { familyName: family } : {}),
    };
    rows.push(row);
    if (gradeCell && gradeLevel === null && !staff)
      issues.push({ line, code: "unknown_grade", value: gradeCell, row });
    if (emailCell && !email)
      issues.push({ line, code: "invalid_email", value: emailCell, row });
  }
  return { rows, issues, skipped, inactive };
}
