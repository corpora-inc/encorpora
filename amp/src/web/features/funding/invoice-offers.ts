import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { request } from "../../lib/api";

/** A program's public education-funds offer: what the no-account invoice
 * route sells. Shared so the pitch and the invoice show one price. */
export const invoiceOfferSchema = z.object({
  id: z.string(),
  revision: z.string(),
  programName: z.string(),
  productTitle: z.string(),
  totalMinor: z.number(),
  currency: z.literal("USD"),
  instructions: z.string(),
  termMonths: z.number().int().positive().optional(),
  /** The program's public status line, when configured (never inferred). */
  statusLabel: z.string().min(1).max(100).optional(),
});
export type InvoiceOffer = z.infer<typeof invoiceOfferSchema>;

export const invoiceOffersOptions = (programId: string) =>
  queryOptions({
    queryKey: ["public-invoice-offers", programId],
    queryFn: ({ signal }) =>
      request(
        `/funding/invoice-offers?program=${programId}`,
        z.object({ offers: z.array(invoiceOfferSchema) }),
        { signal },
      ),
    staleTime: 5 * 60_000,
  });
