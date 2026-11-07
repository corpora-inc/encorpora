import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { AGREEMENT_VERSION } from "./agreement.js";
import {
  divisionLabels,
  splitYear,
  yearName,
  type DivisionKind,
} from "./calendar.js";
import { SchoolError, type GradingKind } from "./contracts.js";
import { experienceValues } from "./classroom-contracts.js";
import { recordEvent } from "./events.js";
import {
  EVALUATION_DAYS,
  EVALUATION_SEATS,
  SELF_SERVE_ORG_LIMIT,
} from "./license.js";
import { generateHandle, type SchoolRepository } from "./repository.js";
import {
  assertSettingsWritable,
  defaultSettings,
  SettingLockedError,
  type SettingsScope,
} from "./settings.js";
import { markStaffAccount } from "./staff-account.js";
import {
  acceptAgreementSchema,
  addDivisionSchema,
  calendarSchema,
  experienceSchema,
  finishSetupSchema,
  sessionUpdateSchema,
  startSetupSchema,
  type ExperiencePreset,
  type SessionResource,
  type SetupState,
} from "./setup-contracts.js";

function presetFor(values: Record<string, unknown>): ExperiencePreset | null {
  for (const [preset, wanted] of Object.entries(experienceValues))
    if (
      Object.entries(wanted).every(
        ([key, value]) => (values[key] ?? defaultKey(key)) === value,
      )
    )
      return preset as ExperiencePreset;
  return null;
}
const defaultKey = (key: string) =>
  (defaultSettings as Record<string, unknown>)[key];

async function accountEmail(client: PoolClient, accountId: string) {
  if (!accountId.startsWith("amp|")) return null;
  return ((
    await client.query("SELECT email FROM amp_auth_users WHERE id=$1", [
      accountId.slice(4),
    ])
  ).rows[0]?.email ?? null) as string | null;
}
/** A first label for a head or teacher, replaced by their real name when they
 * sign the agreement. */
const provisionalName = (email: string | null) =>
  (email?.split("@")[0] ?? "Admin").slice(0, 100) || "Admin";

/** Step one: the org exists from here, so every later step and a reload have
 * something to write to. A second submit carries on with the same org. */
