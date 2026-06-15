// codes.test.js — WS-B unit tests (node:test). No live AWS: the DynamoDB
// document client is mocked via codes.setDocClient.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const codes = require("./codes");

const HMAC_KEY = Buffer.from("test-hmac-key-at-least-32-bytes-long!!").toString("base64");

// ---------------------------------------------------------------------------
// Mock DynamoDB document client
// ---------------------------------------------------------------------------

// A minimal in-memory store keyed by `${PK}|${SK}` honoring the conditional
// expressions codes.js uses (attribute_not_exists(SK) / status==unverified).
function makeMockDoc() {
  const store = new Map();
  const key = (it) => `${it.PK}|${it.SK}`;
  const sends = [];
  const doc = {
    store,
    sends,
    async send(cmd) {
      const name = cmd.constructor.name;
      sends.push(name);
      const input = cmd.input;
      if (name === "GetCommand") {
        const it = store.get(`${input.Key.PK}|${input.Key.SK}`);
        return { Item: it ? { ...it } : undefined };
      }
      if (name === "PutCommand") {
        const it = input.Item;
        const existing = store.get(key(it));
        const cond = input.ConditionExpression || "";
        if (cond.includes("attribute_not_exists(SK)")) {
          if (existing) {
            // allow upgrade-once form: OR #status = :unverified
            if (
              cond.includes(":unverified") &&
              existing.status === "unverified"
            ) {
              store.set(key(it), { ...it });
              return {};
            }
            const e = new Error("conditional failed");
            e.name = "ConditionalCheckFailedException";
            throw e;
          }
        }
        store.set(key(it), { ...it });
        return {};
      }
      if (name === "QueryCommand") {
        const items = [...store.values()];
        // GSI1 query by GSI1PK
        if (input.IndexName === "GSI1") {
          const h = input.ExpressionAttributeValues[":h"];
          return { Items: items.filter((it) => it.GSI1PK === h) };
        }
        // PURCHASE# begins_with query
        const pk = input.ExpressionAttributeValues[":pk"];
        const skPrefix = input.ExpressionAttributeValues[":sk"];
        return {
          Items: items.filter(
            (it) => it.PK === pk && (!skPrefix || String(it.SK).startsWith(skPrefix))
          ),
        };
      }
      throw new Error("unhandled command " + name);
    },
  };
  return doc;
}

function jsonResponder() {
  const calls = [];
  const json = (statusCode, payload) => {
    calls.push({ statusCode, payload });
    return { statusCode, body: JSON.stringify(payload) };
  };
  return { json, calls };
}

function freshDoc() {
  const doc = makeMockDoc();
  codes.setDocClient(doc);
  codes._resetRateLimit();
  return doc;
}

const SECRETS = { codeSigning: { hmacKey: HMAC_KEY, kid: "v1" } };

// A discount+affiliate registry META row.
const IAN_META = {
  PK: "CODE#IAN30",
  SK: "META",
  partnerId: "ian",
  partnerName: "Ian",
  classification: "discount+affiliate",
  appleOfferIdentifier: "IAN30",
  googleOfferId: "code-ian30",
  googleOfferTags: ["code-ian30"],
  googleBasePlanId: "annual",
  discountLabelKey: "code.discount.first_year_30",
  discountLabelEn: "30% off your first year",
  revenueSharePct: 0.3,
  active: true,
  registryVersion: 1,
};

// ===========================================================================
// Classification
// ===========================================================================

test("classifyCode: discount+affiliate (revenue share + offer)", () => {
  assert.equal(codes.classifyCode(IAN_META), "discount+affiliate");
});

test("classifyCode: discount only (offer, no revenue share)", () => {
  assert.equal(
    codes.classifyCode({ appleOfferIdentifier: "X", revenueSharePct: 0 }),
    "discount"
  );
});

test("classifyCode: affiliate only (revenue share, no offer)", () => {
  assert.equal(
    codes.classifyCode({ revenueSharePct: 0.3 }),
    "affiliate"
  );
});

test("selectPurchaseAction branches by platform + offer presence", () => {
  assert.equal(
    codes.selectPurchaseAction({ classification: "discount+affiliate", platform: "ios", meta: IAN_META }),
    "REDEEM_APPLE_SHEET"
  );
  assert.equal(
    codes.selectPurchaseAction({ classification: "discount+affiliate", platform: "android", meta: IAN_META }),
    "USE_OFFER_TOKEN"
  );
  assert.equal(
    codes.selectPurchaseAction({ classification: "affiliate", platform: "ios", meta: { revenueSharePct: 0.3 } }),
    "ATTRIBUTE_ONLY"
  );
  assert.equal(
    codes.selectPurchaseAction({ classification: "unknown", platform: "ios", meta: null }),
    "ATTRIBUTE_UNVERIFIED"
  );
});

