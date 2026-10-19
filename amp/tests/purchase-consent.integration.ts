import { syntheticDocumentProfile } from "./payment-evidence-fixtures.js";
import { paymentHistory } from "../src/billing/evidence/repository.js";
import { purgeConsentRecords } from "../src/parent-consent/lifecycle.js";
import { ConsentRepository } from "../src/parent-consent/repository.js";
import { ConsentSecrets } from "../src/parent-consent/crypto.js";
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import Fastify from "fastify";
import { migrate } from "../scripts/migrate.js";
import { config as base, payment as basePayment } from "./stripe-fixtures.js";
import { consentFixture } from "./parent-consent.fixture.js";
import { installConsentPolicy } from "../src/parent-consent/policy.js";
import { noticeDigest } from "../src/parent-consent/crypto.js";
import { learningConsentActive } from "../src/server/account-access.js";
import { FamilyRepository } from "../src/family/repository.js";
import { StripeRepository } from "../src/billing/stripe/repository.js";
import { StripeGateway } from "../src/billing/stripe/gateway.js";
import { StripeBilling } from "../src/billing/stripe/service.js";
import { claimEnrollment } from "../src/billing/stripe/enrollment.js";
import { registerStripeRoutes } from "../src/billing/stripe/routes.js";
import { annualOffer } from "../src/billing/stripe/purchase.js";
import { accountSummary } from "../src/account/repository.js";
import { enrollmentViewSchema } from "../src/billing/stripe/enrollment-contracts.js";
import type { AnnualPayment } from "../src/billing/stripe/model.js";
import { recordEventBatch } from "../src/analytics/repository.js";

const enabled = { skip: !process.env.AMP_TEST_DATABASE_URL };
async function fixture(
  run: (f: Awaited<ReturnType<typeof setup>>) => Promise<void>,
) {
  const url = process.env.AMP_TEST_DATABASE_URL!;
  const schema = `purchase_consent_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: url, max: 1 });
  const scoped = new URL(url);
  scoped.searchParams.set("options", `-c search_path=${schema}`);
  const pool = new Pool({ connectionString: scoped.href, max: 8 });
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    await run(await setup(pool));
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
}
async function setup(pool: Pool) {
  const policy = {
    ...consentFixture,
    review: { ...consentFixture.review, paymentNotificationsReviewed: true },
    notice: { ...consentFixture.notice, version: base.consentPolicyVersion },
  };
  await installConsentPolicy(pool, policy);
  const config = {
    ...base,
    documentProfile: syntheticDocumentProfile,
    monthlyDocumentProfile: {
      ...syntheticDocumentProfile,
      priceId: "price_monthly",
      unitAmountMinor: 1200,
    },
    monthlyPriceId: "price_monthly",
    monthlyAmountMinor: 1200,
  };
  const repository = new StripeRepository(pool, config, policy);
  const gateway = new StripeGateway(config);
  const billing = new StripeBilling(repository, gateway);
  const family = new FamilyRepository(pool);
  const payments = new Map<string, AnnualPayment>();
  const sessions = new Map<
    string,
    {
      status: "open" | "complete" | "expired";
      subscriptionId?: string;
      url: string | null;
    }
  >();
  let created = 0;
  const cancellations = new Set<string>();
  gateway.verifyMerchant =
    gateway.verifyCatalog =
    gateway.verifyPortal =
      async () => {};
  gateway.createCustomer = async (id) => `cus_${id}`;
  gateway.createCheckout = async (id) => {
    created++;
    sessions.set(`cs_${id}`, {
      status: "open",
      url: `https://checkout.stripe.test/${id}`,
    });
    return { id: `cs_${id}`, url: `https://checkout.stripe.test/${id}` };
  };
  gateway.checkoutStatus = async (id) => sessions.get(id)!;
  gateway.annualPayment = async (id) => {
    const p = payments.get(id);
    if (!p) throw new Error("unsettled");
    return {
      ...p,
      financial: {
        kind: "verified",
        observation: {
          invoiceReason: p.invoiceReason as
            "subscription_create" | "subscription_cycle",
          preTaxMinor: p.subtotal,
          paidMinor: p.paid,
          currency: "usd",
          tax: [],
          refunds: p.fullRefundAt
            ? [
                {
                  id: "re_fixture",
                  chargeId: p.chargeId,
                  amountMinor: p.paid,
                  currency: "usd",
                  created: p.fullRefundAt,
                  status: "succeeded",
                },
              ]
            : [],
          paymentMethod: p.paymentMethod,
        },
      },
      refunded: p.fullRefundAt !== undefined,
      partialRefund: false,
    };
  };
  gateway.portal = async () => "https://billing.stripe.test/manage";
  gateway.client.subscriptions.retrieve = async (id) => {
    const payment = [...payments.values()].find(
      (p) => p.subscriptionId === id,
    )!;
    return {
      id,
      livemode: false,
      customer: payment.customerId,
      metadata: { amp_checkout_id: payment.checkoutId },
      status: cancellations.has(id) ? "canceled" : "active",
    } as never;
  };
  gateway.client.subscriptions.cancel = async (id, options) => {
    assert.deepEqual(options, { invoice_now: false, prorate: false });
    cancellations.add(id);
    return { id, status: "canceled" } as never;
  };
  const acknowledge = {
    noticeDigest: noticeDigest(policy),
    parentAttestation: true as const,
  };
  async function checkout(
    account = "parent",
    interval: "year" | "month" = "year",
  ) {
    await billing.checkout(account, null, randomUUID(), interval, acknowledge);
    return (
      await pool.query(
        "SELECT * FROM amp_stripe_checkouts WHERE account_id=$1 ORDER BY created_at DESC LIMIT 1",
        [account],
      )
    ).rows[0];
  }
  function settle(
    checkout: { id: string; customer_id: string; billing_interval: string },
    overrides: Partial<AnnualPayment> = {},
  ) {
    const now = Math.floor(Date.now() / 1000);
    const monthly = checkout.billing_interval === "month";
    const payment = {
      ...basePayment,
      invoiceId: `in_${checkout.id}`,
      chargeId: `ch_${checkout.id}`,
      subscriptionId: `sub_${checkout.id}`,
      checkoutId: checkout.id,
      customerId: checkout.customer_id,
      periodStart: now,
      paidAt: now,
      periodEnd: now + (monthly ? 30 : 365) * 86400,
      paymentMethod: "card",
      invoiceReason: "subscription_create",
      ...(monthly
        ? { priceId: config.monthlyPriceId, paid: 1200, subtotal: 1200 }
        : {}),
      ...overrides,
    };
    payments.set(payment.invoiceId, payment);
    sessions.set(`cs_${checkout.id}`, {
      status: "complete",
      subscriptionId: payment.subscriptionId,
      url: null,
    });
    return payment;
  }
  async function deliver(payment: AnnualPayment, type = "invoice.paid") {
    await repository.enqueue({
      eventId: randomUUID(),
      type,
      objectId: payment.invoiceId,
      created: payment.paidAt,
      hash: "fixture",
    });
    return billing.runBatch();
  }
  async function active(account = "parent") {
    return repository.transaction(account, (client) =>
      learningConsentActive(client, account),
    );
  }
  async function learner(id = "child", account = "parent") {
    await pool.query(
      "INSERT INTO amp_learners(id,account_id,name) VALUES($1,$2,'Fixture')",
      [id, account],
    );
  }
  return {
    pool,
    policy,
    config,
    repository,
    gateway,
    billing,
    family,
    payments,
    sessions,
    acknowledge,
    checkout,
    settle,
    deliver,
    active,
    learner,
    cancellations,
    created: () => created,
  };
}