export async function startSetup(
  repo: SchoolRepository,
  accountId: string,
  raw: unknown,
) {
  const input = startSetupSchema.parse(raw);
  return repo.transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `school-setup:${accountId}`,
    ]);
    const mine = (
      await client.query(
        `SELECT id,setup_pending FROM amp_orgs WHERE created_by=$1 ORDER BY created_at DESC`,
        [accountId],
      )
    ).rows;
    const pending = mine.find((row) => row.setup_pending);
    if (pending) {
      await writeSchool(client, repo, pending.id, input);
      return { id: pending.id as string };
    }
    if (mine.length >= SELF_SERVE_ORG_LIMIT)
      throw new SchoolError(409, "setup_limit");
    const id = randomUUID();
    await client.query(
      `INSERT INTO amp_orgs(id,kind,path,name,timezone,solo,setup_pending,created_by)
       VALUES($1,'school',$2,$3,$4,$5,true,$6)`,
      [
        id,
        [id],
        input.name,
        input.timezone,
        input.shape === "class",
        accountId,
      ],
    );
    const personId = randomUUID();
    const email = await accountEmail(client, accountId);
    await client.query(
      `INSERT INTO amp_people(id,tenant_id,given_name,handle,email,account_id,timezone)
       VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [
        personId,
        id,
        provisionalName(email),
        generateHandle(),
        email,
        accountId,
        input.timezone,
      ],
    );
    const today = await repo.today(client, input.timezone);
    await client.query(
      "INSERT INTO amp_org_roles(id,person_id,org_id,role,begin_on) VALUES($1,$2,$3,'admin',$4)",
      [randomUUID(), personId, id, today],
    );
    if (input.shape === "class")
      await client.query(
        "INSERT INTO amp_org_roles(id,person_id,org_id,role,begin_on) VALUES($1,$2,$3,'teacher',$4)",
        [randomUUID(), personId, id, today],
      );
    await recordEvent(client, {
      orgId: id,
      actorPersonId: personId,
      action: "org.created",
      targetKind: "org",
      targetId: id,
      detail: { after: { kind: "school", solo: input.shape === "class" } },
    });
    await markStaffAccount(client, accountId);
    return { id };
  });
}
async function writeSchool(
  client: PoolClient,
  repo: SchoolRepository,
  orgId: string,
  input: { name: string; shape: "class" | "school"; timezone: string },
) {
  await client.query(
    "UPDATE amp_orgs SET name=$2,timezone=$3,solo=$4 WHERE id=$1",
    [orgId, input.name, input.timezone, input.shape === "class"],
  );
  await client.query("UPDATE amp_people SET timezone=$2 WHERE tenant_id=$1", [
    orgId,
    input.timezone,
  ]);
  const today = await repo.today(client, input.timezone);
  const admins = (
    await client.query(
      "SELECT person_id FROM amp_org_roles WHERE org_id=$1 AND role='admin' AND end_on IS NULL",
      [orgId],
    )
  ).rows;
  for (const { person_id: personId } of admins)
    if (input.shape === "class")
      await client.query(
        `INSERT INTO amp_org_roles(id,person_id,org_id,role,begin_on) VALUES($1,$2,$3,'teacher',$4)
         ON CONFLICT (person_id,org_id,role) WHERE end_on IS NULL DO NOTHING`,
        [randomUUID(), personId, orgId, today],
      );
    else
      await client.query(
        "UPDATE amp_org_roles SET end_on=$3 WHERE person_id=$1 AND org_id=$2 AND role='teacher' AND end_on IS NULL",
        [personId, orgId, today],
      );
}
export async function updateSetupSchool(
  repo: SchoolRepository,
  orgId: string,
  raw: unknown,
) {
  const input = startSetupSchema.parse(raw);
  await repo.transaction((client) => writeSchool(client, repo, orgId, input));
}

/* Calendar. */
async function ownYear(client: PoolClient, orgId: string) {
  return (
    await client.query(
      `SELECT id,starts_on::text AS starts_on,ends_on::text AS ends_on FROM amp_academic_sessions
       WHERE org_id=$1 AND kind='year' ORDER BY starts_on DESC,id LIMIT 1`,
      [orgId],
    )
  ).rows[0] as { id: string; starts_on: string; ends_on: string } | undefined;
}
export async function insertDivision(
  client: PoolClient,
  orgId: string,
  year: { id: string; starts_on: string; ends_on: string },
  kind: DivisionKind,
) {
  const exists = await client.query(
    "SELECT 1 FROM amp_academic_sessions WHERE parent_id=$1 AND kind=$2 LIMIT 1",
    [year.id, kind],
  );
  if (exists.rowCount) return;
  for (const session of splitYear(year.starts_on, year.ends_on, kind))
    await client.query(
      `INSERT INTO amp_academic_sessions(id,org_id,parent_id,kind,name,starts_on,ends_on)
       VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [
        randomUUID(),
        orgId,
        year.id,
        kind,
        session.name,
        session.startsOn,
        session.endsOn,
      ],
    );
}

/** The session tree for a year. During setup a change of mind replaces what it
 * wrote; once classes hang off it, the year's dates move and terms stay until a
 * person edits them on the calendar screen. */
