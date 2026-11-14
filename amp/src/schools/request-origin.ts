/** A POST another site could have made with this browser's cookie (CSRF):
 * one from a cross-site page, or a cookie sign-in from any origin but AMP's.
 * A request that carries its own credential in `Authorization` is never one
 * (another site can't send that header without a CORS preflight AMP never
 * grants, nor know our token), so it passes whatever
 * its origin: a student's heartbeat from a phone on a private preview host,
 * a native app's own origin. AMP's pages may be served from more than one
 * origin (a private preview host beside the configured one); `origins` is
 * every one of them, the same set sign-in trusts. `strict` refuses a cookie
 * sign-in outright when no origin is configured. */
export function forgedPost(
  request: {
    method: string;
    headers: {
      authorization?: string;
      cookie?: string;
      origin?: string;
      "sec-fetch-site"?: string | string[];
    };
  },
  origins: string | readonly string[] | undefined,
  strict = false,
): boolean {
  // Only a bearer token is the request's own credential: a browser sends
  // cached HTTP Basic credentials by itself, alongside the cookies.
  if (
    request.method !== "POST" ||
    /^bearer\s/i.test(request.headers.authorization ?? "")
  )
    return false;
  if (request.headers["sec-fetch-site"] === "cross-site") return true;
  const allowed = (
    typeof origins === "string" ? [origins] : (origins ?? [])
  ).filter(Boolean);
  if (!allowed.length) return strict && !!request.headers.cookie;
  const from = request.headers.origin;
  const ours = !!from && allowed.includes(from);
  return (!!from && !ours) || (!!request.headers.cookie && !ours);
}

/** Every origin AMP's own pages are served from: the configured one and the
 * ones sign-in also trusts (AMP_ACCOUNTS_TRUSTED_ORIGINS). The school guards
 * accept exactly this set, so a page that can sign in can also post. */
export function pageOrigins(
  config: { baseURL: string; trustedOrigins: readonly string[] } | null,
): string[] {
  if (!config) return [];
  return [...new Set([config.baseURL, ...config.trustedOrigins])].filter(
    Boolean,
  );
}
