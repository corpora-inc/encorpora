import { resendConfiguration } from "./resend.js";
import { ConsentSecrets } from "./crypto.js";
import { loadConsentPolicy } from "./policy.js";
/** Transport opt-in never installs or approves a reviewed consent policy. */
export async function consentConfiguration(env: NodeJS.ProcessEnv) {
  const encoded = env.AMP_CONSENT_SECRET_BASE64;
  let secrets: ConsentSecrets | null = null;
  if (encoded !== undefined) {
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.length !== 32 || bytes.toString("base64") !== encoded)
      throw new Error(
        "AMP_CONSENT_SECRET_BASE64 must encode exactly 32 random bytes",
      );
    secrets = new ConsentSecrets(bytes);
  }
  const policy = await loadConsentPolicy(env.AMP_CONSENT_POLICY_FILE);
  const delivery = resendConfiguration(env, policy);
  if (delivery && !secrets)
    throw new Error("Consent delivery requires encryption configuration");
  return {
    policy,
    delivery,
    secrets,
    transportEnabled: delivery !== null,
  };
}
