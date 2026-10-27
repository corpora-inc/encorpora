import { z } from "zod";
import { fundedCampaignSchema } from "../analytics/funded-campaign.js";
/** v1 offered an unchecked newsletter box; v2 opts new parents in with a one-line notice. */
export const explicitNewsletterNotice = "free-parent-account-v1";
export const signupNotice = "free-parent-account-v2";
export const signupEntrySchema = z.enum([
  "openai-math-path",
  "openai-math-plans",
]);
export const signupIntentSchema = z.strictObject({
  program: z.enum(["ar-efa", "az-esa"]).optional(),
  campaign: fundedCampaignSchema.optional(),
  newsletter: z.boolean(),
  entry: signupEntrySchema.optional(),
  // Pages loaded before a deploy still send the notice they showed.
  notice: z.enum([explicitNewsletterNotice, signupNotice]),
});
export type SignupIntent = z.infer<typeof signupIntentSchema>;
export type FollowupStage = "welcome" | "reminder";
