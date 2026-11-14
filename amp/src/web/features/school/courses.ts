/** A class's course: where its students' practice begins when a student has
 * no birth year (SPEC R14), and the grade its records name. "" is none:
 * each student's own grade. */
export const COURSE_OPTIONS: readonly (readonly [string, string])[] = [
  ["", "Each student’s own grade"],
  ["K", "Kindergarten"],
  ...Array.from(
    { length: 8 },
    (_, index) => [String(index + 1), `Grade ${index + 1}`] as const,
  ),
  ["algebra-1", "Algebra 1"],
  ["geometry", "Geometry"],
  ["algebra-2", "Algebra 2"],
  ["precalculus", "Precalculus"],
];

export const courseLabel = (bands: readonly string[]) =>
  bands.length
    ? bands
        .map(
          (band) =>
            COURSE_OPTIONS.find(([value]) => value === band)?.[1] ?? band,
        )
        .join(", ")
    : "Own grades";

/** The course a class's name says ("Grade 4 Math", "Algebra 1, period 3"),
 * or null when it says none. A suggestion only: the teacher's choice wins. */
export function courseFromName(name: string): string | null {
  const text = name.toLowerCase();
  const grade =
    /\b(?:grade|gr\.?)\s*(\d{1,2})\b|\b(\d)(?:st|nd|rd|th)\s+grade\b/.exec(
      text,
    );
  const number = grade ? Number(grade[1] ?? grade[2]) : NaN;
  if (number >= 1 && number <= 8) return String(number);
  if (/\bkinder/.test(text)) return "K";
  if (/\bpre-?calc/.test(text)) return "precalculus";
  if (/\balgebra\s*(?:2|ii)\b/.test(text)) return "algebra-2";
  if (/\balgebra(?:\s*(?:1|i))?\b/.test(text)) return "algebra-1";
  if (/\bgeometry\b/.test(text)) return "geometry";
  return null;
}
