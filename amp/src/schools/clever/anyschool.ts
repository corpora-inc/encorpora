import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { z } from "zod";
import { AGREEMENT_VERSION } from "../agreement.js";
import { can, loadActor } from "../authz.js";
import { SchoolError } from "../contracts.js";
import { anySchoolRequestSchema } from "../org-contracts.js";
import { recordEvent } from "../events.js";
import { generateHandle, type SchoolRepository } from "../repository.js";
import type { CleverClient } from "./client.js";
import { registerCleverConnectionIn } from "./connection.js";
import { cleverId, districtSchema, type CleverEnvironment } from "./model.js";

/** Clever AnySchool brings a school that is not on Clever into Clever: Clever
 * hosts the setup (a spreadsheet upload, SFTP or the school's own SIS) and the
 * school's data then arrives through the same Secure Sync API as any district.
 * https://dev.clever.com/docs/anyschool-rostering
 *
 * Clever's invitation is a partner-dashboard action that needs a name and the
 * email of the administrator who will do the setup; the link works only for
 * that address. AMP's request collects exactly that, plus the school's
 * acceptance of the student data agreement. An AnySchool district can lack a
 * Clever district administrator (its CSV has student, teacher and staff
 * users), so the agreement travels with the request and the operator connects
 * the district once the school has shared it. See docs/clever-anyschool.md. */

export type CleverOperator = {
  client: Pick<CleverClient, "districtToken" | "get" | "sharedDistricts">;
  environment: CleverEnvironment;
};

const OPEN = ["requested", "invited"];

/** The school's own request, from its integrations page. One open request per
 * school: asking again before the invitation corrects the setup email; after
 * it, the request stands as sent. */
