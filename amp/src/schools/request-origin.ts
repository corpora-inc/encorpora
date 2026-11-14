/** A POST another site could have made with this browser's cookie (CSRF):
 * one from a cross-site page, or a cookie sign-in from any origin but AMP's.
 * A request that carries its own credential in `Authorization` is never one
 * (another site can't send that header without a CORS preflight AMP never
 * grants, nor know our token), so it passes whatever
 * its origin: a student's heartbeat from a phone on a private preview host,
 * a native app's own origin. `strict` refuses a cookie sign-in outright when
 * AMP's origin isn't configured. */
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
  origin: string | undefined,
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
  const from = request.headers.origin;
  if (!origin) return strict && !!request.headers.cookie;
  return (
    (!!from && from !== origin) || (!!request.headers.cookie && from !== origin)
  );
}
