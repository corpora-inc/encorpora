import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { PostgresRepository } from "../src/server/repository.js";
import { FamilyRepository } from "../src/family/repository.js";
import { ConsentRepository } from "../src/parent-consent/repository.js";
import { ConsentSecrets, noticeDigest } from "../src/parent-consent/crypto.js";
import { installConsentPolicy } from "../src/parent-consent/policy.js";
import { deliverConsentMail } from "../src/parent-consent/worker.js";
import type { ConsentMail } from "../src/parent-consent/contracts.js";
import { FundingPurchaseRepository } from "../src/funding-purchase/repository.js";
import { FundingInvoiceRepository } from "../src/funding-purchase/invoice-intents.js";
import {
  stageClassWalletPayment,
  reconcileClassWalletPayments,
} from "../src/funding-purchase/classwallet-staging.js";
import { deliverFundedActivationMail } from "../src/funding-purchase/activation-mail.js";
import type { ClassWalletConfig } from "../src/funding-purchase/classwallet.js";
import { consentFixture } from "./parent-consent.fixture.js";
import { testFundingOffer } from "./funding-purchase.fixture.js";

for (const earlyPayment of [false, true])
  test(
    `new funded parent completes email consent, claim and activation mail; payment ${earlyPayment ? "before" : "after"} claim`,
    { skip: !process.env.AMP_TEST_DATABASE_URL },
    async () => {
      const url = process.env.AMP_TEST_DATABASE_URL!,
        schema = `amp_journey_${randomUUID().replaceAll("-", "")}`;
      const admin = new Pool({ connectionString: url, max: 1 });
      const scoped = new URL(url);
      scoped.searchParams.set("options", `-c search_path=${schema}`);
      const pool = new Pool({ connectionString: scoped.href });
      const learners = new PostgresRepository(scoped.href);
      // This synthetic policy proves the application path, not live eligibility.
      const policy = structuredClone(consentFixture);
      policy.review.paymentNotificationsReviewed = true;
      policy.notice.processors.push({
        name: "Resend",
        service: "Transactional mail",
        data: "Parent email and account notices",
        purpose: "Consent and activation notices",
        retention: "Synthetic test",
      });
      const offer = {
        ...testFundingOffer,
        programId: earlyPayment ? "ar-efa" : "az-esa",
        jurisdiction: earlyPayment ? "AR" : "AZ",
        documentPolicy: "named-student-invoice" as const,
        activationPolicy: "after-settlement" as const,
      };
      const funding = new FundingPurchaseRepository(pool, [offer]);
      const invoices = new FundingInvoiceRepository(funding);
      const consent = new ConsentRepository(
        pool,
        policy,
        new ConsentSecrets(randomBytes(32)),
        true,
      );
      const sent: ConsentMail[] = [];
      const transport = {
        binding: {
          provider: "synthetic",
          sender: "notice@example.com",
          credentialFingerprint: "synthetic-only",
        },
        async send(mail: ConsentMail) {
          sent.push(mail);
          return { kind: "accepted" as const, receipt: randomUUID() };
        },
      };
      const account = "amp|parent";
      const acknowledge = (mail: ConsentMail) => {
        const link = new URL(mail.text.match(/Review and respond: (\S+)/)![1]!);
        const fields = new URLSearchParams(link.hash.slice(1));
        return {
          requestId: fields.get("consent"),
          stage: fields.get("stage"),
          token: fields.get("token"),
          noticeDigest: fields.get("notice"),
          parentAttestation: true,
        };
      };
      try {
        await admin.query(`CREATE SCHEMA ${schema}`);
        await migrate(scoped.href);
        await installConsentPolicy(pool, policy);
        const invoice = await invoices.create({
          offerId: offer.id,
          offerRevision: offer.revision,
          parentEmail: "parent@example.com",
          studentBillingName: "Fixture Student",
          idempotencyKey: randomUUID(),
        });
        assert.equal(
          (await pool.query("SELECT count(*)::int n FROM amp_learners")).rows[0]
            .n,
          0,
        );
        await pool.query(
          `INSERT INTO amp_auth_users(id,name,email,"emailVerified") VALUES('parent','Fixture Parent','parent@example.com',false)`,
        );
        const begin = {
          email: "parent@example.com",
          requestId: randomUUID(),
          noticeDigest: noticeDigest(policy),
          parentAttestation: true,
        };
        await assert.rejects(
          consent.begin(account, begin),
          /email_unconfirmed/,
        );
        // Simulate the separate authentication email-confirmation boundary.
        await pool.query(
          `UPDATE amp_auth_users SET "emailVerified"=true WHERE id='parent'`,
        );
        await assert.rejects(learners.create(account, "Fixture"), /consent/);
        const now = new Date().toISOString();
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
              programId: offer.programId,
              channelReference: offer.channelReference,
            },
          ],
        };
        const payment = {
          "Order ID": "synthetic-order",
          "Transaction ID": randomUUID(),
          "Invoice/Quote": invoice.id,
          Organization: "Fixture",
          State: "XX",
          "Distribution Name": "Fixture",
          "Payment Amount": "123.00",
          Total: "120.00",
          Fee: "3.00",
          Status: "Settled",
          "Payment Approval Date": now,
          "Last Update": now,
        };
        if (earlyPayment) {
          await stageClassWalletPayment(
            pool,
            payment,
            config,
            "a".repeat(64),
            true,
          );
          await reconcileClassWalletPayments(pool, [offer]);
          assert.equal(
            (await pool.query("SELECT count(*)::int n FROM amp_grants")).rows[0]
              .n,
            0,
          );
        }
        await consent.begin(account, begin);
        await deliverConsentMail(consent, transport);
        await consent.acknowledge(account, acknowledge(sent[0]!));
        assert.equal(await learners.hasConsent(account), false);
        assert.equal(await deliverConsentMail(consent, transport), false);
        // Advance only the isolated fixture's clock-dependent scheduling records.
        await pool.query(
          "UPDATE amp_consent_requests SET confirmation_after=now()-interval '1 minute' WHERE phase='awaiting-confirmation'",
        );
        await pool.query(
          "UPDATE amp_consent_outbox SET available_at=now()-interval '1 minute' WHERE stage='confirmation'",
        );
        await deliverConsentMail(consent, transport);
        await consent.acknowledge(account, acknowledge(sent[1]!));
        assert.equal(await learners.hasConsent(account), true);
        const learner = await learners.create(account, "Fixture", 2016);
        const request = await invoices.claim(account, invoice.id, learner.id);
        await invoices.claim(account, invoice.id, learner.id);
        if (!earlyPayment) {
          const settledAt = new Date().toISOString();
          payment["Payment Approval Date"] = settledAt;
          payment["Last Update"] = settledAt;
          await stageClassWalletPayment(
            pool,
            payment,
            config,
            "a".repeat(64),
            true,
          );
        }
        await reconcileClassWalletPayments(pool, [offer]);
        await reconcileClassWalletPayments(pool, [offer]);
        const verified = await funding.read(account, request.id);
        assert.ok(verified.orderId);
        assert.equal(
          (await pool.query("SELECT count(*)::int n FROM amp_grants")).rows[0]
            .n,
          1,
        );
        assert.equal(
          await deliverFundedActivationMail(pool, transport, policy),
          true,
        );
        assert.equal(
          await deliverFundedActivationMail(pool, transport, policy),
          false,
        );
        assert.equal(sent.length, 3);
        assert.equal(sent[2]!.recipient, "parent@example.com");
        assert.match(sent[2]!.subject, /access is ready/);
        assert.ok(!sent[2]!.text.includes("Fixture Student"));
        await new FamilyRepository(pool).withdraw(account);
        assert.equal(await learners.hasConsent(account), false);
        await reconcileClassWalletPayments(pool, [offer]);
        assert.equal(await learners.hasConsent(account), false);
        assert.equal(
          await deliverFundedActivationMail(pool, transport, policy),
          false,
        );
      } finally {
        await learners.pool.end();
        await pool.end();
        await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
        await admin.end();
      }
    },
  );
