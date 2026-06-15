// ===========================================================================
// codes.js — Phase 3 affiliate/discount codes backend (WS-B)
//
// All new logic for the codes feature lives here so verify_purchase.js (a
// shared file, §9.2) needs only minimal additive edits. This module owns:
//   - DynamoDB single-table (`corpan-iap`) access helpers
//   - code classification + purchaseAction selection (§2.2 / §2.4)
//   - resolutionToken (§3) + entitlementToken (§4) HS256 sign/verify
//   - discountLabel localization (Accept-Language → English fallback)
//   - per-subject+IP token-bucket rate-limit (§2.4.6)
//   - the /code/resolve and /entitlement-token route handlers
//   - attribution + ledger write helpers used by verify-purchase + renewals
//
// HS256 is hand-rolled via node `crypto` (no new dependency) — see signJwt.
// ===========================================================================

const crypto = require("crypto");
const {
  DynamoDBClient,
} = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");

// ---------------------------------------------------------------------------
// DynamoDB document client (lazy; table from env, default corpan-iap)
// ---------------------------------------------------------------------------

const TABLE = process.env.DYNAMO_TABLE || "corpan-iap";
const GSI1 = "GSI1";

let _doc = null;
function getDoc() {
  if (_doc) return _doc;
  const base = new DynamoDBClient({});
  _doc = DynamoDBDocumentClient.from(base, {
    marshallOptions: { removeUndefinedValues: true },
  });
  return _doc;
}

// Test seam: allow tests to inject a mock document client.
function setDocClient(doc) {
  _doc = doc;
}

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

