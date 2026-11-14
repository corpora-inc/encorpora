import {
  accessGrantsFor,
  grantInForce,
  adultGrantId,
} from "../account/adult-access.js";
import { purchaseConsentSatisfied } from "../server/account-access.js";
import { recordFundedCampaignEvent } from "../analytics/funded-campaign.js";
import type { Pool, PoolClient } from "pg";
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
/** A funded term's end: the same day and time `months` calendar months
 * later, clamped to that month's last day (January 31 + 1 month is February
 * 28; February 29 + 12 months is February 28). */
export function fundedTermEnd(start: string, months: 1 | 12): string {
  const date = new Date(start),
    index = date.getUTCMonth() + months,
    year = date.getUTCFullYear() + Math.floor(index / 12),
    month = index % 12;
  const day = Math.min(
    date.getUTCDate(),
    new Date(Date.UTC(year, month + 1, 0)).getUTCDate(),
  );
  date.setUTCFullYear(year, month, day);
  return date.toISOString();
}
/** Twelve calendar months; leap-day terms end on the last day of February. */
export const annualTermEnd = (start: string) => fundedTermEnd(start, 12);

/** How far ahead a term paid early may be scheduled. Further than this, the
 * learner's existing access is something an operator reconciles first. */
const EARLY_RENEWAL_LIMIT_MS = 366 * 86_400_000;

/** When a funded term activated at `activatedAt` starts: then, or, when the
 * learner's access already runs past it (a month paid early), the moment
 * that access ends, following back-to-back terms. Access that runs more than
 * a year ahead isn't followed: the term starts at activation and provisioning
 * reports the overlap for an operator to reconcile. Captures the dates on
 * pending requests using the caller's transaction; does not write grant rows. */
export async function fundedTermStart(
  db: Pick<PoolClient, "query">,
  learnerId: string,
  activatedAt: string,
  requestId?: string,
): Promise<string> {
  const access = await accessGrantsFor(db, [learnerId]);
  let start = activatedAt;
  for (let step = 0; step < 24; step++) {
    // Current derived access also covers activation captured just before this
    // transaction. Direct scheduled terms keep their actual start dates.
    const at = new Date(start);
    const covering = access.grants
      .filter(
        (g) =>
          grantInForce(g, at) ||
          (g.id === adultGrantId(learnerId) &&
            grantInForce(g, access.now) &&
            g.ends_at > at),
      )
      .sort((a, b) => b.ends_at.getTime() - a.ends_at.getTime())[0];
    if (!covering) break;
    start = covering.ends_at.toISOString();
  }
  if (Date.parse(start) - Date.parse(activatedAt) > EARLY_RENEWAL_LIMIT_MS)
    start = activatedAt;
  // A retry must not reconstruct this decision from today's entitlement.
  // Save it with the pending financial request in this transaction. Callers
  // that only know the learner capture the same basis for its pending quotes;
  // provider callers name their exact request. No grant is materialized.
  await db.query(
    `UPDATE amp_funding_requests SET scheduled_term=$3::jsonb
     WHERE ($1::text IS NULL OR id=$1) AND learner_id=$2
       AND order_id IS NULL AND status<>'cancelled'
       AND created_at<=$4::timestamptz AND expires_at>now()`,
    [
      requestId ?? null,
      learnerId,
      JSON.stringify({ activatedAt, startsAt: start }),
      activatedAt,
    ],
  );
  return start;
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
  const term = created.order.license;
  // A term starts at activation, or later when it follows access the learner
  // already has (checked against that access below).
  if (Date.parse(term.startsAt) < Date.parse(activation.occurredAt))
    throw new FundingPurchaseError(400, "funded_activation_term_required");
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
      // Provider callbacks and provisioning share the account/request lock.
      // A payload read before a cancellation or conflict is no longer authority.
      const checkout = (
        await client.query(
          "SELECT callback_status,stopped_at,exception_code,provisioning_payload FROM amp_classwallet_checkouts WHERE request_id=$1 FOR UPDATE",
          [request.id],
        )
      ).rows[0];
      if (
        checkout &&
        (checkout.callback_status !== "complete" ||
          checkout.stopped_at ||
          checkout.exception_code ||
          (request.offer.activationPolicy === "after-approval"
            ? canonicalCommercePayload(checkout.provisioning_payload) !==
              canonicalCommercePayload(data)
            : !data.events.some((event) => event.type === "order.settled")))
      )
        throw new FundingPurchaseError(409, "classwallet_approval_unavailable");
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
      if (
        term.endsAt !== fundedTermEnd(term.startsAt, request.offer.termMonths)
      )
        throw new FundingPurchaseError(400, "funded_activation_term_required");
      // A child needs the parent's verified consent; the account holder's own
      // adult learner learns on their own terms.
      if (
        !(await purchaseConsentSatisfied(
          client,
          request.accountId,
          request.learnerId,
        ))
      )
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
      const access = await accessGrantsFor(client, [request.learnerId]);
      // A captured scheduling decision survives expiry, shortening or
      // revocation of the preceding coverage. It grants no current access;
      // the live resolver below still rejects any overlapping replacement.
      // Complete saved provider payloads also preserve pre-migration schedules.
      const savedSchedule =
        (row.scheduled_term?.activatedAt === activation.occurredAt &&
          row.scheduled_term?.startsAt === term.startsAt) ||
        (checkout?.provisioning_payload != null &&
          canonicalCommercePayload(checkout.provisioning_payload) ===
            canonicalCommercePayload(data)) ||
        Boolean(
          (
            await client.query(
              `SELECT 1 FROM amp_classwallet_payments
           WHERE invoice_id=$1 AND order_id=$2 AND stopped_at IS NULL
             AND conversion_payload=$3::jsonb`,
              [request.id, created.orderId, JSON.stringify(data)],
            )
          ).rowCount,
        );
      // Unsaved operator imports must still agree with a live grant's end.
      if (
        order.license.startsAt !== activation.occurredAt &&
        (Date.parse(order.license.startsAt) -
          Date.parse(activation.occurredAt) >
          EARLY_RENEWAL_LIMIT_MS ||
          (!savedSchedule &&
            !access.grants.some(
              (g) =>
                g.status === "active" &&
                g.ends_at.getTime() === Date.parse(order.license.startsAt) &&
                g.starts_at.getTime() < Date.parse(order.license.startsAt),
            )))
      )
        throw new FundingPurchaseError(409, "funded_term_start_unsupported");
      // The exclusive account lock is acquired before request/order/learner locks.
      // It serializes this bounded operator import with other grant and privacy writers.
      const overlap = access.grants.some(
        (g) =>
          g.status === "active" &&
          g.starts_at.getTime() < Date.parse(order.license.endsAt) &&
          g.ends_at.getTime() > Date.parse(order.license.startsAt),
      );
      if (overlap)
        throw new FundingPurchaseError(409, "overlapping_learning_access");
      for (const event of data.events)
        await applyCommerceEventInTransaction(client, event);
      await client.query(
        "UPDATE amp_funding_requests SET order_id=$2,conversion_payload=$3 WHERE id=$1",
        [request.id, order.id, JSON.stringify(data)],
      );
      await client.query(
        "INSERT INTO amp_funded_activation_outbox(request_id) VALUES($1) ON CONFLICT DO NOTHING",
        [request.id],
      );
      for (const event of data.events)
        await recordFundedCampaignEvent(client, event);
      return { requestId: request.id, orderId: order.id };
    },
    true,
  );
}
