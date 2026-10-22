import test from "node:test";
import { z } from "zod";
import { accountSummary } from "../src/account/repository.js";
import { meSchema, familySummarySchema } from "../src/account/contracts.js";
import {
  purchaseMeasurementSchema,
  currentMeasurementNotice,
} from "../src/advertising/permission-contracts.js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { changeAdvertisingPermission } from "../src/advertising/permission.js";
import { PURCHASE_MEASUREMENT_NOTICE } from "../src/advertising/permission-contracts.js";
import {
  queueGooglePayment,
  measurementPaymentPage,
  purgeGooglePurchaseQueue,
} from "../src/advertising/purchase-queue.js";
import { verifiedAdvertisingPayment } from "../src/advertising/verified-payment.js";
import { FamilyRepository } from "../src/family/repository.js";
import { applyCommerceEvent } from "../src/commerce/postgres.js";
import { googleConversionDestinationKey } from "../src/advertising/google-data-manager.js";
import type { RefundFact } from "../src/billing/evidence/contracts.js";

import {
  enabled,
  destination,
  sources,
  day,
  paidAt,
  fixture,
  grant,
  stripe,
  observation,
  refund,
  esa,
} from "./helpers/advertising.js";

test(
  "verified Stripe acquisition payments keep random stable IDs across collection and manager-path changes",
  enabled,
  () =>
    fixture(async (pool) => {
      const payment = await stripe(pool);
      const results = await Promise.all(
        Array.from({ length: 8 }, () =>
          queueGooglePayment(pool, destination, sources, payment.reference),
        ),
      );
      assert.equal(results.filter((r) => r.outcome === "queued").length, 1);
      const row = (await pool.query("SELECT * FROM amp_google_purchase_queue"))
        .rows[0];
      assert.match(row.transaction_id, /^amp_[a-f0-9]{64}$/);
      assert.equal(
        new Set(
          results.map((r) => ("transactionId" in r ? r.transactionId : null)),
        ).size,
        1,
      );
      assert.equal(row.original_minor, "49900");
      assert.equal(row.net_minor, "49900");
      assert.equal(row.occurred_at.toISOString(), payment.occurredAt);
      assert.equal(row.permission_notice, PURCHASE_MEASUREMENT_NOTICE.version);
      assert.equal(
        JSON.stringify(row).includes("parent@example.invalid"),
        false,
      );
      assert.equal(JSON.stringify(row).includes("Do not export"), false);
      assert.equal(
        Object.keys(row).some((k) =>
          /email|learner|hash|visitor|click/.test(k),
        ),
        false,
      );
      const viaManager = { ...destination, loginCustomerId: "9876543210" };
      assert.equal(
        googleConversionDestinationKey(destination),
        googleConversionDestinationKey(viaManager),
      );
      assert.equal(
        (await queueGooglePayment(pool, viaManager, sources, payment.reference))
          .outcome,
        "retained",
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int n FROM amp_google_purchase_queue",
          )
        ).rows[0].n,
        1,
      );
      await assert.rejects(
        pool.query("UPDATE amp_google_purchase_queue SET source_id='another'"),
        /immutable/,
      );
      await assert.rejects(
        queueGooglePayment(pool, destination, sources, {
          ...payment.reference,
          amountMinor: 1,
        } as never),
      );
    }),
);

