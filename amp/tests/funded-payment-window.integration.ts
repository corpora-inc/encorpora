import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { FundingInvoiceRepository } from "../src/funding-purchase/invoice-intents.js";
import { FundingPurchaseRepository } from "../src/funding-purchase/repository.js";
import { provisionFundingRequest } from "../src/funding-purchase/provision.js";
import {
  stageClassWalletPayment,
  reconcileClassWalletPayments,
} from "../src/funding-purchase/classwallet-staging.js";
import {
  prepareClassWalletProvision,
  type ClassWalletConfig,
} from "../src/funding-purchase/classwallet.js";
import { testFundingOffer } from "./funding-purchase.fixture.js";

// The same payment-window rule applies whether claim/consent preceded payment
// or the parent finishes setup after a timely payment has already arrived.
test(
  "expired paid invoices keep verified fulfillment eligibility without weakening payment, consent or cancellation checks",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_window_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const pool = new Pool({ connectionString: scoped.href });
    const offer = {
      ...testFundingOffer,
      documentPolicy: "named-student-invoice" as const,
      activationPolicy: "after-settlement" as const,
    };
    const funding = new FundingPurchaseRepository(pool, [offer]);
    const invoices = new FundingInvoiceRepository(funding);
    const config: ClassWalletConfig = {
      verificationReference: "synthetic-only",
      currency: offer.currency,
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
          programId: offer.programId,
          channelReference: offer.channelReference,
        },
      ],
    };
    const createdAt = new Date(Date.now() - 31 * 86400000);
    const settledAt = new Date(createdAt.getTime() + 1000).toISOString();
    const gross = ((offer.subtotalMinor + offer.taxMinor) / 100).toFixed(2);
    const payment = (id: string) => ({
      "Order ID": "synthetic",
      "Transaction ID": randomUUID(),
      "Invoice/Quote": id,
      Organization: "Fixture",
      State: "XX",
      "Distribution Name": "Fixture",
      "Payment Amount": gross,
      Total: gross,
      Fee: "0.00",
      Status: "Settled",
      "Payment Approval Date": settledAt,
      "Last Update": settledAt,
    });
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      await pool.query(
        `INSERT INTO amp_auth_users(id,name,email,"emailVerified") VALUES('window','Synthetic','window@example.test',true)`,
      );
      await pool.query(
        "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES('amp|window','test','verified','test')",
      );
      // Claim an invoice whose payment was timely but imported after its deadline.
      const invoice = await invoices.create(
        {
          offerId: offer.id,
          offerRevision: offer.revision,
          parentEmail: "window@example.test",
          studentBillingName: "Synthetic",
          idempotencyKey: randomUUID(),
        },
        createdAt,
      );
      await pool.query(
        "INSERT INTO amp_learners(id,account_id,name) VALUES('late-claim','amp|window','Synthetic')",
      );
      await assert.rejects(
        invoices.claim("amp|window", invoice.id, "late-claim"),
        /invoice_unavailable/,
      );
      await stageClassWalletPayment(
        pool,
        payment(invoice.id),
        config,
        "a".repeat(64),
        true,
      );
      assert.equal(
        (await invoices.list("amp|window"))[0]?.paymentVerified,
        true,
      );
      await invoices.claim("amp|window", invoice.id, "late-claim");
      assert.equal(
        (await pool.query("SELECT count(*)::int n FROM amp_grants")).rows[0].n,
        0,
        "an expired invoice never issues unpaid access",
      );
      assert.equal(
        (await reconcileClassWalletPayments(pool, [offer])).provisioned,
        1,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int n FROM amp_grants WHERE status='active'",
          )
        ).rows[0].n,
        1,
      );

      for (const scenario of [
        "late-payment",
        "unsettled",
        "wrong-amount",
        "unverified",
        "cancelled",
        "withdrawn",
        "disabled-offer",
        "changed-offer",
        "tampered-conversion",
      ] as const) {
        await pool.query(
          "INSERT INTO amp_learners(id,account_id,name) VALUES($1,'amp|window','Synthetic')",
          [scenario],
        );
        const request = await funding.create(
          "amp|window",
          {
            offerId: offer.id,
            offerRevision: offer.revision,
            learnerId: scenario,
            studentBillingName: "Synthetic",
            idempotencyKey: randomUUID(),
          },
          createdAt,
        );
        const row = payment(request.id);
        if (scenario === "late-payment")
          row["Last Update"] = new Date().toISOString();
        if (scenario === "unsettled") row.Status = "Approved";
        if (scenario === "wrong-amount") row["Payment Amount"] = "0.00";
        if (scenario === "cancelled")
          await funding.update(
            "amp|window",
            request.id,
            "cancelled",
            new Date(createdAt.getTime() + 2000),
          );
        if (
          ["late-payment", "unsettled", "wrong-amount", "cancelled"].includes(
            scenario,
          )
        ) {
          await assert.rejects(
            stageClassWalletPayment(pool, row, config, "a".repeat(64), true),
          );
        } else if (scenario === "unverified") {
          const payload = prepareClassWalletProvision(
            row,
            request,
            config,
            new Date().toISOString(),
          );
          await assert.rejects(
            provisionFundingRequest(pool, payload, [offer]),
            /request_not_provisionable/,
          );
        } else {
          await stageClassWalletPayment(
            pool,
            row,
            config,
            "a".repeat(64),
            true,
          );
          if (scenario === "withdrawn")
            await pool.query(
              "UPDATE amp_parent_consents SET withdrawn_at=now()",
            );
          if (scenario === "tampered-conversion") {
            const payload = prepareClassWalletProvision(
              row,
              request,
              config,
              new Date().toISOString(),
            );
            const fulfilled = payload.events.find(
              (e) => e.type === "order.fulfilled",
            )!;
            fulfilled.occurredAt = new Date(
              createdAt.getTime() + 2000,
            ).toISOString();
            await pool.query(
              "UPDATE amp_classwallet_payments SET conversion_payload=$2 WHERE invoice_id=$1",
              [request.id, JSON.stringify(payload)],
            );
          }
          const liveOffer =
            scenario === "disabled-offer"
              ? { ...offer, enabled: false }
              : scenario === "changed-offer"
                ? { ...offer, revision: "changed" }
                : offer;
          await reconcileClassWalletPayments(pool, [liveOffer]);
          if (scenario === "withdrawn") {
            const state = (
              await pool.query(
                "SELECT attempts,error_code FROM amp_classwallet_payments WHERE invoice_id=$1",
                [request.id],
              )
            ).rows[0];
            assert.equal(state.attempts, 0);
            assert.equal(state.error_code, "awaiting_parent_consent");
            await pool.query(
              "UPDATE amp_parent_consents SET withdrawn_at=NULL",
            );
          }
          // Keep this negative case from becoming eligible in a later case's run.
          await pool.query(
            "UPDATE amp_classwallet_payments SET stopped_at=now() WHERE invoice_id=$1",
            [request.id],
          );
        }
        assert.equal(
          (
            await pool.query("SELECT 1 FROM amp_grants WHERE learner_id=$1", [
              scenario,
            ])
          ).rowCount,
          0,
          scenario,
        );
      }
    } finally {
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
