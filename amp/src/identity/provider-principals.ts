import { SchoolError } from "../schools/contracts.js";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { FastifyRequest } from "fastify";
import type { Pool } from "pg";
import type { Authenticator } from "../server/auth.js";
import { ApiError } from "../server/repository.js";
import { activeToday, studentBearer } from "../schools/principal.js";
import { markStaffAccount } from "../schools/staff-account.js";
import { attachProvedCleverStaffIn } from "../schools/clever/staff-link.js";

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
function providerCookieAllowed(request: FastifyRequest) {
  return ["/api/v1/provider/session", "/api/v1/provider/sign-out"].includes(
    request.url?.split("?")[0] ?? "",
  );
}
export function providerToken(request: FastifyRequest): string | null {
  if (studentBearer(request)) return null;
  const authorization = request.headers.authorization;
  const bearer = authorization?.match(/^Bearer (\S+)$/i)?.[1];
  // An explicitly supplied credential must never fall back to a shared cookie.
  const token = authorization
    ? bearer
    : providerCookieAllowed(request)
      ? requestCookie(request, PROVIDER_COOKIE)
      : null;
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
     WHERE s.token_hash=$1 AND s.purpose='session' AND s.revoked_at IS NULL AND s.expires_at>now()`,
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
  let person = await resolvePerson?.(row.claims);
  if (
    person &&
    ((person.accountId && person.accountId !== row.account_id) ||
      !isCleverAdult(person.roles))
  )
    return null;
  if (
    person &&
    !(
      await pool.query(
        `SELECT 1 FROM amp_people p WHERE p.id=$1 AND p.deleted_at IS NULL
      AND (NOT EXISTS(SELECT 1 FROM amp_org_roles r WHERE r.person_id=p.id)
        OR EXISTS(SELECT 1 FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id
          WHERE r.person_id=p.id AND r.role<>'student' AND ${activeToday("r", "o")}))`,
        [person.personId],
      )
    ).rowCount
  )
    return null;
  if (person && person.accountId !== row.account_id) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout='1s'");
      // The attachment helper owns its nonblocking account lock. Legacy
      // fixtures without the adapter still serialize attachment with erasure.
      if (!installed)
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
          [row.account_id],
        );
      // A teacher may sign in before their first sync. Only the identity
      // already proved by this session can attach the subsequently imported
      // person. The deletion lock prevents resurrecting a deleted account.
      const attached = installed
        ? await attachProvedCleverStaffIn(client, {
            connectionId: person.connectionId,
            accountId: row.account_id,
            userId: row.claims.userId,
          })
        : { personId: person.personId };
      if ("disposition" in attached && attached.disposition === "deferred") {
        await client.query("COMMIT");
        return {
          ...row.claims,
          accountId: row.account_id,
          identityId: row.identity_id,
          createdAt: row.created_at,
          personId: null,
        };
      }
      if (!attached.personId)
        throw new ApiError(409, "identity_already_linked");
      // The helper may consolidate a freshly rostered staff alias into an
      // existing canonical person. The session must return that surviving ID.
      if (!installed)
        await client.query(
          "UPDATE amp_people SET account_id=$1 WHERE id=$2 AND deleted_at IS NULL AND account_id IS NULL",
          [row.account_id, attached.personId],
        );
      await client.query("COMMIT");
      person = {
        ...person,
        personId: attached.personId,
        accountId: row.account_id,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      if (
        (error instanceof SchoolError || error instanceof ApiError) &&
        error.statusCode === 409
      ) {
        await client.query(
          "UPDATE amp_provider_sessions SET revoked_at=now() WHERE token_hash=$1",
          [providerHash(token)],
        );
        return null;
      }
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

/** A provider proof for reauthorization cannot read an account or school. It
 * is accepted only by connection status/setup, which rechecks upstream roles. */
export async function verifiedCleverOnboarding(
  pool: Pick<Pool, "query">,
  request: FastifyRequest,
): Promise<(ProviderSession & { expiresAt: Date }) | null> {
  const token = request.headers.authorization?.match(
    /^Bearer (po_[\w-]{43})$/i,
  )?.[1];
  if (!token || studentBearer(request)) return null;
  const row = (
    await pool.query(
      `SELECT i.account_id,s.identity_id,i.claims,s.created_at,s.expires_at
    FROM amp_provider_sessions s JOIN amp_provider_identities i ON i.id=s.identity_id
    WHERE s.token_hash=$1 AND s.purpose='onboarding' AND s.revoked_at IS NULL
      AND s.expires_at>now() AND s.created_at>now()-interval '10 minutes'`,
      [providerHash(token)],
    )
  ).rows[0];
  if (!row || !isCleverAdult(row.claims.roles)) return null;
  return {
    ...row.claims,
    accountId: row.account_id,
    identityId: row.identity_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    personId: null,
  };
}

async function requiresOnboardingProof(
  db: Pick<Pool, "query">,
  claims: CleverClaims,
) {
  if (
    !(
      await db.query("SELECT to_regclass('amp_clever_connections') AS relation")
    ).rows[0].relation
  )
    return false;
  return !!(
    await db.query(
      `SELECT 1 FROM amp_clever_connections c
    LEFT JOIN amp_clever_bindings b ON b.connection_id=c.id AND b.kind='user' AND b.clever_id=$3
    LEFT JOIN amp_people p ON p.id=b.local_id
    WHERE c.environment=$1 AND c.district_id=$2 AND (c.status<>'active' OR b.archived_at IS NOT NULL
      OR b.local_id IS NOT NULL AND (p.id IS NULL OR p.deleted_at IS NOT NULL))`,
      [claims.environment, claims.districtId, claims.userId],
    )
  ).rowCount;
}

/** One-way references for EVERY linked identity. They grant no access and are
 * never used to merge accounts or infer that a reported email is verified. */
export async function providerEligibilityKeys(
  db: Pick<Pool, "query">,
  accountId: string,
): Promise<string[]> {
  const identities = (
    await db.query<{
      provider: string;
      environment: string;
      district_id: string;
      subject: string;
    }>(
      "SELECT provider,environment,district_id,subject FROM amp_provider_identities WHERE account_id=$1 ORDER BY created_at,id",
      [accountId],
    )
  ).rows;
  return identities.map((identity) =>
    providerHash(
      JSON.stringify([
        "amp-school-pilot-eligibility-v1",
        identity.provider,
        identity.environment,
        identity.district_id,
        identity.subject,
      ]),
    ),
  );
}
/** Compatibility for integrations that need one reference, never pilot policy. */
export async function providerEligibilityKey(
  db: Pick<Pool, "query">,
  accountId: string,
): Promise<string | null> {
  return (await providerEligibilityKeys(db, accountId))[0] ?? null;
}

/** Caller holds the canonical account lock in a transaction. Remember aliases
 * when they are linked, including after a pilot has already begun, and before
 * account erasure. Only opaque digests and the original pilot dates survive. */
export async function rememberProviderPilotAliases(
  db: Pick<Pool, "query">,
  accountId: string,
) {
  if (
    !(await db.query("SELECT to_regclass('amp_teacher_pilots') AS relation"))
      .rows[0].relation
  )
    return;
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
    `teacher-pilot:${accountId}`,
  ]);
  const keys = [
    providerHash(`amp-pilot-account-v1:${accountId}`),
    ...(await providerEligibilityKeys(db, accountId)),
  ];
  const mailbox = (
    await db.query(
      'SELECT lower(email) AS email FROM amp_auth_users WHERE id=$1 AND "emailVerified"=true',
      [accountId.slice(4)],
    )
  ).rows[0]?.email;
  if (mailbox) keys.push(providerHash(`amp-pilot-mailbox-v1:${mailbox}`));
  keys.sort();
  for (const key of keys)
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `pilot-identity:${key}`,
    ]);
  const pilot = (
    await db.query(
      `SELECT id FROM amp_teacher_pilots WHERE account_id=$1 OR id IN
    (SELECT pilot_id FROM amp_pilot_eligibility WHERE identity_digest=ANY($2::text[])) ORDER BY started_at,id LIMIT 1`,
      [accountId, keys],
    )
  ).rows[0];
  if (pilot)
    for (const key of keys)
      await db.query(
        "INSERT INTO amp_pilot_eligibility(identity_digest,pilot_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [key, pilot.id],
      );
}

/** Provider credentials take precedence over an older adult cookie. Invalid
 * provider tokens fail closed instead of restoring a previous person's login. */
export function withProviderSessions(
  pool: Pool,
  fallback: Authenticator,
  options: { resolvePerson?: ResolveCleverPerson } = {},
): Authenticator {
  return async (request) => {
    if (
      studentBearer(request) ||
      /^bearer\s+po_/i.test(request.headers.authorization ?? "")
    )
      throw new ApiError(401, "Sign in to continue");
    if (
      providerToken(request) ||
      /^bearer\s+ps_/i.test(request.headers.authorization ?? "") ||
      (!request.headers.authorization &&
        providerCookieAllowed(request) &&
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
    await client.query("SET LOCAL lock_timeout='1s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `clever:${claims.environment}:${claims.districtId}:${claims.userId}`,
    ]);
    const old = (
      await client.query(
        `SELECT id,account_id FROM amp_provider_identities WHERE provider='clever' AND environment=$1 AND district_id=$2 AND subject=$3`,
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
    // Identity proof may coexist with a roster update, while account erasure
    // remains exclusive. Attachment separately tries the exclusive lock and
    // defers if the worker is changing this person's roster record.
    await client.query(
      "SELECT pg_advisory_xact_lock_shared(hashtextextended($1,0))",
      [accountId],
    );
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
    if (
      linkAccountId &&
      !authUser &&
      !(
        await client.query(
          "SELECT 1 FROM amp_provider_principals WHERE account_id=$1",
          [accountId],
        )
      ).rowCount
    )
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
    const onboarding = await requiresOnboardingProof(client, claims);
    const installed = (
      await client.query(
        "SELECT to_regclass('amp_clever_connections') AS relation",
      )
    ).rows[0].relation;
    const connection =
      installed && !onboarding
        ? (
            await client.query(
              "SELECT id FROM amp_clever_connections WHERE environment=$1 AND district_id=$2 AND status='active'",
              [claims.environment, claims.districtId],
            )
          ).rows[0]
        : null;
    if (connection) {
      await attachProvedCleverStaffIn(client, {
        connectionId: connection.id,
        accountId,
        userId: claims.userId,
      });
    } else if (person && !onboarding) {
      const result = await client.query(
        "UPDATE amp_people SET account_id=$1 WHERE id=$2 AND deleted_at IS NULL AND (account_id IS NULL OR account_id=$1)",
        [accountId, person.personId],
      );
      if (!result.rowCount) throw new ApiError(409, "identity_already_linked");
    }
    await markStaffAccount(client, accountId);
    await rememberProviderPilotAliases(client, accountId);
    if (onboarding)
      await client.query(
        "UPDATE amp_provider_sessions SET revoked_at=now() WHERE identity_id=$1 AND purpose='session' AND revoked_at IS NULL",
        [identityId],
      );
    const token = `${onboarding ? "po" : "ps"}_${randomBytes(32).toString("base64url")}`;
    const expiresAt = (
      await client.query(
        `INSERT INTO amp_provider_sessions(token_hash,identity_id,purpose,expires_at)
       VALUES($1,$2,$3,now()+CASE WHEN $3='onboarding' THEN interval '10 minutes' ELSE interval '2 hours' END)
       RETURNING expires_at`,
        [
          providerHash(token),
          identityId,
          onboarding ? "onboarding" : "session",
        ],
      )
    ).rows[0].expires_at as Date;
    await client.query("COMMIT");
    return { token, accountId, onboarding, expiresAt };
  } catch (error) {
    await client.query("ROLLBACK");
    if ((error as { code?: string }).code === "55P03")
      throw new ApiError(503, "clever_sign_in_busy");
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
