import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { PoolClient } from "pg";
import {
  birthYearForGrade,
  generateHandle,
  generateJoinCode,
} from "../repository.js";
import { learnerNameFrom } from "../roster.js";
import { SchoolError } from "../contracts.js";
import { namingConsentActive } from "../../server/account-access.js";
import {
  CleverSyncError,
  gradeLevel,
  userRoles,
  type Kind,
  type RosterRecord,
  type Snapshot,
  type Term,
  type User,
} from "./model.js";
import { cleverSource, requireAgreement } from "./connection.js";

export type Connection = {
  id: string;
  tenant_id: string;
  district_id: string;
  status: string;
  events_enabled: boolean;
  event_cursor: string | null;
  last_full_sync_at: Date | null;
  last_sync_at: Date | null;
};
type Binding = {
  local_id: string | null;
  record: RosterRecord;
  archived_at: Date | null;
  metadata: Record<string, unknown>;
};
const text = (
  value: string | null | undefined,
  fallback: string,
  length = 100,
) => value?.trim().slice(0, length) || fallback;
const optional = (value: string | null | undefined, length = 100) =>
  value?.trim().slice(0, length) || null;
const key = (kind: Kind, id: string) => `${kind}:${id}`;

/** Reconstruct the last committed source snapshot for an Events delta. */
export async function storedSnapshot(
  db: PoolClient,
  connectionId: string,
): Promise<Snapshot> {
  const rows = (
    await db.query(
      `SELECT kind,record FROM amp_clever_bindings
    WHERE connection_id=$1 AND archived_at IS NULL`,
      [connectionId],
    )
  ).rows;
  const records = (kind: Kind) =>
    rows.filter((x) => x.kind === kind).map((x) => x.record);
  const district = records("district")[0];
  if (!district) throw new CleverSyncError("clever_full_sync_required");
  return {
    district,
    schools: records("school"),
    users: records("user"),
    sections: records("section"),
    courses: records("course"),
    terms: records("term"),
  };
}

/** One transaction applies a complete, validated source view. No learning
 * evidence, grades, or manual membership is deleted by roster reconciliation. */