// §1 code normalization (mirrors purchase.ts L156-162).
function normalizeCode(raw) {
  if (typeof raw !== "string") return "";
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

const CODE_RE = /^[A-Z0-9_-]{1,32}$/;
function isValidCode(normalized) {
  return CODE_RE.test(normalized);
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

// UTC yyyy-mm partition for ledger PKs.
function yyyymm(date) {
  const d = date ? new Date(date) : new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// ---------------------------------------------------------------------------
// HS256 JWT — hand-rolled (RFC 7519, no external dep)
// ---------------------------------------------------------------------------

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlJson(obj) {
  return b64url(Buffer.from(JSON.stringify(obj)));
}

function b64urlDecodeToString(part) {
  return Buffer.from(part, "base64url").toString("utf8");
}

// `hmacKey` is the base64 string from secrets.codeSigning.hmacKey.
function hmacKeyBytes(hmacKey) {
  if (!hmacKey || typeof hmacKey !== "string") {
    throw new Error("codeSigning.hmacKey missing");
  }
  // Accept base64 (contract: "32+ byte base64 random"). Fall back to raw utf8.
  let key = Buffer.from(hmacKey, "base64");
  if (key.length < 16) key = Buffer.from(hmacKey, "utf8");
  return key;
}

function signJwt(claims, hmacKey, kid = "v1") {
  const header = { alg: "HS256", typ: "JWT", kid };
  const signingInput = `${b64urlJson(header)}.${b64urlJson(claims)}`;
  const sig = crypto
    .createHmac("sha256", hmacKeyBytes(hmacKey))
    .update(signingInput)
    .digest();
  return `${signingInput}.${b64url(sig)}`;
}

// Constant-time signature check. Returns the decoded payload or throws.
function verifyJwt(token, hmacKey) {
  if (typeof token !== "string") throw new Error("token not a string");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("malformed token");
  const [h, p, s] = parts;
  const signingInput = `${h}.${p}`;
  const expected = crypto
    .createHmac("sha256", hmacKeyBytes(hmacKey))
    .update(signingInput)
    .digest();
  const got = Buffer.from(s, "base64url");
  if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) {
    throw new Error("bad signature");
  }
  let payload;
  try {
    payload = JSON.parse(b64urlDecodeToString(p));
  } catch {
    throw new Error("bad payload");
  }
  if (payload.exp && nowSec() >= payload.exp) {
    throw new Error("token expired");
  }
  return payload;
}

const RESOLUTION_ISS = "corpan-codes";
const ENTITLEMENT_ISS = "corpan-ent";
const RESOLUTION_TTL_SEC = 900; // §2.3 expiresInSec: 900 (~15 min)
const ENTITLEMENT_TTL_SEC = 24 * 60 * 60; // §4 ~24h

// Mint a resolutionToken (§3).
function mintResolutionToken(
  { subjectId, code, partnerId, classification, purchaseAction, appleOfferId, googleOfferId, registryVersion },
  hmacKey,
  kid = "v1"
) {
  const iat = nowSec();
  const claims = {
    v: 1,
    iss: RESOLUTION_ISS,
    sub: subjectId,
    code,
    partnerId: partnerId ?? null,
    classification,
    purchaseAction,
    appleOfferId: appleOfferId ?? null,
    googleOfferId: googleOfferId ?? null,
    registryVersion: registryVersion ?? null,
    iat,
    exp: iat + RESOLUTION_TTL_SEC,
  };
  return signJwt(claims, hmacKey, kid);
}

// Validate a resolutionToken for a verify-purchase write (§3 validation).
// Returns { valid, claims, reason }. Attribution is best-effort: callers must
// NEVER block entitlement on an invalid token.
function validateResolutionToken(token, { subjectId, affiliateCode }, hmacKey) {
  if (!token) return { valid: false, reason: "no token" };
  let claims;
  try {
    claims = verifyJwt(token, hmacKey);
  } catch (err) {
    return { valid: false, reason: err.message };
  }
  if (claims.v !== 1) return { valid: false, reason: "bad version" };
  if (claims.iss !== RESOLUTION_ISS) return { valid: false, reason: "bad iss" };
  if (subjectId && claims.sub !== subjectId) {
    return { valid: false, reason: "subject mismatch" };
  }
  if (affiliateCode != null) {
    if (claims.code !== normalizeCode(affiliateCode)) {
      return { valid: false, reason: "code mismatch" };
    }
  }
  return { valid: true, claims };
}

// Mint an entitlementToken (§4).
function mintEntitlementToken({ subjectId, plus, expiresAt }, hmacKey, kid = "v1") {
  const iat = nowSec();
  const claims = {
    iss: ENTITLEMENT_ISS,
    sub: subjectId,
    plus: !!plus,
    expiresAt: expiresAt ?? null,
    iat,
    exp: iat + ENTITLEMENT_TTL_SEC,
  };
  return signJwt(claims, hmacKey, kid);
}

// ---------------------------------------------------------------------------
// discountLabel localization (Accept-Language → English fallback)
// ---------------------------------------------------------------------------

// Minimal built-in label catalog keyed by discountLabelKey. The English value
// from the registry row (discountLabelEn) is always the fallback, so unknown
// keys / languages degrade gracefully. Add localized variants here as i18n
// strings land (WS-C owns ~50-lang strings; the backend only needs a sane set).
const DISCOUNT_LABELS = {
  "code.discount.first_year_30": {
    en: "30% off your first year",
    es: "30% de descuento el primer año",
    fr: "30 % de réduction la première année",
    de: "30 % Rabatt im ersten Jahr",
    pt: "30% de desconto no primeiro ano",
    it: "30% di sconto sul primo anno",
    ja: "初年度 30% オフ",
    ko: "첫 해 30% 할인",
    zh: "首年立减 30%",
  },
};

// Parse an Accept-Language header into an ordered list of base lang codes.
function parseAcceptLanguage(header) {
  if (!header || typeof header !== "string") return [];
  return header
    .split(",")
    .map((part) => {
      const [tag, qPart] = part.trim().split(";");
      const q = qPart && qPart.startsWith("q=") ? parseFloat(qPart.slice(2)) : 1;
      return { tag: tag.trim().toLowerCase(), q: Number.isFinite(q) ? q : 1 };
    })
    .filter((x) => x.tag)
    .sort((a, b) => b.q - a.q)
    .map((x) => x.tag);
}

// Resolve a localized discount label. discountLabelEn is the always-present
// fallback (§2.4 step 4).
function localizeDiscountLabel({ discountLabelKey, discountLabelEn }, acceptLanguage) {
  const fallback = discountLabelEn || null;
  if (!discountLabelKey) return fallback;
  const table = DISCOUNT_LABELS[discountLabelKey];
  if (!table) return fallback;
  const langs = parseAcceptLanguage(acceptLanguage);
  for (const tag of langs) {
    const base = tag.split("-")[0];
    if (table[tag]) return table[tag];
    if (table[base]) return table[base];
  }
  return table.en || fallback;
}

// ---------------------------------------------------------------------------
// Classification + purchaseAction (§2.2 / §2.4)
// ---------------------------------------------------------------------------

// Derive classification from a registry META row. Trusts the row's stored
// `classification` when present, but defends it against the row's actual
// revenueShare/offer fields so a malformed row can't mislabel.
function classifyCode(meta) {
  const hasRevenueShare = Number(meta.revenueSharePct) > 0;
  const hasDiscount = !!(meta.appleOfferIdentifier || meta.googleOfferId);
  if (hasDiscount && hasRevenueShare) return "discount+affiliate";
  if (hasDiscount) return "discount";
  if (hasRevenueShare) return "affiliate";
  // No offer + no revenue share: honor a stored classification if sensible,
  // else treat as a bare affiliate marker (registry hit → still "verified").
  if (meta.classification === "discount" || meta.classification === "affiliate" || meta.classification === "discount+affiliate") {
    return meta.classification;
  }
  return "affiliate";
}

// Pick purchaseAction by platform + offer presence (§2.2 table).
function selectPurchaseAction({ classification, platform, meta }) {
  if (classification === "unknown") return "ATTRIBUTE_UNVERIFIED";
  const isApple = platform === "ios" || platform === "macos";
  const isAndroid = platform === "android";
  const appleOffer = meta && meta.appleOfferIdentifier;
  const googleOffer = meta && meta.googleOfferId;
  if (isApple && appleOffer) return "REDEEM_APPLE_SHEET";
  if (isAndroid && googleOffer) return "USE_OFFER_TOKEN";
  // Registry code but no platform offer this platform → attribute only.
  return "ATTRIBUTE_ONLY";
}

// ---------------------------------------------------------------------------
// DynamoDB access helpers
// ---------------------------------------------------------------------------

// Read a code registry META row. Returns the item or null.
async function getCode(normalized) {
  const out = await getDoc().send(
    new GetCommand({
      TableName: TABLE,
      Key: { PK: `CODE#${normalized}`, SK: "META" },
    })
  );
  return out.Item || null;
}

// Read a subject's attribution lock. Returns the item or null.
async function getAttribution(subjectId) {
  const out = await getDoc().send(
    new GetCommand({
      TableName: TABLE,
      Key: { PK: `SUBJECT#${subjectId}`, SK: "ATTRIBUTION" },
    })
  );
  return out.Item || null;
}

// Idempotent PURCHASE# write. Returns { written:true } on first write, or
// { written:false, conditional:true } when the row already exists (replay).
async function putPurchase(item) {
  try {
    await getDoc().send(
      new PutCommand({
        TableName: TABLE,
        Item: item,
        ConditionExpression: "attribute_not_exists(SK)",
      })
    );
    return { written: true };
  } catch (err) {
    if (isConditionalFail(err)) return { written: false, conditional: true };
    throw err;
  }
}

// First-verified-touch attribution lock (§5.4 step 2). A verified lock never
// overwrites; an unverified lock may upgrade to verified once.
// Returns { written, conditional }.
async function putAttribution(item) {
  try {
    await getDoc().send(
      new PutCommand({
        TableName: TABLE,
        Item: item,
        // No lock yet, OR existing lock is unverified (upgrade-once).
        ConditionExpression:
          "attribute_not_exists(SK) OR #status = :unverified",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":unverified": "unverified" },
      })
    );
    return { written: true };
  } catch (err) {
    if (isConditionalFail(err)) return { written: false, conditional: true };
    throw err;
  }
}

// Conditional ledger event write (idempotent on SK). Returns { written, conditional }.
async function putLedgerEvent(item) {
  try {
    await getDoc().send(
      new PutCommand({
        TableName: TABLE,
        Item: item,
        ConditionExpression: "attribute_not_exists(SK)",
      })
    );
    return { written: true };
  } catch (err) {
    if (isConditionalFail(err)) return { written: false, conditional: true };
    throw err;
  }
}

// Reverse-map a Google obfuscatedExternalAccountId → locked subject via GSI1
// (§7.3). Returns the first ATTRIBUTION item found with a partner lock, or null.
async function findSubjectByObfHash(obfHash) {
  const out = await getDoc().send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: GSI1,
      KeyConditionExpression: "GSI1PK = :h",
      ExpressionAttributeValues: { ":h": obfHash },
    })
  );
  const items = out.Items || [];
  // Prefer the ATTRIBUTION row with a partnerId lock.
  const attr = items.find((it) => it.SK === "ATTRIBUTION" && it.partnerId);
  if (attr) return attr;
  return items.find((it) => it.partnerId) || null;
}

