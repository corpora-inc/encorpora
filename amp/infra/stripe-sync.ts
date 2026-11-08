/**
 * Plan and apply for AMP's Stripe catalog (infra/stripe.ts). A plan reads the
 * environment's account, product and prices and lists every difference; apply
 * updates the product's declared fields and creates a declared price that does
 * not exist yet, then reads back and requires an empty plan. A price is found by
 * its lookup key and is never edited, activated or archived: a price that
 * differs from the declaration is an error that stops the run before any write.
 * The retired prices that existing subscriptions renew on are only verified.
 */
import { createHash } from "node:crypto";
import Stripe from "stripe";
import {
  environments,
  type EnvironmentName,
  type StripeEnvironment,
} from "./environments.ts";
import { retiredPrices } from "../src/billing/stripe/retired-prices.ts";
import { stripeCatalog, type DeclaredPrice } from "./stripe.ts";

export interface ProductState {
  id: string;
  active: boolean;
  livemode: boolean;
  name: string;
  description: string | null;
  statement_descriptor: string | null;
  tax_code: string | null;
  metadata: Record<string, string>;
}

export interface PriceState {
  id: string;
  product: string;
  active: boolean;
  livemode: boolean;
  currency: string;
  unit_amount: number | null;
  lookup_key: string | null;
  tax_behavior: string | null;
  type: string;
  billing_scheme: string;
  recurring: {
    interval: string;
    interval_count: number;
    usage_type: string;
  } | null;
}

export interface ProductUpdate {
  name?: string;
  description?: string;
  statement_descriptor?: string;
  tax_code?: string;
  metadata?: Record<string, string>;
}

/** A recurring price to create: tax-exclusive, found afterwards by `lookupKey`. */
export interface NewPrice {
  product: string;
  currency: string;
  unitAmount: number;
  interval: "year" | "month";
  lookupKey: string;
}

/**
 * The only Stripe calls the tooling makes. The one price write creates a
 * declared price; there is no edit, activation or archive.
 */
export interface CatalogClient {
  accountId(): Promise<string>;
  product(id: string): Promise<ProductState>;
  price(id: string): Promise<PriceState>;
  priceByLookupKey(key: string): Promise<PriceState | null>;
  createPrice(price: NewPrice, idempotencyKey: string): Promise<PriceState>;
  updateProduct(
    id: string,
    update: ProductUpdate,
    idempotencyKey: string,
  ): Promise<void>;
}

/** The AMP_STRIPE_* values the API itself runs with. */
export interface StripeRuntime {
  mode: string;
  secretKey: string;
  accountId: string;
  productId: string;
  priceIds: { year: string; month: string };
  amounts: { year: string; month: string };
  currency: string;
}

export function stripeRuntime(env: NodeJS.ProcessEnv): StripeRuntime {
  const required = (name: string) => {
    const value = env[name];
    if (!value) throw new Error(`${name} is not set`);
    return value;
  };
  return {
    mode: required("AMP_STRIPE_MODE"),
    secretKey: required("AMP_STRIPE_SECRET_KEY"),
    accountId: required("AMP_STRIPE_ACCOUNT_ID"),
    productId: required("AMP_STRIPE_PRODUCT_ID"),
    priceIds: {
      year: required("AMP_STRIPE_PRICE_ID"),
      month: required("AMP_STRIPE_MONTHLY_PRICE_ID"),
    },
    amounts: {
      year: required("AMP_STRIPE_AMOUNT_MINOR"),
      month: required("AMP_STRIPE_MONTHLY_AMOUNT_MINOR"),
    },
    currency: required("AMP_STRIPE_CURRENCY"),
  };
}

export interface Change {
  field: string;
  from: string | null;
  to: string;
}

export interface CatalogPlan {
  environment: EnvironmentName;
  mode: StripeEnvironment["mode"];
  productId: string;
  changes: Change[];
  update: ProductUpdate;
  /** Declared prices that do not exist yet; apply creates them. */
  creates: NewPrice[];
  verified: string[];
  /** Settings the environment still has to change; not an error. */
  pending: string[];
  errors: string[];
}

const intervals = ["year", "month"] as const;

/**
 * The environment's runtime settings must name the declared account, mode and
 * product. Its price ids and amounts are checked against the live prices in
 * planCatalog, because the price being sold is found by its lookup key.
 */
