/**
 * Practice time as a parent or teacher reads it, for a day or a week: the
 * minutes, or "<1 min" when there was real work (any answer) in less than a
 * minute, which rounds to 0 (R-20). Null only when nothing was done: a
 * week without practice reads `NO_PRACTICE_THIS_WEEK`, never "None". The
 * one place this is decided.
 */
export function practiceMinutes(
  minutes: number,
  problems: number,
): string | null {
  if (minutes >= 1) return `${Math.round(minutes)} min`;
  if (minutes > 0 || problems > 0) return "<1 min";
  return null;
}

/** A week with no practice yet, in the one wording every screen uses: a
 * quiet line in place of the week's minutes, never "None". */
export const NO_PRACTICE_THIS_WEEK = "No practice yet this week";