test(
  "test mode, renewal, review, credit hold, wrong owner and malformed source facts cannot become acquisitions",
  enabled,
  () =>
    fixture(async (pool) => {
      for (const options of [
        { namespace: "acct_fixture:test", live: false },
        { live: false },
        { reason: "subscription_cycle" },
        { status: "review" },
        { currency: "eur" },
        { paidMinor: 0 },
        { paidMinor: 100_000_001 },
        { paidAt: Math.floor(Date.now() / 1000) + 3600 },
      ]) {
        const p = await stripe(pool, options);
        assert.equal(
          (await queueGooglePayment(pool, destination, sources, p.reference))
            .outcome,
          "ineligible",
        );
      }
      const other = await stripe(pool, { account: "amp|other" });
      assert.equal(
        (await queueGooglePayment(pool, destination, sources, other.reference))
          .outcome,
        "permission_unavailable",
      );
      const held = await stripe(pool);
      await pool.query(
        "INSERT INTO amp_payment_holds(namespace,invoice_id,credit_note_id,source_event_id) VALUES($1,$2,'cn_fixture','event_fixture')",
        [sources.stripeNamespace, held.invoiceId],
      );
      assert.equal(
        (await queueGooglePayment(pool, destination, sources, held.reference))
          .outcome,
        "ineligible",
      );
      const malformed = await stripe(pool);
      await observation(pool, malformed.reference.id, [], "review");
      assert.equal(
        (
          await queueGooglePayment(
            pool,
            destination,
            sources,
            malformed.reference,
          )
        ).outcome,
        "ineligible",
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int n FROM amp_google_purchase_queue",
          )
        ).rows[0].n,
        0,
      );
      await assert.rejects(
        queueGooglePayment(
          pool,
          destination,
          { stripeNamespace: "acct_fixture:test" },
          held.reference,
        ),
      );
    }),
);

test(
  "refund facts update net value, reject ambiguity, and cancel a fully refunded unsent purchase",
  enabled,
  () =>
    fixture(async (pool) => {
      const p = await stripe(pool);
      const queued = await queueGooglePayment(
        pool,
        destination,
        sources,
        p.reference,
      );
      const partial = refund(p.chargeId, 10000);
      await observation(pool, p.reference.id, [partial]);
      assert.equal(
        (await queueGooglePayment(pool, destination, sources, p.reference))
          .outcome,
        "retained",
      );
      assert.equal(
        (await pool.query("SELECT net_minor FROM amp_google_purchase_queue"))
          .rows[0].net_minor,
        "39900",
      );
      await observation(pool, p.reference.id, [
        partial,
        refund(p.chargeId, 39900),
      ]);
      const cancelled = await queueGooglePayment(
        pool,
        destination,
        sources,
        p.reference,
      );
      assert.equal(cancelled.outcome, "cancelled");
      assert.equal(
        "transactionId" in queued &&
          "transactionId" in cancelled &&
          queued.transactionId === cancelled.transactionId,
        true,
      );
      for (const kind of [
        "pending",
        "duplicate",
        "wrong-charge",
        "over-refund",
        "future",
      ] as const) {
        const q = await stripe(pool),
          r = refund(q.chargeId, kind === "over-refund" ? 50000 : 100);
        if (kind === "pending") r.status = "pending";
        if (kind === "wrong-charge") r.chargeId = "ch_another";
        if (kind === "future") r.created = Math.floor(Date.now() / 1000) + 3600;
        await observation(
          pool,
          q.reference.id,
          kind === "duplicate" ? [r, r] : [r],
        );
        assert.equal(
          (await queueGooglePayment(pool, destination, sources, q.reference))
            .outcome,
          "ineligible",
          kind,
        );
      }
    }),
);

test(
  "EFA requires a linked Arkansas request and settled evidence; full refunds cancel the original queue item",
  enabled,
  () =>
    fixture(async (pool) => {
      for (const opts of [
        { linked: false },
        { settled: false },
        { program: "another-program" },
        { owner: "amp|other" },
      ]) {
        const p = await esa(pool, opts);
        assert.equal(
          (await queueGooglePayment(pool, destination, sources, p.reference))
            .outcome,
          "ineligible",
        );
      }
      const p = await esa(pool);
      assert.equal(
        (await queueGooglePayment(pool, destination, sources, p.reference))
          .outcome,
        "queued",
      );
      await applyCommerceEvent(pool, {
        ...p.base,
        id: randomUUID(),
        occurredAt: new Date().toISOString(),
        type: "refund.completed",
        amountMinor: 49900,
        currency: "USD",
        evidence: "fixture refund returned to program",
      });
      const client = await pool.connect();
      try {
        assert.equal(
          (await verifiedAdvertisingPayment(client, sources, p.reference))
            ?.netMinor,
          0,
        );
      } finally {
        client.release();
      }
      assert.equal(
        (await queueGooglePayment(pool, destination, sources, p.reference))
          .outcome,
        "cancelled",
      );
      assert.equal(
        (
          await queueGooglePayment(
            pool,
            destination,
            { efaChannelReference: "wrong-program" },
            p.reference,
          )
        ).outcome,
        "cancelled",
      );
    }),
);

