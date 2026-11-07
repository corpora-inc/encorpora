import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { SchoolError, type GradingKind } from "./contracts.js";
import { recordEvent } from "./events.js";
import type { SchoolRepository } from "./repository.js";
import { learnerNameFrom, writeStudent } from "./roster.js";
import {
  applyRosterSchema,
  planRosterSchema,
  type ApplyResult,
  type PlanResult,
  type RosterSource,
} from "./setup-contracts.js";
import { nameKey, type RosterClass, type RosterRow } from "./sources/rows.js";
import { inviteStaffIn, type InviteKeys, type IssuedInvite } from "./staff.js";

type Existing = {
  id: string;
  given_name: string;
  family_name: string | null;
  display_name: string | null;
  email: string | null;
  identifier: string | null;
  grade_level: number | null;
  learner_id: string | null;
  account_id: string | null;
  classes: string[];
  deleted_at: Date | null;
};
const FROM_PEOPLE = `SELECT p.id,p.given_name,p.family_name,p.display_name,p.email,p.identifier,p.grade_level,p.learner_id,p.account_id,p.deleted_at,
  ARRAY(SELECT r.sourced_id FROM amp_enrollments e JOIN amp_external_refs r ON r.local_id=e.class_id AND r.kind='class' AND r.tenant_id=p.tenant_id AND r.source=$2
    WHERE e.person_id=p.id AND e.end_on IS NULL) AS classes
  FROM amp_people p`;
const fullName = (row: { givenName: string; familyName?: string }) =>
  nameKey(`${row.givenName} ${row.familyName ?? ""}`);
const personName = (person: Existing) =>
  nameKey(`${person.given_name} ${person.family_name ?? ""}`);

async function tenantOf(repo: SchoolRepository, orgId: string) {
  const org = (
    await repo.pool.query("SELECT id,path,kind FROM amp_orgs WHERE id=$1", [
      orgId,
    ])
  ).rows[0];
  if (!org) throw new SchoolError(404, "org_not_found");
  // A roster lives in a school; a district imports into each of its schools.
  if (org.kind !== "school") throw new SchoolError(409, "import_needs_school");
  return { tenantId: org.path[0] as string };
}

/** What differs between a row and the person it matched, in words a person can
 * check. Names are never in this list: a changed name is held, not changed. */
function differences(row: RosterRow, person: Existing): string[] {
  const out: string[] = [];
  if (row.gradeLevel !== undefined && row.gradeLevel !== person.grade_level)
    out.push("grade");
  if (row.email && row.email !== person.email?.toLowerCase()) out.push("email");
  if (row.identifier && row.identifier !== person.identifier)
    out.push("student ID");
  const had = new Set(person.classes);
  if (row.classes.some((klass) => !had.has(klass.sourcedId)))
    out.push("classes");
  return out;
}

async function lookUp(
  db: Pick<PoolClient, "query">,
  tenantId: string,
  source: RosterSource,
  rows: RosterRow[],
) {
  const refs = new Map<string, string>(
    (
      await db.query(
        `SELECT sourced_id,local_id FROM amp_external_refs
         WHERE tenant_id=$1 AND source=$2 AND kind='person' AND sourced_id=ANY($3::text[])`,
        [tenantId, source, rows.map((row) => row.sourcedId)],
      )
    ).rows.map((row) => [row.sourced_id, row.local_id]),
  );
  const people = new Map<string, Existing>(
    refs.size
      ? (
          await db.query(`${FROM_PEOPLE} WHERE p.id=ANY($1::uuid[])`, [
            [...refs.values()],
            source,
          ])
        ).rows.map((person: Existing) => [person.id, person])
      : [],
  );
  return { refs, people };
}

/** People in this tenant no import has claimed: someone typed in by hand, for
 * example. A row with no ref may be one of them. */
