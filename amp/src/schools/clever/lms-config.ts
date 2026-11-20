/**
 * LMS Connect stays off until Clever enables it for the app. Set
 * `AMP_CLEVER_LMS_CONNECT=enabled` in both the API and the worker, beside the
 * Clever variables. LMS Connect exists only on API v3.1, so a deployment
 * pinned to 3.0 fails at startup rather than at the first gradebook write.
 */
export function lmsConnectEnabled(env: NodeJS.ProcessEnv): boolean {
  const value = env.AMP_CLEVER_LMS_CONNECT;
  if (value === undefined || value === "") return false;
  if (value !== "enabled")
    throw new Error("AMP_CLEVER_LMS_CONNECT must be enabled or unset");
  if ((env.AMP_CLEVER_API_VERSION ?? "3.1") !== "3.1")
    throw new Error(
      "AMP_CLEVER_LMS_CONNECT requires AMP_CLEVER_API_VERSION=3.1",
    );
  return true;
}

/** Where a student opens AMP from an LMS assignment: the AMP origin. */
export function lmsOrigin(env: NodeJS.ProcessEnv): string {
  const raw = env.AMP_ACCOUNTS_URL;
  if (!raw) throw new Error("AMP_ACCOUNTS_URL is required for LMS Connect");
  const url = new URL(raw);
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && url.hostname === "127.0.0.1")
  )
    throw new Error("AMP_ACCOUNTS_URL must use HTTPS for LMS Connect");
  return url.origin;
}