export async function applySnapshot(
  db: PoolClient,
  connection: Connection,
  runId: string,
  snapshot: Snapshot,
  now: Date,
) {
  const root = await requireAgreement(db, connection.tenant_id);
  const today = (
    await db.query(
      "SELECT to_char($1::timestamptz AT TIME ZONE $2,'YYYY-MM-DD') AS day",
      [now, root.timezone],
    )
  ).rows[0].day as string;
  const bindings = new Map<string, Binding>(
    (
      await db.query(
        `SELECT kind,clever_id,local_id,record,metadata,archived_at
    FROM amp_clever_bindings WHERE connection_id=$1`,
        [connection.id],
      )
    ).rows.map((x) => [key(x.kind, x.clever_id), x]),
  );
  const lookup = (kind: Kind, id: string) => bindings.get(key(kind, id));
  const local = (kind: Kind, id: string) => lookup(kind, id)?.local_id;
  const reviewed = (
    await db.query(
      `SELECT kind,sourced_id,local_id FROM amp_external_refs
     WHERE tenant_id=$1 AND source=$2 AND kind IN ('person','org','class')`,
      [root.id, cleverSource(connection.id)],
    )
  ).rows;
  const reviewedFor = (kind: string) =>
    new Map<string, string>(
      reviewed
        .filter((r) => r.kind === kind)
        .map((r) => [r.sourced_id, r.local_id]),
    );
  const reviewedPeople = reviewedFor("person"),
    reviewedSchools = reviewedFor("org"),
    reviewedClasses = reviewedFor("class");
  const adoptedPeople = new Set(reviewedPeople.values()),
    adoptedClasses = new Set(reviewedClasses.values()),
    adoptedSchools = new Set(reviewedSchools.values());
  const saved: {
    kind: Kind;
    clever_id: string;
    local_id: string | null;
    record: RosterRecord;
    metadata: Record<string, unknown>;
  }[] = [];
  const seen: { kind: Kind; clever_id: string }[] = [];
  const save = (
    kind: Kind,
    record: RosterRecord,
    id: string | null,
    metadata: Record<string, unknown> = {},
  ) => {
    const prior = lookup(kind, record.id);
    if (
      prior &&
      !prior.archived_at &&
      prior.local_id === id &&
      isDeepStrictEqual(prior.record, record) &&
      isDeepStrictEqual(prior.metadata, metadata)
    )
      seen.push({ kind, clever_id: record.id });
    else
      saved.push({
        kind,
        clever_id: record.id,
        local_id: id,
        record,
        metadata,
      });
    bindings.set(key(kind, record.id), {
      local_id: id,
      record,
      metadata,
      archived_at: null,
    });
  };
  save("district", snapshot.district, root.id);
  // Institution names stay local; source schools and courses follow the roster.
  const schools = snapshot.schools.map((school) => {
    const known = local("school", school.id) ?? reviewedSchools.get(school.id),
      id = known ?? randomUUID();
    save("school", school, id);
    return {
      id,
      known: !!known,
      path: [...root.path, id],
      name: text(school.name, "School", 200),
    };
  });
  await batches(
    schools.filter((s) => s.known),
    async (rows) => {
      const existing = await db.query(
        `SELECT id FROM amp_orgs WHERE id=ANY($1::uuid[]) AND kind='school' AND path[1]=$2 AND NOT demo`,
        [rows.map((s) => s.id), root.id],
      );
      if (existing.rowCount !== new Set(rows.map((s) => s.id)).size)
        throw new CleverSyncError("clever_school_match_requires_review");
    },
  );
  await batches([...new Map(schools.map((s) => [s.id, s])).values()], (rows) =>
    db.query(
      `INSERT INTO amp_orgs(id,kind,parent_id,path,name,timezone)
     SELECT x.id,'school',$2,x.path,x.name,$3 FROM jsonb_to_recordset($1::jsonb) AS x(id uuid,path uuid[],name text)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name WHERE amp_orgs.name IS DISTINCT FROM excluded.name`,
      [JSON.stringify(rows), root.id, root.timezone],
    ),
  );
  const courses = snapshot.courses.map((course) => {
    const id = local("course", course.id) ?? randomUUID();
    save("course", course, id);
    return { id, name: course.name ?? null, number: course.number ?? null };
  });
  await batches(courses, (rows) =>
    db.query(
      `INSERT INTO amp_courses(id,org_id,name,number) SELECT x.id,$2,x.name,x.number
     FROM jsonb_to_recordset($1::jsonb) AS x(id uuid,name text,number text)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name,number=excluded.number,archived_at=NULL
       WHERE (amp_courses.name,amp_courses.number,amp_courses.archived_at) IS DISTINCT FROM (excluded.name,excluded.number,NULL::timestamptz)`,
      [JSON.stringify(rows), root.id],
    ),
  );
  // Undated terms remain source records; classes use a stable local calendar.
  const terms: {
    id: string;
    name: string;
    starts_on: string;
    ends_on: string;
  }[] = [];
  for (const term of snapshot.terms) {
    const dates = termDates(term);
    let id = local("term", term.id) ?? null;
    if (dates) {
      id ??= randomUUID();
      terms.push({
        id,
        name: text(term.name, "Term"),
        starts_on: dates[0],
        ends_on: dates[1],
      });
    }
    save("term", term, id, { datesAvailable: !!dates });
  }
  await batches(terms, (rows) =>
    db.query(
      `INSERT INTO amp_academic_sessions(id,org_id,kind,name,starts_on,ends_on)
     SELECT x.id,$2,'custom',x.name,x.starts_on,x.ends_on FROM jsonb_to_recordset($1::jsonb)
       AS x(id uuid,name text,starts_on date,ends_on date)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name,starts_on=excluded.starts_on,ends_on=excluded.ends_on
       WHERE (amp_academic_sessions.name,amp_academic_sessions.starts_on,amp_academic_sessions.ends_on)
         IS DISTINCT FROM (excluded.name,excluded.starts_on,excluded.ends_on)`,
      [JSON.stringify(rows), root.id],
    ),
  );
  const orderedUsers = [...snapshot.users].sort((a, b) =>
    (local("user", a.id) ?? reviewedPeople.get(a.id) ?? a.id).localeCompare(
      local("user", b.id) ?? reviewedPeople.get(b.id) ?? b.id,
    ),
  );
  const people = new Map<string, PersonWrite>();
  for (const user of orderedUsers) {
    const roles = userRoles(user);
    let id = local("user", user.id) ?? reviewedPeople.get(user.id) ?? null;
    if (!roles.some((role) => role !== "contact")) {
      save("user", user, id, { roles });
      continue;
    }
    const fresh = !id;
    id ??= randomUUID();
    const previous = people.get(id),
      grade = gradeLevel(user.roles.student?.grade);
    people.set(id, {
      id,
      fresh: previous?.fresh ?? fresh,
      given_name: text(user.name.first, "User"),
      family_name: optional(user.name.last),
      email: optional(user.email, 320),
      grade_level: grade,
      needsLearner: !!user.roles.student || !!previous?.needsLearner,
      birthGrade: grade ?? previous?.birthGrade ?? null,
      identifier:
        user.roles.student?.student_number ??
        user.roles.student?.sis_id ??
        user.roles.teacher?.teacher_number ??
        user.roles.teacher?.sis_id ??
        user.roles.staff?.staff_id ??
        null,
    });
    save("user", user, id, { roles });
  }

  const year = now.getUTCFullYear() - (now.getUTCMonth() < 7 ? 1 : 0);
  let fallbackSession: string | undefined;
  const fallback = async () => {
    if (fallbackSession) return fallbackSession;
    // One stable local calendar per connection/year, separate from source terms.
    const source = `clever-calendar:${connection.id}`;
    const known = (
      await db.query(
        `SELECT local_id FROM amp_external_refs WHERE tenant_id=$1
      AND source=$2 AND kind='session' AND sourced_id=$3`,
        [root.id, source, String(year)],
      )
    ).rows[0];
    if (known) return (fallbackSession = known.local_id);
    fallbackSession = randomUUID();
    await db.query(
      `INSERT INTO amp_academic_sessions(id,org_id,kind,name,starts_on,ends_on)
      VALUES($1,$2,'year',$3,$4,$5)`,
      [
        fallbackSession,
        root.id,
        `${year}–${year + 1}`,
        `${year}-08-01`,
        `${year + 1}-07-31`,
      ],
    );
    await db.query(
      `INSERT INTO amp_external_refs(tenant_id,source,kind,sourced_id,local_id)
      VALUES($1,$2,'session',$3,$4)`,
      [root.id, source, String(year), fallbackSession],
    );
    return fallbackSession;
  };
  const termIds = new Set(snapshot.terms.map((t) => t.id)),
    courseIds = new Set(snapshot.courses.map((c) => c.id));
  const classes = [];
  for (const section of snapshot.sections) {
    const prior = lookup("section", section.id),
      known = prior?.local_id ?? reviewedClasses.get(section.id),
      id = known ?? randomUUID();
    const term =
      section.term_id && termIds.has(section.term_id)
        ? lookup("term", section.term_id)
        : undefined;
    const hasDates = term?.metadata.datesAvailable === true;
    classes.push({
      id,
      fresh: !known,
      org_id: local("school", section.school)!,
      session_id: hasDates && term?.local_id ? term.local_id : await fallback(),
      name: text(section.name, "Class"),
      old_name: text(
        (prior?.record as { name?: string } | undefined)?.name,
        "Class",
      ),
      grading_kind: hasDates ? "custom" : "year",
      join_code: known ? null : generateJoinCode(),
      course_id:
        section.course && courseIds.has(section.course)
          ? (local("course", section.course) ?? null)
          : null,
      restore: !!prior?.archived_at,
    });
    save("section", section, id, { syntheticCalendar: !hasDates });
  }
  await batches(
    classes.filter((c) => c.fresh),
    (rows) =>
      db.query(
        `INSERT INTO amp_classes(id,org_id,session_id,name,grading_kind,join_code,course_id)
     SELECT x.id,x.org_id,x.session_id,x.name,x.grading_kind,x.join_code,x.course_id
     FROM jsonb_to_recordset($1::jsonb) AS x(id uuid,org_id uuid,session_id uuid,name text,grading_kind text,join_code text,course_id uuid)`,
        [JSON.stringify(rows)],
      ),
  );
  await batches(
    classes.filter((c) => !c.fresh),
    (rows) =>
      db.query(
        `UPDATE amp_classes c SET org_id=x.org_id,session_id=x.session_id,
       name=CASE WHEN c.name=x.old_name THEN x.name ELSE c.name END,course_id=x.course_id,
       archived_at=CASE WHEN x.restore THEN NULL ELSE c.archived_at END
     FROM jsonb_to_recordset($1::jsonb) AS x(id uuid,org_id uuid,session_id uuid,name text,old_name text,course_id uuid,restore boolean)
     WHERE c.id=x.id AND (c.org_id,c.session_id,c.name,c.course_id,c.archived_at)
       IS DISTINCT FROM (x.org_id,x.session_id,CASE WHEN c.name=x.old_name THEN x.name ELSE c.name END,x.course_id,CASE WHEN x.restore THEN NULL ELSE c.archived_at END)`,
        [JSON.stringify(rows)],
      ),
  );

  const wanted = new Map<string, MembershipWrite>();
  const membership = (
    kind: "org_role" | "enrollment",
    scope: string,
    person: string,
    role: string,
  ) => {
    const source_key = `${scope}:${person}:${role}`;
    wanted.set(`${kind}:${source_key}`, {
      kind,
      source_key,
      scope_id: scope,
      person_id: person,
      role,
      adopted:
        adoptedPeople.has(person) &&
        (kind === "enrollment"
          ? adoptedClasses.has(scope)
          : adoptedSchools.has(scope)),
    });
  };
  const schoolIds = new Set(snapshot.schools.map((s) => s.id));
  const schoolRoles = (user: User, role: "student" | "teacher" | "staff") => {
    const profile = user.roles[role];
    if (!profile) return;
    if (
      role === "staff" &&
      !user.roles.staff?.roles?.includes("SchoolTechLead")
    )
      return;
    for (const sourceId of new Set([
      ...(profile.schools ?? []),
      ...(profile.school ? [profile.school] : []),
    ])) {
      const orgId = local("school", sourceId);
      if (schoolIds.has(sourceId) && orgId)
        membership(
          "org_role",
          orgId,
          local("user", user.id)!,
          role === "staff" ? "viewer" : role,
        );
    }
  };
  for (const user of snapshot.users) {
    if (!local("user", user.id)) continue;
    if (user.roles.district_admin)
      membership("org_role", root.id, local("user", user.id)!, "admin");
    schoolRoles(user, "student");
    schoolRoles(user, "teacher");
    schoolRoles(user, "staff");
  }
  for (const section of snapshot.sections) {
    const classId = local("section", section.id)!;
    const orgId = local("school", section.school)!;
    for (const [role, ids] of [
      ["student", section.students],
      [
        "teacher",
        [
          ...(section.teachers ?? []),
          ...(section.teacher ? [section.teacher] : []),
        ],
      ],
    ] as const) {
      for (const id of new Set(ids)) {
        const personId = local("user", id)!;
        membership("org_role", orgId, personId, role);
        membership("enrollment", classId, personId, role);
      }
    }
  }
  const memberships = await prepareMemberships(db, connection.id, [
    ...wanted.values(),
  ]);
  const protectedPeople = new Set(
    saved
      .filter((b) => b.kind === "user" && b.local_id)
      .map((b) => b.local_id!),
  );
  for (const group of memberships.groups)
    for (const m of group.missing) protectedPeople.add(m.person_id);
  await writeRosterPeople(db, root, [...people.values()], now, protectedPeople);
  await writeMemberships(db, connection.id, runId, today, memberships);
  await batches(saved, (rows) =>
    db.query(
      `INSERT INTO amp_clever_bindings(connection_id,kind,clever_id,local_id,record,metadata,last_seen_run_id)
     SELECT $2,x.kind,x.clever_id,x.local_id,x.record,x.metadata,$3 FROM jsonb_to_recordset($1::jsonb)
       AS x(kind text,clever_id text,local_id uuid,record jsonb,metadata jsonb)
     ON CONFLICT(connection_id,kind,clever_id) DO UPDATE SET local_id=excluded.local_id,
       record=excluded.record,metadata=excluded.metadata,archived_at=NULL,last_seen_run_id=excluded.last_seen_run_id`,
      [JSON.stringify(rows), connection.id, runId],
    ),
  );
  // An unchanged source row needs only a checkpoint. In particular, never
  // restore its personal payload or clear an archive written by privacy deletion.
  await batches(seen, (rows) =>
    db.query(
      `UPDATE amp_clever_bindings b SET last_seen_run_id=$3
    FROM jsonb_to_recordset($1::jsonb) AS x(kind text,clever_id text)
    WHERE b.connection_id=$2 AND b.kind=x.kind AND b.clever_id=x.clever_id`,
      [JSON.stringify(rows), connection.id, runId],
    ),
  );
  await endMissingMemberships(db, connection.id, runId, today);
  await db.query(
    `UPDATE amp_classes c SET archived_at=COALESCE(c.archived_at,$3)
    FROM amp_clever_bindings b WHERE b.connection_id=$1 AND b.kind='section'
      AND b.last_seen_run_id<>$2 AND c.id=b.local_id`,
    [connection.id, runId, now],
  );
  await db.query(
    `UPDATE amp_courses c SET archived_at=COALESCE(c.archived_at,$3)
    FROM amp_clever_bindings b WHERE b.connection_id=$1 AND b.kind='course'
      AND b.last_seen_run_id<>$2 AND c.id=b.local_id`,
    [connection.id, runId, now],
  );
  await db.query(
    `UPDATE amp_clever_bindings SET archived_at=COALESCE(archived_at,$3)
    WHERE connection_id=$1 AND last_seen_run_id<>$2`,
    [connection.id, runId, now],
  );
  return {
    schools: snapshot.schools.length,
    users: snapshot.users.length,
    sections: snapshot.sections.length,
    courses: snapshot.courses.length,
    terms: snapshot.terms.length,
  };
}