// ===========================================================================
// HS256 sign/verify roundtrip + tamper/expiry
// ===========================================================================

test("HS256 sign + verify roundtrip", () => {
  const token = codes.signJwt({ iss: "corpan-codes", sub: "abc", exp: codes_nowSec() + 100 }, HMAC_KEY);
  const payload = codes.verifyJwt(token, HMAC_KEY);
  assert.equal(payload.sub, "abc");
  assert.equal(payload.iss, "corpan-codes");
});

test("HS256 rejects tampered payload", () => {
  const token = codes.signJwt({ sub: "abc", exp: codes_nowSec() + 100 }, HMAC_KEY);
  const [h, , s] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ sub: "evil", exp: codes_nowSec() + 100 })).toString("base64url");
  const tampered = `${h}.${forged}.${s}`;
  assert.throws(() => codes.verifyJwt(tampered, HMAC_KEY), /bad signature/);
});

test("HS256 rejects wrong key", () => {
  const token = codes.signJwt({ sub: "abc", exp: codes_nowSec() + 100 }, HMAC_KEY);
  const otherKey = Buffer.from("a-totally-different-key-32-bytes-xxxxx").toString("base64");
  assert.throws(() => codes.verifyJwt(token, otherKey), /bad signature/);
});

test("HS256 rejects expired token", () => {
  const token = codes.signJwt({ sub: "abc", exp: codes_nowSec() - 5 }, HMAC_KEY);
  assert.throws(() => codes.verifyJwt(token, HMAC_KEY), /expired/);
});

test("validateResolutionToken: subject + code binding", () => {
  const token = codes.mintResolutionToken(
    { subjectId: "sub-1", code: "IAN30", partnerId: "ian", classification: "discount+affiliate", purchaseAction: "REDEEM_APPLE_SHEET", appleOfferId: "IAN30", googleOfferId: "code-ian30", registryVersion: 1 },
    HMAC_KEY
  );
  const ok = codes.validateResolutionToken(token, { subjectId: "sub-1", affiliateCode: "ian30" }, HMAC_KEY);
  assert.equal(ok.valid, true);
  assert.equal(ok.claims.partnerId, "ian");

  // subject mismatch
  const bad = codes.validateResolutionToken(token, { subjectId: "other", affiliateCode: "IAN30" }, HMAC_KEY);
  assert.equal(bad.valid, false);
  assert.equal(bad.reason, "subject mismatch");

  // code mismatch
  const bad2 = codes.validateResolutionToken(token, { subjectId: "sub-1", affiliateCode: "SKY30" }, HMAC_KEY);
  assert.equal(bad2.valid, false);
});

function codes_nowSec() {
  return Math.floor(Date.now() / 1000);
}

// ===========================================================================
// discountLabel localization
// ===========================================================================

test("localizeDiscountLabel: Accept-Language with English fallback", () => {
  const meta = { discountLabelKey: "code.discount.first_year_30", discountLabelEn: "30% off your first year" };
  assert.equal(codes.localizeDiscountLabel(meta, "es-MX,es;q=0.9,en;q=0.8"), "30% de descuento el primer año");
  assert.equal(codes.localizeDiscountLabel(meta, "qq,zz"), "30% off your first year");
  assert.equal(codes.localizeDiscountLabel(meta, undefined), "30% off your first year");
  // unknown key → english fallback
  assert.equal(codes.localizeDiscountLabel({ discountLabelKey: "nope", discountLabelEn: "Fallback" }, "es"), "Fallback");
});

// ===========================================================================
// /code/resolve handler
// ===========================================================================

