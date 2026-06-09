// Fixtures for tests: Apple JWS payloads (with/without appAccountToken + offer
// fields) and Google subscriptionsv2 payloads (with offer details + obfuscated
// account id). These are unsigned base64url JWS bodies — the decode path only
// reads the payload segment (the lambda trusts Apple's authenticated API
// response over HTTPS; see verify_purchase.js comment).

function jwsFromPayload(payload, header = { alg: "ES256", x5c: ["fake"] }) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64(header)}.${b64(payload)}.${Buffer.from("sig").toString("base64url")}`;
}

const SUBJECT_ID = "11111111-2222-3333-4444-555555555555";
// sha256 of SUBJECT_ID (what the Android client sends as obfuscatedAccountId).
const crypto = require("crypto");
const OBF_ACCOUNT_ID = crypto.createHash("sha256").update(SUBJECT_ID).digest("hex");

// Apple initial transaction WITH appAccountToken + offer-code fields.
const appleInitialWithOffer = {
  transactionId: "2000000111111111",
  originalTransactionId: "2000000111111111",
  productId: "corpan.sub.annual",
  type: "Auto-Renewable Subscription",
  environment: "Sandbox",
  expiresDate: Date.now() + 365 * 24 * 3600 * 1000,
  appAccountToken: SUBJECT_ID,
  offerType: 3, // subscription offer code
  offerIdentifier: "lcclt-50",
  offerDiscountType: "PAY_UP_FRONT",
  price: 29990, // milliunits
  currency: "USD",
};

// Apple renewal — NO offer fields (Apple never re-states the offer on renewal),
// but appAccountToken + originalTransactionId persist.
const appleRenewalNoOffer = {
  transactionId: "2000000222222222",
  originalTransactionId: "2000000111111111",
  productId: "corpan.sub.annual",
  type: "Auto-Renewable Subscription",
  environment: "Sandbox",
  expiresDate: Date.now() + 2 * 365 * 24 * 3600 * 1000,
  appAccountToken: SUBJECT_ID,
  price: 59990,
  currency: "USD",
};

// Apple initial WITHOUT appAccountToken or offer (plain full-price buy).
const appleInitialPlain = {
  transactionId: "2000000333333333",
  originalTransactionId: "2000000333333333",
  productId: "corpan.sub.annual",
  type: "Auto-Renewable Subscription",
  environment: "Sandbox",
  expiresDate: Date.now() + 365 * 24 * 3600 * 1000,
};

// Apple ASSN V2 DID_RENEW notification (signedPayload).
function appleDidRenewNotification() {
  return jwsFromPayload({
    notificationType: "DID_RENEW",
    subtype: "",
    notificationUUID: "uuid-renew-1",
    signedDate: Date.now(),
    data: {
      signedTransactionInfo: jwsFromPayload(appleRenewalNoOffer),
    },
  });
}

// Google subscriptionsv2.get WITH offer details + obfuscated account id.
const googleV2WithOffer = {
  subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
  latestOrderId: "GPA.0000-1111-2222-33333",
  externalAccountIdentifiers: {
    obfuscatedExternalAccountId: OBF_ACCOUNT_ID,
    externalAccountId: null,
  },
  acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
  lineItems: [
    {
      productId: "corpan.sub.annual",
      expiryTime: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
      offerDetails: {
        basePlanId: "annual",
        offerId: "annual-lcclt",
        offerTags: ["lcclt"],
      },
    },
  ],
};

// Google subscriptionsv2.get WITHOUT offer (full price) but with account id.
const googleV2NoOffer = {
  subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
  latestOrderId: "GPA.4444-5555-6666-77777",
  externalAccountIdentifiers: {
    obfuscatedExternalAccountId: OBF_ACCOUNT_ID,
  },
  acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
  lineItems: [
    {
      productId: "corpan.sub.annual",
      expiryTime: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
      offerDetails: { basePlanId: "annual" },
    },
  ],
};

module.exports = {
  jwsFromPayload,
  SUBJECT_ID,
  OBF_ACCOUNT_ID,
  appleInitialWithOffer,
  appleRenewalNoOffer,
  appleInitialPlain,
  appleDidRenewNotification,
  googleV2WithOffer,
  googleV2NoOffer,
};
