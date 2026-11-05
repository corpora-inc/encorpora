import { gaSignupContextSchema } from "../analytics/ga-signup-context.js";
import { z } from "zod";
import { fundedCampaignSchema } from "../analytics/funded-campaign.js";
/** What a parent chose on the signed-out pitch. A choice, not an ad label:
 * it routes the parent after sign-in even when measurement is declined. */
export const pitchEntries = [
  "pitch-try",
  "pitch-workbook",
  "pitch-buy",
] as const;
export type PitchEntry = (typeof pitchEntries)[number];
export function isPitchEntry(value: unknown): value is PitchEntry {
  return (pitchEntries as readonly unknown[]).includes(value);
}
/** v1 offered an unchecked newsletter box; v2 opts new parents in with a one-line notice. */
export const explicitNewsletterNotice = "free-parent-account-v1";
export const signupNotice = "free-parent-account-v2";
export const signupEntrySchema = z.enum([
  "openai-math-path",
  "openai-math-plans",
  ...pitchEntries,
]);
export const signupIntentSchema = z.strictObject({
  program: z.enum(["ar-efa", "az-esa", "nh-efa"]).optional(),
  campaign: fundedCampaignSchema.optional(),
  newsletter: z.boolean(),
  analytics: gaSignupContextSchema.optional(),
  entry: signupEntrySchema.optional(),
  // Pages loaded before a deploy still send the notice they showed.
  notice: z.enum([explicitNewsletterNotice, signupNotice]),
});
export type SignupIntent = z.infer<typeof signupIntentSchema>;
export type FollowupStage = "welcome" | "reminder";
