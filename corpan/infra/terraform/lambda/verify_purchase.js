const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const { getSignedUrl } = require("@aws-sdk/cloudfront-signer");
const { AppStoreServerAPIClient, Environment, SignedDataVerifier, VerificationStatus } = require("@apple/app-store-server-library");
const { google } = require("googleapis");
const codes = require("./codes");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Echo the request Origin so WKWebView accepts CORS for opaque/null origins.
// WebKit rejects Access-Control-Allow-Origin: * when Origin is "null" (custom
// URI schemes like corpan-pack://). Echoing the exact origin satisfies both
// WKWebView and the Fetch spec. Vary: Origin ensures caches don't mix responses.
let _requestOrigin = "*";
const setRequestOrigin = (event) => {
  _requestOrigin = event.headers?.origin ?? event.headers?.Origin ?? "*";
};

const json = (statusCode, payload) => ({
  statusCode,
  headers: {
    "content-type": "application/json",
    "access-control-allow-origin": _requestOrigin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type, x-dev-bypass",
    "vary": "Origin",
  },
  body: JSON.stringify(payload),
});

// Convert a Google Play `Money` ({units, nanos, currencyCode}) to a decimal
// number. units = whole currency units, nanos = billionths of a unit (can be
// negative). Returns null for absent input. Rounded to 6dp to kill float noise.
const moneyToNumber = (m) => {
  if (!m || (m.units == null && m.nanos == null)) return null;
  const v = Number(m.units || 0) + Number(m.nanos || 0) / 1e9;
  return Math.round(v * 1e6) / 1e6;
};

// Apple records `price` in milliunits (e.g. 4990 = $4.99). Normalize to a
// decimal number so the ledger stores comparable amounts across stores.
const milliunitsToNumber = (p) => (p == null ? null : Number(p) / 1000);

// Pick the Google product type for verification. A subscription token MUST be
// verified via subscriptionsv2; using the products endpoint yields Google's
// "The document type is not supported" (the bug that dropped every Android
// sub). Honor an explicit client value; else infer from the `*.sub.*` id
// convention; default to "subs" (per-book one-time IAP is retired).
const googleProductTypeFor = (productId, explicit) => {
  if (explicit) return explicit;
  if (typeof productId === "string" && !productId.includes(".sub.")) return "inapp";
  return "subs";
};

// Map an Apple ASSN V2 notificationType to a lifecycle action. "initial" =
// new paid sub (attribute offer + extend), "renewal" = credit renewal + extend,
// "extend" = refresh entitlement from authoritative state, "clawback" = reverse
// credit on refund/revoke, "reinstate" = refund reversed, "ignore" = no-op.
const appleNotificationAction = (t) =>
  ({
    SUBSCRIBED: "initial",
    OFFER_REDEEMED: "initial",
    DID_RENEW: "renewal",
    DID_FAIL_TO_RENEW: "extend",
    GRACE_PERIOD_EXPIRED: "extend",
    EXPIRED: "extend",
    REFUND: "clawback",
    REVOKE: "clawback",
    REFUND_REVERSED: "reinstate",
  })[t] || "ignore";

// Map a Google RTDN subscriptionNotification.notificationType (int) to an
// action. Ints per developer.android.com/google/play/billing/rtdn-reference.
const googleNotificationAction = (t) =>
  ({
    4: "initial", // SUBSCRIPTION_PURCHASED
    2: "renewal", // SUBSCRIPTION_RENEWED
    1: "extend", // SUBSCRIPTION_RECOVERED
    7: "extend", // SUBSCRIPTION_RESTARTED
    3: "extend", // SUBSCRIPTION_CANCELED (entitled until expiry)
    5: "extend", // SUBSCRIPTION_ON_HOLD
    6: "extend", // SUBSCRIPTION_IN_GRACE_PERIOD
    10: "extend", // SUBSCRIPTION_PAUSED
    13: "extend", // SUBSCRIPTION_EXPIRED
    12: "clawback", // SUBSCRIPTION_REVOKED
  })[t] || "ignore";

// Exported for unit tests (pure helpers, no I/O).
exports.moneyToNumber = moneyToNumber;
exports.milliunitsToNumber = milliunitsToNumber;
exports.googleProductTypeFor = googleProductTypeFor;
exports.appleNotificationAction = appleNotificationAction;
exports.googleNotificationAction = googleNotificationAction;
// Notification route handlers + a test seam for the Apple JWS verify step.
exports.handleAppleNotification = handleAppleNotification;
exports.handleGoogleNotification = handleGoogleNotification;
exports.handleVerifyPurchase = handleVerifyPurchase;
exports._setAppleVerifyForTest = _setAppleVerifyForTest;
exports._setCatalogFetchForTest = _setCatalogFetchForTest;
exports._setVerifyForTest = _setVerifyForTest;

const getHeader = (event, key) => {
  const headers = event.headers || {};
  const match = Object.keys(headers).find(
    (name) => name.toLowerCase() === key.toLowerCase()
  );
  return match ? headers[match] : undefined;
};

const getRoute = (event) => {
  const routeKey = event.routeKey || "";
  const parts = routeKey.split(" ");
  return parts.length === 2 ? parts[1] : routeKey;
};

// ---------------------------------------------------------------------------
// Secrets cache (cold start optimization)
// ---------------------------------------------------------------------------

let cachedSecrets = null;
const smClient = new SecretsManagerClient({});

async function getSecrets() {
  if (cachedSecrets) return cachedSecrets;
  const cmd = new GetSecretValueCommand({ SecretId: process.env.SECRETS_ARN });
  const result = await smClient.send(cmd);
  cachedSecrets = JSON.parse(result.SecretString);
  return cachedSecrets;
}

// ---------------------------------------------------------------------------
// CloudFront signed URL generation
// ---------------------------------------------------------------------------

