import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";
import { annualEvents } from "../src/billing/stripe/model.js";
import {
  planForPrice,
  stripeConfig,
  type StripeBillingConfig,
} from "../src/billing/stripe/config.js";
import { StripeGateway } from "../src/billing/stripe/gateway.js";
import { retiredPrices } from "../src/billing/stripe/retired-prices.js";
import { syntheticDocumentProfile } from "./payment-evidence-fixtures.js";
import { binding, config, payment, remoteFixtures } from "./stripe-fixtures.js";

// A list-price change: $120 a year and $14 a month were sold; the catalog now
// sells $150 and $18. Subscribers keep renewing on the price they bought.
const OLD_YEAR = "price_annual";
const OLD_MONTH = "price_monthly_old";
const after: StripeBillingConfig = {
  ...config,
  priceId: "price_annual_new",
  amountMinor: 15000,
  monthlyPriceId: "price_monthly_new",
  monthlyAmountMinor: 1800,
  documentProfile: {
    ...syntheticDocumentProfile,
    priceId: "price_annual_new",
    unitAmountMinor: 15000,
  },
  retiredPrices: [
    {
      priceId: OLD_YEAR,
      interval: "year",
      amountMinor: 12000,
      livemode: false,
    },
    {
      priceId: OLD_MONTH,
      interval: "month",
      amountMinor: 1400,
      livemode: false,
    },
  ],
};
const monthBinding = { ...binding, interval: "month" as const };

test("a price id resolves to the plan it was bought on", () => {
  assert.equal(
    planForPrice(after, "price_annual_new")?.plan.amountMinor,
    15000,
  );
  assert.equal(planForPrice(after, "price_monthly_new")?.interval, "month");
  const old = planForPrice(after, OLD_YEAR)!;
  assert.equal(old.interval, "year");
  assert.equal(old.plan.priceId, OLD_YEAR);
  assert.equal(old.plan.amountMinor, 12000);
  // The retired plan's document profile is today's with only the price swapped.
  assert.equal(old.plan.documentProfile?.priceId, OLD_YEAR);
  assert.equal(old.plan.documentProfile?.unitAmountMinor, 12000);
  assert.equal(
    old.plan.documentProfile?.version,
    syntheticDocumentProfile.version,
  );
  assert.equal(planForPrice(after, OLD_MONTH, "month")?.plan.amountMinor, 1400);
  assert.equal(planForPrice(after, OLD_MONTH, "year"), undefined);
  assert.equal(planForPrice(after, "price_unknown"), undefined);
  assert.equal(planForPrice(after, undefined), undefined);
  // Without a configured monthly plan, a retired monthly price does not resolve.
  const { monthlyPriceId: _a, monthlyAmountMinor: _b, ...yearOnly } = after;
  assert.equal(planForPrice(yearOnly, OLD_MONTH), undefined);
  assert.equal(planForPrice(yearOnly, OLD_YEAR)?.plan.amountMinor, 12000);
});

test("renewals at the retired price still reconcile, at exactly its amount", () => {
  assert.doesNotThrow(() => annualEvents(after, binding, payment));
  assert.doesNotThrow(() =>
    annualEvents(after, binding, {
      ...payment,
      priceId: "price_annual_new",
      subtotal: 15000,
      paid: 15000,
    }),
  );
  const oldMonth = {
    ...payment,
    priceId: OLD_MONTH,
    subtotal: 1400,
    paid: 1400,
    periodEnd: payment.periodStart + 30 * 86400,
  };
  assert.doesNotThrow(() => annualEvents(after, monthBinding, oldMonth));
  for (const bad of [
    // A retired price at the new amount, or the new price at the old amount.
    { ...payment, subtotal: 15000, paid: 15000 },
    { ...payment, priceId: "price_annual_new" },
    // A retired monthly price on an annual checkout, and the reverse.
    { ...oldMonth },
    // Any other price.
    { ...payment, priceId: "price_unknown" },
  ])
    assert.throws(
      () => annualEvents(after, binding, bad),
      /payment_mapping_mismatch/,
    );
  assert.throws(
    () => annualEvents(after, monthBinding, payment),
    /payment_mapping_mismatch/,
  );
});

