import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  divisionKinds,
  splitYear,
  suggestedYear,
  yearName,
  type DivisionKind,
} from "./calendar.js";
import { SchoolError } from "./contracts.js";
import { recordEvent } from "./events.js";
import {
  rolloverSchema,
  type RolloverOptions,
  type RolloverResult,
} from "./org-contracts.js";
import { orgScope, schoolsBelow } from "./org-reads.js";
import { activeToday } from "./principal.js";
import type { SchoolRepository } from "./repository.js";
import { insertDivision } from "./setup.js";
import { syncSsoCredentials } from "./sso-credentials.js";
import { PERSON_NAME } from "./term-grades.js";
import { YEAR_IN_USE } from "./years.js";

type Database = Pick<PoolClient, "query">;
const DAY = 86_400_000;
const addDays = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY)
    .toISOString()
    .slice(0, 10);
const GRADUATES_SHOWN = 500;

/** The classes a rollover starts from: the year in use, at this org and below. */
const CURRENT_CLASSES = `amp_classes c JOIN amp_orgs o ON o.id=c.org_id
  JOIN amp_academic_sessions cs ON cs.id=c.session_id
  WHERE o.path @> ARRAY[$1]::uuid[] AND c.archived_at IS NULL AND ${YEAR_IN_USE}`;
/** SQL: an active student in this org or below, as `p`. */
const STUDENTS_HERE = `amp_people p
  JOIN amp_org_roles r ON r.person_id=p.id AND r.role='student'
  JOIN amp_orgs o ON o.id=r.org_id
  WHERE o.path @> ARRAY[$1]::uuid[] AND p.deleted_at IS NULL AND ${activeToday("r", "o")}`;

async function yearInUse(db: Database, orgId: string, path: string[]) {
  const fromClasses = (
    await db.query(
      `SELECT y.id,y.name,y.starts_on::text AS "startsOn",y.ends_on::text AS "endsOn"
       FROM ${CURRENT_CLASSES.replace("WHERE", "JOIN amp_academic_sessions y ON y.id=COALESCE(cs.parent_id,cs.id) WHERE")}
       ORDER BY y.starts_on DESC,y.id LIMIT 1`,
      [orgId],
    )
  ).rows[0];
  if (fromClasses) return fromClasses as Year;
  return ((
    await db.query(
      `SELECT id,name,starts_on::text AS "startsOn",ends_on::text AS "endsOn"
       FROM amp_academic_sessions WHERE org_id=ANY($1::uuid[]) AND kind='year'
       ORDER BY starts_on DESC,id LIMIT 1`,
      [path],
    )
  ).rows[0] ?? null) as Year | null;
}
type Year = { id: string; name: string; startsOn: string; endsOn: string };

/** What the wizard starts from: this year, the likely next one, every class to
 * carry over, and who is in each grade at each school. */
export async function rolloverOptions(
  pool: Pool,
  orgId: string,
): Promise<RolloverOptions> {
  const org = await orgScope(pool, orgId);
  const current = await yearInUse(pool, orgId, org.path);
  const division = current
    ? (((
        await pool.query(
          `SELECT kind FROM amp_academic_sessions WHERE parent_id=$1 ORDER BY starts_on,id LIMIT 1`,
          [current.id],
        )
      ).rows[0]?.kind as DivisionKind | undefined) ?? null)
    : null;
  const suggested = current
    ? (() => {
        // Whole weeks, so Monday stays Monday.
        let weeks = 52;
        while (addDays(current.startsOn, weeks * 7) <= current.endsOn) weeks++;
        return {
          startsOn: addDays(current.startsOn, weeks * 7),
          endsOn: addDays(current.endsOn, weeks * 7),
        };
      })()
    : suggestedYear(org.today);
  const [classes, grades, schools] = await Promise.all([
    pool.query(
      `SELECT c.id,c.name,o.name AS school,
         ARRAY(SELECT ${PERSON_NAME} FROM amp_enrollments e JOIN amp_people p ON p.id=e.person_id
           WHERE e.class_id=c.id AND e.role='teacher' AND p.deleted_at IS NULL AND ${activeToday("e", "o")}
           ORDER BY e.begin_on,p.id) AS teachers,
         (SELECT count(*)::int FROM amp_enrollments e JOIN amp_people p ON p.id=e.person_id
           WHERE e.class_id=c.id AND e.role='student' AND p.deleted_at IS NULL AND ${activeToday("e", "o")}) AS students
       FROM ${CURRENT_CLASSES} ORDER BY lower(o.name),lower(c.name),c.id`,
      [orgId],
    ),
    pool.query(
      `SELECT r.org_id AS org,p.grade_level AS grade,count(DISTINCT p.id)::int AS students
       FROM ${STUDENTS_HERE} AND p.grade_level IS NOT NULL
       GROUP BY r.org_id,p.grade_level ORDER BY r.org_id,p.grade_level`,
      [orgId],
    ),
    schoolsBelow(pool, orgId),
  ]);
  return {
    current: current
      ? {
          id: current.id,
          name: current.name,
          startsOn: current.startsOn,
          endsOn: current.endsOn,
        }
      : null,
    suggested: { ...suggested, division },
    classes: classes.rows,
    schools: schools.map((school) => {
      const here = grades.rows.filter((row) => row.org === school.id);
      return {
        ...school,
        grades: here.map(({ grade, students }) => ({ grade, students })),
        graduating: here.length ? here.at(-1)!.grade : null,
      };
    }),
  };
}

