import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";
import Fastify from "fastify";
import { Pool } from "pg";
import { StripeRepository } from "../src/billing/stripe/repository.js";
import { StripeBilling } from "../src/billing/stripe/service.js";
import { annualEvents } from "../src/billing/stripe/model.js";
import { emptyCommerceState, reduceCommerce } from "../src/commerce/ledger.js";
import { stripeConfig } from "../src/billing/stripe/config.js";
import { StripeGateway } from "../src/billing/stripe/gateway.js";
import { registerStripeRoutes } from "../src/billing/stripe/routes.js";
import { config, binding, payment, remoteFixtures } from "./stripe-fixtures.js";
function mockedGateway(f = remoteFixtures()) {
  const client = {
    accounts: { retrieve: async () => f.account },
    prices: { retrieve: async () => f.price },
    billingPortal: { configurations: { retrieve: async () => f.portal } },
    invoices: {
      retrieve: async () => f.invoice,
      listLineItems: async () => f.lines,
    },
    subscriptions: { retrieve: async () => f.subscription },
    invoicePayments: { list: async () => f.payments },
    paymentIntents: { retrieve: async () => f.intent },
    charges: { retrieve: async () => f.charge },
    refunds: { list: async () => f.refunds },
  } as unknown as Stripe;
  return new StripeGateway(config, client);
}
test("annual paid invoice grants once; full refund revokes; refund-first never activates", () => {
  const events = annualEvents(config, binding, payment);
  let state = events.reduce(reduceCommerce, emptyCommerceState());
  assert.equal(state.grants.length, 1);
  assert.equal(state.grants[0]!.status, "active");
  state = events.reduce(reduceCommerce, state);
  assert.equal(state.grants.length, 1);
  const refund = annualEvents(config, binding, {
    ...payment,
    fullRefundAt: payment.paidAt + 86400,
  });
  state = refund.reduce(reduceCommerce, state);
  assert.equal(state.grants[0]!.status, "revoked");
  assert.equal(
    refund.reduce(reduceCommerce, emptyCommerceState()).grants.length,
    0,
  );
  assert.equal(
    refund.some((x) => x.type === "license.activated"),
    false,
  );
});
test("annual terms and server mappings reject tampering", () => {
  for (const changed of [
    { customerId: "cus_other" },
    { checkoutId: "other" },
    { priceId: "price_other" },
    { productId: "prod_other" },
    { currency: "eur" },
    { subtotal: 1 },
    { paid: 0 },
    { periodEnd: payment.periodStart + 30 * 86400 },
    { paidAt: payment.periodStart - 1 },
  ])
    assert.throws(() =>
      annualEvents(config, binding, { ...payment, ...changed }),
    );
  assert.throws(() =>
    annualEvents(config, { ...binding, subscriptionId: "sub_other" }, payment),
  );
});
function billingEnv(overrides: Record<string, string> = {}) {
  return {
    AMP_STRIPE_ENABLED: "true",
    AMP_STRIPE_MODE: "test",
    AMP_STRIPE_SECRET_KEY: config.secretKey,
    AMP_STRIPE_WEBHOOK_SECRET: config.webhookSecret,
    AMP_STRIPE_ACCOUNT_ID: config.accountId,
    AMP_STRIPE_PRODUCT_ID: config.productId,
    AMP_STRIPE_PRICE_ID: config.priceId,
    AMP_STRIPE_CURRENCY: config.currency,
    AMP_STRIPE_AMOUNT_MINOR: String(config.amountMinor),
    AMP_STRIPE_SKU: config.sku,
    AMP_STRIPE_APP_ORIGIN: config.appOrigin,
    AMP_STRIPE_PORTAL_CONFIGURATION_ID: config.portalConfigurationId,
    AMP_STRIPE_AUTOMATIC_TAX: "false",
    AMP_STRIPE_CONSENT_POLICY_VERSION: config.consentPolicyVersion,
    ...overrides,
  };
}

