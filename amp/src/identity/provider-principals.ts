import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { FastifyRequest } from "fastify";
import type { Pool } from "pg";
import type { Authenticator } from "../server/auth.js";
import { ApiError } from "../server/repository.js";
import { activeToday, studentBearer } from "../schools/principal.js";
import { markStaffAccount } from "../schools/staff-account.js";

export type CleverClaims = {
  environment: "sandbox" | "production";
  districtId: string;
  userId: string;
  roles: string[];
  schools: string[];
};
export type CleverPerson = {
  connectionId: string;
  tenantId: string;
  personId: string;
  accountId: string | null;
  learnerId: string | null;
  roles: string[];
};
export type ResolveCleverPerson = (
  claims: Pick<CleverClaims, "environment" | "districtId" | "userId">,
) => Promise<CleverPerson | null>;
export const providerHash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const PROVIDER_COOKIE = "amp.provider-session";
export const isCleverAdult = (roles: string[]) =>
  !roles.includes("student") &&
  !roles.includes("contact") &&
  roles.some((role) => ["teacher", "staff", "district_admin"].includes(role));
export function requestCookie(
  request: FastifyRequest,
  name: string,
): string | null {
  return (
    (request.headers.cookie ?? "")
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? null
  );
}
export function providerToken(request: FastifyRequest): string | null {
  if (studentBearer(request)) return null;
  const authorization = request.headers.authorization;
  const bearer = authorization?.match(/^Bearer (\S+)$/i)?.[1];
  // An explicitly supplied credential must never fall back to a shared cookie.
  const token = authorization
    ? bearer
    : requestCookie(request, PROVIDER_COOKIE);
  return token && /^ps_[\w-]{43}$/.test(token) ? token : null;
}
export type ProviderSession = CleverClaims & {
  accountId: string;
  identityId: string;
  createdAt: Date;
  personId: string | null;
};

/** Sessions hold provider identity, never email-based equivalence or blanket
 * school authority. School routes continue to authorize live AMP memberships. */
export async function resolveProviderSession(
  pool: Pool,
  request: FastifyRequest,
  resolvePerson?: ResolveCleverPerson,
): Promise<ProviderSession | null> {
  const token = providerToken(request);
  if (!token) return null;
  const row = (
    await pool.query<{
      account_id: string;
      identity_id: string;
      claims: CleverClaims;
      created_at: Date;
    }>(
      `SELECT i.account_id,s.identity_id,i.claims,s.created_at FROM amp_provider_sessions s
     JOIN amp_provider_identities i ON i.id=s.identity_id
     WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now()`,
      [providerHash(token)],
    )
  ).rows[0];
  if (!row || !isCleverAdult(row.claims.roles)) return null;
  // Disconnect and archive take effect immediately, including sessions issued
  // before a teacher connected their first school. Older schema fixtures have
  // no Clever connection table.
  const installed = (
    await pool.query("SELECT to_regclass('amp_clever_connections') AS relation")
  ).rows[0].relation;
  if (installed) {
    const connection = (
      await pool.query(
        `SELECT c.status,b.archived_at,b.local_id,p.deleted_at,p.id AS person_id FROM amp_clever_connections c
       LEFT JOIN amp_clever_bindings b ON b.connection_id=c.id AND b.kind='user' AND b.clever_id=$3
       LEFT JOIN amp_people p ON p.id=b.local_id
       WHERE c.environment=$1 AND c.district_id=$2`,
        [row.claims.environment, row.claims.districtId, row.claims.userId],
      )
    ).rows[0];
    if (
      connection &&
      (connection.status !== "active" ||
        connection.archived_at ||
        (connection.local_id &&
          (!connection.person_id || connection.deleted_at)))
    )
      return null;
  }
  const person = await resolvePerson?.(row.claims);
  if (
    person &&
    ((person.accountId && person.accountId !== row.account_id) ||
      !isCleverAdult(person.roles))
  )
    return null;
  if (person) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
        [row.account_id],
      );
      // A teacher may sign in before their first sync. Only the identity
      // already proved by this session can attach the subsequently imported
      // person. The deletion lock prevents resurrecting a deleted account.
      const attached = await client.query(
        `UPDATE amp_people p SET account_id=$1 WHERE p.id=$2 AND p.deleted_at IS NULL
         AND (p.account_id IS NULL OR p.account_id=$1)
         AND EXISTS(SELECT 1 FROM amp_provider_identities i WHERE i.id=$3 AND i.account_id=$1)
         AND (NOT EXISTS(SELECT 1 FROM amp_org_roles r WHERE r.person_id=p.id)
           OR EXISTS(SELECT 1 FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id
             WHERE r.person_id=p.id AND r.role<>'student' AND ${activeToday("r", "o")}))`,
        [row.account_id, person.personId, row.identity_id],
      );
      await client.query("COMMIT");
      if (!attached.rowCount) return null;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  return {
    ...row.claims,
    roles: person
      ? row.claims.roles.filter((role) => person.roles.includes(role))
      : row.claims.roles,
    accountId: row.account_id,
    identityId: row.identity_id,
    createdAt: row.created_at,
    personId: person?.personId ?? null,
  };
}
export const verifiedCleverIdentity = resolveProviderSession;

