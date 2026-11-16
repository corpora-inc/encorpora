import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { FundingPurchaseRepository } from "../src/funding-purchase/repository.js";
import { FundingInvoiceRepository } from "../src/funding-purchase/invoice-intents.js";
import { stageClassWalletPayment } from "../src/funding-purchase/classwallet-staging.js";
import type { ClassWalletConfig } from "../src/funding-purchase/classwallet.js";
import { withMonthlyOffers } from "../src/funding-purchase/monthly-offers.js";
import { withInvoiceDateTerms } from "../src/funding-purchase/offer-terms.js";
import { fundedInvoiceTerm } from "../src/funding-purchase/term.js";
import { legacyInvoiceOffer } from "./funding-offer-terms.fixture.js";

for (const legacy of withMonthlyOffers([legacyInvoiceOffer])) {
  test(
    `${legacy.termMonths}-month issued invoices can be retried, submitted and claimed after the dated-term transition`,
    { skip: !process.env.AMP_TEST_DATABASE_URL },
    async () => {
      const url = process.env.AMP_TEST_DATABASE_URL!;
      const schema = `amp_offer_terms_${randomUUID().replaceAll("-", "")}`;
      const admin = new Pool({ connectionString: url, max: 1 });
      const scoped = new URL(url);
      scoped.searchParams.set("options", `-c search_path=${schema}`);
      const pool = new Pool({ connectionString: scoped.href });
      try {
        await admin.query(`CREATE SCHEMA ${schema}`);
        await migrate(scoped.href);
        await pool.query(
          `INSERT INTO amp_auth_users(id,name,email,"emailVerified") VALUES('owner','Synthetic','parent@example.test',true),('bridge','Synthetic','bridge@example.test',true)`,
        );
        await pool.query(
          "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES('amp|owner','fixture','verified','fixture'),('amp|bridge','fixture','verified','fixture')",
        );
        await pool.query(
          "INSERT INTO amp_learners(id,account_id,name) VALUES('child','amp|owner','Synthetic'),('paid-child','amp|owner','Synthetic'),('bridge-child','amp|bridge','Synthetic')",
        );
        const oldFunding = new FundingPurchaseRepository(pool, [legacy]);
        const oldInvoices = new FundingInvoiceRepository(oldFunding);
        const current = withInvoiceDateTerms(legacy);
        const funding = new FundingPurchaseRepository(pool, [current]);
        const invoices = new FundingInvoiceRepository(funding);
        const requestInput = {
          offerId: legacy.id,
          offerRevision: legacy.revision,
          learnerId: "child",
          studentBillingName: "Synthetic Student",
          idempotencyKey: randomUUID(),
        };
        const request = await oldFunding.create("amp|owner", requestInput);
        assert.deepEqual(
          await funding.create("amp|owner", requestInput),
          request,
        );
        assert.equal(funding.offerAvailable(request), true);
        await funding.update(
          "amp|owner",
          request.id,
          "parent-reported-submitted",
        );
        assert.deepEqual(
          (await funding.read("amp|owner", request.id)).offer,
          legacy,
        );
        assert.equal(
          new FundingPurchaseRepository(pool, [
            { ...current, enabled: false },
          ]).offerAvailable(request),
          false,
        );
        await assert.rejects(
          funding.create("amp|owner", {
            ...requestInput,
            idempotencyKey: randomUUID(),
          }),
          /offer_unavailable/,
          "a fresh invoice must select the offered dated revision",
        );
        const fresh = await funding.create("amp|owner", {
          ...requestInput,
          offerRevision: current.revision,
          idempotencyKey: randomUUID(),
        });
        assert.deepEqual(fresh.offer, current);

        const invoiceInput = {
          offerId: legacy.id,
          offerRevision: legacy.revision,
          parentEmail: "parent@example.test",
          studentBillingName: "Synthetic Student",
          idempotencyKey: randomUUID(),
        };
        const unpaid = await oldInvoices.create(invoiceInput);
        assert.deepEqual(await invoices.create(invoiceInput), unpaid);
        const claimed = await invoices.claim("amp|owner", unpaid.id, "child");
        assert.deepEqual(claimed.offer, legacy);
        assert.equal(claimed.createdAt, unpaid.createdAt);
        await funding.update(
          "amp|owner",
          unpaid.id,
          "parent-reported-submitted",
        );

        // A timely payment received before the migration remains claimable even
        // when the invoice deadline passes before the parent finishes setup.
        const issuedAt = new Date(Date.now() - 31 * 86400000);
        const paid = await oldInvoices.create(
          { ...invoiceInput, idempotencyKey: randomUUID() },
          issuedAt,
        );
        const settledAt = new Date(issuedAt.getTime() + 1000).toISOString();
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
              programId: legacy.programId,
              channelReference: legacy.channelReference,
            },
          ],
        };
        const gross = ((legacy.subtotalMinor + legacy.taxMinor) / 100).toFixed(
          2,
        );
        await stageClassWalletPayment(
          pool,
          {
            "Order ID": randomUUID(),
            "Transaction ID": randomUUID(),
            "Invoice/Quote": paid.id,
            Organization: "Fixture",
            State: "XX",
            "Distribution Name": "Fixture",
            "Payment Amount": gross,
            Total: gross,
            Fee: "0.00",
            Status: "Settled",
            "Payment Approval Date": settledAt,
            "Last Update": settledAt,
          },
          config,
          "a".repeat(64),
          true,
        );
        assert.equal(
          (await invoices.list("amp|owner")).find((row) => row.id === paid.id)
            ?.paymentVerified,
          true,
        );
        const paidClaim = await invoices.claim(
          "amp|owner",
          paid.id,
          "paid-child",
        );
        assert.deepEqual(paidClaim.offer, legacy);
        assert.equal(paidClaim.createdAt, paid.createdAt);
        const stored = await pool.query(
          "SELECT offer_snapshot FROM amp_funding_invoice_intents WHERE id=ANY($1)",
          [[paid.id, unpaid.id]],
        );
        assert.equal(stored.rows.length, 2);
        for (const row of stored.rows)
          assert.deepEqual(row.offer_snapshot, legacy);

        const dated = await invoices.create(
          {
            ...invoiceInput,
            offerRevision: current.revision,
            parentEmail: "bridge@example.test",
            idempotencyKey: randomUUID(),
          },
          new Date(Date.now() - 7 * 86400000),
        );
        await invoices.claim("amp|bridge", dated.id, "bridge-child");
        const bridgeEnd = async () =>
          (
            await pool.query(
              `SELECT a.ends_at AS gift_end,g.ends_at AS grant_end FROM amp_access_gifts a
           JOIN amp_grants g ON g.id=a.grant_id WHERE a.funding_invoice_id=$1`,
              [dated.id],
            )
          ).rows[0];
        const initialEnd = new Date(
          Date.parse(dated.createdAt) + 14 * 86400000,
        ).toISOString();
        assert.equal((await bridgeEnd()).grant_end.toISOString(), initialEnd);
        const cappedEnd = new Date(
          Math.min(
            Date.parse(dated.createdAt) + 60 * 86400000,
            Date.parse(fundedInvoiceTerm(dated)!.endsAt),
          ),
        ).toISOString();
        for (let attempt = 0; attempt < 2; attempt++) {
          await funding.update(
            "amp|bridge",
            dated.id,
            "parent-reported-submitted",
          );
          const savedBridge = await bridgeEnd();
          assert.equal(savedBridge.gift_end.toISOString(), cappedEnd);
          assert.equal(savedBridge.grant_end.toISOString(), cappedEnd);
        }
      } finally {
        await pool.end();
        await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
        await admin.end();
      }
    },
  );
}