test("standard and restricted keys are accepted only for their own mode", () => {
  // Synthetic placeholders: shaped like keys, never valid credentials.
  const fake = "fixture_not_a_credential";
  for (const prefix of ["sk_test_", "rk_test_"])
    assert.equal(
      stripeConfig(billingEnv({ AMP_STRIPE_SECRET_KEY: prefix + fake }))
        ?.livemode,
      false,
    );
  const live = {
    AMP_STRIPE_MODE: "live",
    AMP_STRIPE_LIVE_APPROVED: "true",
  };
  for (const prefix of ["sk_live_", "rk_live_"])
    assert.equal(
      stripeConfig(
        billingEnv({ ...live, AMP_STRIPE_SECRET_KEY: prefix + fake }),
      )?.livemode,
      true,
    );
  for (const prefix of ["sk_live_", "rk_live_"])
    assert.throws(
      () => stripeConfig(billingEnv({ AMP_STRIPE_SECRET_KEY: prefix + fake })),
      /Stripe key mode mismatch/,
    );
  for (const prefix of ["sk_test_", "rk_test_"])
    assert.throws(
      () =>
        stripeConfig(
          billingEnv({ ...live, AMP_STRIPE_SECRET_KEY: prefix + fake }),
        ),
      /Stripe key mode mismatch/,
    );
  for (const key of [
    "pk_test_" + fake,
    "pk_live_" + fake,
    "rk_" + fake,
    "sk_" + fake,
    "rk_test_",
    "sk_test_",
    "whsec_" + fake,
    "xrk_test_" + fake,
  ])
    assert.throws(
      () => stripeConfig(billingEnv({ AMP_STRIPE_SECRET_KEY: key })),
      /Stripe key mode mismatch/,
    );
  // A live key without operational approval still fails closed.
  assert.throws(
    () =>
      stripeConfig(
        billingEnv({
          AMP_STRIPE_MODE: "live",
          AMP_STRIPE_SECRET_KEY: "rk_live_" + fake,
        }),
      ),
    /operational approval/,
  );
});

test("disabled billing has no defaults and live billing fails closed", () => {
  assert.equal(stripeConfig({}), undefined);
  assert.throws(() => stripeConfig({ AMP_STRIPE_ENABLED: "true" }));
  assert.throws(() =>
    stripeConfig({ AMP_STRIPE_ENABLED: "true", AMP_STRIPE_MODE: "live" }),
  );
});
test("gateway validates actual invoice/payment/charge chain and ignores pending refunds", async () => {
  const f = remoteFixtures();
  const gateway = mockedGateway(f);
  await gateway.verifyCatalog();
  const result = await gateway.annualPayment(payment.invoiceId);
  assert.equal(result.paid, 12000);
  assert.equal(result.refunded, false);
  f.refunds.data.push({
    status: "pending",
    amount: 12000,
    created: payment.paidAt + 86400,
  });
  assert.equal(
    (await gateway.annualPayment(payment.invoiceId)).refunded,
    false,
  );
  f.refunds.data[0]!.status = "succeeded";
  assert.equal((await gateway.annualPayment(payment.invoiceId)).refunded, true);
  assert.equal(
    (await gateway.annualPayment(payment.invoiceId)).fullRefundAt,
    payment.paidAt + 86400,
  );
  f.refunds.data[0]!.amount = 100;
  assert.equal(
    (await gateway.annualPayment(payment.invoiceId)).partialRefund,
    true,
  );
});
test("gateway rejects mode, price, proration, extra lines, foreign customer and failed settlement", async () => {
  const mutations: ((f: ReturnType<typeof remoteFixtures>) => void)[] = [
    (f) => {
      f.invoice.livemode = true;
    },
    (f) => {
      f.lines.data[0]!.pricing.price_details.price = "price_wrong";
    },
    (f) => {
      f.lines.data[0]!.parent.subscription_item_details.proration = true;
    },
    (f) => {
      f.lines.has_more = true;
    },
    (f) => {
      f.intent.customer = "cus_other";
    },
    (f) => {
      f.intent.status = "processing";
    },
    (f) => {
      f.charge.captured = false;
    },
    (f) => {
      f.payments.data[0]!.amount_paid = 1;
    },
    (f) => {
      f.invoice.amount_paid = 0;
    },
    (f) => {
      f.invoice.subtotal = 1;
    },
  ];
  for (const mutate of mutations) {
    const f = remoteFixtures();
    mutate(f);
    await assert.rejects(mockedGateway(f).annualPayment(payment.invoiceId));
  }
  const f = remoteFixtures();
  f.portal.features.subscription_update.enabled = true;
  await assert.rejects(mockedGateway(f).verifyCatalog());
});
test("raw webhook signatures, replay age, Connect events and auth boundaries", async () => {
  const gateway = new StripeGateway(config);
  const app = Fastify();
  let stored = 0;
  const billing = await registerStripeRoutes(app, {
    pool: {} as Pool,
    authenticate: async () => {
      throw Object.assign(new Error("unauthorized"), { statusCode: 401 });
    },
    config,
    gateway,
  });
  billing.repository.enqueue = async () => {
    stored++;
  };
  const event = {
    id: "evt_fixture",
    object: "event",
    type: "invoice.paid",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    data: { object: { id: "in_fixture", object: "invoice" } },
  };
  const payload = JSON.stringify(event);
  const signature = gateway.client.webhooks.generateTestHeaderString({
    payload,
    secret: config.webhookSecret,
  });
  const send = (body: string, header = signature) =>
    app.inject({
      method: "POST",
      url: "/api/v1/billing/stripe/webhook",
      headers: {
        "content-type": "application/json",
        "stripe-signature": header,
      },
      payload: body,
    });
  try {
    assert.equal((await send(payload)).statusCode, 200);
    assert.equal(stored, 1);
    assert.equal((await send(payload + " ")).statusCode, 400);
    const old = gateway.client.webhooks.generateTestHeaderString({
      payload,
      secret: config.webhookSecret,
      timestamp: 1,
    });
    assert.equal((await send(payload, old)).statusCode, 400);
    for (const changes of [{ account: "acct_foreign" }, { livemode: true }]) {
      const body = JSON.stringify({ ...event, ...changes });
      const header = gateway.client.webhooks.generateTestHeaderString({
        payload: body,
        secret: config.webhookSecret,
      });
      assert.equal((await send(body, header)).statusCode, 400);
    }
    for (const path of ["checkout", "portal"])
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: `/api/v1/billing/${path}`,
            payload: {},
          })
        ).statusCode,
        401,
      );
    assert.equal(stored, 1);
  } finally {
    await app.close();
  }
});

