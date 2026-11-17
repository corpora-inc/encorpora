import { minutesFigure } from "../../schools/practice-rules";

/**
 * Practice time as a parent or teacher reads it, for a day or a week: the
 * minutes, or "<1 min" when there was real work (any answer) in less than a
 * minute, which rounds to 0 (R-20). Null only when nothing was done, for
 * the screen's own "None" or "Not started". The one place this is decided.
 */
export function practiceMinutes(
  minutes: number,
  problems: number,
): string | null {
  if (minutes > 0) return `${minutesFigure(minutes)} min`;
  if (problems > 0) return "<1 min";
  return null;
}
