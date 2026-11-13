import { refreshConnectionReviews } from "./operations.js";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Authenticator } from "../server/auth.js";
import {
  verifiedCleverIdentity,
  verifiedCleverOnboarding,
} from "../identity/provider-principals.js";
import { resolveCleverPerson } from "./clever/identity.js";
import { CleverClient } from "./clever/client.js";
import { districtSchema, userSchema } from "./clever/model.js";
import { bootstrapCleverAdmin } from "./clever/bootstrap.js";
import { registerCleverConnectionIn } from "./clever/connection.js";
import { safeSyncError } from "./clever/sync.js";
import { AGREEMENT_VERSION } from "./agreement.js";
import { plainName, timezone, SchoolError } from "./contracts.js";
import { SchoolRepository } from "./repository.js";
import { parentAddressConfirmed } from "../server/account-access.js";

import { can, loadActor } from "./authz.js";

export type CleverOnboardingConfig = {
  apiVersion?: import("./clever/client.js").CleverApiVersion;
  origin?: string;
  environment: "sandbox" | "production";
  clientId: string;
  clientSecret: string;
  districtSignupUrl?: string;
};
type Client = Pick<
  CleverClient,
  "districtToken" | "get" | "snapshot" | "latestEvent" | "events"
>;

/** Provider authority establishes the institution; a school name, email domain,
 * sales request or purchased license never stands in for that authority. */
export async function connectCleverInstitution(
  repo: SchoolRepository,
  identity: {
    environment: "sandbox" | "production";
    districtId: string;
    userId: string;
    accountId: string;
    roles: string[];
  },
  raw: unknown,
  client: Client,
) {
  const input = z
    .strictObject({
      signerName: plainName,
      signerTitle: plainName,
      agreementVersion: z.literal(AGREEMENT_VERSION),
      authorized: z.literal(true),
      timezone,
      importNow: z.boolean().default(true),
    })
    .parse(raw);
  if (!identity.roles.includes("district_admin"))
    throw new SchoolError(403, "clever_district_admin_required");
  const token = await client.districtToken(identity.districtId);
  const [district, user] = await Promise.all([
    client.get(`/districts/${identity.districtId}`, token, districtSchema),
    client.get(`/users/${identity.userId}`, token, userSchema),
  ]);
  if (
    district.id !== identity.districtId ||
    user.id !== identity.userId ||
    user.district !== identity.districtId ||
    !user.roles.district_admin
  )
    throw new SchoolError(403, "clever_district_admin_required");
  return repo.transaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      identity.accountId,
    ]);
    if (
      (
        await db.query(
          "SELECT 1 FROM amp_account_deletions WHERE account_id=$1",
          [identity.accountId],
        )
      ).rowCount
    )
      throw new SchoolError(409, "account_deleted");
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `clever-connect:${identity.environment}:${identity.districtId}`,
    ]);
    const previous = (
      await db.query(
        "SELECT tenant_id,last_sync_at FROM amp_clever_connections WHERE environment=$1 AND district_id=$2",
        [identity.environment, identity.districtId],
      )
    ).rows[0];
    const orgId = previous?.tenant_id ?? randomUUID();
    if (!previous)
      await db.query(
        "INSERT INTO amp_orgs(id,kind,path,name,timezone,setup_pending) VALUES($1,'district',ARRAY[$1]::uuid[],$2,$3,false)",
        [orgId, district.name.slice(0, 200), input.timezone],
      );
    const current = (
      await db.query(
        "SELECT version,ended_at FROM amp_data_agreements WHERE org_id=$1 ORDER BY accepted_at DESC,id DESC LIMIT 1",
        [orgId],
      )
    ).rows[0];
    if (!current || current.ended_at || current.version !== AGREEMENT_VERSION) {
      const agreementId = await repo.acceptAgreement(db, orgId, {
        version: AGREEMENT_VERSION,
        signerName: input.signerName,
        signerTitle: input.signerTitle,
      });
      await db.query(
        "UPDATE amp_data_agreements SET signer_account_id=$2 WHERE id=$1",
        [agreementId, identity.accountId],
      );
    }
    const connection = await registerCleverConnectionIn(db, {
      environment: identity.environment,
      districtId: identity.districtId,
      tenantId: orgId,
    });
    if (!previous?.last_sync_at)
      await bootstrapCleverAdmin(
        db,
        connection.id,
        orgId,
        identity.accountId,
        user,
      );
    const paused = !input.importNow && !previous?.last_sync_at;
    await db.query(
      `UPDATE amp_clever_connections SET sync_paused=$2,
        sync_requested_at=CASE WHEN last_sync_requested_at IS NULL OR last_sync_requested_at<=now()-interval '15 minutes' THEN now() ELSE sync_requested_at END,
        last_sync_requested_at=CASE WHEN last_sync_requested_at IS NULL OR last_sync_requested_at<=now()-interval '15 minutes' THEN now() ELSE last_sync_requested_at END WHERE id=$1`,
      [connection.id, paused],
    );
    return {
      connectionId: connection.id,
      orgId,
      status: paused ? "ready_to_import" : "syncing",
    };
  });
}

