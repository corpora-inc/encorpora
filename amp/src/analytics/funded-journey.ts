import type { PoolClient } from "pg";
import type { FundingOffer } from "../funding-purchase/contracts.js";
import { visitorIdSchema } from "./events.js";
import { funnelDay } from "./repository.js";

/** The caller owns the financial transaction. Measurement cannot reject a sale. */
async function measure(
  client: PoolClient,
  write: () => Promise<void>,
): Promise<void> {
  await client.query("SAVEPOINT funded_journey_measurement");
  try {
    await write();
    await client.query("RELEASE SAVEPOINT funded_journey_measurement");
  } catch {
    await client.query("ROLLBACK TO SAVEPOINT funded_journey_measurement");
    await client.query("RELEASE SAVEPOINT funded_journey_measurement");
    console.warn("Funded journey measurement unavailable");
  }
}

/** One invoice remains one purchase journey when later claimed by an account.
 * Retries never overwrite the original visitor, including a deliberate opt-out.
 * No purchase is inferred here; reporting reads the verified financial records.
 */
export async function linkFundedVisitor(
  client: PoolClient,
  purchase: { id: string; createdAt: string; offer: FundingOffer },
  entryKind: "guest_invoice" | "account_request",
  visitor: string | undefined,
): Promise<void> {
  await measure(client, async () => {
    if (
      (
        await client.query(
          "SELECT 1 FROM amp_funded_visitor_links WHERE request_id=$1",
          [purchase.id],
        )
      ).rowCount
    )
      return;
    const parsed = visitorIdSchema.safeParse(visitor);
    const visitorId = parsed.success ? parsed.data : null;
    const day = funnelDay(new Date(purchase.createdAt));
    if (visitorId)
      await client.query(
        `INSERT INTO amp_funnel_visitors(visitor_id,first_seen,last_seen)
       VALUES($1,$2,$2) ON CONFLICT(visitor_id) DO NOTHING`,
        [visitorId, day],
      );
    await client.query(
      `INSERT INTO amp_funded_visitor_links
      (request_id,visitor_id,created_on,entry_kind,document_kind,program,jurisdiction,amount_minor,currency)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(request_id) DO NOTHING`,
      [
        purchase.id,
        visitorId,
        day,
        entryKind,
        purchase.offer.documentPolicy === "named-student-invoice"
          ? "invoice"
          : "quote",
        purchase.offer.programId,
        purchase.offer.jurisdiction,
        purchase.offer.subtotalMinor + purchase.offer.taxMinor,
        purchase.offer.currency,
      ],
    );
  });
}

/** This is a parent's statement or cancellation, never provider payment evidence. */
export async function recordFundedParentStatus(
  client: PoolClient,
  id: string,
  status: "parent-reported-submitted" | "cancelled",
  at: Date,
): Promise<void> {
  await measure(client, async () => {
    const column =
      status === "parent-reported-submitted" ? "submitted_on" : "cancelled_on";
    await client.query(
      `UPDATE amp_funded_visitor_links SET ${column}=COALESCE(${column},$2) WHERE request_id=$1`,
      [id, funnelDay(at)],
    );
  });
}
