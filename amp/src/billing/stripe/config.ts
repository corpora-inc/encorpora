import type { DocumentProfile } from "../evidence/contracts.js";
import { parseDocumentProfile } from "../evidence/profile.js";
/** No billing defaults: every merchant, catalog and redirect boundary is explicit. */
export interface StripeBillingConfig {
  documentProfile?: DocumentProfile;
  monthlyDocumentProfile?: DocumentProfile;
  monthlyPriceId?: string;
  monthlyAmountMinor?: number;
  secretKey: string;
  webhookSecret: string;
  accountId: string;
  livemode: boolean;
  productId: string;
  priceId: string;
  currency: string;
  amountMinor: number;
  sku: string;
  appOrigin: string;
  portalConfigurationId: string;
  automaticTax: boolean;
  consentPolicyVersion: string;
}
export class BillingError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode = 409,
  ) {
    super(code);
  }
}
export function stripeConfig(
  env: NodeJS.ProcessEnv,
): StripeBillingConfig | undefined {
  if (env.AMP_STRIPE_ENABLED !== "true") return undefined;
  function required(name: string): string {
    const value = env[name];
    if (!value || value.trim() !== value)
      throw new Error(`Missing or invalid ${name}`);
    return value;
  }
  const mode = required("AMP_STRIPE_MODE");
  if (mode !== "test" && mode !== "live")
    throw new Error("AMP_STRIPE_MODE must be test or live");
  if (mode === "live" && env.AMP_STRIPE_LIVE_APPROVED !== "true")
    throw new Error(
      "Live Stripe billing requires explicit operational approval",
    );
  const secretKey = required("AMP_STRIPE_SECRET_KEY");
  if (!secretKey.startsWith(mode === "live" ? "sk_live_" : "sk_test_"))
    throw new Error("Stripe key mode mismatch");
  const appOrigin = required("AMP_STRIPE_APP_ORIGIN");
  const origin = new URL(appOrigin);
  if (
    origin.origin !== appOrigin ||
    origin.username ||
    origin.password ||
    (origin.protocol !== "https:" &&
      !(
        mode === "test" &&
        origin.protocol === "http:" &&
        origin.hostname === "127.0.0.1"
      ))
  )
    throw new Error(
      "Stripe app origin must be an HTTPS origin (loopback HTTP permitted in test mode)",
    );
  const amountMinor = Number(required("AMP_STRIPE_AMOUNT_MINOR"));
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0)
    throw new Error("Invalid Stripe annual price amount");
  const currency = required("AMP_STRIPE_CURRENCY");
  if (!/^[a-z]{3}$/.test(currency)) throw new Error("Invalid Stripe currency");
  const accountId = required("AMP_STRIPE_ACCOUNT_ID");
  const productId = required("AMP_STRIPE_PRODUCT_ID");
  const priceId = required("AMP_STRIPE_PRICE_ID");
  const portalConfigurationId = required("AMP_STRIPE_PORTAL_CONFIGURATION_ID");
  const webhookSecret = required("AMP_STRIPE_WEBHOOK_SECRET");
  if (
    !accountId.startsWith("acct_") ||
    !productId.startsWith("prod_") ||
    !priceId.startsWith("price_") ||
    !portalConfigurationId.startsWith("bpc_") ||
    !webhookSecret.startsWith("whsec_")
  )
    throw new Error("Invalid Stripe resource configuration");
  const tax = required("AMP_STRIPE_AUTOMATIC_TAX");
  if (tax !== "true" && tax !== "false")
    throw new Error("Explicit Stripe tax setting required");
  const config: StripeBillingConfig = {
    secretKey,
    webhookSecret,
    accountId,
    livemode: mode === "live",
    productId,
    priceId,
    currency,
    amountMinor,
    sku: required("AMP_STRIPE_SKU"),
    appOrigin,
    portalConfigurationId,
    automaticTax: tax === "true",
    consentPolicyVersion: required("AMP_STRIPE_CONSENT_POLICY_VERSION"),
  };
  if (env.AMP_STRIPE_MONTHLY_PRICE_ID || env.AMP_STRIPE_MONTHLY_AMOUNT_MINOR) {
    config.monthlyPriceId = required("AMP_STRIPE_MONTHLY_PRICE_ID");
    config.monthlyAmountMinor = Number(
      required("AMP_STRIPE_MONTHLY_AMOUNT_MINOR"),
    );
    if (
      !config.monthlyPriceId.startsWith("price_") ||
      config.monthlyPriceId === priceId ||
      !Number.isSafeInteger(config.monthlyAmountMinor) ||
      config.monthlyAmountMinor <= 0
    )
      throw new Error("Invalid Stripe monthly price configuration");
  }
  if (config.monthlyPriceId && !env.AMP_PAYMENT_MONTHLY_DOCUMENT_PROFILE)
    throw new Error(
      "Monthly billing requires AMP_PAYMENT_MONTHLY_DOCUMENT_PROFILE",
    );
  if (env.AMP_PAYMENT_MONTHLY_DOCUMENT_PROFILE)
    config.monthlyDocumentProfile = parseDocumentProfile(
      JSON.parse(env.AMP_PAYMENT_MONTHLY_DOCUMENT_PROFILE),
      planConfig(config, "month"),
    );
  if (env.AMP_PAYMENT_DOCUMENT_PROFILE)
    config.documentProfile = parseDocumentProfile(
      JSON.parse(env.AMP_PAYMENT_DOCUMENT_PROFILE),
      config,
    );
  return config;
}
export function stripeNamespace(config: StripeBillingConfig): string {
  return `${config.accountId}:${config.livemode ? "live" : "test"}`;
}

export type BillingInterval = "year" | "month";
/** Selected catalog identity; the annual environment remains backwards compatible. */
export function planConfig(
  config: StripeBillingConfig,
  interval: BillingInterval = "year",
): StripeBillingConfig {
  if (interval === "year") return config;
  if (
    !config.monthlyPriceId ||
    !Number.isSafeInteger(config.monthlyAmountMinor) ||
    config.monthlyAmountMinor! <= 0
  )
    throw new BillingError("monthly_plan_unavailable", 503);
  return {
    ...config,
    priceId: config.monthlyPriceId,
    amountMinor: config.monthlyAmountMinor!,
    documentProfile: config.monthlyDocumentProfile,
  };
}
