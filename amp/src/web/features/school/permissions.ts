import type { OrgResource } from "../../../schools/contracts";

/** Whether "Add student" can succeed here: the org lets this person add
 * students, or they teach the class (any class, without one). A demo never
 * takes a real child, so it never offers to (docs/schools.md#demo-places),
 * and a family adds its children in Family, never here (docs/families.md). */
export function canAddStudents(
  org: Pick<OrgResource, "can" | "teaches" | "demo" | "kind"> | undefined,
  classId?: string,
): boolean {
  if (!org) return false;
  if (org.can?.includes("students.add")) return true;
  if (org.demo || org.kind === "family") return false;
  return classId
    ? (org.teaches?.includes(classId) ?? false)
    : (org.teaches?.length ?? 0) > 0;
}
