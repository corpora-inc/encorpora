import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from "jose";
import { microsoftEmailVerified } from "../server/provider-email.js";
import {
  normalizeJoinCode,
  SchoolError,
  ssoProviders,
  type SsoProvider,
} from "./contracts.js";
import type { SchoolRepository } from "./repository.js";
import type { SchoolServices } from "./routes.js";
import { SchoolSignIn, type LiveClass } from "./sign-in.js";
import { limited } from "./sign-in-routes.js";
import { ssoLookupHash } from "./sso-credentials.js";

/** Google and Microsoft sign-in for students: an authorization code flow with
 * PKCE, state and nonce, using the client IDs the parent sign-in already has. The
 * ID token is verified here against the provider's published keys, the student is
 * the one credential their verified address matches in this class's tenant, and
 * what comes out is the same `st_` session a card gets. A student never enters the
 * parent user table. A failure of any kind ends on the class's page, which says
 * what happened and offers the code and card. */

export type OidcProvider = {
  clientId: string;
  clientSecret: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksUri: string;
  /** Whether this token's issuer is this provider. */
  issuer: (claims: JWTPayload) => boolean;
  /** Whether the provider vouches that `email` belongs to this person. */
  emailVerified: (claims: JWTPayload) => boolean;
};
export type OidcProviders = Partial<Record<SsoProvider, OidcProvider>>;

const GOOGLE_ISSUERS = new Set([
  "https://accounts.google.com",
  "accounts.google.com",
]);
/** The real providers, from the parent sign-in's own configuration. */
export function schoolOidcProviders(config: {
  google?: { clientId: string; clientSecret: string };
  microsoft?: { clientId: string; clientSecret: string; tenantId: string };
}): OidcProviders {
  const { google, microsoft } = config;
  return {
    ...(google && {
      google: {
        clientId: google.clientId,
        clientSecret: google.clientSecret,
        authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenEndpoint: "https://oauth2.googleapis.com/token",
        jwksUri: "https://www.googleapis.com/oauth2/v3/certs",
        issuer: ({ iss }) => !!iss && GOOGLE_ISSUERS.has(iss),
        emailVerified: ({ email_verified: verified }) =>
          verified === true || verified === "true",
      },
    }),
    ...(microsoft && {
      microsoft: {
        clientId: microsoft.clientId,
        clientSecret: microsoft.clientSecret,
        authorizationEndpoint: `https://login.microsoftonline.com/${microsoft.tenantId}/oauth2/v2.0/authorize`,
        tokenEndpoint: `https://login.microsoftonline.com/${microsoft.tenantId}/oauth2/v2.0/token`,
        jwksUri: `https://login.microsoftonline.com/${microsoft.tenantId}/discovery/v2.0/keys`,
        // The issuer names the tenant the token came from, which the keys don't.
        issuer: ({ iss, tid }) =>
          typeof tid === "string" &&
          iss === `https://login.microsoftonline.com/${tid}/v2.0`,
        emailVerified: (claims) =>
          microsoftEmailVerified(claims as Record<string, unknown>),
      },
    }),
  };
}

const COOKIE = "amp_school_oidc";
const COOKIE_PATH = "/api/v1/school/join/oidc";
const FLOW_SECONDS = 600;

/** What a student's browser holds between leaving for the provider and coming
 * back. Signed, so it can't be edited to reach another class, and only ever sent
 * to these routes. */
type Flow = {
  provider: SsoProvider;
  code: string;
  state: string;
  nonce: string;
  verifier: string;
  expires: number;
};
const signature = (secret: string, payload: string) =>
  createHmac("sha256", `school-oidc:${secret}`)
    .update(payload)
    .digest("base64url");
