const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const { getSignedUrl } = require("@aws-sdk/cloudfront-signer");
const { AppStoreServerAPIClient, Environment, SignedDataVerifier, VerificationStatus } = require("@apple/app-store-server-library");
const { google } = require("googleapis");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const json = (statusCode, payload) => ({
  statusCode,
  headers: {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type, x-dev-bypass",
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

  // The receipt from StoreKit 2 is a JWS signed transaction
  // We can verify it locally using Apple's root certificates
  const environment = process.env.NODE_ENV === "production"
    ? Environment.PRODUCTION
    : Environment.SANDBOX;

  try {
    const client = new AppStoreServerAPIClient(
      appleSecrets.privateKey,
      appleSecrets.key_id,
      appleSecrets.issuer_id,
      appleSecrets.bundleId || "com.corpora.corpan",
      environment
    );

    // Get transaction info from Apple
    const txInfo = await client.getTransactionInfo(transactionId);

    if (!txInfo || !txInfo.signedTransactionInfo) {
      return { verified: false, error: "Transaction not found" };
    }

    // Decode the signed transaction (JWS)
    const verifier = new SignedDataVerifier(
      [], // Apple root certs are bundled in the library
      true, // enableOnlineChecks
      environment,
      appleSecrets.bundleId || "com.corpora.corpan",
      null // appAppleId (optional)
    );

    const decoded = await verifier.verifyAndDecodeTransaction(
      txInfo.signedTransactionInfo
    );

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
    };
  } catch (err) {
    console.error("[apple] Verification error:", err);
    return { verified: false, error: `Apple verification failed: ${err.message}` };
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
      // Subscription verification
      const res = await androidPublisher.purchases.subscriptions.get({
        packageName,
        subscriptionId: productId,
        token: purchaseToken,
      });

      const sub = res.data;
      const expiryMs = parseInt(sub.expiryTimeMillis || "0", 10);
      const subscriptionActive = expiryMs > Date.now();

      return {
        verified: sub.paymentState !== undefined,
        transactionId: sub.orderId,
        productId,
        isSubscription: true,
        subscriptionActive,
        expiresAt: expiryMs ? new Date(expiryMs).toISOString() : null,
        autoRenewing: sub.autoRenewing || false,
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

      return {
        verified,
        transactionId: purchase.orderId,
        productId,
        isSubscription: false,
        subscriptionActive: false,
        acknowledged: purchase.acknowledgementState === 1,
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

  // For subscription or individual purchase, generate a signed download URL
  const response = {
    status: "verified",
    transactionId: result.transactionId,
    productId: result.productId,
    subscriptionActive: result.subscriptionActive || false,
    expiresAt: result.expiresAt || null,
  };

  // Generate signed URL if a specific pack was requested
  if (packId) {
    try {
      const signingKey = secrets.cloudfront?.signingPrivateKey;
      // Premium content lives at narrations/premium/{packId}.zip
      // The exact filename comes from the catalog, but we construct a pattern
      const downloadPath = `narrations/premium/${packId}.zip`;
      response.signedUrl = generateSignedDownloadUrl(downloadPath, signingKey);
    } catch (err) {
      console.warn("[signed-url] Could not generate signed URL:", err.message);
      // Non-fatal: verification succeeded, signed URL is a bonus
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

async function handleAppleNotification(body) {
  // Apple sends { signedPayload: "..." } — a JWS signed notification
  const { signedPayload } = body;

  if (!signedPayload) {
    return json(400, { error: "Missing signedPayload" });
  }

  // Log for analytics/audit — decode without full verification for now
  try {
    const parts = signedPayload.split(".");
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
      console.log("[apple-notification]", JSON.stringify({
        notificationType: payload.notificationType,
        subtype: payload.subtype,
        notificationUUID: payload.notificationUUID,
      }));
    }
  } catch (err) {
    console.error("[apple-notification] Parse error:", err.message);
  }

  // Apple expects 200 OK to acknowledge receipt
  return json(200, { received: true });
}

// ---------------------------------------------------------------------------
// Route: POST /google-notifications (Google RTDN via Cloud Pub/Sub)
// ---------------------------------------------------------------------------

async function handleGoogleNotification(body) {
  // Google sends { message: { data: "<base64>", messageId: "..." }, subscription: "..." }
  const { message } = body;

  if (!message || !message.data) {
    return json(400, { error: "Missing message.data" });
  }

  try {
    const decoded = JSON.parse(Buffer.from(message.data, "base64").toString());
    console.log("[google-notification]", JSON.stringify({
      packageName: decoded.packageName,
      eventTimeMillis: decoded.eventTimeMillis,
      subscriptionNotification: decoded.subscriptionNotification,
      oneTimeProductNotification: decoded.oneTimeProductNotification,
    }));
  } catch (err) {
    console.error("[google-notification] Parse error:", err.message);
  }

  // Google expects 200 OK to acknowledge
  return json(200, { received: true });
}

// ---------------------------------------------------------------------------
// Main handler (routes by API Gateway routeKey)
// ---------------------------------------------------------------------------

exports.handler = async (event) => {
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
    // If packId provided, generate a real signed URL for download testing
    if (body.packId) {
      try {
        const secrets = await getSecrets();
        const downloadPath = `narrations/premium/${body.packId}.zip`;
        response.signedUrl = generateSignedDownloadUrl(
          downloadPath,
          secrets.cloudfront.signingPrivateKey
        );
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
    case "/apple-notifications":
      return handleAppleNotification(body);
    case "/google-notifications":
      return handleGoogleNotification(body);
    default:
      return json(404, { error: `Unknown route: ${route}` });
  }
};
