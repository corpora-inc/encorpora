import { z } from "zod";

export const cleverId = z.string().regex(/^[a-f0-9]{24}$/);
export type CleverEnvironment = "sandbox" | "production";
const optionalText = z.string().nullable().optional();
const optionalId = cleverId.nullable().optional();
const date = z
  .union([z.iso.date(), z.iso.datetime({ offset: true })])
  .nullable()
  .optional();
const base = { id: cleverId, district: cleverId };
const schoolRole = z.object({
  school: optionalId,
  schools: z.array(cleverId).optional(),
  sis_id: optionalText,
});

// Deliberately strip unknown keys. Full source responses include fields AMP
// does not need, including student credentials, addresses and demographics.
export const districtSchema = z.object({
  id: cleverId,
  name: z.string(),
  sis_type: optionalText,
  connection_type: optionalText,
  launch_date: date,
  state: optionalText,
  last_sync: date,
  last_clever_sync: date,
  pause_start: date,
  pause_end: date,
});
export const schoolSchema = z.object({
  ...base,
  name: z.string(),
  sis_id: optionalText,
  school_number: optionalText,
  nces_id: optionalText,
  mdr_number: optionalText,
  low_grade: optionalText,
  high_grade: optionalText,
});
export const userSchema = z.object({
  ...base,
  name: z.object({
    first: optionalText,
    last: optionalText,
    middle: optionalText,
  }),
  email: optionalText,
  roles: z.object({
    student: schoolRole
      .extend({ grade: optionalText, student_number: optionalText })
      .nullable()
      .optional(),
    teacher: schoolRole
      .extend({ teacher_number: optionalText })
      .nullable()
      .optional(),
    staff: schoolRole
      .extend({ staff_id: optionalText, title: optionalText })
      .nullable()
      .optional(),
    district_admin: z.object({ title: optionalText }).nullable().optional(),
    // Contacts are recognized but neither provisioned nor imported as guardians.
    contact: z.object({}).nullable().optional(),
  }),
});
export const sectionSchema = z.object({
  ...base,
  school: cleverId,
  name: z.string(),
  students: z.array(cleverId),
  teachers: z.array(cleverId).optional(),
  teacher: optionalId,
  term_id: optionalId,
  course: optionalId,
  grade: optionalText,
  subject: optionalText,
  period: optionalText,
  section_number: optionalText,
  sis_id: optionalText,
});
export const courseSchema = z.object({
  ...base,
  name: optionalText,
  number: optionalText,
});
export const termSchema = z.object({
  ...base,
  name: optionalText,
  start_date: date,
  end_date: date,
});
export const schemas = {
  district: districtSchema,
  school: schoolSchema,
  user: userSchema,
  section: sectionSchema,
  course: courseSchema,
  term: termSchema,
};
export type Kind = keyof typeof schemas;
export type District = z.infer<typeof districtSchema>;
export type School = z.infer<typeof schoolSchema>;
export type User = z.infer<typeof userSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type Course = z.infer<typeof courseSchema>;
export type Term = z.infer<typeof termSchema>;
export type RosterRecord = District | School | User | Section | Course | Term;
export type Snapshot = {
  district: District;
  schools: School[];
  users: User[];
  sections: Section[];
  courses: Course[];
  terms: Term[];
};
export const collections = {
  district: "districts",
  school: "schools",
  user: "users",
  section: "sections",
  course: "courses",
  term: "terms",
} as const;
export const userRoles = (user: User) =>
  Object.entries(user.roles)
    .filter(([, role]) => role != null)
    .map(([role]) => role);
export function gradeLevel(value: string | null | undefined): number | null {
  if (value === "Kindergarten") return 0;
  return value && /^(?:[1-9]|1[0-3])$/.test(value) ? Number(value) : null;
}

export class CleverSyncError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "CleverSyncError";
  }
}

/** Never let a failed/partial district read masquerade as an empty snapshot. */
export function validateSnapshot(
  snapshot: Snapshot,
  districtId: string,
): Snapshot {
  const district = districtSchema.parse(snapshot.district);
  if (district.id !== districtId)
    throw new CleverSyncError("district_mismatch");
  const result: Snapshot = {
    district,
    schools: snapshot.schools.map((x) => schoolSchema.parse(x)),
    users: snapshot.users
      .map((x) => userSchema.parse(x))
      .filter((x) => userRoles(x).some((role) => role !== "contact")),
    sections: snapshot.sections.map((x) => sectionSchema.parse(x)),
    courses: snapshot.courses.map((x) => courseSchema.parse(x)),
    terms: snapshot.terms.map((x) => termSchema.parse(x)),
  };
  for (const rows of [
    result.schools,
    result.users,
    result.sections,
    result.courses,
    result.terms,
  ]) {
    const ids = new Set<string>();
    for (const row of rows) {
      if (row.district !== districtId)
        throw new CleverSyncError("district_mismatch");
      if (ids.has(row.id)) throw new CleverSyncError("duplicate_source_record");
      ids.add(row.id);
    }
  }
  const schools = new Set(result.schools.map((x) => x.id));
  const users = new Map(result.users.map((x) => [x.id, x]));
  for (const section of result.sections) {
    if (!schools.has(section.school))
      throw new CleverSyncError("missing_section_school");
    for (const id of section.students) {
      if (!users.get(id)?.roles.student)
        throw new CleverSyncError("missing_section_student");
    }
    for (const id of new Set([
      ...(section.teachers ?? []),
      ...(section.teacher ? [section.teacher] : []),
    ])) {
      if (!users.get(id)?.roles.teacher)
        throw new CleverSyncError("missing_section_teacher");
    }
  }
  return result;
}
