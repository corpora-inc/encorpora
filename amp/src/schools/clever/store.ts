import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import {
  birthYearForGrade,
  generateHandle,
  generateJoinCode,
} from "../repository.js";
import { schoolAccountId } from "../principal.js";
import { writeStudent } from "../roster.js";
import { lockLearningAccount } from "../../server/account-access.js";
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
  const reviewedPeople = new Map<string, string>(
    (
      await db.query(
        `SELECT sourced_id,local_id
    FROM amp_external_refs WHERE tenant_id=$1 AND source=$2 AND kind='person'`,
        [root.id, cleverSource(connection.id)],
      )
    ).rows.map((row) => [row.sourced_id, row.local_id]),
  );
  const save = async (
    kind: Kind,
    record: RosterRecord,
    id: string | null,
    metadata: Record<string, unknown> = {},
  ) => {
    await db.query(
      `INSERT INTO amp_clever_bindings(connection_id,kind,clever_id,local_id,record,metadata,last_seen_run_id)
      VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(connection_id,kind,clever_id) DO UPDATE SET
      local_id=EXCLUDED.local_id,record=EXCLUDED.record,metadata=EXCLUDED.metadata,
      archived_at=NULL,last_seen_run_id=EXCLUDED.last_seen_run_id`,
      [
        connection.id,
        kind,
        record.id,
        id,
        JSON.stringify(record),
        JSON.stringify(metadata),
        runId,
      ],
    );
    bindings.set(key(kind, record.id), {
      local_id: id,
      record,
      metadata,
      archived_at: null,
    });
  };
  await save("district", snapshot.district, root.id);
  // The root is named by the institution during onboarding. Preserve that name.
  for (const school of snapshot.schools) {
    let id = local("school", school.id);
    if (!id) {
      id = randomUUID();
      await db.query(
        `INSERT INTO amp_orgs(id,kind,parent_id,path,name,timezone)
        VALUES($1,'school',$2,$3,$4,$5)`,
        [
          id,
          root.id,
          [...root.path, id],
          text(school.name, "School", 200),
          root.timezone,
        ],
      );
    } else {
      await db.query("UPDATE amp_orgs SET name=$2 WHERE id=$1", [
        id,
        text(school.name, "School", 200),
      ]);
    }
    await save("school", school, id);
  }
  for (const course of snapshot.courses) {
    const id = local("course", course.id) ?? randomUUID();
    await db.query(
      `INSERT INTO amp_courses(id,org_id,name,number) VALUES($1,$2,$3,$4)
      ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,number=EXCLUDED.number,archived_at=NULL`,
      [id, root.id, course.name ?? null, course.number ?? null],
    );
    await save("course", course, id);
  }
  // Terms with no usable dates are preserved as source records without inventing
  // dates. AMP classes then use an explicitly synthetic local calendar.
  for (const term of snapshot.terms) {
    const dates = termDates(term);
    let id = local("term", term.id) ?? null;
    if (dates) {
      id ??= randomUUID();
      await db.query(
        `INSERT INTO amp_academic_sessions(id,org_id,kind,name,starts_on,ends_on)
        VALUES($1,$2,'custom',$3,$4,$5) ON CONFLICT(id) DO UPDATE SET
        name=EXCLUDED.name,starts_on=EXCLUDED.starts_on,ends_on=EXCLUDED.ends_on`,
        [id, root.id, text(term.name, "Term"), dates[0], dates[1]],
      );
    }
    await save("term", term, id, { datesAvailable: !!dates });
  }
  const orderedUsers = [...snapshot.users].sort((a, b) =>
    (local("user", a.id) ?? reviewedPeople.get(a.id) ?? a.id).localeCompare(
      local("user", b.id) ?? reviewedPeople.get(b.id) ?? b.id,
    ),
  );
  for (const user of orderedUsers) {
    const roles = userRoles(user);
    let id = local("user", user.id) ?? reviewedPeople.get(user.id) ?? null;
    if (!roles.some((role) => role !== "contact")) {
      // Preserve source identity for delta processing, without guardian data.
      await save("user", user, id, { roles });
      continue;
    }
    const first = text(user.name.first, "User");
    const last = optional(user.name.last);
    const grade = gradeLevel(user.roles.student?.grade);
    if (!id) {
      id = randomUUID();
      await db.query(
        `INSERT INTO amp_people(id,tenant_id,given_name,family_name,handle,email,grade_level,timezone)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          id,
          root.id,
          first,
          last,
          generateHandle(),
          optional(user.email, 320),
          grade,
          root.timezone,
        ],
      );
    }
    // Follow privacy/learning lock order: account before person, not vice versa.
    const owner = (
      await db.query(
        `SELECT l.account_id FROM amp_people p
      JOIN amp_learners l ON l.id=p.learner_id WHERE p.id=$1`,
        [id],
      )
    ).rows[0]?.account_id;
    if (owner) await lockLearningAccount(db, owner);
    const person = (
      await db.query(
        "SELECT learner_id,deleted_at FROM amp_people WHERE id=$1 AND tenant_id=$2 FOR UPDATE",
        [id, root.id],
      )
    ).rows[0];
    if (!person || person.deleted_at)
      throw new CleverSyncError("clever_deleted_person_requires_review");
    if (user.roles.student && !person.learner_id) {
      const learnerId = randomUUID();
      await db.query(
        `INSERT INTO amp_learners(id,account_id,name,birth_year)
        VALUES($1,$2,$3,$4)`,
        [
          learnerId,
          schoolAccountId(id),
          [first, last].filter(Boolean).join(" "),
          grade === null ? null : birthYearForGrade(grade, now),
        ],
      );
      await db.query("UPDATE amp_people SET learner_id=$2 WHERE id=$1", [
        id,
        learnerId,
      ]);
    }
    await writeStudent(db, id, {
      givenName: first,
      familyName: last,
      email: optional(user.email, 320),
      gradeLevel: grade,
      identifier:
        user.roles.student?.student_number ??
        user.roles.student?.sis_id ??
        user.roles.teacher?.teacher_number ??
        user.roles.teacher?.sis_id ??
        user.roles.staff?.staff_id ??
        null,
    });
    await save("user", user, id, { roles });
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
  for (const section of snapshot.sections) {
    const prior = lookup("section", section.id);
    let id = prior?.local_id;
    const term =
      section.term_id && snapshot.terms.some((t) => t.id === section.term_id)
        ? lookup("term", section.term_id)
        : undefined;
    const hasDates = term?.metadata.datesAvailable === true;
    const sessionId =
      hasDates && term?.local_id ? term.local_id : await fallback();
    const orgId = local("school", section.school)!;
    const courseId =
      section.course && snapshot.courses.some((c) => c.id === section.course)
        ? (local("course", section.course) ?? null)
        : null;
    if (!id) {
      id = randomUUID();
      await db.query(
        `INSERT INTO amp_classes(id,org_id,session_id,name,grading_kind,join_code,course_id)
        VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [
          id,
          orgId,
          sessionId,
          text(section.name, "Class"),
          hasDates ? "custom" : "year",
          generateJoinCode(),
          courseId,
        ],
      );
    } else {
      const oldName = text((prior?.record as { name?: string }).name, "Class");
      await db.query(
        `UPDATE amp_classes SET org_id=$2,session_id=$3,
        name=CASE WHEN name=$4 THEN $5 ELSE name END,course_id=$6,
        archived_at=CASE WHEN $7::boolean THEN NULL ELSE archived_at END WHERE id=$1`,
        [
          id,
          orgId,
          sessionId,
          oldName,
          text(section.name, "Class"),
          courseId,
          !!prior?.archived_at,
        ],
      );
    }
    await save("section", section, id, { syntheticCalendar: !hasDates });
  }

  const wanted = new Set<string>();
  const membership = async (
    kind: "org_role" | "enrollment",
    scope: string,
    person: string,
    role: string,
  ) => {
    const sourceKey = `${scope}:${person}:${role}`;
    if (wanted.has(`${kind}:${sourceKey}`)) return;
    wanted.add(`${kind}:${sourceKey}`);
    const table = kind === "org_role" ? "amp_org_roles" : "amp_enrollments";
    const column = kind === "org_role" ? "org_id" : "class_id";
    const prior = (
      await db.query(
        `SELECT local_id,owned FROM amp_clever_memberships
      WHERE connection_id=$1 AND kind=$2 AND source_key=$3`,
        [connection.id, kind, sourceKey],
      )
    ).rows[0];
    let row = (
      await db.query(
        `SELECT id FROM ${table} WHERE ${column}=$1 AND person_id=$2
      AND role=$3 AND end_on IS NULL`,
        [scope, person, role],
      )
    ).rows[0];
    let owned = prior?.owned === true && prior.local_id === row?.id;
    if (!row) {
      const id = randomUUID();
      row = (
        await db.query(
          `INSERT INTO ${table}(id,${column},person_id,role,begin_on)
        VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING id`,
          [id, scope, person, role, today],
        )
      ).rows[0];
      owned = !!row;
      if (!row)
        row = (
          await db.query(
            `SELECT id FROM ${table} WHERE ${column}=$1 AND person_id=$2 AND role=$3 AND end_on IS NULL`,
            [scope, person, role],
          )
        ).rows[0];
    }
    if (!row) throw new CleverSyncError("clever_membership_conflict");
    await db.query(
      `INSERT INTO amp_clever_memberships(connection_id,kind,source_key,local_id,owned,last_seen_run_id)
      VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(connection_id,kind,source_key) DO UPDATE SET
      local_id=EXCLUDED.local_id,owned=EXCLUDED.owned,last_seen_run_id=EXCLUDED.last_seen_run_id`,
      [connection.id, kind, sourceKey, row.id, owned, runId],
    );
  };
  const schoolRoles = async (
    user: User,
    role: "student" | "teacher" | "staff",
  ) => {
    const profile = user.roles[role];
    if (!profile) return;
    for (const sourceId of new Set([
      ...(profile.schools ?? []),
      ...(profile.school ? [profile.school] : []),
    ])) {
      const orgId = local("school", sourceId);
      if (snapshot.schools.some((s) => s.id === sourceId) && orgId)
        await membership(
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
      await membership("org_role", root.id, local("user", user.id)!, "admin");
    await schoolRoles(user, "student");
    await schoolRoles(user, "teacher");
    await schoolRoles(user, "staff");
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
        await membership("org_role", orgId, personId, role);
        await membership("enrollment", classId, personId, role);
      }
    }
  }
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
