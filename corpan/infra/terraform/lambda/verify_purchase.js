const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const { getSignedUrl } = require("@aws-sdk/cloudfront-signer");
const { AppStoreServerAPIClient, Environment, SignedDataVerifier, VerificationStatus } = require("@apple/app-store-server-library");
const { google } = require("googleapis");

// Affiliate + discount codes (0.17.4). Pure-logic modules have zero external
// deps so their unit tests run without npm install; this file wires the AWS
// clients (DynamoDB + Secrets Manager HMAC secret) into them.
const { normalizeCode } = require("./codes");
const { IapStore } = require("./store");
const {
  resolveCode,
  recordPurchaseAttribution,
  creditRenewal,
  issueEntitlementToken,
} = require("./attribution");
const {
  decodeJws,
  extractAppleFields,
  appleOfferMatches,
  extractGoogleV2Fields,
  googleV2Active,
  googleOfferMatches,
} = require("./receipts");

// DynamoDB doc client — lazy so unit tests that never touch the handler don't
// require the AWS SDK to be installed.
let _ddbStore = null;
function getStore() {
  if (_ddbStore) return _ddbStore;
  const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
  const {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
    QueryCommand,
    UpdateCommand,
  } = require("@aws-sdk/lib-dynamodb");
  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  });
  // Adapt the v3 command/send shape to the small interface store.js expects.
  const client = {
    getItem: (p) => doc.send(new GetCommand(p)),
    putItem: (p) => doc.send(new PutCommand(p)),
    query: (p) => doc.send(new QueryCommand(p)),
    updateItem: (p) => doc.send(new UpdateCommand(p)),
  };
  _ddbStore = new IapStore(client, process.env.IAP_TABLE || "corpan-iap");
  return _ddbStore;
}

/**
 * HMAC signing secret for resolution/entitlement tokens. Lives in its OWN
 * Secrets Manager secret (IAP_TOKEN_SECRET_ARN) so a terraform write never
 * clobbers the out-of-band Apple/Google creds in the verify secret. Cached on
 * the warm container. `TOKEN_SIGNING_SECRET` env overrides for local/dev/tests.
 */
