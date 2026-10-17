import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { FastifyRequest } from "fastify";
import { ApiError } from "./repository";
export type Authenticator = (request: FastifyRequest) => Promise<string>;
export type AccessTokenProfile = "rfc9068" | "token-use-access";
export interface AccessTokenConfig {
  issuer: string;
  /** API resource audience, not the interactive sign-in application's client ID. */
  audience: string;
  /** Defaults to RFC 9068's at+jwt header. Alternative requires token_use=access. */
  accessTokenProfile?: AccessTokenProfile;
}
export function developmentAuth(): Authenticator {
  if (process.env.NODE_ENV === "production")
    throw new Error("Development authentication is forbidden in production");
  return async (request) => {
    if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(request.ip))
      throw new ApiError(403, "Development access is loopback-only");
    if (request.headers.authorization !== "Bearer amp-local-development")
      throw new ApiError(401, "Sign in to continue");
    return "development-household";
  };
}
/** Separate seam permits signed-token tests without a network JWKS service. */
export async function verifyAccessToken(
  token: string,
  keys: JWTVerifyGetKey,
  config: AccessTokenConfig,
): Promise<string> {
  const profile = config.accessTokenProfile ?? "rfc9068";
  if (profile !== "rfc9068" && profile !== "token-use-access")
    throw new Error("Unsupported access-token profile");
  const { payload } = await jwtVerify(token, keys, {
    issuer: config.issuer,
    audience: config.audience,
    algorithms: ["RS256", "ES256"],
    requiredClaims: ["exp", "iat", "sub"],
    ...(profile === "rfc9068" ? { typ: "at+jwt" } : {}),
  });
  if (typeof payload.sub !== "string" || !payload.sub.trim())
    throw new Error("Missing subject");
  if (
    typeof payload.iat !== "number" ||
    typeof payload.exp !== "number" ||
    payload.exp <= payload.iat
  )
    throw new Error("Invalid token lifetime");
  if (payload.iat > Math.floor(Date.now() / 1000) + 30)
    throw new Error("Token issued in the future");
  if (profile === "token-use-access" && payload.token_use !== "access")
    throw new Error("An access token is required");
  return `${config.issuer}|${payload.sub}`;
}
export function oidcAuth(
  config: AccessTokenConfig & { jwksUrl: string },
): Authenticator {
  const url = new URL(config.jwksUrl);
  if (url.protocol !== "https:") throw new Error("OIDC JWKS must use HTTPS");
  if (!config.issuer || !config.audience)
    throw new Error("OIDC issuer and API audience are required");
  const keys = createRemoteJWKSet(url);
  return async (request) => {
    const token = request.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
    if (!token) throw new ApiError(401, "Sign in to continue");
    try {
      return await verifyAccessToken(token, keys, config);
    } catch {
      throw new ApiError(401, "Your session has expired. Sign in again");
    }
  };
}
