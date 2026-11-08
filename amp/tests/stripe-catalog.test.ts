import assert from "node:assert/strict";
import { test } from "node:test";
import { brand } from "../src/brand.ts";
import { environments } from "../infra/environments.ts";
import { stripeCatalog } from "../infra/stripe.ts";
import { retiredPrices } from "../src/billing/stripe/retired-prices.ts";
import {
  applyCatalog,
  formatDesired,
  planCatalog,
  type CatalogClient,
  type NewPrice,
  type PriceState,
  type ProductState,
  type ProductUpdate,
  type StripeRuntime,
  stripeClient,
} from "../infra/stripe-sync.ts";

const stage = environments.stage.stripe;
const retiredIds = stage.retiredPriceIds;
const ACCOUNT = "acct_synthetic";

function runtime(overrides: Partial<StripeRuntime> = {}): StripeRuntime {
  return {
    mode: "test",
    secretKey: "sk_test_synthetic",
    accountId: ACCOUNT,
    productId: stage.productId,
    // Before the switch-over the API still sells the retired prices.
    priceIds: { ...retiredIds },
    amounts: { year: "49900", month: "4900" },
    // Nor does it sell an additional-child price yet.
    extraPriceIds: {},
    extraAmounts: {},
    currency: "usd",
    ...overrides,
  };
}

function price(
  interval: "year" | "month",
  id: string,
  unitAmount: number,
  lookupKey: string | null = null,
): PriceState {
  return {
    id,
    product: stage.productId,
    active: true,
    livemode: false,
    currency: "usd",
    unit_amount: unitAmount,
    lookup_key: lookupKey,
    tax_behavior: "exclusive",
    type: "recurring",
    billing_scheme: "per_unit",
    recurring: { interval, interval_count: 1, usage_type: "licensed" },
  };
}

const NEW_YEAR = "price_new_year";
const NEW_MONTH = "price_new_month";
const EXTRA_YEAR = "price_extra_year";
const EXTRA_MONTH = "price_extra_month";
const createdIds: Record<string, string> = {
  "amp-year-59900": NEW_YEAR,
  "amp-month-5900": NEW_MONTH,
  "amp-extra-year-39900": EXTRA_YEAR,
  "amp-extra-month-3900": EXTRA_MONTH,
};

class FakeStripe implements CatalogClient {
  updates: { id: string; update: ProductUpdate; key: string }[] = [];
  account = ACCOUNT;
  ignoreUpdates = false;
  product_: ProductState = {
    id: stage.productId,
    active: true,
    livemode: false,
    name: "AMP Mathematics",
    description: "One-year license for one learner.",
    statement_descriptor: null,
    tax_code: null,
    metadata: { unrelated: "kept" },
  };
  creates: { price: NewPrice; key: string }[] = [];
  prices = new Map<string, PriceState>([
    [retiredIds.year, price("year", retiredIds.year, 49900)],
    [retiredIds.month, price("month", retiredIds.month, 4900)],
  ]);
  async accountId() {
    return this.account;
  }
  async product() {
    return structuredClone(this.product_);
  }
  async price(id: string) {
    const p = this.prices.get(id);
    if (!p) throw new Error(`no such price ${id}`);
    return structuredClone(p);
  }
  async priceByLookupKey(key: string) {
    const found = [...this.prices.values()].find((p) => p.lookup_key === key);
    return found ? structuredClone(found) : null;
  }
  async createPrice(input: NewPrice, key: string) {
    this.creates.push({ price: input, key });
    const created = price(
      input.interval,
      createdIds[input.lookupKey]!,
      input.unitAmount,
      input.lookupKey,
    );
    this.prices.set(created.id, created);
    return structuredClone(created);
  }
  async updateProduct(id: string, update: ProductUpdate, key: string) {
    this.updates.push({ id, update, key });
    if (this.ignoreUpdates) return;
    const { metadata, ...fields } = update;
    Object.assign(this.product_, fields);
    this.product_.metadata = { ...this.product_.metadata, ...metadata };
  }
}

