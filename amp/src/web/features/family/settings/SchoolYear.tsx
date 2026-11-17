import { SchoolYearSection } from "../../school-year/SchoolYearSection";
import type { FamilyPlace } from "../FamilyFrame";

/**
 * Settings › School year (the IA v2 spec, §3.4): the one School year
 * section, its dates, grading periods and the year bar, with one Edit. The
 * tutoring group's, read-only, when the family is in one.
 */
export function SchoolYearPart({ place }: { place: FamilyPlace }) {
  const { data, own } = place;
  if (!data || !own) return null;
  return (
    <SchoolYearSection
      org={own.org}
      classId={own.id}
      titleId="family-year"
      grading={data.children.some((child) => child.capabilities.readGrades)}
      setBy={data.teachingPlace ? "Your tutoring group" : undefined}
    />
  );
}
