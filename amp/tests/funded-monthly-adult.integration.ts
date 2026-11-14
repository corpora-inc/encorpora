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
import {
  fundedTermStart,
  provisionFundingRequest,
} from "../src/funding-purchase/provision.js";
import { deliverFundedActivationMail } from "../src/funding-purchase/activation-mail.js";
import { installConsentPolicy } from "../src/parent-consent/policy.js";
import type {
  ConsentMail,
  ConsentTransport,
} from "../src/parent-consent/contracts.js";
import { consentFixture } from "./parent-consent.fixture.js";
import {
  reconcileClassWalletPayments,
  stageClassWalletPayment,
} from "../src/funding-purchase/classwallet-staging.js";
import type { ClassWalletConfig } from "../src/funding-purchase/classwallet.js";
import { AccessGiftRepository } from "../src/access-grants/repository.js";
import {
  accessGrantsFor,
  refreshAdultAccess,
} from "../src/account/adult-access.js";
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

const notificationPolicy = {
  ...consentFixture,
  review: { ...consentFixture.review, paymentNotificationsReviewed: true },
  notice: {
    ...consentFixture.notice,
    processors: [
      ...consentFixture.notice.processors,
      {
        name: "Resend (Plus Five Five, Inc.)",
        service: "Transactional email",
        data: "Account email",
        purpose: "Payment notifications",
        retention: "Fixture retention",
      },
    ],
  },
};
const notificationTransport = (
  send: ConsentTransport["send"],
): ConsentTransport => ({
  binding: {
    provider: "resend",
    sender: "sender@example.test",
    credentialFingerprint: "fixture",
  },
  send,
});

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
/** Calendar-month expectation, including fixtures created at month end. */
const monthAfter = (iso: string) => {
  const date = new Date(iso);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 1);
  const lastDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
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

/** A paid term following existing access; no mail is owed for the fixture grant. */
async function scheduledPurchase(
  pool: Pool,
  invoices: FundingInvoiceRepository,
  offer = monthly,
) {
  await installConsentPolicy(pool, notificationPolicy);
  await pool.query(
    "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES('amp|parent','fixture','verified','private')",
  );
  const request = await invoices.claim(
    "amp|parent",
    (await invoiceFor(invoices, "parent@example.com", offer)).id,
    "child",
  );
  // Near midnight UTC, so host-local formatting would give the wrong date.
  const start = new Date(Date.now() + 86400000);
  start.setUTCHours(0, 15, 0, 0);
  const startsAt = start.toISOString();
  const end = new Date(startsAt);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  if (end.getUTCMonth() !== start.getUTCMonth()) end.setUTCDate(0);
  const endsAt =
    offer.termMonths === 1 ? monthAfter(startsAt) : end.toISOString();
  await pool.query(
    "INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at) VALUES('current','child','pilot','current','active',now()-interval '1 day',$1)",
    [startsAt],
  );
  const input = settlement(request, {
    activatedAt: await justNow(),
    startsAt,
    endsAt,
  });
  await provisionFundingRequest(pool, input, offers);
  return { request, input, startsAt, endsAt };
}

function assertScheduledMail(
  mail: ConsentMail,
  invoice: string,
  startsAt: string,
  endsAt: string,
) {
  assert.equal(mail.subject, "Your next month of AMP Math is confirmed");
  assert.equal(mail.idempotencyKey, `amp-funded-activation:${invoice}`);
  assert.equal(
    mail.text,
    [
      `Payment for invoice ${invoice} was received.`,
      `Your learner's next month runs from ${startsAt.slice(0, 10)} to ${endsAt.slice(0, 10)} (UTC).`,
      "Open AMP: https://example.com/",
    ].join("\n\n"),
  );
}

