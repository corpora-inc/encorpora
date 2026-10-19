/**
 * The retention periods AMP enforces. The retention schedule in
 * docs/parent-consent.md and the deployment consent notice cite these names;
 * change them only together with that text.
 * Consent-evidence periods (pendingContactDays, withdrawnEvidenceDays) are
 * part of the reviewed deployment policy and are enforced from that policy.
 */
export const RETENTION = {
  /** Learner profile and learning records: months after the later of the
   * learner's last practice activity and the scheduled end of the family's
   * latest licence or entitlement. */
  learnerInactivityMonths: 24,
  /** Unsaved anonymous trials, from their start. */
  unsavedTrialDays: 14,
  /** Trial milestone events and trial records (saved or not), from creation. */
  trialRecordDays: 90,
  /** Orders, payments, refunds, licences and entitlements, from the later of
   * the last transaction and the end of the licence period it bought. */
  financialRecordYears: 7,
  /** Offline packs and their offline answers, after the pack expires. */
  offlinePackDaysAfterExpiry: 30,
  /** Privacy activity log. */
  privacyAuditDays: 90,
} as const;

/** Each run deletes at most batchSize × maxBatches rows or units per category. */
export const RETENTION_BATCH = { batchSize: 200, maxBatches: 50 } as const;