function isConditionalFail(err) {
  return (
    err &&
    (err.name === "ConditionalCheckFailedException" ||
      err.__type === "ConditionalCheckFailedException" ||
      err.code === "ConditionalCheckFailedException")
  );
}

// ---------------------------------------------------------------------------
// Higher-level write flows used by verify-purchase + renewals
// ---------------------------------------------------------------------------

// Best-effort attribution + initial ledger credit for a verified purchase.
// NEVER throws to the caller's critical path — entitlement must not be blocked
// by attribution failure (§1.1). Returns an `affiliateAttribution` summary
// object, or null when nothing was attributed.
async function attributePurchase({
  claims, // validated resolutionToken claims (or null)
  subjectId,
  partnerName, // localized/registry display name (or null)
  platform,
  txnOrOriginalId,
  productId,
  price,
  currency,
  offerApplied,
  offerType,
  offerIdentifier,
  environment,
  appAccountToken,
}) {
  try {
    if (!claims) return null; // no valid token → no attribution write
    const verified =
      claims.classification && claims.classification !== "unknown" && !!claims.partnerId;
    const status = verified ? "verified" : "unverified";
    const code = claims.code;
    const partnerId = claims.partnerId || null;
    const obfHash = sha256Hex(subjectId);
    const nowIso = new Date().toISOString();

    // 1) PURCHASE# idempotency row.
    const purchaseRow = {
      PK: `SUBJECT#${subjectId}`,
      SK: `PURCHASE#${platform}#${txnOrOriginalId}`,
      GSI1PK: obfHash,
      GSI1SK: `PURCHASE#${platform}#${txnOrOriginalId}`,
      productId: productId ?? null,
      code: code ?? null,
      partnerId,
      offerApplied: !!offerApplied,
      offerType: offerType ?? null,
      offerIdentifier: offerIdentifier ?? null,
      price: price ?? null,
      currency: currency ?? null,
      environment: environment ?? null,
      obfHash,
      appAccountToken: appAccountToken ?? null,
      verifiedAt: nowIso,
    };
    const purchaseRes = await putPurchase(purchaseRow);
    if (!purchaseRes.written) {
      // Replay — already processed; no further writes, no double credit (§5.4.1).
      return {
        code,
        locked: true,
        verified,
        partnerName: partnerName ?? null,
        message: replayMessage(verified, partnerName),
        replay: true,
      };
    }

    // 2) ATTRIBUTION lock (first-verified-touch).
    const attrRow = {
      PK: `SUBJECT#${subjectId}`,
      SK: "ATTRIBUTION",
      GSI1PK: obfHash,
      GSI1SK: "ATTRIBUTION",
      code,
      partnerId: partnerId ?? "",
      status,
      lockedAt: nowIso,
      lockSource: "verify-purchase",
      obfHash,
      appAccountToken: appAccountToken ?? "",
    };
    const attrRes = await putAttribution(attrRow);

    // 3) LEDGER initial credit — only for a verified (registry) code.
    if (verified) {
      const ledgerRow = {
        PK: `LEDGER#${partnerId}#${yyyymm(nowIso)}`,
        SK: `EVENT#${platform}#${txnOrOriginalId}`,
        subjectId,
        code,
        productId: productId ?? null,
        price: price ?? null,
        currency: currency ?? null,
        kind: "initial",
        revenueSharePct: claims.revenueSharePct ?? null,
        eventTime: nowIso,
        notificationType: null,
      };
      await putLedgerEvent(ledgerRow);
    }

    return {
      code,
      locked: attrRes.written || true,
      verified,
      partnerName: partnerName ?? null,
      message: verified
        ? `Credited to ${partnerName || partnerId}`
        : "Tracked",
    };
  } catch (err) {
    // Non-fatal: log + omit attribution (§5.5 / §1.1).
    console.error("[codes] attributePurchase failed (non-fatal):", err.message);
    return null;
  }
}

