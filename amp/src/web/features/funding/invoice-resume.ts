import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import type { AuthSession } from "../../auth";
import { request, requestFetch } from "../../lib/api";
import { invoiceOfferSchema } from "./invoice-offers";
import { invoiceDocumentSchema } from "./invoice-document";
import { fundingRecordSchema } from "./records";

export const purchaseOfferSchema = invoiceOfferSchema.extend({
  programId: z.string(),
  jurisdiction: z.string(),
  productDescription: z.string(),
  taxMinor: z.number(),
  destinationUrl: z.string().url(),
  merchant: z.object({
    legalName: z.string().optional(),
    supportEmail: z.string().email(),
  }),
});
export type PurchaseOffer = z.infer<typeof purchaseOfferSchema>;
export type InvoiceResult = {
  document: z.infer<typeof invoiceDocumentSchema>;
  offer: PurchaseOffer;
  name: string;
  email: string;
};
const intentSchema = z.object({
  id: z.string().uuid(),
  state: z.enum(["prepared", "claimed", "cancelled"]),
  claimedRequestId: z.string().nullable(),
  studentBillingName: z.string(),
  expiresAt: z.string(),
  offer: purchaseOfferSchema,
});
const recordSchema = fundingRecordSchema.extend({
  learnerId: z.string(),
  accessStatus: z.string(),
  commerce: z.object({ endsAt: z.string() }).nullable().optional(),
});
export class InvoiceUnavailableError extends Error {}

/** Restore only the authenticated owner's invoice, including its original
 * offer snapshot. The URL contains its identifier, never billing details. */
export const invoiceResumeOptions = (session: AuthSession, id: string) =>
  queryOptions({
    queryKey: ["account", session.accountId, "active-funding-invoice", id],
    staleTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      if (!z.string().uuid().safeParse(id).success)
        throw new InvoiceUnavailableError(
          "This invoice link is invalid. Open Billing to find your invoices.",
        );
      const { invoices } = await request(
        "/funding/invoices",
        z.object({ invoices: z.array(intentSchema) }),
        {
          token: session.token,
          signal,
        },
      );
      const invoice = invoices.find((item) => item.id === id);
      if (!invoice || invoice.state === "cancelled")
        throw new InvoiceUnavailableError(
          "This invoice isn’t available to this account. Open Billing to find your invoices.",
        );
      const record =
        invoice.state === "claimed"
          ? await request(`/funding/requests/${id}`, recordSchema, {
              token: session.token,
              signal,
            })
          : null;
      if (record?.status === "cancelled")
        throw new InvoiceUnavailableError(
          "This invoice was cancelled. Its record is in Billing.",
        );
      const response = await requestFetch(
        `/api/v1/funding/invoices/${id}/pdf`,
        {
          headers: { authorization: `Bearer ${session.token}` },
          signal,
        },
      );
      if (!response.ok)
        throw new Error(
          "Your invoice couldn’t be opened. Try again or open Billing.",
        );
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 8192)
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
      return {
        invoice,
        record,
        document: invoiceDocumentSchema.parse({
          invoiceId: id,
          totalMinor: invoice.offer.totalMinor,
          merchantName: invoice.offer.merchant.legalName ?? "Corpora Inc",
          pdfBase64: btoa(binary),
          filename: `education-invoice-${id}.pdf`,
          destinationUrl: invoice.offer.destinationUrl,
          instructions: invoice.offer.instructions,
          expiresAt: invoice.expiresAt,
        }),
      };
    },
  });
export type ResumedInvoice = {
  invoice: z.infer<typeof intentSchema>;
  record: z.infer<typeof recordSchema> | null;
  document: z.infer<typeof invoiceDocumentSchema>;
};
