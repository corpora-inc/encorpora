import { z } from "zod";

/** Fixed campaign vocabulary. Never accept arbitrary URL/query values. */
export const CAMPAIGN_SOURCES = [
  "direct",
  "facebook",
  "instagram",
  "google",
  "email",
  "youtube",
] as const;
export const CAMPAIGN_MEDIA = [
  "none",
  "paid-social",
  "cpc",
  "email",
  "organic-social",
] as const;
export const campaignEventSchema = z.strictObject({
  state: z.literal("AR"),
  program: z.literal("arkansas-efa"),
  campaign: z.enum(["none", "ar-efa-launch"]),
  source: z.enum(CAMPAIGN_SOURCES),
  medium: z.enum(CAMPAIGN_MEDIA),
  action: z.enum(["landing_view", "try_click", "invoice_click"]),
});
export type CampaignEvent = z.infer<typeof campaignEventSchema>;
