import assert from "node:assert/strict";
import { test } from "node:test";
import { brand } from "../src/brand.ts";
import { environments } from "../infra/environments.ts";
import { stripeCatalog } from "../infra/stripe.ts";
import {
  applyCatalog,
  formatDesired,
  planCatalog,
  type CatalogClient,
  type PriceState,
  type ProductState,
  type ProductUpdate,
  type StripeRuntime,
  stripeClient,
} from "../infra/stripe-sync.ts";

const stage = environments.stage.stripe;
const ACCOUNT = "acct_synthetic";

function runtime(overrides: Partial<StripeRuntime> = {}): StripeRuntime {
  return {
    mode: "test",
    secretKey: "sk_test_synthetic",
    accountId: ACCOUNT,
    productId: stage.productId,
    priceIds: { ...stage.priceIds },
    amounts: { year: "49900", month: "4900" },
    currency: "usd",
    ...overrides,
  };
}

function price(interval: "year" | "month", id: string): PriceState {
  return {
    id,
    product: stage.productId,
    active: true,
    livemode: false,
    currency: "usd",
    unit_amount: interval === "year" ? 49900 : 4900,
    type: "recurring",
    billing_scheme: "per_unit",
    recurring: { interval, interval_count: 1, usage_type: "licensed" },
  };
}

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
  prices = new Map<string, PriceState>([
    [stage.priceIds.year, price("year", stage.priceIds.year)],
    [stage.priceIds.month, price("month", stage.priceIds.month)],
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

test("AMP sells $499 a year and $49 a month in every environment", () => {
  assert.deepEqual(stripeCatalog.prices, {
    year: { unitAmount: 49900, currency: "usd", interval: "year" },
    month: { unitAmount: 4900, currency: "usd", interval: "month" },
  });
  assert.equal(environments.stage.stripe.mode, "test");
  assert.equal(environments.prod.stripe.mode, "live");
  for (const env of Object.values(environments)) {
    assert.match(env.stripe.productId, /^prod_[A-Za-z0-9]+$/);
    for (const id of Object.values(env.stripe.priceIds))
      assert.match(id, /^price_[A-Za-z0-9]+$/);
  }
});

test("the desired state prints without credentials", () => {
  const text = formatDesired();
  assert.ok(text.includes(brand.checkout.name));
  assert.ok(text.includes(environments.prod.stripe.priceIds.year));
  assert.doesNotMatch(text, /sk_|rk_|acct_/);
});

test("plan lists text differences and verifies the prices", async () => {
  const stripe = new FakeStripe();
  const plan = await planCatalog("stage", stripe, runtime());
  assert.deepEqual(plan.errors, []);
  assert.deepEqual(
    plan.changes.map((c) => c.field),
    [
      "name",
      "description",
      "statement_descriptor",
      "tax_code",
      "metadata.managed_by",
    ],
  );
  assert.equal(plan.verified.length, 2);
  assert.equal(stripe.updates.length, 0);
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
});

test("apply fails when the read-back still differs", async () => {
  const stripe = new FakeStripe();
  stripe.ignoreUpdates = true;
  await assert.rejects(
    applyCatalog("stage", stripe, runtime(), quiet),
    /still differs/,
  );
});

test("a price that differs from the declaration stops apply before any write", async () => {
  for (const change of [
    { unit_amount: 39900 },
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
    Object.assign(stripe.prices.get(stage.priceIds.year)!, change);
    await assert.rejects(
      applyCatalog("stage", stripe, runtime(), quiet),
      /nothing was changed/,
    );
    assert.equal(stripe.updates.length, 0, JSON.stringify(change));
  }
});

test("the wrong key, account or runtime ids stop the plan before any read", async () => {
  for (const overrides of [
    { secretKey: "sk_live_synthetic" },
    { mode: "live" },
    { productId: "prod_other" },
    { priceIds: { year: "price_other", month: stage.priceIds.month } },
    { amounts: { year: "39900", month: "4900" } },
  ] satisfies Partial<StripeRuntime>[]) {
    const stripe = new FakeStripe();
    const plan = await planCatalog("stage", stripe, runtime(overrides));
    assert.notDeepEqual(plan.errors, [], JSON.stringify(overrides));
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

test("the Stripe client exposes no price or subscription write", () => {
  assert.deepEqual(Object.keys(stripeClient("sk_test_synthetic")).sort(), [
    "accountId",
    "price",
    "product",
    "updateProduct",
  ]);
});
