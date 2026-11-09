import type { RosterIssue, RosterRow, SourceResult } from "./rows.js";
import { cleanCell, looksLikeEmail, splitName } from "./rows.js";

/** The outside-ID source for one Classroom course. Each course is its own
 * source, so a student ID or a class ID from Classroom can never meet another
 * system's. */
export const classroomSource = (courseId: string) =>
  `google-classroom:${courseId}` as const;
export const classroomSourcePattern = /^google-classroom:[A-Za-z0-9_-]{1,100}$/;

/** The part of Classroom's `courses.students.list` answer AMP reads. */
export type ClassroomStudent = {
  userId?: string;
  profile?: {
    id?: string;
    name?: { givenName?: string; familyName?: string; fullName?: string };
    emailAddress?: string;
  };
};
export type ClassroomCourse = { id: string; name: string };

/** Students of one course as roster rows: Google's user ID is the person's
 * outside ID, the course is the class, and the address is the student's email
 * (their Google sign-in). Students without a usable name are issues, not rows. */
export function classroomRows(
  course: ClassroomCourse,
  students: readonly ClassroomStudent[],
): SourceResult {
  const className = cleanCell(course.name) || "Google Classroom";
  const rows: RosterRow[] = [];
  const issues: RosterIssue[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  students.forEach((student, index) => {
    const line = index + 1;
    const sourcedId = (student.userId ?? student.profile?.id ?? "").trim();
    if (!sourcedId || seen.has(sourcedId)) {
      skipped++;
      return;
    }
    seen.add(sourcedId);
    const name = student.profile?.name;
    const parts =
      name?.givenName && cleanCell(name.givenName)
        ? {
            givenName: cleanCell(name.givenName),
            ...(name.familyName && cleanCell(name.familyName)
              ? { familyName: cleanCell(name.familyName) }
              : {}),
          }
        : splitName(name?.fullName ?? "");
    const rawEmail = (student.profile?.emailAddress ?? "").trim().toLowerCase();
    const email = looksLikeEmail(rawEmail) ? rawEmail : undefined;
    const base = {
      line,
      role: "student" as const,
      sourcedId,
      ...(parts.familyName
        ? { familyName: parts.familyName.slice(0, 100) }
        : {}),
      ...(email ? { email } : {}),
      classes: [
        {
          sourcedId: course.id,
          name: className.slice(0, 100),
          courseBands: [],
        },
      ],
    };
    if (!parts.givenName) {
      issues.push({ line, code: "missing_name", value: "", row: base });
      return;
    }
    rows.push({ ...base, givenName: parts.givenName.slice(0, 100) });
    if (rawEmail && !email)
      issues.push({
        line,
        code: "invalid_email",
        value: rawEmail,
        row: { ...base, givenName: parts.givenName.slice(0, 100) },
      });
  });
  return { rows, issues, skipped, inactive: 0 };
}
