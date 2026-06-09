// Registry seed for launch codes. Used by tests and by the deploy runbook's
// seed step (see IAP_DEPLOY_RUNBOOK.md). Each entry is the CODE#<code>/META item
// body (sans PK/SK). Cross-platform: LCCLT is the Apple custom offer code, the
// Play offer slug, AND the registry key, so the partner shares one string.

const LCCLT = {
  kind: "affiliate+offer", // discount AND revenue-share attribution
  partnerId: "language-learning-club",
  displayName: "Language Learning Club",
  discountLabel: "50% off first year",
  appleOfferId: "lcclt-50", // App Store Connect custom offer code reference name / offerIdentifier
  playOfferId: "annual-lcclt", // Play subscription offer id on the base plan
  playBasePlanId: "annual",
  revenueSharePct: 20,
  status: "active",
  validFrom: null,
  validTo: null,
  registryVersion: 1,
};

const PARTNER_LLC = {
  name: "Language Learning Club",
  payoutEmail: "partner@languagelearningclub.example",
  defaultRevenueSharePct: 20,
  status: "active",
};

// code -> META body
const CODES = {
  LCCLT,
};

// partnerId -> META body
const PARTNERS = {
  "language-learning-club": PARTNER_LLC,
};

module.exports = { CODES, PARTNERS, LCCLT, PARTNER_LLC };
