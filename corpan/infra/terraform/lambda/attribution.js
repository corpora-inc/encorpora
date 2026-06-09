// ---------------------------------------------------------------------------
// Attribution orchestration — the brains behind /code/resolve, verify-purchase
// attribution, /entitlement-token, and renewal crediting.
// ---------------------------------------------------------------------------
//
// Every function takes an injected IapStore + signing secret so the whole flow
// is unit-testable with an in-memory fake (no AWS, no npm install). The lambda
// handler (verify_purchase.js) wires the real DynamoDB client + Secrets Manager
// secret into these.

const {
  normalizeCode,
  isCodeFormatValid,
  classifyCode,
  kindIsAffiliate,
} = require("./codes");
const {
  signResolutionToken,
  verifyResolutionToken,
  signEntitlementToken,
  DEFAULT_RESOLUTION_TTL_SEC,
} = require("./tokens");
const {
  extractAppleFields,
  appleOfferMatches,
  extractGoogleV2Fields,
  googleOfferMatches,
} = require("./receipts");

// --- /code/resolve --------------------------------------------------------

/**
 * Resolve a raw code into { status, code, kind, partnerName?, discountLabel?,
 * purchaseAction, resolutionToken?, expiresInSec }.
 *
 * NO FAIL-OPEN: a registry/store lookup ERROR throws (caller maps to an explicit
 * error status), never a fake "valid". Unknown (not in registry) codes are NOT
 * an error — they classify as kind:"affiliate", purchaseAction:"normal",
 * verified:false (free-text, unverified-but-credited).
 *
 * @param {IapStore} store
 * @param {string} signingSecret
 * @param {object} input { code, subjectId, platform, productId }
 */
async function resolveCode(store, signingSecret, input) {
  const { subjectId, platform } = input || {};
  const code = normalizeCode(input && input.code);

  if (!code) {
    return { status: "invalid", error: "Enter a code." };
  }
  if (!isCodeFormatValid(code)) {
    return {
      status: "invalid",
      code,
      error: "Use letters, numbers, dashes, or underscores.",
    };
  }
  if (!subjectId) {
    return { status: "invalid", code, error: "Missing subjectId." };
  }

  // Registry read. A THROW here is a real lookup failure → caller returns an
  // explicit { status: "error" } (never auto-promote to valid).
  const entry = await store.getCodeEntry(code);

  const descriptor = classifyCode(code, entry, platform);

  // Mint the short-lived signed resolutionToken binding {code, subjectId, kind}.
  const resolutionToken = signResolutionToken(signingSecret, {
    code,
    subjectId,
    kind: descriptor.kind,
    registryVersion: descriptor.registryVersion,
  });

  const out = {
    status: "ok",
    code,
    kind: descriptor.kind,
    verified: descriptor.verified,
    purchaseAction: descriptor.purchaseAction,
    resolutionToken,
    expiresInSec: DEFAULT_RESOLUTION_TTL_SEC,
  };
  if (descriptor.partnerName) out.partnerName = descriptor.partnerName;
  if (descriptor.discountLabel) out.discountLabel = descriptor.discountLabel;
  if (descriptor.offer) out.offer = descriptor.offer;
  if (descriptor.appleOfferId) out.appleOfferId = descriptor.appleOfferId;
  if (descriptor.appleRedeemUrl) out.appleRedeemUrl = descriptor.appleRedeemUrl;
  if (descriptor.inactiveKnown) out.inactiveKnown = true;
  return out;
}

// --- verify-purchase attribution write ------------------------------------

/**
 * After a receipt is verified, capture attribution: validate the resolutionToken,
 * idempotently record the purchase, lock first-verified-touch, write the initial
 * ledger credit, and store the token→subject reverse map for renewals.
 *
 * @param {IapStore} store
 * @param {string} signingSecret
 * @param {object} ctx {
 *   subjectId, platform, affiliateCode, resolutionToken,
 *   receiptFields, // normalized {transactionId, originalTransactionId, productId,
 *                  //  appAccountToken|obfuscatedExternalAccountId, offer*, price, currency}
 *   registryEntry, // already-fetched CODE# META (or null)
 *   offerApplied,  // bool: did the platform offer actually apply (from receipt)
 * }
 * @returns {object} affiliateAttribution descriptor (or undefined if no code)
 */