export async function registerCleverOnboarding(
  app: FastifyInstance,
  options: {
    pool: Pool;
    authenticate: Authenticator;
    config: CleverOnboardingConfig | null;
    client?: Client;
    worker?: boolean;
    maintenance?: boolean;
    origin?: string;
  },
) {
  const { pool, config } = options,
    repo = new SchoolRepository(pool);
  const client = options.client ?? (config ? new CleverClient(config) : null);
  const resolving = (claims: {
    environment: "sandbox" | "production";
    districtId: string;
    userId: string;
  }) => resolveCleverPerson(pool, claims);
  let closing = false;
  app.register(async (scope) => {
    scope.addHook("onRequest", async (_request, reply) => {
      reply.header("Cache-Control", "no-store");
      if (
        _request.method === "POST" &&
        (_request.headers["sec-fetch-site"] === "cross-site" ||
          ((options.origin ?? config?.origin) &&
            ((_request.headers.origin &&
              _request.headers.origin !== (options.origin ?? config?.origin)) ||
              (_request.headers.cookie &&
                !_request.headers.authorization &&
                _request.headers.origin !==
                  (options.origin ?? config?.origin)))))
      )
        throw new SchoolError(403, "request_origin_invalid");
    });
    scope.setErrorHandler((error, request, reply) => {
      if (error instanceof SchoolError) {
        if (error.retryAfter) reply.header("Retry-After", error.retryAfter);
        return reply.code(error.statusCode).send({
          error: error.code,
          ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}),
        });
      }
      if (error instanceof z.ZodError)
        return reply.code(400).send({ error: "invalid_school_request" });
      if ((error as { statusCode?: number }).statusCode === 401)
        return reply.code(401).send({ error: "sign_in_required" });
      request.log.warn(
        { code: safeSyncError(error) },
        "Clever connection request failed",
      );
      return reply.code(503).send({ error: safeSyncError(error) });
    });
    scope.get("/api/v1/school/clever/status", async (request) => {
      const onboarding = await verifiedCleverOnboarding(pool, request);
      const accountId =
        onboarding?.accountId ?? (await options.authenticate(request));
      const identity =
        onboarding ?? (await verifiedCleverIdentity(pool, request, resolving));
      const connection = identity
        ? ((
            await pool.query(
              `SELECT c.id,tenant_id AS "orgId",c.status,sync_paused AS "syncPaused",
        (SELECT m.bootstrap_valid_until FROM amp_clever_memberships m JOIN amp_org_roles r ON r.id=m.local_id AND r.role='admin'
         JOIN amp_clever_bindings b ON b.connection_id=m.connection_id AND b.local_id=r.person_id AND b.kind='user' AND b.clever_id=$3
         WHERE m.connection_id=c.id AND m.kind='org_role' AND m.owned LIMIT 1) AS "bootstrapValidUntil",last_sync_at AS "lastSyncAt",launch_date::text AS "launchDate",
        attempt.error_code AS "lastError",sync_requested_at AS "syncRequestedAt",
        next_attempt_at AS "nextAttemptAt",attempt.started_at AS "lastAttemptAt",
        COALESCE(attempt.status='running' AND attempt.started_at>now()-interval '30 minutes',false) AS syncing,
        CASE WHEN c.status<>'active' THEN 'idle'
          WHEN attempt.status='running' THEN CASE WHEN attempt.started_at>now()-interval '30 minutes' THEN 'running' ELSE 'delayed' END
          WHEN next_attempt_at IS NOT NULL THEN CASE WHEN next_attempt_at>now() THEN 'retrying'
            WHEN next_attempt_at>now()-interval '5 minutes' THEN 'queued' ELSE 'delayed' END
          WHEN sync_requested_at IS NOT NULL THEN CASE WHEN sync_requested_at>now()-interval '5 minutes' THEN 'queued' ELSE 'delayed' END
          WHEN last_sync_at IS NOT NULL OR attempt.status='succeeded' THEN 'ready'
          ELSE 'idle' END AS "syncState"
        FROM amp_clever_connections c LEFT JOIN LATERAL (
          SELECT started_at,status,error_code FROM amp_clever_sync_runs r
          WHERE r.connection_id=c.id AND NOT (r.counts ? 'bootstrap')
          ORDER BY started_at DESC,id DESC LIMIT 1
        ) attempt ON true WHERE environment=$1 AND district_id=$2`,
              [identity.environment, identity.districtId, identity.userId],
            )
          ).rows[0] ?? null)
        : null;
      if (
        connection?.bootstrapValidUntil &&
        identity &&
        client &&
        (!connection.bootstrapValidUntil ||
          new Date(connection.bootstrapValidUntil).getTime() <
            Date.now() + 5 * 60_000)
      ) {
        let valid = false;
        try {
          const token = await client.districtToken(identity.districtId);
          const current = await client.get(
            `/users/${identity.userId}`,
            token,
            userSchema,
          );
          valid =
            current.id === identity.userId &&
            current.district === identity.districtId &&
            !!current.roles.district_admin;
        } catch {
          /* A failed proof never refreshes administrative access. */
        }
        // Only the bootstrap administrator can refresh their temporary authority.
        const own = (
          await pool.query(
            `SELECT 1 FROM amp_clever_bindings b JOIN amp_people p ON p.id=b.local_id
          JOIN amp_org_roles r ON r.person_id=p.id AND r.org_id=$2 AND r.role='admin'
          WHERE b.connection_id=$1 AND b.kind='user' AND b.clever_id=$3 AND p.account_id=$4`,
            [
              connection.id,
              connection.orgId,
              identity.userId,
              identity.accountId,
            ],
          )
        ).rowCount;
        if (own) {
          connection.bootstrapValidUntil =
            (
              await pool.query(
                `UPDATE amp_clever_memberships m SET bootstrap_valid_until=
            CASE WHEN $2 THEN now()+interval '15 minutes' ELSE now() END FROM amp_org_roles r,amp_clever_bindings b
            WHERE m.connection_id=$1 AND m.kind='org_role' AND m.owned AND m.local_id=r.id AND r.role='admin'
              AND b.connection_id=m.connection_id AND b.kind='user' AND b.clever_id=$3 AND b.local_id=r.person_id
              AND m.bootstrap_valid_until IS NOT NULL RETURNING m.bootstrap_valid_until`,
                [connection.id, valid, identity.userId],
              )
            ).rows[0]?.bootstrap_valid_until ?? null;
          if (!valid) connection.lastError = "clever_district_admin_required";
        }
      }
      return {
        enabled: !!config,
        signInUrl: "/api/v1/school/sso/clever/start",
        districtSignupUrl: config?.districtSignupUrl ?? null,
        identity: identity
          ? {
              districtId: identity.districtId,
              roles: identity.roles,
              personId: identity.personId,
            }
          : null,
        connection,
        existingSchools: (
          await pool.query(
            `SELECT DISTINCT o.id,o.name FROM amp_orgs o JOIN amp_people p ON p.tenant_id=o.path[1]
          JOIN amp_org_roles r ON r.person_id=p.id AND r.org_id=o.id
          WHERE p.account_id=$1 AND p.deleted_at IS NULL AND o.kind='school' AND NOT o.demo
          AND r.role IN ('teacher','admin') AND r.begin_on<=(now() AT TIME ZONE o.timezone)::date
          AND (r.end_on IS NULL OR r.end_on>(now() AT TIME ZONE o.timezone)::date)
          ORDER BY o.name,o.id`,
            [accountId],
          )
        ).rows,
        requests: (
          await pool.query(
            `SELECT id,method,status,created_at AS "createdAt" FROM amp_school_connection_requests WHERE account_id=$1 ORDER BY created_at DESC LIMIT 20`,
            [accountId],
          )
        ).rows,
      };
    });
    scope.post(
      "/api/v1/school/connection-requests",
      { bodyLimit: 8192 },
      async (request, reply) => {
        const accountId = await options.authenticate(request);
        const identity = await verifiedCleverIdentity(pool, request, resolving);
        if (!identity && !(await parentAddressConfirmed(pool, accountId)))
          throw new SchoolError(403, "confirm_email");
        const input = z
          .strictObject({
            orgId: z.uuid().optional(),
            institutionName: z.string().trim().min(1).max(200),
            contactEmail: z.email().max(254),
            method: z.enum(["clever", "anyschool"]),
          })
          .parse(request.body);
        if (input.orgId) {
          const org = await repo.org(pool, input.orgId);
          const actor = await loadActor(pool, accountId);
          if (
            !can(actor, "org.read", {
              kind: "org",
              orgId: org.id,
              path: org.path,
            })
          )
            throw new SchoolError(404, "not_found");
        }
        const result = (
          await pool.query(
            `INSERT INTO amp_school_connection_requests(id,account_id,org_id,institution_name,contact_email,method)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(account_id,method,lower(contact_email)) WHERE status IN ('requested','invited')
        DO UPDATE SET updated_at=amp_school_connection_requests.updated_at RETURNING id,status`,
            [
              randomUUID(),
              accountId,
              input.orgId ?? null,
              input.institutionName,
              input.contactEmail.toLowerCase(),
              input.method,
            ],
          )
        ).rows[0];
        return reply.code(202).send({
          ...result,
          next: "provider_invitation",
          manualStartUrl: "/school/start",
        });
      },
    );
    scope.post(
      "/api/v1/school/clever/connect",
      { bodyLimit: 8192 },
      async (request, reply) => {
        const onboarding = await verifiedCleverOnboarding(pool, request);
        const accountId =
          onboarding?.accountId ?? (await options.authenticate(request));
        if (!config || !client)
          throw new SchoolError(503, "clever_unconfigured");
        const identity =
          onboarding ??
          (await verifiedCleverIdentity(pool, request, resolving));
        if (
          !identity ||
          identity.accountId !== accountId ||
          identity.environment !== config.environment
        )
          throw new SchoolError(403, "clever_sign_in_required");
        const result = await connectCleverInstitution(
          repo,
          identity,
          request.body,
          client,
        );

        return reply.code(202).send(result);
      },
    );
    scope.post("/api/v1/school/clever/sync", async (request, reply) => {
      const accountId = await options.authenticate(request);
      const identity = await verifiedCleverIdentity(pool, request, resolving);
      if (!identity || identity.accountId !== accountId)
        throw new SchoolError(403, "clever_sign_in_required");
      const connection = (
        await pool.query(
          "SELECT id,tenant_id,sync_paused FROM amp_clever_connections WHERE environment=$1 AND district_id=$2 AND status='active'",
          [identity.environment, identity.districtId],
        )
      ).rows[0];
      if (!connection) throw new SchoolError(404, "not_found");
      if (!config || !client) throw new SchoolError(503, "clever_unconfigured");
      const actor = await loadActor(pool, accountId);
      const admin = actor.roles.some(
        (r) =>
          r.role === "admin" && r.path[0] === connection.tenant_id && !r.family,
      );
      if (!admin) throw new SchoolError(403, "clever_admin_required");
      if (connection.sync_paused) {
        if (
          !actor.roles.some(
            (r) => r.orgId === connection.tenant_id && r.role === "admin",
          )
        )
          throw new SchoolError(403, "clever_district_admin_required");
        const token = await client.districtToken(identity.districtId);
        const current = await client.get(
          `/users/${identity.userId}`,
          token,
          userSchema,
        );
        if (
          current.id !== identity.userId ||
          current.district !== identity.districtId ||
          !current.roles.district_admin
        )
          throw new SchoolError(403, "clever_district_admin_required");
      }
      const queued = await pool.query(
        `UPDATE amp_clever_connections SET sync_paused=false,sync_requested_at=now(),last_sync_requested_at=now()
         WHERE id=$1 AND (sync_paused OR last_sync_requested_at IS NULL OR last_sync_requested_at<=now()-interval '15 minutes') RETURNING id`,
        [connection.id],
      );
      if (!queued.rowCount) {
        reply.header("Retry-After", "900");
        throw new SchoolError(429, "clever_sync_rate_limited");
      }
      return reply.code(202).send({ status: "syncing" });
    });
  });
  // API maintenance never downloads a roster. The separate worker consumes
  // durable sync requests, independently of seat and review maintenance.
  let polling = false;
  const poll = async () => {
    if (polling || closing) return;
    polling = true;
    try {
      for (const tenant of await repo.dueSeatTenants())
        await repo.reconcileSeats(tenant);
      await refreshConnectionReviews(pool);
      await pool.query(
        "DELETE FROM amp_provider_sessions WHERE expires_at<now()-interval '1 day'",
      );
      await pool.query(
        "DELETE FROM amp_provider_oauth_flows WHERE expires_at<now()-interval '1 day'",
      );
    } catch (error) {
      app.log.warn(
        { code: safeSyncError(error) },
        "Clever connection polling failed",
      );
    } finally {
      polling = false;
    }
  };
  let pollPromise: Promise<void> | null = null;
  const timer =
    options.maintenance !== false
      ? setInterval(() => {
          if (!polling && !closing) pollPromise = poll();
        }, 60_000)
      : null;
  timer?.unref();
  app.addHook("preClose", async () => {
    closing = true;
    if (timer) clearInterval(timer);
    await pollPromise;
  });
}
