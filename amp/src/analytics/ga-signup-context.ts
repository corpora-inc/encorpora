import { z } from "zod";
/** Existing GA web identifiers only; never email, account ID, or a replacement
 * identifier for a visitor whose browser did not permit analytics storage. */
export const gaSignupContextSchema = z.strictObject({
  clientId: z.string().regex(/^\d{1,20}\.\d{1,20}$/),
  sessionId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});
export type GaSignupContext = z.infer<typeof gaSignupContextSchema>;