export async function requestAnySchool(
  repo: SchoolRepository,
  input: { orgId: string; accountId: string; actorPersonId?: string | null },
  raw: unknown,
) {
  const body = anySchoolRequestSchema.parse(raw);
  return repo.transaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `anyschool-request:${input.orgId}`,
    ]);
    const org = (
      await db.query(
        `SELECT name,kind,parent_id,demo,
          EXISTS(SELECT 1 FROM amp_clever_connections c WHERE c.tenant_id=o.path[1] AND c.status='active') AS connected
         FROM amp_orgs o WHERE id=$1`,
        [input.orgId],
      )
    ).rows[0];
    if (!org || org.demo) throw new SchoolError(404, "not_found");
    if (org.connected)
      throw new SchoolError(409, "anyschool_already_connected");
    if (org.kind !== "school" || org.parent_id)
      throw new SchoolError(409, "anyschool_root_school_required");
    const open = (
      await db.query(
        `SELECT id,status FROM amp_school_connection_requests
         WHERE org_id=$1 AND method='anyschool' AND status = ANY($2::text[])
         ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        [input.orgId, OPEN],
      )
    ).rows[0];
    if (open?.status === "invited")
      return { id: open.id as string, status: "invited", created: false };
    const email = body.setupEmail.toLowerCase();
    if (open) {
      await db.query(
        `UPDATE amp_school_connection_requests SET contact_email=$2,signer_name=$3,agreement_version=$4,
         institution_name=$5,account_id=$6,updated_at=now() WHERE id=$1`,
        [
          open.id,
          email,
          body.signerName,
          body.agreementVersion,
          org.name,
          input.accountId,
        ],
      );
      return { id: open.id as string, status: "requested", created: false };
    }
    const id = randomUUID();
    await db.query(
      `INSERT INTO amp_school_connection_requests(id,account_id,org_id,institution_name,contact_email,method,signer_name,agreement_version)
       VALUES($1,$2,$3,$4,$5,'anyschool',$6,$7)`,
      [
        id,
        input.accountId,
        input.orgId,
        org.name,
        email,
        body.signerName,
        body.agreementVersion,
      ],
    );
    await recordEvent(db, {
      orgId: input.orgId,
      actorPersonId: input.actorPersonId ?? null,
      action: "integration.requested",
      targetKind: "org",
      targetId: input.orgId,
      detail: { after: { id: "anyschool" } },
    });
    return { id, status: "requested", created: true };
  });
}

/** What the school's integrations page shows about its request. Null when
 * AnySchool does not apply: not a root school, or already on Clever. */
export async function anySchoolState(pool: Pool, orgId: string) {
  const row = (
    await pool.query(
      `SELECT o.kind='school' AND o.parent_id IS NULL AND NOT o.demo AS eligible,
        EXISTS(SELECT 1 FROM amp_clever_connections c WHERE c.tenant_id=o.path[1] AND c.status='active') AS on_clever,
        r.status,r.contact_email,r.created_at,r.invited_at,c.tenant_id AS district_org_id,
        c.last_sync_at IS NOT NULL AS imported
       FROM amp_orgs o LEFT JOIN LATERAL (
         SELECT * FROM amp_school_connection_requests WHERE org_id=o.id AND method='anyschool' AND status<>'closed'
         ORDER BY created_at DESC LIMIT 1) r ON true
       LEFT JOIN amp_clever_connections c ON c.id=r.connection_id AND c.status='active'
       WHERE o.id=$1`,
      [orgId],
    )
  ).rows[0];
  // A school adopted into its AnySchool district reads its connection from
  // the district; the request stays with the school that asked.
  if (!row || (!row.status && (!row.eligible || row.on_clever))) return null;
  return {
    status: (row.status ?? "none") as
      "none" | "requested" | "invited" | "connected",
    setupEmail: (row.contact_email as string | null) ?? null,
    requestedAt: row.created_at?.toISOString() ?? null,
    invitedAt: row.invited_at?.toISOString() ?? null,
    districtOrgId: (row.district_org_id as string | null) ?? null,
    imported: !!row.imported,
  };
}

const requestId = z.uuid();
async function anySchoolRequest(db: Pick<Pool, "query">, id: string) {
  const request = (
    await db.query(
      `SELECT * FROM amp_school_connection_requests WHERE id=$1 AND method='anyschool'`,
      [requestId.parse(id)],
    )
  ).rows[0];
  if (!request) throw new SchoolError(404, "request_not_found");
  return request;
}

/** The operator sent (or re-sent) Clever's invitation from the dashboard.
 * `districtId` is the Clever district "Create new district" made, when the
 * operator has it; `anyschool-connect` can take it instead. */
export async function recordAnySchoolInvite(
  repo: SchoolRepository,
  raw: unknown,
) {
  const input = z
    .strictObject({
      id: z.uuid(),
      districtId: cleverId.optional(),
      reference: z.string().trim().min(1).max(200).optional(),
    })
    .parse(raw);
  return repo.transaction(async (db) => {
    const request = (
      await db.query(
        "SELECT status FROM amp_school_connection_requests WHERE id=$1 AND method='anyschool' FOR UPDATE",
        [input.id],
      )
    ).rows[0];
    if (!request) throw new SchoolError(404, "request_not_found");
    if (!OPEN.includes(request.status))
      throw new SchoolError(409, "anyschool_request_not_open");
    if (
      input.districtId &&
      (
        await db.query(
          `SELECT 1 FROM amp_school_connection_requests WHERE clever_district_id=$1 AND id<>$2 AND status<>'closed'`,
          [input.districtId, input.id],
        )
      ).rowCount
    )
      throw new SchoolError(409, "anyschool_district_already_requested");
    const row = (
      await db.query(
        `UPDATE amp_school_connection_requests SET status='invited',invited_at=now(),updated_at=now(),
         clever_district_id=COALESCE($2,clever_district_id),provider_reference=COALESCE($3,provider_reference)
         WHERE id=$1 RETURNING id,status,invited_at AS "invitedAt",clever_district_id AS "districtId"`,
        [input.id, input.districtId ?? null, input.reference ?? null],
      )
    ).rows[0];
    return { ...row, invitedAt: row.invitedAt.toISOString() };
  });
}

/** Once the school's setup has shared its data with AMP (a district-app token
 * exists), make its district in AMP: the agreement the school accepted with its
 * request, the requester as the district's administrator, and the connection,
 * staged. The worker caches the roster for review without creating anyone; the
 * school's existing classes then move in through the adoption review. */
export async function connectAnySchool(
  repo: SchoolRepository,
  clever: CleverOperator,
  raw: unknown,
  origin = "",
) {
  const input = z
    .strictObject({
      id: z.uuid(),
      districtId: cleverId.optional(),
      /** Clever documents `connection_type` but not on every API version: a
       * district that omits it can be connected when the operator confirms it
       * is the AnySchool district this request created. Another type never. */
      confirmAnySchool: z.literal(true).optional(),
    })
    .parse(raw);
  const request = await anySchoolRequest(repo.pool, input.id);
  if (request.connection_id) {
    const connection = (
      await repo.pool.query(
        "SELECT tenant_id FROM amp_clever_connections WHERE id=$1",
        [request.connection_id],
      )
    ).rows[0];
    return connectResult(request, connection.tenant_id, origin);
  }
  if (!OPEN.includes(request.status))
    throw new SchoolError(409, "anyschool_request_not_open");
  const districtId = input.districtId ?? request.clever_district_id;
  if (!districtId) throw new SchoolError(400, "anyschool_district_required");
  if (
    request.clever_district_id &&
    input.districtId &&
    request.clever_district_id !== input.districtId
  )
    throw new SchoolError(409, "anyschool_district_mismatch");
  if (!request.signer_name || request.agreement_version !== AGREEMENT_VERSION)
    throw new SchoolError(409, "anyschool_agreement_required");
  if (!request.org_id) throw new SchoolError(409, "anyschool_school_required");
  // The requester must still administer the school that asked.
  const school = (
    await repo.pool.query(
      "SELECT id,path,name,timezone,kind,parent_id FROM amp_orgs WHERE id=$1",
      [request.org_id],
    )
  ).rows[0];
  if (!school || school.kind !== "school" || school.parent_id)
    throw new SchoolError(409, "anyschool_root_school_required");
  const actor = await loadActor(repo.pool, request.account_id);
  if (
    !can(actor, "integrations.manage", {
      kind: "org",
      orgId: school.id,
      path: school.path,
    })
  )
    throw new SchoolError(409, "anyschool_requester_authority_ended");
  // Clever's word that this district shared with AMP, and what it is.
  const token = await clever.client.districtToken(districtId);
  const district = await clever.client.get(
    `/districts/${districtId}`,
    token,
    districtSchema,
  );
  if (district.id !== districtId)
    throw new SchoolError(409, "anyschool_district_mismatch");
  if (
    district.connection_type
      ? district.connection_type !== "anyschool"
      : !input.confirmAnySchool
  )
    throw new SchoolError(409, "anyschool_connection_type_mismatch");
  return repo.transaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `clever-connect:${clever.environment}:${districtId}`,
    ]);
    const locked = (
      await db.query(
        "SELECT status,connection_id FROM amp_school_connection_requests WHERE id=$1 FOR UPDATE",
        [input.id],
      )
    ).rows[0];
    if (locked.connection_id || !OPEN.includes(locked.status))
      throw new SchoolError(409, "anyschool_request_not_open");
    if (
      (
        await db.query(
          "SELECT 1 FROM amp_clever_connections WHERE environment=$1 AND district_id=$2",
          [clever.environment, districtId],
        )
      ).rowCount
    )
      throw new SchoolError(409, "clever_district_already_bound");
    const orgId = randomUUID();
    await db.query(
      "INSERT INTO amp_orgs(id,kind,path,name,timezone,setup_pending) VALUES($1,'district',ARRAY[$1]::uuid[],$2,$3,false)",
      [orgId, school.name, school.timezone],
    );
    const agreementId = await repo.acceptAgreement(db, orgId, {
      version: request.agreement_version,
      signerName: request.signer_name,
    });
    await db.query(
      "UPDATE amp_data_agreements SET signer_account_id=$2 WHERE id=$1",
      [agreementId, request.account_id],
    );
    // The requester administers the district by AMP's grant, not Clever's:
    // adoption accepts an independent administrator (adoption.ts), and no
    // roster removal ends it.
    const name = (
      await db.query(
        `SELECT given_name,family_name FROM amp_people WHERE tenant_id=$1 AND account_id=$2
         AND deleted_at IS NULL ORDER BY id LIMIT 1`,
        [school.id, request.account_id],
      )
    ).rows[0];
    const personId = randomUUID();
    await db.query(
      `INSERT INTO amp_people(id,tenant_id,given_name,family_name,handle,account_id,timezone)
       VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [
        personId,
        orgId,
        name?.given_name ?? request.signer_name.slice(0, 100),
        name?.family_name ?? null,
        generateHandle(),
        request.account_id,
        school.timezone,
      ],
    );
    await db.query(
      `INSERT INTO amp_org_roles(id,person_id,org_id,role,begin_on)
       VALUES($1,$2,$3,'admin',(now() AT TIME ZONE $4)::date)`,
      [randomUUID(), personId, orgId, school.timezone],
    );
    const connection = await registerCleverConnectionIn(db, {
      environment: clever.environment,
      districtId,
      tenantId: orgId,
    });
    await db.query(
      `UPDATE amp_clever_connections SET sync_paused=true,sync_requested_at=now(),last_sync_requested_at=now()
       WHERE id=$1`,
      [connection.id],
    );
    await db.query(
      `UPDATE amp_school_connection_requests SET status='connected',connection_id=$2,clever_district_id=$3,
       clever_environment=$4,updated_at=now() WHERE id=$1`,
      [input.id, connection.id, districtId, clever.environment],
    );
    await recordEvent(db, {
      orgId: school.id,
      action: "integration.connected",
      targetKind: "org",
      targetId: orgId,
      detail: { after: { id: "anyschool", connectionId: connection.id } },
    });
    return connectResult(request, orgId, origin, connection.id);
  });
}

