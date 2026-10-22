import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { FundingPurchaseRepository } from "../src/funding-purchase/repository.js";
import {
  fundingOfferSchema,
  presentRequest,
} from "../src/funding-purchase/contracts.js";
import { provisionFundingRequest } from "../src/funding-purchase/provision.js";
import {
  prepareClassWalletProvision,
  type ClassWalletConfig,
} from "../src/funding-purchase/classwallet.js";
import { testFundingOffer } from "./funding-purchase.fixture.js";
test(
  "invoice review prepares no access; only independently verified complete payment provisions",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!,
      schema = `amp_invoice_review_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 }),
      scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const pool = new Pool({ connectionString: scoped.href });
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      await pool.query(
        "INSERT INTO amp_learners(id,account_id,name) VALUES('child','owner','Fixture'); INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES('owner','fixture','verified','private')",
      );
      const {
        skuReference: _sku,
        annualTermReference: _term,
        ...approvals
      } = testFundingOffer.approvals;
      const offer = fundingOfferSchema.parse({
        ...testFundingOffer,
        approvals,
        purchaseReview: "individual-approval-required",
        route: "direct-pay",
        activationPolicy: "after-settlement",
        documentPolicy: "named-student-invoice",
      });
      const repo = new FundingPurchaseRepository(pool, [offer]);
      const request = await repo.create("owner", {
        offerId: offer.id,
        offerRevision: offer.revision,
        learnerId: "child",
        studentBillingName: "Fixture Learner",
        idempotencyKey: randomUUID(),
      });
      assert.equal(presentRequest(request).accessStatus, "not-granted");
      assert.equal(presentRequest(request).paymentStatus, "not-verified");
      const config: ClassWalletConfig = {
        verificationReference: "synthetic",
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
            programId: offer.programId,
            channelReference: offer.channelReference,
          },
        ],
      };
      const at = new Date().toISOString();
      const payload = prepareClassWalletProvision(
        {
          "Order ID": "synthetic",
          "Transaction ID": randomUUID(),
          "Invoice/Quote": request.id,
          Organization: "Fixture",
          State: "XX",
          "Distribution Name": "Fixture",
          "Payment Amount": "123.00",
          Fee: "0.00",
          Total: "123.00",
          Status: "Settled",
          "Payment Approval Date": at,
          "Last Update": at,
        },
        request,
        config,
        at,
      );
      await assert.rejects(
        provisionFundingRequest(
          pool,
          {
            ...payload,
            events: payload.events.filter((e) => e.type !== "order.settled"),
          },
          [offer],
        ),
      );
      assert.equal(
        (await pool.query("SELECT count(*)::int n FROM amp_grants")).rows[0].n,
        0,
      );
      await provisionFundingRequest(pool, payload, [offer]);
      assert.equal(
        (await pool.query("SELECT count(*)::int n FROM amp_grants")).rows[0].n,
        1,
      );
    } finally {
      await pool.end();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
