import { z } from "zod";

export const CAMPAIGN_NAMES = ["ar-efa-launch", "az-esa-launch"] as const;
export const CAMPAIGN_PROGRAMS = {
  "ar-efa-launch": {
    state: "AR",
    program: "arkansas-efa",
    programId: "ar-efa",
  },
  "az-esa-launch": { state: "AZ", program: "arizona-esa", programId: "az-esa" },
} as const;

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
  "az-esa-math",
  "az-homeschool-math",
  "shared-hook-ampd-portrait-v1",
  "shared-hook-ampd-square-v1",
  "shared-hook-next-portrait-v1",
  "shared-hook-next-square-v1",
  "az-hook-ampd-portrait-v1",
  "az-hook-ampd-square-v1",
  "az-hook-next-portrait-v1",
  "az-hook-next-square-v1",

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
  "shared-map-cedar-wide-v2",
  "shared-map-marin-vertical-v2",
  "ar-map-cedar-vertical-v2",
  "ar-map-cedar-wide-v2",
  "az-map-marin-vertical-v2",
  "az-map-marin-wide-v2",
  "shared-premium-feed-v1",
  "ar-premium-feed-v1",
  "az-premium-feed-v1",
  "ar-premium-efa-v1",
  "ar-premium-homeschool-v1",
  "az-premium-esa-v1",
  "az-premium-homeschool-v1",
  "shared-map-marin-vertical-v5",
  "shared-map-marin-wide-v5",
  "ar-map-cedar-vertical-v5",
  "ar-map-cedar-wide-v5",
  "az-map-marin-vertical-v5",
  "az-map-marin-wide-v5",
  "shared-practice-marin-vertical-v1",
  "ar-practice-marin-vertical-v1",
  "az-practice-marin-vertical-v1",
  "shared-map-zoom-modus-vertical-v1",
  "ar-map-zoom-modus-vertical-v1",
  "az-map-zoom-modus-vertical-v1",
  "az-funded-better-math-portrait-v3",
  "az-funded-better-math-feed-v3",
  "az-funded-better-math-wide-v3",
  "ar-funded-whats-next-portrait-v3",
  "ar-funded-whats-next-feed-v3",
  "ar-funded-whats-next-wide-v3",
  "az-funded-catch-up-portrait-v3",
  "az-funded-catch-up-feed-v3",
  "az-funded-catch-up-wide-v3",
  "ar-funded-get-ahead-portrait-v3",
  "ar-funded-get-ahead-feed-v3",
  "ar-funded-get-ahead-wide-v3",
  "az-funded-less-planning-portrait-v3",
  "az-funded-less-planning-feed-v3",
  "az-funded-less-planning-wide-v3",
  "ar-funded-your-childs-math-portrait-v3",
  "ar-funded-your-childs-math-feed-v3",
  "ar-funded-your-childs-math-wide-v3",
  "az-funded-right-fit-portrait-v3",
  "az-funded-right-fit-feed-v3",
  "az-funded-right-fit-wide-v3",
  "ar-funded-screen-paper-portrait-v3",
  "ar-funded-screen-paper-feed-v3",
  "ar-funded-screen-paper-wide-v3",
  "az-funded-parent-relief-portrait-v3",
  "az-funded-parent-relief-feed-v3",
  "az-funded-parent-relief-wide-v3",
  "ar-funded-funded-choice-portrait-v3",
  "ar-funded-funded-choice-feed-v3",
  "ar-funded-funded-choice-wide-v3",
  "ar-funded-pmax-child-v1",
  "ar-funded-pmax-planning-v1",
  "az-funded-pmax-child-v1",
  "az-funded-pmax-planning-v1",
] as const;
export const campaignEventSchema = z
  .strictObject({
    state: z.enum(["AR", "AZ"]),
    program: z.enum(["arkansas-efa", "arizona-esa"]),
    campaign: z.enum(["none", ...CAMPAIGN_NAMES]),
    source: z.enum(CAMPAIGN_SOURCES),
    medium: z.enum(CAMPAIGN_MEDIA),
    creative: z.enum(CAMPAIGN_CREATIVES).optional(),
    action: z.enum(["landing_view", "try_click", "invoice_click"]),
  })
  .refine(
    (e) => !e.creative || e.campaign !== "none",
    "Creative requires the launch campaign",
  )
  .refine((e) => {
    const program =
      CAMPAIGN_PROGRAMS[
        e.campaign === "none"
          ? e.state === "AR"
            ? "ar-efa-launch"
            : "az-esa-launch"
          : e.campaign
      ];
    return e.state === program.state && e.program === program.program;
  }, "Campaign, state and program must match");
export type CampaignEvent = z.infer<typeof campaignEventSchema>;