async function unclaimed(
  db: Pick<PoolClient, "query">,
  tenantId: string,
  source: RosterSource,
) {
  return (
    await db.query(
      `${FROM_PEOPLE} WHERE p.tenant_id=$1 AND p.deleted_at IS NULL
       AND NOT EXISTS(SELECT 1 FROM amp_external_refs x WHERE x.tenant_id=p.tenant_id AND x.source=$2 AND x.kind='person' AND x.local_id=p.id)`,
      [tenantId, source],
    )
  ).rows as Existing[];
}
type Match = {
  person: Existing | null;
  held?: "name_changed" | "possible_match";
};
function matcher(
  refs: Map<string, string>,
  people: Map<string, Existing>,
  loose: Existing[],
) {
  const taken = new Set<string>();
  const student = (person: Existing) => !!person.learner_id;
  return (row: RosterRow): Match => {
    const refId = refs.get(row.sourcedId);
    const person = refId ? people.get(refId) : undefined;
    if (person && !person.deleted_at)
      // A reused SIS ID can't hand one child another's record.
      return fullName(row) === personName(person) || row.role !== "student"
        ? { person }
        : { person, held: "name_changed" };
    if (row.role !== "student") {
      const staff = row.email
        ? loose.find(
            (other) =>
              !student(other) && other.email?.toLowerCase() === row.email,
          )
        : undefined;
      return { person: staff ?? null };
    }
    if (row.identifier) {
      const same = loose.find(
        (other) =>
          student(other) &&
          !taken.has(other.id) &&
          other.identifier === row.identifier,
      );
      if (same) {
        taken.add(same.id);
        return fullName(row) === personName(same)
          ? { person: same }
          : { person: same, held: "name_changed" };
      }
    }
    const named = loose.find(
      (other) =>
        student(other) &&
        !taken.has(other.id) &&
        personName(other) === fullName(row) &&
        (other.grade_level === null ||
          row.gradeLevel === undefined ||
          other.grade_level === row.gradeLevel),
    );
    if (named) {
      taken.add(named.id);
      return { person: named, held: "possible_match" };
    }
    return { person: null };
  };
}

/** The dry run: reads only, row by row. */
export async function planRoster(
  repo: SchoolRepository,
  orgId: string,
  raw: unknown,
): Promise<PlanResult[]> {
  const { source, rows } = planRosterSchema.parse(raw);
  const { tenantId } = await tenantOf(repo, orgId);
  const { refs, people } = await lookUp(repo.pool, tenantId, source, rows);
  const loose = rows.some((row) => !refs.has(row.sourcedId))
    ? await unclaimed(repo.pool, tenantId, source)
    : [];
  const match = matcher(refs, people, loose);
  return rows.map((row) => {
    const { person, held } = match(row);
    if (held)
      return {
        line: row.line,
        status: "held",
        reason: held,
        existing: learnerNameFrom(person!),
      };
    if (!person) return { line: row.line, status: "new" };
    const changes = differences(row, person);
    return changes.length
      ? { line: row.line, status: "changed", changes }
      : { line: row.line, status: "unchanged" };
  });
}

/* Applying: classes first, then a person, one transaction each, so a retry
   repeats nothing and a failed row costs only itself. */
