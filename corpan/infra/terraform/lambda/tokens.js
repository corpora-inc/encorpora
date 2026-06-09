// ---------------------------------------------------------------------------
// Short-lived signed tokens (resolutionToken + entitlementToken)
// ---------------------------------------------------------------------------
//
// Open-source client → server-authoritative everything. A resolutionToken binds
// {code, subjectId, kind, registryVersion, exp} so a hacked client cannot write
// "partner X" against an arbitrary purchase or replay an attribution. The
// entitlementToken attests {subjectId, plus, exp}.
//
// We use HMAC-SHA256 with a secret stored in Secrets Manager (the plan allows
// KMS Sign/Verify OR a secret-derived HMAC; HMAC keeps the hot path local — no
// per-request KMS call — and is trivially testable). Format is a compact
// JWS-like `base64url(header).base64url(payload).base64url(sig)`.
//
// Pure crypto only (node:crypto built-in) — fully unit-testable, no AWS calls.

const crypto = require("crypto");

const DEFAULT_RESOLUTION_TTL_SEC = 300; // 5 min
const DEFAULT_ENTITLEMENT_TTL_SEC = 24 * 60 * 60; // 24h

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

function fromB64url(str) {
  return Buffer.from(str, "base64url");
}

function hmac(secret, data) {
  return crypto.createHmac("sha256", secret).update(data).digest();
}

/**
 * Sign an arbitrary claims object. `typ` distinguishes token classes so a
 * resolutionToken can never be replayed as an entitlementToken and vice versa.
 */
function signToken(secret, typ, claims, ttlSec) {
  if (!secret) throw new Error("Token signing secret not configured");
  const nowSec = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ };
  const payload = {
    ...claims,
    iat: nowSec,
    exp: nowSec + ttlSec,
  };
  const headerB64 = b64url(JSON.stringify(header));
  const payloadB64 = b64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const sig = b64url(hmac(secret, signingInput));
  return `${signingInput}.${sig}`;
}

/**
 * Verify + decode a token. Returns { valid, payload?, reason? }.
 * Checks: structure, typ match, constant-time signature, expiry.
 */
function verifyToken(secret, typ, token, nowSec = Math.floor(Date.now() / 1000)) {
  if (!secret) return { valid: false, reason: "no_secret" };
  if (typeof token !== "string" || token.length === 0) {
    return { valid: false, reason: "missing" };
  }
  const parts = token.split(".");
  if (parts.length !== 3) return { valid: false, reason: "malformed" };
  const [headerB64, payloadB64, sigB64] = parts;
  const signingInput = `${headerB64}.${payloadB64}`;
  const expectedSig = hmac(secret, signingInput);

  let presentedSig;
  try {
    presentedSig = fromB64url(sigB64);
  } catch {
    return { valid: false, reason: "bad_signature_encoding" };
  }
  if (
    presentedSig.length !== expectedSig.length ||
    !crypto.timingSafeEqual(presentedSig, expectedSig)
  ) {
    return { valid: false, reason: "bad_signature" };
  }

  let header, payload;
  try {
    header = JSON.parse(fromB64url(headerB64).toString());
    payload = JSON.parse(fromB64url(payloadB64).toString());
  } catch {
    return { valid: false, reason: "bad_json" };
  }
  if (header.typ !== typ) return { valid: false, reason: "wrong_type" };
  if (typeof payload.exp !== "number" || payload.exp <= nowSec) {
    return { valid: false, reason: "expired" };
  }
  return { valid: true, payload };
}

// --- resolutionToken ------------------------------------------------------

function signResolutionToken(secret, { code, subjectId, kind, registryVersion }, ttlSec = DEFAULT_RESOLUTION_TTL_SEC) {
  return signToken(
    secret,
    "corpan-resolution",
    { code, subjectId, kind, registryVersion: registryVersion || 0 },
    ttlSec
  );
}

/**
 * Verify a resolutionToken AND bind it to the presented {subjectId, code}.
 * A token issued for subject A / code FOO cannot be attached to subject B or a
 * different code.
 */
function verifyResolutionToken(secret, token, { subjectId, code }, nowSec) {
  const res = verifyToken(secret, "corpan-resolution", token, nowSec);
  if (!res.valid) return res;
  const p = res.payload;
  if (subjectId != null && p.subjectId !== subjectId) {
    return { valid: false, reason: "subject_mismatch" };
  }
  if (code != null && p.code !== code) {
    return { valid: false, reason: "code_mismatch" };
  }
  return res;
}

// --- entitlementToken -----------------------------------------------------

function signEntitlementToken(secret, { subjectId, plus, expiresAt }, ttlSec = DEFAULT_ENTITLEMENT_TTL_SEC) {
  return signToken(
    secret,
    "corpan-entitlement",
    { subjectId, plus: Boolean(plus), entExpiresAt: expiresAt || null },
    ttlSec
  );
}

function verifyEntitlementToken(secret, token, nowSec) {
  return verifyToken(secret, "corpan-entitlement", token, nowSec);
}

module.exports = {
  DEFAULT_RESOLUTION_TTL_SEC,
  DEFAULT_ENTITLEMENT_TTL_SEC,
  signToken,
  verifyToken,
  signResolutionToken,
  verifyResolutionToken,
  signEntitlementToken,
  verifyEntitlementToken,
};
