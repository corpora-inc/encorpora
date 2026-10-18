import { syntheticDocumentProfile } from "./payment-evidence-fixtures.js";
import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";
import { annualEvents } from "../src/billing/stripe/model.js";
import { annualOffer } from "../src/billing/stripe/purchase.js";
import { planConfig, stripeConfig } from "../src/billing/stripe/config.js";
import { StripeGateway } from "../src/billing/stripe/gateway.js";
import { config, binding, payment, remoteFixtures } from "./stripe-fixtures.js";

const monthly = {
  ...config,
  monthlyPriceId: "price_monthly_fixture",
  monthlyAmountMinor: 1400,
};
const monthlyBinding = { ...binding, interval: "month" as const };
const monthlyPayment = {
  ...payment,
  priceId: monthly.monthlyPriceId,
  subtotal: 1400,
  paid: 1400,
  periodEnd: Date.parse("2020-02-01") / 1000,
};

test("monthly paid periods cannot grant an annual term or use an annual checkout binding", () => {
  const events = annualEvents(monthly, monthlyBinding, monthlyPayment);
  const order = events.find((event) => event.type === "order.created");
  assert.equal(
    order?.type === "order.created" && order.order.license.endsAt,
    "2020-02-01T00:00:00.000Z",
  );
  assert.throws(
    () => annualEvents(monthly, binding, monthlyPayment),
    /payment_mapping_mismatch/,
  );
  assert.throws(
    () =>
      annualEvents(monthly, monthlyBinding, {
        ...monthlyPayment,
        periodEnd: payment.periodEnd,
      }),
    /invalid_monthly_term/,
  );
  assert.throws(
    () =>
      annualEvents(monthly, monthlyBinding, {
        ...monthlyPayment,
        subtotal: 12000,
      }),
    /payment_mapping_mismatch/,
  );
  for (const days of [28, 29, 30, 31])
    assert.doesNotThrow(() =>
      annualEvents(monthly, monthlyBinding, {
        ...monthlyPayment,
        periodEnd: monthlyPayment.periodStart + days * 86400,
      }),
    );
});

test("monthly offers use configured amounts and unique plan-bound fingerprints without exposing provider identifiers", () => {
  const annual = annualOffer(monthly),
    month = annualOffer(monthly, "month");
  assert.equal(month.amountMinor, 1400);
  assert.equal(month.formattedAmount, "$14.00");
  assert.equal(month.interval, "month");
  assert.notEqual(month.id, annual.id);
  assert.equal(month.amountMinor * 12 - annual.amountMinor, 4800);
  assert.ok(!JSON.stringify(month).includes(monthly.monthlyPriceId));
  assert.throws(() => planConfig(config, "month"), /monthly_plan_unavailable/);
  assert.throws(() =>
    planConfig({ ...monthly, monthlyAmountMinor: 0 }, "month"),
  );
});

test("monthly catalog and settled invoice are checked against the actual selected price", async () => {
  const f = remoteFixtures();
  const monthlyPrice = {
    ...f.price,
    unit_amount: 1400,
    recurring: { ...f.price.recurring, interval: "month" },
  };
  const seen: string[] = [];
  const client = {
    accounts: { retrieve: async () => f.account },
    billingPortal: { configurations: { retrieve: async () => f.portal } },
    prices: {
      retrieve: async (id: string) => {
        seen.push(id);
        return id === config.priceId ? f.price : monthlyPrice;
      },
    },
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
  const gateway = new StripeGateway(monthly, client);
  await gateway.verifyCatalog();
  assert.deepEqual(seen, [config.priceId, monthly.monthlyPriceId]);
  monthlyPrice.recurring.interval = "year";
  await assert.rejects(gateway.verifyCatalog(), /monthly_catalog_mismatch/);
  monthlyPrice.recurring.interval = "month";
  Object.assign(f.invoice, { amount_paid: 1400, total: 1400, subtotal: 1400 });
  f.lines.data[0]!.subtotal = 1400;
  f.lines.data[0]!.pricing.price_details.price = monthly.monthlyPriceId;
  f.lines.data[0]!.period.end = monthlyPayment.periodEnd;
  f.payments.data[0]!.amount_paid = 1400;
  f.intent.amount_received = 1400;
  f.charge.amount = 1400;
  const result = await gateway.annualPayment(payment.invoiceId);
  assert.equal(result.priceId, monthly.monthlyPriceId);
  assert.equal(result.subtotal, 1400);
  annualEvents(monthly, monthlyBinding, result);
  f.lines.data[0]!.pricing.price_details.price = "price_unconfigured";
  await assert.rejects(
    gateway.annualPayment(payment.invoiceId),
    /annual_invoice_mapping_mismatch/,
  );
});

test("monthly configuration requires both explicit amount and distinct price", () => {
  const env = {
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
  };
  assert.throws(() =>
    stripeConfig({ ...env, AMP_STRIPE_MONTHLY_PRICE_ID: "price_monthly" }),
  );
  assert.throws(() =>
    stripeConfig({
      ...env,
      AMP_STRIPE_MONTHLY_PRICE_ID: config.priceId,
      AMP_STRIPE_MONTHLY_AMOUNT_MINOR: "1400",
    }),
  );
  assert.throws(
    () =>
      stripeConfig({
        ...env,
        AMP_STRIPE_MONTHLY_PRICE_ID: "price_monthly",
        AMP_STRIPE_MONTHLY_AMOUNT_MINOR: "1400",
      }),
    /MONTHLY_DOCUMENT_PROFILE/,
  );
  assert.equal(
    stripeConfig({
      ...env,
      AMP_STRIPE_MONTHLY_PRICE_ID: "price_monthly",
      AMP_STRIPE_MONTHLY_AMOUNT_MINOR: "1400",
      AMP_PAYMENT_MONTHLY_DOCUMENT_PROFILE: JSON.stringify({
        ...syntheticDocumentProfile,
        priceId: "price_monthly",
        unitAmountMinor: 1400,
      }),
    })?.monthlyAmountMinor,
    1400,
  );
});

test("late settlement preserves the original paid period instead of extending access", () => {
  const events = annualEvents(monthly, monthlyBinding, {
    ...monthlyPayment,
    paidAt: monthlyPayment.periodEnd + 86400,
  });
  const created = events.find((event) => event.type === "order.created");
  assert.equal(
    created?.type === "order.created" && created.order.license.endsAt,
    new Date(monthlyPayment.periodEnd * 1000).toISOString(),
  );
});
