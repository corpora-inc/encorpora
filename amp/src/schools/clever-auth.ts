import { randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import type { Authenticator } from "../server/auth.js";
import type { StudentGrant } from "./contracts.js";
import { startTeacherPilots } from "./pilots.js";
import { SchoolRepository } from "./repository.js";
import {
  establishProviderPrincipal,
  isCleverAdult,
  PROVIDER_COOKIE,
  PROVIDER_HINT_COOKIE,
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
  /** Read an actual, uncached mailbox or ordinary provider session. Both ends of account
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
  // The provider session's readable hint goes and comes with it.
  const hint =
    name === PROVIDER_COOKIE
      ? [
          `${PROVIDER_HINT_COOKIE}=${seconds > 0 ? "1" : ""}; Path=/; SameSite=Lax; Max-Age=${seconds}${secure ? "; Secure" : ""}`,
        ]
      : [];
  reply.header("set-cookie", [
    ...(Array.isArray(old) ? old : old ? [String(old)] : []),
    added,
    ...hint,
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
  // A whole school signs in from one address at the bell, and a Portal launch
  // reaches the callback twice per person. These routes keep the deployment's
  // per-address limit for anonymous pages, never a tighter one.
  app.get(`${ROOT}/start`, async (_request, reply) => {
    reply.header("cache-control", "no-store");
    return reply.redirect(await start(reply));
  });
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
  /** The same state and code a finished callback already redeemed: a
   * refresh, the Back button, or a link opened twice. It is never exchanged
   * again. Restarting signs this browser in afresh instead of showing an
   * error; the restart carries new state, so it cannot repeat itself. An
   * account link is never restarted as a plain sign-in. */
  const redeemed = async (state: string, code: string) =>
    OPAQUE.test(state) &&
    !!(
      await pool.query(
        "SELECT 1 FROM amp_provider_oauth_flows WHERE state_hash=$1 AND code_hash=$2 AND consumed_at IS NOT NULL AND link_account_id IS NULL",
        [providerHash(state), providerHash(code)],
      )
    ).rowCount;
  app.get(`${ROOT}/callback`, async (request, reply) => {
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
    if (!query.success || query.data.error || !query.data.code) {
      request.log.warn(
        { cleverSignInFailed: query.data?.error ?? "missing_code" },
        "Clever sign-in failed",
      );
      return reply.redirect(
        `/sign-in?error=${query.data?.error === "access_denied" ? "clever_sign_in_canceled" : "clever_sign_in_failed"}`,
      );
    }
    const { code, state } = query.data;
    // Clever Portal and Instant Login reach the callback without AMP state.
    // Discard that code and restart in this browser; never redeem an unbound
    // authorization code. The restart always carries AMP state, so it is
    // answered by the branch below, never by this one again.
    if (!state) return reply.redirect(await start(reply));
    const browser = requestCookie(request, FLOW_COOKIE);
    if (!OPAQUE.test(state) || !browser || !OPAQUE.test(browser)) {
      if (await redeemed(state, code)) {
        request.log.info("Clever callback repeated; sign-in restarted");
        return reply.redirect(await start(reply));
      }
      request.log.warn(
        { cleverSignInFailed: "clever_invalid_state" },
        "Clever sign-in failed",
      );
      return reply.redirect("/sign-in?error=clever_sign_in_failed");
    }
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
      const claims = await exchangeCleverIdentity(config, code, options.fetch);
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
      if (claims.roles.includes("contact"))
        throw new Error("clever_contact_unsupported");
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
      // Signing in is all a Clever teacher does: their synced sections
      // start their pilot now, licensed district or not (founder ruling
      // 2026-11-15). A failure here never stops the sign-in; the class
      // offers Start instead.
      try {
        await startTeacherPilots(new SchoolRepository(pool), session.accountId);
      } catch (error) {
        request.log.error(
          { error: error instanceof Error ? error.message : String(error) },
          "Clever teacher's pilot didn't start",
        );
      }
      cookie(reply, PROVIDER_COOKIE, session.token, secure, 7200);
      return reply.redirect(
        `${person ? "/school" : "/school/connect"}#clever-session=${session.token}`,
      );
    } catch (error) {
      // The other half of a duplicate that arrived together with the first:
      // it lost the claim, so it signs in afresh rather than showing an error.
      if (
        error instanceof Error &&
        error.message === "clever_invalid_state" &&
        (await redeemed(state, code))
      ) {
        request.log.info("Clever callback repeated; sign-in restarted");
        return reply.redirect(await start(reply));
      }
      request.log.warn(
        {
          cleverSignInFailed:
            error instanceof Error && /^clever_/.test(error.message)
              ? error.message
              : "identity_failed",
        },
        "Clever sign-in failed",
      );
      if (error instanceof Error && error.message === "clever_sign_in_busy")
        return reply.redirect("/sign-in?error=clever_sign_in_busy");
      // Each refusal a person can act on has its own message on the
      // sign-in page; anything else is a retryable "didn't finish".
      if (
        error instanceof Error &&
        error.message === "clever_student_unavailable"
      )
        return reply.redirect("/sign-in?error=clever_student_not_rostered");
      if (
        error instanceof Error &&
        error.message === "clever_contact_unsupported"
      )
        return reply.redirect("/sign-in?error=clever_contact_unsupported");
      if (error instanceof Error && error.message === "identity_already_linked")
        return reply.redirect(
          "/school/connect?error=clever_identity_already_linked",
        );
      if (
        error instanceof Error &&
        error.message === "clever_account_link_required"
      )
        return reply.redirect(
          "/school/connect?error=clever_account_link_required",
        );
      if (
        error instanceof Error &&
        error.message === "clever_link_proof_expired"
      )
        return reply.redirect("/school/connect?error=clever_link_expired");
      return reply.redirect("/sign-in?error=clever_sign_in_failed");
    }
  });
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
