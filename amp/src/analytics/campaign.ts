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
/** Creative labels identify authored ads, never people or platform click IDs.
 * Append only: retained financial attribution must continue to parse. */
export const CAMPAIGN_CREATIVES = [
  "efa-math",
  "homeschool-math",
  "efa-product-v1",
  "efa-facebook-feed-v1",
  "efa-facebook-vertical-v1",
  "efa-instagram-vertical-v1",
  "hook-ampd-efa-v2",
  "hook-ampd-assessment-v2",
  "hook-next-efa-v2",
  "hook-next-assessment-v2",
  "hook-path-efa-v2",
  "hook-path-assessment-v2",
  "hook-ampd-up-efa-v2",
  "hook-ampd-up-assessment-v2",
  "hook-plug-efa-v2",
  "hook-plug-assessment-v2",
] as const;
export const campaignEventSchema = z
  .strictObject({
    state: z.literal("AR"),
    program: z.literal("arkansas-efa"),
    campaign: z.enum(["none", "ar-efa-launch"]),
    source: z.enum(CAMPAIGN_SOURCES),
    medium: z.enum(CAMPAIGN_MEDIA),
    creative: z.enum(CAMPAIGN_CREATIVES).optional(),
    action: z.enum(["landing_view", "try_click", "invoice_click"]),
  })
  .refine(
    (e) => !e.creative || e.campaign === "ar-efa-launch",
    "Creative requires the launch campaign",
  );
export type CampaignEvent = z.infer<typeof campaignEventSchema>;
