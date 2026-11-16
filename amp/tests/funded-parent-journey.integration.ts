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
import { fundedLearningAllowed } from "../src/funding-purchase/learning-permission.js";
import type { ClassWalletConfig } from "../src/funding-purchase/classwallet.js";
import { consentFixture } from "./parent-consent.fixture.js";
import { testFundingOffer } from "./funding-purchase.fixture.js";

for (const timing of [
  "after-consent",
  "before-consent",
  "consent-after-expiry",
  "consent-after-offer-expiry",
] as const)
  test(
    `funded payment and activation mail preserve learning permission: ${timing}`,
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
      const earlyPayment = timing !== "after-consent";
      const restrictedPayment = timing === "before-consent";
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
        // A parent may add and name their own child before consent; the child
        // learns on the restricted basis (docs/parent-consent.md#childrens-names).
        const learner = await learners.create(account, "Early", 2017);
        assert.equal(learner.namePending, true);
        const request = await invoices.claim(account, invoice.id, learner.id);
        assert.equal(
          (
            await pool.query(
              "SELECT status FROM amp_grants WHERE learner_id=$1",
              [learner.id],
            )
          ).rows[0].status,
          "active",
        );
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
          // A parent-entry name needs no new permission for paid access.
          // Explicit withdrawal, however, must keep payment deferred until
          // the parent restores permission, even after invoice expiry.
          if (!restrictedPayment)
            await new FamilyRepository(pool).withdraw(account);
          await stageClassWalletPayment(
            pool,
            payment,
            config,
            "a".repeat(64),
            true,
          );
          await reconcileClassWalletPayments(pool, [offer]);
          assert.equal(
            (
              await pool.query(
                "SELECT count(*)::int n FROM amp_grants WHERE status='active'",
              )
            ).rows[0].n,
            1,
          );
          const deferred = (
            await pool.query(
              "SELECT attempts,error_code,stopped_at,conversion_payload FROM amp_classwallet_payments",
            )
          ).rows[0];
          assert.equal(deferred.attempts, 0);
          assert.equal(
            deferred.error_code,
            restrictedPayment ? null : "awaiting_parent_consent",
          );
          assert.equal(deferred.stopped_at, null);
          if (restrictedPayment) {
            assert.ok(deferred.conversion_payload);
            assert.ok((await funding.read(account, request.id)).orderId);
            const child = (
              await pool.query(
                "SELECT name,name_pending,name_basis FROM amp_learners WHERE id=$1",
                [learner.id],
              )
            ).rows[0];
            assert.equal(child.name, "Early");
            assert.equal(child.name_pending, true);
            assert.equal(child.name_basis, "parent_entry");
            assert.equal(
              (
                await pool.query(
                  "SELECT count(*)::int n FROM amp_parent_consents WHERE account_id=$1",
                  [account],
                )
              ).rows[0].n,
              0,
            );
          } else assert.equal(deferred.conversion_payload, null);
        }
        if (
          timing === "consent-after-expiry" ||
          timing === "consent-after-offer-expiry"
        ) {
          // The payment was verified in-window; consent completes after the actual deadline.
          await pool.query(
            "UPDATE amp_funding_requests SET created_at=now()-interval '29 days',expires_at=now()+interval '1 second' WHERE id=$1",
            [invoice.id],
          );
          await pool.query(
            "UPDATE amp_funding_invoice_intents SET created_at=now()-interval '29 days',expires_at=(SELECT expires_at FROM amp_funding_requests WHERE id=$1) WHERE id=$1",
            [invoice.id],
          );
          if (timing === "consent-after-offer-expiry") {
            offer.validUntil = (
              await pool.query(
                "SELECT expires_at FROM amp_funding_requests WHERE id=$1",
                [invoice.id],
              )
            ).rows[0].expires_at.toISOString();
            // Advance the isolated fixture's offer clock with its invoice clock.
            for (const table of [
              "amp_funding_requests",
              "amp_funding_invoice_intents",
            ])
              await pool.query(
                `UPDATE ${table} SET offer_snapshot=$2 WHERE id=$1`,
                [invoice.id, JSON.stringify(offer)],
              );
          }
          await new Promise((resolve) => setTimeout(resolve, 1100));
        }
        if (!restrictedPayment) {
          await consent.begin(account, begin);
          await deliverConsentMail(consent, transport);
          assert.equal(await learners.hasConsent(account), false);
          await consent.acknowledge(account, acknowledge(sent[0]!));
        }
        assert.equal(await learners.hasConsent(account), !restrictedPayment);
        await invoices.claim(account, invoice.id, learner.id);
        await pool.query(
          "UPDATE amp_classwallet_payments SET next_attempt_at=now() WHERE invoice_id=$1",
          [invoice.id],
        );
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
          (
            await pool.query(
              "SELECT count(*)::int n FROM amp_grants WHERE status='active'",
            )
          ).rows[0].n,
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
        assert.equal(sent.length, restrictedPayment ? 1 : 2);
        const activated = sent.at(-1)!;
        assert.equal(activated.recipient, "parent@example.com");
        assert.match(activated.subject, /access is ready/);
        assert.ok(!activated.text.includes("Fixture Student"));
        if (restrictedPayment) {
          assert.equal(
            await fundedLearningAllowed(
              pool,
              request.id,
              "amp|other",
              learner.id,
            ),
            false,
          );
          assert.equal(
            await fundedLearningAllowed(
              pool,
              randomUUID(),
              account,
              learner.id,
            ),
            false,
          );
          await pool.query(
            "UPDATE amp_learners SET name_pending=false,deleted_at=now() WHERE id=$1",
            [learner.id],
          );
          assert.equal(
            await fundedLearningAllowed(pool, request.id, account, learner.id),
            false,
          );
          await pool.query(
            "UPDATE amp_learners SET name_pending=true,deleted_at=NULL WHERE id=$1",
            [learner.id],
          );
        }
        await new FamilyRepository(pool).withdraw(account);
        assert.equal(await learners.hasConsent(account), false);
        assert.equal(
          await fundedLearningAllowed(pool, request.id, account, learner.id),
          false,
        );
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
