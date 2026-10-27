import { z } from "zod";
import { figureCapabilities, publicProblemSchema } from "../math/contracts.js";
export const capabilitySchema = z.strictObject({
  responseCapabilities: z
    .array(z.literal("single-choice-v1"))
    .max(1)
    .default([]),
  figureCapabilities: z
    .array(z.enum(figureCapabilities))
    .max(figureCapabilities.length)
    .default([]),
});
export const issueSchema = capabilitySchema.extend({
  requestId: z.string().uuid(),
});
export const reconcileSchema = z.strictObject({
  attempts: z
    .array(
      z.strictObject({
        requestId: z.string().uuid(),
        problemId: z.string().regex(/^[a-f0-9]{64}$/),
        response: z.string().min(1).max(100),
      }),
    )
    .min(1)
    .max(15),
});
export const packSchema = z
  .strictObject({
    format: z.literal("amp-offline-v1"),
    serviceId: z.string().url().max(200),
    accountBinding: z.string().regex(/^[a-f0-9]{64}$/),
    authorization: z.strictObject({
      consentRevision: z.string().regex(/^[a-f0-9]{64}$/),
      grantBinding: z.string().regex(/^[a-f0-9]{64}$/),
    }),
    packId: z.string().uuid(),
    learnerId: z.string().uuid(),
    issuedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    selectionPolicy: z.literal("mixed-five-three-variants-v1"),
    evidence: z.literal("offline-provisional"),
    capabilities: capabilitySchema,
    items: z
      .array(
        z.strictObject({
          problem: publicProblemSchema,
          graderVersion: z.literal(1),
          reason: z.enum([
            "review",
            "revisit",
            "prerequisite",
            "frontier",
            "explore",
            "variant",
          ]),
          strand: z.string().min(1).max(100),
          // Inspectable self-checks belong only to this authenticated offline envelope.
          selfCheck: z.strictObject({
            answer: z.string().max(200),
            hint: z.string().max(2000),
            explanation: z.array(z.string().max(4000)).max(20),
          }),
        }),
      )
      .min(1)
      .max(15),
  })
  .superRefine((pack, ctx) => {
    // Grader v1 predates multiple selections, plotted points, multi-part
    // choices and figure choices. Its immutable protocol must not widen when
    // the online public-problem schema gains a response kind.
    if (
      pack.items.some(
        (item) =>
          item.problem.response.kind !== "number" &&
          item.problem.response.kind !== "fraction" &&
          item.problem.response.kind !== "choice",
      )
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Offline grader v1 supports only typed and single-choice answers",
      });
    const issued = Date.parse(pack.issuedAt),
      expires = Date.parse(pack.expiresAt);
    if (expires <= issued || expires - issued > 86400000)
      ctx.addIssue({
        code: "custom",
        message: "Invalid offline lease interval",
      });
    if (
      new Set(pack.items.map((item) => item.problem.id)).size !==
      pack.items.length
    )
      ctx.addIssue({ code: "custom", message: "Duplicate offline instance" });
  });
export type OfflinePack = z.infer<typeof packSchema>;
export type IssueInput = z.infer<typeof issueSchema>;
export type ReconcileInput = z.infer<typeof reconcileSchema>;
