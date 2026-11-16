import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { FundingPurchaseRepository } from "../src/funding-purchase/repository.js";
import { FundingInvoiceRepository } from "../src/funding-purchase/invoice-intents.js";
import { provisionFundingRequest } from "../src/funding-purchase/provision.js";
import {
  prepareClassWalletProvision,
  type ClassWalletConfig,
} from "../src/funding-purchase/classwallet.js";
import {
  stageClassWalletPayment,
  reconcileClassWalletPayments,
} from "../src/funding-purchase/classwallet-staging.js";
import { withInvoiceDateTerms } from "../src/funding-purchase/offer-terms.js";
import { fundedTermEnd } from "../src/funding-purchase/term.js";
import type {
  FundingOffer,
  FundingRequest,
} from "../src/funding-purchase/contracts.js";
import { legacyInvoiceOffer } from "./funding-offer-terms.fixture.js";

const day = 86400000;
const config: ClassWalletConfig = {
  verificationReference: "synthetic-only",
  currency: "USD",
  grossColumn: "Payment Amount",
  netColumn: "Total",
  dateFormat: "canonical-utc-iso",
  settledStatus: "Settled",
  lastUpdateMeaning: "settlement-time-for-settled-rows",
  programs: [
    {
      organization: "Fixture",
      state: "XX",
      distribution: "Fixture",
      programId: legacyInvoiceOffer.programId,
      channelReference: legacyInvoiceOffer.channelReference,
    },
  ],
};
function row(request: Pick<FundingRequest, "id" | "offer">, paid: string) {
  const gross = (
    (request.offer.subtotalMinor + request.offer.taxMinor) /
    100
  ).toFixed(2);
  return {
    "Order ID": "synthetic",
    "Transaction ID": randomUUID(),
    "Invoice/Quote": request.id,
    Organization: "Fixture",
    State: "XX",
    "Distribution Name": "Fixture",
    "Payment Amount": gross,
    Total: gross,
    Fee: "0.00",
    Status: "Settled",
    "Payment Approval Date": paid,
    "Last Update": paid,
  };
}
const monthly: FundingOffer = {
  ...legacyInvoiceOffer,
  id: "monthly-invoice",
  sku: "fixture-monthly",
  termMonths: 1,
  termPolicy: "one-month-from-verified-provisioning",
};