test(
  "permission withdrawal, changed email, expiry and regrant never revive earlier purchases",
  enabled,
  () =>
    fixture(async (pool) => {
      const p = await stripe(pool);
      await queueGooglePayment(pool, destination, sources, p.reference);
      const off = await changeAdvertisingPermission(pool, "amp|parent", {
        action: "withdraw",
      });
      assert.equal(
        (
          await pool.query(
            "SELECT state,cancellation_reason FROM amp_google_purchase_queue",
          )
        ).rows[0].cancellation_reason,
        "withdrawn",
      );
      await grant(pool, off.revision);
      assert.equal(
        (await queueGooglePayment(pool, destination, sources, p.reference))
          .outcome,
        "cancelled",
      );
      await assert.rejects(
        pool.query(
          "UPDATE amp_google_purchase_queue SET state='ready',cancellation_reason=NULL",
        ),
        /cannot be restored/,
      );
      const earlier = await stripe(pool, {
        paidAt: Math.floor((Date.now() - 3 * day) / 1000),
      });
      assert.equal(
        (
          await queueGooglePayment(
            pool,
            destination,
            sources,
            earlier.reference,
          )
        ).outcome,
        "permission_unavailable",
      );
      const changed = await stripe(pool);
      await queueGooglePayment(pool, destination, sources, changed.reference);
      await pool.query(
        "UPDATE amp_auth_users SET email='changed@example.invalid' WHERE id='parent'",
      );
      assert.equal(
        (
          await queueGooglePayment(
            pool,
            destination,
            sources,
            changed.reference,
          )
        ).outcome,
        "cancelled",
      );
      const fresh = await stripe(pool);
      await pool.query(
        "UPDATE amp_auth_users SET email='parent@example.invalid' WHERE id='parent'",
      );
      await pool.query(
        "UPDATE amp_advertising_permissions SET expires_at=clock_timestamp()-interval '1 day' WHERE account_id='amp|parent'",
      );
      assert.equal(
        (await queueGooglePayment(pool, destination, sources, fresh.reference))
          .outcome,
        "permission_unavailable",
      );
    }),
);

test(
  "collection races serialize with withdrawal; parent exports omit routing and internal identifiers",
  enabled,
  () =>
    fixture(async (pool) => {
      const p = await stripe(pool);
      await Promise.all([
        queueGooglePayment(pool, destination, sources, p.reference),
        changeAdvertisingPermission(pool, "amp|parent", { action: "withdraw" }),
      ]);
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int n FROM amp_google_purchase_queue WHERE state='ready'",
          )
        ).rows[0].n,
        0,
      );
      const off = (
        await pool.query(
          "SELECT revision FROM amp_advertising_permissions WHERE account_id='amp|parent'",
        )
      ).rows[0];
      await grant(pool, off.revision);
      const second = await stripe(pool);
      await queueGooglePayment(pool, destination, sources, second.reference);
      const family = new FamilyRepository(pool);
      const rows: { type: string; data?: unknown }[] = [];
      for await (const row of family.export("amp|parent"))
        rows.push(JSON.parse(row));
      const lines = rows.filter(
        (x) => x.type === "purchase-measurement-preparation",
      );
      assert.ok(lines.length >= 1);
      assert.equal(JSON.stringify(lines).includes("1234567890"), false);
      assert.equal(JSON.stringify(lines).includes(second.reference.id), false);
    }),
);

