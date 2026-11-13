import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import type { CommerceEvent } from "../src/commerce/contracts.js";
import type {
  FundingOffer,
  FundingRequest,
} from "../src/funding-purchase/contracts.js";
import { FundingPurchaseRepository } from "../src/funding-purchase/repository.js";
import { FundingInvoiceRepository } from "../src/funding-purchase/invoice-intents.js";
import { provisionFundingRequest } from "../src/funding-purchase/provision.js";
import {
  reconcileClassWalletPayments,
  stageClassWalletPayment,
} from "../src/funding-purchase/classwallet-staging.js";
import type { ClassWalletConfig } from "../src/funding-purchase/classwallet.js";
import { AccessGiftRepository } from "../src/access-grants/repository.js";
import { testFundingOffer } from "./funding-purchase.fixture.js";

/* An adult student paying month to month from her own education-funds
   account, on her own login, as her own learner; and the children's rules
   that stay exactly as they were. Synthetic offers and people only. */

const enabled = { skip: !process.env.AMP_TEST_DATABASE_URL };
const { creditAgreementReference: _credit, ...base } = testFundingOffer;
/** A program's reviewed annual invoice, as the live offers are configured. */
const yearly: FundingOffer = {
  ...base,
  id: "fixture-annual-invoice",
  route: "direct-pay",
  activationPolicy: "after-settlement",
  documentPolicy: "named-student-invoice",
  purchaseReview: "individual-approval-required",
  approvals: {
    vendorReference: "private-vendor",
    routeReference: "private-route",
    paymentReference: "private-payment",
  },
};
/** The same program, one month at a time. */
const monthly = {
  ...yearly,
  id: "fixture-monthly-invoice",
  sku: "fixture-monthly",
  subtotalMinor: 5900,
  termMonths: 1,
  termPolicy: "one-month-from-verified-provisioning",
} as unknown as FundingOffer;
const offers = [yearly, monthly];