test("handleCodeResolve: Apple discount+affiliate → REDEEM_APPLE_SHEET", async () => {
  const doc = freshDoc();
  doc.store.set("CODE#IAN30|META", IAN_META);
  const { json, calls } = jsonResponder();
  await codes.handleCodeResolve(
    { code: "ian30", subjectId: "sub-1", platform: "ios" },
    { secrets: SECRETS, json, acceptLanguage: "es", sourceIp: "1.2.3.4" }
  );
  const r = calls[0];
  assert.equal(r.statusCode, 200);
  assert.equal(r.payload.status, "ok");
  assert.equal(r.payload.classification, "discount+affiliate");
  assert.equal(r.payload.purchaseAction, "REDEEM_APPLE_SHEET");
  assert.equal(r.payload.appleOfferId, "IAN30");
  assert.equal(r.payload.partnerName, "Ian");
  assert.equal(r.payload.discountLabel, "30% de descuento el primer año");
  assert.ok(r.payload.resolutionToken);
  // token validates + carries the partner
  const v = codes.validateResolutionToken(r.payload.resolutionToken, { subjectId: "sub-1" }, HMAC_KEY);
  assert.equal(v.valid, true);
  assert.equal(v.claims.partnerId, "ian");
});

test("handleCodeResolve: Android → USE_OFFER_TOKEN with offerTokenHint", async () => {
  const doc = freshDoc();
  doc.store.set("CODE#IAN30|META", IAN_META);
  const { json, calls } = jsonResponder();
  await codes.handleCodeResolve(
    { code: "IAN30", subjectId: "sub-2", platform: "android" },
    { secrets: SECRETS, json }
  );
  const r = calls[0].payload;
  assert.equal(r.purchaseAction, "USE_OFFER_TOKEN");
  assert.equal(r.offerId, "code-ian30");
  assert.deepEqual(r.offerTokenHint.offerTags, ["code-ian30"]);
  assert.equal(r.offerTokenHint.basePlanId, "annual");
});

test("handleCodeResolve: miss → unknown / ATTRIBUTE_UNVERIFIED (still tokens)", async () => {
  freshDoc();
  const { json, calls } = jsonResponder();
  await codes.handleCodeResolve(
    { code: "FOO", subjectId: "sub-3", platform: "ios" },
    { secrets: SECRETS, json }
  );
  const r = calls[0].payload;
  assert.equal(r.status, "ok");
  assert.equal(r.classification, "unknown");
  assert.equal(r.purchaseAction, "ATTRIBUTE_UNVERIFIED");
  assert.equal(r.partnerName, null);
  assert.ok(r.resolutionToken);
});

test("handleCodeResolve: bad input → 400 status:error (not ok)", async () => {
  freshDoc();
  const { json, calls } = jsonResponder();
  await codes.handleCodeResolve({ code: "IAN30", platform: "ios" }, { secrets: SECRETS, json });
  assert.equal(calls[0].statusCode, 400);
  assert.equal(calls[0].payload.status, "error");
  assert.notEqual(calls[0].payload.status, "ok");
});

test("handleCodeResolve: registry read error → 502 status:error (no fail-open)", async () => {
  const doc = freshDoc();
  doc.send = async () => { throw new Error("dynamo down"); };
  const { json, calls } = jsonResponder();
  await codes.handleCodeResolve(
    { code: "IAN30", subjectId: "sub-4", platform: "ios" },
    { secrets: SECRETS, json }
  );
  assert.equal(calls[0].statusCode, 502);
  assert.equal(calls[0].payload.status, "error");
});

test("handleCodeResolve: rate-limit → 429 status:error", async () => {
  const doc = freshDoc();
  doc.store.set("CODE#IAN30|META", IAN_META);
  const { json, calls } = jsonResponder();
  // 20 allowed, 21st blocked (same subject+IP key)
  for (let i = 0; i < 20; i++) {
    await codes.handleCodeResolve(
      { code: "IAN30", subjectId: "sub-rl", platform: "ios" },
      { secrets: SECRETS, json, sourceIp: "9.9.9.9" }
    );
  }
  await codes.handleCodeResolve(
    { code: "IAN30", subjectId: "sub-rl", platform: "ios" },
    { secrets: SECRETS, json, sourceIp: "9.9.9.9" }
  );
  const last = calls[calls.length - 1];
  assert.equal(last.statusCode, 429);
  assert.equal(last.payload.status, "error");
});

// ===========================================================================
// attributePurchase — idempotency + first-verified-touch lock + ledger
// ===========================================================================

function verifiedClaims(over = {}) {
  return {
    v: 1,
    iss: "corpan-codes",
    sub: "sub-A",
    code: "IAN30",
    partnerId: "ian",
    classification: "discount+affiliate",
    purchaseAction: "REDEEM_APPLE_SHEET",
    appleOfferId: "IAN30",
    googleOfferId: "code-ian30",
    revenueSharePct: 0.3,
    registryVersion: 1,
    ...over,
  };
}

