import { createHash } from "node:crypto";
import { z } from "zod";

export const preparationRequirements = [
  "legal-entity",
  "authorized-signer",
  "tax-record",
  "bank-onboarding",
  "deployment",
  "privacy-and-consent",
  "accessibility",
  "support",
  "price-and-tax",
  "license",
  "fulfillment",
  "refund-policy",
] as const;
export const approvalRequirements = [
  "supplier-selection",
  "program-category",
  "annual-term",
  "catalog-listing",
  "platform-contract",
  "order-tests",
  "settlement",
] as const;
export const requirementIds = [
  ...preparationRequirements,
  ...approvalRequirements,
] as const;
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      Number.isFinite(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s,
  );
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const https = z
  .string()
  .url()
  .refine((s) => {
    const u = new URL(s);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.hash &&
      !u.search
    );
  }, "Use a public HTTPS URL without credentials, query or fragment");
export const packetEvidenceSchema = z
  .object({
    program: z.literal("fl-pep"),
    candidate: z.literal("AMP-PRACTICE-STUDENT"),
    catalogSha256: sha,
    // Restricted evidence index only. Never supply document contents, tax IDs or bank numbers.
    records: z.array(
      z
        .object({
          requirement: z.enum(requirementIds),
          reference: z.string().regex(/^[A-Za-z][A-Za-z0-9._-]{2,79}$/),
          reviewerReference: z.string().regex(/^[A-Za-z][A-Za-z0-9._-]{2,79}$/),
          reviewedOn: date,
          expiresOn: date,
          catalogSha256: sha,
          proposalSha256: sha,
          decision: z.literal("accepted"),
        })
        .strict(),
    ),
    publicUrls: z
      .object({
        product: https,
        demo: https,
        privacy: https,
        terms: https,
        support: https,
      })
      .strict()
      .optional(),
    commercial: z
      .object({
        currency: z.literal("USD"),
        priceMinor: z.number().int().positive().max(10000000),
        termMonths: z.literal(12),
        automaticRenewal: z.literal(false),
      })
      .strict()
      .optional(),
  })
  .strict();
export type PacketEvidence = z.infer<typeof packetEvidenceSchema>;
export function proposalSha256(
  data: Pick<
    PacketEvidence,
    "program" | "candidate" | "catalogSha256" | "publicUrls" | "commercial"
  >,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        program: data.program,
        candidate: data.candidate,
        catalogSha256: data.catalogSha256,
        publicUrls: data.publicUrls
          ? {
              product: data.publicUrls.product,
              demo: data.publicUrls.demo,
              privacy: data.publicUrls.privacy,
              terms: data.publicUrls.terms,
              support: data.publicUrls.support,
            }
          : null,
        commercial: data.commercial
          ? {
              currency: data.commercial.currency,
              priceMinor: data.commercial.priceMinor,
              termMonths: data.commercial.termMonths,
              automaticRenewal: data.commercial.automaticRenewal,
            }
          : null,
      }),
    )
    .digest("hex");
}
export interface PacketReadiness {
  preparationEvidenceComplete: boolean;
  listingEvidenceComplete: boolean;
  submissionReady: false;
  submissionStatus: "unsent";
  offerEnabled: false;
  gaps: string[];
}
/** Validates an evidence index, not the authenticity/legal sufficiency of referenced records. */
export function auditPacketEvidence(
  input: unknown,
  catalogSha256: string,
  asOf: string,
): PacketReadiness {
  const gaps: string[] = [];
  const parsed = packetEvidenceSchema.safeParse(input);
  if (!date.safeParse(asOf).success) throw new Error("Invalid review date");
  if (!sha.safeParse(catalogSha256).success)
    throw new Error("Invalid catalog hash");
  if (!parsed.success)
    return {
      preparationEvidenceComplete: false,
      listingEvidenceComplete: false,
      submissionReady: false,
      submissionStatus: "unsent",
      offerEnabled: false,
      gaps: ["Missing or invalid restricted evidence index"],
    };
  const data = parsed.data;
  if (data.catalogSha256 !== catalogSha256)
    gaps.push("Evidence index belongs to another catalog");
  const accepted = new Set<string>();
  for (const requirement of requirementIds) {
    const records = data.records.filter((r) => r.requirement === requirement);
    if (records.length !== 1) {
      gaps.push(`${requirement}: exactly one accepted record required`);
      continue;
    }
    const r = records[0];
    if (
      r.catalogSha256 !== catalogSha256 ||
      r.proposalSha256 !== proposalSha256(data) ||
      r.reviewedOn > asOf ||
      r.expiresOn < asOf ||
      r.expiresOn < r.reviewedOn ||
      Date.parse(asOf) - Date.parse(r.reviewedOn) > 90 * 86400000
    ) {
      gaps.push(`${requirement}: stale, future or mismatched evidence`);
      continue;
    }
    accepted.add(requirement);
  }
  if (!data.publicUrls)
    gaps.push("Public product, demo, privacy, terms and support URLs required");
  if (!data.commercial)
    gaps.push("Approved USD price and nonrenewing twelve-month term required");
  const preparationEvidenceComplete =
    data.catalogSha256 === catalogSha256 &&
    !!data.publicUrls &&
    !!data.commercial &&
    preparationRequirements.every((r) => accepted.has(r));
  return {
    preparationEvidenceComplete,
    listingEvidenceComplete:
      preparationEvidenceComplete &&
      approvalRequirements.every((r) => accepted.has(r)),
    submissionReady: false,
    submissionStatus: "unsent",
    offerEnabled: false,
    gaps,
  };
}