let _cachedTokenSecret = null;
async function getTokenSecret() {
  if (process.env.TOKEN_SIGNING_SECRET) return process.env.TOKEN_SIGNING_SECRET;
  if (_cachedTokenSecret) return _cachedTokenSecret;
  const arn = process.env.IAP_TOKEN_SECRET_ARN;
  if (!arn) return "";
  try {
    const result = await smClient.send(new GetSecretValueCommand({ SecretId: arn }));
    const parsed = JSON.parse(result.SecretString);
    _cachedTokenSecret = parsed.tokenSigningSecret || "";
    return _cachedTokenSecret;
  } catch (err) {
    console.error("[token-secret] failed to load IAP token secret:", err.message);
    return "";
  }
}

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

    // Capture attribution + offer fields (appAccountToken, offerType/Identifier,
    // offerDiscountType, price/currency). Offer fields are present only on the
    // INITIAL transaction — that's expected (§3.4); renewal attribution rides on
    // appAccountToken + our ledger.
    const fields = extractAppleFields(decoded);

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
      fields,
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
      // Prefer subscriptionsv2.get: it returns externalAccountIdentifiers
      // (obfuscated account id for attribution), lineItems, and offerDetails
      // (offerId/basePlanId) — none of which v1 provides. Fall back to v1
      // gracefully if v2 is unavailable so verification never hard-fails on the
      // attribution upgrade.
      let v2 = null;
      try {
        const v2res = await androidPublisher.purchases.subscriptionsv2.get({
          packageName,
          token: purchaseToken,
        });
        v2 = v2res.data;
      } catch (v2err) {
        console.warn(`[google] subscriptionsv2.get failed, falling back to v1: ${v2err.message}`);
      }

      if (v2) {
        const fields = extractGoogleV2Fields(v2);
        const { active, inGrace } = googleV2Active(fields);
        const decodedProductId = fields.productId || productId;
        const expiresMs = fields.expiresAt ? Date.parse(fields.expiresAt) : 0;

        // Acknowledge if pending (v2 ackState lives on the subscription).
        if (v2.acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING") {
          try {
            await androidPublisher.purchases.subscriptions.acknowledge({
              packageName,
              subscriptionId: decodedProductId,
              token: purchaseToken,
            });
            console.log(`[google] Acknowledged subscription (v2): ${decodedProductId}`);
          } catch (ackErr) {
            console.warn(`[google] Acknowledge sub (v2) failed (non-fatal): ${ackErr.message}`);
          }
        }

        return {
          verified: Boolean(fields.subscriptionState),
          transactionId: fields.latestOrderId || purchaseToken,
          // Use the DECODED product id from the receipt, never the client's.
          productId: decodedProductId,
          isSubscription: true,
          subscriptionActive: active,
          inGracePeriod: inGrace,
          expiresAt: fields.expiresAt || (expiresMs ? new Date(expiresMs).toISOString() : null),
          autoRenewing:
            v2.subscriptionState === "SUBSCRIPTION_STATE_ACTIVE",
          acknowledged: true,
          fields,
        };
      }

      // --- v1 fallback (legacy fields, no account id / offers) ---
      const res = await androidPublisher.purchases.subscriptions.get({
        packageName,
        subscriptionId: productId,
        token: purchaseToken,
      });

      const sub = res.data;
      const expiryMs = parseInt(sub.expiryTimeMillis ?? "0", 10);
      const now = Date.now();
      // paymentState===0 means "payment pending" — the grace-period state when
      // expiryTime has passed but Google is still trying to renew the card.
      // cancelReason undefined means user didn't actively cancel — just billing.
      // Without this, Android subscribers in the 3-7 day grace window get denied.
      const inGrace = expiryMs <= now && sub.paymentState === 0 && !sub.cancelReason;
      const subscriptionActive = expiryMs > now || inGrace;

      if (inGrace) {
        console.log(`[google] Subscription in grace period: orderId=${sub.orderId}, expired=${new Date(expiryMs).toISOString()}, paymentState=${sub.paymentState}`);
      }

      // Acknowledge subscription if not yet acknowledged — Google auto-refunds
      // unacknowledged purchases after 3 days.
      if (sub.paymentState !== undefined && sub.acknowledgementState !== 1) {
        try {
          await androidPublisher.purchases.subscriptions.acknowledge({
            packageName,
            subscriptionId: productId,
            token: purchaseToken,
          });
          console.log(`[google] Acknowledged subscription: ${productId}, order=${sub.orderId}`);
        } catch (ackErr) {
          console.warn(`[google] Acknowledge sub failed (non-fatal): ${ackErr.message}`);
        }
      }

      return {
        verified: sub.paymentState !== undefined,
        transactionId: sub.orderId,
        productId,
        isSubscription: true,
        subscriptionActive,
        inGracePeriod: inGrace,
        expiresAt: expiryMs ? new Date(expiryMs).toISOString() : null,
        autoRenewing: sub.autoRenewing || false,
        acknowledged: true,
        // v1 has no obfuscated account id / offer details.
        fields: {
          obfuscatedExternalAccountId: null,
          productId,
          offerId: null,
        },
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

async function handleVerifyPurchase(body, secrets) {
  const { platform, productId, packId } = body;

  if (!platform || !productId) {
    return json(400, { status: "failed", error: "Missing platform or productId" });
  }

  // Verify the receipt with the platform
  let result;
  if (platform === "ios" || platform === "macos") {
    if (!body.transactionId) {
      return json(400, { status: "failed", error: "Missing transactionId for Apple" });
    }
    result = await verifyApple(body, secrets);
  } else if (platform === "android") {
    if (!body.purchaseToken) {
      return json(400, { status: "failed", error: "Missing purchaseToken for Google" });
    }
    result = await verifyGoogle(body, secrets);
  } else {
    return json(400, { status: "failed", error: `Unsupported platform: ${platform}` });
  }

  if (!result.verified) {
    return json(403, { status: "failed", error: result.error || "Verification failed" });
  }

  // productId cross-check: the store-decoded product is authoritative. If the
  // client claimed a different product than the receipt decodes to, reject —
  // never trust the client's claimed product for entitlement/attribution.
  if (result.productId && productId && result.productId !== productId) {
    console.warn(`[verify] productId mismatch: requested=${productId} decoded=${result.productId}`);
    return json(403, { status: "failed", error: "Product mismatch" });
  }

  // For subscription or individual purchase, generate a signed download URL
  const response = {
    status: "verified",
    transactionId: result.transactionId,
    productId: result.productId,
    subscriptionActive: result.subscriptionActive || false,
    expiresAt: result.expiresAt || null,
  };

  // ----- Affiliate / discount attribution (0.17.4) -----
  // Server-authoritative: validate subjectId + (optional) affiliateCode +
  // resolutionToken, idempotently record the purchase, lock first-verified-
  // touch, write the initial ledger credit. Any failure here is NON-FATAL to
  // the entitlement (verification already succeeded) but is logged loudly.
  const subjectId = body.subjectId;
  if (subjectId) {
    try {
      const store = getStore();
      const tokenSecret = await getTokenSecret();
      const code = normalizeCode(body.affiliateCode);
      const registryEntry = code ? await store.getCodeEntry(code) : null;

      // Confirm whether the platform offer actually applied (from the receipt),
      // matched against the registry entry.
      const receiptFields = result.fields || {};
      let offerApplied = false;
      if (platform === "ios" || platform === "macos") {
        offerApplied = appleOfferMatches(receiptFields, registryEntry).applied;
      } else if (platform === "android") {
        offerApplied = googleOfferMatches(receiptFields, registryEntry).applied;
      }

      const attribution = await recordPurchaseAttribution(store, tokenSecret, {
        subjectId,
        platform,
        affiliateCode: body.affiliateCode,
        resolutionToken: body.resolutionToken,
        receiptFields,
        registryEntry,
        offerApplied,
      });

      response.subjectId = subjectId;
      if (attribution) response.affiliateAttribution = attribution;

      // Issue a short-lived entitlement token snapshot.
      if (tokenSecret) {
        const ent = issueEntitlementToken(tokenSecret, {
          subjectId,
          plus: response.subscriptionActive,
          expiresAt: response.expiresAt,
        });
        response.entitlementToken = ent.entitlementToken;
        response.plus = ent.plus;
      }
    } catch (attrErr) {
      console.error("[verify][attribution] FAILED (non-fatal to entitlement):", attrErr.stack || attrErr.message);
    }
  }

  // Generate signed URL if a specific pack was requested.
  // Accept downloadPath from the client (derived from catalog's downloadUrl)
  // since filenames include the version (e.g. "pack-id-0.1.0.zip").
  // Fall back to packId-only path for backwards compatibility.
  if (packId || body.downloadPath) {
    try {
      const signingKey = secrets.cloudfront?.signingPrivateKey;
      let downloadPath;
      if (typeof body.downloadPath === "string" && body.downloadPath.length > 0) {
        // Client sends the path from the catalog's downloadUrl
        downloadPath = body.downloadPath.replace(/^\/+/, "");
      } else {
        downloadPath = `narrations/premium/${packId}.zip`;
      }
      // Only sign paths under narrations/premium/ to prevent signing arbitrary URLs
      if (!downloadPath.startsWith("narrations/premium/")) {
        return json(400, { status: "failed", error: "Invalid downloadPath" });
      }
      response.signedUrl = generateSignedDownloadUrl(downloadPath, signingKey);
      console.log(`[signed-url] Signed: ${downloadPath}`);
    } catch (err) {
      console.warn("[signed-url] Could not generate signed URL:", err.message);
      // Non-fatal: verification succeeded, signed URL is a bonus
    }
  }

  return json(200, response);
}

// ---------------------------------------------------------------------------
// Route: POST /code/resolve  (classify a code; mint resolutionToken)
// ---------------------------------------------------------------------------

// In-memory rate limiter (best-effort across warm invocations of one container).
// Blunts code enumeration / keeps the registry's existence quiet. Not a hard
// security boundary — the resolutionToken + server-authoritative writes are.
const _rlWindowMs = 60_000;
const _rlMax = 30; // per key per minute
const _rlHits = new Map();
function rateLimited(key) {
  const now = Date.now();
  const bucket = _rlHits.get(key) || [];
  const fresh = bucket.filter((t) => now - t < _rlWindowMs);
  fresh.push(now);
  _rlHits.set(key, fresh);
  // opportunistic cleanup
  if (_rlHits.size > 5000) {
    for (const [k, v] of _rlHits) {
      if (v.every((t) => now - t >= _rlWindowMs)) _rlHits.delete(k);
    }
  }
  return fresh.length > _rlMax;
}

async function handleCodeResolve(event, body, secrets) {
  const ip =
    event.requestContext?.http?.sourceIp ||
    getHeader(event, "x-forwarded-for") ||
    "unknown";
  const rlKey = `${ip}:${body.subjectId || "anon"}`;
  if (rateLimited(rlKey)) {
    return json(429, { status: "error", error: "Too many requests. Try again shortly." });
  }

  try {
    const store = getStore();
    const tokenSecret = await getTokenSecret();
    const out = await resolveCode(store, tokenSecret, {
      code: body.code,
      subjectId: body.subjectId,
      platform: body.platform,
      productId: body.productId,
    });
    const status = out.status === "ok" || out.status === "invalid" ? 200 : 400;
    return json(status, out);
  } catch (err) {
    // NO FAIL-OPEN: a registry/store/lookup failure returns an explicit error,
    // never a fake "valid". The client must NOT auto-promote this to ok.
    console.error("[code/resolve] lookup failed:", err.stack || err.message);
    return json(502, { status: "error", error: "Couldn't check the code. Retry." });
  }
}

// ---------------------------------------------------------------------------
// Route: POST /entitlement-token  (signed entitlement snapshot for a subject)
// ---------------------------------------------------------------------------

async function handleEntitlementToken(body, secrets) {
  const { subjectId } = body;
  if (!subjectId) {
    return json(400, { status: "failed", error: "Missing subjectId" });
  }
  try {
    const store = getStore();
    const tokenSecret = await getTokenSecret();
    if (!tokenSecret) {
      return json(500, { status: "failed", subjectId, error: "Token signing not configured" });
    }
    // Determine current entitlement from the latest verified purchase row(s).
    // Reporting is by Query; here we just check for any active subscription
    // purchase the subject recorded. Absent a row, plus=false.
    let plus = false;
    let expiresAt = null;
    try {
      const res = await store.client.query({
        TableName: store.table,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": `SUBJECT#${subjectId}`,
          ":sk": "PURCHASE#",
        },
      });
      const items = res.Items || [];
      const now = Date.now();
      for (const it of items) {
        if (it.expiresAt && Date.parse(it.expiresAt) > now) {
          plus = true;
          if (!expiresAt || Date.parse(it.expiresAt) > Date.parse(expiresAt)) {
            expiresAt = it.expiresAt;
          }
        }
      }
    } catch (qErr) {
      console.warn("[entitlement-token] purchase query failed (issuing plus=false):", qErr.message);
    }
    const out = issueEntitlementToken(tokenSecret, { subjectId, plus, expiresAt });
    return json(200, out);
  } catch (err) {
    console.error("[entitlement-token] failed:", err.stack || err.message);
    return json(500, { status: "failed", subjectId, error: "Entitlement token failed" });
  }
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

const APPLE_RENEWAL_TYPES = new Set([
  "DID_RENEW",
  "SUBSCRIBED", // RESUBSCRIBE subtype
  "DID_CHANGE_RENEWAL_STATUS",
  "OFFER_REDEEMED",
]);

async function handleAppleNotification(body) {
  // Apple sends { signedPayload: "..." } — a JWS signed notification
  const { signedPayload } = body;

  if (!signedPayload) {
    return json(400, { error: "Missing signedPayload" });
  }

  try {
    const parts = signedPayload.split(".");
    if (parts.length !== 3) {
      console.error("[apple-notification] malformed signedPayload");
      return json(200, { received: true });
    }
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    console.log("[apple-notification]", JSON.stringify({
      notificationType: payload.notificationType,
      subtype: payload.subtype,
      notificationUUID: payload.notificationUUID,
    }));

    // Credit a renewal to the locked partner. Apple renewals do NOT re-state the
    // offer — durability rests on appAccountToken + our ledger (§3.4). Decode the
    // embedded signedTransactionInfo to get the renewal txn + appAccountToken.
    if (APPLE_RENEWAL_TYPES.has(payload.notificationType)) {
      const signedTx = payload.data?.signedTransactionInfo;
      if (signedTx) {
        const tx = extractAppleFields(decodeJws(signedTx));
        const accountKey = tx.appAccountToken || tx.originalTransactionId;
        const store = getStore();
        const credit = await creditRenewal(store, {
          platform: "ios",
          txnId: tx.transactionId,
          accountKey,
          productId: tx.productId,
          price: tx.price,
          currency: tx.currency,
          notificationType: payload.notificationType,
          eventTimeMs: payload.signedDate || Date.now(),
        });
        console.log(`[apple-notification] renewal credit:`, JSON.stringify(credit));
      }
    }
  } catch (err) {
    console.error("[apple-notification] error:", err.stack || err.message);
  }

  // Apple expects 200 OK to acknowledge receipt
  return json(200, { received: true });
}

// ---------------------------------------------------------------------------
// Route: POST /google-notifications (Google RTDN via Cloud Pub/Sub)
// ---------------------------------------------------------------------------

// RTDN subscriptionNotification.notificationType: 2=RENEWED, 4=PURCHASED, 7=RESTARTED
const GOOGLE_RENEWAL_TYPES = new Set([2, 4, 7]);

async function handleGoogleNotification(body, secrets) {
  // Google sends { message: { data: "<base64>", messageId: "..." }, subscription: "..." }
  const { message } = body;

  if (!message || !message.data) {
    return json(400, { error: "Missing message.data" });
  }

  try {
    const decoded = JSON.parse(Buffer.from(message.data, "base64").toString());
    const subNote = decoded.subscriptionNotification;
    console.log("[google-notification]", JSON.stringify({
      packageName: decoded.packageName,
      eventTimeMillis: decoded.eventTimeMillis,
      subscriptionNotification: subNote,
      oneTimeProductNotification: decoded.oneTimeProductNotification,
    }));

    if (subNote && GOOGLE_RENEWAL_TYPES.has(subNote.notificationType) && secrets) {
      // RTDN gives us purchaseToken; re-read subscriptionsv2 to obtain the
      // obfuscated external account id (our reverse-map key) + order id.
      const v = await verifyGoogle(
        {
          productId: subNote.subscriptionId,
          purchaseToken: subNote.purchaseToken,
          productType: "subs",
        },
        secrets
      );
      const fields = v.fields || {};
      const accountKey = fields.obfuscatedExternalAccountId;
      if (accountKey) {
        const store = getStore();
        const credit = await creditRenewal(store, {
          platform: "android",
          txnId: v.transactionId || fields.latestOrderId || subNote.purchaseToken,
          accountKey,
          productId: v.productId,
          price: fields.price ?? null,
          currency: fields.currency ?? null,
          notificationType: `RTDN-${subNote.notificationType}`,
          eventTimeMs: decoded.eventTimeMillis
            ? parseInt(decoded.eventTimeMillis, 10)
            : Date.now(),
        });
        console.log(`[google-notification] renewal credit:`, JSON.stringify(credit));
      } else {
        console.warn("[google-notification] no obfuscated account id; cannot map renewal");
      }
    }
  } catch (err) {
    console.error("[google-notification] error:", err.stack || err.message);
  }

  // Google expects 200 OK to acknowledge
  return json(200, { received: true });
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
    case "/code/resolve":
    // Legacy alias: the 0.17.x client posts /affiliate/resolve. Same handler so
    // an in-flight client doesn't 404 (and no longer fails open) until it adopts
    // /code/resolve. Plan §4.1 renames the route.
    case "/affiliate/resolve": {
      const secrets = await getSecrets();
      return handleCodeResolve(event, body, secrets);
    }
    case "/entitlement-token": {
      const secrets = await getSecrets();
      return handleEntitlementToken(body, secrets);
    }
    case "/apple-notifications":
      return handleAppleNotification(body);
    case "/google-notifications": {
      const secrets = await getSecrets();
      return handleGoogleNotification(body, secrets);
    }
    default:
      return json(404, { error: `Unknown route: ${route}` });
  }
};