for (const legacy of [monthly, legacyInvoiceOffer]) {
  test(
    `${legacy.termMonths}-month ClassWallet invoices retain fixed service dates through payment, overlapping renewal and legacy replay`,
    { skip: !process.env.AMP_TEST_DATABASE_URL },
    async () => {
      const url = process.env.AMP_TEST_DATABASE_URL!;
      const schema = `amp_invoice_term_${randomUUID().replaceAll("-", "")}`;
      const admin = new Pool({ connectionString: url, max: 1 });
      const scoped = new URL(url);
      scoped.searchParams.set("options", `-c search_path=${schema}`);
      const pool = new Pool({ connectionString: scoped.href });
      try {
        await admin.query(`CREATE SCHEMA ${schema}`);
        await migrate(scoped.href);
        await pool.query(
          `INSERT INTO amp_auth_users(id,name,email,"emailVerified") VALUES('owner','Synthetic','term@example.test',true)`,
        );
        await pool.query(
          "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES('amp|owner','fixture','verified','fixture')",
        );
        const offer = withInvoiceDateTerms(legacy);
        const funding = new FundingPurchaseRepository(pool, [offer]);
        const invoices = new FundingInvoiceRepository(funding);
        const createdAt = new Date(Date.now() - 7 * day);
        const paidAt = new Date(createdAt.getTime() + day).toISOString();
        const addLearner = async (id: string) =>
          pool.query(
            "INSERT INTO amp_learners(id,account_id,name) VALUES($1,'amp|owner','Synthetic')",
            [id],
          );
        await addLearner("current");
        const invoice = await invoices.create(
          {
            offerId: offer.id,
            offerRevision: offer.revision,
            parentEmail: "term@example.test",
            studentBillingName: "Synthetic Student",
            idempotencyKey: randomUUID(),
          },
          createdAt,
        );
        const request = await invoices.claim(
          "amp|owner",
          invoice.id,
          "current",
        );
        assert.equal(
          request.createdAt,
          createdAt.toISOString(),
          "Claim preserves the printed invoice date",
        );
        const bridge = (
          await pool.query(
            "SELECT g.id FROM amp_grants g JOIN amp_access_gifts a ON a.grant_id=g.id WHERE a.funding_invoice_id=$1",
            [request.id],
          )
        ).rows[0];
        assert.ok(bridge, "Claim gives immediate bridge access");
        const previousEnd = new Date(Date.now() + 14 * day).toISOString();
        await pool.query(
          "INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at) VALUES('paid-existing','current','stripe','paid-existing','active',$1,$2)",
          [new Date(createdAt.getTime() - day).toISOString(), previousEnd],
        );
        const payment = row(request, paidAt);
        const activated = new Date().toISOString();
        const payload = prepareClassWalletProvision(
          payment,
          request,
          config,
          activated,
          undefined,
          previousEnd,
        );
        const created = payload.events[0]!;
        assert.ok(created.type === "order.created");
        assert.equal(created.order.license.startsAt, request.createdAt);
        assert.equal(
          created.order.license.endsAt,
          fundedTermEnd(request.createdAt, offer.termMonths),
        );
        const moved = structuredClone(payload);
        const movedCreated = moved.events[0]!;
        assert.ok(movedCreated.type === "order.created");
        movedCreated.order.license.startsAt = activated;
        movedCreated.order.license.endsAt = fundedTermEnd(
          activated,
          offer.termMonths,
        );
        await assert.rejects(
          provisionFundingRequest(pool, moved, [offer]),
          /funded_invoice_term_required/,
        );
        assert.equal(
          (
            await pool.query("SELECT status FROM amp_grants WHERE id=$1", [
              bridge.id,
            ])
          ).rows[0].status,
          "active",
          "A rejected payload cannot revoke the bridge",
        );
        await provisionFundingRequest(pool, payload, [offer]);
        const saved = (
          await pool.query(
            "SELECT order_state,grant_state FROM amp_commerce_orders WHERE id=$1",
            [created.orderId],
          )
        ).rows[0];
        assert.equal(saved.order_state.settlement, "settled");
        assert.deepEqual(saved.order_state.license, created.order.license);
        assert.equal(saved.grant_state.endsAt, created.order.license.endsAt);
        const grants = (
          await pool.query(
            "SELECT id,status,starts_at,ends_at FROM amp_grants WHERE learner_id='current' ORDER BY id",
          )
        ).rows;
        assert.equal(grants.find((g) => g.id === bridge.id)?.status, "revoked");
        assert.equal(
          grants.find((g) => g.id === "paid-existing")?.status,
          "active",
          "Early renewal retains already-paid access",
        );
        assert.equal(
          grants.find((g) => g.id === "paid-existing")?.ends_at.toISOString(),
          previousEnd,
        );
        const active = grants.filter(
          (g) => g.status === "active" && g.id !== "paid-existing",
        );
        assert.equal(active.length, 1);
        assert.equal(
          active[0].ends_at.toISOString(),
          created.order.license.endsAt,
          "Payment cannot extend the printed end",
        );
        assert.equal(active[0].starts_at.toISOString(), activated);
        const later = new Date(Date.now() + 5000).toISOString();
        const retry = prepareClassWalletProvision(
          { ...payment, "Last Update": later },
          request,
          config,
          later,
          payload,
        );
        assert.deepEqual(retry, payload);
        await provisionFundingRequest(pool, retry, [offer]);
        await assert.rejects(
          provisionFundingRequest(pool, moved, [offer]),
          /provisioning_payload_mismatch/,
        );
        assert.equal(
          (
            await pool.query(
              "SELECT count(*)::int n FROM amp_commerce_events WHERE order_id=$1",
              [created.orderId],
            )
          ).rows[0].n,
          5,
        );
        assert.equal(
          (
            await pool.query(
              "SELECT count(*)::int n FROM amp_funded_activation_outbox WHERE request_id=$1",
              [request.id],
            )
          ).rows[0].n,
          1,
        );

        // An invoice issued under the old policy keeps its promised activation-based term.
        await addLearner("legacy");
        const oldFunding = new FundingPurchaseRepository(pool, [legacy]);
        const old = await oldFunding.create(
          "amp|owner",
          {
            offerId: legacy.id,
            offerRevision: legacy.revision,
            learnerId: "legacy",
            studentBillingName: "Synthetic Student",
            idempotencyKey: randomUUID(),
          },
          createdAt,
        );
        const oldPayment = row(old, paidAt);
        const oldActivation = new Date().toISOString();
        const oldPayload = prepareClassWalletProvision(
          oldPayment,
          old,
          config,
          oldActivation,
        );
        await provisionFundingRequest(pool, oldPayload, [offer]);

        // Payment can arrive before a parent claims the invoice. Claiming it
        // after its payment window must not restart its service period.
        await addLearner("late-claim");
        const originalDate = new Date(Date.now() - 32 * day);
        const unclaimed = await invoices.create(
          {
            offerId: offer.id,
            offerRevision: offer.revision,
            parentEmail: "term@example.test",
            studentBillingName: "Synthetic Student",
            idempotencyKey: randomUUID(),
          },
          originalDate,
        );
        const timelyPayment = row(
          unclaimed,
          new Date(originalDate.getTime() + day).toISOString(),
        );
        await stageClassWalletPayment(
          pool,
          timelyPayment,
          config,
          "c".repeat(64),
          true,
        );
        const lateClaim = await invoices.claim(
          "amp|owner",
          unclaimed.id,
          "late-claim",
        );
        assert.equal(lateClaim.createdAt, originalDate.toISOString());
        assert.equal(
          (await reconcileClassWalletPayments(pool, [offer])).provisioned,
          1,
        );
        const latePaid = await funding.read("amp|owner", lateClaim.id);
        const lateOrder = (
          await pool.query(
            "SELECT order_state,grant_state FROM amp_commerce_orders WHERE id=$1",
            [latePaid.orderId],
          )
        ).rows[0];
        assert.equal(
          lateOrder.order_state.license.startsAt,
          originalDate.toISOString(),
        );
        assert.equal(
          lateOrder.order_state.license.endsAt,
          fundedTermEnd(originalDate.toISOString(), offer.termMonths),
        );
        assert.equal(lateOrder.order_state.settlement, "settled");
        assert.equal(Boolean(lateOrder.grant_state), offer.termMonths === 12);
        const oldCreated = oldPayload.events[0]!;
        assert.ok(oldCreated.type === "order.created");
        assert.equal(oldCreated.order.license.startsAt, oldActivation);
        assert.equal(
          oldCreated.order.license.endsAt,
          fundedTermEnd(oldActivation, legacy.termMonths),
        );
        assert.deepEqual(
          (await funding.read("amp|owner", old.id)).offer,
          legacy,
          "Paid legacy snapshot stays immutable after live offer migration",
        );
        await provisionFundingRequest(pool, oldPayload, [offer]);
      } finally {
        await pool.end();
        await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
        await admin.end();
      }
    },
  );
}

