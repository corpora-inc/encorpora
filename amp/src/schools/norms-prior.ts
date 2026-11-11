/**
 * How spread out mathematics achievement is within one grade, in years of
 * typical growth, from public norms (amp/docs/engine/norms-prior.md): NWEA MAP
 * Growth 2020 student norms (Thum & Kuhfeld 2020) and the annual-gain
 * benchmarks of Bloom, Hill, Black & Lipsey (2008), rounded between the two.
 *
 * Two uses, both display only (the estimator's own prior is untouched):
 * the curve for a rostered student with no stored level at all, and the
 * typical national spread a group's curve is drawn against.
 */
const WITHIN_GRADE_SD = [
  0.7, // K
  0.8, // 1
  1.0, // 2
  1.1, // 3
  1.6, // 4
  1.9, // 5
  2.5, // 6
  2.9, // 7
  3.5, // 8
] as const;
/** Past grade 8 normed growth nearly stops, so "years" stretch without bound;
 * we stop at four. */
export const WITHIN_GRADE_SD_CAP = 4;

/** Within-grade sd in grades for a rostered grade (0 = K). Unknown grade: the
 * middle-school value, wide on purpose. */
export function withinGradeSd(grade: number | null): number {
  if (grade === null) return 2.5;
  const index = Math.max(0, Math.round(grade));
  return WITHIN_GRADE_SD[index] ?? WITHIN_GRADE_SD_CAP;
}
