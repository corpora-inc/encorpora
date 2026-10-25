import { z } from "zod";

const day = z.iso.date();
const count = z.number().int().nonnegative().safe();
const label = z.string().trim().min(1).max(180);
const campaign = z.string().regex(/^[a-z0-9._~-]{1,64}$/);
const source = z
  .strictObject({
    platform: z.enum(["google", "meta", "openai"]),
    observedAt: z.iso.datetime({ offset: true }),
    from: day,
    through: day,
    timeZone: label.refine((value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }),
    currency: z.string().regex(/^[A-Z]{3}$/),
    clickMetric: z.enum(["ad_clicks", "link_clicks", "outbound_clicks"]),
    note: z.string().trim().min(1).max(1000).optional(),
    billing: z
      .strictObject({
        amountMicros: count,
        label: z.string().trim().min(1).max(180),
      })
      .optional(),
    rows: z
      .array(
        z.strictObject({
          id: label,
          label,
          utmSources: z
            .array(campaign)
            .min(1)
            .max(10)
            .refine((values) => new Set(values).size === values.length)
            .optional(),
          utmCampaign: campaign.optional(),
          impressions: count,
          clicks: count,
          spendMicros: count.nullable(),
        }),
      )
      .max(5000),
  })
  .superRefine((value, ctx) => {
    if (value.from > value.through)
      ctx.addIssue({ code: "custom", message: "Invalid cost date range" });
    if (new Set(value.rows.map((row) => row.id)).size !== value.rows.length)
      ctx.addIssue({
        code: "custom",
        message: "Duplicate native campaign rows",
      });
    if (value.rows.some((row) => row.spendMicros === null) && !value.note)
      ctx.addIssue({
        code: "custom",
        message: "Unresolved spend requires an explanation",
      });
    for (const row of value.rows)
      if (Boolean(row.utmSources) !== Boolean(row.utmCampaign))
        ctx.addIssue({
          code: "custom",
          message: "Attribution mapping requires UTM sources and campaign",
        });
    for (const key of ["impressions", "clicks", "spendMicros"] as const)
      if (
        !Number.isSafeInteger(
          value.rows.reduce((n, row) => n + (row[key] ?? 0), 0),
        )
      )
        ctx.addIssue({
          code: "custom",
          message: "Cost totals exceed safe integer range",
        });
  });

/** Snapshots are campaign totals for the stated provider-local calendar window.
 * Native campaign IDs deduplicate rows; UTM mappings must come from configured
 * ads, never inferred from names. Missing platforms are not zero-spend platforms.
 */
export const adCostsSchema = z
  .strictObject({ sources: z.array(source).max(3) })
  .superRefine((value, ctx) => {
    if (
      new Set(value.sources.map((s) => s.platform)).size !==
      value.sources.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Only one snapshot per platform",
      });
  });
export type AdCosts = z.infer<typeof adCostsSchema>;
export function costTotals(costs: AdCosts) {
  return costs.sources.map((source) => {
    const impressions = source.rows.reduce((n, r) => n + r.impressions, 0);
    const clicks = source.rows.reduce((n, r) => n + r.clicks, 0);
    const spendMicros = source.rows.some((r) => r.spendMicros === null)
      ? null
      : source.rows.reduce((n, r) => n + r.spendMicros!, 0);
    return {
      ...source,
      impressions,
      clicks,
      spendMicros,
      costPerClickMicros:
        clicks && spendMicros !== null ? spendMicros / clicks : null,
    };
  });
}
