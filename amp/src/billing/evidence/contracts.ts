import { z } from "zod";

const text = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^[^\x00-\x1f\x7f]+$/);
const https = z
  .string()
  .url()
  .max(300)
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  });
export const documentProfileSchema = z
  .object({
    version: text,
    reviewedAt: z.string().datetime(),
    accountId: z.string().regex(/^acct_[A-Za-z0-9_]+$/),
    livemode: z.boolean(),
    productId: z.string().regex(/^prod_[A-Za-z0-9_]+$/),
    priceId: z.string().regex(/^price_[A-Za-z0-9_]+$/),
    sku: text,
    currency: z.literal("usd"),
    unitAmountMinor: z.number().int().positive().max(100_000_000),
    seller: z
      .object({
        legalName: text,
        address: z.array(text).min(2).max(5),
        supportEmail: z.string().email().max(180),
        supportUrl: https,
        privacyUrl: https,
      })
      .strict(),
    product: z.object({ title: text, description: text }).strict(),
  })
  .strict();
export type DocumentProfile = z.infer<typeof documentProfileSchema>;
export interface TaxAmount {
  amountMinor: number;
  behavior: "inclusive" | "exclusive";
}
export interface RefundFact {
  id: string;
  chargeId: string;
  amountMinor: number;
  currency: "usd";
  created: number;
  status: "pending" | "requires_action" | "succeeded" | "failed" | "canceled";
}
export interface FinancialObservation {
  invoiceReason: "subscription_create" | "subscription_cycle";
  preTaxMinor: number;
  tax: TaxAmount[];
  paidMinor: number;
  currency: "usd";
  refunds: RefundFact[];
}
export type FinancialResult =
  | { kind: "verified"; observation: FinancialObservation }
  | { kind: "review"; reason: string; creditNoteId?: string };
export interface PaymentBaseline {
  invoiceReason: "subscription_create" | "subscription_cycle";
  invoiceId: string;
  chargeId: string;
  subscriptionId: string;
  checkoutId: string;
  paidAt: number;
  periodStart: number;
  periodEnd: number;
  preTaxMinor: number;
  tax: TaxAmount[];
  paidMinor: number;
  currency: "usd";
  profile: DocumentProfile;
}
export interface PaymentHistoryItem {
  id: string;
  createdAt: string;
  learnerReference: string;
  status: "verified" | "review";
  baseline: PaymentBaseline | null;
  observedAt: string;
  successfulRefundMinor: number | null;
  netPaidMinor: number | null;
  observations: { id: string; observedAt: string; refunds: RefundFact[] }[];
}
