import * as z from "zod/mini";
/** Existing GA web identifiers only; never email, account ID, or a replacement
 * identifier for a visitor whose browser did not permit analytics storage. */
export const gaSignupContextSchema = z.strictObject({
  clientId: z.string().check(z.regex(/^\d{1,20}\.\d{1,20}$/)),
  sessionId: z.int().check(z.positive(), z.maximum(Number.MAX_SAFE_INTEGER)),
});
export type GaSignupContext = z.infer<typeof gaSignupContextSchema>;