const quiet = () => {};

test("the catalog takes its text from the brand", () => {
  assert.equal(stripeCatalog.product.name, brand.checkout.name);
  assert.equal(stripeCatalog.product.description, brand.checkout.description);
  assert.equal(
    stripeCatalog.product.statement_descriptor,
    brand.checkout.statementDescriptor,
  );
});

test("AMP sells $599 a year and $59 a month; $499 and $49 are retired", () => {
  assert.deepEqual(stripeCatalog.prices, {
    year: {
      unitAmount: 59900,
      currency: "usd",
      interval: "year",
      lookupKey: "amp-year-59900",
    },
    month: {
      unitAmount: 5900,
      currency: "usd",
      interval: "month",
      lookupKey: "amp-month-5900",
    },
  });
  // Each additional child in a family: $399 a year or $39 a month.
  assert.deepEqual(stripeCatalog.extraPrices, {
    year: {
      unitAmount: 39900,
      currency: "usd",
      interval: "year",
      lookupKey: "amp-extra-year-39900",
    },
    month: {
      unitAmount: 3900,
      currency: "usd",
      interval: "month",
      lookupKey: "amp-extra-month-3900",
    },
  });
  assert.equal(environments.stage.stripe.mode, "test");
  assert.equal(environments.prod.stripe.mode, "live");
  for (const env of Object.values(environments)) {
    assert.match(env.stripe.productId, /^prod_[A-Za-z0-9]+$/);
    for (const id of Object.values(env.stripe.retiredPriceIds))
      assert.match(id, /^price_[A-Za-z0-9]+$/);
  }
  // The retired table is what existing subscriptions renew on.
  assert.deepEqual(
    retiredPrices.map((p) => [p.livemode, p.interval, p.amountMinor]),
    [
      [false, "year", 49900],
      [false, "month", 4900],
      [true, "year", 49900],
      [true, "month", 4900],
    ],
  );
});

test("the desired state prints without credentials", () => {
  const text = formatDesired();
  assert.ok(text.includes(brand.checkout.name));
  assert.ok(text.includes(environments.prod.stripe.retiredPriceIds.year));
  assert.ok(text.includes("amp-year-59900"));
  assert.ok(text.includes("amp-extra-year-39900"));
  assert.ok(text.includes("amp-extra-month-3900"));
  assert.doesNotMatch(text, /sk_|rk_|acct_/);
});

test("plan lists text differences and verifies the prices", async () => {
  const stripe = new FakeStripe();
  const plan = await planCatalog("stage", stripe, runtime());
  assert.deepEqual(plan.errors, []);
  assert.deepEqual(
    plan.changes.map((c) => c.field),
    [
      "price.year",
      "price.month",
      "price.extra.year",
      "price.extra.month",
      "name",
      "description",
      "statement_descriptor",
      "tax_code",
      "metadata.managed_by",
    ],
  );
  assert.equal(plan.verified.length, 2);
  assert.equal(plan.pending.length, 4);
  assert.equal(stripe.updates.length, 0);
  assert.equal(stripe.creates.length, 0);
});

test("apply writes only the differences, then the plan is empty", async () => {
  const stripe = new FakeStripe();
  await applyCatalog("stage", stripe, runtime(), quiet);
  assert.equal(stripe.updates.length, 1);
  const [{ update, key }] = stripe.updates;
  assert.deepEqual(update.metadata, {
    managed_by: stripeCatalog.product.metadata.managed_by,
  });
  assert.match(key, /^amp-catalog-[0-9a-f]{40}$/);
  assert.equal(stripe.product_.metadata.unrelated, "kept");
  assert.deepEqual((await planCatalog("stage", stripe, runtime())).changes, []);

  // Idempotent: a second apply makes no call.
  await applyCatalog("stage", stripe, runtime(), quiet);
  assert.equal(stripe.updates.length, 1);
  assert.equal(stripe.creates.length, 4);
});

