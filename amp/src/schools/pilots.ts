import { adultNameSql } from "../account/profile.js";
import { randomUUID, createHash, createHmac } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { parentAddressConfirmed } from "../server/account-access.js";
import { providerEligibilityKeys } from "../identity/provider-principals.js";
import { AGREEMENT_VERSION } from "./agreement.js";
import { activeToday } from "./principal.js";
import { loadActor, can, actorPerson } from "./authz.js";
import { plainName, SchoolError } from "./contracts.js";
import { recordEvent } from "./events.js";
import { SchoolRepository, generateHandle } from "./repository.js";

import {
  startSchoolClassSchema,
  schoolPurchaseSchema,
} from "./pilot-contracts.js";
export { startSchoolClassSchema } from "./pilot-contracts.js";

/** A teacher creates a classroom in a school they belong to, or a new solo
 * school. A name never claims another account’s school or grants admin authority. */
export async function startSchoolClass(
  repo: SchoolRepository,
  accountId: string,
  raw: unknown,
) {
  const input = startSchoolClassSchema.parse(raw);
  if (input.agreementVersion !== AGREEMENT_VERSION)
    throw new SchoolError(409, "agreement_changed");
  if (accountId.startsWith("school:") || accountId.startsWith("trial:"))
    throw new SchoolError(403, "adult_account_required");
  return repo.transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      accountId,
    ]);
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `school-start:${accountId}`,
    ]);
    const repeated = (
      await client.query(
        'SELECT org_id AS "orgId",class_id AS "classId" FROM amp_school_starts WHERE account_id=$1 AND request_id=$2',
        [accountId, input.requestId],
      )
    ).rows[0];
    if (repeated) return repeated as { orgId: string; classId: string };
    let verified = await parentAddressConfirmed(client, accountId);
    if (
      !verified &&
      (
        await client.query(
          "SELECT to_regclass('amp_provider_principals') IS NOT NULL AS present",
        )
      ).rows[0].present
    )
      verified = !!(
        await client.query(
          "SELECT 1 FROM amp_provider_principals WHERE account_id=$1",
          [accountId],
        )
      ).rowCount;
    if (!verified) throw new SchoolError(403, "confirm_email");
    let orgId = input.orgId;
    if (!orgId) {
      const schools = (
        await client.query(
          `SELECT DISTINCT o.id,o.name FROM amp_people p
        JOIN amp_org_roles r ON r.person_id=p.id JOIN amp_orgs scope ON scope.id=r.org_id
        JOIN amp_orgs o ON r.org_id=ANY(o.path) WHERE p.account_id=$1 AND p.deleted_at IS NULL
          AND r.role IN ('teacher','admin') AND ${activeToday("r", "scope")}
          AND o.kind='school' AND NOT o.demo ORDER BY o.id`,
          [accountId],
        )
      ).rows;
      const matching = schools.filter(
        (o) =>
          o.name.trim().toLowerCase() === input.schoolName.trim().toLowerCase(),
      );
      if (
        matching.length > 1 ||
        (!input.newSchool && !matching.length && schools.length > 1)
      )
        throw new SchoolError(409, "school_selection_required");
      orgId =
        matching[0]?.id ??
        (!input.newSchool && schools.length === 1 ? schools[0].id : undefined);
    }
    const createdSchool = !orgId;
    let personId: string;
    if (orgId) {
      const org = await repo.org(client, orgId);
      const actor = await loadActor(client, accountId);
      if (
        !actor.roles.some(
          (r) =>
            org.path.includes(r.orgId) &&
            (r.role === "teacher" || r.role === "admin") &&
            !r.family,
        )
      )
        throw new SchoolError(404, "not_found");
      if (
        (
          await client.query(
            "SELECT demo OR kind<>'school' AS invalid FROM amp_orgs WHERE id=$1",
            [orgId],
          )
        ).rows[0].invalid
      )
        throw new SchoolError(409, "real_school_required");
      personId = actorPerson(actor, org)!;
    } else {
      orgId = randomUUID();
      personId = randomUUID();
      await client.query(
        "INSERT INTO amp_orgs(id,kind,path,name,timezone,solo,setup_pending) VALUES($1,'school',ARRAY[$1]::uuid[],$2,$3,true,false)",
        [orgId, input.schoolName, input.timezone],
      );
      await client.query(
        "INSERT INTO amp_people(id,tenant_id,given_name,handle,account_id,timezone) VALUES($1,$2,$3,$4,$5,$6)",
        [
          personId,
          orgId,
          input.signerName,
          generateHandle(),
          accountId,
          input.timezone,
        ],
      );
      await client.query(
        "INSERT INTO amp_org_roles(id,person_id,org_id,role,begin_on) VALUES($1,$2,$3,'teacher',(now() AT TIME ZONE $4)::date)",
        [randomUUID(), personId, orgId, input.timezone],
      );
    }
    const klass = await repo.createClassIn(
      client,
      orgId,
      {
        name: input.className,
        gradingKind: "year",
        ...(input.courseBands?.length
          ? { courseBands: input.courseBands }
          : {}),
      },
      personId,
    );
    const org = await repo.org(client, orgId);
    await repo.enroll(
      client,
      klass.id,
      personId,
      "teacher",
      await repo.today(client, org.timezone),
    );
    await authorizeClass(
      client,
      klass.id,
      accountId,
      personId,
      input.signerName,
      input.signerTitle,
    );
    for (const name of input.names) {
      const words = name.split(/\s+/);
      await repo.provisionStudentIn(
        client,
        orgId,
        {
          givenName:
            words.length > 1 ? words.slice(0, -1).join(" ") : words[0]!,
          ...(words.length > 1 ? { familyName: words.at(-1)! } : {}),
          classId: klass.id,
          gradeLevel: input.gradeLevel,
        },
        personId,
      );
    }
    await client.query(
      "INSERT INTO amp_school_starts(account_id,request_id,org_id,class_id,created_school) VALUES($1,$2,$3,$4,$5)",
      [accountId, input.requestId, orgId, klass.id, createdSchool],
    );
    await recordEvent(client, {
      orgId,
      actorPersonId: personId,
      action: "class.self-service-created",
      targetKind: "class",
      targetId: klass.id,
    });
    return { orgId, classId: klass.id };
  });
}