function sealFlow(secret: string, flow: Flow) {
  const payload = Buffer.from(JSON.stringify(flow)).toString("base64url");
  return `${payload}.${signature(secret, payload)}`;
}
function openFlow(secret: string, sealed: string | undefined): Flow | null {
  if (!sealed) return null;
  const [payload, mac] = sealed.split(".");
  if (!payload || !mac) return null;
  const expected = Buffer.from(signature(secret, payload));
  const actual = Buffer.from(mac);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    return null;
  try {
    const flow = JSON.parse(
      Buffer.from(payload, "base64url").toString(),
    ) as Flow;
    return flow.expires > Date.now() ? flow : null;
  } catch {
    return null;
  }
}
function cookieOf(request: FastifyRequest): string | undefined {
  for (const part of (request.headers.cookie ?? "").split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === COOKIE) return value.join("=");
  }
  return undefined;
}
const cookie = (value: string, maxAge: number, secure: boolean) =>
  `${COOKIE}=${value}; Path=${COOKIE_PATH}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;

/** Why a sign-in ended on the class page: `?sso=` on `/join/$code`. */
export const ssoProblems = [
  "not_on_roster",
  "email_unverified",
  "declined",
  "expired",
  "failed",
] as const;
export type SsoProblem = (typeof ssoProblems)[number];

/** Keys are cached by the library, and refreshed when a token names a new one. */
const keySets = new Map<string, JWTVerifyGetKey>();
function keysFor(uri: string) {
  let keys = keySets.get(uri);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(uri));
    keySets.set(uri, keys);
  }
  return keys;
}

class Refused extends Error {
  constructor(readonly problem: SsoProblem) {
    super(problem);
  }
}

/** The claims of a token this provider signed, for this app, in this flow. */
export async function verifyIdToken(
  provider: OidcProvider,
  idToken: string,
  nonce: string,
  keys: JWTVerifyGetKey = keysFor(provider.jwksUri),
): Promise<JWTPayload> {
  const { payload } = await jwtVerify(idToken, keys, {
    audience: provider.clientId,
    algorithms: ["RS256"],
    clockTolerance: 60,
  });
  if (!provider.issuer(payload)) throw new Error("issuer");
  if (payload.nonce !== nonce) throw new Error("nonce");
  return payload;
}

async function redeem(
  provider: OidcProvider,
  code: string,
  flow: Flow,
  redirectUri: string,
): Promise<string> {
  const response = await fetch(provider.tokenEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      code_verifier: flow.verifier,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await response.json().catch(() => null)) as {
    id_token?: unknown;
  } | null;
  if (!response.ok || typeof body?.id_token !== "string")
    throw new Error(`token endpoint ${response.status}`);
  return body.id_token;
}

/** The one student this address names in this tenant, by the credential a school
 * turning the provider on created. An address two students share has none. */
async function studentFor(
  repository: SchoolRepository,
  found: LiveClass,
  provider: SsoProvider,
  email: string,
): Promise<string | null> {
  const tenant = found.path[0]!;
  const { rows } = await repository.pool.query(
    `SELECT k.person_id FROM amp_person_credentials k JOIN amp_people p ON p.id=k.person_id
     WHERE k.kind='sso' AND k.lookup_hash=$1 AND k.revoked_at IS NULL
       AND p.tenant_id=$2 AND p.deleted_at IS NULL AND lower(p.email)=$3`,
    [ssoLookupHash(provider, tenant, email), tenant, email],
  );
  return rows.length === 1 ? rows[0].person_id : null;
}

const redirectUriFor = (origin: string, provider: SsoProvider) =>
  `${origin}${COOKIE_PATH}/${provider}/callback`;
/** Every redirect URI a console has to accept, from one origin. */
export const oidcRedirectUris = (origin: string) =>
  Object.fromEntries(
    ssoProviders.map((provider) => [
      provider,
      redirectUriFor(origin, provider),
    ]),
  ) as Record<SsoProvider, string>;

export function registerOidcRoutes(
  scope: FastifyInstance,
  repository: SchoolRepository,
  services: SchoolServices,
) {
  const signIn = new SchoolSignIn(repository);
  const secure = services.origin.startsWith("https:");
  const providerOf = (request: FastifyRequest) => {
    const { provider } = request.params as { provider?: string };
    return ssoProviders.find((id) => id === provider) ?? null;
  };
  /** Back to the class, saying why. The code here has been through a schema and
   * names a real class or nothing, so this can't be pointed anywhere else. */
  const backToClass = (
    reply: FastifyReply,
    code: string | null,
    problem: SsoProblem,
  ) => {
    reply.header("Set-Cookie", cookie("", 0, secure));
    return reply.redirect(
      code ? `/join/${code}?sso=${problem}` : `/join?sso=${problem}`,
      302,
    );
  };

  scope.get(
    `${COOKIE_PATH}/:provider/start`,
    limited,
    async (request, reply) => {
      const provider = providerOf(request);
      const code = normalizeJoinCode(
        String((request.query as { code?: unknown }).code ?? ""),
      );
      const config = provider && services.oidc?.[provider];
      if (!provider || !config) return backToClass(reply, code, "failed");
      let found: LiveClass;
      try {
        found = await signIn.liveClass(code);
      } catch (error) {
        if (error instanceof SchoolError)
          return backToClass(
            reply,
            error.statusCode === 423 ? code : null,
            "failed",
          );
        throw error;
      }
      if (!found.sign_in_providers.includes(provider))
        return backToClass(reply, code, "failed");
      const flow: Flow = {
        provider,
        code,
        state: randomBytes(24).toString("base64url"),
        nonce: randomBytes(24).toString("base64url"),
        verifier: randomBytes(48).toString("base64url"),
        expires: Date.now() + FLOW_SECONDS * 1000,
      };
      reply.header(
        "Set-Cookie",
        cookie(sealFlow(services.secret, flow), FLOW_SECONDS, secure),
      );
      const target = new URL(config.authorizationEndpoint);
      for (const [name, value] of Object.entries({
        client_id: config.clientId,
        redirect_uri: redirectUriFor(services.origin, provider),
        response_type: "code",
        scope: "openid email profile",
        state: flow.state,
        nonce: flow.nonce,
        code_challenge: createHash("sha256")
          .update(flow.verifier)
          .digest("base64url"),
        code_challenge_method: "S256",
        prompt: "select_account",
      }))
        target.searchParams.set(name, value);
      return reply.redirect(target.href, 302);
    },
  );

  scope.get(
    `${COOKIE_PATH}/:provider/callback`,
    limited,
    async (request, reply) => {
      const provider = providerOf(request);
      const config = provider && services.oidc?.[provider];
      const query = request.query as {
        code?: unknown;
        state?: unknown;
        error?: unknown;
      };
      const flow = openFlow(services.secret, cookieOf(request));
      if (
        !provider ||
        !config ||
        !flow ||
        flow.provider !== provider ||
        query.state !== flow.state
      )
        return backToClass(reply, flow?.code ?? null, "expired");
      if (query.error !== undefined)
        return backToClass(
          reply,
          flow.code,
          query.error === "access_denied" ? "declined" : "failed",
        );
      if (typeof query.code !== "string")
        return backToClass(reply, flow.code, "failed");
      try {
        const found = await signIn.liveClass(flow.code);
        if (!found.sign_in_providers.includes(provider))
          throw new Refused("failed");
        const claims = await verifyIdToken(
          config,
          await redeem(
            config,
            query.code,
            flow,
            redirectUriFor(services.origin, provider),
          ),
          flow.nonce,
        );
        const email =
          typeof claims.email === "string" ? claims.email.toLowerCase() : "";
        if (!email || !config.emailVerified(claims))
          throw new Refused("email_unverified");
        const personId = await studentFor(repository, found, provider, email);
        if (!personId) throw new Refused("not_on_roster");
        const grant = await signIn.signInPerson(personId);
        if (!grant) throw new Refused("not_on_roster");
        reply.header("Set-Cookie", cookie("", 0, secure));
        // In the fragment: it never reaches a server or a log, and the app takes
        // it out of the address bar before anything else reads the URL.
        return reply.redirect(
          `/join/continue#${Buffer.from(JSON.stringify(grant)).toString("base64url")}`,
          302,
        );
      } catch (error) {
        // Never the address or the token: only which provider and why.
        request.log.warn(
          { provider, reason: (error as Error).message.slice(0, 80) },
          "School sign-in through a provider was refused",
        );
        return backToClass(
          reply,
          flow.code,
          error instanceof Refused ? error.problem : "failed",
        );
      }
    },
  );
}