/** A one-way eligibility reference for the separate pilot ledger. Retaining
 * that ledger prevents deleting/recreating a sign-in from restarting a pilot.
 * This key grants no access and is never used to merge accounts. */
export async function providerEligibilityKey(
  pool: Pick<Pool, "query">,
  accountId: string,
): Promise<string | null> {
  const identity = (
    await pool.query<{
      provider: string;
      environment: string;
      district_id: string;
      subject: string;
    }>(
      "SELECT provider,environment,district_id,subject FROM amp_provider_identities WHERE account_id=$1 ORDER BY created_at,id LIMIT 1",
      [accountId],
    )
  ).rows[0];
  return identity
    ? providerHash(
        JSON.stringify([
          "amp-school-pilot-eligibility-v1",
          identity.provider,
          identity.environment,
          identity.district_id,
          identity.subject,
        ]),
      )
    : null;
}

/** Provider credentials take precedence over an older adult cookie. Invalid
 * provider tokens fail closed instead of restoring a previous person's login. */
export function withProviderSessions(
  pool: Pool,
  fallback: Authenticator,
  options: { resolvePerson?: ResolveCleverPerson } = {},
): Authenticator {
  return async (request) => {
    if (studentBearer(request)) throw new ApiError(401, "Sign in to continue");
    if (
      providerToken(request) ||
      /^bearer\s+ps_/i.test(request.headers.authorization ?? "") ||
      (!request.headers.authorization &&
        requestCookie(request, PROVIDER_COOKIE))
    ) {
      const session = await resolveProviderSession(
        pool,
        request,
        options.resolvePerson,
      );
      if (!session)
        throw new ApiError(401, "Your session has expired. Sign in again");
      return session.accountId;
    }
    return fallback(request);
  };
}

/** Both proofs have already been checked by the callback. A first provider
 * login creates an account; a deliberate link attaches a new identity to the
 * proved existing account. Distinct established accounts are never merged. */
export async function establishProviderPrincipal(
  pool: Pool,
  claims: CleverClaims,
  person: CleverPerson | null,
  linkAccountId: string | null = null,
) {
  if (!isCleverAdult(claims.roles))
    throw new ApiError(403, "Clever staff access is required");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `clever:${claims.environment}:${claims.districtId}:${claims.userId}`,
    ]);
    const old = (
      await client.query(
        `SELECT id,account_id FROM amp_provider_identities WHERE provider='clever' AND environment=$1 AND district_id=$2 AND subject=$3 FOR UPDATE`,
        [claims.environment, claims.districtId, claims.userId],
      )
    ).rows[0];
    if (
      (old && linkAccountId && old.account_id !== linkAccountId) ||
      (person?.accountId &&
        person.accountId !== (old?.account_id ?? linkAccountId))
    )
      throw new ApiError(409, "identity_already_linked");
    const accountId = old?.account_id ?? linkAccountId ?? `amp|${randomUUID()}`;
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      accountId,
    ]);
    if (
      (
        await client.query(
          "SELECT 1 FROM amp_account_deletions WHERE account_id=$1",
          [accountId],
        )
      ).rowCount
    )
      throw new ApiError(409, "account_deleted");
    const authUser = linkAccountId
      ? (
          await client.query(
            'SELECT id FROM amp_auth_users WHERE id=$1 AND "emailVerified"=true FOR SHARE',
            [accountId.slice(4)],
          )
        ).rows[0]
      : null;
    if (linkAccountId && !authUser)
      throw new ApiError(403, "verified_account_required");
    await client.query(
      "INSERT INTO amp_provider_principals(account_id,auth_user_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [accountId, authUser?.id ?? null],
    );
    const identityId = old?.id ?? randomUUID();
    await client.query(
      `INSERT INTO amp_provider_identities(id,account_id,provider,environment,district_id,subject,claims)
      VALUES($1,$2,'clever',$3,$4,$5,$6) ON CONFLICT(provider,environment,district_id,subject)
      DO UPDATE SET claims=excluded.claims,verified_at=now()`,
      [
        identityId,
        accountId,
        claims.environment,
        claims.districtId,
        claims.userId,
        claims,
      ],
    );
    if (person) {
      const result = await client.query(
        "UPDATE amp_people SET account_id=$1 WHERE id=$2 AND deleted_at IS NULL AND (account_id IS NULL OR account_id=$1)",
        [accountId, person.personId],
      );
      if (!result.rowCount) throw new ApiError(409, "identity_already_linked");
    }
    await markStaffAccount(client, accountId);
    const token = `ps_${randomBytes(32).toString("base64url")}`;
    await client.query(
      "INSERT INTO amp_provider_sessions(token_hash,identity_id,expires_at) VALUES($1,$2,now()+interval '2 hours')",
      [providerHash(token), identityId],
    );
    await client.query("COMMIT");
    return { token, accountId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function revokeProviderSession(
  pool: Pool,
  request: FastifyRequest,
) {
  const token =
    providerToken(request) ?? requestCookie(request, PROVIDER_COOKIE);
  if (token)
    await pool.query(
      "UPDATE amp_provider_sessions SET revoked_at=now() WHERE token_hash=$1 AND revoked_at IS NULL",
      [providerHash(token)],
    );
}