export function runtimeErrors(
  declared: StripeEnvironment,
  runtime: StripeRuntime,
): string[] {
  const errors: string[] = [];
  const expect = (what: string, actual: string, wanted: string) => {
    if (actual !== wanted)
      errors.push(`${what} is "${actual}", declared "${wanted}"`);
  };
  expect("AMP_STRIPE_MODE", runtime.mode, declared.mode);
  const keyMode = /^(sk|rk)_(test|live)_/.exec(runtime.secretKey)?.[2];
  if (keyMode !== declared.mode)
    errors.push(
      `AMP_STRIPE_SECRET_KEY is not a ${declared.mode}-mode key (sk_${declared.mode}_ or rk_${declared.mode}_)`,
    );
  expect("AMP_STRIPE_PRODUCT_ID", runtime.productId, declared.productId);
  const { year } = stripeCatalog.prices;
  expect("AMP_STRIPE_CURRENCY", runtime.currency, year.currency);
  return errors;
}

function priceErrors(
  price: PriceState,
  declared: Omit<DeclaredPrice, "lookupKey"> & { lookupKey?: string },
  productId: string,
  livemode: boolean,
  retired = false,
): string[] {
  const errors: string[] = [];
  const check = (ok: boolean, what: string) => {
    if (!ok) errors.push(`price ${price.id} (${declared.interval}): ${what}`);
  };
  check(price.product === productId, `belongs to ${price.product}`);
  // A retired price stays valid for the subscriptions that renew on it, even
  // if it is archived; only a price being sold must be active.
  check(retired || price.active, "is not active");
  if (declared.lookupKey)
    check(
      price.lookup_key === declared.lookupKey,
      `lookup key ${price.lookup_key}, declared ${declared.lookupKey}`,
    );
  check(
    retired || price.tax_behavior === "exclusive",
    `tax behavior ${price.tax_behavior}, declared exclusive`,
  );
  check(price.livemode === livemode, "is in the wrong mode");
  check(
    price.currency === declared.currency,
    `currency ${price.currency}, declared ${declared.currency}`,
  );
  check(
    price.unit_amount === declared.unitAmount,
    `amount ${price.unit_amount}, declared ${declared.unitAmount}`,
  );
  check(
    price.type === "recurring" && price.billing_scheme === "per_unit",
    "is not a per-unit recurring price",
  );
  check(
    price.recurring?.interval === declared.interval &&
      price.recurring.interval_count === 1 &&
      price.recurring.usage_type === "licensed",
    `bills ${price.recurring?.interval_count ?? "?"} ${price.recurring?.interval ?? "?"} (${price.recurring?.usage_type ?? "?"}), declared 1 ${declared.interval} (licensed)`,
  );
  return errors;
}