async function authorizeClass(
  client: PoolClient,
  classId: string,
  accountId: string,
  personId: string,
  name: string,
  title: string,
) {
  await client.query(
    `INSERT INTO amp_class_authorizations(id,class_id,account_id,signer_person_id,version,signer_name,signer_title)
    VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [
      randomUUID(),
      classId,
      accountId,
      personId,
      AGREEMENT_VERSION,
      name,
      title,
    ],
  );
}

/** Reusable signer details, not permission to authorize another classroom. */
export async function previousClassAuthorization(
  db: Pick<PoolClient, "query">,
  accountId: string,
  orgId: string,
) {
  const org = (
    await db.query("SELECT path,kind,demo FROM amp_orgs WHERE id=$1", [orgId])
  ).rows[0];
  const actor = await loadActor(db, accountId);
  if (
    !org ||
    org.kind !== "school" ||
    org.demo ||
    !actor.roles.some(
      (role) =>
        org.path.includes(role.orgId) &&
        (role.role === "teacher" || role.role === "admin") &&
        !role.family,
    )
  )
    throw new SchoolError(404, "not_found");
  const authorization = (
    await db.query(
      `SELECT a.signer_name,a.signer_title,a.accepted_at,a.version FROM amp_classes c
    JOIN LATERAL (SELECT account_id,signer_name,signer_title,accepted_at,version,ended_at
      FROM amp_class_authorizations WHERE class_id=c.id ORDER BY accepted_at DESC,id LIMIT 1) a ON true
    WHERE c.org_id=$1 AND c.archived_at IS NULL AND a.account_id=$2 AND a.version=$3 AND a.ended_at IS NULL
    ORDER BY a.accepted_at DESC,c.id LIMIT 1`,
      [orgId, accountId, AGREEMENT_VERSION],
    )
  ).rows[0];
  return authorization
    ? {
        signerName: authorization.signer_name as string,
        signerTitle: authorization.signer_title as string,
        acceptedAt: authorization.accepted_at.toISOString() as string,
        version: authorization.version as string,
      }
    : null;
}

/** Classroom authorization may be supplied by the teacher after provider sync. */
export async function acceptClassAuthorization(
  repo: SchoolRepository,
  accountId: string,
  classId: string,
  raw: unknown,
) {
  const input = z
    .strictObject({
      version: z.literal(AGREEMENT_VERSION),
      signerName: plainName,
      signerTitle: plainName,
      authorized: z.literal(true),
    })
    .parse(raw);
  return repo.transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      accountId,
    ]);
    const { personId, orgId } = await teachingClass(client, accountId, classId);
    await authorizeClass(
      client,
      classId,
      accountId,
      personId,
      input.signerName,
      input.signerTitle,
    );
    await recordEvent(client, {
      orgId,
      actorPersonId: personId,
      action: "class.authorized",
      targetKind: "class",
      targetId: classId,
      detail: { after: { version: input.version } },
    });
    return { classId };
  });
}

/** Withdraw classroom consent without deleting the class or its evidence. */
export async function revokeClassAuthorization(
  repo: SchoolRepository,
  accountId: string,
  classId: string,
) {
  return repo.transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      accountId,
    ]);
    const { orgId, personId } = await teachingClass(client, accountId, classId);
    await client.query(
      "UPDATE amp_class_authorizations SET ended_at=now() WHERE class_id=$1 AND ended_at IS NULL",
      [classId],
    );
    await recordEvent(client, {
      orgId,
      actorPersonId: personId,
      action: "class.authorization-revoked",
      targetKind: "class",
      targetId: classId,
    });
    return { classId };
  });
}

async function teachingClass(
  client: PoolClient,
  accountId: string,
  classId: string,
) {
  const row = (
    await client.query(
      "SELECT c.org_id,o.path,o.kind,o.demo FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id WHERE c.id=$1 AND c.archived_at IS NULL FOR UPDATE OF c",
      [classId],
    )
  ).rows[0];
  if (!row || row.kind === "family" || row.demo)
    throw new SchoolError(404, "not_found");
  const actor = await loadActor(client, accountId);
  if (
    !can(actor, "classes.update", {
      kind: "class",
      classId,
      orgId: row.org_id,
      path: row.path,
    })
  )
    throw new SchoolError(404, "not_found");
  return {
    orgId: row.org_id as string,
    path: row.path as string[],
    personId: actorPerson(actor, { path: row.path })!,
  };
}

export async function activateClassPilot(
  repo: SchoolRepository,
  accountId: string,
  classId: string,
) {
  return repo.transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      accountId,
    ]);
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `teacher-pilot:${accountId}`,
    ]);
    const { orgId, path, personId } = await teachingClass(
      client,
      accountId,
      classId,
    );
    const agreement = (
      await client.query(
        `SELECT ended_at FROM amp_data_agreements WHERE org_id=ANY($1::uuid[])
      ORDER BY array_position($1::uuid[],org_id) DESC,accepted_at DESC,id LIMIT 1`,
        [path],
      )
    ).rows[0];
    const authorization = (
      await client.query(
        "SELECT ended_at FROM amp_class_authorizations WHERE class_id=$1 ORDER BY accepted_at DESC,id LIMIT 1",
        [classId],
      )
    ).rows[0];
    if (
      agreement?.ended_at ||
      (!agreement && (!authorization || authorization.ended_at))
    )
      throw new SchoolError(409, "agreement_required");
    const roster = await client.query(
      `SELECT 1 FROM amp_enrollments e JOIN amp_classes c ON c.id=e.class_id
      JOIN amp_orgs o ON o.id=c.org_id JOIN amp_people p ON p.id=e.person_id AND p.deleted_at IS NULL
      JOIN amp_learners l ON l.id=p.learner_id AND l.deleted_at IS NULL AND NOT l.simulation
      WHERE e.class_id=$1 AND e.role='student' AND ${activeToday("e", "o")} LIMIT 1`,
      [classId],
    );
    if (!roster.rowCount) throw new SchoolError(409, "students_required");
    const existing = (
      await client.query(
        "SELECT pilot_id FROM amp_class_pilots WHERE class_id=$1",
        [classId],
      )
    ).rows[0];
    if (!existing) {
      // A school administrator can prepare a class, but only a teacher in that
      // class can consume their personal pilot. No administrator-wide trial.
      const teaches = await client.query(
        `SELECT 1 FROM amp_enrollments e JOIN amp_classes c ON c.id=e.class_id
        JOIN amp_orgs o ON o.id=c.org_id WHERE e.class_id=$1 AND e.person_id=$2
        AND e.role='teacher' AND ${activeToday("e", "o")}`,
        [classId, personId],
      );
      if (!teaches.rowCount)
        throw new SchoolError(403, "pilot_teacher_required");
      const keys = await eligibilityKeys(client, accountId);
      for (const key of keys)
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
          [`pilot-identity:${key}`],
        );
      let pilot = (
        await client.query(
          `SELECT p.id FROM amp_teacher_pilots p WHERE p.account_id=$1
        OR p.id IN (SELECT pilot_id FROM amp_pilot_eligibility WHERE identity_digest=ANY($2::text[]))
        ORDER BY p.started_at,p.id LIMIT 1`,
          [accountId, keys],
        )
      ).rows[0];
      if (!pilot)
        pilot = (
          await client.query(
            `INSERT INTO amp_teacher_pilots(id,account_id,started_at,ends_at,grace_ends_at)
        VALUES($1,$2,now(),now()+interval '30 days',now()+interval '37 days')
        ON CONFLICT(account_id) DO UPDATE SET account_id=excluded.account_id RETURNING id`,
            [randomUUID(), accountId],
          )
        ).rows[0];
      for (const key of keys)
        await client.query(
          "INSERT INTO amp_pilot_eligibility(identity_digest,pilot_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
          [key, pilot.id],
        );
      await client.query(
        "INSERT INTO amp_class_pilots(class_id,pilot_id,activated_by) VALUES($1,$2,$3)",
        [classId, pilot.id, personId],
      );
      await recordEvent(client, {
        orgId,
        actorPersonId: personId,
        action: "pilot.class-activated",
        targetKind: "class",
        targetId: classId,
        detail: { after: { pilotId: pilot.id } },
      });
    }
    return classPilotState(client, classId);
  });
}

export async function classPilotState(
  db: Pick<PoolClient, "query">,
  classId: string,
  accountId?: string,
) {
  let row = (
    await db.query(
      `SELECT t.id,t.started_at,t.ends_at,greatest(t.grace_ends_at,
    (SELECT max(x.until_at) FROM amp_pilot_extensions x WHERE x.pilot_id=t.id)) AS grace_ends_at,
    now() AS observed_at FROM amp_class_pilots cp JOIN amp_teacher_pilots t ON t.id=cp.pilot_id WHERE cp.class_id=$1`,
      [classId],
    )
  ).rows[0];
  const activated = !!row;
  if (!row && accountId)
    row = (
      await db.query(
        `SELECT t.id,t.started_at,t.ends_at,
    greatest(t.grace_ends_at,(SELECT max(x.until_at) FROM amp_pilot_extensions x WHERE x.pilot_id=t.id)) AS grace_ends_at,
    now() AS observed_at FROM amp_teacher_pilots t WHERE t.account_id=$1 OR t.id IN
      (SELECT pilot_id FROM amp_pilot_eligibility WHERE identity_digest=ANY($2::text[])) ORDER BY t.started_at,t.id LIMIT 1`,
        [accountId, await eligibilityKeys(db, accountId)],
      )
    ).rows[0];
  const coverage = (
    await db.query(
      `SELECT count(DISTINCT p.id)::int AS students,
    count(DISTINCT p.id) FILTER (WHERE EXISTS(SELECT 1 FROM amp_grants g WHERE g.learner_id=p.learner_id
      AND g.status='active' AND g.starts_at<=now() AND g.ends_at>now() AND amp_school_grant_valid(g.id)))::int AS paid,
    count(DISTINCT p.id) FILTER (WHERE amp_school_pilot_until(p.learner_id)>now() OR EXISTS(
      SELECT 1 FROM amp_grants g WHERE g.learner_id=p.learner_id AND g.status='active' AND g.starts_at<=now() AND g.ends_at>now() AND amp_school_grant_valid(g.id)))::int AS covered
    FROM amp_enrollments e JOIN amp_classes c ON c.id=e.class_id AND c.archived_at IS NULL
    JOIN amp_orgs o ON o.id=c.org_id JOIN amp_people p ON p.id=e.person_id AND p.deleted_at IS NULL AND p.learner_id IS NOT NULL
    WHERE e.class_id=$1 AND e.role='student' AND ${activeToday("e", "o")}`,
      [classId],
    )
  ).rows[0];
  const authorized =
    (
      await db.query(
        `SELECT nearest.ended_at IS NULL AND (nearest.id IS NOT NULL OR classroom.ended_at IS NULL AND classroom.id IS NOT NULL) AS active
    FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id
    LEFT JOIN LATERAL (SELECT a.id,a.ended_at FROM amp_data_agreements a WHERE a.org_id=ANY(o.path)
      ORDER BY array_position(o.path,a.org_id) DESC,a.accepted_at DESC,a.id LIMIT 1) nearest ON true
    LEFT JOIN LATERAL (SELECT a.id,a.ended_at FROM amp_class_authorizations a WHERE a.class_id=c.id
      ORDER BY a.accepted_at DESC,a.id LIMIT 1) classroom ON true WHERE c.id=$1`,
        [classId],
      )
    ).rows[0]?.active === true;
  return row
    ? {
        status: !activated
          ? "ready"
          : row.observed_at < row.ends_at
            ? "active"
            : row.observed_at < row.grace_ends_at
              ? "grace"
              : "expired",
        startedAt: row.started_at.toISOString(),
        endsAt: row.ends_at.toISOString(),
        graceEndsAt: row.grace_ends_at.toISOString(),
        eligible: row.observed_at < row.grace_ends_at,
        coverage,
        authorized,
      }
    : {
        status: "ready",
        startedAt: null,
        endsAt: null,
        graceEndsAt: null,
        eligible: true,
        coverage,
        authorized,
      };
}

/** Operator-only command, never a public route or an effect of requesting a quote. */
export async function extendTeacherPilot(repo: SchoolRepository, raw: unknown) {
  const input = z
    .strictObject({
      pilotId: z.uuid(),
      until: z.iso.datetime({ offset: true }),
      reason: z.string().trim().min(1).max(1000),
      operatorReference: z.string().trim().min(1).max(200),
    })
    .parse(raw);
  return repo.transaction(async (client) => {
    const pilot = (
      await client.query(
        "SELECT id,greatest(grace_ends_at,(SELECT max(until_at) FROM amp_pilot_extensions WHERE pilot_id=$1)) AS grace_ends_at FROM amp_teacher_pilots WHERE id=$1 FOR UPDATE",
        [input.pilotId],
      )
    ).rows[0];
    if (!pilot) throw new SchoolError(404, "pilot_not_found");
    if (new Date(input.until) <= pilot.grace_ends_at)
      throw new SchoolError(409, "extension_must_extend");
    await client.query(
      "INSERT INTO amp_pilot_extensions(id,pilot_id,until_at,reason,operator_reference) VALUES($1,$2,$3,$4,$5)",
      [
        randomUUID(),
        input.pilotId,
        input.until,
        input.reason,
        input.operatorReference,
      ],
    );
    return { pilotId: input.pilotId, until: input.until };
  });
}

const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

async function eligibilityKeys(
  db: Pick<PoolClient, "query">,
  accountId: string,
) {
  const keys = [hash(`amp-pilot-account-v1:${accountId}`)];
  keys.push(...(await providerEligibilityKeys(db, accountId)));
  const email = (
    await db.query(
      'SELECT lower(email) AS email FROM amp_auth_users WHERE id=$1 AND "emailVerified"=true',
      [accountId.slice(4)],
    )
  ).rows[0]?.email;
  if (email) {
    // Retain the original digest for old eligibility records as well.
    keys.push(hash(`amp-pilot-mailbox-v1:${email}`));
    keys.push(hash(`amp-pilot-mailbox-v1:${normalizePilotEmail(email)}`));
  }
  return keys.sort();
}
export function normalizePilotEmail(email: string) {
  const [local, domain] = email.trim().toLowerCase().split("@");
  return domain === "gmail.com" || domain === "googlemail.com"
    ? `${local!.split("+")[0]!.replaceAll(".", "")}@gmail.com`
    : `${local!.split("+")[0]}@${domain}`;
}
const buyerToken = (id: string, secret: string) => {
  if (secret.length < 24) throw new Error("School token secret required");
  return createHmac("sha256", secret)
    .update(`amp-buyer-link-v1:${id}`)
    .digest("base64url");
};
export async function requestSchoolPurchase(
  repo: SchoolRepository,
  accountId: string,
  raw: unknown,
  secret: string,
) {
  const input = schoolPurchaseSchema.parse(raw);
  return repo.transaction(async (client) => {
    const ids = [...new Set(input.classIds)].sort();
    for (const id of ids)
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
        [`buyer-class:${id}`],
      );
    for (const id of ids) {
      const klass = await teachingClass(client, accountId, id);
      if (!klass.path.includes(input.orgId))
        throw new SchoolError(404, "not_found");
    }
    const existing = (
      await client.query(
        `SELECT r.id,r.account_id,r.org_id,r.class_ids,r.seats,r.note,
          ${adultNameSql()} AS holder_name
        FROM amp_school_purchase_requests r JOIN amp_orgs o ON o.id=r.org_id
        LEFT JOIN amp_people p ON p.tenant_id=o.path[1] AND p.account_id=r.account_id AND p.deleted_at IS NULL
        WHERE r.class_ids && $1::uuid[] AND r.status<>'closed' AND r.token_expires_at>now()
        ORDER BY r.created_at,r.id FOR UPDATE OF r`,
        [ids],
      )
    ).rows;
    const conflicts = existing.filter((row) => row.account_id !== accountId);
    if (conflicts.length)
      throw new SchoolError(
        409,
        "purchase_scope_conflict",
        undefined,
        undefined,
        conflicts.map((row) => ({
          requestId: row.id as string,
          holderName: row.holder_name as string | null,
          classIds: ids.filter((id) => row.class_ids.includes(id)),
        })),
      );
    // Identical retries recover the link. An edited scope, seat count or note
    // replaces this teacher's overlapping requests atomically.
    if (
      existing.length === 1 &&
      existing[0].org_id === input.orgId &&
      existing[0].seats === input.seats &&
      existing[0].note === input.note &&
      existing[0].class_ids.length === ids.length &&
      ids.every((id) => existing[0].class_ids.includes(id))
    )
      return {
        id: existing[0].id as string,
        token: buyerToken(existing[0].id, secret),
      };
    if (existing.length)
      await client.query(
        "UPDATE amp_school_purchase_requests SET status='closed' WHERE id=ANY($1::uuid[])",
        [existing.map((row) => row.id)],
      );
    const id = randomUUID(),
      token = buyerToken(id, secret);
    await client.query(
      `INSERT INTO amp_school_purchase_requests(id,account_id,org_id,class_ids,seats,note,buyer_token_hash,token_expires_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval '30 days')`,
      [id, accountId, input.orgId, ids, input.seats, input.note, hash(token)],
    );
    await recordEvent(client, {
      orgId: input.orgId,
      action: "purchase.requested",
      targetKind: "purchase",
      targetId: id,
      detail: { after: { seats: input.seats, classCount: ids.length } },
    });
    return { id, token };
  });
}

/** Authenticated teachers can recover the same active aggregate-only link. */
export async function classPurchaseRequest(
  repo: SchoolRepository,
  accountId: string,
  classId: string,
  secret: string,
) {
  return repo.transaction(async (client) => {
    await teachingClass(client, accountId, classId);
    const row = (
      await client.query(
        `SELECT id,account_id,class_ids,seats,note,status,created_at,token_expires_at
      FROM amp_school_purchase_requests WHERE $1=ANY(class_ids) AND status<>'closed'
        AND token_expires_at>now() ORDER BY created_at,id LIMIT 1`,
        [classId],
      )
    ).rows[0];
    if (!row) return null;
    const actor = await loadActor(client, accountId);
    const classes = (
      await client.query(
        `SELECT c.id,c.org_id,o.path FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id
        WHERE c.id=ANY($1::uuid[]) AND c.archived_at IS NULL AND o.kind<>'family' AND NOT o.demo`,
        [row.class_ids],
      )
    ).rows;
    const authorized = new Set(
      classes
        .filter((klass) =>
          can(actor, "classes.update", {
            kind: "class",
            classId: klass.id,
            orgId: klass.org_id,
            path: klass.path,
          }),
        )
        .map((klass) => klass.id),
    );
    // Co-teachers can share the aggregate handoff through their own class.
    // Class identifiers and edit controls follow their current authority.
    const classIds = (row.class_ids as string[]).filter((id) =>
      authorized.has(id),
    );
    const fullScope = classIds.length === row.class_ids.length;
    return {
      id: row.id as string,
      token: buyerToken(row.id, secret),
      classIds,
      canEdit: row.account_id === accountId && fullScope,
      seats: row.seats as number,
      // Notes may name students in another class: a co-teacher sees one only
      // for a request wholly within their classes. The buyer page shows it to
      // the reader it was written for.
      note: fullScope ? (row.note as string) : "",
      status: row.status as string,
      createdAt: row.created_at.toISOString() as string,
      expiresAt: row.token_expires_at.toISOString() as string,
    };
  });
}

/** Read-only buyer handoff: counts, dates and the teacher's note for the
 * buyer; no student data or staff authority. */
export async function buyerHandoff(
  db: Pick<PoolClient, "query">,
  token: string,
) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new SchoolError(404, "not_found");
  const request = (
    await db.query(
      `SELECT r.id,r.class_ids,r.seats,r.status,r.note,o.name,
        ${adultNameSql()} AS teacher
      FROM amp_school_purchase_requests r JOIN amp_orgs o ON o.id=r.org_id
      LEFT JOIN amp_people p ON p.tenant_id=o.path[1] AND p.account_id=r.account_id AND p.deleted_at IS NULL
      WHERE r.buyer_token_hash=$1 AND r.token_expires_at>now() AND r.status<>'closed'`,
      [hash(token)],
    )
  ).rows[0];
  if (!request) throw new SchoolError(404, "not_found");
  const counts = (
    await db.query(
      `SELECT count(DISTINCT p.learner_id)::int AS students,
    count(DISTINCT p.learner_id) FILTER (WHERE EXISTS(SELECT 1 FROM amp_attempts a WHERE a.learner_id=p.learner_id))::int AS participating
    FROM amp_enrollments e JOIN amp_classes c ON c.id=e.class_id AND c.archived_at IS NULL
    JOIN amp_orgs o ON o.id=c.org_id JOIN amp_people p ON p.id=e.person_id AND p.deleted_at IS NULL
    WHERE e.class_id=ANY($1::uuid[]) AND e.role='student' AND ${activeToday("e", "o")}`,
      [request.class_ids],
    )
  ).rows[0];
  const pilots = await Promise.all(
    request.class_ids.map((id: string) => classPilotState(db, id)),
  );
  return {
    id: request.id,
    schoolName: request.name,
    seats: request.seats,
    status: request.status,
    // The teacher wrote it for this reader: their words, under their name.
    note: (request.note as string | null) ?? "",
    teacher: (request.teacher as string | null) ?? null,
    classCount: request.class_ids.length,
    ...counts,
    pilots,
  };
}
