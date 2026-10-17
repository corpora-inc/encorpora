import type { StripeBillingConfig } from "../src/billing/stripe/config.js";
import type {
  AnnualPayment,
  CheckoutBinding,
} from "../src/billing/stripe/model.js";
export const config: StripeBillingConfig = {
  secretKey: "sk_test_fixture_not_a_credential",
  webhookSecret: "whsec_fixture_not_a_credential",
  accountId: "acct_fixture",
  livemode: false,
  productId: "prod_annual",
  priceId: "price_annual",
  currency: "usd",
  amountMinor: 12000,
  sku: "amp-annual-fixture",
  appOrigin: "https://example.test",
  portalConfigurationId: "bpc_fixture",
  automaticTax: false,
  consentPolicyVersion: "2026-01",
};
export const binding: CheckoutBinding = {
  id: "3393a4c0-635f-4910-b9c7-62f354fc6640",
  accountId: "parent",
  learnerId: "child",
  customerId: "cus_fixture",
  createdAt: new Date("2020-01-01"),
};
export const payment: AnnualPayment = {
  invoiceId: "in_fixture",
  subscriptionId: "sub_fixture",
  customerId: binding.customerId,
  checkoutId: binding.id,
  priceId: config.priceId,
  productId: config.productId,
  currency: config.currency,
  subtotal: 12000,
  paid: 12000,
  periodStart: 1577836800,
  periodEnd: 1609459200,
  paidAt: 1577836800,
  chargeId: "ch_fixture",
};
export function remoteFixtures() {
  return {
    account: { id: config.accountId },
    price: {
      active: true,
      livemode: false,
      currency: "usd",
      unit_amount: 12000,
      billing_scheme: "per_unit",
      transform_quantity: null,
      recurring: {
        interval: "year",
        interval_count: 1,
        usage_type: "licensed",
      },
      product: { id: config.productId, active: true },
    },
    portal: {
      active: true,
      livemode: false,
      features: {
        subscription_cancel: { enabled: true, mode: "at_period_end" },
        subscription_update: { enabled: false },
      },
    },
    invoice: {
      id: payment.invoiceId,
      livemode: false,
      status: "paid",
      parent: {
        subscription_details: { subscription: payment.subscriptionId },
      },
      customer: binding.customerId,
      collection_method: "charge_automatically",
      amount_remaining: 0,
      amount_paid: 12000,
      total: 12000,
      subtotal: 12000,
      currency: "usd",
      discounts: [],
      total_discount_amounts: [],
      total_pretax_credit_amounts: [],
      status_transitions: { paid_at: payment.paidAt },
    },
    lines: {
      has_more: false,
      data: [
        {
          quantity: 1,
          quantity_decimal: "1",
          subtotal: 12000,
          currency: "usd",
          parent: {
            subscription_item_details: {
              proration: false,
              subscription: payment.subscriptionId,
            },
          },
          pricing: {
            price_details: { price: config.priceId, product: config.productId },
          },
          period: { start: payment.periodStart, end: payment.periodEnd },
        },
      ],
    },
    subscription: {
      livemode: false,
      customer: binding.customerId,
      metadata: { amp_checkout_id: binding.id },
    },
    payments: {
      has_more: false,
      data: [
        {
          invoice: payment.invoiceId,
          livemode: false,
          amount_paid: 12000,
          currency: "usd",
          payment: { type: "payment_intent", payment_intent: "pi_fixture" },
        },
      ],
    },
    intent: {
      status: "succeeded",
      livemode: false,
      amount_received: 12000,
      currency: "usd",
      customer: binding.customerId,
      latest_charge: "ch_fixture",
    },
    charge: {
      id: "ch_fixture",
      livemode: false,
      paid: true,
      captured: true,
      amount: 12000,
      currency: "usd",
      customer: binding.customerId,
      payment_intent: "pi_fixture",
    },
    refunds: {
      has_more: false,
      data: [] as { status: string; amount: number; created: number }[],
    },
  };
}
