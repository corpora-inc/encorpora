import { z } from "zod";

// Provider identifiers are opaque and case-sensitive. Do not normalize or hash
// their values when preparing a provider payload. Never put them in logs.
const clickId = z
  .string()
  .min(1)
  .max(2048)
  .regex(/^[A-Za-z0-9._~+=/-]+$/);
export const googleClickIdentifiersSchema = z
  .strictObject({
    gclid: clickId.optional(),
    gbraid: clickId.optional(),
    wbraid: clickId.optional(),
  })
  .refine((v) => !!(v.gclid || v.gbraid || v.wbraid));
export const metaClickIdentifiersSchema = z
  .strictObject({
    fbclid: clickId.optional(),
    fbc: z
      .string()
      .max(2200)
      .regex(/^fb\.[0-9]{1,3}\.[0-9]{13}\.[A-Za-z0-9._~+=/-]+$/)
      .optional(),
    fbp: z
      .string()
      .max(200)
      .regex(/^fb\.[0-9]{1,3}\.[0-9]{13}\.[0-9]+$/)
      .optional(),
  })
  .refine((v) => !!(v.fbclid || v.fbc || v.fbp));
export const clickEvidenceSchema = z.discriminatedUnion("provider", [
  z.strictObject({
    provider: z.literal("google"),
    identifiers: googleClickIdentifiersSchema,
  }),
  z.strictObject({
    provider: z.literal("meta"),
    identifiers: metaClickIdentifiersSchema,
  }),
]);
export type ClickEvidence = z.infer<typeof clickEvidenceSchema>;

/** Local validation, never a network call. Only actual observed IDs are used.
 * The supplied time is the original first observation, not payment/export time. */
export function providerClickIdentifiers(
  input: ClickEvidence,
  observedAt: Date,
  capturedAt = observedAt,
) {
  const parsed = clickEvidenceSchema.safeParse(input);
  if (
    !parsed.success ||
    !Number.isFinite(+observedAt) ||
    +observedAt < 1e12 ||
    !Number.isFinite(+capturedAt) ||
    +capturedAt < +observedAt
  )
    throw new Error("invalid_click_evidence");
  if (parsed.data.provider === "google") return parsed.data.identifiers;
  const { fbclid, fbc, fbp } = parsed.data.identifiers;
  for (const cookie of [fbc, fbp]) {
    if (cookie && Number(cookie.split(".")[2]) > +capturedAt)
      throw new Error("invalid_click_evidence");
  }
  // A freshly observed click supersedes an older cookie from a different click.
  // Preserve a matching cookie's original timestamp, including on reloads.
  const matchingFbc =
    fbc && (!fbclid || fbc.split(".").slice(3).join(".") === fbclid);
  return {
    ...(matchingFbc
      ? {
          fbc: fbc!
            .split(".")
            .map((part, index) =>
              index === 2 ? String(Math.min(Number(part), +observedAt)) : part,
            )
            .join("."),
        }
      : fbclid
        ? { fbc: `fb.1.${+observedAt}.${fbclid}` }
        : {}),
    ...(fbp ? { fbp } : {}),
  };
}