async function ensureSession(
  client: PoolClient,
  tenantId: string,
  orgId: string,
  source: RosterSource,
  session: NonNullable<RosterClass["session"]>,
  parentId: string | null,
) {
  const known = (
    await client.query(
      `SELECT local_id FROM amp_external_refs WHERE tenant_id=$1 AND source=$2 AND kind='session' AND sourced_id=$3`,
      [tenantId, source, session.sourcedId],
    )
  ).rows[0];
  if (known) return known.local_id as string;
  const id = randomUUID();
  await client.query(
    `INSERT INTO amp_academic_sessions(id,org_id,parent_id,kind,name,starts_on,ends_on) VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [
      id,
      orgId,
      parentId,
      session.kind,
      session.name,
      session.startsOn,
      session.endsOn,
    ],
  );
  await client.query(
    `INSERT INTO amp_external_refs(tenant_id,source,kind,sourced_id,local_id) VALUES($1,$2,'session',$3,$4)`,
    [tenantId, source, session.sourcedId, id],
  );
  return id;
}
/** The classes a chunk names, created or found, once each. A class with no ref
 * yet may be one a person already made with this name: it's linked, not copied. */
async function ensureClasses(
  repo: SchoolRepository,
  tenantId: string,
  orgId: string,
  source: RosterSource,
  rows: RosterRow[],
  actorPersonId: string | null,
) {
  const wanted = new Map<string, RosterClass>();
  for (const row of rows)
    for (const klass of row.classes) wanted.set(klass.sourcedId, klass);
  const ids = new Map<string, string>();
  if (!wanted.size) return ids;
  await repo.transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `school-roster:${tenantId}:${source}`,
    ]);
    const known = await client.query(
      `SELECT sourced_id,local_id FROM amp_external_refs
       WHERE tenant_id=$1 AND source=$2 AND kind='class' AND sourced_id=ANY($3::text[])`,
      [tenantId, source, [...wanted.keys()]],
    );
    // A file that doesn't say grades by what the school's calendar is divided into.
    const division = (
      await client.query(
        `SELECT kind FROM amp_academic_sessions WHERE org_id=$1 AND parent_id IS NOT NULL
         ORDER BY starts_on,id LIMIT 1`,
        [orgId],
      )
    ).rows[0]?.kind as GradingKind | undefined;
    for (const row of known.rows) ids.set(row.sourced_id, row.local_id);
    for (const klass of wanted.values()) {
      if (ids.has(klass.sourcedId)) continue;
      const named = (
        await client.query(
          `SELECT id FROM amp_classes WHERE org_id=$1 AND lower(name)=lower($2) AND archived_at IS NULL
           AND NOT EXISTS(SELECT 1 FROM amp_external_refs x WHERE x.tenant_id=$3 AND x.source=$4 AND x.kind='class' AND x.local_id=amp_classes.id)
           ORDER BY created_at,id LIMIT 1`,
          [orgId, klass.name, tenantId, source],
        )
      ).rows[0];
      let classId = named?.id as string | undefined;
      if (!classId) {
        const year = klass.year
          ? await ensureSession(
              client,
              tenantId,
              orgId,
              source,
              klass.year,
              null,
            )
          : null;
        const sessionId =
          klass.session && klass.session.sourcedId !== klass.year?.sourcedId
            ? await ensureSession(
                client,
                tenantId,
                orgId,
                source,
                klass.session,
                year,
              )
            : year;
        const created = await repo.createClassIn(
          client,
          orgId,
          {
            name: klass.name,
            courseBands: klass.courseBands,
            gradingKind:
              (klass.gradingKind as GradingKind | undefined) ??
              division ??
              "year",
            ...(sessionId ? { sessionId } : {}),
          },
          actorPersonId,
        );
        classId = created.id;
      }
      await client.query(
        `INSERT INTO amp_external_refs(tenant_id,source,kind,sourced_id,local_id) VALUES($1,$2,'class',$3,$4)
         ON CONFLICT DO NOTHING`,
        [tenantId, source, klass.sourcedId, classId],
      );
      ids.set(klass.sourcedId, classId);
    }
  });
  return ids;
}

async function claimRef(
  client: PoolClient,
  tenantId: string,
  source: RosterSource,
  sourcedId: string,
  personId: string,
) {
  const claimed = await client.query(
    `INSERT INTO amp_external_refs(tenant_id,source,kind,sourced_id,local_id) VALUES($1,$2,'person',$3,$4)
     ON CONFLICT DO NOTHING RETURNING local_id`,
    [tenantId, source, sourcedId, personId],
  );
  return !!claimed.rowCount;
}

export type RosterInvite = IssuedInvite;
/** One chunk. Safe to send again: rows already applied come back `unchanged`.
 * Invitations for new staff are returned so the caller can mail them after the
 * row's transaction has committed. */
export async function applyRoster(
  repo: SchoolRepository,
  keys: InviteKeys,
  orgId: string,
  raw: unknown,
  actorPersonId: string | null,
): Promise<{ results: ApplyResult[]; invites: RosterInvite[] }> {
  const { source, rows, resolutions = {} } = applyRosterSchema.parse(raw);
  const { tenantId } = await tenantOf(repo, orgId);
  const classIds = await ensureClasses(
    repo,
    tenantId,
    orgId,
    source,
    rows,
    actorPersonId,
  );
  const { refs, people } = await lookUp(repo.pool, tenantId, source, rows);
  const loose = rows.some((row) => !refs.has(row.sourcedId))
    ? await unclaimed(repo.pool, tenantId, source)
    : [];
  const match = matcher(refs, people, loose);
  const results: ApplyResult[] = [];
  const invites: RosterInvite[] = [];
  for (const row of rows) {
    const found = match(row);
    const decision = resolutions[String(row.line)];
    if (found.held && !decision) {
      results.push({ line: row.line, status: "held" });
      continue;
    }
    const classes = row.classes.map((klass) => classIds.get(klass.sourcedId)!);
    const context = {
      tenantId,
      source,
      orgId,
      row,
      classes,
      actorPersonId,
    };
    try {
      results.push(
        await repo.transaction(async (client) => {
          // A different child, or an ID left by someone since removed: this row
          // starts a new record, and the ID belongs to it from here on.
          if (decision === "new" || (!found.person && refs.has(row.sourcedId)))
            await client.query(
              `DELETE FROM amp_external_refs WHERE tenant_id=$1 AND source=$2 AND kind='person' AND sourced_id=$3`,
              [tenantId, source, row.sourcedId],
            );
          const person = decision === "new" ? null : found.person;
          if (person)
            return updateExisting(client, repo, {
              ...context,
              person,
              rename: found.held === "name_changed",
            });
          return row.role === "student"
            ? addStudent(client, repo, context)
            : addStaff(client, repo, keys, invites, context);
        }),
      );
    } catch (error) {
      const code =
        error instanceof SchoolError ? error.code : "roster_row_failed";
      // The row's line and database code only: a message could quote a name.
      console.error("[schools] roster row failed", {
        line: row.line,
        code: (error as { code?: unknown }).code,
      });
      results.push({ line: row.line, status: "failed", code });
    }
  }
  return { results, invites };
}

type RowContext = {
  tenantId: string;
  source: RosterSource;
  orgId: string;
  row: RosterRow;
  classes: string[];
  actorPersonId: string | null;
};
async function addStudent(
  client: PoolClient,
  repo: SchoolRepository,
  { tenantId, source, orgId, row, classes, actorPersonId }: RowContext,
): Promise<ApplyResult> {
  const personId = randomUUID();
  if (!(await claimRef(client, tenantId, source, row.sourcedId, personId)))
    return { line: row.line, status: "unchanged" };
  const [first, ...more] = classes;
  const created = await repo.provisionStudentIn(
    client,
    orgId,
    {
      givenName: row.givenName,
      ...(row.familyName ? { familyName: row.familyName } : {}),
      ...(row.email ? { email: row.email } : {}),
      ...(row.identifier ? { identifier: row.identifier } : {}),
      ...(row.gradeLevel !== undefined ? { gradeLevel: row.gradeLevel } : {}),
      ...(first ? { classId: first } : {}),
    },
    actorPersonId,
    new Date(),
    personId,
  );
  if (more.length) {
    const org = await repo.org(client, created.orgId);
    const today = await repo.today(client, org.timezone);
    for (const classId of more)
      await repo.enroll(client, classId, personId, "student", today);
  }
  return { line: row.line, status: "created", seated: created.seated };
}
async function addStaff(
  client: PoolClient,
  repo: SchoolRepository,
  keys: InviteKeys,
  invites: RosterInvite[],
  { tenantId, source, orgId, row, classes, actorPersonId }: RowContext,
): Promise<ApplyResult> {
  const personId = randomUUID();
  if (!(await claimRef(client, tenantId, source, row.sourcedId, personId)))
    return { line: row.line, status: "unchanged" };
  const issued = await inviteStaffIn(
    client,
    repo,
    keys,
    orgId,
    {
      ...(row.email ? { email: row.email } : {}),
      role: row.role === "aide" ? "aide" : "teacher",
      givenName: row.givenName,
      ...(row.familyName ? { familyName: row.familyName } : {}),
      classIds: classes,
      personId,
    },
    actorPersonId,
  );
  if (issued.personId !== personId)
    await client.query(
      `UPDATE amp_external_refs SET local_id=$4 WHERE tenant_id=$1 AND source=$2 AND kind='person' AND sourced_id=$3`,
      [tenantId, source, row.sourcedId, issued.personId],
    );
  invites.push(issued);
  return { line: row.line, status: "created" };
}
async function updateExisting(
  client: PoolClient,
  repo: SchoolRepository,
  {
    tenantId,
    source,
    orgId,
    row,
    person,
    classes,
    rename,
    actorPersonId,
  }: RowContext & { person: Existing; rename: boolean },
): Promise<ApplyResult> {
  const linked = await claimRef(
    client,
    tenantId,
    source,
    row.sourcedId,
    person.id,
  );
  const changes = differences(row, person);
  if (!changes.length && !rename)
    return { line: row.line, status: linked ? "updated" : "unchanged" };
  const org = await repo.org(client, orgId);
  const today = await repo.today(client, org.timezone);
  const isStudent = !!person.learner_id;
  await writeStudent(client, person.id, {
    ...(rename
      ? { givenName: row.givenName, familyName: row.familyName ?? null }
      : {}),
    ...(row.gradeLevel !== undefined && isStudent
      ? { gradeLevel: row.gradeLevel }
      : {}),
    ...(row.email ? { email: row.email } : {}),
    ...(row.identifier ? { identifier: row.identifier } : {}),
  });
  const role = isStudent ? "student" : row.role === "aide" ? "aide" : "teacher";
  for (const classId of classes)
    await repo.enroll(client, classId, person.id, role, today);
  if (!isStudent)
    await client.query(
      `INSERT INTO amp_org_roles(id,person_id,org_id,role,begin_on) VALUES($1,$2,$3,$4,$5)
       ON CONFLICT (person_id,org_id,role) WHERE end_on IS NULL DO NOTHING`,
      [randomUUID(), person.id, org.id, role, today],
    );
  await recordEvent(client, {
    orgId: org.id,
    actorPersonId,
    action: isStudent ? "student.updated" : "staff.updated",
    targetKind: "person",
    targetId: person.id,
    detail: { after: { fields: changes, renamed: rename, source } },
  });
  return { line: row.line, status: "updated" };
}
