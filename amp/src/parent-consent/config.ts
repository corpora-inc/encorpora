import { ConsentSecrets } from "./crypto.js";
import { loadConsentPolicy } from "./policy.js";
/** Configuration alone never enables delivery or installs a reviewed policy. */
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
  return {
    policy: await loadConsentPolicy(env.AMP_CONSENT_POLICY_FILE),
    secrets,
    // The application includes no production mail transport. A future adapter
    // must be explicitly supplied and verified before this can become true.
    transportEnabled: false,
  };
}
