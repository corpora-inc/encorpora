import { randomBytes } from "node:crypto";

/** Recoverable links must have the same signature on every replica and restart. */
export function linkSecretConfiguration(env: NodeJS.ProcessEnv): string {
  const secret = env.AMP_LINK_SECRET ?? env.AMP_ACCOUNTS_SECRET;
  if (secret !== undefined) {
    if (secret.length < 32 || secret.trim() !== secret)
      throw new Error(
        "AMP_LINK_SECRET or AMP_ACCOUNTS_SECRET must contain at least 32 characters without surrounding whitespace",
      );
    return secret;
  }
  if (
    env.AMP_AUTH_MODE === "development" &&
    ["127.0.0.1", "::1"].includes(env.AMP_HOST ?? "127.0.0.1")
  )
    return randomBytes(32).toString("hex");
  throw new Error(
    "Hosted links require AMP_LINK_SECRET or AMP_ACCOUNTS_SECRET shared across replicas",
  );
}
