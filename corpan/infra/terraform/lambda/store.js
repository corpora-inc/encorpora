// ---------------------------------------------------------------------------
// DynamoDB single-table access layer for `corpan-iap`
// ---------------------------------------------------------------------------
//
// Single-table design (AFFILIATE_CODES_PLAN.md §3.2). PK/SK composite:
//
//   Code registry            CODE#<NORMALIZED>          / META
//   Subject attribution lock SUBJECT#<subjectId>        / ATTRIBUTION
//   Purchase (idempotency)   SUBJECT#<subjectId>        / PURCHASE#<plat>#<txn>
//   Ledger (initial+renewal) LEDGER#<partnerId>#<yyyy-mm> / EVENT#<plat>#<txn>
//   Partner                  PARTNER#<partnerId>        / META
//   Token map (renewals)     TOKEN#<platform>#<key>     / SUBJECT
//
// The TOKEN# item lets store-server notifications (which carry only the
// appAccountToken / originalTransactionId / obfuscated account id, NOT our
// subjectId) reverse-map to the locked subject + partner without un-hashing.
//
// All DynamoDB calls go through an injected `client` exposing the
// @aws-sdk/lib-dynamodb DocumentClient `send`-style command methods we wrap
// here. A pure in-memory fake (see test/fakeDdb.js) implements the same shape,
// so this whole module is unit-testable WITHOUT npm install / AWS.

class ConditionalFailed extends Error {
  constructor(message) {
    super(message || "ConditionalCheckFailed");
    this.name = "ConditionalCheckFailed";
    this.code = "ConditionalCheckFailedException";
  }
}