test(
  "paged discovery does not repeat rows and expired preparation cannot be recreated after retention",
  enabled,
  () =>
    fixture(async (pool) => {
      for (let i = 0; i < 3; i++) await stripe(pool);
      const a = await measurementPaymentPage(pool, sources, "stripe", null, 2);
      assert.equal(a.references.length, 2);
      assert.ok(a.next);
      const b = await measurementPaymentPage(
        pool,
        sources,
        "stripe",
        a.next,
        2,
      );
      assert.equal(b.references.length, 1);
      assert.equal(b.next, null);
      assert.equal(
        new Set([...a.references, ...b.references].map((r) => r.id)).size,
        3,
      );
      await assert.rejects(
        measurementPaymentPage(pool, sources, "stripe", null, 201),
      );
      const old = await stripe(pool, {
        paidAt: Math.floor((Date.now() - 91 * day) / 1000),
      });
      assert.equal(
        (await queueGooglePayment(pool, destination, sources, old.reference))
          .outcome,
        "ineligible",
      );
      // Insert an expired synthetic preparation directly; the production writer rejects it.
      await pool.query(
        `INSERT INTO amp_google_purchase_queue(transaction_id,destination_key,destination,source_kind,source_id,account_id,occurred_at,original_minor,net_minor,currency,permission_revision,permission_notice,permission_granted_at,permission_expires_at)
    VALUES($1,$2,$3,'stripe',$4,'amp|parent',clock_timestamp()-interval '91 days',49900,49900,'USD',$5,'fixture',clock_timestamp()-interval '92 days',clock_timestamp()+interval '1 day')`,
        [
          `amp_${"a".repeat(64)}`,
          googleConversionDestinationKey(destination),
          destination,
          old.reference.id,
          randomUUID(),
        ],
      );
      assert.equal(await purgeGooglePurchaseQueue(pool), 1);
      assert.equal(
        (await queueGooglePayment(pool, destination, sources, old.reference))
          .outcome,
        "ineligible",
      );
    }),
);

test(
  "temporary payment review and pending refunds hold preparation, then resume the same reference",
  enabled,
  () =>
    fixture(async (pool) => {
      const p = await stripe(pool),
        initial = await queueGooglePayment(
          pool,
          destination,
          sources,
          p.reference,
        );
      await pool.query(
        "UPDATE amp_payment_records SET status='review',review_reason='financial_evidence_unavailable' WHERE id=$1",
        [p.reference.id],
      );
      const held = await queueGooglePayment(
        pool,
        destination,
        sources,
        p.reference,
      );
      assert.equal(held.outcome, "held");
      await pool.query(
        "UPDATE amp_payment_records SET status='verified',review_reason=NULL WHERE id=$1",
        [p.reference.id],
      );
      const pending = refund(p.chargeId, 10000, "pending");
      await observation(pool, p.reference.id, [pending]);
      assert.equal(
        (await queueGooglePayment(pool, destination, sources, p.reference))
          .outcome,
        "held",
      );
      await observation(pool, p.reference.id, [
        { ...pending, status: "failed" },
      ]);
      const resumed = await queueGooglePayment(
        pool,
        destination,
        sources,
        p.reference,
      );
      assert.equal(resumed.outcome, "retained");
      assert.equal(
        "transactionId" in initial &&
          "transactionId" in resumed &&
          initial.transactionId === resumed.transactionId,
        true,
      );
      await observation(pool, p.reference.id, [
        { ...pending, status: "pending" },
      ]);
      await queueGooglePayment(pool, destination, sources, p.reference);
      await changeAdvertisingPermission(pool, "amp|parent", {
        action: "withdraw",
      });
      assert.equal(
        (
          await pool.query(
            "SELECT state,hold_reason FROM amp_google_purchase_queue",
          )
        ).rows[0].state,
        "cancelled",
      );
      assert.equal(
        (await pool.query("SELECT hold_reason FROM amp_google_purchase_queue"))
          .rows[0].hold_reason,
        null,
      );
    }),
);