export async function setCalendar(
  repo: SchoolRepository,
  orgId: string,
  raw: unknown,
  actorPersonId: string | null,
) {
  const input = calendarSchema.parse(raw);
  return repo.transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `school-calendar:${orgId}`,
    ]);
    const org = (
      await client.query("SELECT setup_pending FROM amp_orgs WHERE id=$1", [
        orgId,
      ])
    ).rows[0];
    if (!org) throw new SchoolError(404, "org_not_found");
    const name = yearName(input.startsOn, input.endsOn);
    let year = await ownYear(client, orgId);
    if (year) {
      await client.query(
        "UPDATE amp_academic_sessions SET name=$2,starts_on=$3,ends_on=$4 WHERE id=$1",
        [year.id, name, input.startsOn, input.endsOn],
      );
      if (org.setup_pending)
        await client.query(
          `DELETE FROM amp_academic_sessions s WHERE s.parent_id=$1
           AND NOT EXISTS(SELECT 1 FROM amp_classes c WHERE c.session_id=s.id)`,
          [year.id],
        );
    } else {
      const id = randomUUID();
      await client.query(
        "INSERT INTO amp_academic_sessions(id,org_id,kind,name,starts_on,ends_on) VALUES($1,$2,'year',$3,$4,$5)",
        [id, orgId, name, input.startsOn, input.endsOn],
      );
      year = {
        id,
        starts_on: input.startsOn,
        ends_on: input.endsOn,
      };
    }
    const dated = {
      ...year,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
    };
    if (input.division)
      await insertDivision(client, orgId, dated, input.division);
    await recordEvent(client, {
      orgId,
      actorPersonId,
      action: "calendar.set",
      targetKind: "session",
      targetId: dated.id,
      detail: { after: input },
    });
    return { yearId: dated.id };
  });
}
/** "Decide later": a default year, so classes have somewhere to live. */
export async function defaultCalendar(repo: SchoolRepository, orgId: string) {
  return repo.transaction(async (client) => {
    const org = await repo.org(client, orgId);
    return { yearId: await repo.yearSession(client, org) };
  });
}
export async function addDivision(
  repo: SchoolRepository,
  orgId: string,
  raw: unknown,
) {
  const { kind } = addDivisionSchema.parse(raw);
  return repo.transaction(async (client) => {
    await ensureDivision(client, repo, orgId, kind);
    return { kind };
  });
}
/** A class can choose any grading period; the calendar grows to match. */
export async function ensureDivision(
  client: PoolClient,
  repo: SchoolRepository,
  orgId: string,
  kind: GradingKind,
) {
  if (!(kind in divisionLabels)) return;
  const org = await repo.org(client, orgId);
  await repo.yearSession(client, org);
  const year = await ownYear(client, orgId);
  if (year) await insertDivision(client, orgId, year, kind as DivisionKind);
}
export async function calendar(
  repo: SchoolRepository,
  orgId: string,
): Promise<SessionResource[]> {
  const path = (
    await repo.pool.query("SELECT path FROM amp_orgs WHERE id=$1", [orgId])
  ).rows[0]?.path as string[] | undefined;
  if (!path) throw new SchoolError(404, "org_not_found");
  return (
    await repo.pool.query(
      `SELECT id,parent_id AS "parentId",kind,name,starts_on::text AS "startsOn",ends_on::text AS "endsOn",
         org_id<>$2 AS inherited
       FROM amp_academic_sessions WHERE org_id=ANY($1::uuid[])
       ORDER BY kind='year' DESC,CASE WHEN kind='year' THEN starts_on END DESC,starts_on,id`,
      [path, orgId],
    )
  ).rows;
}
export async function updateSession(
  repo: SchoolRepository,
  orgId: string,
  sessionId: string,
  raw: unknown,
  actorPersonId: string | null,
) {
  const input = sessionUpdateSchema.parse(raw);
  return repo.transaction(async (client) => {
    const session = (
      await client.query(
        `UPDATE amp_academic_sessions SET name=COALESCE($3,name),starts_on=$4,ends_on=$5
         WHERE id=$1 AND org_id=$2 RETURNING id`,
        [sessionId, orgId, input.name ?? null, input.startsOn, input.endsOn],
      )
    ).rows[0];
    if (!session) throw new SchoolError(404, "session_not_found");
    await recordEvent(client, {
      orgId,
      actorPersonId,
      action: "calendar.session-changed",
      targetKind: "session",
      targetId: sessionId,
      detail: { after: { startsOn: input.startsOn, endsOn: input.endsOn } },
    });
    return { id: sessionId };
  });
}

