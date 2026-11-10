import { z } from "zod";

/* What a child is called in AMP (docs/parent-consent.md#childrens-names).
   - A parent names their own children: a first name or nickname, entered by
     the parent, never collected from the child. The basis is recorded on the
     learner (`PARENT_ENTRY`).
   - A tutor gives a student from another family a nickname or initials; the
     student's own parent names them through the approval link.
   Neither takes contact details. Without a name, a child goes by their number
   in the family or class: "Child 2", "Student 3". */

export const CHILD_NAME_MAX = 30;
export const NICKNAME_MAX = 20;
export const NICKNAME_HINT = "A nickname or initials is enough.";
/** The quiet line beside a parent's add step, and its version as recorded. */
export const PARENT_ENTRY_LINE =
  "You’re adding your own children as their parent or guardian.";
export const PARENT_ENTRY = {
  method: "parent_entry",
  version: "2026-11-10",
} as const;

/** Why a name can't be used, in words for the field; null when it can.
 * Blank is the caller's call: creation allows it. */
export function childNameProblem(
  raw: string,
  max: number = CHILD_NAME_MAX,
): string | null {
  const value = raw.trim();
  if (value.length > max) return `Use ${max} characters or fewer.`;
  if (/[\u0000-\u001f\u007f<>]/.test(value))
    return "Use letters, numbers and spaces.";
  if (value.includes("@")) return "Use a name, not an email address.";
  if ((value.match(/\d/g) ?? []).length >= 7)
    return "Use a name, not a phone number.";
  return null;
}

const named = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .superRefine((value, context) => {
      const problem = childNameProblem(value, max);
      if (problem) context.addIssue({ code: "custom", message: problem });
    });
/** A parent's name for their own child: 1–30 characters, no contact details. */
export const childNameSchema = named(CHILD_NAME_MAX);
/** A tutor's nickname or initials for a student: 1–20 characters. */
export const nicknameSchema = named(NICKNAME_MAX);

/** Optional at creation: blank or absent leaves the number label. */
const optional = (schema: ReturnType<typeof named>) =>
  z
    .string()
    .trim()
    .transform((value) => value || undefined)
    .pipe(schema.optional())
    .optional();
export const optionalChildName = optional(childNameSchema);
export const optionalNickname = optional(nicknameSchema);

/** Who a scope counts: a family's children, or a school's (a tutor's class's)
 * students. */
export type LabelScope = `family:${string}` | `school:${string}`;

/** The neutral name a child goes by with no name: their number in the family
 * ("Child 2") or the class's school ("Student 3"). */
export const numberedName = (scope: string, number: number) =>
  `${scope.startsWith("school:") ? "Student" : "Child"} ${number}`;

/** Whether the learner goes by their number rather than a name. */
export const goesByNumber = (row: {
  name: string;
  identity_scope?: string | null;
  label_number?: number | null;
}) =>
  !!row.identity_scope &&
  row.label_number != null &&
  row.name === numberedName(row.identity_scope, row.label_number);
