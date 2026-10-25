import { z } from "zod";

/** Parent-site categories, never contact values, URLs, or form contents. */
export const MARKETING_SCREENS = [
  "marketing_home",
  "marketing_amp",
  "marketing_ar",
  "marketing_az",
  "marketing_other",
] as const;
export const SITE_ACTIONS = [
  "invoice_open",
  "invoice_close",
  "assessment_click",
  "product_click",
  "support_click",
  "funding_provider_click",
  "navigation_click",
] as const;
export const siteActionSchema = z.strictObject({
  eventId: z.uuidv4(),
  action: z.enum(SITE_ACTIONS),
  screen: z.enum(MARKETING_SCREENS),
});

export function marketingScreen(path: string): typeof MARKETING_SCREENS[number] {
  const normalized = path.replace(/\/$/, "");
  if (normalized === "") return "marketing_home";
  if (normalized === "/amp") return "marketing_amp";
  if (normalized === "/esa/arkansas-efa") return "marketing_ar";
  if (normalized === "/esa/arizona-esa") return "marketing_az";
  return "marketing_other";
}