test("attributePurchase: first verified write creates purchase + lock + ledger", async () => {
  const doc = freshDoc();
  const out = await codes.attributePurchase({
    claims: verifiedClaims(),
    subjectId: "sub-A",
    partnerName: "Ian",
    platform: "apple",
    txnOrOriginalId: "orig-1",
    productId: "corpan.sub.annual",
    price: 1999,
    currency: "USD",
    offerApplied: true,
    offerType: 3,
    offerIdentifier: "IAN30",
    environment: "Production",
    appAccountToken: "sub-A",
  });
  assert.equal(out.verified, true);
  assert.equal(out.locked, true);
  assert.ok(out.message.includes("Ian"));
  // rows present
  assert.ok(doc.store.get("SUBJECT#sub-A|PURCHASE#apple#orig-1"));
  assert.ok(doc.store.get("SUBJECT#sub-A|ATTRIBUTION"));
  const ledgerKeys = [...doc.store.keys()].filter((k) => k.startsWith("LEDGER#ian#"));
  assert.equal(ledgerKeys.length, 1);
  assert.equal(doc.store.get(ledgerKeys[0]).kind, "initial");
});

test("attributePurchase: replayed txn → no double credit", async () => {
  const doc = freshDoc();
  const args = {
    claims: verifiedClaims(),
    subjectId: "sub-A",
    partnerName: "Ian",
    platform: "apple",
    txnOrOriginalId: "orig-1",
    productId: "corpan.sub.annual",
    price: 1999,
    currency: "USD",
    offerApplied: true,
    appAccountToken: "sub-A",
  };
  await codes.attributePurchase(args);
  const ledgerAfterFirst = [...doc.store.keys()].filter((k) => k.startsWith("LEDGER#ian#")).length;
  const out2 = await codes.attributePurchase(args); // replay
  assert.equal(out2.replay, true);
  const ledgerAfterReplay = [...doc.store.keys()].filter((k) => k.startsWith("LEDGER#ian#")).length;
  assert.equal(ledgerAfterFirst, 1);
  assert.equal(ledgerAfterReplay, 1); // no double credit
});

test("attributePurchase: verified lock never overwritten by later code", async () => {
  const doc = freshDoc();
  // First verified lock to ian.
  await codes.attributePurchase({
    claims: verifiedClaims(),
    subjectId: "sub-B",
    partnerName: "Ian",
    platform: "apple",
    txnOrOriginalId: "txn-1",
    appAccountToken: "sub-B",
  });
  const lockedTo = doc.store.get("SUBJECT#sub-B|ATTRIBUTION").partnerId;
  assert.equal(lockedTo, "ian");

  // A different verified code, NEW txn → purchase row writes, but attribution
  // lock must NOT change (verified never overwrites verified).
  await codes.attributePurchase({
    claims: verifiedClaims({ partnerId: "sky", code: "SKY30" }),
    subjectId: "sub-B",
    partnerName: "Sky",
    platform: "apple",
    txnOrOriginalId: "txn-2",
    appAccountToken: "sub-B",
  });
  assert.equal(doc.store.get("SUBJECT#sub-B|ATTRIBUTION").partnerId, "ian");
});

test("attributePurchase: unverified lock upgrades to verified once", async () => {
  const doc = freshDoc();
  // Unverified first (unknown code → no partnerId).
  await codes.attributePurchase({
    claims: { v: 1, iss: "corpan-codes", sub: "sub-C", code: "FOO", partnerId: null, classification: "unknown" },
    subjectId: "sub-C",
    partnerName: null,
    platform: "apple",
    txnOrOriginalId: "txn-u1",
    appAccountToken: "sub-C",
  });
  assert.equal(doc.store.get("SUBJECT#sub-C|ATTRIBUTION").status, "unverified");

  // Verified upgrade.
  await codes.attributePurchase({
    claims: verifiedClaims({ sub: "sub-C" }),
    subjectId: "sub-C",
    partnerName: "Ian",
    platform: "apple",
    txnOrOriginalId: "txn-v1",
    appAccountToken: "sub-C",
  });
  const lock = doc.store.get("SUBJECT#sub-C|ATTRIBUTION");
  assert.equal(lock.status, "verified");
  assert.equal(lock.partnerId, "ian");
});