function replayMessage(verified, partnerName) {
  return verified ? `Credited to ${partnerName || "partner"}` : "Tracked";
}

// Renewal ledger credit. Best-effort, idempotent. Returns true if a row was
// written (or already existed), false on no-lock / error.
async function creditRenewal({
  partnerId,
  subjectId,
  platform,
  renewalTxnId,
  productId,
  price,
  currency,
  revenueSharePct,
  notificationType,
}) {
  try {
    if (!partnerId || !renewalTxnId) return false;
    const nowIso = new Date().toISOString();
    const res = await putLedgerEvent({
      PK: `LEDGER#${partnerId}#${yyyymm(nowIso)}`,
      SK: `EVENT#${platform}#${renewalTxnId}`,
      subjectId: subjectId ?? null,
      code: null,
      productId: productId ?? null,
      price: price ?? null,
      currency: currency ?? null,
      kind: "renewal",
      revenueSharePct: revenueSharePct ?? null,
      eventTime: nowIso,
      notificationType: notificationType ?? null,
    });
    return res.written || res.conditional === true;
  } catch (err) {
    console.error("[codes] creditRenewal failed (non-fatal):", err.message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Rate-limit — per subjectId + IP token bucket (§2.4.6)
// ---------------------------------------------------------------------------

// In-memory token bucket. Lambda execution contexts are reused across warm
// invocations, so this blunts enumeration bursts from a single container; it is
// intentionally simple (a DynamoDB-TTL counter is the durable alternative).
const RATE_CAPACITY = 20; // 20 / window
const RATE_WINDOW_MS = 60 * 1000; // per minute
const _buckets = new Map();

function rateLimitAllow(key, now = Date.now()) {
  let b = _buckets.get(key);
  if (!b) {
    b = { tokens: RATE_CAPACITY, ts: now };
    _buckets.set(key, b);
  }
  // Refill proportional to elapsed time.
  const elapsed = now - b.ts;
  if (elapsed > 0) {
    const refill = (elapsed / RATE_WINDOW_MS) * RATE_CAPACITY;
    b.tokens = Math.min(RATE_CAPACITY, b.tokens + refill);
    b.ts = now;
  }
  if (b.tokens >= 1) {
    b.tokens -= 1;
    return true;
  }
  return false;
}

// Test seam.
function _resetRateLimit() {
  _buckets.clear();
}

// ---------------------------------------------------------------------------
// Route handler: POST /code/resolve  (§2)
// ---------------------------------------------------------------------------

// `deps` lets verify_purchase.js inject its `json()` responder + secrets +
// request metadata (acceptLanguage, sourceIp) without circular imports.
async function handleCodeResolve(body, { secrets, json, acceptLanguage, sourceIp }) {
  const { code: rawCode, subjectId, platform } = body || {};

  // 1) Validate input (§2.4 step 1).
  if (!subjectId || !platform) {
    return json(400, { status: "error", error: "missing subjectId or platform" });
  }
  const normalized = normalizeCode(rawCode);
  if (!isValidCode(normalized)) {
    return json(400, { status: "error", error: "invalid code" });
  }

  // 6) Rate-limit (§2.4.6).
  const rlKey = `${subjectId}|${sourceIp || "?"}`;
  if (!rateLimitAllow(rlKey)) {
    return json(429, { status: "error", error: "rate limited" });
  }

  const hmac = secrets?.codeSigning?.hmacKey;
  const kid = secrets?.codeSigning?.kid || "v1";

  try {
    if (!hmac) throw new Error("signer not configured");

    // 2) Read registry row.
    let meta = null;
    try {
      meta = await getCode(normalized);
    } catch (err) {
      // Registry read failure → NO fail-open (§2.3): explicit error.
      console.error("[codes] registry read failed:", err.message);
      return json(502, { status: "error", error: "code check failed" });
    }

    // 3) Miss or inactive → unknown / ATTRIBUTE_UNVERIFIED (still issues token).
    const active = meta && meta.active !== false;
    if (!meta || !active) {
      const token = mintResolutionToken(
        {
          subjectId,
          code: normalized,
          partnerId: null,
          classification: "unknown",
          purchaseAction: "ATTRIBUTE_UNVERIFIED",
          appleOfferId: null,
          googleOfferId: null,
          registryVersion: null,
        },
        hmac,
        kid
      );
      return json(200, {
        status: "ok",
        code: normalized,
        classification: "unknown",
        purchaseAction: "ATTRIBUTE_UNVERIFIED",
        partnerName: null,
        discountLabel: null,
        offerId: null,
        offerTokenHint: null,
        appleOfferId: null,
        resolutionToken: token,
        expiresInSec: RESOLUTION_TTL_SEC,
      });
    }

    // 4) Hit → classify + select action + localize.
    const classification = classifyCode(meta);
    const purchaseAction = selectPurchaseAction({ classification, platform, meta });
    const hasDiscount = classification === "discount" || classification === "discount+affiliate";
    const isAffiliate = classification === "affiliate" || classification === "discount+affiliate";
    const discountLabel = hasDiscount
      ? localizeDiscountLabel(
          { discountLabelKey: meta.discountLabelKey, discountLabelEn: meta.discountLabelEn },
          acceptLanguage
        )
      : null;
    const partnerName = isAffiliate ? meta.partnerName || partnerDisplayName(meta) : null;
    const appleOfferId = meta.appleOfferIdentifier || null;
    const googleOfferId = meta.googleOfferId || null;

    // 5) Mint token.
    const token = mintResolutionToken(
      {
        subjectId,
        code: normalized,
        partnerId: meta.partnerId || null,
        classification,
        purchaseAction,
        appleOfferId,
        googleOfferId,
        registryVersion: meta.registryVersion ?? null,
      },
      hmac,
      kid
    );

    // Per-branch response shape (§2.3).
    const resp = {
      status: "ok",
      code: normalized,
      classification,
      purchaseAction,
      partnerName,
      discountLabel,
      offerId: null,
      offerTokenHint: null,
      appleOfferId: null,
      resolutionToken: token,
      expiresInSec: RESOLUTION_TTL_SEC,
    };

    if (purchaseAction === "REDEEM_APPLE_SHEET") {
      resp.appleOfferId = appleOfferId;
      if (meta.appleAscOfferId) {
        resp.appleRedeemUrl = `https://apps.apple.com/redeem?ctx=offercode&id=${encodeURIComponent(
          meta.appleAscOfferId
        )}&code=${encodeURIComponent(normalized)}`;
      }
    } else if (purchaseAction === "USE_OFFER_TOKEN") {
      resp.offerId = googleOfferId;
      resp.offerTokenHint = {
        googleOfferId,
        basePlanId: meta.googleBasePlanId || null,
        offerTags: meta.googleOfferTags || (googleOfferId ? [googleOfferId] : []),
      };
    }

    return json(200, resp);
  } catch (err) {
    // Signer / unexpected error → NO fail-open (§2.3).
    console.error("[codes] resolve failed:", err.message);
    return json(502, { status: "error", error: "code check failed" });
  }
}

function partnerDisplayName(meta) {
  // The registry META carries partnerId; the human name lives on PARTNER#<id>.
  // For resolve latency we accept partnerName if denormalized on the code row,
  // else title-case the id as a safe fallback.
  if (meta.partnerName) return meta.partnerName;
  const id = meta.partnerId || "";
  if (!id) return null;
  return id.charAt(0).toUpperCase() + id.slice(1);
}

// ---------------------------------------------------------------------------
// Route handler: POST /entitlement-token  (§4)
// ---------------------------------------------------------------------------

async function handleEntitlementToken(body, { secrets, json }) {
  const { subjectId } = body || {};
  if (!subjectId) {
    return json(400, { status: "failed", error: "missing subjectId" });
  }
  const hmac = secrets?.codeSigning?.hmacKey;
  const kid = secrets?.codeSigning?.kid || "v1";

  try {
    if (!hmac) throw new Error("signer not configured");

    // Read the most-recent non-expired PURCHASE row for the subject.
    const entitlement = await readLatestEntitlement(subjectId);

    if (!entitlement || !entitlement.plus) {
      return json(200, { status: "failed", subjectId, plus: false });
    }

    const token = mintEntitlementToken(
      { subjectId, plus: true, expiresAt: entitlement.expiresAt },
      hmac,
      kid
    );
    return json(200, {
      status: "ok",
      subjectId,
      plus: true,
      expiresAt: entitlement.expiresAt,
      entitlementToken: token,
    });
  } catch (err) {
    console.error("[codes] entitlement-token failed:", err.message);
    // Additive convenience route — degrade to failed (CloudFront gate is the
    // real boundary, §4). Not an entitlement decision.
    return json(200, { status: "failed", subjectId, plus: false });
  }
}

// Find the latest active subscription entitlement for a subject by querying
// SUBJECT#<id>/PURCHASE# rows. Returns { plus, expiresAt } or null.
async function readLatestEntitlement(subjectId) {
  const out = await getDoc().send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `SUBJECT#${subjectId}`,
        ":sk": "PURCHASE#",
      },
    })
  );
  const items = out.Items || [];
  let best = null;
  const now = Date.now();
  for (const it of items) {
    const exp = it.expiresAt ? Date.parse(it.expiresAt) : null;
    const active = exp == null ? false : exp > now;
    if (!active) continue;
    if (!best || (exp && Date.parse(best.expiresAt) < exp)) {
      best = { plus: true, expiresAt: it.expiresAt };
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  // utilities
  normalizeCode,
  isValidCode,
  sha256Hex,
  yyyymm,
  parseAcceptLanguage,
  // jwt
  signJwt,
  verifyJwt,
  mintResolutionToken,
  validateResolutionToken,
  mintEntitlementToken,
  RESOLUTION_ISS,
  ENTITLEMENT_ISS,
  RESOLUTION_TTL_SEC,
  ENTITLEMENT_TTL_SEC,
  // localization
  localizeDiscountLabel,
  // classification
  classifyCode,
  selectPurchaseAction,
  // dynamodb access
  setDocClient,
  getCode,
  getAttribution,
  putPurchase,
  putAttribution,
  putLedgerEvent,
  findSubjectByObfHash,
  readLatestEntitlement,
  // flows
  attributePurchase,
  creditRenewal,
  // rate limit
  rateLimitAllow,
  _resetRateLimit,
  // handlers
  handleCodeResolve,
  handleEntitlementToken,
};
