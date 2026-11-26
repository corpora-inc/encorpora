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
/** An account made without a parent sign-up intent (a teacher from /schools,
 * an invited adult, a sign-in that skipped the pitch). It gets the row every
 * account has, opted in like a parent who left the default: US commercial
 * email is opt-out (CAN-SPAM, 15 U.S.C. 7704(a)(3)-(5)), so the duty is the
 * unsubscribe link and postal address in each message, not a prior consent.
 * The account's first intent later fills in its attribution
 * (repository.ts `completeSignup`). */
export const accountNotice = "account-default-v1";
export const signupEntrySchema = z.enum([
  "openai-math-path",
  "openai-math-plans",
  ...pitchEntries,
]);
export const signupIntentSchema = z.strictObject({
  program: z.enum(["ar-efa", "az-esa", "nh-efa"]).optional(),
  campaign: fundedCampaignSchema.optional(),
  newsletter: z.boolean(),
  analytics: z.optional(gaSignupContextSchema),
  entry: signupEntrySchema.optional(),
  // Pages loaded before a deploy still send the notice they showed.
  notice: z.enum([explicitNewsletterNotice, signupNotice]),
  /** Sent after the account was created: the intent couldn't be recorded
   * before sign-up (web/features/auth/signup-intent.ts), which never waits
   * on it. The account still counts as new if made just before. */
  late: z.literal(true).optional(),
});
export type SignupIntent = z.infer<typeof signupIntentSchema>;
export type FollowupStage = "welcome" | "reminder";
