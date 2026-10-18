import { readFile } from "node:fs/promises";
import { z } from "zod";
const text = z
  .string()
  .trim()
  .min(1)
  .max(1000)
  .refine((v) => !/[\u0000-\u001f\u007f]/.test(v));
const https = z.url().refine((v) => {
  const u = new URL(v);
  return u.protocol === "https:" && !u.username && !u.password;
});
const route = z.strictObject({
  state: z.string().regex(/^[A-Z]{2}$/),
  program: text,
  kind: z.enum(["marketplace", "reimbursement"]),
  instructions: text,
  sourceUrl: https,
  reviewedUntil: z.iso.date(),
});
export const configSchema = z
  .strictObject({
    mode: z.enum(["preview", "production"]).default("preview"),
    siteUrl: https
      .refine((value) => {
        const u = new URL(value);
        return u.pathname === "/" && !u.search && !u.hash;
      }, "Site URL must be an origin")
      .transform((value) => new URL(value).origin)
      .optional(),
    appUrl: https.optional(),
    supportEmail: z.email().optional(),
    operator: z
      .strictObject({ legalName: text, postalAddress: text, telephone: text })
      .optional(),
    privacy: z
      .strictObject({
        retention: text,
        placementBasis: text,
        providers: z
          .array(z.strictObject({ name: text, purpose: text, retention: text }))
          .min(1)
          .max(30),
      })
      .optional(),
    legalReviewed: z.boolean().default(false),
    plans: z
      .array(
        z.strictObject({
          interval: z.enum(["year", "month"]),
          amountMinor: z.number().int().positive().max(100_000_000),
          currency: z.string().regex(/^[A-Z]{3}$/),
          renews: z.boolean(),
        }),
      )
      .max(2)
      .default([]),
    funding: z.array(route).max(100).default([]),
  })
  .superRefine((value, ctx) => {
    if (new Set(value.plans.map((p) => p.interval)).size !== value.plans.length)
      ctx.addIssue({ code: "custom", message: "Duplicate plan interval" });
    if (
      value.mode === "production" &&
      (!value.siteUrl ||
        !value.appUrl ||
        !value.supportEmail ||
        !value.operator ||
        !value.privacy ||
        !value.legalReviewed)
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Production requires app/site URLs, operator contacts and reviewed legal text",
      });
  });
export type SiteConfig = z.infer<typeof configSchema>;
export async function loadConfig(
  path = process.env.CORPORA_SITE_CONFIG,
): Promise<SiteConfig> {
  const config = configSchema.parse(
    path ? JSON.parse(await readFile(path, "utf8")) : {},
  );
  const today = new Date().toISOString().slice(0, 10);
  if (config.funding.some((r) => r.reviewedUntil < today))
    throw new Error("Funding guidance review has expired");
  return config;
}
export function formatPrice(plan: SiteConfig["plans"][number]) {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: plan.currency,
  });
  if (formatter.resolvedOptions().maximumFractionDigits !== 2)
    throw new Error("Only two-decimal currencies are supported");
  return formatter.format(plan.amountMinor / 100);
}