test(
  "an expired monthly invoice records late settlement, revokes its bridge and sends no activation notice",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_expired_invoice_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const pool = new Pool({ connectionString: scoped.href });
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      await pool.query(
        "INSERT INTO amp_learners(id,account_id,name) VALUES('expired','owner','Synthetic')",
      );
      await pool.query(
        "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES('owner','fixture','verified','fixture')",
      );
      const offer = withInvoiceDateTerms(monthly);
      const funding = new FundingPurchaseRepository(pool, [offer]);
      const createdAt = new Date(Date.now() - 40 * day);
      const request = await funding.create(
        "owner",
        {
          offerId: offer.id,
          offerRevision: offer.revision,
          learnerId: "expired",
          studentBillingName: "Synthetic Student",
          idempotencyKey: randomUUID(),
        },
        createdAt,
      );
      await funding.update(
        "owner",
        request.id,
        "parent-reported-submitted",
        new Date(createdAt.getTime() + day),
      );
      // Persist historical bridge rows plus a newer invoice's bridge. The late
      // payment must settle its own invoice without touching current access.
      for (const [invoiceId, grantId, starts] of [
        [request.id, "funded-pending:expired", createdAt.toISOString()],
        [
          randomUUID(),
          "funded-pending:newer",
          new Date(Date.now() - day).toISOString(),
        ],
      ]) {
        const ends = fundedTermEnd(starts!, 1);
        await pool.query(
          "INSERT INTO amp_funding_invoice_intents(id,idempotency_key,parent_email,student_billing_name,offer_snapshot,created_at,expires_at) VALUES($1,$2,'term@example.test','Synthetic Student',$3,$4,$5)",
          [invoiceId, randomUUID(), JSON.stringify(offer), starts, ends],
        );
        await pool.query(
          "INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at) VALUES($1,'expired','pilot',$1,'active',$2,$3)",
          [grantId, starts, ends],
        );
        await pool.query(
          "INSERT INTO amp_access_gifts(id,recipient_email,months,source,reference,funding_invoice_id,activated_at,ends_at,account_id,learner_id,grant_id) VALUES($1,'term@example.test',1,'funded-pending',$2,$2,$3,$4,'owner','expired',$5)",
          [randomUUID(), invoiceId, starts, ends, grantId],
        );
      }
      await pool.query(
        "INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at) VALUES('paid-newer','expired','stripe','paid-newer','active',now()-interval '1 day',now()+interval '1 month')",
      );
      const paidAt = new Date(createdAt.getTime() + 35 * day).toISOString();
      const payment = row(request, paidAt);
      await stageClassWalletPayment(
        pool,
        payment,
        config,
        "b".repeat(64),
        true,
      );
      assert.equal(
        (await reconcileClassWalletPayments(pool, [offer])).provisioned,
        1,
      );
      const updated = await funding.read("owner", request.id);
      assert.ok(updated.orderId);
      const saved = (
        await pool.query(
          "SELECT order_state,grant_state FROM amp_commerce_orders WHERE id=$1",
          [updated.orderId],
        )
      ).rows[0];
      assert.equal(saved.order_state.settlement, "settled");
      assert.equal(saved.order_state.license.startsAt, createdAt.toISOString());
      assert.equal(
        saved.order_state.license.endsAt,
        fundedTermEnd(createdAt.toISOString(), 1),
      );
      assert.equal(saved.grant_state, null);
      assert.deepEqual(
        (
          await pool.query(
            "SELECT id,status FROM amp_grants WHERE learner_id='expired' ORDER BY id",
          )
        ).rows,
        [
          { id: "funded-pending:expired", status: "revoked" },
          { id: "funded-pending:newer", status: "active" },
          { id: "paid-newer", status: "active" },
        ],
      );
      assert.deepEqual(
        (
          await pool.query(
            "SELECT grant_id,revoked_at IS NOT NULL AS revoked FROM amp_access_gifts WHERE learner_id='expired' ORDER BY grant_id",
          )
        ).rows,
        [
          { grant_id: "funded-pending:expired", revoked: true },
          { grant_id: "funded-pending:newer", revoked: false },
        ],
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int n FROM amp_commerce_events WHERE order_id=$1",
            [updated.orderId],
          )
        ).rows[0].n,
        4,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int n FROM amp_funded_activation_outbox WHERE request_id=$1",
            [request.id],
          )
        ).rows[0].n,
        0,
      );
      const presented = await funding.present("owner", updated);
      assert.equal(presented.paymentStatus, "settled");
      assert.notEqual(presented.accessStatus, "active");
      const stored = (
        await pool.query(
          "SELECT conversion_payload FROM amp_funding_requests WHERE id=$1",
          [request.id],
        )
      ).rows[0].conversion_payload;
      await provisionFundingRequest(pool, stored, [offer]);
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int n FROM amp_commerce_events WHERE order_id=$1",
            [updated.orderId],
          )
        ).rows[0].n,
        4,
      );
    } finally {
      await pool.end();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
