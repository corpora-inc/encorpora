/** COPPA protects a "child": an individual under the age of 13
 * (16 CFR 312.2, https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312/section-312.2).
 * Nothing in COPPA reaches a learner aged 13 to 17, so parental consent, the
 * restricted (`name_pending`) basis and every consent step apply only to a
 * learner who may be under 13.
 *
 * AMP keeps a birth year, never a birth date. A learner born in the year that
 * turns 13 this year may still be 12 until their birthday, so that year is
 * read as possibly under 13: the only reading that never treats a 12-year-old
 * as outside COPPA. Every earlier year is 13 or older on every day of this
 * year. No birth year: possibly under 13. */
export const COPPA_CHILD_UNDER = 13;

export function pastCoppaAge(
  birthYear: number | null | undefined,
  thisYear = new Date().getUTCFullYear(),
): boolean {
  return birthYear != null && thisYear - birthYear - 1 >= COPPA_CHILD_UNDER;
}

/** The same rule in SQL, over a learner row's `birth_year` column. */
export const pastCoppaAgeSql = (column: string) =>
  `(${column} IS NOT NULL AND ${column} <= EXTRACT(YEAR FROM now() AT TIME ZONE 'UTC')::int - ${COPPA_CHILD_UNDER + 1})`;
