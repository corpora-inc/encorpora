/** Numbers on the standing screens: signed tenths with a true minus, and an
 * interval said the one clinical way, "+0.3 (−0.1 to +0.7)". */
export function signed(value: number, digits = 1) {
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0) return (0).toFixed(digits);
  return rounded > 0
    ? `+${rounded.toFixed(digits)}`
    : `−${Math.abs(rounded).toFixed(digits)}`;
}
export const plain = (value: number, digits = 1) =>
  value.toFixed(digits).replace("-", "−");
export const withInterval = (value: {
  median: number;
  low: number;
  high: number;
}) =>
  `${signed(value.median)} (${signed(value.low)} to ${signed(value.high)})`;
export const intervalWords = (value: { low: number; high: number }) =>
  `${signed(value.low)} to ${signed(value.high)}`;

/** A grade's short name: K, 1 … 12. */
export const gradeName = (grade: number) =>
  grade < 0 ? "Pre-K" : grade === 0 ? "K" : String(grade);
export const gradesWords = (grades: readonly number[]) =>
  grades.length === 0
    ? ""
    : grades.length === 1
      ? grades[0] === 0
        ? "Kindergarten"
        : `Grade ${gradeName(grades[0]!)}`
      : `Grades ${gradeName(grades[0]!)}–${gradeName(grades.at(-1)!)}`;

export const students = (count: number) =>
  `${count.toLocaleString("en-US")} ${count === 1 ? "student" : "students"}`;
