import { randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import type { Authenticator } from "../server/auth.js";
import type { StudentGrant } from "./contracts.js";
import {
  establishProviderPrincipal,
  isCleverAdult,
  PROVIDER_COOKIE,
  providerHash,
  providerToken,
  requestCookie,
  resolveProviderSession,
  verifiedCleverOnboarding,
  revokeProviderSession,
  type CleverClaims,
  type ResolveCleverPerson,
} from "../identity/provider-principals.js";

export type CleverAuthConfig = {
  clientId: string;
  clientSecret: string;
  origin: string;
  environment: "sandbox" | "production";
};
export type FreshAccountProof = {
  accountId: string;
  sessionId: string;
  createdAt: Date;
};
export type CleverAuthOptions = {
  pool: Pool;
  config: CleverAuthConfig;
  resolvePerson: ResolveCleverPerson;
  signInPerson: (personId: string) => Promise<StudentGrant | null>;
  authenticate: Authenticator;
  /** Read an actual, uncached Better Auth session. Both ends of account
   * linking must prove the same recently authenticated existing account. */
  freshAccountSession?: (
    request: FastifyRequest,
  ) => Promise<FreshAccountProof | null>;
  /** Invalidate the previous Better Auth login on a shared browser. */
  clearAccountSession: (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => Promise<void>;
  /** Test transport only; endpoints remain fixed to Clever. */
  fetch?: typeof fetch;
};
const ROOT = "/api/v1/school/sso/clever";
const FLOW_COOKIE = "amp.clever-flow";
const OPAQUE = /^[\w-]{43}$/;
const id = z.string().min(1).max(128);
const userSchema = z.object({
  id,
  district: id,
  roles: z.object({
    teacher: z
      .object({ schools: z.array(id).optional() })
      .passthrough()
      .optional(),
    staff: z
      .object({ schools: z.array(id).optional() })
      .passthrough()
      .optional(),
    district_admin: z.object({}).passthrough().optional(),
    student: z.object({}).passthrough().optional(),
    contact: z.object({}).passthrough().optional(),
  }),
});

/** A profile email is not a verified mailbox. Only the provider's subject,
 * district, role and school claims enter the authentication model. */
export async function exchangeCleverIdentity(
  config: CleverAuthConfig,
  code: string,
  transport: typeof fetch = fetch,
): Promise<CleverClaims> {
  const tokenResponse = await transport("https://clever.com/oauth/tokens", {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
    headers: {
      authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      redirect_uri: `${config.origin}${ROOT}/callback`,
    }),
  });
  if (!tokenResponse.ok) throw new Error("clever_token_failed");
  const token = z
    .object({
      access_token: z.string().min(1),
      token_type: z.string().optional(),
    })
    .parse(await tokenResponse.json());
  if (token.token_type && token.token_type.toLowerCase() !== "bearer")
    throw new Error("clever_token_type");
  const read = async (path: string) => {
    const response = await transport(`https://api.clever.com/v3.0${path}`, {
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
      headers: { authorization: `Bearer ${token.access_token}` },
    });
    if (!response.ok) throw new Error("clever_profile_failed");
    return response.json();
  };
  const me = z
    .object({
      type: z.literal("user").optional(),
      data: z.object({ id, district: id, type: z.literal("user").optional() }),
    })
    .parse(await read("/me"));
  const user = z
    .object({ data: userSchema })
    .parse(await read(`/users/${encodeURIComponent(me.data.id)}`)).data;
  if (user.id !== me.data.id || user.district !== me.data.district)
    throw new Error("clever_identity_mismatch");
  const roles = Object.entries(user.roles)
    .filter(([, value]) => value !== undefined)
    .map(([role]) => role);
  if (
    (roles.includes("student") || roles.includes("contact")) &&
    roles.length !== 1
  )
    throw new Error("clever_invalid_roles");
  return {
    environment: config.environment,
    districtId: user.district,
    userId: user.id,
    roles,
    schools: [
      ...new Set([
        ...(user.roles.teacher?.schools ?? []),
        ...(user.roles.staff?.schools ?? []),
      ]),
    ],
  };
}

function cookie(
  reply: FastifyReply,
  name: string,
  value: string,
  secure: boolean,
  seconds: number,
  path = "/",
) {
  const old = reply.getHeader("set-cookie");
  const added = `${name}=${value}; Path=${path}; HttpOnly; SameSite=Lax; Max-Age=${seconds}${secure ? "; Secure" : ""}`;
  reply.header("set-cookie", [
    ...(Array.isArray(old) ? old : old ? [String(old)] : []),
    added,
  ]);
}
function recent(
  proof: FreshAccountProof | null | undefined,
): proof is FreshAccountProof {
  if (!proof) return false;
  const age = Date.now() - new Date(proof.createdAt).getTime();
  return age >= 0 && age < 10 * 60_000;
}
const proofHash = (proof: FreshAccountProof) =>
  providerHash(`${proof.accountId}:${proof.sessionId}`);

export async function registerCleverAuthRoutes(
  app: FastifyInstance,
  options: CleverAuthOptions,
) {
  const { pool, config } = options;
  const origin = new URL(config.origin);
  if (
    origin.origin !== config.origin ||
    (origin.protocol !== "https:" &&
      !(
        origin.protocol === "http:" &&
        ["127.0.0.1", "localhost"].includes(origin.hostname)
      )) ||
    !config.clientId ||
    !config.clientSecret
  )
    throw new Error(
      "Clever needs credentials and an exact HTTPS origin (loopback allowed for development)",
    );
  const secure = origin.protocol === "https:";
  const sameOrigin = (request: FastifyRequest) =>
    request.headers.origin === config.origin;
  const start = async (reply: FastifyReply, proof?: FreshAccountProof) => {
    const state = randomBytes(32).toString("base64url");
    const browser = randomBytes(32).toString("base64url");
    await pool.query(
      "DELETE FROM amp_provider_oauth_flows WHERE expires_at<now()-interval '1 day'",
    );
    await pool.query(
      "INSERT INTO amp_provider_oauth_flows(state_hash,browser_hash,link_account_id,link_proof_hash) VALUES($1,$2,$3,$4)",
      [
        providerHash(state),
        providerHash(browser),
        proof?.accountId ?? null,
        proof ? proofHash(proof) : null,
      ],
    );
    cookie(reply, FLOW_COOKIE, browser, secure, 600, ROOT);
    const url = new URL("https://clever.com/oauth/authorize");
    url.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: `${config.origin}${ROOT}/callback`,
      response_type: "code",
      state,
    }).toString();
    return url.href;
  };
  app.get(
    `${ROOT}/start`,
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (_request, reply) => {
      reply.header("cache-control", "no-store");
      return reply.redirect(await start(reply));
    },
  );
  app.post(`${ROOT}/link`, async (request, reply) => {
    reply.header("cache-control", "no-store");
    if (!sameOrigin(request))
      return reply.code(403).send({ error: "origin_required" });
    const account = await options.authenticate(request);
    const proof = await options.freshAccountSession?.(request);
    if (!recent(proof) || proof.accountId !== account)
      return reply.code(403).send({ error: "reauth_required" });
    return { url: await start(reply, proof) };
  });
  app.get(
    `${ROOT}/callback`,
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request, reply) => {
      reply
        .header("cache-control", "no-store")
        .header("referrer-policy", "no-referrer");
      const query = z
        .object({
          code: z.string().max(4096).optional(),
          state: z.string().max(128).optional(),
          error: z.string().max(256).optional(),
        })
        .safeParse(request.query);
      if (!query.success || query.data.error || !query.data.code)
        return reply.redirect("/sign-in?error=clever_sign_in_failed");
      const { code, state } = query.data;
      // Clever Portal initiates a callback without AMP state. Discard that code
      // and restart in this browser; never redeem an unbound authorization code.
      if (!state) return reply.redirect(await start(reply));
      const browser = requestCookie(request, FLOW_COOKIE);
      if (!OPAQUE.test(state) || !browser || !OPAQUE.test(browser))
        return reply.redirect("/sign-in?error=clever_sign_in_failed");
      cookie(reply, FLOW_COOKIE, "", secure, 0, ROOT);
      try {
        // Claim before any network call. Code hash uniqueness also prevents the
        // same provider code being redeemed through two separately valid flows.
        const flow = (
          await pool.query(
            `UPDATE amp_provider_oauth_flows SET consumed_at=now(),code_hash=$3
        WHERE state_hash=$1 AND browser_hash=$2 AND expires_at>now() AND consumed_at IS NULL
        RETURNING link_account_id,link_proof_hash`,
            [providerHash(state), providerHash(browser), providerHash(code)],
          )
        ).rows[0];
        if (!flow) throw new Error("clever_invalid_state");
        if (flow.link_account_id) {
          const proof = await options.freshAccountSession?.(request);
          if (
            !recent(proof) ||
            proof.accountId !== flow.link_account_id ||
            proofHash(proof) !== flow.link_proof_hash
          )
            throw new Error("clever_link_proof_expired");
        }
        const claims = await exchangeCleverIdentity(
          config,
          code,
          options.fetch,
        );
        const person = await options.resolvePerson(claims);
        if (claims.roles.includes("student")) {
          if (
            flow.link_account_id ||
            !person ||
            !person.roles.includes("student")
          )
            throw new Error("clever_student_unavailable");
          const grant = await options.signInPerson(person.personId);
          if (!grant) throw new Error("clever_student_unavailable");
          await revokeProviderSession(pool, request);
          await options.clearAccountSession?.(request, reply);
          cookie(reply, PROVIDER_COOKIE, "", secure, 0);
          return reply.redirect(
            `/join/continue#${Buffer.from(JSON.stringify(grant)).toString("base64url")}`,
          );
        }
        if (
          !isCleverAdult(claims.roles) ||
          (person && !isCleverAdult(person.roles))
        )
          throw new Error("clever_staff_unavailable");
        const session = await establishProviderPrincipal(
          pool,
          claims,
          person,
          flow.link_account_id,
        );
        await revokeProviderSession(pool, request);
        if (!flow.link_account_id)
          await options.clearAccountSession?.(request, reply);
        if (session.onboarding) {
          cookie(reply, PROVIDER_COOKIE, "", secure, 0);
          return reply.redirect(
            `/school/connect#clever-onboarding=${session.token}`,
          );
        }
        cookie(reply, PROVIDER_COOKIE, session.token, secure, 7200);
        return reply.redirect(
          `${person ? "/school" : "/school/connect"}#clever-session=${session.token}`,
        );
      } catch (error) {
        request.log.warn(
          {
            cleverSignInFailed:
              error instanceof Error && /^clever_/.test(error.message)
                ? error.message
                : "identity_failed",
          },
          "Clever sign-in failed",
        );
        return reply.redirect("/sign-in?error=clever_sign_in_failed");
      }
    },
  );
  app.get("/api/v1/provider/session", async (request, reply) => {
    reply.header("cache-control", "no-store");
    // No credential readback across sites, even if a CORS policy changes.
    if (
      (request.headers.origin && !sameOrigin(request)) ||
      request.headers["sec-fetch-site"] === "cross-site"
    )
      return reply.code(403).send({ error: "origin_required" });
    const session = await resolveProviderSession(
      pool,
      request,
      options.resolvePerson,
    );
    if (!session)
      return reply.code(401).send({
        error:
          requestCookie(request, PROVIDER_COOKIE) || providerToken(request)
            ? "provider_session_expired"
            : "sign_in_required",
      });
    return { token: providerToken(request), accountId: session.accountId };
  });
  app.get("/api/v1/provider/onboarding-session", async (request, reply) => {
    reply
      .header("cache-control", "no-store")
      .header("referrer-policy", "no-referrer");
    if (
      (request.headers.origin && !sameOrigin(request)) ||
      request.headers["sec-fetch-site"] === "cross-site"
    )
      return reply.code(403).send({ error: "origin_required" });
    const proof = await verifiedCleverOnboarding(pool, request);
    if (!proof)
      return reply.code(401).send({ error: "clever_onboarding_expired" });
    return {
      token: request.headers.authorization!.split(/\s+/)[1],
      accountId: proof.accountId,
      expiresAt: proof.expiresAt.toISOString(),
    };
  });
  app.post("/api/v1/provider/sign-out", async (request, reply) => {
    if (!sameOrigin(request))
      return reply.code(403).send({ error: "origin_required" });
    await revokeProviderSession(pool, request);
    cookie(reply, PROVIDER_COOKIE, "", secure, 0);
    return { signedOut: true };
  });
}