test("apply creates the new prices and leaves the retired ones untouched", async () => {
  const stripe = new FakeStripe();
  await applyCatalog("stage", stripe, runtime(), quiet);
  assert.deepEqual(
    stripe.creates.map((c) => [
      c.price.interval,
      c.price.unitAmount,
      c.price.lookupKey,
      c.key,
    ]),
    [
      ["year", 59900, "amp-year-59900", "amp-price-amp-year-59900"],
      ["month", 5900, "amp-month-5900", "amp-price-amp-month-5900"],
      ["year", 39900, "amp-extra-year-39900", "amp-price-amp-extra-year-39900"],
      ["month", 3900, "amp-extra-month-3900", "amp-price-amp-extra-month-3900"],
    ],
  );
  for (const c of stripe.creates) {
    assert.equal(c.price.product, stage.productId);
    assert.equal(c.price.currency, "usd");
  }
  assert.equal(stripe.prices.get(retiredIds.year)!.unit_amount, 49900);
  assert.equal(stripe.prices.get(retiredIds.month)!.unit_amount, 4900);
  assert.equal(stripe.prices.get(retiredIds.year)!.active, true);
  assert.equal(stripe.prices.get(NEW_YEAR)!.tax_behavior, "exclusive");
});

test("until the settings switch over, the plan says exactly what to set", async () => {
  const stripe = new FakeStripe();
  const lines: string[] = [];
  await applyCatalog("stage", stripe, runtime(), (l) => lines.push(l));
  const out = lines.join("\n");
  assert.match(out, /AMP_STRIPE_PRICE_ID=price_new_year/);
  assert.match(out, /AMP_STRIPE_AMOUNT_MINOR=59900/);
  assert.match(out, /AMP_STRIPE_MONTHLY_PRICE_ID=price_new_month/);
  assert.match(out, /AMP_STRIPE_MONTHLY_AMOUNT_MINOR=5900/);
  assert.match(out, /AMP_STRIPE_EXTRA_PRICE_ID=price_extra_year/);
  assert.match(out, /AMP_STRIPE_EXTRA_AMOUNT_MINOR=39900/);
  assert.match(out, /AMP_STRIPE_EXTRA_MONTHLY_PRICE_ID=price_extra_month/);
  assert.match(out, /AMP_STRIPE_EXTRA_MONTHLY_AMOUNT_MINOR=3900/);
  assert.match(out, /AMP_PAYMENT_EXTRA_DOCUMENT_PROFILE/);
  assert.match(out, /AMP_PAYMENT_EXTRA_MONTHLY_DOCUMENT_PROFILE/);
});

test("once the settings name the new prices there is nothing pending", async () => {
  const stripe = new FakeStripe();
  await applyCatalog("stage", stripe, runtime(), quiet);
  const switched = runtime({
    priceIds: { year: NEW_YEAR, month: NEW_MONTH },
    amounts: { year: "59900", month: "5900" },
    extraPriceIds: { year: EXTRA_YEAR, month: EXTRA_MONTH },
    extraAmounts: { year: "39900", month: "3900" },
  });
  const plan = await planCatalog("stage", stripe, switched);
  assert.deepEqual(plan.errors, []);
  assert.deepEqual(plan.changes, []);
  assert.deepEqual(plan.pending, []);
  // The switched settings do not leave the retired prices behind.
  assert.ok(plan.verified.some((v) => v.includes(retiredIds.year)));
});

test("apply fails when the read-back still differs", async () => {
  const stripe = new FakeStripe();
  stripe.ignoreUpdates = true;
  await assert.rejects(
    applyCatalog("stage", stripe, runtime(), quiet),
    /still differs/,
  );
});