test(
  "a scheduled month queues one confirmation with grant dates and provisioning replay never sends another",
  enabled,
  () =>
    fixture(async (pool, invoices) => {
      const { request, input, startsAt, endsAt } = await scheduledPurchase(
        pool,
        invoices,
      );
      await Promise.all([
        provisionFundingRequest(pool, input, offers),
        provisionFundingRequest(pool, input, offers),
      ]);
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int n FROM amp_funded_activation_outbox",
          )
        ).rows[0].n,
        1,
      );
      const mails: ConsentMail[] = [];
      const transport = notificationTransport(async (mail) => {
        mails.push(mail);
        return { kind: "accepted", receipt: "fixture-receipt" };
      });
      await Promise.all(
        Array.from({ length: 4 }, () =>
          deliverFundedActivationMail(pool, transport, notificationPolicy),
        ),
      );
      assert.equal(mails.length, 1);
      assert.equal(mails[0]!.recipient, "parent@example.com");
      assertScheduledMail(mails[0]!, request.id, startsAt, endsAt);
      await provisionFundingRequest(pool, input, offers);
      assert.equal(
        await deliverFundedActivationMail(pool, transport, notificationPolicy),
        false,
      );
      assert.equal(mails.length, 1);
      assert.ok(
        (
          await pool.query(
            "SELECT accepted_at FROM amp_funded_activation_outbox",
          )
        ).rows[0].accepted_at,
      );
    }),
);

test(
  "a scheduled yearly purchase confirms its own term without calling it a month",
  enabled,
  () =>
    fixture(async (pool, invoices) => {
      const { request, startsAt, endsAt } = await scheduledPurchase(
        pool,
        invoices,
        yearly,
      );
      const mails: ConsentMail[] = [];
      await deliverFundedActivationMail(
        pool,
        notificationTransport(async (mail) => {
          mails.push(mail);
          return { kind: "accepted", receipt: "fixture-receipt" };
        }),
        notificationPolicy,
      );
      assert.equal(mails.length, 1);
      assert.equal(
        mails[0]!.subject,
        "Your next year of AMP Math is confirmed",
      );
      assert.equal(
        mails[0]!.text,
        [
          `Payment for invoice ${request.id} was received.`,
          `Your learner's next year runs from ${startsAt.slice(0, 10)} to ${endsAt.slice(0, 10)} (UTC).`,
          "Open AMP: https://example.com/",
        ].join("\n\n"),
      );
    }),
);

for (const [name, reason, change] of [
  [
    "revoked grant",
    "access-inactive",
    "UPDATE amp_commerce_orders SET grant_state=jsonb_set(grant_state,'{status}','\"revoked\"')",
  ],
  [
    "deleted learner",
    "access-inactive",
    "UPDATE amp_learners SET deleted_at=now() WHERE id='child'",
  ],
  [
    "withdrawn consent",
    "access-inactive",
    "UPDATE amp_parent_consents SET withdrawn_at=now()",
  ],
  [
    "unverified account email",
    "verified-recipient-unavailable",
    'UPDATE amp_auth_users SET "emailVerified"=false',
  ],
] as const) {
  test(`a scheduled confirmation is stopped for a ${name}`, enabled, () =>
    fixture(async (pool, invoices) => {
      await scheduledPurchase(pool, invoices);
      await pool.query(change);
      let sends = 0;
      await deliverFundedActivationMail(
        pool,
        notificationTransport(async () => {
          sends++;
          return { kind: "accepted", receipt: "fixture-receipt" };
        }),
        notificationPolicy,
      );
      assert.equal(sends, 0);
      assert.equal(
        (
          await pool.query(
            "SELECT stopped_reason FROM amp_funded_activation_outbox",
          )
        ).rows[0].stopped_reason,
        reason,
      );
    }),
  );
}