function generateSignedDownloadUrl(packDownloadPath, signingPrivateKey) {
  const cfDomain = process.env.CLOUDFRONT_DOMAIN;
  const keyPairId = process.env.CLOUDFRONT_KEY_PAIR_ID;

  if (!cfDomain || !keyPairId || !signingPrivateKey) {
    throw new Error("CloudFront signing not configured");
  }

  const url = `https://${cfDomain}/${packDownloadPath}`;
  const expires = new Date(Date.now() + 3600 * 1000); // 1 hour

  return getSignedUrl({
    url,
    keyPairId,
    privateKey: signingPrivateKey,
    dateLessThan: expires.toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Catalog (product → premium-ZIP binding)
// ---------------------------------------------------------------------------
//
// The public catalog is the source of truth that binds a one-time book product
// (corpan.book.*) to BOTH the narration packId and the exact premium ZIP path.
// We use it to enforce that a verified one-time receipt may only sign the ZIP it
// actually paid for (see handleVerifyPurchase). Fetch is cached in the warm
// container; a `_setCatalogFetchForTest` seam lets tests inject a fixture so the
// suite makes no real network calls. FAIL CLOSED: if the catalog can't be
// fetched (or the pack/product doesn't match) we deny signing.

const CATALOG_URL = "https://d38iwc9748jekz.cloudfront.net/catalog-v2.json";
const CATALOG_TTL_MS = 10 * 60 * 1000; // 10 min — premium paths rarely change
const CATALOG_TIMEOUT_MS = 4000;

let _catalogCache = null; // { fetchedAt, narrations: [...] }

// Default catalog fetcher (Node 18+/22 global fetch + AbortController timeout).
async function _defaultCatalogFetch() {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), CATALOG_TIMEOUT_MS);
  try {
    const res = await fetch(CATALOG_URL, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`catalog HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

let _catalogFetch = _defaultCatalogFetch;
function _setCatalogFetchForTest(fn) {
  _catalogFetch = fn || _defaultCatalogFetch;
  _catalogCache = null; // drop any warm cache so the injected fixture is used
}

// Return the catalog narrations array (cached). Returns null on any failure —
// callers MUST fail closed (deny signing) when this is null.
async function getCatalogNarrations() {
  const now = Date.now();
  if (_catalogCache && now - _catalogCache.fetchedAt < CATALOG_TTL_MS) {
    return _catalogCache.narrations;
  }
  try {
    const data = await _catalogFetch();
    const narrations = Array.isArray(data?.narrations) ? data.narrations : [];
    _catalogCache = { fetchedAt: now, narrations };
    return narrations;
  } catch (err) {
    console.error("[catalog] fetch failed (fail-closed for one-time downloads):", err.message);
    // If we have a stale cache, prefer it over denying (still authoritative
    // enough for a path/product binding — paths only change on a version bump).
    if (_catalogCache) return _catalogCache.narrations;
    return null;
  }
}

// Normalize a catalog full.url (absolute) to the path we compare against the
// client downloadPath (no leading slash, no scheme/host).
function _pathOf(urlOrPath) {
  if (typeof urlOrPath !== "string" || !urlOrPath) return null;
  try {
    return new URL(urlOrPath).pathname.replace(/^\/+/, "");
  } catch {
    return urlOrPath.replace(/^\/+/, "");
  }
}

// Bind a verified one-time product to the requested pack + download path via the
// catalog. Returns { ok:true } only if the narration identified by `packId`
// (a) has purchase.productId === verifiedProductId AND (b) its premium full.url
// path equals the requested downloadPath. Fail closed on any miss / no catalog.
async function bindOneTimeDownload({ packId, verifiedProductId, downloadPath }) {
  if (!verifiedProductId) return { ok: false, reason: "no verified product" };
  const narrations = await getCatalogNarrations();
  if (!narrations) return { ok: false, reason: "catalog unavailable" };

  // Prefer matching by packId (the narration id the client sends); also accept a
  // match by the requested downloadPath if packId is absent/ambiguous.
  let n = packId ? narrations.find((x) => x && x.id === packId) : null;
  if (!n && downloadPath) {
    n = narrations.find((x) => x && _pathOf(x.full?.url) === downloadPath);
  }
  if (!n) return { ok: false, reason: "pack not in catalog" };

  const pid = n.purchase?.productId || null;
  if (!pid || pid !== verifiedProductId) {
    return { ok: false, reason: `product mismatch (catalog=${pid} verified=${verifiedProductId})` };
  }

  // The requested path must be THIS narration's premium full ZIP.
  const fullPath = _pathOf(n.full?.url);
  if (!fullPath) return { ok: false, reason: "no premium ZIP for pack" };
  if (downloadPath && downloadPath !== fullPath) {
    return { ok: false, reason: "downloadPath does not match purchased pack" };
  }
  return { ok: true, downloadPath: fullPath };
}

// ---------------------------------------------------------------------------
// Apple receipt verification (App Store Server API v2 / StoreKit 2)
// ---------------------------------------------------------------------------

async function verifyApple(body, secrets) {
  const { transactionId, receipt } = body;
  const appleSecrets = secrets.apple;

  if (!appleSecrets.key_id || !appleSecrets.issuer_id || !appleSecrets.privateKey) {
    return { verified: false, error: "Apple credentials not configured" };
  }

  // Always try both PRODUCTION and SANDBOX. TestFlight receipts live in
  // SANDBOX regardless of how the Lambda is deployed; App Store receipts
  // live in PRODUCTION. We try both because Apple's error messages are
  // inconsistent (sometimes empty) and guessing from the error text is
  // fragile. The cost is one extra API call for the wrong environment.
  let lastError = null;
  for (const environment of [Environment.PRODUCTION, Environment.SANDBOX]) {
    const envName = environment === Environment.PRODUCTION ? "PRODUCTION" : "SANDBOX";
    const result = await tryVerifyAppleWith(body, appleSecrets, environment);
    if (result.verified) {
      console.log(`[apple] Verified in ${envName}: txn=${result.transactionId}`);
      return result;
    }
    console.log(`[apple] ${envName} failed: ${result.error || "(empty error)"}`);
    lastError = result.error;
  }
  return { verified: false, error: lastError || "Apple verification failed in both production and sandbox" };
}

async function tryVerifyAppleWith(body, appleSecrets, environment) {
  const { transactionId } = body;
  const bundleId = appleSecrets.bundleId || "com.corpora.corpan";

  try {
    const client = new AppStoreServerAPIClient(
      appleSecrets.privateKey,
      appleSecrets.key_id,
      appleSecrets.issuer_id,
      bundleId,
      environment
    );

    // Get transaction info from Apple's App Store Server API.
    // This call is authenticated with our API key — Apple validates the
    // transaction server-side and returns a signed JWS response over HTTPS.
    const txInfo = await client.getTransactionInfo(transactionId);

    if (!txInfo || !txInfo.signedTransactionInfo) {
      return { verified: false, error: "Transaction not found" };
    }

    // Decode the JWS payload directly. We trust Apple's API response
    // (authenticated + HTTPS) without re-verifying the certificate chain
    // locally, which would require bundling Apple root certificates.
    const jws = txInfo.signedTransactionInfo;
    const payloadPart = jws.split(".")[1];
    const decoded = JSON.parse(Buffer.from(payloadPart, "base64url").toString());

    console.log(`[apple] Decoded transaction: productId=${decoded.productId}, type=${decoded.type}, env=${decoded.environment}, txn=${decoded.transactionId}`);

    const isSubscription = decoded.type === "Auto-Renewable Subscription";
    const subscriptionActive = isSubscription && decoded.expiresDate
      ? new Date(decoded.expiresDate) > new Date()
      : false;

    return {
      verified: true,
      transactionId: decoded.transactionId,
      originalTransactionId: decoded.originalTransactionId,
      productId: decoded.productId,
      isSubscription,
      subscriptionActive,
      expiresAt: decoded.expiresDate
        ? new Date(decoded.expiresDate).toISOString()
        : null,
      environment: decoded.environment || (environment === Environment.PRODUCTION ? "Production" : "Sandbox"),
      // §5.2 — offer/attribution fields decoded from the signed JWS.
      appAccountToken: decoded.appAccountToken ?? null,
      offerType: decoded.offerType ?? null,
      offerIdentifier: decoded.offerIdentifier ?? null,
      offerDiscountType: decoded.offerDiscountType ?? null,
      // Apple `price` is milliunits (4990 = $4.99); normalize to a decimal so
      // the ledger stores comparable amounts across stores.
      price: milliunitsToNumber(decoded.price),
      currency: decoded.currency ?? null,
      // TestFlight / Xcode purchases verify in the Sandbox environment; flag so
      // the caller can exclude them from revenue/affiliate crediting.
      isTestPurchase: (decoded.environment || "") === "Sandbox",
    };
  } catch (err) {
    const errDetail = err.message || err.errorMessage || err.toString();
    const errDump = JSON.stringify({ message: err.message, errorMessage: err.errorMessage, httpStatusCode: err.httpStatusCode, apiError: err.apiError, status: err.status, cause: err.cause, name: err.name, stack: err.stack?.split("\n").slice(0, 3).join(" | ") });
    console.error(`[apple] Verification error (${environment === Environment.PRODUCTION ? "PRODUCTION" : "SANDBOX"}):`, errDump);
    return { verified: false, error: `Apple verification failed: ${errDetail}` };
  }
}

// ---------------------------------------------------------------------------
// Google receipt verification (Play Developer API)
// ---------------------------------------------------------------------------

async function verifyGoogle(body, secrets) {
  const { productId, purchaseToken, productType } = body;
  const googleSecrets = secrets.google;

  if (!googleSecrets.serviceAccountJson) {
    return { verified: false, error: "Google credentials not configured" };
  }

  const packageName = googleSecrets.packageName || "com.corpora.corpan";

  try {
    const serviceAccount = typeof googleSecrets.serviceAccountJson === "string"
      ? JSON.parse(googleSecrets.serviceAccountJson)
      : googleSecrets.serviceAccountJson;

    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ["https://www.googleapis.com/auth/androidpublisher"],
    });

    const androidPublisher = google.androidpublisher({ version: "v3", auth });

    if (productType === "subs") {
      // §5.3 — Subscription verification via subscriptionsv2.get (was v1
      // purchases.subscriptions.get). v2 exposes obfuscatedExternalAccountId
      // (for renewal reverse-map) and per-line-item offer details.
      const res = await androidPublisher.purchases.subscriptionsv2.get({
        packageName,
        token: purchaseToken,
      });

      const sub = res.data;
      const now = Date.now();

      // v2: state on the subscription; expiry on each line item.
      const lineItems = Array.isArray(sub.lineItems) ? sub.lineItems : [];
      // Pick the latest expiry across line items.
      let expiryMs = 0;
      let lineProductId = null;
      let offerId = null;
      let offerTags = [];
      let renewalMoney = null;
      let lineOrderId = null;
      for (const li of lineItems) {
        const exp = li.expiryTime ? Date.parse(li.expiryTime) : 0;
        if (exp > expiryMs) expiryMs = exp;
        if (!lineProductId && li.productId) lineProductId = li.productId;
        const od = li.offerDetails || {};
        if (!offerId && od.offerId) offerId = od.offerId;
        if (od.offerTags && od.offerTags.length) offerTags = od.offerTags;
        if (!renewalMoney && li.autoRenewingPlan?.recurringPrice)
          renewalMoney = li.autoRenewingPlan.recurringPrice;
        if (!lineOrderId && li.latestSuccessfulOrderId)
          lineOrderId = li.latestSuccessfulOrderId;
      }

      const state = sub.subscriptionState; // e.g. SUBSCRIPTION_STATE_ACTIVE / _IN_GRACE_PERIOD
      const inGrace =
        state === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD" ||
        (expiryMs <= now && state === "SUBSCRIPTION_STATE_ACTIVE");
      const subscriptionActive = expiryMs > now || inGrace;
      // v2 reports active states explicitly; treat any resolvable state as verified.
      const verifiedSub = !!state;

      const obfHash =
        sub.externalAccountIdentifiers?.obfuscatedExternalAccountId ?? null;

      // §8 — presence of `testPurchase` marks a license-tester purchase; never
      // count it as revenue / credit affiliates (it still gets entitlement).
      const isTestPurchase = !!sub.testPurchase;
      const orderId = lineOrderId || sub.latestOrderId || null;

      // The ACTUAL amount charged (incl. intro/offer discount + tax) lives in
      // the Orders API — subscriptionsv2 only exposes `recurringPrice` (the
      // NEXT renewal price), not what was paid this period. Best-effort: an
      // orders.get miss must never fail an otherwise-valid verification.
      let price = null;
      let currency = null;
      if (orderId) {
        try {
          const ord = await androidPublisher.orders.get({ packageName, orderId });
          const total = ord?.data?.total;
          if (total) {
            price = moneyToNumber(total);
            currency = total.currencyCode || null;
          }
        } catch (ordErr) {
          console.warn(`[google] orders.get failed (non-fatal) order=${orderId}: ${ordErr.message}`);
        }
      }
      const renewalPrice = moneyToNumber(renewalMoney);
      const renewalCurrency = renewalMoney?.currencyCode || null;

      if (inGrace) {
        console.log(`[google] Subscription in grace period: order=${orderId}, state=${state}`);
      }

      // Acknowledge if needed (v2 ackState lives on the subscription).
      if (verifiedSub && sub.acknowledgementState !== "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED") {
        try {
          await androidPublisher.purchases.subscriptions.acknowledge({
            packageName,
            subscriptionId: lineProductId || productId,
            token: purchaseToken,
          });
          console.log(`[google] Acknowledged subscription: ${lineProductId || productId}, order=${sub.latestOrderId}`);
        } catch (ackErr) {
          console.warn(`[google] Acknowledge sub failed (non-fatal): ${ackErr.message}`);
        }
      }

      return {
        verified: verifiedSub,
        transactionId: orderId,
        // §5.3 — use the line-item product, NOT the echoed client productId.
        productId: lineProductId || productId,
        isSubscription: true,
        subscriptionActive,
        inGracePeriod: inGrace,
        expiresAt: expiryMs ? new Date(expiryMs).toISOString() : null,
        autoRenewing: !!lineItems.find((li) => li.autoRenewingPlan?.autoRenewEnabled),
        acknowledged: true,
        isTestPurchase,
        // §5.3 attribution/offer fields.
        obfHash,
        offerId,
        offerTags,
        // Real charged amount (this period) + the next renewal price.
        price,
        currency,
        renewalPrice,
        renewalCurrency,
      };
    } else {
      // One-time product verification
      const res = await androidPublisher.purchases.products.get({
        packageName,
        productId,
        token: purchaseToken,
      });

      const purchase = res.data;
      // purchaseState: 0 = purchased, 1 = canceled, 2 = pending
      const verified = purchase.purchaseState === 0;

      // Acknowledge if not yet acknowledged — Google auto-refunds
      // unacknowledged purchases after 3 days. Client should also
      // acknowledge, but server-side is the safety net.
      if (verified && purchase.acknowledgementState !== 1) {
        try {
          await androidPublisher.purchases.products.acknowledge({
            packageName,
            productId,
            token: purchaseToken,
          });
          console.log(`[google] Acknowledged product: ${productId}, order=${purchase.orderId}`);
        } catch (ackErr) {
          console.warn(`[google] Acknowledge failed (non-fatal): ${ackErr.message}`);
        }
      }

      return {
        verified,
        transactionId: purchase.orderId,
        productId,
        isSubscription: false,
        subscriptionActive: false,
        acknowledged: true,
      };
    }
  } catch (err) {
    console.error("[google] Verification error:", err);
    return { verified: false, error: `Google verification failed: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// Route: POST /verify-purchase
// ---------------------------------------------------------------------------

// Swappable receipt-verify references (default = the real implementations).
// Tests inject a deterministic verified result via _setVerifyForTest so the
// entitlement-gate logic can be exercised without a live Apple/Play call.
let _verifyApple = verifyApple;
let _verifyGoogle = verifyGoogle;
function _setVerifyForTest({ apple, google } = {}) {
  _verifyApple = apple || verifyApple;
  _verifyGoogle = google || verifyGoogle;
}

async function handleVerifyPurchase(body, secrets) {
  const { platform, productId, packId } = body;

  if (!platform || !productId) {
    return json(400, { status: "failed", error: "Missing platform or productId" });
  }

  console.log(
    `[verify] in platform=${platform} productId=${productId} packId=${packId || "-"} ` +
      `hasCode=${!!body.affiliateCode} hasResToken=${!!body.resolutionToken} hasSubject=${!!body.subjectId}`
  );

  // Verify the receipt with the platform (via swappable refs so tests can inject
  // a verified result without a real Apple/Play call — see _setVerifyForTest).
  let result;
  if (platform === "ios" || platform === "macos") {
    if (!body.transactionId) {
      return json(400, { status: "failed", error: "Missing transactionId for Apple" });
    }
    result = await _verifyApple(body, secrets);
  } else if (platform === "android") {
    if (!body.purchaseToken) {
      return json(400, { status: "failed", error: "Missing purchaseToken for Google" });
    }
    // Subscriptions MUST be verified via subscriptionsv2 (see googleProductTypeFor).
    const productType = googleProductTypeFor(productId, body.productType);
    result = await _verifyGoogle({ ...body, productType }, secrets);
  } else {
    return json(400, { status: "failed", error: `Unsupported platform: ${platform}` });
  }

  if (!result.verified) {
    console.warn(
      `[verify] FAILED platform=${platform} productId=${productId} error=${result.error || "unknown"}`
    );
    return json(403, { status: "failed", error: result.error || "Verification failed" });
  }

  console.log(
    `[verify] OK platform=${platform} txn=${result.transactionId} isSub=${!!result.isSubscription} ` +
      `active=${!!result.subscriptionActive} offer=${result.offerId || result.offerIdentifier || "none"}`
  );

  // For subscription or individual purchase, generate a signed download URL
  const response = {
    status: "verified",
    transactionId: result.transactionId,
    productId: result.productId,
    subscriptionActive: result.subscriptionActive || false,
    expiresAt: result.expiresAt || null,
  };

  // --- §5: affiliate attribution + entitlement token (best-effort, NEVER
  // blocks entitlement, §1.1). All wrapped so a codes/Dynamo failure can't
  // turn a verified purchase into a failure. ---
  if (body.subjectId) {
    response.subjectId = body.subjectId;
    response.plus = !!result.subscriptionActive;
    try {
      const hmac = secrets?.codeSigning?.hmacKey;
      const kid = secrets?.codeSigning?.kid || "v1";
      if (hmac && result.subscriptionActive) {
        response.entitlementToken = codes.mintEntitlementToken(
          { subjectId: body.subjectId, plus: true, expiresAt: result.expiresAt || null },
          hmac,
          kid
        );
      }

      const isApple = platform === "ios" || platform === "macos";
      const txnOrOriginalId = isApple
        ? result.originalTransactionId || result.transactionId
        : result.transactionId; // Android orderId

      // §3 validate the resolutionToken (attribution only proceeds if valid).
      const tokenCheck = codes.validateResolutionToken(
        body.resolutionToken,
        { subjectId: body.subjectId, affiliateCode: body.affiliateCode },
        hmac
      );

      // Never credit affiliate revenue for test/sandbox purchases (TestFlight,
      // Xcode, Play license testers) — they still get entitlement below.
      const isNonProd = !!result.isTestPurchase || result.environment === "Sandbox";
      if (tokenCheck.valid && !isNonProd) {
        const claims = tokenCheck.claims;
        // §5.2/§5.3 confirm the offer applied matches the token.
        const offerApplied = isApple
          ? result.offerType != null
          : result.offerId != null;
        const offerMatches = isApple
          ? !claims.appleOfferId || result.offerIdentifier === claims.appleOfferId
          : !claims.googleOfferId || result.offerId === claims.googleOfferId;

        console.log(
          `[codes] attributing partner=${claims.partnerId} code=${claims.code} ` +
            `platform=${isApple ? "apple" : "android"} txn=${txnOrOriginalId} ` +
            `offerApplied=${offerApplied} offerMatches=${offerMatches}`
        );

        const attribution = await codes.attributePurchase({
          claims,
          subjectId: body.subjectId,
          partnerName: claims.partnerId
            ? claims.partnerId.charAt(0).toUpperCase() + claims.partnerId.slice(1)
            : null,
          platform: isApple ? "apple" : "android",
          txnOrOriginalId,
          productId: result.productId,
          price: result.price ?? null,
          currency: result.currency ?? null,
          offerApplied: offerApplied && offerMatches,
          offerType: isApple ? result.offerType : result.offerId,
          offerIdentifier: isApple ? result.offerIdentifier : result.offerId,
          environment: result.environment ?? null,
          appAccountToken: isApple ? result.appAccountToken : result.obfHash,
          expiresAt: result.expiresAt ?? null,
        });
        if (attribution) {
          response.affiliateAttribution = attribution;
          console.log(`[codes] attribution: ${JSON.stringify(attribution)}`);
        }
      } else if (result.subscriptionActive) {
        console.log(
          `[codes] no valid resolutionToken (${tokenCheck.reason || "none"}); recording entitlement-only sub`
        );
        // §4 — NO valid code, but a verified active sub. attributePurchase
        // never ran (it's gated on a resolutionToken), so persist the
        // entitlement PURCHASE# row here so /entitlement-token reflects a real
        // active subscription. Idempotent + best-effort; never blocks status.
        await codes.recordEntitlementPurchase({
          subjectId: body.subjectId,
          platform: isApple ? "apple" : "android",
          txnOrOriginalId,
          productId: result.productId,
          expiresAt: result.expiresAt ?? null,
          environment: result.environment ?? null,
          appAccountToken: isApple ? result.appAccountToken : result.obfHash,
        });
      }
    } catch (err) {
      // §5.5 non-fatal: omit affiliateAttribution, keep status verified.
      console.warn("[codes] attribution non-fatal failure:", err.message);
    }
  }

  // Generate signed URL if a specific pack was requested.
  // Accept downloadPath from the client (derived from catalog's downloadUrl)
  // since filenames include the version (e.g. "pack-id-0.1.0.zip").
  // Fall back to packId-only path for backwards compatibility.
  if (packId || body.downloadPath) {
    let downloadPath;
    if (typeof body.downloadPath === "string" && body.downloadPath.length > 0) {
      // Client sends the path from the catalog's downloadUrl
      downloadPath = body.downloadPath.replace(/^\/+/, "");
    } else {
      downloadPath = `narrations/premium/${packId}.zip`;
    }
    // Only sign paths under narrations/premium/ to prevent signing arbitrary URLs.
    if (!downloadPath.startsWith("narrations/premium/")) {
      return json(400, { status: "failed", error: "Invalid downloadPath" });
    }

    // --- §B entitlement gate: "verified" alone is NOT enough to issue a
    // premium download. The client is open-source/bypassable, so THIS Lambda is
    // the gate. Two cases:
    //
    //   (1) Subscription-backed request (Plus, all-access): require an ACTIVE
    //       subscription. A verified-but-inactive (expired/lapsed) sub must get
    //       403, not a signed URL. (Note: never-block-a-subscriber is about
    //       PLAYBACK of already-installed content — gating fresh DOWNLOAD URLs on
    //       active state is correct and does not violate it.)
    //   (2) One-time book request (legacy per-book ownership): the verified
    //       receipt must actually entitle the requested ZIP — bind the verified
    //       product to the requested pack + path via the public catalog.
    const isSubscriptionRequest =
      body.productType === "subs" ||
      productId === "corpan.plus" ||
      !!result.isSubscription;

    if (isSubscriptionRequest) {
      if (!result.subscriptionActive) {
        console.warn(`[signed-url] DENY: subscription not active (productId=${productId})`);
        return json(403, { status: "failed", error: "Subscription not active" });
      }
      // Active Plus is all-access: any premium narration ZIP is allowed.
    } else {
      // One-time path. For Apple the verified receipt must be FOR the claimed
      // product (verifyApple returns any found transaction's productId without
      // binding it to body.productId).
      const isApple = platform === "ios" || platform === "macos";
      if (isApple && result.productId && productId && result.productId !== productId) {
        console.warn(`[signed-url] DENY: Apple receipt product mismatch (receipt=${result.productId} requested=${productId})`);
        return json(403, { status: "failed", error: "Receipt does not match requested product" });
      }
      // Bind the verified product to the requested pack + premium ZIP via the
      // catalog (fail closed if the catalog is unavailable or doesn't match).
      const bound = await bindOneTimeDownload({
        packId,
        verifiedProductId: result.productId || productId,
        downloadPath,
      });
      if (!bound.ok) {
        console.warn(`[signed-url] DENY: one-time binding failed: ${bound.reason}`);
        return json(403, { status: "failed", error: "Not entitled to this download" });
      }
      // Trust the catalog-derived path over the client-supplied one.
      downloadPath = bound.downloadPath;
    }

    try {
      const signingKey = secrets.cloudfront?.signingPrivateKey;
      response.signedUrl = generateSignedDownloadUrl(downloadPath, signingKey);
      console.log(`[signed-url] Signed: ${downloadPath}`);
    } catch (err) {
      console.warn("[signed-url] Could not generate signed URL:", err.message);
      // Non-fatal: verification succeeded, signed URL is a bonus.
    }
  }

  return json(200, response);
}

// ---------------------------------------------------------------------------
// Route: POST /subscription-status
// ---------------------------------------------------------------------------

async function handleSubscriptionStatus(body, secrets) {
  const { platform, productId, transactionId, purchaseToken } = body;

  if (!platform) {
    return json(400, { status: "failed", error: "Missing platform" });
  }

  let result;
  if (platform === "ios" || platform === "macos") {
    result = await verifyApple({ transactionId, productId, productType: "subs" }, secrets);
  } else if (platform === "android") {
    result = await verifyGoogle({ productId, purchaseToken, productType: "subs" }, secrets);
  } else {
    return json(400, { status: "failed", error: `Unsupported platform: ${platform}` });
  }

  return json(200, {
    subscriptionActive: result.subscriptionActive || false,
    expiresAt: result.expiresAt || null,
    autoRenewing: result.autoRenewing || false,
  });
}

// ---------------------------------------------------------------------------
// Route: POST /apple-notifications (App Store Server Notifications V2)
// ---------------------------------------------------------------------------

// Verify + decode an ASSN V2 signed payload, returning the decoded notification
// payload or null on failure/misconfiguration. Extracted to a swappable
// module-level reference so tests can drive the handler's post-verify logic
// without a real JWS / Apple root chain (see _setAppleVerifyForTest). Default
// implementation does the real signature verification.
async function _defaultAppleVerify(signedPayload, appleSecrets) {
  const bundleId = appleSecrets.bundleId || "com.corpora.corpan";
  const appleRootCerts = (appleSecrets.rootCerts || []).map((c) =>
    Buffer.from(c, "base64")
  );
  // appAppleId MUST be a number — SignedDataVerifier compares it to the
  // payload's numeric appAppleId; a string fails as INVALID_APP_IDENTIFIER.
  const appAppleId = Number(appleSecrets.appAppleId);
  if (!appleRootCerts.length || !appAppleId) {
    console.error("[apple-notification] CRITICAL: apple.rootCerts / apple.appAppleId not configured — cannot verify");
    return null;
  }
  // ASSN V2 arrive from BOTH Sandbox and Production senders; the JWS only
  // verifies against the matching-environment verifier. Try both (chain is
  // validated to the Apple root either way). enableOnlineChecks=false avoids
  // OCSP network flakiness in Lambda — the x5c chain + signature still prove
  // authenticity. §6.1.
  let verErr;
  for (const env of [Environment.PRODUCTION, Environment.SANDBOX]) {
    try {
      const verifier = new SignedDataVerifier(
        appleRootCerts, false, env, bundleId, appAppleId
      );
      return await verifier.verifyAndDecodeNotification(signedPayload);
    } catch (e) {
      verErr = e;
    }
  }
  console.error("[apple-notification] signature verify failed (both envs): status=" + (verErr && (verErr.status ?? verErr.message)));
  return null;
}

let _appleVerify = _defaultAppleVerify;
function _setAppleVerifyForTest(fn) {
  _appleVerify = fn || _defaultAppleVerify;
}

async function handleAppleNotification(body, secrets) {
  // Apple sends { signedPayload: "..." } — a JWS signed notification
  const { signedPayload } = body;

  if (!signedPayload) {
    return json(400, { error: "Missing signedPayload" });
  }

  try {
    // §6.1 — Verify the ASSN V2 JWS signature with SignedDataVerifier.
    const appleSecrets = secrets?.apple || {};
    const payload = await _appleVerify(signedPayload, appleSecrets);
    if (!payload) {
      // _appleVerify already logged the reason (unconfigured or verify failure).
      return json(200, { received: true, verified: false });
    }

    const notificationType = payload.notificationType;
    const subtype = payload.subtype;
    const action = appleNotificationAction(notificationType);
    console.log("[apple-notification]", JSON.stringify({
      notificationType, subtype, action, notificationUUID: payload.notificationUUID,
    }));

    // §6 — Dedupe: ASSN is at-least-once and may duplicate/reorder. Process
    // each notificationUUID at most once. Use a READ-only probe here to skip
    // obvious replays; the authoritative dedupe row is committed AFTER the
    // side-effect work succeeds (see below) so a transient post-read failure
    // leaves the event reprocessable on redelivery (all writes are idempotent).
    if (payload.notificationUUID) {
      const seen = await codes.isEventProcessed(`apple#${payload.notificationUUID}`);
      if (seen) {
        console.log(`[apple-notification] duplicate ${payload.notificationUUID} — skipped`);
        return json(200, { received: true, duplicate: true });
      }
    }

    const signedTxn = payload.data?.signedTransactionInfo;
    const txn = signedTxn
      ? JSON.parse(Buffer.from(signedTxn.split(".")[1], "base64url").toString())
      : null;

    if (txn && action !== "ignore") {
      const subjectKey = txn.appAccountToken || null;
      const txnId = txn.transactionId;
      const origId = txn.originalTransactionId || txnId;
      const productId = txn.productId || null;
      const price = milliunitsToNumber(txn.price);
      const currency = txn.currency ?? null;
      const environment = txn.environment || null;
      const isTest = environment === "Sandbox";
      const expiresAt = txn.expiresDate ? new Date(txn.expiresDate).toISOString() : null;
      // Apple offerType 3 = offer code (the partner attribution hook, §3).
      const isOfferCode = txn.offerType === 3 && !!txn.offerIdentifier;

      // Extend the subscriber entitlement (PURCHASE# row behind /entitlement-token)
      // for any live txn with a known subject + expiry. A clawback (REFUND /
      // REVOKE) usually still carries a future expiresDate, so guard it out —
      // mirroring the Google path — to avoid refreshing entitlement on a revoked
      // txn. Per the never-block-a-subscriber priority we do NOT write a negative
      // / expire row here; existing entitlement simply lapses at natural expiry.
      if (subjectKey && expiresAt && action !== "clawback") {
        await codes.recordEntitlementPurchase({
          subjectId: subjectKey, platform: "apple", txnOrOriginalId: txnId,
          productId, expiresAt, environment, appAccountToken: subjectKey,
        });
      }

      if (action === "initial" && isOfferCode) {
        // Offer-code redemption (incl. OUT-OF-APP, where appAccountToken is
        // absent) → attribute the partner straight from the offer id. §3.4.
        const r = await codes.attributeFromOffer({
          offerId: txn.offerIdentifier, subjectKey, platform: "apple",
          txnOrOriginalId: origId, productId, price, currency, expiresAt, environment, isTest,
        });
        if (r) console.log(`[apple-notification] offer-code attribution: ${JSON.stringify(r)}`);
      } else if (action === "renewal" && subjectKey && !isTest) {
        const attr = await codes.getAttribution(subjectKey);
        if (attr && attr.partnerId) {
          const meta = attr.code ? await codes.getCode(attr.code) : null;
          await codes.creditRenewal({
            partnerId: attr.partnerId, subjectId: subjectKey, platform: "apple",
            renewalTxnId: txnId, productId, price, currency,
            revenueSharePct: meta?.revenueSharePct ?? null, notificationType,
          });
        }
      } else if (action === "clawback") {
        // Refund / revoke → reverse affiliate credit for this txn (§7).
        // Reverse against the SPECIFIC refunded transaction id (`txnId`), NOT
        // the original id: a renewal credit is keyed on its OWN renewal txn id
        // (creditRenewal → EVENT#apple#<renewalTxnId>), so reversing on origId
        // would never offset it. For the INITIAL purchase txnId === origId
        // (Apple's first transaction is its own original), so the initial credit
        // (keyed on origId) still nets out. Apple gives us the refunded
        // transactionId in the notification, so it matches whatever id the
        // matching credit row used for that period.
        const attr = subjectKey ? await codes.getAttribution(subjectKey) : null;
        const partnerId = attr?.partnerId
          || (isOfferCode ? (await codes.findCodeByOffer(txn.offerIdentifier))?.partnerId : null);
        if (partnerId) {
          await codes.reverseCredit({
            partnerId, platform: "apple", txnOrOriginalId: txnId, price, currency,
            reason: notificationType,
          });
        }
      }
      // "extend"/"reinstate" handled by the entitlement refresh above.
    }

    // §6 — Commit the dedupe row only AFTER all side-effect work above has
    // succeeded. A crash/throw before this point leaves the event unmarked so a
    // redelivery safely reprocesses (every write is an idempotent conditional
    // put). If the throw happens, control jumps to catch and we do NOT mark.
    if (payload.notificationUUID) {
      await codes.markEventProcessed(`apple#${payload.notificationUUID}`);
    }
  } catch (err) {
    // A CAUGHT processing error (a transient DynamoDB write failure in the
    // side-effect work or the post-work mark) must NOT be ACK'd. Returning a
    // retryable 500 makes Apple redeliver the notification; the dedupe-after-work
    // ordering means a redelivery safely reprocesses (idempotent conditional puts
    // + the isEventProcessed probe short-circuits a genuinely-completed one). A
    // 200 here would permanently lose the event (no redelivery).
    console.error("[apple-notification] handler error (retryable):", err.message);
    return json(500, { received: false, error: "retryable processing error" });
  }

  // Apple expects 200 OK to acknowledge receipt (so it stops retrying).
  return json(200, { received: true });
}

// ---------------------------------------------------------------------------
// Route: POST /google-notifications (Google RTDN via Cloud Pub/Sub)
// ---------------------------------------------------------------------------

async function handleGoogleNotification(body, secrets, authHeader) {
  // Google sends { message: { data: "<base64>", messageId: "..." }, subscription: "..." }
  const { message } = body;

  if (!message || !message.data) {
    return json(400, { error: "Missing message.data" });
  }

  // §6.2 — Validate the Pub/Sub push OIDC token before trusting the payload.
  // Fail-CLOSED: if the OIDC config (google.pubsubAudience /
  // pubsubServiceAccount) is absent we REJECT and do NOT process the body (and
  // do NOT burn a dedupe id) — never accept an unauthenticated push. Prod has
  // these set, so this only removes a dangerous fallback.
  const googleSecrets = secrets?.google || {};
  const expectedAudience = googleSecrets.pubsubAudience;
  const expectedEmail = googleSecrets.pubsubServiceAccount;
  if (!expectedAudience && !expectedEmail) {
    console.error("[google-notification] CRITICAL: Pub/Sub OIDC NOT configured (no google.pubsubAudience/pubsubServiceAccount) — rejecting unauthenticated push");
    return json(403, { error: "forbidden" });
  }
  {
    const ok = await verifyPubSubOidc(authHeader, expectedAudience, expectedEmail);
    if (!ok) {
      console.error("[google-notification] OIDC validation failed — rejecting");
      return json(401, { error: "unauthorized" });
    }
  }

  try {
    const decoded = JSON.parse(Buffer.from(message.data, "base64").toString());
    const subNotif = decoded.subscriptionNotification;
    const voided = decoded.voidedPurchaseNotification;
    const action = subNotif ? googleNotificationAction(subNotif.notificationType) : null;
    console.log("[google-notification]", JSON.stringify({
      packageName: decoded.packageName,
      eventTimeMillis: decoded.eventTimeMillis,
      notificationType: subNotif?.notificationType,
      action,
      voided: voided ? { orderId: voided.orderId, refundType: voided.refundType } : undefined,
      test: !!decoded.testNotification,
    }));

    // Dedupe at-least-once Pub/Sub delivery by messageId. READ-only probe at the
    // top to skip replays; the authoritative dedupe row is committed AFTER the
    // side-effect work succeeds (see the markEventProcessed calls in each exit
    // path below) so a transient post-probe failure leaves the event
    // reprocessable on redelivery (all writes are idempotent).
    const eventId = message.messageId ? `google#${message.messageId}` : null;
    if (eventId && (await codes.isEventProcessed(eventId))) {
      console.log(`[google-notification] duplicate ${message.messageId} — skipped`);
      return json(200, { received: true, duplicate: true });
    }

    if (decoded.testNotification) {
      console.log("[google-notification] test notification OK");
      if (eventId) await codes.markEventProcessed(eventId);
      return json(200, { received: true, test: true });
    }

    // §7 — Refund / chargeback → reverse affiliate credit for that order.
    if (voided && voided.purchaseToken) {
      const verify = await verifyGoogle(
        { purchaseToken: voided.purchaseToken, productId: voided.subscriptionId, productType: "subs" },
        secrets
      );
      // Never trust an unverified authoritative re-fetch: a transient Play API
      // outage returns { verified:false } with no fields. Doing the clawback +
      // markEventProcessed here would burn the event on a transient failure.
      // Return a retryable 500 so Pub/Sub redelivers (no partial work, no mark).
      if (!verify.verified) {
        console.error("[google-notification] voided re-fetch unverified — retryable, not marking");
        return json(500, { received: false, error: "retryable verify failure" });
      }
      const attr = verify.obfHash ? await codes.findSubjectByObfHash(verify.obfHash) : null;
      if (attr && attr.partnerId) {
        await codes.reverseCredit({
          partnerId: attr.partnerId, platform: "android",
          txnOrOriginalId: voided.orderId || verify.transactionId, reason: "VOIDED",
        });
      }
      if (eventId) await codes.markEventProcessed(eventId);
      return json(200, { received: true });
    }

    if (subNotif && action !== "ignore") {
      // §5 — Never trust the notification body: re-fetch authoritative state.
      const verify = await verifyGoogle(
        { purchaseToken: subNotif.purchaseToken, productId: subNotif.subscriptionId, productType: "subs" },
        secrets
      );
      // verifyGoogle swallows Play API failures and returns { verified:false }
      // with missing fields. Proceeding would do NO real work (no entitlement /
      // renewal / clawback) and then markEventProcessed — burning the event on a
      // transient Play outage. Return a retryable 500 so it redelivers; do NOT do
      // partial work and do NOT mark the event processed.
      if (!verify.verified) {
        console.error("[google-notification] subscription re-fetch unverified — retryable, not marking");
        return json(500, { received: false, error: "retryable verify failure" });
      }
      const obfHash = verify.obfHash;
      const orderId = verify.transactionId;
      const isTest = !!verify.isTestPurchase;
      const attr = obfHash ? await codes.findSubjectByObfHash(obfHash) : null;
      const subjectId = attr?.subjectId || null;

      // Extend the subscriber entitlement with the authoritative expiry for any
      // live action (purchase/renew/recover/restart/cancel-still-active/grace).
      if (subjectId && verify.expiresAt && action !== "clawback") {
        await codes.recordEntitlementPurchase({
          subjectId, platform: "android", txnOrOriginalId: orderId,
          productId: verify.productId || null, expiresAt: verify.expiresAt,
          environment: null, appAccountToken: null,
        });
      }

      if (action === "initial") {
        // First server-side sighting of a paid sub (e.g. out-of-app or a missed
        // in-app verify) → attribute the partner from the offer id.
        const r = await codes.attributeFromOffer({
          offerId: verify.offerId, subjectKey: subjectId, obfHash, platform: "android",
          txnOrOriginalId: orderId, productId: verify.productId || null,
          price: verify.price ?? null, currency: verify.currency ?? null,
          expiresAt: verify.expiresAt, isTest,
        });
        if (r) console.log(`[google-notification] offer attribution: ${JSON.stringify(r)}`);
      } else if (action === "renewal" && attr?.partnerId && !isTest) {
        const meta = attr.code ? await codes.getCode(attr.code) : null;
        await codes.creditRenewal({
          partnerId: attr.partnerId, subjectId, platform: "android",
          renewalTxnId: orderId, productId: verify.productId || null,
          price: verify.price ?? null, currency: verify.currency ?? null,
          revenueSharePct: meta?.revenueSharePct ?? null, notificationType: "SUBSCRIPTION_RENEWED",
        });
      } else if (action === "clawback" && attr?.partnerId) {
        await codes.reverseCredit({
          partnerId: attr.partnerId, platform: "android", txnOrOriginalId: orderId, reason: "REVOKED",
        });
      }
    }

    // Commit the dedupe row only AFTER all side-effect work above has succeeded.
    // A throw before this point jumps to catch and leaves the event unmarked so
    // a redelivery safely reprocesses (every write is an idempotent put).
    if (eventId) await codes.markEventProcessed(eventId);
  } catch (err) {
    // A CAUGHT processing error (transient DynamoDB write in the side-effect work
    // or the post-work mark) must NOT be ACK'd. For Pub/Sub push a 200 ACKs the
    // message and permanently loses it; a retryable 500 makes Pub/Sub redeliver,
    // and the dedupe-after-work ordering reprocesses safely (idempotent
    // conditional puts + isEventProcessed short-circuit).
    console.error("[google-notification] handler error (retryable):", err.message);
    return json(500, { received: false, error: "retryable processing error" });
  }

  // Google expects 200 OK to acknowledge
  return json(200, { received: true });
}

// Validate a Pub/Sub push OIDC bearer token (§6.2 / §7).
async function verifyPubSubOidc(authHeader, expectedAudience, expectedEmail) {
  try {
    if (!authHeader) return false;
    const m = /^Bearer\s+(.+)$/i.exec(authHeader);
    if (!m) return false;
    const idToken = m[1];
    const client = new google.auth.OAuth2();
    const ticket = await client.verifyIdToken({
      idToken,
      audience: expectedAudience || undefined,
    });
    const payload = ticket.getPayload();
    if (!payload) return false;
    if (expectedEmail && payload.email !== expectedEmail) return false;
    if (expectedEmail && payload.email_verified !== true) return false;
    return true;
  } catch (err) {
    console.error("[google-notification] OIDC verify error:", err.message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main handler (routes by API Gateway routeKey)
// ---------------------------------------------------------------------------

exports.handler = async (event) => {
  setRequestOrigin(event);

  // Handle CORS preflight
  if (event.requestContext?.http?.method === "OPTIONS") {
    return json(204, null);
  }

  let body = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { status: "failed", error: "Invalid JSON body" });
  }

  // Dev bypass (all routes)
  const bypassToken = process.env.DEV_BYPASS_TOKEN;
  const headerToken = getHeader(event, "x-dev-bypass");
  if (bypassToken && headerToken === bypassToken) {
    const response = {
      status: "verified",
      transactionId: "dev-bypass",
      subscriptionActive: true,
      devBypass: true,
    };
    // If packId or downloadPath provided, generate a real signed URL for download testing
    if (body.packId || body.downloadPath) {
      try {
        const secrets = await getSecrets();
        let downloadPath;
        if (typeof body.downloadPath === "string" && body.downloadPath.length > 0) {
          downloadPath = body.downloadPath.replace(/^\/+/, "");
        } else {
          downloadPath = `narrations/premium/${body.packId}.zip`;
        }
        if (downloadPath.startsWith("narrations/premium/")) {
          response.signedUrl = generateSignedDownloadUrl(
            downloadPath,
            secrets.cloudfront.signingPrivateKey
          );
        }
      } catch (e) {
        response.signedUrlError = e.message;
      }
    }
    return json(200, response);
  }

  const route = getRoute(event);

  switch (route) {
    case "/verify-purchase": {
      const secrets = await getSecrets();
      return handleVerifyPurchase(body, secrets);
    }
    case "/subscription-status": {
      const secrets = await getSecrets();
      return handleSubscriptionStatus(body, secrets);
    }
    case "/code/resolve": {
      const secrets = await getSecrets();
      return codes.handleCodeResolve(body, {
        secrets,
        json,
        acceptLanguage: getHeader(event, "accept-language"),
        sourceIp: event.requestContext?.http?.sourceIp,
      });
    }
    case "/entitlement-token": {
      const secrets = await getSecrets();
      return codes.handleEntitlementToken(body, { secrets, json });
    }
    case "/apple-notifications": {
      const secrets = await getSecrets();
      return handleAppleNotification(body, secrets);
    }
    case "/google-notifications": {
      const secrets = await getSecrets();
      return handleGoogleNotification(body, secrets, getHeader(event, "authorization"));
    }
    default:
      return json(404, { error: `Unknown route: ${route}` });
  }
};