test(
  "v1 and current clients accept account snapshots during notice rollout; stale grants stay rejected",
  enabled,
  () =>
    fixture(async (pool) => {
      const me = await accountSummary(
        pool,
        new FamilyRepository(pool),
        "amp|parent",
      );
      assert.equal(me.signedIn, true);
      if (!me.signedIn) throw new Error("expected signed-in fixture");
      const legacyPurchase = purchaseMeasurementSchema
        .omit({ currentNoticeVersion: true })
        .extend({ noticeVersion: z.literal("google-adult-purchase-v1") });
      const legacyMe = meSchema.options[1].extend({
        family: familySummarySchema.extend({
          purchaseMeasurement: legacyPurchase.optional(),
        }),
      });
      assert.equal(legacyMe.parse(me).signedIn, true);
      assert.equal(meSchema.parse(me).signedIn, true);
      assert.equal(
        currentMeasurementNotice(me.family.purchaseMeasurement!),
        PURCHASE_MEASUREMENT_NOTICE.version,
      );
      const oldPod = structuredClone(me);
      delete oldPod.family.purchaseMeasurement!.currentNoticeVersion;
      assert.equal(meSchema.parse(oldPod).signedIn, true);
      assert.equal(
        currentMeasurementNotice(oldPod.family.purchaseMeasurement!),
        "google-adult-purchase-v1",
      );
      await assert.rejects(
        changeAdvertisingPermission(pool, "amp|parent", {
          action: "allow",
          revision: me.family.purchaseMeasurement!.revision,
          noticeVersion: "google-adult-purchase-v1",
          adultAttestation: true,
        }),
      );
    }),
);

test(
  "Arizona paid purchases require their own channel and retain one export identity",
  enabled,
  () =>
    fixture(async (pool) => {
      const ar = await esa(pool);
      const az = await esa(pool, { kind: "arizona-esa" });
      assert.equal(
        (
          await queueGooglePayment(
            pool,
            destination,
            { efaChannelReference: sources.efaChannelReference },
            az.reference,
          )
        ).outcome,
        "ineligible",
      );
      assert.equal(
        (
          await queueGooglePayment(
            pool,
            destination,
            { azEsaChannelReference: sources.efaChannelReference },
            az.reference,
          )
        ).outcome,
        "ineligible",
      );
      assert.equal(
        (
          await queueGooglePayment(pool, destination, sources, {
            ...az.reference,
            kind: "arkansas-efa",
          })
        ).outcome,
        "ineligible",
      );
      const page = await measurementPaymentPage(pool, sources, "arizona-esa");
      assert.deepEqual(page.references, [az.reference]);
      assert.ok(!page.references.some((x) => x.id === ar.reference.id));
      const first = await queueGooglePayment(
        pool,
        destination,
        sources,
        az.reference,
      );
      const again = await queueGooglePayment(
        pool,
        destination,
        sources,
        az.reference,
      );
      assert.equal(first.outcome, "queued");
      assert.equal(again.outcome, "retained");
      assert.ok(
        "transactionId" in first &&
          "transactionId" in again &&
          first.transactionId === again.transactionId,
      );
      await applyCommerceEvent(pool, {
        ...az.base,
        id: randomUUID(),
        occurredAt: new Date().toISOString(),
        type: "refund.completed",
        amountMinor: 49900,
        currency: "USD",
        evidence: "fixture refund returned to program",
      });
      assert.equal(
        (await queueGooglePayment(pool, destination, sources, az.reference))
          .outcome,
        "cancelled",
      );
    }),
);