async function fixture(
  run: (pool: Pool, invoices: FundingInvoiceRepository) => Promise<void>,
) {
  const url = process.env.AMP_TEST_DATABASE_URL!,
    schema = `amp_monthly_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: url, max: 1 });
  const scoped = new URL(url);
  scoped.searchParams.set("options", `-c search_path=${schema}`);
  const pool = new Pool({ connectionString: scoped.href, max: 8 });
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    // An adult student with no consent record (she has no children), and a
    // parent who hasn't given verified consent yet.
    await pool.query(
      `INSERT INTO amp_auth_users(id,name,email,"emailVerified") VALUES
       ('student','Student','student@example.com',true),
       ('parent','Parent','parent@example.com',true)`,
    );
    await pool.query(
      `INSERT INTO amp_learners(id,account_id,name,adult) VALUES
       ('own','amp|student','Student',true),
       ('parent-own','amp|parent','Parent',true)`,
    );
    await pool.query(
      `INSERT INTO amp_learners(id,account_id,name,birth_year) VALUES
       ('child','amp|parent','Child',2014)`,
    );
    await run(
      pool,
      new FundingInvoiceRepository(new FundingPurchaseRepository(pool, offers)),
    );
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
}

const invoiceFor = (
  invoices: FundingInvoiceRepository,
  email: string,
  offer = monthly,
) =>
  invoices.create({
    offerId: offer.id,
    offerRevision: offer.revision,
    parentEmail: email,
    studentBillingName: "Fixture Student",
    idempotencyKey: randomUUID(),
  });

/** A verified settlement for a claimed request: its term starts at
 * `startsAt` (activation, unless it follows current access). */
function settlement(
  request: FundingRequest,
  term: { activatedAt: string; startsAt?: string; endsAt: string },
) {
  const orderId = randomUUID();
  const envelope = {
    orderId,
    channel: "esa" as const,
    channelReference: request.offer.channelReference,
    occurredAt: term.activatedAt,
  };
  const events: CommerceEvent[] = [
    {
      ...envelope,
      id: `${orderId}:created`,
      type: "order.created",
      order: {
        id: orderId,
        account: { id: request.accountId },
        license: {
          accountId: request.accountId,
          learnerId: request.learnerId,
          sku: request.offer.sku,
          startsAt: term.startsAt ?? term.activatedAt,
          endsAt: term.endsAt,
        },
        channel: "esa",
        channelReference: request.offer.channelReference,
        externalOrderId: `verified-${orderId}`,
        amountMinor: request.offer.subtotalMinor + request.offer.taxMinor,
        currency: "USD",
        activationPolicy: "after-settlement",
      },
    },
    {
      ...envelope,
      id: `${orderId}:approved`,
      type: "order.approved",
      evidence: "private-approval",
    },
    {
      ...envelope,
      id: `${orderId}:settled`,
      type: "order.settled",
      evidence: "private-settlement",
      amountMinor: request.offer.subtotalMinor + request.offer.taxMinor,
      currency: "USD",
    } as CommerceEvent,
    {
      ...envelope,
      id: `${orderId}:fulfilled`,
      type: "order.fulfilled",
      evidence: "private-fulfilment",
    },
    {
      ...envelope,
      id: `${orderId}:activated`,
      type: "license.activated",
      evidence: "private-activation",
    },
  ];
  return { requestId: request.id, events };
}
const grants = async (pool: Pool, learner: string) =>
  (
    await pool.query<{ starts_at: Date; ends_at: Date }>(
      "SELECT starts_at,ends_at FROM amp_grants WHERE learner_id=$1 AND status='active' ORDER BY starts_at",
      [learner],
    )
  ).rows.map((row) => ({
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
  }));
/** An activation moment after everything issued so far. */
const justNow = async () => {
  await new Promise((resolve) => setTimeout(resolve, 5));
  return new Date().toISOString();
};
/** One calendar month later, as the funded term counts it (no clamping is
 * needed on the fixed dates these tests use). */
const monthAfter = (iso: string) => {
  const date = new Date(iso);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString();
};

test(
  "an adult claims a monthly invoice for her own learner without parental consent and gets one month",
  enabled,
  () =>
    fixture(async (pool, invoices) => {
      const invoice = await invoiceFor(invoices, "student@example.com");
      const request = await invoices.claim("amp|student", invoice.id, "own");
      assert.equal(request.offer.termMonths, 1);
      const activatedAt = await justNow();
      await provisionFundingRequest(
        pool,
        settlement(request, {
          activatedAt,
          endsAt: monthAfter(activatedAt),
        }),
        offers,
      );
      assert.deepEqual(await grants(pool, "own"), [
        { startsAt: activatedAt, endsAt: monthAfter(activatedAt) },
      ]);
    }),
);

test(
  "a month paid early starts when the current month ends, and is not rejected as overlapping",
  enabled,
  () =>
    fixture(async (pool, invoices) => {
      const first = await invoices.claim(
        "amp|student",
        (await invoiceFor(invoices, "student@example.com")).id,
        "own",
      );
      const firstAt = await justNow();
      await provisionFundingRequest(
        pool,
        settlement(first, {
          activatedAt: firstAt,
          endsAt: monthAfter(firstAt),
        }),
        offers,
      );
      const second = await invoices.claim(
        "amp|student",
        (await invoiceFor(invoices, "student@example.com")).id,
        "own",
      );
      const secondAt = await justNow();
      // Starting at activation overlaps the month already running.
      await assert.rejects(
        provisionFundingRequest(
          pool,
          settlement(second, {
            activatedAt: secondAt,
            endsAt: monthAfter(secondAt),
          }),
          offers,
        ),
        /overlapping_learning_access/,
      );
      // Starting anywhere but the end of current access is refused.
      const elsewhere = new Date(Date.now() + 5 * 86400000).toISOString();
      await assert.rejects(
        provisionFundingRequest(
          pool,
          settlement(second, {
            activatedAt: secondAt,
            startsAt: elsewhere,
            endsAt: monthAfter(elsewhere),
          }),
          offers,
        ),
        /funded_term_start_unsupported/,
      );
      // A term that doesn't match the invoice's month is refused.
      await assert.rejects(
        provisionFundingRequest(
          pool,
          settlement(second, {
            activatedAt: secondAt,
            startsAt: monthAfter(firstAt),
            endsAt: monthAfter(monthAfter(monthAfter(firstAt))),
          }),
          offers,
        ),
        /funded_activation_term_required/,
      );
      await provisionFundingRequest(
        pool,
        settlement(second, {
          activatedAt: secondAt,
          startsAt: monthAfter(firstAt),
          endsAt: monthAfter(monthAfter(firstAt)),
        }),
        offers,
      );
      assert.deepEqual(await grants(pool, "own"), [
        { startsAt: firstAt, endsAt: monthAfter(firstAt) },
        {
          startsAt: monthAfter(firstAt),
          endsAt: monthAfter(monthAfter(firstAt)),
        },
      ]);
    }),
);

test(
  "the ClassWallet import grants a settled monthly invoice and starts an early month at the current end",
  enabled,
  () =>
    fixture(async (pool, invoices) => {
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
            programId: monthly.programId,
            channelReference: monthly.channelReference,
          },
        ],
      };
      const pay = async () => {
        const invoice = await invoiceFor(invoices, "student@example.com");
        await invoices.claim("amp|student", invoice.id, "own");
        // Paid after the invoice was issued.
        await new Promise((resolve) => setTimeout(resolve, 5));
        const at = new Date().toISOString();
        await new Promise((resolve) => setTimeout(resolve, 5));
        await stageClassWalletPayment(
          pool,
          {
            "Order ID": randomUUID(),
            "Transaction ID": randomUUID(),
            "Invoice/Quote": invoice.id,
            Organization: "Fixture",
            State: "XX",
            "Distribution Name": "Fixture",
            "Payment Amount": "59.00",
            Total: "59.00",
            Fee: "0.00",
            Status: "Settled",
            "Payment Approval Date": at,
            "Last Update": at,
          },
          config,
          "b".repeat(64),
          true,
        );
        return reconcileClassWalletPayments(pool, offers);
      };
      assert.deepEqual(await pay(), {
        provisioned: 1,
        deferred: 0,
        stopped: 0,
      });
      const [first] = await grants(pool, "own");
      assert.equal(first!.endsAt, monthAfter(first!.startsAt));
      assert.deepEqual(await pay(), {
        provisioned: 1,
        deferred: 0,
        stopped: 0,
      });
      assert.deepEqual(await grants(pool, "own"), [
        first,
        { startsAt: first!.endsAt, endsAt: monthAfter(first!.endsAt) },
      ]);
    }),
);

test(
  "a child still needs the parent's verified consent to claim or be provisioned",
  enabled,
  () =>
    fixture(async (pool, invoices) => {
      const invoice = await invoiceFor(invoices, "parent@example.com");
      await assert.rejects(
        invoices.claim("amp|parent", invoice.id, "child"),
        /verified_consent_required/,
      );
      // The same parent's own adult learner needs none.
      const own = await invoices.claim("amp|parent", invoice.id, "parent-own");
      assert.equal(own.learnerId, "parent-own");
      // With consent the child's claim goes through; once withdrawn,
      // provisioning stops.
      await pool.query(
        "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES('amp|parent','fixture','verified','private')",
      );
      const childInvoice = await invoiceFor(invoices, "parent@example.com");
      const request = await invoices.claim(
        "amp|parent",
        childInvoice.id,
        "child",
      );
      await pool.query(
        "UPDATE amp_parent_consents SET withdrawn_at=now() WHERE account_id='amp|parent'",
      );
      const activatedAt = await justNow();
      await assert.rejects(
        provisionFundingRequest(
          pool,
          settlement(request, {
            activatedAt,
            endsAt: monthAfter(activatedAt),
          }),
          offers,
        ),
        /verified_consent_required/,
      );
      assert.deepEqual(await grants(pool, "child"), []);
    }),
);

test(
  "a practice profile is never treated as the adult's own learner",
  enabled,
  () =>
    fixture(async (pool, invoices) => {
      await pool.query(
        "INSERT INTO amp_learners(id,account_id,name,adult,simulation) VALUES('profile','amp|student','Grade 5',true,true)",
      );
      const invoice = await invoiceFor(invoices, "student@example.com");
      await assert.rejects(
        invoices.claim("amp|student", invoice.id, "profile"),
        /verified_consent_required|learner_not_found/,
      );
    }),
);

test(
  "an adult activates a gift for her own learner without parental consent; a child's or a family gift still needs it",
  enabled,
  () =>
    fixture(async (pool) => {
      const gifts = new AccessGiftRepository(pool);
      const issue = (email: string, covers: "learner" | "family" = "learner") =>
        gifts.issue({
          email,
          months: 1,
          reference: randomUUID(),
          ...(covers === "family" ? { covers } : {}),
        });
      const giftId = async (email: string) =>
        (
          await pool.query(
            "SELECT id FROM amp_access_gifts WHERE recipient_email=$1 AND activated_at IS NULL ORDER BY issued_at DESC LIMIT 1",
            [email],
          )
        ).rows[0].id as string;
      await issue("student@example.com");
      const own = await gifts.activate(
        "amp|student",
        await giftId("student@example.com"),
        "own",
      );
      assert.equal(own?.learnerId, "own");
      assert.equal((await grants(pool, "own")).length, 1);

      await issue("parent@example.com");
      await assert.rejects(
        gifts.activate(
          "amp|parent",
          await giftId("parent@example.com"),
          "child",
        ),
        /consent_required/,
      );
      assert.deepEqual(await grants(pool, "child"), []);

      await pool.query(
        "UPDATE amp_access_gifts SET revoked_at=now() WHERE recipient_email='parent@example.com'",
      );
      await issue("parent@example.com", "family");
      await assert.rejects(
        gifts.activate(
          "amp|parent",
          await giftId("parent@example.com"),
          "parent-own",
        ),
        /consent_required/,
      );
      assert.deepEqual(await grants(pool, "child"), []);
    }),
);