function yyyymm(epochMs) {
  const d = new Date(epochMs);
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${d.getUTCFullYear()}-${m}`;
}

class IapStore {
  /**
   * @param {object} client  doc-client-like: getItem/putItem/query/updateItem
   * @param {string} tableName
   */
  constructor(client, tableName) {
    this.client = client;
    this.table = tableName;
  }

  // --- Registry ----------------------------------------------------------

  async getCodeEntry(normalizedCode) {
    const out = await this.client.getItem({
      TableName: this.table,
      Key: { PK: `CODE#${normalizedCode}`, SK: "META" },
    });
    return out.Item || null;
  }

  async putCodeEntry(normalizedCode, entry) {
    await this.client.putItem({
      TableName: this.table,
      Item: { PK: `CODE#${normalizedCode}`, SK: "META", ...entry },
    });
  }

  async getPartner(partnerId) {
    if (!partnerId) return null;
    const out = await this.client.getItem({
      TableName: this.table,
      Key: { PK: `PARTNER#${partnerId}`, SK: "META" },
    });
    return out.Item || null;
  }

  // --- Attribution lock (first-verified-touch) ---------------------------

  async getAttribution(subjectId) {
    const out = await this.client.getItem({
      TableName: this.table,
      Key: { PK: `SUBJECT#${subjectId}`, SK: "ATTRIBUTION" },
    });
    return out.Item || null;
  }

  /**
   * Lock the FIRST attribution for a subject. Returns the effective (winning)
   * attribution. Rules (§3.4):
   *   - first verified touch wins; never change partner once verified
   *   - an unverified lock MAY be upgraded to verified (default allow upgrade)
   *   - never downgrade verified → unverified
   */
  async lockAttribution(subjectId, { code, partnerId, verified, accountKeys = {} }) {
    const now = Date.now();
    const item = {
      PK: `SUBJECT#${subjectId}`,
      SK: "ATTRIBUTION",
      code,
      partnerId: partnerId || null,
      status: verified ? "verified" : "unverified",
      lockedAt: now,
      lockSource: "verify-purchase",
      ...accountKeys, // appAccountToken / originalTransactionId / obfId for reverse map
    };
    try {
      await this.client.putItem({
        TableName: this.table,
        Item: item,
        ConditionExpression: "attribute_not_exists(SK)",
      });
      return { attribution: item, created: true, changed: true };
    } catch (err) {
      if (!isConditional(err)) throw err;
      // Already locked — apply upgrade rules.
      const existing = await this.getAttribution(subjectId);
      if (!existing) throw err; // race; surface
      if (existing.status === "verified") {
        // Never change a verified lock.
        return { attribution: existing, created: false, changed: false };
      }
      // existing is unverified; upgrade to verified iff the new touch is verified.
      if (verified) {
        const upgraded = {
          ...existing,
          code,
          partnerId: partnerId || null,
          status: "verified",
          upgradedAt: now,
          ...accountKeys,
        };
        await this.client.putItem({ TableName: this.table, Item: upgraded });
        return { attribution: upgraded, created: false, changed: true };
      }
      return { attribution: existing, created: false, changed: false };
    }
  }

  // --- Purchase idempotency ---------------------------------------------

  /**
   * Idempotent purchase write. Returns { written:true } on first sight, or
   * { written:false, existing } if this (subject, platform, txn) already exists
   * — caller must NOT double-credit the ledger.
   */
  async putPurchaseOnce(subjectId, platform, txnId, attrs) {
    const sk = `PURCHASE#${platform}#${txnId}`;
    const item = {
      PK: `SUBJECT#${subjectId}`,
      SK: sk,
      platform,
      transactionId: txnId,
      verifiedAt: Date.now(),
      ...attrs,
    };
    try {
      await this.client.putItem({
        TableName: this.table,
        Item: item,
        ConditionExpression: "attribute_not_exists(SK)",
      });
      return { written: true, item };
    } catch (err) {
      if (!isConditional(err)) throw err;
      const out = await this.client.getItem({
        TableName: this.table,
        Key: { PK: `SUBJECT#${subjectId}`, SK: sk },
      });
      return { written: false, existing: out.Item || null };
    }
  }

  // --- Ledger (exactly-once credit) -------------------------------------

  /**
   * Write a ledger credit EXACTLY ONCE per (partner, platform, txn). Apple and
   * Google both redeliver notifications; the conditional put dedups them.
   * Returns { credited:true, eventId } or { credited:false } if duplicate.
   */
  async creditLedgerOnce(partnerId, { platform, txnId, subjectId, code, productId, price, currency, kind, revenueSharePct, notificationType, eventTimeMs }) {
    if (!partnerId) return { credited: false, reason: "no_partner" };
    const eventTime = eventTimeMs || Date.now();
    const month = yyyymm(eventTime);
    const sk = `EVENT#${platform}#${txnId}`;
    const eventId = `${partnerId}#${month}#${platform}#${txnId}`;
    const item = {
      PK: `LEDGER#${partnerId}#${month}`,
      SK: sk,
      eventId,
      subjectId,
      code: code || null,
      productId: productId || null,
      price: price ?? null,
      currency: currency || null,
      kind: kind || "initial",
      revenueSharePct: revenueSharePct ?? null,
      notificationType: notificationType || null,
      eventTime: new Date(eventTime).toISOString(),
    };
    try {
      await this.client.putItem({
        TableName: this.table,
        Item: item,
        ConditionExpression: "attribute_not_exists(SK)",
      });
      return { credited: true, eventId };
    } catch (err) {
      if (!isConditional(err)) throw err;
      return { credited: false, reason: "duplicate", eventId };
    }
  }

  // --- Token → subject reverse map (for renewals) -----------------------

  async putTokenMap(platform, key, { subjectId, partnerId, code }) {
    if (!key) return;
    await this.client.putItem({
      TableName: this.table,
      Item: {
        PK: `TOKEN#${platform}#${key}`,
        SK: "SUBJECT",
        subjectId,
        partnerId: partnerId || null,
        code: code || null,
      },
    });
  }

  async getTokenMap(platform, key) {
    if (!key) return null;
    const out = await this.client.getItem({
      TableName: this.table,
      Key: { PK: `TOKEN#${platform}#${key}`, SK: "SUBJECT" },
    });
    return out.Item || null;
  }

  // --- Reporting (manual CSV export) ------------------------------------

  async queryLedgerMonth(partnerId, month) {
    const out = await this.client.query({
      TableName: this.table,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": `LEDGER#${partnerId}#${month}` },
    });
    return out.Items || [];
  }
}

function isConditional(err) {
  if (!err) return false;
  return (
    err.name === "ConditionalCheckFailedException" ||
    err.code === "ConditionalCheckFailedException" ||
    err.name === "ConditionalCheckFailed"
  );
}

module.exports = { IapStore, ConditionalFailed, yyyymm, isConditional };
