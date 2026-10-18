import { BillingError, planConfig } from "./config.js";
import type { StripeGateway } from "./gateway.js";
import type { StripeRepository, InboxEvent } from "./repository.js";

/** Cancellation changes renewal, never the paid invoice's access window. */
export async function recordSubscriptionEvent(
  repository: StripeRepository,
  gateway: StripeGateway,
  event: InboxEvent,
): Promise<void> {
  await gateway.verifyMerchant();
  const subscription = await gateway.client.subscriptions.retrieve(
    event.objectId,
  );
  if (!subscription.metadata.amp_checkout_id) return; // Unrelated merchant subscription.
  const binding = await repository.binding(
    subscription.metadata.amp_checkout_id ?? "",
  );
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  const item = subscription.items.data[0];
  if (
    subscription.id !== event.objectId ||
    subscription.livemode !== gateway.config.livemode ||
    customerId !== binding.customerId ||
    (binding.subscriptionId && binding.subscriptionId !== subscription.id) ||
    subscription.items.has_more ||
    subscription.items.data.length !== 1 ||
    !item ||
    item.quantity !== 1 ||
    item.price.id !== planConfig(gateway.config, binding.interval).priceId
  )
    throw new BillingError("subscription_mapping_mismatch");
  if (!binding.sessionId) throw new BillingError("checkout_session_missing");
  const session = await gateway.checkoutStatus(binding.sessionId);
  if (
    session.status !== "complete" ||
    session.subscriptionId !== subscription.id
  )
    throw new BillingError("checkout_subscription_mismatch");
  await repository.transaction(binding.accountId, async (client) => {
    // A delayed event retrieves current provider state, so stale cancellation cannot overwrite resumption.
    await client.query(
      `INSERT INTO amp_stripe_subscription_events(namespace,event_id,checkout_id,subscription_id,status,cancel_at_period_end,period_start,period_end) VALUES($1,$2,$3,$4,$5,$6,to_timestamp($7),to_timestamp($8)) ON CONFLICT(namespace,event_id) DO NOTHING`,
      [
        repository.namespace,
        event.eventId,
        binding.id,
        subscription.id,
        subscription.status,
        subscription.cancel_at_period_end,
        item.current_period_start,
        item.current_period_end,
      ],
    );
    if (subscription.status === "canceled")
      await client.query(
        "UPDATE amp_stripe_checkouts SET closed=true WHERE id=$1",
        [binding.id],
      );
  });
}