test(
  "adult-only purchase: concurrent checkout, no child before settlement, immediate consent, race-safe assignment, replay and monthly contracts",
  enabled,
  async () =>
    fixture(async (f) => {
      await Promise.all(Array.from({ length: 4 }, () => f.checkout()));
      assert.equal(f.created(), 1);
      assert.equal(
        (await f.pool.query("SELECT count(*)::int n FROM amp_learners")).rows[0]
          .n,
        0,
      );
      assert.equal(await f.active(), false);
      const row = (await f.pool.query("SELECT * FROM amp_stripe_checkouts"))
        .rows[0];
      assert.equal(row.learner_id, null);
      assert.deepEqual(await f.deliver(f.settle(row)), {
        processed: 1,
        failed: 0,
      });
      assert.equal(await f.active(), true);
      assert.equal(
        (await f.pool.query("SELECT count(*)::int n FROM amp_grants")).rows[0]
          .n,
        0,
      );
      assert.equal(
        (
          await f.pool.query(
            "SELECT verification_method FROM amp_parent_consents",
          )
        ).rows[0].verification_method,
        "monetary-transaction",
      );
      await f.learner("a");
      await f.learner("b");
      await f.learner("foreign", "other");
      await assert.rejects(
        claimEnrollment(f.billing, "other", row.id, "foreign"),
        /purchase_not_found/,
      );
      await assert.rejects(
        claimEnrollment(f.billing, "parent", row.id, "foreign"),
        /learner_not_found/,
      );
      const results = await Promise.allSettled([
        claimEnrollment(f.billing, "parent", row.id, "a"),
        claimEnrollment(f.billing, "parent", row.id, "b"),
      ]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      const assigned = (
        await f.pool.query(
          "SELECT assigned_learner_id FROM amp_stripe_checkouts",
        )
      ).rows[0].assigned_learner_id;
      await claimEnrollment(f.billing, "parent", row.id, assigned);
      assert.equal(
        (await f.pool.query("SELECT count(*)::int n FROM amp_grants")).rows[0]
          .n,
        1,
      );
      const original = f.payments.get(`in_${row.id}`)!;
      assert.deepEqual(await f.deliver(original), { processed: 1, failed: 0 });
      assert.equal(
        (await f.pool.query("SELECT count(*)::int n FROM amp_grants")).rows[0]
          .n,
        1,
      );
      const monthly = await f.checkout("monthly", "month");
      const monthlyPayment = f.settle(monthly);
      assert.deepEqual(await f.deliver(monthlyPayment), {
        processed: 1,
        failed: 0,
      });
      assert.equal(await f.active("monthly"), true);
      await f.learner("monthly-child", "monthly");
      await claimEnrollment(f.billing, "monthly", monthly.id, "monthly-child");
      assert.equal(
        (
          await f.pool.query(
            "SELECT extract(epoch FROM ends_at-starts_at)::int duration FROM amp_grants WHERE learner_id='monthly-child'",
          )
        ).rows[0].duration,
        30 * 86400,
      );
    }),
);

test(
  "failed payment and unsupported payment method never consent; entitlement failure rolls consent back",
  enabled,
  async () =>
    fixture(async (f) => {
      const row = await f.checkout();
      await f.repository.enqueue({
        eventId: randomUUID(),
        type: "invoice.paid",
        objectId: "unpaid",
        created: 1,
        hash: "fixture",
      });
      assert.deepEqual(await f.billing.runBatch(), { processed: 0, failed: 1 });
      assert.equal(await f.active(), false);
      let p = f.settle(row, { paymentMethod: "us_bank_account" });
      assert.deepEqual(await f.deliver(p), { processed: 0, failed: 1 });
      assert.equal(await f.active(), false);
      assert.equal(f.cancellations.has(p.subscriptionId), true);
      p = f.settle(await f.checkout("atomic"));
      await f.pool.query(
        "ALTER TABLE amp_account_entitlements ADD CONSTRAINT fixture_reject CHECK (invoice_id='never')",
      );
      assert.deepEqual(await f.deliver(p), { processed: 0, failed: 1 });
      assert.equal(await f.active(), false);
      assert.equal(
        (await f.pool.query("SELECT consent_at FROM amp_purchase_consents"))
          .rows[0].consent_at,
        null,
      );
      await f.pool.query(
        "ALTER TABLE amp_account_entitlements DROP CONSTRAINT fixture_reject",
      );
      assert.equal(f.cancellations.has(p.subscriptionId), false);
      assert.deepEqual(await f.deliver(p), { processed: 1, failed: 0 });
      assert.equal(await f.active("atomic"), true);
    }),
);

test(
  "withdrawal, deletion and policy replacement reject late settlement; renewal/replay cannot restore consent",
  enabled,
  async () =>
    fixture(async (f) => {
      for (const account of ["withdrawn", "deleted", "changed"]) {
        const row = await f.checkout(account);
        const p = f.settle(row);
        if (account === "withdrawn") await f.family.withdraw(account);
        if (account === "deleted") await f.family.deleteLearning(account);
        if (account === "changed")
          await installConsentPolicy(f.pool, {
            ...f.policy,
            notice: { ...f.policy.notice, version: "replacement" },
          });
        assert.deepEqual(await f.deliver(p), { processed: 0, failed: 1 });
        assert.equal(await f.active(account), false);
      }
      await installConsentPolicy(f.pool, f.policy);
      const row = await f.checkout();
      const p = f.settle(row);
      assert.deepEqual(await f.deliver(p), { processed: 1, failed: 0 });
      await f.family.withdraw("parent");
      assert.deepEqual(await f.deliver(p), { processed: 1, failed: 0 });
      assert.equal(await f.active(), false);
      const renewal = {
        ...p,
        invoiceId: "in_renewal",
        chargeId: "ch_renewal",
        invoiceReason: "subscription_cycle",
        periodStart: p.periodEnd,
        paidAt: p.periodEnd,
        periodEnd: p.periodEnd + 365 * 86400,
      };
      f.payments.set(renewal.invoiceId, renewal);
      assert.deepEqual(await f.deliver(renewal), { processed: 1, failed: 0 });
      assert.equal(await f.active(), false);
      await f.learner();
      await assert.rejects(
        claimEnrollment(f.billing, "parent", row.id, "child"),
        /parent_consent_required/,
      );
      assert.equal(
        (await f.billing.portal("parent")).url,
        "https://billing.stripe.test/manage",
      );
    }),
);

test(
  "refund before claim prevents assignment; refunded initial payment cannot establish consent",
  enabled,
  async () =>
    fixture(async (f) => {
      const row = await f.checkout();
      const p = f.settle(row);
      assert.deepEqual(await f.deliver(p), { processed: 1, failed: 0 });
      await f.learner();
      p.fullRefundAt = p.paidAt;
      await assert.rejects(
        claimEnrollment(f.billing, "parent", row.id, "child"),
        /paid_license_requires_reconciliation/,
      );
      assert.deepEqual(await f.deliver(p), { processed: 1, failed: 0 });
      assert.equal(await f.active(), true);
      assert.equal(
        (await f.pool.query("SELECT status FROM amp_account_entitlements"))
          .rows[0].status,
        "refunded",
      );
      assert.equal(
        (await f.pool.query("SELECT count(*)::int n FROM amp_grants")).rows[0]
          .n,
        0,
      );
      const another = await f.checkout("refunded");
      const refunded = f.settle(another);
      refunded.fullRefundAt = refunded.paidAt;
      assert.deepEqual(await f.deliver(refunded), { processed: 0, failed: 1 });
      assert.equal(await f.active("refunded"), false);
    }),
);

test(
  "enrollment HTTP requires explicit notice acknowledgement and rejects child input; notice needs no email transport",
  enabled,
  async () =>
    fixture(async (f) => {
      const app = Fastify();
      try {
        await registerStripeRoutes(app, {
          pool: f.pool,
          config: f.config,
          consentPolicy: f.policy,
          gateway: f.gateway,
          authenticate: async () => "parent",
        });
        const view = await app.inject({ url: "/api/v1/billing/enrollment" });
        assert.equal(view.json().available, true);
        // The browser validates this response with the same contract.
        assert.equal(enrollmentViewSchema.parse(view.json()).purchase, null);
        assert.equal(view.json().noticeDigest, f.acknowledge.noticeDigest);
        const body = {
          requestId: randomUUID(),
          offerId: annualOffer(f.config).id,
          interval: "year",
          acknowledgement: f.acknowledge,
        };
        for (const payload of [
          { ...body, childName: "No" },
          {
            ...body,
            acknowledgement: { ...f.acknowledge, parentAttestation: false },
          },
          { ...body, acknowledgement: undefined },
        ]) {
          assert.equal(
            (
              await app.inject({
                method: "POST",
                url: "/api/v1/billing/enrollment/checkout",
                payload,
              })
            ).statusCode,
            400,
          );
        }
        assert.equal(
          (
            await app.inject({
              method: "POST",
              url: "/api/v1/billing/enrollment/checkout",
              payload: body,
            })
          ).statusCode,
          200,
        );
        const open = enrollmentViewSchema.parse(
          (await app.inject({ url: "/api/v1/billing/enrollment" })).json(),
        );
        assert.equal(open.purchase?.phase, "checkout-open");
        assert.match(open.purchase?.url ?? "", /^https:\/\/checkout\.stripe/);
        assert.equal(
          (
            await f.pool.query(
              "SELECT count(*)::int n FROM amp_parent_consents",
            )
          ).rows[0].n,
          0,
        );
      } finally {
        await app.close();
      }
    }),
);

test(
  "receipt ownership remains unassigned after claim, financial collision quarantines consent and assignment",
  enabled,
  async () =>
    fixture(async (f) => {
      const row = await f.checkout();
      const p = f.settle(row);
      assert.deepEqual(await f.deliver(p), { processed: 1, failed: 0 });
      const before = (await paymentHistory(f.pool, "parent"))[0]!;
      assert.equal(before.learnerReference, null);
      assert.equal(before.status, "verified");
      await f.learner();
      await claimEnrollment(f.billing, "parent", row.id, "child");
      assert.deepEqual(
        (await paymentHistory(f.pool, "parent"))[0]!.baseline,
        before.baseline,
      );
      assert.equal(
        (await paymentHistory(f.pool, "parent"))[0]!.learnerReference,
        null,
      );
      const other = await f.checkout("collision");
      const colliding = f.settle(other, { chargeId: p.chargeId });
      assert.deepEqual(await f.deliver(colliding), { processed: 0, failed: 1 });
      assert.equal(await f.active("collision"), false);
      const hold = await f.checkout("hold");
      const hp = f.settle(hold);
      assert.deepEqual(await f.deliver(hp), { processed: 1, failed: 0 });
      await f.learner("held-child", "hold");
      const heldRecord = (await paymentHistory(f.pool, "hold"))[0]!;
      await f.pool.query(
        "INSERT INTO amp_payment_observations(id,record_id,observation,observation_sha256,source_event_id) VALUES($1,$2,$3,'fixture','fixture')",
        [
          randomUUID(),
          heldRecord.id,
          { kind: "review", reason: "financial_baseline_collision" },
        ],
      );
      await assert.rejects(
        claimEnrollment(f.billing, "hold", hold.id, "held-child"),
        /payment_identity_requires_reconciliation/,
      );
    }),
);

test(
  "delayed delivery accepts settlement within acknowledgement window; purged evidence never re-consents and refund still revokes grant",
  enabled,
  async () =>
    fixture(async (f) => {
      const row = await f.checkout();
      // Fixture clock boundary: emulate a checkout acknowledged two days before worker delivery.
      await f.pool.query(
        "ALTER TABLE amp_purchase_consents DISABLE TRIGGER amp_purchase_notice_immutable",
      );
      await f.pool.query(
        "UPDATE amp_purchase_consents SET acknowledged_at=now()-interval '2 days',expires_at=now()-interval '1 day'",
      );
      await f.pool.query(
        "ALTER TABLE amp_purchase_consents ENABLE TRIGGER amp_purchase_notice_immutable",
      );
      const now = Math.floor(Date.now() / 1000);
      const paidAt = now - 36 * 3600;
      const p = f.settle(row, {
        paidAt,
        periodStart: paidAt,
        periodEnd: paidAt + 365 * 86400,
      });
      await purgeConsentRecords(f.pool);
      assert.deepEqual(await f.deliver(p), { processed: 1, failed: 0 });
      await f.learner();
      await claimEnrollment(f.billing, "parent", row.id, "child");
      await f.family.withdraw("parent");
      await f.pool.query(
        "UPDATE amp_purchase_consents SET purge_after=now()-interval '1 second'",
      );
      assert.equal(await purgeConsentRecords(f.pool), 1);
      assert.equal(await f.active(), false);
      assert.deepEqual(await f.deliver(p), { processed: 1, failed: 0 });
      assert.equal(await f.active(), false);
      p.fullRefundAt = now;
      assert.deepEqual(await f.deliver(p), { processed: 1, failed: 0 });
      assert.equal(
        (
          await f.pool.query(
            "SELECT status FROM amp_grants WHERE learner_id='child'",
          )
        ).rows[0].status,
        "revoked",
      );
      assert.equal(
        (await paymentHistory(f.pool, "parent"))[0]!.successfulRefundMinor,
        p.paid,
      );
    }),
);

test(
  "purchase-only reviewed policy cannot enable email-plus",
  enabled,
  async () =>
    fixture(async (f) => {
      const policy = {
        ...f.policy,
        review: { ...f.policy.review, noDisclosureUnder312_2: false },
      };
      await installConsentPolicy(f.pool, policy);
      const email = new ConsentRepository(
        f.pool,
        policy,
        new ConsentSecrets(Buffer.alloc(32, 1)),
        true,
      );
      await assert.rejects(
        email.begin("parent", {
          email: "parent@example.test",
          requestId: randomUUID(),
          noticeDigest: noticeDigest(policy),
          parentAttestation: true,
        }),
        /consent_enrollment_unavailable/,
      );
      const repository = new StripeRepository(f.pool, f.config, policy);
      await new StripeBilling(repository, f.gateway).checkout(
        "parent",
        null,
        randomUUID(),
        "year",
        { noticeDigest: noticeDigest(policy), parentAttestation: true },
      );
    }),
);

test(
  "disputed paid license blocks claim and revokes assigned access without withdrawing consent",
  enabled,
  async () =>
    fixture(async (f) => {
      const row = await f.checkout();
      const p = f.settle(row);
      assert.deepEqual(await f.deliver(p), { processed: 1, failed: 0 });
      await f.learner();
      await claimEnrollment(f.billing, "parent", row.id, "child");
      p.disputed = true;
      assert.deepEqual(await f.deliver(p), { processed: 1, failed: 0 });
      assert.equal(await f.active(), true);
      assert.equal(
        (await f.pool.query("SELECT status FROM amp_grants")).rows[0].status,
        "revoked",
      );
      assert.equal(
        (await f.pool.query("SELECT status FROM amp_account_entitlements"))
          .rows[0].status,
        "held",
      );
    }),
);

test(
  "family management retains subscription access before assignment and after learner deletion",
  enabled,
  async () =>
    fixture(async (f) => {
      const row = await f.checkout();
      const p = f.settle(row);
      assert.deepEqual(await f.deliver(p), { processed: 1, failed: 0 });
      const unassignedDeletion = await f.family.deleteLearning("parent");
      assert.equal(unassignedDeletion.deletedLearners, 0);
      assert.equal(unassignedDeletion.billingManagementRequired, true);
      const other = await f.checkout("assigned");
      const otherPayment = f.settle(other);
      assert.deepEqual(await f.deliver(otherPayment), {
        processed: 1,
        failed: 0,
      });
      await f.learner("assigned-child", "assigned");
      await claimEnrollment(f.billing, "assigned", other.id, "assigned-child");
      assert.equal(
        (await f.family.summary("assigned")).learners[0]!.stripeLinked,
        true,
      );
      const deleted = await f.family.deleteLearning(
        "assigned",
        "assigned-child",
      );
      assert.equal(deleted.billingManagementRequired, true);
      assert.equal(deleted.retainedBillingReferences, 1);
      assert.equal(
        (await paymentHistory(f.pool, "assigned"))[0]!.learnerReference,
        null,
      );
    }),
);

test(
  "provider expiry follows acknowledgement; untouched expiry can restart, ambiguous creation cannot duplicate; policy change is visible immediately",
  enabled,
  async () =>
    fixture(async (f) => {
      const { reserveEnrollment } =
        await import("../src/billing/stripe/enrollment.js");
      const requestId = randomUUID();
      const id = await reserveEnrollment(
        f.repository,
        "parent",
        requestId,
        "year",
        f.acknowledge,
      );
      await f.pool.query(
        "ALTER TABLE amp_purchase_consents DISABLE TRIGGER amp_purchase_notice_immutable",
      );
      await f.pool.query(
        "UPDATE amp_purchase_consents SET expires_at=now()-interval '1 minute' WHERE checkout_id=$1",
        [id],
      );
      await f.pool.query(
        "ALTER TABLE amp_purchase_consents ENABLE TRIGGER amp_purchase_notice_immutable",
      );
      await assert.rejects(
        f.checkout(),
        /checkout_expired_retry_with_new_request/,
      );
      assert.equal(
        (
          await f.pool.query(
            "SELECT closed FROM amp_stripe_checkouts WHERE id=$1",
            [id],
          )
        ).rows[0].closed,
        true,
      );
      const create = f.gateway.createCheckout;
      f.gateway.createCheckout = async (
        checkoutId,
        customer,
        interval,
        enrollment,
        expiresAt,
      ) => {
        const deadline = (
          await f.pool.query(
            "SELECT expires_at FROM amp_purchase_consents WHERE checkout_id=$1",
            [checkoutId],
          )
        ).rows[0].expires_at;
        assert.equal(enrollment, true);
        assert.equal(expiresAt, Math.floor(deadline.getTime() / 1000));
        return create(checkoutId, customer, interval, enrollment, expiresAt);
      };
      await f.checkout();
      assert.equal(f.created(), 1);
      const app = Fastify();
      try {
        await registerStripeRoutes(app, {
          pool: f.pool,
          config: f.config,
          consentPolicy: f.policy,
          gateway: f.gateway,
          authenticate: async () => "parent",
        });
        await installConsentPolicy(f.pool, {
          ...f.policy,
          notice: { ...f.policy.notice, version: "replacement" },
        });
        assert.equal(
          (await app.inject({ url: "/api/v1/billing/enrollment" })).json()
            .purchase.phase,
          "requires-review",
        );
      } finally {
        await app.close();
      }
      await installConsentPolicy(f.pool, f.policy);
      f.gateway.createCheckout = async (...args) => {
        await create(...args); // Provider succeeds, but AMP never receives/returns its URL.
        throw new Error("ambiguous provider timeout");
      };
      await assert.rejects(
        f.checkout("ambiguous"),
        /ambiguous provider timeout/,
      );
      const unbound = (
        await f.pool.query(
          "SELECT id,session_id FROM amp_stripe_checkouts WHERE account_id='ambiguous'",
        )
      ).rows[0];
      assert.equal(unbound.session_id, null);
      assert.ok(
        (
          await f.pool.query(
            "SELECT customer_id FROM amp_stripe_customers WHERE account_id='ambiguous'",
          )
        ).rows[0].customer_id,
      );
      assert.ok(f.sessions.has(`cs_${unbound.id}`));
      await assert.rejects(
        f.checkout("ambiguous", "month"),
        /checkout_plan_conflict/,
      );
      // Move both sides of the fixture clock past the immutable provider deadline.
      await f.pool.query(
        "UPDATE amp_stripe_customers SET created_at=now()-interval '2 days' WHERE account_id='ambiguous'",
      );
      await f.pool.query(
        "UPDATE amp_stripe_checkouts SET created_at=now()-interval '2 days' WHERE account_id='ambiguous'",
      );
      f.sessions.set(`cs_${unbound.id}`, { status: "expired", url: null });
      await f.pool.query(
        "ALTER TABLE amp_purchase_consents DISABLE TRIGGER amp_purchase_notice_immutable",
      );
      await f.pool.query(
        "UPDATE amp_purchase_consents SET expires_at=now()-interval '1 minute' WHERE account_id='ambiguous'",
      );
      await f.pool.query(
        "ALTER TABLE amp_purchase_consents ENABLE TRIGGER amp_purchase_notice_immutable",
      );
      await assert.rejects(
        f.checkout("ambiguous"),
        /checkout_expired_retry_with_new_request/,
      );
      assert.equal(
        (
          await f.pool.query(
            "SELECT count(*)::int n FROM amp_stripe_checkouts WHERE account_id='ambiguous'",
          )
        ).rows[0].n,
        1,
      );
      f.gateway.createCheckout = create;
      const replacement = await f.checkout("ambiguous");
      assert.notEqual(replacement.id, unbound.id);
      assert.equal(
        (
          await f.pool.query(
            "SELECT count(*)::int n FROM amp_stripe_checkouts WHERE account_id='ambiguous' AND NOT closed",
          )
        ).rows[0].n,
        1,
      );
    }),
);

test(
  "financial identity quarantine cannot block a verified refund revocation",
  enabled,
  async () =>
    fixture(async (f) => {
      const row = await f.checkout();
      const p = f.settle(row);
      assert.deepEqual(await f.deliver(p), { processed: 1, failed: 0 });
      await f.learner();
      await claimEnrollment(f.billing, "parent", row.id, "child");
      const record = (await paymentHistory(f.pool, "parent"))[0]!;
      await f.pool.query(
        "INSERT INTO amp_payment_observations(id,record_id,observation,observation_sha256,source_event_id) VALUES($1,$2,$3,'fixture','fixture')",
        [
          randomUUID(),
          record.id,
          { kind: "review", reason: "financial_baseline_collision" },
        ],
      );
      p.fullRefundAt = p.paidAt;
      const delivered = await f.deliver(p);
      assert.deepEqual(
        delivered,
        { processed: 1, failed: 0 },
        JSON.stringify(
          (
            await f.pool.query(
              "SELECT error_code FROM amp_stripe_inbox WHERE error_code IS NOT NULL",
            )
          ).rows,
        ),
      );
      assert.equal(
        (
          await f.pool.query(
            "SELECT status FROM amp_grants WHERE learner_id='child'",
          )
        ).rows[0].status,
        "revoked",
      );
      assert.equal(await f.active(), true);
    }),
);

test(
  "fresh independently verified consent can claim an existing paid license without reactivating old consent evidence",
  enabled,
  async () =>
    fixture(async (f) => {
      const row = await f.checkout();
      const p = f.settle(row);
      assert.deepEqual(await f.deliver(p), { processed: 1, failed: 0 });
      await f.family.withdraw("parent");
      await f.learner();
      await assert.rejects(
        claimEnrollment(f.billing, "parent", row.id, "child"),
        /parent_consent_required/,
      );
      await f.pool.query(
        "UPDATE amp_purchase_consents SET purge_after=now()-interval '1 second' WHERE checkout_id=$1",
        [row.id],
      );
      await purgeConsentRecords(f.pool);
      await f.pool.query(
        "UPDATE amp_parent_consents SET policy_version=$1,verification_method='manual-verified-fixture',evidence_reference='independent-fixture',withdrawn_at=NULL WHERE account_id='parent'",
        [f.config.consentPolicyVersion],
      );
      await claimEnrollment(f.billing, "parent", row.id, "child");
      assert.equal(
        (
          await f.pool.query(
            "SELECT status FROM amp_grants WHERE learner_id='child'",
          )
        ).rows[0].status,
        "active",
      );
      assert.equal(
        (
          await f.pool.query(
            "SELECT 1 FROM amp_purchase_consents WHERE checkout_id=$1",
            [row.id],
          )
        ).rowCount,
        0,
      );
      assert.equal(
        (
          await f.pool.query(
            "SELECT verification_method FROM amp_parent_consents WHERE account_id='parent'",
          )
        ).rows[0].verification_method,
        "manual-verified-fixture",
      );
    }),
);

test(
  "cancellation failures back off without starving later accounts; ambiguous success is not repeated",
  enabled,
  async () =>
    fixture(async (f) => {
      const first = await f.checkout("first");
      const p = f.settle(first);
      const second = await f.checkout("second");
      const q = f.settle(second);
      await f.family.withdraw("first");
      await f.family.withdraw("second");
      const cancel = f.gateway.client.subscriptions.cancel;
      let firstCalls = 0;
      f.gateway.client.subscriptions.cancel = async (
        id,
        options,
        requestOptions,
      ) => {
        const result = await cancel(id, options, requestOptions);
        if (id === p.subscriptionId) {
          firstCalls++;
          throw new Error("synthetic lost response");
        }
        return result;
      };
      for (const payment of [p, q])
        await f.repository.enqueue({
          eventId: randomUUID(),
          type: "invoice.paid",
          objectId: payment.invoiceId,
          created: payment.paidAt,
          hash: "fixture",
        });
      assert.deepEqual(await f.billing.runBatch(), { processed: 0, failed: 3 });
      assert.equal(f.cancellations.has(q.subscriptionId), true);
      const firstAction = (
        await f.pool.query(
          "SELECT completed_at,error_code,available_at>now() AS deferred FROM amp_enrollment_cancellations WHERE checkout_id=$1",
          [first.id],
        )
      ).rows[0];
      assert.equal(firstAction.completed_at, null);
      assert.equal(firstAction.error_code, "cancellation_provider_unavailable");
      assert.equal(firstAction.deferred, true);
      assert.ok(
        (
          await f.pool.query(
            "SELECT completed_at FROM amp_enrollment_cancellations WHERE checkout_id=$1",
            [second.id],
          )
        ).rows[0].completed_at,
      );
      await f.pool.query(
        "UPDATE amp_enrollment_cancellations SET available_at=now() WHERE checkout_id=$1",
        [first.id],
      );
      assert.deepEqual(await f.billing.runBatch(), { processed: 0, failed: 0 });
      assert.equal(firstCalls, 1);
      assert.ok(
        (
          await f.pool.query(
            "SELECT completed_at FROM amp_enrollment_cancellations WHERE checkout_id=$1",
            [first.id],
          )
        ).rows[0].completed_at,
      );
      assert.equal(
        (await paymentHistory(f.pool, "first"))[0]!.baseline!.paidMinor,
        p.paid,
      );
    }),
);

test(
  "queued cancellation cannot remove independently recovered paid access",
  enabled,
  async () =>
    fixture(async (f) => {
      const row = await f.checkout();
      const p = f.settle(row);
      assert.deepEqual(await f.deliver(p), { processed: 1, failed: 0 });
      await f.pool.query(
        "INSERT INTO amp_enrollment_cancellations(checkout_id,subscription_id,reason) VALUES($1,$2,'purchase_consent_requires_review')",
        [row.id, p.subscriptionId],
      );
      assert.deepEqual(await f.billing.runBatch(), { processed: 0, failed: 0 });
      assert.equal(f.cancellations.size, 0);
      assert.equal(
        (
          await f.pool.query(
            "SELECT closed FROM amp_stripe_checkouts WHERE id=$1",
            [row.id],
          )
        ).rows[0].closed,
        false,
      );
      assert.ok(
        (
          await f.pool.query(
            "SELECT completed_at FROM amp_enrollment_cancellations WHERE checkout_id=$1",
            [row.id],
          )
        ).rows[0].completed_at,
      );
    }),
);

test(
  "account next step follows purchase-first enrollment: plan, then learner after verified payment, then claim",
  enabled,
  async () =>
    fixture(async (f) => {
      const next = async () =>
        accountSummary(f.pool, f.family, "parent", f.repository.namespace);
      assert.equal((await next()).next, "choose-plan");
      const row = await f.checkout();
      assert.equal((await next()).next, "choose-plan");
      assert.equal((await next()).unassignedPurchase, undefined);
      assert.deepEqual(await f.deliver(f.settle(row)), {
        processed: 1,
        failed: 0,
      });
      const paid = await next();
      assert.equal(paid.next, "add-learner");
      assert.equal(paid.unassignedPurchase?.id, row.id);
      assert.equal(paid.unassignedPurchase?.interval, "year");
      for (const namespace of [null, "acct_other:live"])
        assert.equal(
          (await accountSummary(f.pool, f.family, "parent", namespace))
            .unassignedPurchase,
          undefined,
        );
      // A learner created before the claim completes still resumes the claim.
      await f.learner();
      const unclaimed = await next();
      assert.equal(unclaimed.next, "add-learner");
      assert.equal(unclaimed.unassignedPurchase?.id, row.id);
      await claimEnrollment(f.billing, "parent", row.id, "child");
      const assigned = await next();
      assert.equal(assigned.next, "practice");
      assert.equal(assigned.unassignedPurchase, undefined);
      // Another account, or another Stripe namespace, never sees this purchase.
      assert.equal(
        (
          await accountSummary(
            f.pool,
            f.family,
            "other",
            f.repository.namespace,
          )
        ).unassignedPurchase,
        undefined,
      );
    }),
);

test(
  "funnel: the verified webhook writes one attributed purchase and one refund; the checkout link is erased",
  enabled,
  async () =>
    fixture(async (f) => {
      const visitorId = randomUUID();
      await recordEventBatch(f.pool, {
        visitorId,
        events: [
          {
            event: "landing_view",
            props: { referrer: "search", device: "phone", utmSource: "fall" },
            at: 1,
          },
        ],
      });
      const app = Fastify();
      try {
        await registerStripeRoutes(app, {
          pool: f.pool,
          config: f.config,
          consentPolicy: f.policy,
          gateway: f.gateway,
          authenticate: async () => "parent",
        });
        const started = await app.inject({
          method: "POST",
          url: "/api/v1/billing/enrollment/checkout",
          headers: { "x-amp-visitor": visitorId },
          payload: {
            requestId: randomUUID(),
            offerId: annualOffer(f.config).id,
            interval: "year",
            acknowledgement: f.acknowledge,
          },
        });
        assert.equal(started.statusCode, 200);
      } finally {
        await app.close();
      }
      const row = (await f.pool.query("SELECT * FROM amp_stripe_checkouts"))
        .rows[0];
      assert.equal(
        (
          await f.pool.query(
            "SELECT visitor_id FROM amp_funnel_checkouts WHERE checkout_id=$1",
            [row.id],
          )
        ).rows[0].visitor_id,
        visitorId,
      );
      const funnel = async () =>
        (
          await f.pool.query(
            "SELECT event,visitor_id,props FROM amp_funnel_events WHERE event IN ('purchase','refund') ORDER BY id",
          )
        ).rows;
      // A browser cannot claim a purchase: only the verified webhook writes it.
      assert.deepEqual(await funnel(), []);
      const p = f.settle(row);
      assert.deepEqual(await f.deliver(p), { processed: 1, failed: 0 });
      assert.deepEqual(await f.deliver(p), { processed: 1, failed: 0 });
      assert.deepEqual(await funnel(), [
        {
          event: "purchase",
          visitor_id: visitorId,
          props: { interval: "year" },
        },
      ]);
      const link = (
        await f.pool.query(
          "SELECT visitor_id,purchase_recorded FROM amp_funnel_checkouts",
        )
      ).rows[0];
      assert.equal(link.visitor_id, null);
      assert.equal(link.purchase_recorded, true);
      assert.ok(
        (
          await f.pool.query(
            "SELECT converted_on FROM amp_funnel_visitors WHERE visitor_id=$1",
            [visitorId],
          )
        ).rows[0].converted_on,
      );
      p.fullRefundAt = p.paidAt;
      f.gateway.invoiceFromCharge = async () => p.invoiceId;
      await f.deliver(p, "charge.refunded");
      await f.deliver(p, "charge.refunded");
      assert.deepEqual(await funnel(), [
        {
          event: "purchase",
          visitor_id: visitorId,
          props: { interval: "year" },
        },
        { event: "refund", visitor_id: null, props: { full: true } },
      ]);
      // No funnel row carries an account, checkout, invoice or learner.
      const columns = (
        await f.pool.query(
          "SELECT column_name FROM information_schema.columns WHERE table_name='amp_funnel_events' AND table_schema=current_schema()",
        )
      ).rows.map((r) => r.column_name);
      assert.deepEqual(columns.sort(), [
        "event",
        "id",
        "occurred_on",
        "props",
        "visitor_id",
      ]);
    }),
);
