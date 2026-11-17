import type { AuthSession } from "../../auth";
import { meOptions, queryClient } from "../../lib/query";
import { fundingRecordsOptions } from "../funding/records";
import { invoiceHistoryOptions } from "../funding/FundingInvoices";
import { receiptsOptions } from "./Receipts";

/**
 * Billing's plans, invoices and receipts, asked for before it renders (its
 * route's loader), so it opens whole: no wait that later grows into a list
 * and pushes the next one down. A failure is the screen's own to show, with
 * its Try again, so here it is only logged.
 */
export async function prefetchBilling(session: AuthSession) {
  const me = await queryClient.ensureQueryData(meOptions(session));
  const verified = me.signedIn && !me.account.confirmationRequired;
  const asks: Promise<unknown>[] = [
    queryClient.ensureQueryData(fundingRecordsOptions(session)),
    queryClient.ensureQueryData(receiptsOptions(session, null)),
  ];
  if (verified) asks.push(queryClient.ensureQueryData(invoiceHistoryOptions(session)));
  for (const result of await Promise.allSettled(asks))
    if (result.status === "rejected")
      console.warn("Billing's data didn't load ahead", result.reason);
}