test(
  "a scheduled confirmation retries the identical message after its start date and stops at the retry deadline",
  enabled,
  (t) =>
    fixture(async (pool, invoices) => {
      const { request, startsAt, endsAt } = await scheduledPurchase(
        pool,
        invoices,
      );
      const mails: ConsentMail[] = [];
      const transport = notificationTransport(async (mail) => {
        mails.push(mail);
        return { kind: "unknown" };
      });
      await deliverFundedActivationMail(pool, transport, notificationPolicy);
      assert.equal(mails.length, 1);
      assertScheduledMail(mails[0]!, request.id, startsAt, endsAt);
      // Move the application clock across the term boundary, inside the same retry window.
      t.mock.timers.enable({
        apis: ["Date"],
        now: Date.parse(startsAt) + 1000,
      });
      await pool.query(
        "UPDATE amp_funded_activation_outbox SET available_at=now()",
      );
      await deliverFundedActivationMail(pool, transport, notificationPolicy);
      assert.equal(mails.length, 2);
      assert.deepEqual(mails[1], mails[0]);
      await pool.query(
        "UPDATE amp_funded_activation_outbox SET available_at=now(),first_dispatch_at=now()-interval '24 hours'",
      );
      await deliverFundedActivationMail(pool, transport, notificationPolicy);
      assert.equal(mails.length, 2);
      assert.equal(
        (
          await pool.query(
            "SELECT stopped_reason FROM amp_funded_activation_outbox",
          )
        ).rows[0].stopped_reason,
        "retry-window-ended",
      );
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
      await installConsentPolicy(pool, notificationPolicy);
      const mails: ConsentMail[] = [];
      const transport = notificationTransport(async (mail) => {
        mails.push(mail);
        return { kind: "accepted", receipt: randomUUID() };
      });
      const pay = async () => {
        const invoice = await invoiceFor(invoices, "student@example.com");
        await invoices.claim("amp|student", invoice.id, "own");
        // Paid after the invoice was issued.
        await new Promise((resolve) => setTimeout(resolve, 5));
        const at = new Date().toISOString();
        await new Promise((resolve) => setTimeout(resolve, 5));
        const row = {
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
        };
        await stageClassWalletPayment(pool, row, config, "b".repeat(64), true);
        assert.deepEqual(await reconcileClassWalletPayments(pool, offers), {
          provisioned: 1,
          deferred: 0,
          stopped: 0,
        });
        await deliverFundedActivationMail(pool, transport, notificationPolicy);
        const sent = mails.length;
        assert.equal(
          (
            await stageClassWalletPayment(
              pool,
              row,
              config,
              "c".repeat(64),
              true,
            )
          ).replay,
          true,
        );
        assert.deepEqual(await reconcileClassWalletPayments(pool, offers), {
          provisioned: 0,
          deferred: 0,
          stopped: 0,
        });
        assert.equal(
          await deliverFundedActivationMail(
            pool,
            transport,
            notificationPolicy,
          ),
          false,
        );
        assert.equal(mails.length, sent);
        return invoice.id;
      };
      const firstInvoice = await pay();
      assert.equal(mails.length, 1);
      assert.equal(mails[0]!.subject, "Your AMP Math access is ready");
      assert.equal(
        mails[0]!.idempotencyKey,
        `amp-funded-activation:${firstInvoice}`,
      );
      const [first] = await grants(pool, "own");
      assert.equal(first!.endsAt, monthAfter(first!.startsAt));
      const secondInvoice = await pay();
      assert.equal(mails.length, 2);
      assert.equal(mails[1]!.recipient, "student@example.com");
      assertScheduledMail(
        mails[1]!,
        secondInvoice,
        first!.endsAt,
        monthAfter(first!.endsAt),
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int n FROM amp_funded_activation_outbox",
          )
        ).rows[0].n,
        2,
      );
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

// Capture the scheduling decision while coverage is live; provision the exact
// payload after its source ends, without an intervening account GET.
test("scheduled funded terms survive ended adult coverage", enabled, () =>
  fixture(async (pool) => {
    for (const mode of [
      "missing",
      "materialized",
      "revoked",
      "shortened",
      "extended",
      "legacy-checkout",
      "legacy-payment",
    ] as const) {
      const learner = `scheduled-${mode}`;
      const account = `amp|scheduled-${mode}`;
      await pool.query(
        "INSERT INTO amp_learners(id,account_id,name,adult) VALUES($1,$2,'Adult',true),($3,$2,'Child',false)",
        [learner, account, `${learner}-child`],
      );
      const repo = new FundingPurchaseRepository(pool, offers);
      const request = await repo.create(account, {
        offerId: monthly.id,
        offerRevision: monthly.revision,
        learnerId: learner,
        idempotencyKey: randomUUID(),
        studentBillingName: "Fixture Student",
      });
      const sourceEnd = new Date(
        Date.now() +
          (mode === "revoked" || mode === "shortened" ? 60_000 : 1500),
      ).toISOString();
      await pool.query(
        "INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at) VALUES($1,$2,'esa',$1,'active',now()-interval '1 day',$3)",
        [`${learner}-source`, `${learner}-child`, sourceEnd],
      );
      if (mode === "materialized")
        await repo.transaction(
          account,
          (db) => refreshAdultAccess(db, account, learner),
          true,
        );
      const activatedAt = await justNow();
      const startsAt = await repo.transaction(
        account,
        (db) =>
          fundedTermStart(
            db,
            learner,
            activatedAt,
            mode === "missing" || mode === "materialized"
              ? undefined
              : request.id,
          ),
        true,
      );
      assert.equal(startsAt, sourceEnd);
      const input = settlement(request, {
        activatedAt,
        startsAt,
        endsAt: monthAfter(startsAt),
      });
      // Older saved provider payloads predate the scheduling-evidence column.
      if (mode === "legacy-checkout" || mode === "legacy-payment") {
        await pool.query(
          "UPDATE amp_funding_requests SET scheduled_term=NULL WHERE id=$1",
          [request.id],
        );
        if (mode === "legacy-checkout")
          await pool.query(
            "INSERT INTO amp_classwallet_checkouts(request_id,vendor_fingerprint,callback_status,provisioning_payload) VALUES($1,'fixture','complete',$2)",
            [request.id, JSON.stringify(input)],
          );
        else
          await pool.query(
            "INSERT INTO amp_classwallet_payments(order_id,invoice_id,report_sha256,payment_row,verified_config,conversion_payload) VALUES($1,$2,$3,'{}','{}',$4)",
            [
              input.events[0]!.orderId,
              request.id,
              "0".repeat(64),
              JSON.stringify(input),
            ],
          );
      }
      const before = (
        await pool.query(
          "SELECT * FROM amp_grants WHERE learner_id=ANY($1::text[]) ORDER BY id",
          [[learner, `${learner}-child`]],
        )
      ).rows;
      if (mode === "revoked")
        await pool.query("UPDATE amp_grants SET status='revoked' WHERE id=$1", [
          `${learner}-source`,
        ]);
      else if (mode === "shortened")
        await pool.query(
          "UPDATE amp_grants SET ends_at=now()-interval '1 millisecond' WHERE id=$1",
          [`${learner}-source`],
        );
      else if (mode === "extended")
        await pool.query(
          "UPDATE amp_grants SET ends_at=ends_at+interval '1 day' WHERE id=$1",
          [`${learner}-source`],
        );
      else {
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            Math.max(0, Date.parse(sourceEnd) - Date.now() + 50),
          ),
        );
        assert.deepEqual(
          (
            await pool.query(
              "SELECT * FROM amp_grants WHERE learner_id=ANY($1::text[]) ORDER BY id",
              [[learner, `${learner}-child`]],
            )
          ).rows,
          before,
        );
      }
      if (mode === "extended") {
        await assert.rejects(
          provisionFundingRequest(pool, input, offers),
          /overlapping_learning_access/,
        );
        continue;
      }
      const current = await repo.transaction(account, (db) =>
        accessGrantsFor(db, [learner]),
      );
      assert.equal(
        current.grants.some(
          (g) => g.status === "active" && g.ends_at > current.now,
        ),
        false,
      );
      // The receipt supports only the captured date, not an arbitrary delay.
      const wrongStart = new Date(Date.parse(startsAt) + 1000).toISOString();
      await assert.rejects(
        provisionFundingRequest(
          pool,
          settlement(request, {
            activatedAt,
            startsAt: wrongStart,
            endsAt: monthAfter(wrongStart),
          }),
          offers,
        ),
        /funded_term_start_unsupported/,
      );
      await provisionFundingRequest(pool, input, offers);
      await provisionFundingRequest(pool, input, offers);
      const paid = (
        await pool.query(
          "SELECT starts_at,ends_at FROM amp_grants WHERE learner_id=$1 AND channel='esa'",
          [learner],
        )
      ).rows;
      assert.deepEqual(
        paid.map((g) => ({
          startsAt: g.starts_at.toISOString(),
          endsAt: g.ends_at.toISOString(),
        })),
        [{ startsAt, endsAt: monthAfter(startsAt) }],
      );
    }
  }),
);
