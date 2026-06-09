// ---------------------------------------------------------------------------
// Receipt field extraction — Apple JWS + Google subscriptionsv2 mapping
// ---------------------------------------------------------------------------
//
// Pure decode/normalize helpers (no AWS / network) so the field plumbing is
// unit-testable against canned fixtures. The actual API CALLS (getTransactionInfo
// / subscriptionsv2.get) live in verify_purchase.js; these functions take the
// already-fetched payload and pull the attribution/offer fields out of it.

// --- Apple ----------------------------------------------------------------

/** Decode a JWS (header.payload.sig) and return the payload object. */
function decodeJws(jws) {
  if (typeof jws !== "string") throw new Error("JWS not a string");
  const parts = jws.split(".");
  if (parts.length !== 3) throw new Error("JWS must have 3 parts");
  return JSON.parse(Buffer.from(parts[1], "base64url").toString());
}

/**
 * Extract the attribution + offer fields we care about from a decoded Apple
 * transaction-info payload. Offer fields are present ONLY on the initial
 * transaction (never on renewals) — that is expected; renewal attribution rides
 * on appAccountToken + our ledger.
 *
 * @param {object} decoded  decoded JWS payload (signedTransactionInfo)
 */
function extractAppleFields(decoded) {
  if (!decoded) return {};
  return {
    transactionId: decoded.transactionId,
    originalTransactionId: decoded.originalTransactionId,
    productId: decoded.productId,
    type: decoded.type,
    environment: decoded.environment,
    expiresDate: decoded.expiresDate
      ? new Date(decoded.expiresDate).toISOString()
      : null,
    // Attribution / account binding (persists across renewals):
    appAccountToken: decoded.appAccountToken || null,
    // Offer fields (initial transaction only):
    offerType: decoded.offerType ?? null, // 1=intro 2=promo 3=offer code 4=win-back
    offerIdentifier: decoded.offerIdentifier || decoded.offerId || null,
    offerDiscountType: decoded.offerDiscountType || null, // FREE_TRIAL/PAY_AS_YOU_GO/PAY_UP_FRONT
    // Price (Apple gives milliunits + currency on StoreKit2 payloads):
    price: decoded.price ?? null,
    currency: decoded.currency || null,
  };
}

/** Did an Apple offer actually apply, and does it match the registry entry? */
function appleOfferMatches(fields, registryEntry) {
  if (!fields || fields.offerType == null) return { applied: false, matches: false };
  const applied = true;
  if (!registryEntry || !registryEntry.appleOfferId) {
    return { applied, matches: false };
  }
  return {
    applied,
    matches: fields.offerIdentifier === registryEntry.appleOfferId,
  };
}

// --- Google (subscriptionsv2.get) -----------------------------------------

/**
 * Normalize a purchases.subscriptionsv2.get response into the fields we need:
 * obfuscated external account id, line items + offer details, price.
 *
 * Gracefully tolerates v1-shaped fallback data (no lineItems / no
 * externalAccountIdentifiers) — returns nulls for the v2-only fields.
 *
 * @param {object} data  the `.data` of the v2 response (or a v1 fallback)
 */
function extractGoogleV2Fields(data) {
  if (!data) return {};
  const lineItems = Array.isArray(data.lineItems) ? data.lineItems : [];
  const first = lineItems[0] || {};
  const offerDetails = first.offerDetails || {};

  // v2 nests state differently than v1; surface both for the caller.
  const ext = data.externalAccountIdentifiers || {};

  return {
    // Account binding — the client sends sha256Hex(subjectId) as
    // obfuscatedAccountId; Google echoes it here so renewals can reverse-map.
    obfuscatedExternalAccountId: ext.obfuscatedExternalAccountId || null,
    externalAccountId: ext.externalAccountId || null,
    // Subscription state (v2):
    subscriptionState: data.subscriptionState || null,
    expiresAt: first.expiryTime || data.expiryTime || null,
    // Offer details:
    productId: first.productId || data.productId || null,
    basePlanId: offerDetails.basePlanId || null,
    offerId: offerDetails.offerId || null,
    offerTags: offerDetails.offerTags || null,
    // Order / linked token for renewals:
    latestOrderId: data.latestOrderId || null,
    linkedPurchaseToken: data.linkedPurchaseToken || null,
  };
}

/** Map a v2 subscriptionState string to active/grace booleans. */
function googleV2Active(fields) {
  const s = fields && fields.subscriptionState;
  return {
    active:
      s === "SUBSCRIPTION_STATE_ACTIVE" ||
      s === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
    inGrace: s === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
  };
}

/** Did the Google offer match the registry entry? */
function googleOfferMatches(fields, registryEntry) {
  if (!fields || !fields.offerId) return { applied: false, matches: false };
  const applied = true;
  if (!registryEntry || !registryEntry.playOfferId) {
    return { applied, matches: false };
  }
  return { applied, matches: fields.offerId === registryEntry.playOfferId };
}

module.exports = {
  decodeJws,
  extractAppleFields,
  appleOfferMatches,
  extractGoogleV2Fields,
  googleV2Active,
  googleOfferMatches,
};