const BATCH_SIZE = 1000;
async function batches<T>(rows: T[], write: (rows: T[]) => Promise<unknown>) {
  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE)
    await write(rows.slice(offset, offset + BATCH_SIZE));
}
type PersonWrite = {
  id: string;
  fresh: boolean;
  given_name: string;
  family_name: string | null;
  email: string | null;
  grade_level: number | null;
  identifier: string | null;
  needsLearner: boolean;
  birthGrade: number | null;
};

/** The same privacy and propagation rules as writeStudent, applied in bounded
 * sets. Every account lock precedes every person/learner lock. Pending names
 * use the common consent checker; ordinary roster updates need no per-person SQL. */
type LoadedPerson = {
  id: string;
  learner_id: string | null;
  account_id: string | null;
  display_name: string | null;
  deleted_at: Date | null;
  given_name: string;
  family_name: string | null;
  email: string | null;
  identifier: string | null;
  grade_level: number | null;
  learner_name: string | null;
  learner_deleted_at: Date | null;
  name_pending: boolean | null;
  label_number: number | null;
  birth_year: number | null;
};
async function writeRosterPeople(
  db: PoolClient,
  root: { id: string; timezone: string },
  plans: PersonWrite[],
  now: Date,
  protectedPeople: Set<string>,
) {
  const all = plans.sort((a, b) => a.id.localeCompare(b.id)),
    freshIds = new Set(all.filter((p) => p.fresh).map((p) => p.id));
  const existingIds = [
    ...new Set(
      [
        ...all.filter((p) => !p.fresh).map((p) => p.id),
        ...protectedPeople,
      ].filter((id) => !freshIds.has(id)),
    ),
  ].sort();
  const before = new Map<string, LoadedPerson>();
  await batches(existingIds, async (ids) => {
    const found = await db.query<LoadedPerson>(
      `SELECT p.id,p.learner_id,p.display_name,p.deleted_at,p.given_name,p.family_name,p.email,p.identifier,p.grade_level,
      l.account_id,l.name AS learner_name,l.deleted_at AS learner_deleted_at,l.name_pending,l.label_number,l.birth_year
      FROM amp_people p LEFT JOIN amp_learners l ON l.id=p.learner_id WHERE p.id=ANY($1::uuid[]) AND p.tenant_id=$2`,
      [ids, root.id],
    );
    if (found.rowCount !== ids.length)
      throw new CleverSyncError("clever_deleted_person_requires_review");
    for (const row of found.rows) {
      if (row.deleted_at)
        throw new CleverSyncError("clever_deleted_person_requires_review");
      if (row.learner_id && (!row.account_id || row.learner_deleted_at))
        throw new SchoolError(409, "student_changed");
      before.set(row.id, row);
    }
  });
  const possibleGradeChanges = all
    .filter((p) => {
      const old = before.get(p.id);
      return (
        old?.learner_id &&
        old.label_number === null &&
        p.birthGrade !== null &&
        old.birth_year !== birthYearForGrade(p.birthGrade)
      );
    })
    .map((p) => before.get(p.id)!.learner_id!);
  const experienced = new Set<string>();
  await batches(possibleGradeChanges, async (ids) => {
    for (const row of (
      await db.query(
        "SELECT DISTINCT learner_id FROM amp_attempts WHERE learner_id=ANY($1::text[])",
        [ids],
      )
    ).rows)
      experienced.add(row.learner_id);
  });
  const changed = (p: PersonWrite) => {
    if (p.fresh) return true;
    const old = before.get(p.id)!;
    if (
      old.given_name !== p.given_name ||
      old.family_name !== p.family_name ||
      old.email !== p.email ||
      old.identifier !== p.identifier ||
      old.grade_level !== p.grade_level
    )
      return true;
    if (p.needsLearner && !old.learner_id) return true;
    if (old.learner_id) {
      if (
        old.name_pending ||
        old.learner_name !==
          learnerNameFrom({ ...p, display_name: old.display_name })
      )
        return true;
      if (
        old.label_number === null &&
        p.birthGrade !== null &&
        old.birth_year !== birthYearForGrade(p.birthGrade) &&
        !experienced.has(old.learner_id)
      )
        return true;
    }
    return false;
  };
  const selected = new Set([
    ...protectedPeople,
    ...all.filter(changed).map((p) => p.id),
  ]);
  const ordered = all.filter((p) => selected.has(p.id));
  // Fresh people are uncommitted and cannot yet be reached by practice or
  // privacy routes. Avoid allocating an advisory lock for every new learner.
  const selectedIds = existingIds.filter((id) => selected.has(id));
  const accounts = [
    ...new Set(
      selectedIds
        .map((id) => before.get(id)?.account_id)
        .filter((id): id is string => !!id),
    ),
  ].sort();
  await batches(accounts, (rows) =>
    db.query(
      `SELECT pg_advisory_xact_lock_shared(hashtextextended(account_id,0))
    FROM (SELECT unnest($1::text[]) AS account_id ORDER BY account_id) ordered`,
      [rows],
    ),
  );
  const people = new Map<
    string,
    { learner_id: string | null; display_name: string | null }
  >();
  await batches(selectedIds, async (ids) => {
    const found = await db.query(
      `SELECT id,learner_id,display_name,deleted_at FROM amp_people
      WHERE id=ANY($1::uuid[]) AND tenant_id=$2 ORDER BY id FOR UPDATE`,
      [ids, root.id],
    );
    if (found.rowCount !== ids.length)
      throw new CleverSyncError("clever_deleted_person_requires_review");
    for (const row of found.rows) {
      if (row.deleted_at)
        throw new CleverSyncError("clever_deleted_person_requires_review");
      if (row.learner_id !== before.get(row.id)?.learner_id)
        throw new SchoolError(409, "student_changed");
      people.set(row.id, row);
    }
  });
  const owners = new Map(
    selectedIds
      .map((id) => before.get(id)!)
      .filter((p) => p.learner_id)
      .map((p) => [p.learner_id!, p.account_id]),
  );
  const learnerIds = [...owners.keys()].sort(),
    approvedNames: string[] = [];
  await batches(learnerIds, async (ids) => {
    const found = await db.query(
      `SELECT id,account_id,name_pending,deleted_at FROM amp_learners
      WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE`,
      [ids],
    );
    if (found.rowCount !== ids.length)
      throw new SchoolError(409, "student_changed");
    for (const learner of found.rows) {
      if (learner.deleted_at || learner.account_id !== owners.get(learner.id))
        throw new SchoolError(409, "student_changed");
      if (
        learner.name_pending &&
        !(await namingConsentActive(db, learner.account_id, false, learner.id))
      )
        throw new SchoolError(403, "consent_required");
      if (learner.name_pending) approvedNames.push(learner.id);
    }
  });
  // Clear the approved unnamed state before the roster trigger sees names.
  await batches(approvedNames, (ids) =>
    db.query(
      "UPDATE amp_learners SET name_pending=false WHERE id=ANY($1::text[])",
      [ids],
    ),
  );
  await batches(
    ordered
      .filter((p) => p.fresh)
      .map((p) => ({ ...p, handle: generateHandle() })),
    (rows) =>
      db.query(
        `INSERT INTO amp_people(id,tenant_id,given_name,family_name,handle,email,grade_level,timezone,identifier)
     SELECT x.id,$2,x.given_name,x.family_name,x.handle,x.email,x.grade_level,$3,x.identifier
     FROM jsonb_to_recordset($1::jsonb) AS x(id uuid,given_name text,family_name text,handle text,email text,grade_level smallint,identifier text)`,
        [JSON.stringify(rows), root.id, root.timezone],
      ),
  );
  const writes = ordered.map((p) => {
    const existing = people.get(p.id),
      freshLearner = p.needsLearner && !existing?.learner_id;
    return {
      ...p,
      learner_id: existing?.learner_id ?? (freshLearner ? randomUUID() : null),
      freshLearner,
      name: learnerNameFrom({ ...p, display_name: existing?.display_name }),
      birth_year:
        p.birthGrade === null ? null : birthYearForGrade(p.birthGrade),
      initial_birth_year:
        p.birthGrade === null ? null : birthYearForGrade(p.birthGrade, now),
    };
  });
  await batches(
    writes.filter((p) => p.freshLearner),
    (rows) =>
      db.query(
        `INSERT INTO amp_learners(id,account_id,name,birth_year)
     SELECT x.learner_id,'school:'||x.id,x.name,x.initial_birth_year FROM jsonb_to_recordset($1::jsonb)
     AS x(id uuid,learner_id text,name text,initial_birth_year integer)`,
        [JSON.stringify(rows)],
      ),
  );
  await batches(writes, (rows) =>
    db.query(
      `UPDATE amp_people p SET learner_id=x.learner_id,given_name=x.given_name,family_name=x.family_name,
       email=x.email,grade_level=x.grade_level,identifier=x.identifier
     FROM jsonb_to_recordset($1::jsonb) AS x(id uuid,learner_id text,given_name text,family_name text,email text,grade_level smallint,identifier text)
     WHERE p.id=x.id AND (p.learner_id,p.given_name,p.family_name,p.email,p.grade_level,p.identifier)
       IS DISTINCT FROM (x.learner_id,x.given_name,x.family_name,x.email,x.grade_level,x.identifier)`,
      [JSON.stringify(rows)],
    ),
  );
  await batches(
    writes.filter((p) => p.learner_id),
    (rows) =>
      db.query(
        `WITH desired AS (
       SELECT l.id,x.name,CASE WHEN x.birth_year IS NOT NULL AND l.label_number IS NULL
         AND NOT EXISTS(SELECT 1 FROM amp_attempts a WHERE a.learner_id=l.id) THEN x.birth_year ELSE l.birth_year END AS birth_year
       FROM amp_learners l JOIN jsonb_to_recordset($1::jsonb) AS x(learner_id text,name text,birth_year integer) ON l.id=x.learner_id
     ) UPDATE amp_learners l SET name=x.name,birth_year=x.birth_year,name_pending=false FROM desired x
     WHERE l.id=x.id AND (l.name,l.birth_year,l.name_pending) IS DISTINCT FROM (x.name,x.birth_year,false)`,
        [JSON.stringify(rows)],
      ),
  );
}

