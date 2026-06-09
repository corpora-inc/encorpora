const test = require("node:test");
const assert = require("node:assert/strict");
const {
  signResolutionToken,
  verifyResolutionToken,
  signEntitlementToken,
  verifyEntitlementToken,
} = require("../tokens");

const SECRET = "test-hmac-secret-not-real";

test("resolutionToken round-trips and binds subject+code", () => {
  const token = signResolutionToken(SECRET, {
    code: "LCCLT",
    subjectId: "subj-1",
    kind: "affiliate+offer",
    registryVersion: 1,
  });
  const ok = verifyResolutionToken(SECRET, token, { subjectId: "subj-1", code: "LCCLT" });
  assert.equal(ok.valid, true);
  assert.equal(ok.payload.kind, "affiliate+offer");
  assert.equal(ok.payload.code, "LCCLT");
});

test("resolutionToken rejects subject mismatch", () => {
  const token = signResolutionToken(SECRET, { code: "LCCLT", subjectId: "subj-1", kind: "affiliate" });
  const res = verifyResolutionToken(SECRET, token, { subjectId: "OTHER", code: "LCCLT" });
  assert.equal(res.valid, false);
  assert.equal(res.reason, "subject_mismatch");
});

test("resolutionToken rejects code mismatch", () => {
  const token = signResolutionToken(SECRET, { code: "LCCLT", subjectId: "subj-1", kind: "affiliate" });
  const res = verifyResolutionToken(SECRET, token, { subjectId: "subj-1", code: "EVIL" });
  assert.equal(res.valid, false);
  assert.equal(res.reason, "code_mismatch");
});

test("resolutionToken rejects tampered signature", () => {
  const token = signResolutionToken(SECRET, { code: "LCCLT", subjectId: "subj-1", kind: "affiliate" });
  const parts = token.split(".");
  // flip the payload (claims) without re-signing
  const forgedPayload = Buffer.from(
    JSON.stringify({ code: "LCCLT", subjectId: "subj-1", kind: "affiliate", exp: 9999999999 })
  ).toString("base64url");
  const forged = `${parts[0]}.${forgedPayload}.${parts[2]}`;
  const res = verifyResolutionToken(SECRET, forged, { subjectId: "subj-1", code: "LCCLT" });
  assert.equal(res.valid, false);
  assert.equal(res.reason, "bad_signature");
});

test("resolutionToken rejects wrong secret", () => {
  const token = signResolutionToken(SECRET, { code: "LCCLT", subjectId: "subj-1", kind: "affiliate" });
  const res = verifyResolutionToken("other-secret", token, { subjectId: "subj-1", code: "LCCLT" });
  assert.equal(res.valid, false);
});

test("resolutionToken expires", () => {
  const token = signResolutionToken(
    SECRET,
    { code: "LCCLT", subjectId: "subj-1", kind: "affiliate" },
    1 // 1s TTL
  );
  const future = Math.floor(Date.now() / 1000) + 5;
  const res = verifyResolutionToken(SECRET, token, { subjectId: "subj-1", code: "LCCLT" }, future);
  assert.equal(res.valid, false);
  assert.equal(res.reason, "expired");
});

test("token classes are not interchangeable (typ binding)", () => {
  const resToken = signResolutionToken(SECRET, { code: "X", subjectId: "s", kind: "affiliate" });
  // a resolution token must NOT verify as an entitlement token
  const res = verifyEntitlementToken(SECRET, resToken);
  assert.equal(res.valid, false);
  assert.equal(res.reason, "wrong_type");
});

test("entitlementToken round-trips with plus flag", () => {
  const token = signEntitlementToken(SECRET, { subjectId: "subj-1", plus: true, expiresAt: "2027-01-01T00:00:00Z" });
  const res = verifyEntitlementToken(SECRET, token);
  assert.equal(res.valid, true);
  assert.equal(res.payload.subjectId, "subj-1");
  assert.equal(res.payload.plus, true);
});

test("missing secret → invalid (no fail-open)", () => {
  const res = verifyResolutionToken("", "anything", { subjectId: "s", code: "c" });
  assert.equal(res.valid, false);
  assert.equal(res.reason, "no_secret");
});