test("attributePurchase: no claims → null (no write)", async () => {
  const doc = freshDoc();
  const out = await codes.attributePurchase({ claims: null, subjectId: "x", platform: "apple", txnOrOriginalId: "z" });
  assert.equal(out, null);
  assert.equal(doc.store.size, 0);
});

test("attributePurchase: unknown classification writes lock but NO ledger", async () => {
  const doc = freshDoc();
  const out = await codes.attributePurchase({
    claims: { v: 1, iss: "corpan-codes", sub: "sub-D", code: "FOO", partnerId: null, classification: "unknown" },
    subjectId: "sub-D",
    partnerName: null,
    platform: "android",
    txnOrOriginalId: "order-1",
    appAccountToken: "hash-d",
  });
  assert.equal(out.verified, false);
  const ledgerKeys = [...doc.store.keys()].filter((k) => k.startsWith("LEDGER#"));
  assert.equal(ledgerKeys.length, 0);
});

// ===========================================================================
// creditRenewal + GSI reverse-map
// ===========================================================================

test("creditRenewal: idempotent renewal ledger row", async () => {
  const doc = freshDoc();
  const args = { partnerId: "ian", subjectId: "sub-A", platform: "apple", renewalTxnId: "renew-1", productId: "p", revenueSharePct: 0.3, notificationType: "DID_RENEW" };
  const a = await codes.creditRenewal(args);
  const b = await codes.creditRenewal(args); // replay
  assert.equal(a, true);
  assert.equal(b, true); // conditional-fail still reported handled
  const keys = [...doc.store.keys()].filter((k) => k.startsWith("LEDGER#ian#"));
  assert.equal(keys.length, 1);
  assert.equal(doc.store.get(keys[0]).kind, "renewal");
});

test("findSubjectByObfHash: GSI1 reverse-map finds the attribution lock", async () => {
  const doc = freshDoc();
  await codes.attributePurchase({
    claims: verifiedClaims({ sub: "sub-G" }),
    subjectId: "sub-G",
    partnerName: "Ian",
    platform: "android",
    txnOrOriginalId: "order-g",
    appAccountToken: "hash-g",
  });
  const obfHash = codes.sha256Hex("sub-G");
  const found = await codes.findSubjectByObfHash(obfHash);
  assert.ok(found);
  assert.equal(found.partnerId, "ian");
});

// ===========================================================================
// /entitlement-token
// ===========================================================================

test("handleEntitlementToken: active purchase → ok + token", async () => {
  const doc = freshDoc();
  doc.store.set("SUBJECT#sub-E|PURCHASE#apple#orig-1", {
    PK: "SUBJECT#sub-E",
    SK: "PURCHASE#apple#orig-1",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  });
  const { json, calls } = jsonResponder();
  await codes.handleEntitlementToken({ subjectId: "sub-E" }, { secrets: SECRETS, json });
  const r = calls[0].payload;
  assert.equal(r.status, "ok");
  assert.equal(r.plus, true);
  assert.ok(r.entitlementToken);
  const v = codes.verifyJwt(r.entitlementToken, HMAC_KEY);
  assert.equal(v.iss, "corpan-ent");
  assert.equal(v.plus, true);
});

test("handleEntitlementToken: no purchase → failed plus:false", async () => {
  freshDoc();
  const { json, calls } = jsonResponder();
  await codes.handleEntitlementToken({ subjectId: "nobody" }, { secrets: SECRETS, json });
  assert.equal(calls[0].statusCode, 200);
  assert.equal(calls[0].payload.status, "failed");
  assert.equal(calls[0].payload.plus, false);
});

test("handleEntitlementToken: expired purchase → failed", async () => {
  const doc = freshDoc();
  doc.store.set("SUBJECT#sub-X|PURCHASE#apple#o", {
    PK: "SUBJECT#sub-X",
    SK: "PURCHASE#apple#o",
    expiresAt: new Date(Date.now() - 1000).toISOString(),
  });
  const { json, calls } = jsonResponder();
  await codes.handleEntitlementToken({ subjectId: "sub-X" }, { secrets: SECRETS, json });
  assert.equal(calls[0].payload.status, "failed");
});

test("handleEntitlementToken: missing subjectId → 400", async () => {
  freshDoc();
  const { json, calls } = jsonResponder();
  await codes.handleEntitlementToken({}, { secrets: SECRETS, json });
  assert.equal(calls[0].statusCode, 400);
});