test("hosted Checkout fixes product, quantity, customer, metadata and redirects server-side", async () => {
  let captured: unknown;
  let requestOptions: unknown;
  const client = {
    checkout: {
      sessions: {
        create: async (params: unknown, options: unknown) => {
          captured = params;
          requestOptions = options;
          return {
            id: "cs_fixture",
            url: "https://checkout.stripe.test/fixture",
            livemode: false,
          };
        },
      },
    },
  } as unknown as Stripe;
  const gateway = new StripeGateway(config, client);
  await gateway.createCheckout(binding.id, binding.customerId);
  assert.deepEqual(captured, {
    mode: "subscription",
    customer: binding.customerId,
    client_reference_id: binding.id,
    metadata: { amp_checkout_id: binding.id },
    subscription_data: {
      metadata: { amp_checkout_id: binding.id },
      billing_mode: { type: "flexible" },
    },
    line_items: [{ price: config.priceId, quantity: 1 }],
    allow_promotion_codes: false,
    automatic_tax: { enabled: false },
    name_collection: { individual: { enabled: true, optional: false } },
    customer_update: { address: "auto", name: "auto" },
    success_url: `https://example.test/?billing=processing&purchase=${binding.id}`,
    cancel_url: `https://example.test/?billing=canceled&purchase=${binding.id}`,
  });
  assert.deepEqual(requestOptions, {
    idempotencyKey: `amp:checkout:${binding.id}`,
  });
});

function checkoutCapture(gatewayConfig = config) {
  const calls: Record<string, unknown>[] = [];
  const client = {
    checkout: {
      sessions: {
        create: async (params: Record<string, unknown>) => {
          calls.push(params);
          return {
            id: "cs_fixture",
            url: "https://checkout.stripe.test/fixture",
            livemode: gatewayConfig.livemode,
          };
        },
      },
    },
  } as unknown as Stripe;
  return { calls, gateway: new StripeGateway(gatewayConfig, client) };
}

test("Checkout leaves payment methods to the Dashboard and uses flexible billing", async () => {
  for (const interval of ["year", "month"] as const) {
    const { calls, gateway } = checkoutCapture({
      ...config,
      monthlyPriceId: "price_monthly",
      monthlyAmountMinor: 1400,
    });
    await gateway.createCheckout(binding.id, binding.customerId, interval);
    const params = calls[0]!;
    assert.equal("payment_method_types" in params, false);
    assert.equal("allowed_payment_method_types" in params, false);
    assert.equal("payment_method_configuration" in params, false);
    assert.deepEqual(
      (params.subscription_data as Record<string, unknown>).billing_mode,
      { type: "flexible" },
    );
    assert.deepEqual(params.line_items, [
      {
        price: interval === "year" ? config.priceId : "price_monthly",
        quantity: 1,
      },
    ]);
  }
});

test("purchase-backed consent Checkout offers only reviewed card and Link methods", async () => {
  // Consent by purchase accepts only card (including Apple Pay and Google Pay)
  // and Link; any other method would settle and then be rejected.
  const { calls, gateway } = checkoutCapture();
  const expiresAt = 1_900_000_000;
  await gateway.createCheckout(
    binding.id,
    binding.customerId,
    "year",
    true,
    expiresAt,
  );
  assert.deepEqual(calls[0]!.allowed_payment_method_types, ["card", "link"]);
  assert.equal(calls[0]!.expires_at, expiresAt);
  assert.deepEqual(
    (calls[0]!.subscription_data as Record<string, unknown>).billing_mode,
    { type: "flexible" },
  );
  assert.equal(
    calls[0]!.success_url,
    `https://example.test/start/purchase?billing=processing&purchase=${binding.id}`,
  );
  await gateway.createCheckout(binding.id, binding.customerId, "year", false);
  assert.equal("allowed_payment_method_types" in calls[1]!, false);
});

