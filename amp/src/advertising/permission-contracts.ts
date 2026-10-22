import { z } from "zod";

/** Change this version whenever the recipient, purpose, fields or period changes. */
export const PURCHASE_MEASUREMENT_NOTICE = {
  version: "google-adult-purchase-v2",
  title: "Google purchase measurement",
  purpose: "Help AMP understand which Google ads lead to purchases.",
  disclosure:
    "If you allow this, AMP may send Google an encoded version of your confirmed account email, a random purchase reference, the purchase date, amount and currency. Google can match the encoded email with its records; encoding does not make it anonymous.",
  boundary:
    "This permission covers your adult purchase information. Learner names, ages, answers, lessons and progress are excluded. AMP requests measurement without ad personalization.",
  choice:
    "This is optional and lasts one year. You can withdraw it here at any time. Your choice does not affect pricing, purchasing or learning access. Withdrawal stops future sharing; it does not recall information already received by Google.",
  retention:
    "AMP keeps this preference for its duration and up to 90 days after withdrawal or expiry. Local purchase-measurement records are kept for up to 90 days after the purchase. Google handles received information under its own privacy policy.",
  attestation:
    "I am at least 18, this is my own email address, and I allow the purchase sharing described above.",
} as const;
export const purchaseMeasurementSchema = z.object({
  available: z.boolean(),
  eligible: z.boolean(),
  status: z.enum(["off", "active", "expired", "review-required"]),
  revision: z.uuid().nullable(),
  // Response compatibility is separate from the strict grant notice below.
  noticeVersion: z.string().min(1).max(120),
  currentNoticeVersion: z.string().min(1).max(120).optional(),
  grantedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
});
export type PurchaseMeasurement = z.infer<typeof purchaseMeasurementSchema>;
export const currentMeasurementNotice = (view: PurchaseMeasurement) =>
  view.currentNoticeVersion ?? view.noticeVersion;
export const permissionChangeSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("allow"),
    revision: z.uuid().nullable(),
    noticeVersion: z.literal(PURCHASE_MEASUREMENT_NOTICE.version),
    adultAttestation: z.literal(true),
  }),
  z.strictObject({ action: z.literal("withdraw") }),
]);
export type PermissionChange = z.infer<typeof permissionChangeSchema>;
export class AdvertisingPermissionError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
  ) {
    super(code);
  }
}
export function advertisingOptOut(headers: Record<string, unknown>) {
  return headers["sec-gpc"] === "1" || headers.dnt === "1";
}