function connectResult(
  request: { id: string; connection_id?: string | null },
  districtOrgId: string,
  origin: string,
  connectionId = request.connection_id ?? undefined,
) {
  return {
    id: request.id,
    status: "connected" as const,
    connectionId,
    districtOrgId,
    /** Where the school's owner moves its existing classes in, reviewed. */
    adoptUrl: `${origin}/school/adopt/${districtOrgId}`,
  };
}

/** Start the import once every staged Clever school is matched to the AMP
 * school it continues (adoption review), so no learner is created twice. A
 * Clever school with nothing in AMP to continue is imported fresh only when
 * the operator says so. */
export async function importAnySchool(repo: SchoolRepository, raw: unknown) {
  const input = z
    .strictObject({
      id: z.uuid(),
      allowNewSchools: z.literal(true).optional(),
    })
    .parse(raw);
  const request = await anySchoolRequest(repo.pool, input.id);
  if (request.status !== "connected" || !request.connection_id)
    throw new SchoolError(409, "anyschool_not_connected");
  return repo.transaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `clever-sync:${request.connection_id}`,
    ]);
    const connection = (
      await db.query(
        `SELECT id,status,sync_paused,last_sync_at,failure_code FROM amp_clever_connections WHERE id=$1 FOR UPDATE`,
        [request.connection_id],
      )
    ).rows[0];
    if (!connection || connection.status !== "active")
      throw new SchoolError(409, "clever_connection_inactive");
    if (!connection.sync_paused || connection.last_sync_at)
      return { id: input.id, status: "importing", connectionId: connection.id };
    const schools = (
      await db.query(
        `SELECT count(*)::int AS staged,count(*) FILTER (WHERE local_id IS NULL)::int AS unmatched
         FROM amp_clever_bindings WHERE connection_id=$1 AND kind='school' AND archived_at IS NULL`,
        [connection.id],
      )
    ).rows[0];
    if (!schools.staged)
      throw new SchoolError(
        409,
        connection.failure_code
          ? `anyschool_stage_failed:${connection.failure_code}`
          : "anyschool_stage_pending",
      );
    if (schools.unmatched && !input.allowNewSchools)
      throw new SchoolError(409, "anyschool_schools_unmatched");
    await db.query(
      `UPDATE amp_clever_connections SET sync_paused=false,sync_requested_at=now(),last_sync_requested_at=now()
       WHERE id=$1`,
      [connection.id],
    );
    return {
      id: input.id,
      status: "importing",
      connectionId: connection.id,
      schools: schools.staged,
      newSchools: schools.unmatched,
    };
  });
}

