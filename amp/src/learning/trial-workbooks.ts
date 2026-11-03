/** Free workbooks during the free assessment: one for every
 * `TRIAL_WORKBOOK_EVERY` problems used, up to `TRIAL_WORKBOOKS_MAX`.
 * "Used" is the free meter's count (answers, and skips while
 * `SKIP_USES_FREE_PROBLEM` holds), so the meter and the unlocks agree. The
 * server enforces the count when a workbook is made; the screens read it to
 * offer only a workbook that will succeed. */
export const TRIAL_WORKBOOK_EVERY = 20;
export const TRIAL_WORKBOOKS_MAX = 5;

export type TrialWorkbookAllowance = {
  /** Workbooks this trial can earn in all, within its free problems. */
  total: number;
  earned: number;
  made: number;
  /** Earned and not yet made. */
  available: number;
  /** Problems used when the next one unlocks; null when none is left. */
  nextAt: number | null;
};

export function trialWorkbookAllowance(
  used: number,
  made: number,
  free: number,
): TrialWorkbookAllowance {
  const total = Math.min(
    TRIAL_WORKBOOKS_MAX,
    Math.floor(Math.max(0, free) / TRIAL_WORKBOOK_EVERY),
  );
  const earned = Math.min(
    total,
    Math.floor(Math.max(0, used) / TRIAL_WORKBOOK_EVERY),
  );
  return {
    total,
    earned,
    made,
    available: Math.max(0, earned - made),
    nextAt: earned < total ? (earned + 1) * TRIAL_WORKBOOK_EVERY : null,
  };
}

/** The workbook (1 to `total`) that this many problems used unlocks, or
 * null when this count unlocks none. */
export function unlockedTrialWorkbook(
  used: number,
  free: number,
): number | null {
  if (used <= 0 || used % TRIAL_WORKBOOK_EVERY !== 0) return null;
  const slot = used / TRIAL_WORKBOOK_EVERY;
  return slot <= trialWorkbookAllowance(used, 0, free).total ? slot : null;
}