async function recordPurchaseAttribution(store, signingSecret, ctx) {
  const {
    subjectId,
    platform,
    affiliateCode,
    resolutionToken,
    receiptFields = {},
    registryEntry,
    offerApplied = false,
  } = ctx;

  if (!subjectId) return undefined;

  const code = normalizeCode(affiliateCode);

  // Idempotent purchase write keyed on the DECODED transaction id (never the
  // client-claimed one). Even with no code we record the purchase so renewals
  // can reverse-map and so replays are deduped.
  const txnId =
    receiptFields.transactionId || receiptFields.originalTransactionId;
  const accountKeys = buildAccountKeys(platform, receiptFields);

  const purchaseAttrs = {
    productId: receiptFields.productId || null,
    code: code || null,
    offerApplied: Boolean(offerApplied),
    offerType: receiptFields.offerType ?? null,
    offerIdentifier: receiptFields.offerIdentifier ?? null,
    price: receiptFields.price ?? null,
    currency: receiptFields.currency ?? null,
    environment: receiptFields.environment || null,
    ...accountKeys,
  };
  const purchaseRes = txnId
    ? await store.putPurchaseOnce(subjectId, platform, txnId, purchaseAttrs)
    : { written: false };

  if (!code) {
    // No code → no attribution write, but the purchase row + token map still
    // matter for renewal crediting of any PRE-EXISTING lock.
    await maybeWriteTokenMap(store, platform, subjectId, accountKeys, null, null);
    return undefined;
  }

  // Validate the resolutionToken (signature + exp + subject/code binding).
  // A missing/invalid token means we CANNOT trust the attribution → record it
  // as unverified (quarantined), never as a verified partner credit.
  let tokenOk = false;
  let tokenKind = null;
  if (resolutionToken) {
    const v = verifyResolutionToken(signingSecret, resolutionToken, {
      subjectId,
      code,
    });
    tokenOk = v.valid;
    if (v.valid) tokenKind = v.payload.kind;
  }

  // Verified partner attribution requires BOTH a valid token AND a registry
  // entry whose kind is an affiliate kind. Otherwise → unverified (free-text).
  const registryAffiliate =
    registryEntry && kindIsAffiliate(registryEntry.kind || "");
  const verified = Boolean(tokenOk && registryAffiliate);
  const partnerId = verified ? registryEntry.partnerId || null : null;
  const revenueSharePct = verified
    ? numericShare(registryEntry, await store.getPartner(partnerId))
    : null;

  // Lock first-verified-touch (never change a verified lock).
  const lockRes = await store.lockAttribution(subjectId, {
    code,
    partnerId,
    verified,
    accountKeys,
  });
  const effective = lockRes.attribution;

  // Reverse map for renewals (store on the winning attribution's partner).
  await maybeWriteTokenMap(
    store,
    platform,
    subjectId,
    accountKeys,
    effective.partnerId,
    effective.code
  );

  // Initial ledger credit — only for a VERIFIED partner AND only on a genuinely
  // new purchase (not a replay) AND only when THIS touch won/created the lock as
  // the verified partner. Unverified codes never enroll a payout.
  let ledgerEventId;
  const creditThisPartner =
    effective.status === "verified" &&
    effective.partnerId &&
    (verified || lockRes.changed);
  if (creditThisPartner && purchaseRes.written) {
    const credit = await store.creditLedgerOnce(effective.partnerId, {
      platform,
      txnId,
      subjectId,
      code: effective.code,
      productId: receiptFields.productId || null,
      price: receiptFields.price ?? null,
      currency: receiptFields.currency ?? null,
      kind: "initial",
      revenueSharePct,
      notificationType: "verify-purchase",
    });
    if (credit.credited) ledgerEventId = credit.eventId;
  }

  return {
    code: effective.code,
    partnerId: effective.partnerId,
    locked: true,
    verified: effective.status === "verified",
    discountApplied: Boolean(offerApplied),
    ledgerEventId,
    message: attributionMessage(effective),
  };
}