/* Student experience. */
export async function setExperience(
  repo: SchoolRepository,
  orgId: string,
  raw: unknown,
  actorPersonId: string | null,
) {
  const { preset } = experienceSchema.parse(raw);
  const changes = experienceValues[preset];
  return repo.transaction(async (client) => {
    const org = await repo.org(client, orgId);
    const above = (
      await client.query(
        `SELECT scope_kind AS kind,scope_id AS id,"values",locked FROM amp_scope_settings
         WHERE scope_kind='org' AND scope_id=ANY($1::uuid[]) AND scope_id<>$2`,
        [org.path, org.id],
      )
    ).rows as SettingsScope[];
    try {
      assertSettingsWritable(above, changes);
    } catch (error) {
      if (error instanceof SettingLockedError)
        throw new SchoolError(409, "setting_locked");
      throw error;
    }
    const before = (
      await client.query(
        `SELECT "values" FROM amp_scope_settings WHERE scope_kind='org' AND scope_id=$1`,
        [org.id],
      )
    ).rows[0]?.values;
    await client.query(
      `INSERT INTO amp_scope_settings(scope_kind,scope_id,"values") VALUES('org',$1,$2)
       ON CONFLICT(scope_kind,scope_id) DO UPDATE SET "values"=amp_scope_settings."values"||excluded."values",updated_at=now()`,
      [org.id, JSON.stringify(changes)],
    );
    await recordEvent(client, {
      orgId: org.id,
      actorPersonId,
      action: "settings.changed",
      targetKind: "org",
      targetId: org.id,
      detail: { before: before ?? null, after: changes },
    });
    return { preset };
  });
}

/* Agreement and license. */
async function ensureEvaluationLicense(
  client: PoolClient,
  repo: SchoolRepository,
  orgId: string,
  now = new Date(),
) {
  const held = await client.query(
    "SELECT 1 FROM amp_school_licenses WHERE org_id=$1 LIMIT 1",
    [orgId],
  );
  if (held.rowCount) return;
  await repo.issueLicenseIn(client, {
    orgId,
    seats: EVALUATION_SEATS,
    endsAt: new Date(
      now.getTime() + EVALUATION_DAYS * 86_400_000,
    ).toISOString(),
    reference: "Evaluation",
  });
}
/** The signer's name also becomes the person's own, in place of the label from
 * their email address. Students can be added from here on, so the evaluation
 * license starts now. */
export async function acceptSetupAgreement(
  repo: SchoolRepository,
  orgId: string,
  raw: unknown,
  actorPersonId: string | null,
) {
  const input = acceptAgreementSchema.parse(raw);
  if (input.version !== AGREEMENT_VERSION)
    throw new SchoolError(409, "agreement_changed");
  return repo.transaction(async (client) => {
    const org = await repo.org(client, orgId);
    const id = await repo.acceptAgreement(client, org.id, input, actorPersonId);
    if (actorPersonId) {
      const words = input.signerName.split(/\s+/);
      const family = words.length > 1 ? words.pop()! : null;
      await client.query(
        "UPDATE amp_people SET given_name=$2,family_name=$3 WHERE id=$1",
        [actorPersonId, words.join(" "), family],
      );
    }
    await ensureEvaluationLicense(client, repo, org.id);
    return { id };
  });
}

