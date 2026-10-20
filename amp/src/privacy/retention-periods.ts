/**
 * The retention periods AMP enforces. The retention schedule in
 * docs/parent-consent.md and the deployment consent notice cite these names;
 * change them only together with that text.
 * Consent-evidence periods (pendingContactDays, withdrawnEvidenceDays) are
 * part of the reviewed deployment policy and are enforced from that policy.
 */
export const RETENTION = {
  /** Learner profile and learning records: months after the latest of the
   * learner's last practice, the family's last purchase activity and the
   * scheduled end of the family's latest licence or entitlement. */
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
  /** Funnel analytics events, from when they occurred, and visitor records,
   * from their last event. A converted visitor's events leave only monthly
   * aggregate counts with no visitor ID. */
  funnelEventDays: 90,
  /** Notes on "Report a problem" reports, from when they were sent. */
  problemFlagNoteDays: 90,
  /** "Report a problem" reports, from when they were sent. Deleting a
   * learner's learning data unlinks their reports and erases the notes. */
  problemFlagDays: 365,
  /** Privacy activity log. */
  privacyAuditDays: 90,
} as const;

/** Each run deletes at most batchSize × maxBatches rows or units per category. */
export const RETENTION_BATCH = { batchSize: 200, maxBatches: 50 } as const;
