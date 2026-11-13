import {
  cleverApiVersion,
  type CleverApiVersion,
} from "../schools/clever/client.js";
import {
  resolveProviderSession,
  providerToken,
  providerHash,
} from "../identity/provider-principals.js";
import { fromNodeHeaders } from "better-auth/node";
import type { Pool } from "pg";
import type { Accounts, AccountsConfig } from "./accounts.js";
import type { Authenticator } from "./auth.js";
import type {
  CleverAuthConfig,
  CleverAuthOptions,
} from "../schools/clever-auth.js";
import { resolveCleverPerson } from "../schools/clever/identity.js";
import { SchoolRepository } from "../schools/repository.js";
import { SchoolSignIn } from "../schools/sign-in.js";

export type CleverConfiguration = CleverAuthConfig & {
  apiVersion?: CleverApiVersion;
  districtSignupUrl?: string;
};

/** An entirely absent configuration disables Clever. A partial deployment
 * fails before serving a button or accepting a callback. Never infer the
 * Clever environment from NODE_ENV: sandbox and production are distinct
 * provider identity namespaces and use their own app credentials. */
export function cleverConfiguration(
  env: NodeJS.ProcessEnv,
  accounts?: Pick<AccountsConfig, "baseURL" | "production">,
): CleverConfiguration | null {
  const names = [
    "AMP_CLEVER_CLIENT_ID",
    "AMP_CLEVER_CLIENT_SECRET",
    "AMP_CLEVER_ENVIRONMENT",
    "AMP_CLEVER_DISTRICT_SIGNUP_URL",
    "AMP_CLEVER_API_VERSION",
  ] as const;
  if (names.every((name) => !env[name])) return null;
  const required = (name: (typeof names)[number]) => {
    const value = env[name];
    if (!value || value.trim() !== value)
      throw new Error(`Missing or invalid ${name}`);
    return value;
  };
  const clientId = required("AMP_CLEVER_CLIENT_ID");
  const clientSecret = required("AMP_CLEVER_CLIENT_SECRET");
  const environment = required("AMP_CLEVER_ENVIRONMENT");
  if (environment !== "sandbox" && environment !== "production")
    throw new Error("AMP_CLEVER_ENVIRONMENT must be sandbox or production");
  if (!accounts)
    throw new Error("Clever sign-in requires AMP_AUTH_MODE=accounts");
  const origin = new URL(accounts.baseURL);
  if (
    origin.origin !== accounts.baseURL ||
    !(
      origin.protocol === "https:" ||
      (!accounts.production &&
        origin.protocol === "http:" &&
        ["127.0.0.1", "localhost"].includes(origin.hostname))
    )
  )
    throw new Error("Clever requires the validated AMP_ACCOUNTS_URL origin");
  let districtSignupUrl: string | undefined;
  if (env.AMP_CLEVER_DISTRICT_SIGNUP_URL) {
    districtSignupUrl = required("AMP_CLEVER_DISTRICT_SIGNUP_URL");
    let url: URL;
    try {
      url = new URL(districtSignupUrl);
    } catch {
      throw new Error(
        "AMP_CLEVER_DISTRICT_SIGNUP_URL must be an HTTPS schools.clever.com URL",
      );
    }
    if (
      url.protocol !== "https:" ||
      url.hostname !== "schools.clever.com" ||
      url.port ||
      url.username ||
      url.password ||
      url.hash
    )
      throw new Error(
        "AMP_CLEVER_DISTRICT_SIGNUP_URL must be an HTTPS schools.clever.com URL without credentials or a fragment",
      );
  }
  return {
    clientId,
    clientSecret,
    apiVersion: cleverApiVersion(env.AMP_CLEVER_API_VERSION),
    environment,
    origin: accounts.baseURL,
    ...(districtSignupUrl ? { districtSignupUrl } : {}),
  };
}

/** The same adapter is used by the production entrypoint and integration
 * tests. Its student grant and adult session proofs are the real stores. */
export function cleverAuthOptions(
  pool: Pool,
  accounts: Accounts,
  config: CleverConfiguration,
  authenticate: Authenticator,
): CleverAuthOptions {
  const signIn = new SchoolSignIn(new SchoolRepository(pool));
  return {
    pool,
    config,
    authenticate,
    resolvePerson: (claims) => resolveCleverPerson(pool, claims),
    signInPerson: (personId) => signIn.signInPerson(personId),
    freshAccountSession: async (request) => {
      const token = providerToken(request);
      if (token) {
        const provider = await resolveProviderSession(pool, request, (claims) =>
          resolveCleverPerson(pool, claims),
        );
        return provider
          ? {
              accountId: provider.accountId,
              sessionId: `provider:${providerHash(token)}`,
              createdAt: provider.createdAt,
            }
          : null;
      }
      // An onboarding proof is not a session and cannot link another identity.
      if (request.headers.authorization?.startsWith("Bearer po_")) return null;
      const current = await accounts.auth.api.getSession({
        headers: fromNodeHeaders(request.headers),
        query: { disableCookieCache: true, disableRefresh: true },
      });
      return current
        ? {
            accountId: `amp|${current.user.id}`,
            sessionId: current.session.id,
            createdAt: new Date(current.session.createdAt),
          }
        : null;
    },
    clearAccountSession: async (request, reply) => {
      const headers = fromNodeHeaders(request.headers);
      // The OAuth callback has already proved a deliberate browser login.
      // Clear that browser's previous mailbox session, not a caller-supplied
      // provider/student bearer token, and do not invoke upstream IdP logout.
      headers.delete("authorization");
      headers.set("origin", accounts.config.baseURL);
      const current = await accounts.auth.api.getSession({
        headers,
        query: { disableCookieCache: true, disableRefresh: true },
      });
      const response = await accounts.auth.api.signOut({
        headers,
        body: { disableRedirect: true },
        asResponse: true,
      });
      if (!response.ok) throw new Error("clever_previous_session_not_cleared");
      if (
        current &&
        (
          await pool.query(
            'SELECT 1 FROM amp_auth_sessions WHERE id=$1 AND "userId"=$2',
            [current.session.id, current.user.id],
          )
        ).rowCount
      )
        throw new Error("clever_previous_session_not_cleared");
      const previous = reply.getHeader("set-cookie");
      reply.header("set-cookie", [
        ...(Array.isArray(previous)
          ? previous
          : previous
            ? [String(previous)]
            : []),
        ...response.headers.getSetCookie(),
      ]);
    },
  };
}