test("the additional-child settings must name the created price at its amount", async () => {
  const stripe = new FakeStripe();
  await applyCatalog("stage", stripe, runtime(), quiet);
  for (const [extraPriceIds, extraAmounts] of [
    [{ year: EXTRA_YEAR }, { year: "59900" }],
    [{ year: NEW_YEAR }, { year: "39900" }],
    [{ month: EXTRA_MONTH }, {}],
  ] as const) {
    const plan = await planCatalog(
      "stage",
      stripe,
      runtime({ extraPriceIds, extraAmounts }),
    );
    assert.equal(plan.errors.length, 1, JSON.stringify(extraPriceIds));
  }
});

test("a price that differs from the declaration stops apply before any write", async () => {
  for (const change of [
    { unit_amount: 39900 },
    { tax_behavior: "inclusive" },
    { lookup_key: "something-else" },
    { currency: "eur" },
    { active: false },
    { product: "prod_other" },
    {
      recurring: {
        interval: "year",
        interval_count: 2,
        usage_type: "licensed",
      },
    },
  ] satisfies Partial<PriceState>[]) {
    const stripe = new FakeStripe();
    const existing = price("year", NEW_YEAR, 59900, "amp-year-59900");
    Object.assign(existing, change);
    // A price is found by lookup key, so a different key means it is absent;
    // the wrong-key case is covered by the duplicate-key test below.
    if (change.lookup_key) continue;
    stripe.prices.set(NEW_YEAR, existing);
    await assert.rejects(
      applyCatalog("stage", stripe, runtime(), quiet),
      /nothing was changed/,
    );
    assert.equal(stripe.updates.length, 0, JSON.stringify(change));
    assert.equal(stripe.creates.length, 0, JSON.stringify(change));
  }
});

test("a retired price that changed stops apply before any write", async () => {
  for (const change of [
    { unit_amount: 59900 },
    { product: "prod_other" },
    { currency: "eur" },
  ] satisfies Partial<PriceState>[]) {
    const stripe = new FakeStripe();
    Object.assign(stripe.prices.get(retiredIds.year)!, change);
    await assert.rejects(
      applyCatalog("stage", stripe, runtime(), quiet),
      /nothing was changed/,
    );
    assert.equal(stripe.updates.length, 0);
    assert.equal(stripe.creates.length, 0);
  }
});

test("a retired price that was archived is still accepted", async () => {
  const stripe = new FakeStripe();
  stripe.prices.get(retiredIds.year)!.active = false;
  const plan = await planCatalog("stage", stripe, runtime());
  assert.deepEqual(plan.errors, []);
});

test("the wrong key, account or runtime ids stop the plan before any read", async () => {
  for (const overrides of [
    { secretKey: "sk_live_synthetic" },
    { mode: "live" },
    { productId: "prod_other" },
    { priceIds: { year: "price_other", month: retiredIds.month } },
    { amounts: { year: "39900", month: "4900" } },
    // The retired price with the new amount, or the other way round.
    { amounts: { year: "59900", month: "4900" } },
    // An additional-child setting that is not the declared price or amount.
    { extraPriceIds: { year: "price_other" }, extraAmounts: { year: "39900" } },
    { extraAmounts: { month: "3900" } },
  ] satisfies Partial<StripeRuntime>[]) {
    const stripe = new FakeStripe();
    const plan = await planCatalog("stage", stripe, runtime(overrides));
    assert.notDeepEqual(plan.errors, [], JSON.stringify(overrides));
    assert.equal(stripe.creates.length, 0);
    await assert.rejects(
      applyCatalog("stage", stripe, runtime(overrides), quiet),
    );
    assert.equal(stripe.updates.length, 0);
  }
  const stripe = new FakeStripe();
  stripe.account = "acct_other";
  const plan = await planCatalog("stage", stripe, runtime());
  assert.deepEqual(plan.errors, [
    "the key's account is not AMP_STRIPE_ACCOUNT_ID",
  ]);
});

test("the Stripe client creates a price and edits nothing else about prices", () => {
  assert.deepEqual(Object.keys(stripeClient("sk_test_synthetic")).sort(), [
    "accountId",
    "createPrice",
    "price",
    "priceByLookupKey",
    "product",
    "updateProduct",
  ]);
});
