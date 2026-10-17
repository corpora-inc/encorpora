import { z } from "zod";
export const EMAIL_PLUS_METHOD = "internal-email-plus-v1";
const text = z
  .string()
  .trim()
  .min(1)
  .max(4000)
  .refine((v) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v));
const https = z
  .string()
  .url()
  .refine((v) => {
    const u = new URL(v);
    return u.protocol === "https:" && !u.username && !u.password && !u.hash;
  });
export const noticeSchema = z.strictObject({
  version: text.max(100),
  operator: z.strictObject({
    name: text.max(200),
    address: text.max(600),
    telephone: text.max(80),
    email: z.email(),
  }),
  privacyUrl: https,
  parentAccountUrl: https,
  childData: z
    .array(
      z.strictObject({
        category: text.max(200),
        purpose: text.max(600),
        retention: text.max(600),
      }),
    )
    .min(1)
    .max(30),
  processors: z
    .array(
      z.strictObject({
        name: text.max(200),
        service: text.max(300),
        data: text.max(600),
        purpose: text.max(600),
        retention: text.max(600),
      }),
    )
    .max(30),
  reviewAndDeletion: text,
  pendingContactDays: z.number().int().min(2).max(14),
  withdrawnEvidenceDays: z.number().int().min(1).max(730),
  evidenceRetentionPurpose: text.max(1000),
});
export const consentPolicySchema = z
  .strictObject({
    enabled: z.boolean().default(false),
    notice: noticeSchema,
    confirmationDelayHours: z.number().int().min(24).max(72).default(24),
    review: z.strictObject({
      reference: text.max(500),
      expiresAt: z.iso.datetime(),
      noDisclosureUnder312_2: z.literal(true),
      providerContractsReviewed: z.literal(true),
      deploymentFlowsComplete: z.literal(true),
    }),
  })
  .refine(
    (p) => p.notice.pendingContactDays * 24 > p.confirmationDelayHours + 12,
    "Pending period must allow time for both confirmations",
  );
export type ConsentPolicy = z.infer<typeof consentPolicySchema>;
export type DirectNotice = z.infer<typeof noticeSchema>;
export type ConsentStage = "initial" | "confirmation";
export type ConsentPhase =
  | "awaiting-initial"
  | "awaiting-confirmation"
  | "active"
  | "withdrawn"
  | "expired"
  | "replaced";
export const beginConsentSchema = z.strictObject({
  email: z
    .email()
    .max(254)
    .refine((v) => !/[\r\n]/.test(v)),
  noticeDigest: z.string().regex(/^[a-f0-9]{64}$/),
  requestId: z.uuid(),
  parentAttestation: z.literal(true),
});
export const acknowledgeConsentSchema = z.strictObject({
  requestId: z.uuid(),
  stage: z.enum(["initial", "confirmation"]),
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  noticeDigest: z.string().regex(/^[a-f0-9]{64}$/),
  parentAttestation: z.literal(true),
});
export interface ConsentView {
  consentActive: boolean;
  available: boolean;
  notice: DirectNotice | null;
  noticeDigest: string | null;
  confirmationDelayHours: number | null;
  request: {
    id: string;
    phase: ConsentPhase | "policy-changed";
    createdAt: string;
    expiresAt: string;
    confirmationAfter: string | null;
    delivery: "queued" | "accepted" | "rejected" | "stopped-unknown" | null;
  } | null;
}
export class ConsentError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode = 409,
  ) {
    super(code);
  }
}
/** A delivery adapter must preserve the same idempotency key across ambiguous retries.
 * Accepted means provider acceptance only, never parental consent or guaranteed delivery. */
export interface ConsentMail {
  idempotencyKey: string;
  recipient: string;
  subject: string;
  text: string;
}
export type DeliveryResult =
  | { kind: "accepted"; receipt: string }
  | { kind: "rejected" }
  | { kind: "unknown" }
  | { kind: "conflict" };
export interface ConsentTransport {
  readonly binding: {
    provider: string;
    sender: string;
    credentialFingerprint: string;
  };
  send(
    message: ConsentMail,
    options: { signal: AbortSignal },
  ): Promise<DeliveryResult>;
}
