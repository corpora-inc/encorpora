import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";
import Fastify from "fastify";
import type { Pool } from "pg";
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
    { paidAt: payment.periodEnd },
  ])
    assert.throws(() =>
      annualEvents(config, binding, { ...payment, ...changed }),
    );
  assert.throws(() =>
    annualEvents(config, { ...binding, subscriptionId: "sub_other" }, payment),
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
  f.refunds.data.push({ status: "pending", amount: 12000 });
  assert.equal(
    (await gateway.annualPayment(payment.invoiceId)).refunded,
    false,
  );
  f.refunds.data[0]!.status = "succeeded";
  assert.equal((await gateway.annualPayment(payment.invoiceId)).refunded, true);
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
    subscription_data: { metadata: { amp_checkout_id: binding.id } },
    line_items: [{ price: config.priceId, quantity: 1 }],
    allow_promotion_codes: false,
    allowed_payment_method_types: ["card"],
    automatic_tax: { enabled: false },
    customer_update: { address: "auto" },
    success_url: "https://example.test/?billing=processing",
    cancel_url: "https://example.test/?billing=canceled",
  });
  assert.deepEqual(requestOptions, {
    idempotencyKey: `amp:checkout:${binding.id}`,
  });
});