function gatewayWith(
  settings: StripeBillingConfig,
  f: ReturnType<typeof remoteFixtures>,
) {
  const seen: string[] = [];
  const client = {
    accounts: { retrieve: async () => f.account },
    billingPortal: { configurations: { retrieve: async () => f.portal } },
    prices: {
      retrieve: async (id: string) => {
        seen.push(id);
        const amount =
          id === settings.priceId
            ? settings.amountMinor
            : settings.monthlyAmountMinor;
        return {
          ...f.price,
          unit_amount: amount,
          recurring: {
            ...f.price.recurring,
            interval: id === settings.priceId ? "year" : "month",
          },
        };
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
  return { gateway: new StripeGateway(settings, client), seen };
}

test("the gateway verifies the sold prices and accepts a renewal invoice on a retired one", async () => {
  const f = remoteFixtures(); // an invoice for the retired $120 annual price
  const { gateway, seen } = gatewayWith(after, f);
  await gateway.verifyCatalog();
  // Only what is sold is checked against Stripe; retired prices may be archived.
  assert.deepEqual(seen, ["price_annual_new", "price_monthly_new"]);
  const renewal = await gateway.annualPayment(payment.invoiceId);
  assert.equal(renewal.priceId, OLD_YEAR);
  assert.equal(renewal.subtotal, 12000);
  assert.doesNotThrow(() => annualEvents(after, binding, renewal));

  // The retired price at a different amount is a different catalog.
  f.lines.data[0]!.subtotal = 15000;
  await assert.rejects(
    gateway.annualPayment(payment.invoiceId),
    /annual_invoice_mapping_mismatch/,
  );
  f.lines.data[0]!.subtotal = 12000;
  f.lines.data[0]!.pricing.price_details.price = "price_unknown";
  await assert.rejects(
    gateway.annualPayment(payment.invoiceId),
    /annual_invoice_mapping_mismatch/,
  );
});

test("checkout always sells the current price, never a retired one", async () => {
  const lines: unknown[] = [];
  const client = {
    checkout: {
      sessions: {
        create: async (params: { line_items: unknown }) => {
          lines.push(params.line_items);
          return {
            id: "cs_fixture",
            url: "https://checkout.stripe.com/x",
            livemode: false,
          };
        },
      },
    },
  } as unknown as Stripe;
  const gateway = new StripeGateway(after, client);
  await gateway.createCheckout("c1", "cus_fixture", "year");
  await gateway.createCheckout("c2", "cus_fixture", "month");
  assert.deepEqual(lines, [
    [{ price: "price_annual_new", quantity: 1 }],
    [{ price: "price_monthly_new", quantity: 1 }],
  ]);
});

const realIds = retiredPrices.filter((p) => !p.livemode);
const env = (year: string, month: string, amounts: [string, string]) => ({
  AMP_STRIPE_ENABLED: "true",
  AMP_STRIPE_MODE: "test",
  AMP_STRIPE_SECRET_KEY: config.secretKey,
  AMP_STRIPE_WEBHOOK_SECRET: config.webhookSecret,
  AMP_STRIPE_ACCOUNT_ID: config.accountId,
  AMP_STRIPE_PRODUCT_ID: config.productId,
  AMP_STRIPE_PRICE_ID: year,
  AMP_STRIPE_CURRENCY: config.currency,
  AMP_STRIPE_AMOUNT_MINOR: amounts[0],
  AMP_STRIPE_MONTHLY_PRICE_ID: month,
  AMP_STRIPE_MONTHLY_AMOUNT_MINOR: amounts[1],
  AMP_PAYMENT_MONTHLY_DOCUMENT_PROFILE: JSON.stringify({
    ...syntheticDocumentProfile,
    priceId: month,
    unitAmountMinor: Number(amounts[1]),
  }),
  AMP_STRIPE_SKU: config.sku,
  AMP_STRIPE_APP_ORIGIN: config.appOrigin,
  AMP_STRIPE_PORTAL_CONFIGURATION_ID: config.portalConfigurationId,
  AMP_STRIPE_AUTOMATIC_TAX: "false",
  AMP_STRIPE_CONSENT_POLICY_VERSION: config.consentPolicyVersion,
});

test("the configuration keeps the retired prices once the settings name new ones", () => {
  const year = realIds.find((p) => p.interval === "year")!;
  const month = realIds.find((p) => p.interval === "month")!;
  // Before the switch-over the retired prices are the current ones.
  const before = stripeConfig(
    env(year.priceId, month.priceId, ["49900", "4900"]),
  )!;
  assert.deepEqual(before.retiredPrices, []);
  // After it they are retired: renewals accepted at $499 and $49.
  const next = stripeConfig(
    env("price_new_year", "price_new_month", ["59900", "5900"]),
  )!;
  assert.deepEqual(
    next.retiredPrices?.map((p) => [p.priceId, p.amountMinor]),
    realIds.map((p) => [p.priceId, p.amountMinor]),
  );
  assert.equal(planForPrice(next, year.priceId)?.plan.amountMinor, 49900);
  assert.equal(planForPrice(next, month.priceId)?.plan.amountMinor, 4900);
  assert.equal(planForPrice(next, "price_new_year")?.plan.amountMinor, 59900);
});

// Each additional child in a family has its own price on the same product.
const extra: StripeBillingConfig = {
  ...after,
  extraPriceId: "price_extra_year",
  extraAmountMinor: 9000,
  extraDocumentProfile: {
    ...syntheticDocumentProfile,
    priceId: "price_extra_year",
    unitAmountMinor: 9000,
  },
  extraMonthlyPriceId: "price_extra_month",
  extraMonthlyAmountMinor: 1000,
};

test("an additional-child price resolves to its own plan, and renews at exactly its amount", () => {
  const year = planForPrice(extra, "price_extra_year")!;
  assert.deepEqual([year.interval, year.tier], ["year", "extra"]);
  assert.equal(year.plan.amountMinor, 9000);
  assert.equal(year.plan.documentProfile?.priceId, "price_extra_year");
  const month = planForPrice(extra, "price_extra_month", "month")!;
  assert.deepEqual([month.tier, month.plan.amountMinor], ["extra", 1000]);
  assert.equal(planForPrice(extra, "price_annual_new")?.tier, "full");
  assert.equal(planForPrice(extra, OLD_YEAR)?.tier, "full");
  // Without the settings the additional-child price is just another id.
  assert.equal(planForPrice(after, "price_extra_year"), undefined);

  const renewal = {
    ...payment,
    priceId: "price_extra_year",
    subtotal: 9000,
    paid: 9000,
  };
  assert.doesNotThrow(() =>
    annualEvents(extra, { ...binding, tier: "extra" }, renewal),
  );
  // The additional-child price at the full amount is a different catalog.
  assert.throws(
    () => annualEvents(extra, binding, { ...renewal, subtotal: 15000 }),
    /payment_mapping_mismatch/,
  );
});

test("checkout sells the additional-child price only when asked, and the gateway verifies it", async () => {
  const lines: unknown[] = [];
  const client = {
    checkout: {
      sessions: {
        create: async (params: { line_items: unknown }) => {
          lines.push(params.line_items);
          return {
            id: "cs_fixture",
            url: "https://checkout.stripe.com/x",
            livemode: false,
          };
        },
      },
    },
  } as unknown as Stripe;
  const gateway = new StripeGateway(extra, client);
  await gateway.createCheckout("c1", "cus_fixture", "year");
  await gateway.createCheckout(
    "c2",
    "cus_fixture",
    "year",
    false,
    undefined,
    "extra",
  );
  await gateway.createCheckout(
    "c3",
    "cus_fixture",
    "month",
    false,
    undefined,
    "extra",
  );
  assert.deepEqual(lines, [
    [{ price: "price_annual_new", quantity: 1 }],
    [{ price: "price_extra_year", quantity: 1 }],
    [{ price: "price_extra_month", quantity: 1 }],
  ]);
  // Without the settings there is no additional-child price to sell.
  await assert.rejects(
    new StripeGateway(after, client).createCheckout(
      "c4",
      "cus_fixture",
      "year",
      false,
      undefined,
      "extra",
    ),
    /extra_plan_unavailable/,
  );

  const { gateway: verifying, seen } = gatewayWith(extra, remoteFixtures());
  await verifying.verifyCatalog().catch(() => {});
  assert.deepEqual(seen.slice(0, 2), ["price_annual_new", "price_extra_year"]);
});

const extraEnv = (overrides: Record<string, string | undefined> = {}) => {
  const year = realIds.find((p) => p.interval === "year")!;
  const month = realIds.find((p) => p.interval === "month")!;
  const profile = (priceId: string, unitAmountMinor: number) =>
    JSON.stringify({ ...syntheticDocumentProfile, priceId, unitAmountMinor });
  return {
    ...env(year.priceId, month.priceId, ["49900", "4900"]),
    AMP_STRIPE_EXTRA_PRICE_ID: "price_extra_year",
    AMP_STRIPE_EXTRA_AMOUNT_MINOR: "39900",
    AMP_STRIPE_EXTRA_MONTHLY_PRICE_ID: "price_extra_month",
    AMP_STRIPE_EXTRA_MONTHLY_AMOUNT_MINOR: "3900",
    AMP_PAYMENT_EXTRA_DOCUMENT_PROFILE: profile("price_extra_year", 39900),
    AMP_PAYMENT_EXTRA_MONTHLY_DOCUMENT_PROFILE: profile(
      "price_extra_month",
      3900,
    ),
    ...overrides,
  };
};

test("the additional-child settings are validated like the full prices", () => {
  const year = realIds.find((p) => p.interval === "year")!;
  const month = realIds.find((p) => p.interval === "month")!;
  // Without them every child is sold the full price.
  const none = stripeConfig(
    env(year.priceId, month.priceId, ["49900", "4900"]),
  )!;
  assert.equal(none.extraPriceId, undefined);
  assert.equal(none.extraMonthlyPriceId, undefined);

  const set = stripeConfig(extraEnv())!;
  assert.equal(set.extraAmountMinor, 39900);
  assert.equal(set.extraMonthlyAmountMinor, 3900);
  assert.equal(set.extraMonthlyDocumentProfile?.priceId, "price_extra_month");

  for (const [name, overrides] of [
    ["price without amount", { AMP_STRIPE_EXTRA_AMOUNT_MINOR: undefined }],
    [
      "annual without monthly",
      {
        AMP_STRIPE_EXTRA_MONTHLY_PRICE_ID: undefined,
        AMP_STRIPE_EXTRA_MONTHLY_AMOUNT_MINOR: undefined,
        AMP_PAYMENT_EXTRA_MONTHLY_DOCUMENT_PROFILE: undefined,
      },
    ],
    ["the full price's id", { AMP_STRIPE_EXTRA_PRICE_ID: year.priceId }],
    ["a bad amount", { AMP_STRIPE_EXTRA_AMOUNT_MINOR: "0" }],
    [
      "no monthly receipt profile",
      {
        AMP_PAYMENT_EXTRA_MONTHLY_DOCUMENT_PROFILE: undefined,
      },
    ],
    [
      "a profile for another price",
      {
        AMP_PAYMENT_EXTRA_DOCUMENT_PROFILE: JSON.stringify({
          ...syntheticDocumentProfile,
          priceId: "price_extra_year",
          unitAmountMinor: 59900,
        }),
      },
    ],
  ] as const)
    assert.throws(() => stripeConfig(extraEnv(overrides)), Error, name);
});