type MembershipWrite = {
  kind: "org_role" | "enrollment";
  source_key: string;
  scope_id: string;
  person_id: string;
  role: string;
  adopted: boolean;
};
async function prepareMemberships(
  db: PoolClient,
  connectionId: string,
  wanted: MembershipWrite[],
) {
  const previous = new Map(
    (
      await db.query(
        `SELECT kind,source_key,local_id,owned FROM amp_clever_memberships WHERE connection_id=$1`,
        [connectionId],
      )
    ).rows.map((r) => [`${r.kind}:${r.source_key}`, r]),
  );
  const groups = [];
  for (const [kind, table, column] of [
    ["org_role", "amp_org_roles", "org_id"],
    ["enrollment", "amp_enrollments", "class_id"],
  ] as const) {
    const plans = wanted.filter((m) => m.kind === kind);
    const current = new Map<string, { id: string }>();
    const find = async (rows: MembershipWrite[]) => {
      const found = await db.query(
        `SELECT r.id,r.${column} AS scope_id,r.person_id,r.role FROM ${table} r
        JOIN jsonb_to_recordset($1::jsonb) AS x(scope_id uuid,person_id uuid,role text)
        ON r.${column}=x.scope_id AND r.person_id=x.person_id AND r.role=x.role WHERE r.end_on IS NULL`,
        [JSON.stringify(rows)],
      );
      for (const row of found.rows)
        current.set(`${row.scope_id}:${row.person_id}:${row.role}`, row);
    };
    await batches(plans, find);
    const missing = plans.filter((p) => !current.has(p.source_key));
    groups.push({ kind, table, column, plans, current, find, missing });
  }
  return { previous, groups };
}
async function writeMemberships(
  db: PoolClient,
  connectionId: string,
  runId: string,
  today: string,
  prepared: Awaited<ReturnType<typeof prepareMemberships>>,
) {
  const { previous } = prepared;
  for (const {
    kind,
    table,
    column,
    plans,
    current,
    find,
    missing,
  } of prepared.groups) {
    const created = new Set<string>(),
      missingKeys = new Set(missing.map((p) => p.source_key));
    await batches(
      missing.map((p) => ({ ...p, id: randomUUID() })),
      async (rows) => {
        const inserted = await db.query(
          `INSERT INTO ${table}(id,${column},person_id,role,begin_on)
        SELECT x.id,x.scope_id,x.person_id,x.role,$2::date FROM jsonb_to_recordset($1::jsonb)
          AS x(id uuid,scope_id uuid,person_id uuid,role text)
        ON CONFLICT DO NOTHING RETURNING id,${column} AS scope_id,person_id,role`,
          [JSON.stringify(rows), today],
        );
        for (const row of inserted.rows) {
          current.set(`${row.scope_id}:${row.person_id}:${row.role}`, row);
          created.add(row.id);
        }
      },
    );
    // A concurrent manual enrollment can win the unique key. Read its actual ID
    // and leave ownership manual instead of claiming the other writer's grant.
    await batches(
      missing.filter((p) => !current.has(p.source_key)),
      find,
    );
    const mappings = plans.map((p) => {
      const row = current.get(p.source_key),
        prior = previous.get(`${kind}:${p.source_key}`);
      if (!row) throw new CleverSyncError("clever_membership_conflict");
      const wasMissing = missingKeys.has(p.source_key);
      return {
        source_key: p.source_key,
        local_id: row.id,
        owned:
          created.has(row.id) ||
          (!wasMissing &&
            ((prior?.owned === true && prior.local_id === row.id) ||
              p.adopted)),
      };
    });
    await batches(mappings, (rows) =>
      db.query(
        `INSERT INTO amp_clever_memberships(connection_id,kind,source_key,local_id,owned,last_seen_run_id)
      SELECT $2,$3,x.source_key,x.local_id,x.owned,$4 FROM jsonb_to_recordset($1::jsonb) AS x(source_key text,local_id uuid,owned boolean)
      ON CONFLICT(connection_id,kind,source_key) DO UPDATE SET local_id=excluded.local_id,owned=excluded.owned,
        last_seen_run_id=excluded.last_seen_run_id,bootstrap_valid_until=NULL`,
        [JSON.stringify(rows), connectionId, kind, runId],
      ),
    );
  }
}

export async function endMissingMemberships(
  db: PoolClient,
  connectionId: string,
  runId: string,
  today: string,
) {
  for (const [kind, table] of [
    ["org_role", "amp_org_roles"],
    ["enrollment", "amp_enrollments"],
  ]) {
    await db.query(
      `UPDATE ${table} r SET end_on=GREATEST(r.begin_on,$4::date)
      FROM amp_clever_memberships m WHERE m.connection_id=$1 AND m.kind=$2 AND m.owned
        AND m.last_seen_run_id<>$3 AND r.id=m.local_id AND (r.end_on IS NULL OR r.end_on>$4::date)`,
      [connectionId, kind, runId, today],
    );
  }
}

function termDates(term: Term): [string, string] | null {
  if (!term.start_date || !term.end_date) return null;
  const start = term.start_date.slice(0, 10),
    end = term.end_date.slice(0, 10);
  const valid = (d: string) =>
    Number.isFinite(Date.parse(d)) &&
    new Date(d).toISOString().slice(0, 10) === d;
  return valid(start) && valid(end) && end >= start ? [start, end] : null;
}