class DryRun extends Error {
  constructor(readonly result: RolloverResult) {
    super("dry run");
  }
}

/** One transaction, so nothing half-happens: the new year and its terms, copies
 * of the chosen classes with new join codes and the same teachers, students
 * moved up a grade, and graduating students ended. A dry run does exactly this
 * and rolls it back, so what it reports is what will happen. Confirming the same
 * year again changes nothing.
 *
 * Last year's classes aren't archived: they keep their URLs, grades and teachers
 * (a teacher's enrollment stays open, so they can read what they taught), and
 * the year switcher on the class list reaches them. */
export async function runRollover(
  repo: SchoolRepository,
  orgId: string,
  raw: unknown,
  actorPersonId: string | null,
  { dryRun }: { dryRun: boolean },
): Promise<RolloverResult> {
  const input = rolloverSchema.parse(raw);
  try {
    return await repo.transaction(async (client) => {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
        [`school-calendar:${orgId}`],
      );
      const scope = await orgScope(client, orgId);
      const { today, path } = scope;
      const same = (
        await client.query(
          `SELECT id,name FROM amp_academic_sessions
           WHERE org_id=$1 AND kind='year' AND starts_on=$2 AND ends_on=$3 ORDER BY id LIMIT 1`,
          [orgId, input.startsOn, input.endsOn],
        )
      ).rows[0] as { id: string; name: string } | undefined;
      if (same) {
        const done = (
          await client.query(
            `SELECT detail FROM amp_school_events WHERE org_id=$1 AND action='year.rolled-over' AND target_id=$2
             ORDER BY "at" DESC LIMIT 1`,
            [orgId, same.id],
          )
        ).rows[0]?.detail?.after;
        if (done)
          return {
            applied: !dryRun,
            alreadyDone: true,
            year: {
              id: same.id,
              name: same.name,
              startsOn: input.startsOn,
              endsOn: input.endsOn,
            },
            terms: await termsOf(client, same.id),
            classes: done.classes,
            teachers: done.teachers,
            moved: done.moved,
            advanced: done.advanced,
            advancing: done.advancing,
            graduated: done.graduated,
            graduates: [],
            yearRunning: false,
            openClasses: 0,
          };
      }
      const overlaps = await client.query(
        `SELECT 1 FROM amp_academic_sessions WHERE org_id=ANY($1::uuid[]) AND kind='year'
           AND starts_on<=$3::date AND ends_on>=$2::date AND id IS DISTINCT FROM $4::uuid LIMIT 1`,
        [path, input.startsOn, input.endsOn, same?.id ?? null],
      );
      if (overlaps.rowCount) throw new SchoolError(409, "year_overlaps");
      const current = await yearInUse(client, orgId, path);
      const name = yearName(input.startsOn, input.endsOn);
      const yearId = same?.id ?? randomUUID();
      if (!same)
        await client.query(
          "INSERT INTO amp_academic_sessions(id,org_id,kind,name,starts_on,ends_on) VALUES($1,$2,'year',$3,$4,$5)",
          [yearId, orgId, name, input.startsOn, input.endsOn],
        );
      const year = {
        id: yearId,
        starts_on: input.startsOn,
        ends_on: input.endsOn,
      };
      if (input.division)
        await insertDivision(client, orgId, year, input.division);

      const inUse = (
        await client.query(
          `SELECT c.id,c.org_id,c.name,c.course_bands,c.grading_kind FROM ${CURRENT_CLASSES}
           ORDER BY lower(c.name),c.id`,
          [orgId],
        )
      ).rows as {
        id: string;
        org_id: string;
        name: string;
        course_bands: string[];
        grading_kind: string;
      }[];
      const chosen = new Set(input.classIds);
      const carried = inUse.filter((row) => chosen.has(row.id));
      // Each grading period a carried class uses exists in the new year.
      for (const kind of new Set(carried.map((row) => row.grading_kind)))
        if ((divisionKinds as readonly string[]).includes(kind))
          await insertDivision(client, orgId, year, kind as DivisionKind);

      // Who leaves: the school's chosen grade and any above it.
      const schoolIds = Object.keys(input.graduating).filter(
        (id) => input.graduating[id] !== null,
      );
      const graduates = (
        await client.query(
          `SELECT p.id,${PERSON_NAME} AS name,p.grade_level AS grade,o.name AS school,o.id AS org
           FROM ${STUDENTS_HERE}
             AND o.id=ANY($2::uuid[]) AND p.grade_level IS NOT NULL
             AND p.grade_level>=($3::jsonb->>o.id::text)::int
           ORDER BY lower(o.name),lower(${PERSON_NAME}),p.id`,
          [orgId, schoolIds, JSON.stringify(input.graduating)],
        )
      ).rows as {
        id: string;
        name: string;
        grade: number;
        school: string;
        org: string;
      }[];
      const graduateIds = graduates.map((row) => row.id);

      const pairs: { from: string; to: string }[] = [];
      for (const row of carried) {
        const made = await repo.createClassIn(
          client,
          row.org_id,
          {
            name: row.name,
            courseBands: row.course_bands,
            gradingKind: row.grading_kind as never,
            sessionId: yearId,
          },
          actorPersonId,
        );
        pairs.push({ from: row.id, to: made.id });
      }
      const fromIds = pairs.map((pair) => pair.from);
      const toIds = pairs.map((pair) => pair.to);
      await client.query(
        `UPDATE amp_classes c SET rolled_from=m.from_id FROM unnest($1::uuid[],$2::uuid[]) AS m(from_id,to_id)
         WHERE c.id=m.to_id`,
        [fromIds, toIds],
      );
      await client.query(
        `INSERT INTO amp_scope_settings(scope_kind,scope_id,"values",locked)
         SELECT 'class',m.to_id,s."values",s.locked FROM amp_scope_settings s
         JOIN unnest($1::uuid[],$2::uuid[]) AS m(from_id,to_id) ON s.scope_kind='class' AND s.scope_id=m.from_id`,
        [fromIds, toIds],
      );
      // A teacher can get next year's class ready before it begins.
      const teachers = await client.query(
        `INSERT INTO amp_enrollments(id,class_id,person_id,role,begin_on)
         SELECT gen_random_uuid(),m.to_id,e.person_id,e.role,$3::date
         FROM unnest($1::uuid[],$2::uuid[]) AS m(from_id,to_id)
         JOIN amp_enrollments e ON e.class_id=m.from_id AND e.role<>'student' AND e.end_on IS NULL
         JOIN amp_people p ON p.id=e.person_id AND p.deleted_at IS NULL
         RETURNING person_id`,
        [fromIds, toIds, today],
      );
      const boundary = input.startsOn > today ? input.startsOn : today;
      const moved = input.keepStudents
        ? await client.query(
            `INSERT INTO amp_enrollments(id,class_id,person_id,role,begin_on)
             SELECT gen_random_uuid(),m.to_id,e.person_id,'student',$3::date
             FROM unnest($1::uuid[],$2::uuid[]) AS m(from_id,to_id)
             JOIN amp_enrollments e ON e.class_id=m.from_id AND e.role='student' AND e.end_on IS NULL
             JOIN amp_people p ON p.id=e.person_id AND p.deleted_at IS NULL
             WHERE NOT (e.person_id=ANY($4::uuid[]))`,
            [fromIds, toIds, boundary, graduateIds],
          )
        : { rowCount: 0 };
      await client.query(
        `UPDATE amp_enrollments SET end_on=GREATEST(begin_on,$2::date)
         WHERE class_id=ANY($1::uuid[]) AND role='student' AND end_on IS NULL`,
        [inUse.map((row) => row.id), boundary],
      );
      if (graduateIds.length) {
        await client.query(
          `UPDATE amp_org_roles SET end_on=GREATEST(begin_on,$2::date)
           WHERE person_id=ANY($1::uuid[]) AND role='student' AND end_on IS NULL`,
          [graduateIds, today],
        );
        await client.query(
          `UPDATE amp_enrollments SET end_on=GREATEST(begin_on,$2::date)
           WHERE person_id=ANY($1::uuid[]) AND role='student' AND (end_on IS NULL OR end_on>$2::date)`,
          [graduateIds, today],
        );
        await client.query(
          `UPDATE amp_grants g SET status='revoked' FROM amp_seats s
           WHERE s.person_id=ANY($1::uuid[]) AND s.released_at IS NULL AND g.id=s.grant_id`,
          [graduateIds],
        );
        await client.query(
          "UPDATE amp_seats SET released_at=now() WHERE person_id=ANY($1::uuid[]) AND released_at IS NULL",
          [graduateIds],
        );
        await client.query(
          "UPDATE amp_student_sessions SET revoked_at=now() WHERE person_id=ANY($1::uuid[]) AND revoked_at IS NULL",
          [graduateIds],
        );
        for (const graduate of graduates)
          await recordEvent(client, {
            orgId: graduate.org,
            actorPersonId,
            action: "student.graduated",
            targetKind: "person",
            targetId: graduate.id,
            detail: { after: { gradeLevel: graduate.grade } },
          });
      }
      const advanced = (
        await client.query(
          `WITH here AS (SELECT DISTINCT p.id,p.grade_level FROM ${STUDENTS_HERE}
             AND p.grade_level IS NOT NULL AND NOT (p.id=ANY($2::uuid[])))
           , moved AS (
             UPDATE amp_people p SET grade_level=LEAST(p.grade_level+1,13) FROM here
             WHERE p.id=here.id RETURNING here.grade_level AS grade_from,p.grade_level AS grade_to
           )
           SELECT grade_from AS "from",grade_to AS "to",count(*)::int AS students FROM moved
           GROUP BY grade_from,grade_to ORDER BY grade_from`,
          [orgId, graduateIds],
        )
      ).rows as { from: number; to: number; students: number }[];
      await syncSsoCredentials(client, path[0]!);
      const openClasses = (
        await client.query(
          `SELECT count(*)::int AS open FROM unnest($1::uuid[]) AS c(id)
           WHERE EXISTS(SELECT 1 FROM amp_enrollments e WHERE e.class_id=c.id AND e.role='student')
             AND NOT EXISTS(SELECT 1 FROM amp_term_grades g WHERE g.class_id=c.id AND g.frozen_at IS NOT NULL)`,
          [inUse.map((row) => row.id)],
        )
      ).rows[0].open as number;
      const summary = {
        classes: carried.length,
        teachers: new Set(teachers.rows.map((row) => row.person_id)).size,
        moved: moved.rowCount ?? 0,
        advanced: advanced.reduce((sum, row) => sum + row.students, 0),
        advancing: advanced,
        graduated: graduates.length,
      };
      await recordEvent(client, {
        orgId,
        actorPersonId,
        action: "year.rolled-over",
        targetKind: "session",
        targetId: yearId,
        detail: {
          before: { yearId: current?.id ?? null },
          after: {
            ...summary,
            startsOn: input.startsOn,
            endsOn: input.endsOn,
            keepStudents: input.keepStudents,
          },
        },
      });
      const result: RolloverResult = {
        applied: !dryRun,
        alreadyDone: false,
        year: {
          id: yearId,
          name,
          startsOn: input.startsOn,
          endsOn: input.endsOn,
        },
        terms: input.division
          ? splitYear(input.startsOn, input.endsOn, input.division)
          : [],
        ...summary,
        graduates: graduates
          .slice(0, GRADUATES_SHOWN)
          .map(({ id, name: student, grade, school }) => ({
            id,
            name: student,
            grade,
            school,
          })),
        yearRunning: !!current && current.endsOn >= today,
        openClasses,
      };
      if (dryRun) throw new DryRun(result);
      return result;
    });
  } catch (error) {
    if (error instanceof DryRun) return error.result;
    throw error;
  }
}

async function termsOf(db: Database, yearId: string) {
  return (
    await db.query(
      `SELECT name,starts_on::text AS "startsOn",ends_on::text AS "endsOn" FROM amp_academic_sessions
       WHERE parent_id=$1 ORDER BY starts_on,id`,
      [yearId],
    )
  ).rows as { name: string; startsOn: string; endsOn: string }[];
}
