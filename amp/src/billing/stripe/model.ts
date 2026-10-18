import type { CommerceEvent } from "../../commerce/contracts.js";
import {
  BillingError,
  planConfig,
  type BillingInterval,
  stripeNamespace,
  type StripeBillingConfig,
} from "./config.js";
export interface CheckoutBinding {
  id: string;
  accountId: string;
  learnerId: string;
  customerId: string;
  subscriptionId?: string;
  sessionId?: string;
  createdAt: Date;
  interval?: BillingInterval;
}
/** Authoritative evidence normalized by the Stripe gateway, never browser input. */
export interface AnnualPayment {
  invoiceId: string;
  subscriptionId: string;
  customerId: string;
  checkoutId: string;
  priceId: string;
  productId: string;
  currency: string;
  subtotal: number;
  paid: number;
  periodStart: number;
  periodEnd: number;
  paidAt: number;
  chargeId: string;
  fullRefundAt?: number;
}
export function annualEvents(
  config: StripeBillingConfig,
  binding: CheckoutBinding,
  payment: AnnualPayment,
): CommerceEvent[] {
  const p = payment;
  const interval = binding.interval ?? "year";
  config = planConfig(config, interval);
  if (
    p.customerId !== binding.customerId ||
    p.checkoutId !== binding.id ||
    (binding.subscriptionId && p.subscriptionId !== binding.subscriptionId) ||
    p.priceId !== config.priceId ||
    p.productId !== config.productId ||
    p.currency !== config.currency ||
    p.subtotal !== config.amountMinor ||
    !Number.isSafeInteger(p.paid) ||
    p.paid < p.subtotal
  )
    throw new BillingError("payment_mapping_mismatch");
  const duration = p.periodEnd - p.periodStart;
  if (
    !(interval === "year" ? [365, 366] : [28, 29, 30, 31])
      .map((days) => days * 86400)
      .includes(duration) ||
    !Number.isSafeInteger(p.paidAt) ||
    p.paidAt < p.periodStart
  )
    throw new BillingError(
      interval === "year" ? "invalid_annual_term" : "invalid_monthly_term",
    );
  const instant = (seconds: number) => new Date(seconds * 1000).toISOString();
  const namespace = stripeNamespace(config);
  const orderId = `stripe:${namespace}:${p.invoiceId}`;
  const base = {
    channel: "stripe" as const,
    channelReference: namespace,
    orderId,
    occurredAt: instant(p.paidAt),
  };
  const envelope = (suffix: string) => ({
    ...base,
    id: `${p.invoiceId}:${suffix}`,
  });
  const evidence = `stripe:invoice:${p.invoiceId}:charge:${p.chargeId}`;
  const events: CommerceEvent[] = [
    {
      ...envelope("created"),
      type: "order.created",
      order: {
        id: orderId,
        account: { id: binding.accountId },
        license: {
          learnerId: binding.learnerId,
          accountId: binding.accountId,
          sku: config.sku,
          startsAt: instant(p.periodStart),
          endsAt: instant(p.periodEnd),
        },
        channel: "stripe",
        channelReference: namespace,
        externalOrderId: p.invoiceId,
        currency: p.currency.toUpperCase(),
        amountMinor: p.paid,
        activationPolicy: "after-settlement",
      },
    },
    { ...envelope("approved"), type: "order.approved", evidence },
    {
      ...envelope("settled"),
      type: "order.settled",
      amountMinor: p.paid,
      currency: p.currency.toUpperCase(),
      evidence,
    },
    { ...envelope("fulfilled"), type: "order.fulfilled", evidence },
  ];
  if (p.fullRefundAt !== undefined) {
    if (p.fullRefundAt < p.paidAt)
      throw new BillingError("invalid_refund_time");
    events.push({
      ...envelope("refunded"),
      occurredAt: instant(p.fullRefundAt),
      type: "refund.completed",
      amountMinor: p.paid,
      currency: p.currency.toUpperCase(),
      evidence,
    });
  } else if (p.paidAt < p.periodEnd)
    events.push({
      ...envelope("activated"),
      type: "license.activated",
      evidence,
    });
  return events;
}
