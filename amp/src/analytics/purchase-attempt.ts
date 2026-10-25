import { z } from "zod";

export const PURCHASE_STAGES = [
  "funded_invoice",
  "funded_claim",
  "funded_request",
  "funded_checkout",
  "funded_status",
  "card_checkout",
  "card_claim",
] as const;
export const PURCHASE_FAILURES = [
  "authentication",
  "permission",
  "validation",
  "unavailable",
  "network",
  "contract",
] as const;
export const purchaseAttemptSchema = z
  .strictObject({
    attemptId: z.uuidv4(),
    stage: z.enum(PURCHASE_STAGES),
    outcome: z.enum(["started", "succeeded", "failed", "cancelled"]),
    failure: z.enum(PURCHASE_FAILURES).optional(),
  })
  .refine((p) => (p.outcome === "failed") === (p.failure !== undefined), {
    message: "Only a failed attempt carries a failure category",
  });
export type PurchaseAttempt = z.infer<typeof purchaseAttemptSchema>;

/** Fixed categories only: never retain request paths, IDs, bodies or errors. */
export function purchaseStage(
  path: string,
  method: string,
): PurchaseAttempt["stage"] | undefined {
  if (method.toUpperCase() !== "POST") return;
  const route = path.split(/[?#]/, 1)[0];
  if (route === "/funding/invoices") return "funded_invoice";
  if (/^\/funding\/invoices\/[^/]+\/claim$/.test(route)) return "funded_claim";
  if (route === "/funding/requests") return "funded_request";
  if (/^\/funding\/requests\/[^/]+\/classwallet-checkout$/.test(route))
    return "funded_checkout";
  if (/^\/funding\/requests\/[^/]+\/status$/.test(route))
    return "funded_status";
  if (route === "/billing/checkout" || route === "/billing/enrollment/checkout")
    return "card_checkout";
  if (route === "/billing/enrollment/claim") return "card_claim";
}

export const purchaseActionSchema = z.strictObject({
  actionId: z.uuidv4(),
  action: z.enum([
    "document_download",
    "funding_provider_open",
    "amp_setup_open",
    "invoice_correct",
  ]),
});
export type PurchaseAction = z.infer<typeof purchaseActionSchema>;