/** Clever's partner license counts schools. Launched: imported by an active,
 * unpaused connection. Staged: cached for review, nobody created yet. Shared:
 * districts with a token that AMP has never connected; AMP imports nothing
 * from them. */
export async function cleverLaunchSummary(
  pool: Pool,
  clever?: CleverOperator | null,
) {
  const connections = (
    await pool.query(
      `SELECT c.id AS "connectionId",c.environment,c.district_id AS "districtId",o.name,
        c.connection_type AS "connectionType",c.status,c.launch_date::text AS "launchDate",
        c.last_sync_at AS "lastSyncAt",
        CASE WHEN c.status<>'active' THEN 'disconnected' WHEN c.sync_paused THEN 'staged'
          WHEN c.last_sync_at IS NULL THEN 'importing' ELSE 'launched' END AS state,
        (SELECT count(*)::int FROM amp_clever_bindings b WHERE b.connection_id=c.id
          AND b.kind='school' AND b.archived_at IS NULL) AS schools
       FROM amp_clever_connections c JOIN amp_orgs o ON o.id=c.tenant_id
       ORDER BY c.environment,o.name,c.id`,
    )
  ).rows;
  const total = (environment: string, ...states: string[]) =>
    connections
      .filter((c) => c.environment === environment && states.includes(c.state))
      .reduce((sum, c) => sum + c.schools, 0);
  let awaitingConnection:
    | {
        districtId: string;
        name: string | null;
        connectionType: string | null;
      }[]
    | null = null;
  if (clever) {
    const known = new Set(
      connections
        .filter((c) => c.environment === clever.environment)
        .map((c) => c.districtId),
    );
    awaitingConnection = [];
    for (const districtId of (await clever.client.sharedDistricts())
      .filter((id) => !known.has(id))
      .slice(0, 50)) {
      try {
        const token = await clever.client.districtToken(districtId);
        const district = await clever.client.get(
          `/districts/${districtId}`,
          token,
          districtSchema,
        );
        awaitingConnection.push({
          districtId,
          name: district.name,
          connectionType: district.connection_type ?? null,
        });
      } catch {
        awaitingConnection.push({
          districtId,
          name: null,
          connectionType: null,
        });
      }
    }
  }
  return {
    launchedSchools: {
      production: total("production", "launched", "importing"),
      sandbox: total("sandbox", "launched", "importing"),
    },
    stagedSchools: {
      production: total("production", "staged"),
      sandbox: total("sandbox", "staged"),
    },
    connections,
    awaitingConnection,
  };
}
