import { isDeepStrictEqual } from "node:util";
import { applySourceEvidence, rosterClassDigest } from "./source-evidence.js";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { SchoolError, type GradingKind } from "./contracts.js";
import { activeToday } from "./principal.js";
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
import { namedStudentId } from "./sources/csv.js";
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
  class_ids: string[];
  org_ids: string[];
  source_metadata: Record<
    string,
    {
      schoolImports?: Record<
        string,
        { evidence?: RosterRow["sourceEvidence"]; classDigest?: string }
      >;
      classImports?: Record<
        string,
        { evidence?: RosterRow["sourceEvidence"]; classDigest?: string }
      >;
    }
  >;
  deleted_at: Date | null;
};
const FROM_PEOPLE = `SELECT p.id,p.given_name,p.family_name,p.display_name,p.email,p.identifier,p.grade_level,p.learner_id,p.account_id,p.deleted_at,
  ARRAY(SELECT r.sourced_id FROM amp_enrollments e JOIN amp_external_refs r ON r.local_id=e.class_id AND r.kind='class' AND r.tenant_id=p.tenant_id AND r.source=$2
    JOIN amp_classes c ON c.id=e.class_id JOIN amp_orgs o ON o.id=c.org_id
    WHERE e.person_id=p.id AND ${activeToday("e", "o")}) AS classes,
  ARRAY(SELECT e.class_id FROM amp_enrollments e JOIN amp_classes c ON c.id=e.class_id JOIN amp_orgs o ON o.id=c.org_id WHERE e.person_id=p.id AND ${activeToday("e", "o")}) AS class_ids,
  ARRAY(SELECT r.org_id FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id WHERE r.person_id=p.id AND ${activeToday("r", "o")}) AS org_ids,
  (SELECT jsonb_object_agg(x.sourced_id,x.metadata) FROM amp_external_refs x WHERE x.local_id=p.id AND x.tenant_id=p.tenant_id AND x.source=$2 AND x.kind='person') AS source_metadata
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
function differences(
  row: RosterRow,
  person: Existing,
  scope?: ImportScope,
  orgId?: string,
): string[] {
  const out: string[] = [];
  if (row.gradeLevel !== undefined && row.gradeLevel !== person.grade_level)
    out.push("grade");
  if (row.email && row.email !== person.email?.toLowerCase()) out.push("email");
  if (row.identifier && row.identifier !== person.identifier)
    out.push("student ID");
  const previous = scope
    ? person.source_metadata?.[row.sourcedId]?.classImports?.[scope.classId]
    : person.source_metadata?.[row.sourcedId]?.schoolImports?.[orgId!];
  if (
    row.sourceEvidence &&
    (!isDeepStrictEqual(previous?.evidence, row.sourceEvidence) ||
      previous?.classDigest !== rosterClassDigest(row))
  )
    out.push("source memberships");
  const had = new Set(person.classes);
  if (
    scope
      ? !person.class_ids.includes(scope.classId)
      : !row.sourceEvidence &&
        row.classes.some((klass) => !had.has(klass.sourcedId))
  )
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

/** Unclaimed people can match a stable ID. CSV name-only keys may also change
 * after a class move or a legacy import; those names require review. */
async function unclaimed(
  db: Pick<PoolClient, "query">,
  tenantId: string,
  source: RosterSource,
  orgId: string,
) {
  return (
    await db.query(
      `${FROM_PEOPLE} WHERE p.tenant_id=$1 AND p.deleted_at IS NULL
       AND (NOT EXISTS(SELECT 1 FROM amp_external_refs x WHERE x.tenant_id=p.tenant_id AND x.source=$2 AND x.kind='person' AND x.local_id=p.id)
         OR ($2='csv' AND EXISTS(SELECT 1 FROM amp_org_roles r WHERE r.person_id=p.id AND r.org_id=$3 AND r.end_on IS NULL)))`,
      [tenantId, source, orgId],
    )
  ).rows as Existing[];
}
type Match = {
  person: Existing | null;
  held?:
    "name_changed" | "possible_match" | "ambiguous_match" | "outside_class";
};
function matcher(
  refs: Map<string, string>,
  people: Map<string, Existing>,
  loose: Existing[],
  orgId: string,
  scope?: ImportScope,
  taken = new Set<string>(refs.values()),
) {
  const student = (person: Existing) => !!person.learner_id;
  return (row: RosterRow): Match => {
    const refId = refs.get(row.sourcedId);
    const person = refId ? people.get(refId) : undefined;
    if (person && scope && !person.class_ids.includes(scope.classId))
      return { person: null, held: "outside_class" };
    if (
      person &&
      !person.deleted_at &&
      student(person) !== (row.role === "student")
    )
      return { person: null, held: "ambiguous_match" };
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
      const matches = loose.filter(
        (other) =>
          student(other) &&
          !taken.has(other.id) &&
          other.identifier === row.identifier,
      );
      if (matches.length > 1) return { person: null, held: "ambiguous_match" };
      const same = matches[0];
      if (same) {
        if (scope && !same.class_ids.includes(scope.classId))
          return { person: null, held: "outside_class" };
        taken.add(same.id);
        return fullName(row) === personName(same)
          ? { person: same }
          : { person: same, held: "name_changed" };
      }
    }
    const matches = loose.filter(
      (other) =>
        student(other) &&
        !taken.has(other.id) &&
        other.org_ids.includes(orgId) &&
        (!scope || other.class_ids.includes(scope.classId)) &&
        personName(other) === fullName(row) &&
        (!row.identifier || !other.identifier),
    );
    if (matches.length > 1) return { person: null, held: "ambiguous_match" };
    const named = matches[0];
    if (named) {
      taken.add(named.id);
      return { person: named, held: "possible_match" };
    }
    return { person: null };
  };
}

/** Authorization belongs to the route. This bound prevents a class import
 * from creating classes or attaching people outside its authorized class. */
export type ImportScope = { classId: string };
async function importRows(
  repo: SchoolRepository,
  orgId: string,
  source: RosterSource,
  input: RosterRow[],
  scope?: ImportScope,
) {
  let rows = input;
  for (const row of rows)
    if (row.sourceEvidence) {
      if (source !== "oneroster")
        throw new SchoolError(400, "source_evidence_invalid");
      const evidence = row.sourceEvidence;
      const roleNames = [
        ...evidence.roles
          .filter((role) => ["student", "teacher", "aide"].includes(role.role))
          .map((role) => role.role),
        ...evidence.enrollments.map((e) => e.role),
      ];
      if (
        roleNames.some(
          (role) => (role === "student") !== (row.role === "student"),
        )
      )
        throw new SchoolError(400, "source_identity_role_conflict");
      const ids = new Set(row.classes.map((c) => c.sourcedId));
      if (
        row.classes.some(
          (c) =>
            c.sourceSchoolId && c.sourceSchoolId !== evidence.schoolSourcedId,
        ) ||
        evidence.enrollments.some(
          (e) =>
            !ids.has(e.classSourcedId) ||
            (e.schoolSourcedId &&
              e.schoolSourcedId !== evidence.schoolSourcedId),
        )
      )
        throw new SchoolError(400, "source_school_scope_invalid");
      if (
        [...evidence.roles, ...evidence.enrollments].some(
          (e) => e.startsOn && e.endsOn && e.endsOn < e.startsOn,
        )
      )
        throw new SchoolError(400, "source_membership_dates_invalid");
    }
  if (scope) {
    const { rows: classes } = await repo.pool.query(
      `SELECT id,name,course_bands FROM amp_classes WHERE id=$1 AND org_id=$2 AND archived_at IS NULL`,
      [scope.classId, orgId],
    );
    const klass = classes[0];
    if (!klass) throw new SchoolError(404, "class_not_found");
    if (rows.some((row) => row.role !== "student"))
      throw new SchoolError(400, "class_import_students_only");
    rows = rows.map((row) => ({
      ...row,
      sourcedId:
        source === "csv" && !row.identifier && row.sourcedId.startsWith("name:")
          ? namedStudentId(row.givenName, row.familyName, klass.name)
          : row.sourcedId,
      classes: [
        {
          sourcedId: `amp-class:${klass.id}`,
          name: klass.name,
          courseBands: klass.course_bands,
        },
      ],
    }));
  }
  const scoped = scopedRows(source, orgId, rows);
  if (new Set(scoped.map((row) => row.sourcedId)).size !== scoped.length)
    throw new SchoolError(400, "duplicate_roster_identity");
  if (new Set(scoped.map((row) => row.line)).size !== scoped.length)
    throw new SchoolError(400, "duplicate_roster_line");
  return scoped;
}

/** A CSV knows a class, or a person with no student ID, only by name, and a
 * name means something only inside the school the file is for: two schools in
 * a district each have a "Grade 3 Math". Those keys are kept per school; a
 * student ID or a teacher's email stays the whole tenant's, so a district-wide
 * ID finds the same student at any of its schools. */
export function scopedRows(
  source: RosterSource,
  orgId: string,
  rows: RosterRow[],
): RosterRow[] {
  if (source !== "csv") return rows;
  const key = (id: string) => (id.startsWith("name:") ? `${orgId}/${id}` : id);
  return rows.map((row) => ({
    ...row,
    sourcedId: row.identifier ? row.sourcedId : key(row.sourcedId),
    classes: row.classes.map((klass) => ({
      ...klass,
      sourcedId: key(klass.sourcedId),
    })),
  }));
}

/** The dry run: reads only, row by row. */
export async function planRoster(
  repo: SchoolRepository,
  orgId: string,
  raw: unknown,
  scope?: ImportScope,
): Promise<PlanResult[]> {
  const parsed = planRosterSchema.parse(raw);
  const { source } = parsed;
  const rows = await importRows(repo, orgId, source, parsed.rows, scope);
  const { tenantId } = await tenantOf(repo, orgId);
  const { refs, people } = await lookUp(repo.pool, tenantId, source, rows);
  const loose = rows.some((row) => !refs.has(row.sourcedId))
    ? await unclaimed(repo.pool, tenantId, source, orgId)
    : [];
  const match = matcher(refs, people, loose, orgId, scope);
  return rows.map((row) => {
    const { person, held } = match(row);
    if (held)
      return {
        line: row.line,
        status: "held",
        reason: held,
        ...(person ? { existing: learnerNameFrom(person) } : {}),
      };
    if (!person) return { line: row.line, status: "new" };
    const changes = differences(row, person, scope, orgId);
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
  const key =
    source === "oneroster"
      ? `${orgId}/${session.sourcedId}`
      : session.sourcedId;
  const known = (
    await client.query(
      `SELECT local_id FROM amp_external_refs WHERE tenant_id=$1 AND source=$2 AND kind='session' AND sourced_id=$3`,
      [tenantId, source, key],
    )
  ).rows[0];
  if (known) {
    if (source === "oneroster")
      await client.query(
        `UPDATE amp_academic_sessions SET name=$2,kind=$3,starts_on=$4,ends_on=$5,parent_id=$6 WHERE id=$1 AND org_id=$7`,
        [
          known.local_id,
          session.name,
          session.kind,
          session.startsOn,
          session.endsOn,
          parentId,
          orgId,
        ],
      );
    return known.local_id as string;
  }
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
    [tenantId, source, key, id],
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
    for (const klass of row.classes) {
      const previous = wanted.get(klass.sourcedId);
      if (previous && !isDeepStrictEqual(previous, klass))
        throw new SchoolError(400, "source_class_conflict");
      wanted.set(klass.sourcedId, klass);
    }
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
    // A file that doesn't say grades by what the school's calendar is divided
    // into: its own, or the district's it inherits.
    const division = (
      await client.query(
        `SELECT s.kind FROM amp_orgs o JOIN amp_academic_sessions s ON s.org_id=ANY(o.path)
         WHERE o.id=$1 AND s.parent_id IS NOT NULL
         ORDER BY array_position(o.path,s.org_id) DESC,s.starts_on,s.id LIMIT 1`,
        [orgId],
      )
    ).rows[0]?.kind as GradingKind | undefined;
    for (const row of known.rows) ids.set(row.sourced_id, row.local_id);
    for (const klass of wanted.values()) {
      if (ids.has(klass.sourcedId) && source !== "oneroster") continue;
      const named =
        source === "oneroster"
          ? undefined
          : (
              await client.query(
                `SELECT id FROM amp_classes WHERE org_id=$1 AND lower(name)=lower($2) AND archived_at IS NULL
           AND NOT EXISTS(SELECT 1 FROM amp_external_refs x WHERE x.tenant_id=$3 AND x.source=$4 AND x.kind='class' AND x.local_id=amp_classes.id)
           ORDER BY created_at,id LIMIT 1`,
                [orgId, klass.name, tenantId, source],
              )
            ).rows[0];
      let classId =
        ids.get(klass.sourcedId) ?? (named?.id as string | undefined);
      if (
        classId &&
        source === "oneroster" &&
        !(
          await client.query(
            "SELECT 1 FROM amp_classes WHERE id=$1 AND org_id=$2",
            [classId, orgId],
          )
        ).rowCount
      )
        throw new SchoolError(409, "source_school_scope_invalid");
      const year = klass.year
        ? await ensureSession(client, tenantId, orgId, source, klass.year, null)
        : null;
      if (source === "oneroster")
        for (const session of klass.sessions ?? []) {
          const local = await ensureSession(
            client,
            tenantId,
            orgId,
            source,
            session,
            session.kind === "year" ? null : year,
          );
          await client.query(
            `UPDATE amp_external_refs SET metadata=$5 WHERE tenant_id=$1 AND source=$2 AND kind='session' AND local_id=$3 AND sourced_id=$4`,
            [
              tenantId,
              source,
              local,
              `${orgId}/${session.sourcedId}`,
              {
                sourcedId: session.sourcedId,
                parentSourcedId: session.parentSourcedId ?? null,
              },
            ],
          );
        }
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
      if (!classId) {
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
      if (source === "oneroster") {
        if (sessionId)
          await client.query(
            "UPDATE amp_classes SET session_id=$2 WHERE id=$1",
            [classId, sessionId],
          );
        await client.query(
          `UPDATE amp_external_refs SET metadata=$4 WHERE tenant_id=$1 AND source=$2 AND kind='class' AND sourced_id=$3`,
          [
            tenantId,
            source,
            klass.sourcedId,
            {
              schoolSourcedId: klass.sourceSchoolId ?? null,
              termSourcedIds: klass.termSourcedIds ?? [],
              sessionSourcedIds: (klass.sessions ?? []).map(
                (session) => session.sourcedId,
              ),
            },
          ],
        );
      }
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
  scope?: ImportScope,
): Promise<{ results: ApplyResult[]; invites: RosterInvite[] }> {
  const parsed = applyRosterSchema.parse(raw);
  const { source, resolutions = {} } = parsed;
  if (!scope && parsed.rows.some((row) => row.sourceEvidence)) {
    const agreement = (
      await repo.pool.query(
        `SELECT a.ended_at FROM amp_orgs o JOIN LATERAL
      (SELECT ended_at FROM amp_data_agreements WHERE org_id=ANY(o.path) ORDER BY array_position(o.path,org_id) DESC,accepted_at DESC,id LIMIT 1) a ON true WHERE o.id=$1`,
        [orgId],
      )
    ).rows[0];
    if (!agreement || agreement.ended_at)
      throw new SchoolError(409, "agreement_required");
  }
  const rows = await importRows(repo, orgId, source, parsed.rows, scope);
  const { tenantId } = await tenantOf(repo, orgId);
  const classIds = scope
    ? new Map([[`amp-class:${scope.classId}`, scope.classId]])
    : await ensureClasses(repo, tenantId, orgId, source, rows, actorPersonId);
  const initial = await lookUp(repo.pool, tenantId, source, rows);
  const taken = new Set<string>(initial.refs.values());
  const results: ApplyResult[] = [];
  const invites: RosterInvite[] = [];
  for (const row of rows) {
    const decision = resolutions[String(row.line)];
    const classes = row.classes.map((klass) => classIds.get(klass.sourcedId)!);
    const context = {
      tenantId,
      source,
      orgId,
      row,
      classes,
      classIds,
      actorPersonId,
      scope,
    };
    try {
      results.push(
        await repo.transaction(async (client) => {
          // Imports into the same tenant/source serialize identity decisions.
          // A concurrent retry must see the ref created by the first request
          // before deciding whether "Different student" replaces anything.
          await client.query(
            "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
            [`school-roster:${tenantId}:${source}`],
          );
          const { refs, people } = await lookUp(client, tenantId, source, [
            row,
          ]);
          const loose = refs.has(row.sourcedId)
            ? []
            : await unclaimed(client, tenantId, source, orgId);
          const found = matcher(refs, people, loose, orgId, scope, taken)(row);
          if (
            found.held === "outside_class" ||
            (found.held === "ambiguous_match" && decision !== "new") ||
            (found.held && !decision)
          )
            return { line: row.line, status: "held" as const };
          // A different child, or an ID left by someone since removed: this row
          // starts a new record, and the ID belongs to it from here on.
          const makeNew = decision === "new" && !!found.held;
          if (makeNew || (!found.person && refs.has(row.sourcedId)))
            await client.query(
              `DELETE FROM amp_external_refs WHERE tenant_id=$1 AND source=$2 AND kind='person' AND sourced_id=$3`,
              [tenantId, source, row.sourcedId],
            );
          const person = makeNew ? null : found.person;
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
  classIds: Map<string, string>;
  actorPersonId: string | null;
  scope?: ImportScope;
};
async function addStudent(
  client: PoolClient,
  repo: SchoolRepository,
  {
    tenantId,
    source,
    orgId,
    row,
    classes,
    classIds,
    actorPersonId,
    scope,
  }: RowContext,
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
  if (row.sourceEvidence && !scope) {
    // This newly allocated person has no independent memberships. Replace only
    // the provisioner's initial defaults, before the transaction is visible.
    await client.query("DELETE FROM amp_enrollments WHERE person_id=$1", [
      personId,
    ]);
    await client.query("DELETE FROM amp_org_roles WHERE person_id=$1", [
      personId,
    ]);
  } else if (more.length) {
    const org = await repo.org(client, created.orgId);
    const today = await repo.today(client, org.timezone);
    for (const classId of more)
      await repo.enroll(client, classId, personId, "student", today);
  }
  const org = await repo.org(client, orgId);
  await applySourceEvidence(client, {
    tenantId,
    orgId,
    personId,
    source,
    row,
    classIds,
    today: await repo.today(client, org.timezone),
    scope,
  });
  return { line: row.line, status: "created", seated: created.seated };
}
async function addStaff(
  client: PoolClient,
  repo: SchoolRepository,
  keys: InviteKeys,
  invites: RosterInvite[],
  {
    tenantId,
    source,
    orgId,
    row,
    classes,
    classIds,
    actorPersonId,
    scope,
  }: RowContext,
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
      skipMemberships: !!row.sourceEvidence && !scope,
    },
    actorPersonId,
  );
  if (issued.personId !== personId)
    await client.query(
      `UPDATE amp_external_refs SET local_id=$4 WHERE tenant_id=$1 AND source=$2 AND kind='person' AND sourced_id=$3`,
      [tenantId, source, row.sourcedId, issued.personId],
    );
  const org = await repo.org(client, orgId);
  await applySourceEvidence(client, {
    tenantId,
    orgId,
    personId: issued.personId,
    source,
    row,
    classIds,
    today: await repo.today(client, org.timezone),
    scope,
  });
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
    classIds,
    rename,
    actorPersonId,
    scope,
  }: RowContext & { person: Existing; rename: boolean },
): Promise<ApplyResult> {
  const linked = await claimRef(
    client,
    tenantId,
    source,
    row.sourcedId,
    person.id,
  );
  const changes = differences(row, person, scope, orgId);
  const sourceOrg = await repo.org(client, orgId);
  const sourceChanged = await applySourceEvidence(client, {
    tenantId,
    orgId,
    personId: person.id,
    source,
    row,
    classIds,
    today: await repo.today(client, sourceOrg.timezone),
    scope,
  });
  if (sourceChanged && !changes.includes("source memberships"))
    changes.push("source memberships");
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
  if (!row.sourceEvidence || scope)
    for (const classId of classes)
      await repo.enroll(client, classId, person.id, role, today);
  if (!isStudent && !row.sourceEvidence)
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
