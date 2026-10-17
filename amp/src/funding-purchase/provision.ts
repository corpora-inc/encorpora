import { learningConsentActive } from "../server/account-access.js";
import type { Pool } from "pg";
import { z } from "zod";
import {
  commerceEventSchema,
  applyCommerceEventInTransaction,
} from "../commerce/postgres.js";
import { canonicalCommercePayload } from "../commerce/ledger.js";
import { FundingPurchaseRepository, fundingRequestRow } from "./repository.js";
import {
  availableOffers,
  type FundingOffer,
  FundingPurchaseError,
} from "./contracts.js";
export const fundedProvisionSchema = z.strictObject({
  requestId: z.string().uuid(),
  events: z.array(commerceEventSchema).min(4).max(5),
});
/** Twelve calendar months; leap-day terms end on the last day of February. */
export function annualTermEnd(start: string): string {
  const date = new Date(start),
    year = date.getUTCFullYear() + 1,
    month = date.getUTCMonth();
  const day = Math.min(
    date.getUTCDate(),
    new Date(Date.UTC(year, month + 1, 0)).getUTCDate(),
  );
  date.setUTCFullYear(year, month, day);
  return date.toISOString();
}
/** Staff-only, no HTTP endpoint. Explicit evidence events provision one complete license atomically. */
export async function provisionFundingRequest(
  pool: Pool,
  input: unknown,
  offers: readonly FundingOffer[],
) {
  const data = fundedProvisionSchema.parse(input),
    created = data.events[0];
  if (created?.type !== "order.created")
    throw new FundingPurchaseError(400, "creation_event_required");
  const activation = data.events.find((e) => e.type === "license.activated");
  const allowed = new Set([
    "order.created",
    "order.approved",
    "order.settled",
    "order.fulfilled",
    "license.activated",
  ]);
  if (
    !activation ||
    !data.events.some((e) => e.type === "order.fulfilled") ||
    new Set(data.events.map((e) => e.type)).size !== data.events.length ||
    data.events.some(
      (e) =>
        !allowed.has(e.type) ||
        e.orderId !== created.orderId ||
        e.channel !== "esa" ||
        e.channelReference !== created.channelReference,
    )
  )
    throw new FundingPurchaseError(
      400,
      "complete_provisioning_events_required",
    );
  if (
    created.order.license.startsAt !== activation.occurredAt ||
    created.order.license.endsAt !== annualTermEnd(activation.occurredAt)
  )
    throw new FundingPurchaseError(400, "annual_activation_term_required");
  const repository = new FundingPurchaseRepository(pool, []);
  return repository.transaction(
    created.order.account.id,
    async (client) => {
      const result = await client.query(
        "SELECT * FROM amp_funding_requests WHERE id=$1 AND account_id=$2 FOR UPDATE",
        [data.requestId, created.order.account.id],
      );
      if (!result.rowCount)
        throw new FundingPurchaseError(404, "request_not_found");
      const row = result.rows[0],
        request = fundingRequestRow(row);
      if (request.orderId) {
        if (
          canonicalCommercePayload(row.conversion_payload) !==
          canonicalCommercePayload(data)
        )
          throw new FundingPurchaseError(409, "provisioning_payload_mismatch");
        return { requestId: request.id, orderId: request.orderId };
      }
      const live = availableOffers(offers, new Date()).find(
        (o) =>
          o.id === request.offer.id && o.revision === request.offer.revision,
      );
      if (
        !live ||
        canonicalCommercePayload(live) !==
          canonicalCommercePayload(request.offer)
      )
        throw new FundingPurchaseError(409, "offer_unavailable");
      if (!(await learningConsentActive(client, request.accountId)))
        throw new FundingPurchaseError(403, "verified_consent_required");
      const learner = await client.query(
        "SELECT id FROM amp_learners WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL FOR SHARE",
        [request.learnerId, request.accountId],
      );
      if (!learner.rowCount)
        throw new FundingPurchaseError(404, "learner_not_found");
      if (
        request.status === "cancelled" ||
        Date.parse(request.expiresAt) <= Date.now()
      )
        throw new FundingPurchaseError(409, "request_not_provisionable");
      if (Date.parse(created.occurredAt) < Date.parse(request.createdAt))
        throw new FundingPurchaseError(409, "provisioning_predates_quote");
      const o = request.offer,
        order = created.order;
      if (
        order.license.accountId !== request.accountId ||
        order.license.learnerId !== request.learnerId ||
        order.license.sku !== o.sku ||
        order.amountMinor !== o.subtotalMinor + o.taxMinor ||
        order.currency !== o.currency ||
        order.activationPolicy !== o.activationPolicy ||
        order.channelReference !== o.channelReference
      )
        throw new FundingPurchaseError(409, "order_quote_mismatch");
      // The exclusive account lock is acquired before request/order/learner locks.
      // It serializes this bounded operator import with other grant and privacy writers.
      const overlap = await client.query(
        "SELECT 1 FROM amp_grants WHERE learner_id=$1 AND status='active' AND starts_at<$3 AND ends_at>$2 LIMIT 1",
        [request.learnerId, order.license.startsAt, order.license.endsAt],
      );
      if (overlap.rowCount)
        throw new FundingPurchaseError(409, "overlapping_learning_access");
      for (const event of data.events)
        await applyCommerceEventInTransaction(client, event);
      await client.query(
        "UPDATE amp_funding_requests SET order_id=$2,conversion_payload=$3 WHERE id=$1",
        [request.id, order.id, JSON.stringify(data)],
      );
      return { requestId: request.id, orderId: order.id };
    },
    true,
  );
}