test("automatic tax collects the full billing address and saves it to the customer", async () => {
  const taxed = checkoutCapture({ ...config, automaticTax: true });
  await taxed.gateway.createCheckout(binding.id, binding.customerId);
  assert.deepEqual(taxed.calls[0]!.automatic_tax, { enabled: true });
  assert.equal(taxed.calls[0]!.billing_address_collection, "required");
  assert.deepEqual(taxed.calls[0]!.customer_update, {
    address: "auto",
    name: "auto",
  });
  assert.deepEqual(taxed.calls[0]!.name_collection, {
    individual: { enabled: true, optional: false },
  });
  const untaxed = checkoutCapture({ ...config, automaticTax: false });
  await untaxed.gateway.createCheckout(binding.id, binding.customerId);
  assert.deepEqual(untaxed.calls[0]!.automatic_tax, { enabled: false });
  assert.equal("billing_address_collection" in untaxed.calls[0]!, false);
});

test("pinned API version supports flexible billing mode", () => {
  const gateway = new StripeGateway(config);
  assert.equal(
    (
      gateway.client as unknown as { getApiField(key: string): unknown }
    ).getApiField("version"),
    "2026-09-30.endive",
  );
});

test("delayed-settlement methods never grant access before the charge succeeds", async () => {
  // Bank debits and similar methods: Checkout completes, the PaymentIntent is
  // processing and the charge is pending until the bank settles.
  const mutations: ((f: ReturnType<typeof remoteFixtures>) => void)[] = [
    (f) => {
      f.invoice.status = "open";
      f.invoice.amount_paid = 0;
      f.invoice.amount_remaining = 12000;
      f.intent.status = "processing";
      f.charge.status = "pending";
      f.charge.paid = false;
    },
    (f) => {
      f.intent.status = "processing";
    },
    (f) => {
      f.charge.status = "pending";
    },
    (f) => {
      f.charge.status = "failed";
    },
  ];
  for (const mutate of mutations) {
    const f = remoteFixtures();
    mutate(f);
    await assert.rejects(mockedGateway(f).annualPayment(payment.invoiceId));
  }
});

test("non-card payment methods settle and are recorded by their Stripe type", async () => {
  for (const type of ["card", "link", "us_bank_account", "amazon_pay"]) {
    const f = remoteFixtures();
    Object.assign(f.invoice, {
      billing_reason: "subscription_create",
      amount_overpaid: 0,
      amount_shipping: 0,
      starting_balance: 0,
      ending_balance: 0,
      pre_payment_credit_notes_amount: 0,
      post_payment_credit_notes_amount: 0,
      latest_revision: null,
      from_invoice: null,
      total_excluding_tax: 12000,
      subtotal_excluding_tax: 12000,
      total_taxes: [],
    });
    (f.charge as Record<string, unknown>).payment_method_details = { type };
    const result = await mockedGateway(f).annualPayment(payment.invoiceId);
    assert.equal(result.paid, 12000);
    assert.equal(result.financial?.kind, "verified");
    assert.equal(
      result.financial?.kind === "verified" &&
        result.financial.observation.paymentMethod,
      type,
    );
  }
});

test("worker refuses insufficient pools and concurrent passes sharing a pool", async (t) => {
  const small = new Pool({ max: 1 });
  const pool = new Pool({ max: 4 });
  let cancellationReads = 0;
  t.mock.method(pool, "query", async (sql: string) => {
    if (
      sql === "SELECT to_regclass('amp_enrollment_cancellations') AS relation"
    )
      return { rows: [{ relation: "amp_enrollment_cancellations" }] };
    assert.match(
      sql,
      /^SELECT c\.checkout_id,b\.account_id FROM amp_enrollment_cancellations/,
    );
    cancellationReads++;
    return { rows: [] };
  });
  try {
    await assert.rejects(
      new StripeBilling(
        new StripeRepository(small, config),
        new StripeGateway(config),
      ).runBatch(),
      /at least two/,
    );
    const repository = new StripeRepository(pool, config);
    let release!: () => void;
    const paused = new Promise<void>((resolve) => {
      release = resolve;
    });
    repository.claim = async () => {
      await paused;
      return undefined;
    };
    const first = new StripeBilling(
      repository,
      new StripeGateway(config),
    ).runBatch();
    await assert.rejects(
      new StripeBilling(repository, new StripeGateway(config)).runBatch(),
      /one Stripe worker pass/,
    );
    release();
    await first;
    assert.deepEqual(
      await new StripeBilling(repository, new StripeGateway(config)).runBatch(),
      { processed: 0, failed: 0 },
    );
    assert.equal(cancellationReads, 2);
  } finally {
    await small.end();
    await pool.end();
  }
});
