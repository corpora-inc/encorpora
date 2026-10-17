import Stripe from "stripe";
import { BillingError, type StripeBillingConfig } from "./config.js";
import type { AnnualPayment } from "./model.js";
const id = (
  value: string | { id: string } | null | undefined,
): string | undefined => (typeof value === "string" ? value : value?.id);
function requireEvidence(condition: unknown, code: string): asserts condition {
  if (!condition) throw new BillingError(code);
}
/** All remote calls have bounded time and retry budgets; no Connect impersonation. */
export class StripeGateway {
  readonly client: Stripe;
  constructor(
    readonly config: StripeBillingConfig,
    client?: Stripe,
  ) {
    this.client =
      client ??
      new Stripe(config.secretKey, {
        apiVersion: "2026-09-30.endive",
        timeout: 10_000,
        maxNetworkRetries: 1,
      });
  }
  async verifyMerchant(): Promise<void> {
    const account = await this.client.accounts.retrieve(null);
    requireEvidence(
      account.id === this.config.accountId,
      "merchant_account_mismatch",
    );
  }
  async verifyPortal(): Promise<void> {
    await this.verifyMerchant();
    const portal = await this.client.billingPortal.configurations.retrieve(
      this.config.portalConfigurationId,
    );
    requireEvidence(
      portal.active &&
        portal.livemode === this.config.livemode &&
        portal.features.subscription_cancel.enabled &&
        portal.features.subscription_cancel.mode === "at_period_end" &&
        !portal.features.subscription_update.enabled,
      "unsafe_portal_configuration",
    );
  }
  async verifyCatalog(): Promise<void> {
    await this.verifyPortal();
    const price = await this.client.prices.retrieve(this.config.priceId, {
      expand: ["product"],
    });
    const product = price.product;
    requireEvidence(
      price.active &&
        price.livemode === this.config.livemode &&
        price.currency === this.config.currency &&
        price.unit_amount === this.config.amountMinor &&
        price.billing_scheme === "per_unit" &&
        !price.transform_quantity &&
        price.recurring?.interval === "year" &&
        price.recurring.interval_count === 1 &&
        price.recurring.usage_type === "licensed" &&
        typeof product !== "string" &&
        !product.deleted &&
        product.active &&
        product.id === this.config.productId,
      "annual_catalog_mismatch",
    );
  }
  async createCustomer(reservationId: string): Promise<string> {
    const customer = await this.client.customers.create(
      {},
      { idempotencyKey: `amp:customer:${reservationId}` },
    );
    requireEvidence(
      customer.livemode === this.config.livemode,
      "customer_mode_mismatch",
    );
    return customer.id;
  }
  async createCheckout(
    checkoutId: string,
    customerId: string,
  ): Promise<{ id: string; url: string }> {
    const session = await this.client.checkout.sessions.create(
      {
        mode: "subscription",
        customer: customerId,
        client_reference_id: checkoutId,
        metadata: { amp_checkout_id: checkoutId },
        subscription_data: { metadata: { amp_checkout_id: checkoutId } },
        line_items: [{ price: this.config.priceId, quantity: 1 }],
        allow_promotion_codes: false,
        allowed_payment_method_types: ["card"],
        automatic_tax: { enabled: this.config.automaticTax },
        customer_update: { address: "auto" },
        success_url: `${this.config.appOrigin}/?billing=processing&purchase=${encodeURIComponent(checkoutId)}`,
        cancel_url: `${this.config.appOrigin}/?billing=canceled&purchase=${encodeURIComponent(checkoutId)}`,
      },
      { idempotencyKey: `amp:checkout:${checkoutId}` },
    );
    requireEvidence(
      session.url && session.livemode === this.config.livemode,
      "checkout_session_unavailable",
    );
    return { id: session.id, url: session.url };
  }
  async checkoutStatus(
    sessionId: string,
  ): Promise<{ status: string; url: string | null; subscriptionId?: string }> {
    const session = await this.client.checkout.sessions.retrieve(sessionId);
    requireEvidence(
      session.livemode === this.config.livemode,
      "checkout_mode_mismatch",
    );
    return {
      status: session.status ?? "unknown",
      url: session.url,
      subscriptionId: id(session.subscription),
    };
  }
  async portal(customerId: string): Promise<string> {
    const session = await this.client.billingPortal.sessions.create({
      customer: customerId,
      configuration: this.config.portalConfigurationId,
      return_url: `${this.config.appOrigin}/?billing=account`,
    });
    return session.url;
  }
  verifyWebhook(raw: Buffer, signature: string): Stripe.Event {
    const event = this.client.webhooks.constructEvent(
      raw,
      signature,
      this.config.webhookSecret,
      300,
    );
    requireEvidence(
      event.livemode === this.config.livemode && !event.account,
      "webhook_account_or_mode_mismatch",
    );
    return event;
  }
  async invoiceFromRefund(refundId: string): Promise<string> {
    const refund = await this.client.refunds.retrieve(refundId);
    const chargeId = id(refund.charge);
    requireEvidence(chargeId, "refund_charge_missing");
    return this.invoiceFromCharge(chargeId);
  }
  async invoiceFromCharge(chargeId: string): Promise<string> {
    const charge = await this.client.charges.retrieve(chargeId);
    requireEvidence(
      charge.livemode === this.config.livemode && id(charge.payment_intent),
      "unsupported_refund_charge",
    );
    const payments = await this.client.invoicePayments.list({
      payment: {
        type: "payment_intent",
        payment_intent: id(charge.payment_intent)!,
      },
      limit: 2,
    });
    requireEvidence(
      !payments.has_more && payments.data.length === 1,
      "refund_invoice_not_unique",
    );
    return id(payments.data[0]!.invoice)!;
  }
  async annualPayment(
    invoiceId: string,
  ): Promise<AnnualPayment & { refunded: boolean; partialRefund: boolean }> {
    const invoice = await this.client.invoices.retrieve(invoiceId);
    const subscriptionId = id(
      invoice.parent?.subscription_details?.subscription,
    );
    requireEvidence(
      invoice.livemode === this.config.livemode &&
        invoice.status === "paid" &&
        subscriptionId &&
        invoice.collection_method === "charge_automatically" &&
        invoice.amount_remaining === 0 &&
        invoice.amount_paid === invoice.total &&
        invoice.total >= this.config.amountMinor &&
        invoice.subtotal === this.config.amountMinor &&
        invoice.currency === this.config.currency &&
        invoice.discounts.length === 0 &&
        !invoice.total_discount_amounts?.some((x) => x.amount !== 0) &&
        !invoice.total_pretax_credit_amounts?.some((x) => x.amount !== 0) &&
        !invoice.amount_paid_off_stripe,
      "unsupported_paid_invoice",
    );
    const [lines, subscription, payments] = await Promise.all([
      this.client.invoices.listLineItems(invoiceId, { limit: 2 }),
      this.client.subscriptions.retrieve(subscriptionId),
      this.client.invoicePayments.list({
        invoice: invoiceId,
        status: "paid",
        limit: 2,
      }),
    ]);
    requireEvidence(
      !lines.has_more &&
        lines.data.length === 1 &&
        !payments.has_more &&
        payments.data.length === 1,
      "unsupported_invoice_composition",
    );
    const line = lines.data[0]!;
    const payment = payments.data[0]!;
    const details = line.pricing?.price_details;
    requireEvidence(
      line.quantity === 1 &&
        (line.quantity_decimal == null ||
          Number(line.quantity_decimal) === 1) &&
        line.subtotal === this.config.amountMinor &&
        line.currency === this.config.currency &&
        !line.parent?.subscription_item_details?.proration &&
        id(line.parent?.subscription_item_details?.subscription) ===
          subscriptionId &&
        id(details?.price) === this.config.priceId &&
        id(details?.product) === this.config.productId &&
        subscription.livemode === this.config.livemode &&
        id(subscription.customer) === id(invoice.customer) &&
        subscription.metadata.amp_checkout_id &&
        payment.livemode === this.config.livemode &&
        payment.amount_paid === invoice.total &&
        payment.currency === invoice.currency &&
        payment.payment.type === "payment_intent",
      "annual_invoice_mapping_mismatch",
    );
    const intentId = id(payment.payment.payment_intent);
    requireEvidence(intentId, "missing_invoice_payment_intent");
    const intent = await this.client.paymentIntents.retrieve(intentId);
    requireEvidence(
      intent.status === "succeeded" &&
        intent.livemode === this.config.livemode &&
        intent.amount_received === invoice.total &&
        intent.currency === invoice.currency &&
        id(intent.customer) === id(invoice.customer) &&
        id(intent.latest_charge),
      "payment_not_settled",
    );
    const charge = await this.client.charges.retrieve(
      id(intent.latest_charge)!,
    );
    requireEvidence(
      charge.paid &&
        charge.captured &&
        charge.amount === invoice.total &&
        charge.currency === invoice.currency &&
        charge.livemode === this.config.livemode &&
        id(charge.customer) === id(invoice.customer),
      "charge_mapping_mismatch",
    );
    const refunds = await this.client.refunds.list({
      charge: charge.id,
      limit: 100,
    });
    requireEvidence(!refunds.has_more, "refund_history_requires_review");
    const successfulRefunds = refunds.data.filter(
      (x) => x.status === "succeeded",
    );
    const refundedAmount = successfulRefunds.reduce(
      (sum, x) => sum + x.amount,
      0,
    );
    requireEvidence(refundedAmount <= invoice.total, "refund_amount_mismatch");
    const paidAt = invoice.status_transitions.paid_at;
    requireEvidence(paidAt, "invoice_paid_time_missing");
    return {
      invoiceId,
      subscriptionId,
      customerId: id(invoice.customer)!,
      checkoutId: subscription.metadata.amp_checkout_id!,
      priceId: this.config.priceId,
      productId: this.config.productId,
      currency: invoice.currency,
      subtotal: invoice.subtotal,
      paid: invoice.total,
      periodStart: line.period.start,
      periodEnd: line.period.end,
      paidAt,
      chargeId: charge.id,
      // Refund.created is the stable provider timestamp; Stripe does not expose a
      // separate success-transition instant. Never derive it from an invoice event.
      fullRefundAt:
        refundedAmount === invoice.total
          ? Math.max(
              paidAt,
              ...successfulRefunds.map((refund) => refund.created),
            )
          : undefined,
      refunded: refundedAmount === invoice.total,
      partialRefund: refundedAmount > 0 && refundedAmount < invoice.total,
    };
  }
}
