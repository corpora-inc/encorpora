import { z } from "zod";
import { fundedCampaignSchema } from "../analytics/funded-campaign.js";
export const signupNotice = "free-parent-account-v1";
export const signupEntrySchema = z.enum([
  "openai-math-path",
  "openai-math-plans",
]);
export const signupIntentSchema = z.strictObject({
  program: z.enum(["ar-efa", "az-esa"]).optional(),
  campaign: fundedCampaignSchema.optional(),
  newsletter: z.boolean(),
  entry: signupEntrySchema.optional(),
  notice: z.literal(signupNotice),
});
export type SignupIntent = z.infer<typeof signupIntentSchema>;
export type FollowupStage = "welcome" | "reminder";
