import { z } from "zod";

/** Change this version whenever the recipient, purpose, fields or period changes. */
export const PURCHASE_MEASUREMENT_NOTICE = {
  version: "google-adult-purchase-v3",
  title: "Google purchase measurement",
  purpose: "Help AMP understand which Google ads lead to purchases.",
  disclosure:
    "If you allow this, AMP may send Google an encoded version of your confirmed account email, a random purchase reference, the purchase date, amount and currency. This also includes the Google ad click identifier saved when you visited our marketing page, when available. Google can match the click identifier and encoded email with its records; encoding does not make it anonymous.",
  boundary:
    "This permission covers your adult purchase information. Learner names, ages, answers, lessons and progress are excluded. AMP requests measurement without ad personalization.",
  choice:
    "This is optional and lasts one year. You can withdraw it here at any time. Your choice does not affect pricing, purchasing or learning access. Withdrawal stops future sharing; it does not recall information already received by Google.",
  retention:
    "AMP keeps permission evidence for its duration and up to 90 days after withdrawal or expiry. A minimal opt-out setting is kept until you change it so collection does not resume when evidence expires. Local purchase-measurement records are kept for up to 90 days after the purchase. Google handles received information under its own privacy policy.",
  attestation:
    "I am at least 18, this is my own email address, and I allow the purchase sharing described above.",
} as const;
export type AdvertisingProvider = "google" | "meta";
export const META_PURCHASE_MEASUREMENT_NOTICE = {
  version: "meta-adult-purchase-v2",
  title: "Meta purchase measurement and ad delivery",
  purpose:
    "Help AMP measure Facebook and Instagram ads and improve their delivery.",
  disclosure:
    "If you allow this, AMP may send Meta an encoded version of your confirmed account email, a random purchase reference, the purchase date, amount and currency. For an eligible website purchase, this also includes the purchase-page address and your browser's user agent. This also includes saved Meta ad click and browser identifiers, when available. Meta can match these identifiers and the encoded email with its records; encoding does not make it anonymous.",
  boundary:
    "Meta can use this information for ad measurement, ad delivery and audience creation. This permission covers your adult purchase information. Learner names, ages, answers, lessons and progress are excluded.",
  choice:
    "This is optional and lasts one year. You can withdraw it here at any time. Your choice does not affect pricing, purchasing or learning access. Withdrawal stops future sharing; it does not recall information already received by Meta.",
  retention:
    "AMP keeps permission evidence for its duration and up to 90 days after withdrawal or expiry. A minimal opt-out setting is kept until you change it so collection does not resume when evidence expires. Local purchase-measurement records are kept for up to 90 days after the purchase. Meta handles received information under its own privacy policy.",
  attestation:
    "I am at least 18, this is my own email address, and I allow the purchase sharing described above.",
} as const;
export function measurementNotice(provider: AdvertisingProvider) {
  switch (provider) {
    case "google":
      return PURCHASE_MEASUREMENT_NOTICE;
    case "meta":
      return META_PURCHASE_MEASUREMENT_NOTICE;
    default:
      throw new Error("Unsupported advertising provider");
  }
}
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
function changeSchema<V extends string>(version: V) {
  return z.discriminatedUnion("action", [
    z.strictObject({
      action: z.literal("allow"),
      revision: z.uuid().nullable(),
      noticeVersion: z.literal(version),
      adultAttestation: z.literal(true),
    }),
    z.strictObject({ action: z.literal("withdraw") }),
  ]);
}
export const permissionChangeSchema = changeSchema(
  PURCHASE_MEASUREMENT_NOTICE.version,
);
export const metaPermissionChangeSchema = changeSchema(
  META_PURCHASE_MEASUREMENT_NOTICE.version,
);
export type PermissionChange =
  | z.infer<typeof permissionChangeSchema>
  | z.infer<typeof metaPermissionChangeSchema>;
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