// --- renewal crediting (ASSN V2 / RTDN) -----------------------------------

/**
 * Credit a renewal to the LOCKED partner. Renewals carry no code/offer — we
 * reverse-map the account key to the subject/partner via the TOKEN# item (or
 * the SUBJECT#/ATTRIBUTION lock) and write a renewal ledger event exactly once.
 *
 * @param {IapStore} store
 * @param {object} ev {
 *   platform, txnId, accountKey, // appAccountToken | originalTransactionId | obfId
 *   productId, price, currency, notificationType, eventTimeMs
 * }
 */
async function creditRenewal(store, ev) {
  const { platform, txnId, accountKey } = ev;
  if (!txnId || !accountKey) return { credited: false, reason: "missing_keys" };

  let map = await store.getTokenMap(platform, accountKey);
  let subjectId = map && map.subjectId;
  let partnerId = map && map.partnerId;
  let code = map && map.code;

  // Fallback: if the account key IS the subjectId (Apple appAccountToken ==
  // subjectId), read the lock directly.
  if (!partnerId) {
    const lock = await store.getAttribution(accountKey);
    if (lock && lock.status === "verified") {
      subjectId = accountKey;
      partnerId = lock.partnerId;
      code = lock.code;
    }
  }

  if (!partnerId) return { credited: false, reason: "no_attribution" };

  const partner = await store.getPartner(partnerId);
  const revenueSharePct = partner ? partner.defaultRevenueSharePct ?? null : null;

  const credit = await store.creditLedgerOnce(partnerId, {
    platform,
    txnId,
    subjectId,
    code,
    productId: ev.productId || null,
    price: ev.price ?? null,
    currency: ev.currency || null,
    kind: "renewal",
    revenueSharePct,
    notificationType: ev.notificationType || "renewal",
    eventTimeMs: ev.eventTimeMs,
  });
  return credit;
}

// --- entitlement token ----------------------------------------------------

function issueEntitlementToken(signingSecret, { subjectId, plus, expiresAt }) {
  const token = signEntitlementToken(signingSecret, { subjectId, plus, expiresAt });
  return {
    status: "ok",
    subjectId,
    plus: Boolean(plus),
    expiresAt: expiresAt || null,
    entitlementToken: token,
  };
}

// --- helpers --------------------------------------------------------------

function buildAccountKeys(platform, fields) {
  const keys = {};
  if (platform === "ios" || platform === "macos") {
    if (fields.appAccountToken) keys.appAccountToken = fields.appAccountToken;
    if (fields.originalTransactionId)
      keys.originalTransactionId = fields.originalTransactionId;
  } else if (platform === "android") {
    if (fields.obfuscatedExternalAccountId)
      keys.obfuscatedExternalAccountId = fields.obfuscatedExternalAccountId;
  }
  return keys;
}

async function maybeWriteTokenMap(store, platform, subjectId, accountKeys, partnerId, code) {
  const key =
    accountKeys.appAccountToken ||
    accountKeys.originalTransactionId ||
    accountKeys.obfuscatedExternalAccountId;
  if (!key) return;
  await store.putTokenMap(platform, key, { subjectId, partnerId, code });
}

function numericShare(registryEntry, partner) {
  if (registryEntry && registryEntry.revenueSharePct != null) {
    return registryEntry.revenueSharePct;
  }
  if (partner && partner.defaultRevenueSharePct != null) {
    return partner.defaultRevenueSharePct;
  }
  return null;
}

function attributionMessage(attr) {
  if (attr.status === "verified") {
    return attr.partnerId
      ? `Credited to ${attr.partnerId}`
      : "Attribution recorded";
  }
  return "We'll record this code with your purchase.";
}

module.exports = {
  resolveCode,
  recordPurchaseAttribution,
  creditRenewal,
  issueEntitlementToken,
  // exported for tests:
  buildAccountKeys,
  attributionMessage,
};