/** The last step. A lone teacher always ends with a class to land on. */
export async function finishSetup(
  repo: SchoolRepository,
  orgId: string,
  raw: unknown,
  actorPersonId: string | null,
) {
  const input = finishSetupSchema.parse(raw);
  return repo.transaction(async (client) => {
    const org = (
      await client.query(
        "SELECT solo,setup_pending FROM amp_orgs WHERE id=$1",
        [orgId],
      )
    ).rows[0];
    if (!org) throw new SchoolError(404, "org_not_found");
    const signed = await client.query(
      "SELECT 1 FROM amp_data_agreements WHERE org_id=$1 AND ended_at IS NULL LIMIT 1",
      [orgId],
    );
    if (!signed.rowCount) throw new SchoolError(409, "agreement_required");
    await ensureEvaluationLicense(client, repo, orgId);
    const existing = (
      await client.query(
        "SELECT id FROM amp_classes WHERE org_id=$1 AND archived_at IS NULL ORDER BY created_at,id LIMIT 1",
        [orgId],
      )
    ).rows[0]?.id as string | undefined;
    let classId = existing ?? null;
    if (!existing && (input.className || org.solo)) {
      const division = (
        await client.query(
          `SELECT kind FROM amp_academic_sessions WHERE org_id=$1 AND parent_id IS NOT NULL
           ORDER BY starts_on,id LIMIT 1`,
          [orgId],
        )
      ).rows[0]?.kind as GradingKind | undefined;
      const created = await repo.createClassIn(
        client,
        orgId,
        {
          name: input.className ?? "My class",
          gradingKind: division ?? "year",
        },
        actorPersonId,
      );
      classId = created.id;
      if (org.solo && actorPersonId) {
        const today = await repo.today(
          client,
          (await repo.org(client, orgId)).timezone,
        );
        await repo.enroll(client, created.id, actorPersonId, "teacher", today);
      }
    }
    // With the rest of this step, so trying again can't add anyone twice.
    for (const name of input.names ?? [])
      await repo.provisionStudentIn(
        client,
        orgId,
        {
          ...splitTyped(name),
          ...(input.gradeLevel !== undefined
            ? { gradeLevel: input.gradeLevel }
            : {}),
          ...(classId ? { classId } : {}),
        },
        actorPersonId,
      );
    await client.query("UPDATE amp_orgs SET setup_pending=false WHERE id=$1", [
      orgId,
    ]);
    if (org.setup_pending)
      await recordEvent(client, {
        orgId,
        actorPersonId,
        action: "setup.finished",
        targetKind: "org",
        targetId: orgId,
        detail: { after: { classId } },
      });
    return { classId, solo: org.solo as boolean };
  });
}
function splitTyped(name: string) {
  const words = name.trim().split(/\s+/);
  return words.length > 1
    ? { givenName: words.slice(0, -1).join(" "), familyName: words.at(-1)! }
    : { givenName: words[0]! };
}

export async function setupState(
  repo: SchoolRepository,
  orgId: string,
): Promise<SetupState> {
  const pool = repo.pool;
  const org = (
    await pool.query(
      `SELECT id,name,solo,timezone,setup_pending AS "setupPending" FROM amp_orgs WHERE id=$1`,
      [orgId],
    )
  ).rows[0];
  if (!org) throw new SchoolError(404, "org_not_found");
  const year = (
    await pool.query(
      `SELECT y.starts_on::text AS "startsOn",y.ends_on::text AS "endsOn",
         (SELECT s.kind FROM amp_academic_sessions s WHERE s.parent_id=y.id ORDER BY s.starts_on,s.id LIMIT 1) AS division
       FROM amp_academic_sessions y WHERE y.org_id=$1 AND y.kind='year' ORDER BY y.starts_on DESC,y.id LIMIT 1`,
      [orgId],
    )
  ).rows[0];
  const settings = (
    await pool.query(
      `SELECT "values" FROM amp_scope_settings WHERE scope_kind='org' AND scope_id=$1`,
      [orgId],
    )
  ).rows[0]?.values as Record<string, unknown> | undefined;
  const agreement = (
    await pool.query(
      `SELECT version,signer_name AS "signerName",signer_title AS "signerTitle",accepted_at AS "acceptedAt"
       FROM amp_data_agreements WHERE org_id=$1 AND ended_at IS NULL ORDER BY accepted_at DESC,id LIMIT 1`,
      [orgId],
    )
  ).rows[0];
  const firstClass = (
    await pool.query(
      "SELECT id,name FROM amp_classes WHERE org_id=$1 AND archived_at IS NULL ORDER BY created_at,id LIMIT 1",
      [orgId],
    )
  ).rows[0];
  return {
    org,
    calendar: year ?? null,
    experience: settings ? presetFor(settings) : null,
    agreement: agreement
      ? { ...agreement, acceptedAt: agreement.acceptedAt.toISOString() }
      : null,
    firstClass: firstClass ?? null,
  };
}