export async function planCatalog(
  environment: EnvironmentName,
  client: CatalogClient,
  runtime: StripeRuntime,
): Promise<CatalogPlan> {
  const declared = environments[environment].stripe;
  const plan: CatalogPlan = {
    environment,
    mode: declared.mode,
    productId: declared.productId,
    changes: [],
    update: {},
    creates: [],
    verified: [],
    pending: [],
    errors: runtimeErrors(declared, runtime),
  };
  // A key or object mismatch means this is not the environment's catalog:
  // nothing else is read, and apply writes nothing.
  if (plan.errors.length) return plan;
  if ((await client.accountId()) !== runtime.accountId) {
    plan.errors.push("the key's account is not AMP_STRIPE_ACCOUNT_ID");
    return plan;
  }
  const livemode = declared.mode === "live";
  const product = await client.product(declared.productId);
  if (!product.active) plan.errors.push(`product ${product.id} is not active`);
  if (product.livemode !== livemode)
    plan.errors.push(`product ${product.id} is in the wrong mode`);
  for (const interval of intervals) {
    const want = stripeCatalog.prices[interval];
    const retiredId = declared.retiredPriceIds[interval];
    const retiredWant = retiredPrices.find((p) => p.priceId === retiredId)!;
    const retired = await client.price(retiredId);
    plan.errors.push(
      ...priceErrors(
        retired,
        {
          unitAmount: retiredWant.amountMinor,
          currency: want.currency,
          interval,
        },
        declared.productId,
        livemode,
        true,
      ),
    );
    plan.verified.push(
      `price ${retired.id}: retired ${retiredWant.amountMinor} ${want.currency} per ${interval}, kept for existing subscriptions`,
    );
    const price = await client.priceByLookupKey(want.lookupKey);
    if (price) {
      const errors = priceErrors(price, want, declared.productId, livemode);
      plan.errors.push(...errors);
      if (!errors.length)
        plan.verified.push(
          `price ${price.id}: ${want.unitAmount} ${want.currency} per ${want.interval}, active`,
        );
    } else {
      const create: NewPrice = {
        product: declared.productId,
        currency: want.currency,
        unitAmount: want.unitAmount,
        interval,
        lookupKey: want.lookupKey,
      };
      plan.creates.push(create);
      plan.changes.push({
        field: `price.${interval}`,
        from: null,
        to: `${want.unitAmount} ${want.currency} per ${interval}, lookup key ${want.lookupKey}`,
      });
    }
    // The API sells what its settings name: the new price once switched over,
    // the retired one until then. Anything else is a different catalog.
    const setting =
      interval === "year"
        ? "AMP_STRIPE_PRICE_ID"
        : "AMP_STRIPE_MONTHLY_PRICE_ID";
    const amountSetting =
      interval === "year"
        ? "AMP_STRIPE_AMOUNT_MINOR"
        : "AMP_STRIPE_MONTHLY_AMOUNT_MINOR";
    const set = runtime.priceIds[interval];
    const amount = runtime.amounts[interval];
    if (price && set === price.id) {
      if (amount !== `${want.unitAmount}`)
        plan.errors.push(
          `${amountSetting} is "${amount}", declared "${want.unitAmount}"`,
        );
    } else if (set === retiredId) {
      if (amount !== `${retiredWant.amountMinor}`)
        plan.errors.push(
          `${amountSetting} is "${amount}", declared "${retiredWant.amountMinor}"`,
        );
      plan.pending.push(
        `${interval}: still selling the retired price. Set ${setting}=${price?.id ?? "(the new price's id)"} and ${amountSetting}=${want.unitAmount}${interval === "year" ? " (and AMP_PAYMENT_DOCUMENT_PROFILE)" : " (and AMP_PAYMENT_MONTHLY_DOCUMENT_PROFILE)"}`,
      );
    } else {
      plan.errors.push(
        `${setting} is "${set}", declared "${price?.id ?? "(the new price)"}" or the retired "${retiredId}"`,
      );
    }
  }

  const want = stripeCatalog.product;
  for (const field of [
    "name",
    "description",
    "statement_descriptor",
    "tax_code",
  ] as const) {
    if (product[field] !== want[field]) {
      plan.changes.push({ field, from: product[field], to: want[field] });
      plan.update[field] = want[field];
    }
  }
  for (const [key, value] of Object.entries(want.metadata)) {
    if (product.metadata[key] !== value) {
      plan.changes.push({
        field: `metadata.${key}`,
        from: product.metadata[key] ?? null,
        to: value,
      });
      plan.update.metadata = { ...plan.update.metadata, [key]: value };
    }
  }
  return plan;
}

/** Same change, same key: a retried apply never makes a second update. */
export function idempotencyKey(productId: string, update: ProductUpdate) {
  const digest = createHash("sha256")
    .update(JSON.stringify([productId, update]))
    .digest("hex");
  return `amp-catalog-${digest.slice(0, 40)}`;
}

export async function applyCatalog(
  environment: EnvironmentName,
  client: CatalogClient,
  runtime: StripeRuntime,
  log: (line: string) => void = console.log,
): Promise<CatalogPlan> {
  const plan = await planCatalog(environment, client, runtime);
  log(formatPlan(plan));
  if (plan.errors.length)
    throw new Error("The Stripe catalog plan has errors; nothing was changed.");
  if (!plan.changes.length) return plan;
  if (Object.keys(plan.update).length)
    await client.updateProduct(
      plan.productId,
      plan.update,
      idempotencyKey(plan.productId, plan.update),
    );
  for (const create of plan.creates)
    await client.createPrice(create, `amp-price-${create.lookupKey}`);
  const after = await planCatalog(environment, client, runtime);
  if (after.errors.length || after.changes.length) {
    log(formatPlan(after));
    throw new Error(
      "The catalog still differs from its declaration after apply.",
    );
  }
  log(`Applied ${plan.changes.length} change(s); the catalog now matches.`);
  for (const line of after.pending) log(`  > ${line}`);
  return plan;
}

const show = (value: string | null) =>
  value === null ? "(unset)" : JSON.stringify(value);

