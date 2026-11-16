import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { FundingPurchaseRepository } from "../src/funding-purchase/repository.js";
import { FundingInvoiceRepository } from "../src/funding-purchase/invoice-intents.js";
import { deliverFundingReminderMail } from "../src/funding-purchase/reminder-mail.js";
import { withInvoiceDateTerms } from "../src/funding-purchase/offer-terms.js";
import {
  fundedInvoiceTerm,
  fundedTermEnd,
} from "../src/funding-purchase/term.js";
import { installConsentPolicy } from "../src/parent-consent/policy.js";
import type {
  ConsentMail,
  ConsentTransport,
} from "../src/parent-consent/contracts.js";
import type { FundingOffer } from "../src/funding-purchase/contracts.js";
import { consentFixture } from "./parent-consent.fixture.js";
import { legacyInvoiceOffer } from "./funding-offer-terms.fixture.js";
const day = 86400000;
const policy = {
  ...consentFixture,
  review: { ...consentFixture.review, paymentNotificationsReviewed: true },
  notice: {
    ...consentFixture.notice,
    processors: [
      ...consentFixture.notice.processors,
      {
        name: "Resend",
        service: "Email",
        data: "Invoice",
        purpose: "Requested delivery",
        retention: "Limited",
      },
    ],
  },
};
const legacyMonthly: FundingOffer = {
  ...legacyInvoiceOffer,
  termMonths: 1,
  termPolicy: "one-month-from-verified-provisioning",
};
for (const offer of [
  legacyMonthly,
  legacyInvoiceOffer,
  withInvoiceDateTerms(legacyMonthly),
  withInvoiceDateTerms(legacyInvoiceOffer),
]) {
  test(
    `submitted ${offer.termPolicy} reminder uses its actual access deadline and preserves retries`,
    { skip: !process.env.AMP_TEST_DATABASE_URL },
    async () => {
      const url = process.env.AMP_TEST_DATABASE_URL!;
      const schema = `amp_reminder_term_${randomUUID().replaceAll("-", "")}`;
      const admin = new Pool({ connectionString: url, max: 1 });
      const scoped = new URL(url);
      // Calendar invoice dates are UTC even when an operator's DB session is not.
      scoped.searchParams.set(
        "options",
        `-c search_path=${schema} -c timezone=America/New_York`,
      );
      const pool = new Pool({ connectionString: scoped.href });
      try {
        await admin.query(`CREATE SCHEMA ${schema}`);
        await migrate(scoped.href);
        await installConsentPolicy(pool, policy);
        await pool.query(
          `INSERT INTO amp_auth_users(id,name,email,"emailVerified") VALUES('owner','Synthetic','parent@example.test',true)`,
        );
        await pool.query(
          "INSERT INTO amp_learners(id,account_id,name) VALUES('child','amp|owner','Synthetic')",
        );
        await pool.query(
          "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES('amp|owner','fixture','verified','fixture')",
        );
        const funding = new FundingPurchaseRepository(pool, [offer]);
        const invoices = new FundingInvoiceRepository(funding);
        const createSubmitted = async (at: Date) => {
          const invoice = await invoices.create(
            {
              offerId: offer.id,
              offerRevision: offer.revision,
              parentEmail: "parent@example.test",
              studentBillingName: "Synthetic Student",
              idempotencyKey: randomUUID(),
            },
            at,
          );
          await invoices.claim(
            "amp|owner",
            invoice.id,
            "child",
            new Date(at.getTime() + 1000),
          );
          await funding.update(
            "amp|owner",
            invoice.id,
            "parent-reported-submitted",
            new Date(at.getTime() + 2000),
          );
          return invoice;
        };
        const sent: ConsentMail[] = [];
        const transport: ConsentTransport = {
          binding: {
            provider: "resend",
            sender: "sender@example.test",
            credentialFingerprint: "fixture",
          },
          async send(mail) {
            sent.push(mail);
            return sent.length === 1
              ? { kind: "unknown" }
              : { kind: "accepted", receipt: "synthetic" };
          },
        };
        await createSubmitted(new Date(Date.now() - 10 * day));
        assert.equal(
          await deliverFundingReminderMail(pool, transport, policy),
          false,
          "Submission suppresses the initial reminder before the processing reminder is due",
        );
        const created =
          offer.termPolicy === "one-month-from-invoice"
            ? Array.from(
                { length: 7 },
                (_, i) => new Date(Date.now() - (26 + i) * day),
              ).find((at) => {
                const remaining =
                  Date.parse(fundedTermEnd(at.toISOString(), 1)) - Date.now();
                return remaining > day && remaining <= 3 * day;
              })!
            : new Date(Date.now() - 58 * day);
        assert.ok(created);
        const invoice = await createSubmitted(created);
        const fixed = fundedInvoiceTerm(invoice);
        const end = new Date(
          Math.min(
            created.getTime() + 60 * day,
            fixed ? Date.parse(fixed.endsAt) : Infinity,
          ),
        ).toISOString();
        assert.equal(
          await deliverFundingReminderMail(pool, transport, policy),
          true,
        );
        assert.equal(sent.length, 1);
        assert.equal(sent[0]!.subject, "Your AMP invoice is awaiting payment");
        assert.ok(
          sent[0]!.text.includes(
            `Your invoice access ends on ${end.slice(0, 10)} (UTC).`,
          ),
        );
        const saved = (
          await pool.query(
            "SELECT deadline_at,available_at FROM amp_funding_invoice_reminders WHERE invoice_id=$1 AND kind='processing'",
            [invoice.id],
          )
        ).rows[0];
        assert.equal(saved.deadline_at.toISOString(), end);
        assert.equal(
          (
            await pool.query(
              "SELECT count(*)::int n FROM amp_funding_invoice_reminders WHERE invoice_id=$1 AND kind='submission'",
              [invoice.id],
            )
          ).rows[0].n,
          0,
        );
        await pool.query(
          "UPDATE amp_funding_invoice_reminders SET available_at=now() WHERE invoice_id=$1",
          [invoice.id],
        );
        assert.equal(
          await deliverFundingReminderMail(pool, transport, policy),
          true,
        );
        assert.deepEqual(
          sent[1],
          sent[0],
          "Ambiguous retry preserves deadline, PDF and provider key",
        );
        assert.equal(
          await deliverFundingReminderMail(pool, transport, policy),
          false,
        );
        assert.equal(sent.length, 2);
      } finally {
        await pool.end();
        await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
        await admin.end();
      }
    },
  );
}
