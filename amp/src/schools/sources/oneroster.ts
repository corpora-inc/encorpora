import { strFromU8, unzipSync } from "fflate";
import type { GradingKind } from "../contracts.js";
import { parseDelimited } from "./csv.js";
import {
  cleanCell,
  courseBandsFor,
  looksLikeEmail,
  parseGrade,
  type RosterClass,
  type RosterEvidence,
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
  const seen = new Set<string>();
  let expandedBytes = 0;
  const knownName = (path: string) => {
    if (!/\.csv$/i.test(path)) return undefined;
    const base = path
      .split("/")
      .pop()!
      .replace(/\.csv$/i, "")
      .toLowerCase();
    return FILES.find((name) => name.toLowerCase() === base);
  };
  const entries = unzipSync(bytes, {
    filter: (file) => {
      const known = knownName(file.name);
      if (!known) return false;
      if (seen.has(known)) throw new Error("oneroster_duplicate_file");
      seen.add(known);
      expandedBytes += file.originalSize;
      if (expandedBytes > MAX_FILE_BYTES)
        throw new Error("oneroster_file_too_large");
      return true;
    },
  });
  const files: OneRosterFiles = {};
  for (const [path, content] of Object.entries(entries)) {
    const known = knownName(path)!;
    files[known] = strFromU8(content);
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
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const STUDENT_ROLES = new Set(["student"]);
const STAFF_ROLES = new Map<string, "teacher" | "aide">([
  ["teacher", "teacher"],
  ["aide", "aide"],
]);

export function oneRosterRows(
  files: OneRosterFiles,
  options: { schoolSourcedId?: string } = {},
): SourceResult {
  const allClasses = records(files.classes).filter(current);
  const allClassIds = new Set<string>(),
    duplicateClassIds = new Set<string>();
  for (const row of allClasses) {
    if (allClassIds.has(row.sourcedid)) duplicateClassIds.add(row.sourcedid);
    allClassIds.add(row.sourcedid);
  }
  const schoolIds = [
    ...new Set(allClasses.map((row) => row.schoolsourcedid).filter(Boolean)),
  ];
  const school =
    options.schoolSourcedId ??
    (schoolIds.length === 1 ? schoolIds[0] : undefined);
  const indexed = (text: string | undefined) => {
    const rows = new Map<string, Record_>(),
      duplicates = new Set<string>();
    for (const row of records(text).filter(current)) {
      if (rows.has(row.sourcedid)) duplicates.add(row.sourcedid);
      rows.set(row.sourcedid, row);
    }
    return { rows, duplicates };
  };
  const sessionIndex = indexed(files.academicSessions),
    courseIndex = indexed(files.courses),
    sessions = sessionIndex.rows,
    courses = courseIndex.rows;
  const classes = new Map<string, RosterClass>();
  const classErrors = new Map<string, string>();
  const date = (value: string | undefined) => {
    if (!value) return undefined;
    const day = value;
    if (
      !validDate(day) ||
      Number.isNaN(Date.parse(day)) ||
      new Date(day).toISOString().slice(0, 10) !== day
    )
      return undefined;
    return day;
  };
  const sessionFrom = (id: string): RosterSession => {
    const row = sessions.get(id),
      startsOn = date(row?.startdate),
      endsOn = date(row?.enddate);
    if (sessionIndex.duplicates.has(id))
      throw new Error(`Academic session ${id} appears more than once.`);
    if (!row || !startsOn || !endsOn || endsOn < startsOn)
      throw new Error(
        `Academic session ${id} is missing or has invalid dates.`,
      );
    const title = cleanCell(row.title ?? "") || id;
    return {
      sourcedId: id,
      name: title.slice(0, 100),
      kind: sessionKind(row.type ?? "", title),
      startsOn,
      endsOn,
      ...(row.parentsourcedid ? { parentSourcedId: row.parentsourcedid } : {}),
    };
  };
  for (const row of allClasses) {
    if (!row.sourcedid || (school && row.schoolsourcedid !== school)) continue;
    if (classes.has(row.sourcedid)) {
      classErrors.set(
        row.sourcedid,
        `Class ${row.sourcedid} appears more than once.`,
      );
      continue;
    }
    const course = courses.get(row.coursesourcedid ?? "");
    const title = cleanCell(row.title ?? "") || row.sourcedid;
    const grades = list(row.grades).length
      ? list(row.grades)
      : list(course?.grades);
    const klass: RosterClass = {
      sourcedId: row.sourcedid,
      name: title.slice(0, 100),
      courseBands: courseBandsFor(grades, cleanCell(course?.title ?? title)),
      sourceSchoolId: row.schoolsourcedid,
    };
    classes.set(row.sourcedid, klass);
    try {
      if (duplicateClassIds.has(row.sourcedid))
        throw new Error(`Class ${row.sourcedid} appears more than once.`);
      if (row.coursesourcedid && !course)
        throw new Error(`Course ${row.coursesourcedid} is missing.`);
      if (courseIndex.duplicates.has(row.coursesourcedid))
        throw new Error(
          `Course ${row.coursesourcedid} appears more than once.`,
        );
      const termIds = [...new Set(list(row.termsourcedids))];
      const linked = new Map<string, RosterSession>();
      const years = new Map<string, RosterSession>();
      for (const id of [
        ...termIds,
        ...(course?.schoolyearsourcedid ? [course.schoolyearsourcedid] : []),
      ]) {
        let next: string | undefined = id;
        const visited = new Set<string>();
        while (next) {
          if (visited.has(next) || visited.size >= 100)
            throw new Error(
              `Academic sessions for class ${row.sourcedid} contain a parent cycle.`,
            );
          visited.add(next);
          const session = sessionFrom(next);
          linked.set(next, session);
          if (session.kind === "year") years.set(next, session);
          next = session.parentSourcedId;
        }
      }
      if (years.size > 1)
        throw new Error(`Class ${row.sourcedid} spans different school years.`);
      const terms = termIds.map((id) => linked.get(id)!);
      const year = [...years.values()][0];
      if (terms.length > 1 && !year)
        throw new Error(
          `Class ${row.sourcedid} has several terms without a common school year.`,
        );
      if (
        year &&
        terms.some(
          (term) => term.startsOn < year.startsOn || term.endsOn > year.endsOn,
        )
      )
        throw new Error(
          `A term for class ${row.sourcedid} is outside its school year.`,
        );
      const kind = terms[0]?.kind;
      Object.assign(klass, {
        termSourcedIds: termIds,
        sessions: [...linked.values()],
        ...(year ? { year } : {}),
        ...(terms.length === 1
          ? { session: terms[0] }
          : year
            ? { session: year }
            : {}),
        ...(kind &&
        terms.every((term) => term.kind === kind) &&
        kind !== "custom"
          ? { gradingKind: kind }
          : {}),
      });
    } catch (error) {
      classErrors.set(row.sourcedid, (error as Error).message);
    }
  }
  type SourceRole = RosterEvidence["roles"][number];
  const heldRoles = new Map<string, SourceRole[]>();
  const roleErrors = new Map<string, string>();
  const readPeriod = (row: Record_) => {
    const startsOn = date(row.begindate),
      endsOn = date(row.enddate);
    if (
      (row.begindate && !startsOn) ||
      (row.enddate && !endsOn) ||
      (startsOn && endsOn && endsOn < startsOn)
    )
      throw new Error("A role or enrollment has invalid begin/end dates.");
    return { ...(startsOn ? { startsOn } : {}), ...(endsOn ? { endsOn } : {}) };
  };
  const roleOwners = new Map<string, string>();
  for (const row of records(files.roles).filter(current)) {
    if (!row.usersourcedid) continue;
    try {
      if (
        !row.sourcedid ||
        !row.orgsourcedid ||
        !row.role ||
        !["primary", "secondary"].includes((row.roletype ?? "").toLowerCase())
      )
        throw new Error(
          "A role is missing its sourcedId, organization, role or valid roleType.",
        );
      const owner = roleOwners.get(row.sourcedid);
      if (owner) {
        const message = `Role ${row.sourcedid} appears more than once.`;
        roleErrors.set(owner, message);
        throw new Error(message);
      }
      roleOwners.set(row.sourcedid, row.usersourcedid);
      const role: SourceRole = {
        role: (row.role ?? "").toLowerCase(),
        ...(row.sourcedid ? { sourcedId: row.sourcedid } : {}),
        ...(row.orgsourcedid ? { orgSourcedId: row.orgsourcedid } : {}),
        ...(row.roletype
          ? { primary: row.roletype.toLowerCase() === "primary" }
          : {}),
        ...readPeriod(row),
      };
      heldRoles.set(row.usersourcedid, [
        ...(heldRoles.get(row.usersourcedid) ?? []),
        role,
      ]);
    } catch (error) {
      roleErrors.set(row.usersourcedid, (error as Error).message);
    }
  }
  const memberships = new Map<string, RosterEvidence["enrollments"]>();
  const membershipErrors = new Map<string, string>();
  const enrollmentOwners = new Map<string, string>();
  for (const row of records(files.enrollments).filter(current)) {
    if (!row.usersourcedid) continue;
    if (
      (!row.classsourcedid || !allClassIds.has(row.classsourcedid)) &&
      (!row.schoolsourcedid || row.schoolsourcedid === school)
    ) {
      membershipErrors.set(
        row.usersourcedid,
        `Enrollment ${row.sourcedid} refers to a missing class.`,
      );
      continue;
    }
    if (!classes.has(row.classsourcedid)) continue;
    try {
      const role = (row.role ?? "").toLowerCase();
      if (!STUDENT_ROLES.has(role) && !STAFF_ROLES.has(role))
        throw new Error(
          `Enrollment ${row.sourcedid || row.classsourcedid} uses unsupported role ${role || "(empty)"}.`,
        );
      if (
        row.schoolsourcedid &&
        row.schoolsourcedid !== classes.get(row.classsourcedid)!.sourceSchoolId
      )
        throw new Error(
          `Enrollment ${row.sourcedid} names a different school than its class.`,
        );
      if (!row.sourcedid)
        throw new Error("An enrollment is missing its sourcedId.");
      const owner = enrollmentOwners.get(row.sourcedid);
      if (owner) {
        const message = `Enrollment ${row.sourcedid} appears more than once.`;
        membershipErrors.set(owner, message);
        throw new Error(message);
      }
      enrollmentOwners.set(row.sourcedid, row.usersourcedid);
      const entry: RosterEvidence["enrollments"][number] = {
        sourcedId: row.sourcedid,
        classSourcedId: row.classsourcedid,
        ...(row.schoolsourcedid
          ? { schoolSourcedId: row.schoolsourcedid }
          : {}),
        role: role as "student" | "teacher" | "aide",
        ...readPeriod(row),
      };
      memberships.set(row.usersourcedid, [
        ...(memberships.get(row.usersourcedid) ?? []),
        entry,
      ]);
    } catch (error) {
      membershipErrors.set(row.usersourcedid, (error as Error).message);
    }
  }
  const rows: RosterRow[] = [],
    issues: RosterIssue[] = [];
  let skipped = 0,
    inactive = 0;
  const seen = new Set<string>();
  for (const user of records(files.users)) {
    if (!user.sourcedid) continue;
    if (!current(user) || (user.enableduser ?? "").toLowerCase() === "false") {
      inactive++;
      continue;
    }
    const enrollments = memberships.get(user.sourcedid) ?? [];
    const orgs = [
      ...new Set([
        ...list(user.primaryorgsourcedid),
        ...list(user.orgsourcedids),
        ...(heldRoles.get(user.sourcedid) ?? []).flatMap((role) =>
          role.orgSourcedId ? [role.orgSourcedId] : [],
        ),
      ]),
    ];
    const sourceRoles = [...(heldRoles.get(user.sourcedid) ?? [])];
    if (user.role)
      for (const orgSourcedId of orgs.length ? orgs : school ? [school] : [])
        if (
          !sourceRoles.some(
            (role) =>
              role.orgSourcedId === orgSourcedId &&
              role.role === user.role.toLowerCase(),
          )
        )
          sourceRoles.push({ role: user.role.toLowerCase(), orgSourcedId });
    const selectedRoles = sourceRoles.filter(
      (role) => !role.orgSourcedId || role.orgSourcedId === school,
    );
    if (
      school &&
      !enrollments.length &&
      !orgs.includes(school) &&
      !membershipErrors.has(user.sourcedid)
    )
      continue;
    const roleNames = [
      ...new Set([
        ...selectedRoles.map((role) => role.role),
        ...enrollments.map((e) => e.role),
      ]),
    ];
    const supported = roleNames.filter(
      (role) => STUDENT_ROLES.has(role) || STAFF_ROLES.has(role),
    );
    const role = supported.includes("student")
      ? "student"
      : supported.includes("teacher")
        ? "teacher"
        : "aide";
    const staff = role !== "student";
    const line = Number(user.__line) || 1;
    const emailCell = cleanCell(user.email ?? "");
    const email =
      emailCell && looksLikeEmail(emailCell)
        ? emailCell.toLowerCase()
        : undefined;
    const gradeCell = list(user.grades)[0] ?? "",
      gradeLevel = gradeCell ? parseGrade(gradeCell) : null;
    const identifier = cleanCell(user.identifier ?? "").slice(0, 100);
    const classIds = [...new Set(enrollments.map((e) => e.classSourcedId))];
    const base: Omit<RosterRow, "givenName"> = {
      line,
      role,
      sourcedId: user.sourcedid,
      ...(email ? { email } : {}),
      ...(identifier && !staff ? { identifier } : {}),
      ...(gradeLevel !== null && !staff ? { gradeLevel } : {}),
      classes: classIds.map((id) => classes.get(id)!),
      ...(school
        ? {
            sourceEvidence: {
              schoolSourcedId: school,
              orgSourcedIds: orgs,
              roles: sourceRoles,
              enrollments,
            },
          }
        : {}),
    };
    let conflict = !school
      ? "Choose one school from the OneRoster export."
      : roleErrors.get(user.sourcedid) ||
        membershipErrors.get(user.sourcedid) ||
        classIds.map((id) => classErrors.get(id)).find(Boolean);
    const identityRoles = [
      ...supported,
      ...sourceRoles
        .map((role) => role.role)
        .filter((role) => STUDENT_ROLES.has(role) || STAFF_ROLES.has(role)),
    ];
    if (
      identityRoles.includes("student") &&
      identityRoles.some((role) => role !== "student")
    )
      conflict =
        "This person has both student and teaching roles and needs an explicit account review.";
    if (seen.has(user.sourcedid))
      conflict = `User ${user.sourcedid} appears more than once.`;
    seen.add(user.sourcedid);
    // Duplicate or overlapping intervals are not collapsed into a permanent role.
    for (let a = 0; a < enrollments.length; a++)
      for (let b = a + 1; b < enrollments.length; b++) {
        const left = enrollments[a]!,
          right = enrollments[b]!;
        if (
          left.sourcedId === right.sourcedId ||
          (left.classSourcedId === right.classSourcedId &&
            left.role === right.role &&
            (left.startsOn ?? "0000-01-01") < (right.endsOn ?? "9999-12-31") &&
            (right.startsOn ?? "0000-01-01") < (left.endsOn ?? "9999-12-31"))
        )
          conflict =
            "A class membership has duplicate or overlapping enrollment records.";
      }
    if (conflict) {
      issues.push({
        line,
        code: "source_conflict",
        value: conflict,
        row: base,
      });
      continue;
    }
    if (!supported.length) {
      skipped++;
      continue;
    }
    const given = cleanCell(
      user.preferredgivenname ||
        user.preferredfirstname ||
        user.givenname ||
        "",
    );
    const family = cleanCell(
      user.preferredfamilyname ||
        user.preferredlastname ||
        user.familyname ||
        "",
    );
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
    const unsupported = roleNames.filter(
      (role) => !STUDENT_ROLES.has(role) && !STAFF_ROLES.has(role),
    );
    if (unsupported.length)
      issues.push({
        line,
        code: "unsupported_role",
        value: unsupported.join(", "),
        row,
      });
    if (gradeCell && gradeLevel === null && !staff)
      issues.push({ line, code: "unknown_grade", value: gradeCell, row });
    if (emailCell && !email)
      issues.push({ line, code: "invalid_email", value: emailCell, row });
  }
  // An invalid repeated source identity withholds every duplicate, not just the
  // second occurrence that happened to reveal it.
  const duplicateIds = new Set(
    issues
      .filter(
        (issue) =>
          issue.code === "source_conflict" && issue.value.startsWith("User "),
      )
      .map((issue) => issue.row.sourcedId),
  );
  return {
    rows: rows.filter((row) => !duplicateIds.has(row.sourcedId)),
    issues,
    skipped,
    inactive,
  };
}