export function formatPlan(plan: CatalogPlan): string {
  const lines = [
    `Stripe catalog: ${plan.environment} (${plan.mode} mode), product ${plan.productId}`,
  ];
  for (const error of plan.errors) lines.push(`  ! ${error}`);
  for (const c of plan.changes)
    lines.push(
      c.field.startsWith("price.")
        ? `  + ${c.field}: create ${c.to}`
        : `  ~ ${c.field}: ${show(c.from)} -> ${show(c.to)}`,
    );
  for (const v of plan.verified)
    lines.push(`  = ${v} (verified, never changed)`);
  for (const line of plan.pending) lines.push(`  > ${line}`);
  lines.push(
    plan.errors.length
      ? `${plan.errors.length} error(s): apply refuses to run.`
      : plan.changes.length
        ? `${plan.changes.length} change(s) to apply.`
        : "No changes: the product matches the catalog.",
  );
  return lines.join("\n");
}

/** The desired state, printed without credentials (plan on a pull request). */
export function formatDesired(): string {
  const lines = ["Stripe catalog (desired):"];
  for (const [field, value] of Object.entries(stripeCatalog.product))
    lines.push(`  ${field}: ${JSON.stringify(value)}`);
  for (const [name, env] of Object.entries(environments)) {
    lines.push(
      `  ${name}: ${env.stripe.mode} mode, product ${env.stripe.productId}`,
    );
    for (const interval of intervals) {
      const p = stripeCatalog.prices[interval];
      lines.push(
        `    ${interval}: ${p.unitAmount} ${p.currency} per ${p.interval}, lookup key ${p.lookupKey} (created if missing)`,
        `    ${interval}: ${env.stripe.retiredPriceIds[interval]} retired, kept for existing subscriptions (verified only)`,
      );
    }
  }
  return lines.join("\n");
}

function priceState(p: Stripe.Price): PriceState {
  return {
    id: p.id,
    product: typeof p.product === "string" ? p.product : p.product.id,
    active: p.active,
    livemode: p.livemode,
    currency: p.currency,
    unit_amount: p.unit_amount,
    lookup_key: p.lookup_key,
    tax_behavior: p.tax_behavior ?? null,
    type: p.type,
    billing_scheme: p.billing_scheme,
    recurring: p.recurring && {
      interval: p.recurring.interval,
      interval_count: p.recurring.interval_count,
      usage_type: p.recurring.usage_type,
    },
  };
}

export function stripeClient(secretKey: string): CatalogClient {
  const stripe = new Stripe(secretKey, {
    apiVersion: "2026-09-30.endive",
    timeout: 10_000,
    maxNetworkRetries: 2,
  });
  const permission = (error: unknown): never => {
    if (error instanceof Stripe.errors.StripePermissionError)
      throw new Error(
        "The Stripe key may not update products. Give the environment's key Products: write (docs/external-config.md).",
      );
    throw error;
  };
  return {
    async accountId() {
      return (await stripe.accounts.retrieve(null)).id;
    },
    async product(id) {
      const p = await stripe.products.retrieve(id);
      return {
        id: p.id,
        active: p.active,
        livemode: p.livemode,
        name: p.name,
        description: p.description,
        statement_descriptor: p.statement_descriptor ?? null,
        tax_code:
          typeof p.tax_code === "string"
            ? p.tax_code
            : (p.tax_code?.id ?? null),
        metadata: p.metadata,
      };
    },
    async price(id) {
      return priceState(await stripe.prices.retrieve(id));
    },
    async priceByLookupKey(key) {
      const found = await stripe.prices.list({ lookup_keys: [key], limit: 2 });
      if (found.data.length > 1)
        throw new Error(`lookup key ${key} matches more than one price`);
      return found.data[0] ? priceState(found.data[0]) : null;
    },
    async createPrice(input, idempotencyKey) {
      return priceState(
        await stripe.prices
          .create(
            {
              product: input.product,
              currency: input.currency,
              unit_amount: input.unitAmount,
              recurring: { interval: input.interval },
              lookup_key: input.lookupKey,
              tax_behavior: "exclusive",
              nickname: `AMP ${input.interval === "year" ? "annual" : "monthly"}`,
            },
            { idempotencyKey },
          )
          .catch(permission),
      );
    },
    async updateProduct(id, update, idempotencyKey) {
      await stripe.products
        .update(id, update, { idempotencyKey })
        .catch(permission);
    },
  };
}
