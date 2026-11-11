import { Readable } from "node:stream";
import { strToU8, Zip, ZipDeflate } from "fflate";
import type { Pool, PoolClient } from "pg";
import { SchoolError } from "./contracts.js";
import { csvCell } from "./exports.js";
import { recordEvent } from "./events.js";
import { eraseSchema, type PrivacyResponse } from "./org-contracts.js";
import { schoolsBelow } from "./org-reads.js";
import { activeToday } from "./principal.js";
import type { SchoolRepository } from "./repository.js";
import { removeStudent } from "./roster.js";

type Database = Pick<PoolClient, "query">;
/** Rows in one trip to the database, so an export's memory never grows with the
 * school. */
export const EXPORT_BATCH = 1000;
const PEOPLE_BATCH = 50;
/** Students removed per request: quick enough that progress keeps moving. */
export const ERASE_BATCH = 20;
const STARTED = "privacy.erase-started";
const FINISHED = "privacy.erase-finished";

/** SQL: `p` was ever a student at this org or below ($1), in its tenant ($2). */
const EVER_HERE = `EXISTS(SELECT 1 FROM amp_org_roles er JOIN amp_orgs eo ON eo.id=er.org_id
  WHERE er.person_id=p.id AND er.role='student' AND eo.path @> ARRAY[$1]::uuid[])`;
/** A student whose data a whole-school deletion still has to reach. Someone who
 * moved to another school in the district is that school's now. A tombstone
 * counts while it holds an SIS ID or a grade. */
const STILL_HERE = `p.tenant_id=$2 AND ${EVER_HERE}
  AND NOT EXISTS(SELECT 1 FROM amp_org_roles ar JOIN amp_orgs ao ON ao.id=ar.org_id
    WHERE ar.person_id=p.id AND ar.role='student' AND NOT (ao.path @> ARRAY[$1]::uuid[]) AND ${activeToday("ar", "ao")})
  AND (p.deleted_at IS NULL OR p.identifier IS NOT NULL OR EXISTS(SELECT 1 FROM amp_term_grades g WHERE g.person_id=p.id))`;

const remainingOf = async (db: Database, orgId: string, tenantId: string) =>
  (
    await db.query(
      `SELECT count(*)::int AS remaining FROM amp_people p WHERE ${STILL_HERE}`,
      [orgId, tenantId],
    )
  ).rows[0].remaining as number;

/** A deletion that started and hasn't finished, from the log: there's no job. */
async function eraseUnderway(db: Database, orgId: string) {
  const last = (
    await db.query(
      `SELECT action,"at" FROM amp_school_events WHERE org_id=$1 AND action=ANY($2::text[])
       ORDER BY "at" DESC,id DESC LIMIT 1`,
      [orgId, [STARTED, FINISHED]],
    )
  ).rows[0];
  return last?.action === STARTED ? (last.at as Date) : null;
}

export async function readPrivacy(
  pool: Pool,
  org: { orgId: string; path: string[] },
): Promise<PrivacyResponse> {
  const [agreement, students, schools, underway] = await Promise.all([
    pool.query(
      `SELECT a.version,a.signer_name AS "signerName",a.signer_title AS "signerTitle",a.accepted_at AS "acceptedAt",
         a.ended_at AS "endedAt",a.org_id AS "orgId",o.name AS "orgName"
       FROM amp_data_agreements a JOIN amp_orgs o ON o.id=a.org_id WHERE a.org_id=ANY($1::uuid[])
       ORDER BY array_position($1::uuid[],a.org_id) DESC,a.accepted_at DESC,a.id LIMIT 1`,
      [org.path],
    ),
    pool.query(
      `SELECT count(DISTINCT p.id)::int AS students FROM amp_people p
       JOIN amp_org_roles r ON r.person_id=p.id AND r.role='student' JOIN amp_orgs o ON o.id=r.org_id
       WHERE o.path @> ARRAY[$1]::uuid[] AND p.deleted_at IS NULL AND ${activeToday("r", "o")}`,
      [org.orgId],
    ),
    schoolsBelow(pool, org.orgId),
    eraseUnderway(pool, org.orgId),
  ]);
  const signed = agreement.rows[0];
  return {
    agreement:
      signed && !signed.endedAt
        ? {
            version: signed.version,
            signerName: signed.signerName,
            signerTitle: signed.signerTitle,
            acceptedAt: signed.acceptedAt.toISOString(),
            signedBy: signed.orgId === org.orgId ? null : signed.orgName,
          }
        : null,
    students: students.rows[0].students,
    schools: schools.filter((school) => school.id !== org.orgId),
    erasing: underway
      ? {
          startedAt: underway.toISOString(),
          remaining: await remainingOf(pool, org.orgId, org.path[0]!),
        }
      : null,
  };
}

/** The next few students' data, gone for good. Each student is their own
 * transaction through the path removal already takes, so a failure leaves the
 * rest of the school exactly as it was and the next request carries on from
 * there. This is the full erasure a school asks for: final grades and the SIS ID
 * go too, leaving only a tombstone with no one's name on it. */
export async function eraseBatch(
  repo: SchoolRepository,
  org: { orgId: string; path: string[] },
  raw: unknown,
  actorPersonId: string | null,
) {
  const { confirm } = eraseSchema.parse(raw);
  const school = (
    await repo.pool.query("SELECT name,kind FROM amp_orgs WHERE id=$1", [
      org.orgId,
    ])
  ).rows[0];
  if (school?.kind !== "school") throw new SchoolError(404, "not_found");
  if (confirm.toLowerCase() !== school.name.trim().toLowerCase())
    throw new SchoolError(409, "confirm_mismatch");
  const tenant = org.path[0]!;
  if (!(await eraseUnderway(repo.pool, org.orgId)))
    await repo.transaction((client) =>
      recordEvent(client, {
        orgId: org.orgId,
        actorPersonId,
        action: STARTED,
        targetKind: "org",
        targetId: org.orgId,
      }),
    );
  const { rows } = await repo.pool.query(
    `SELECT p.id,p.deleted_at FROM amp_people p WHERE ${STILL_HERE} ORDER BY p.id LIMIT ${ERASE_BATCH}`,
    [org.orgId, tenant],
  );
  for (const { id, deleted_at: deletedAt } of rows) {
    if (!deletedAt) await removeStudent(repo, org.orgId, id, actorPersonId);
    await repo.transaction(async (client) => {
      await client.query("DELETE FROM amp_term_grades WHERE person_id=$1", [
        id,
      ]);
      await client.query(
        "DELETE FROM amp_external_refs WHERE tenant_id=$2 AND local_id=$1",
        [id, tenant],
      );
      await client.query(
        "DELETE FROM amp_person_credentials WHERE person_id=$1",
        [id],
      );
      await client.query(
        "DELETE FROM amp_student_sessions WHERE person_id=$1",
        [id],
      );
      await client.query(
        "UPDATE amp_people SET identifier=NULL,grade_level=NULL WHERE id=$1",
        [id],
      );
    });
  }
  const remaining = await remainingOf(repo.pool, org.orgId, tenant);
  if (remaining === 0)
    await repo.transaction((client) =>
      recordEvent(client, {
        orgId: org.orgId,
        actorPersonId,
        action: FINISHED,
        targetKind: "org",
        targetId: org.orgId,
        detail: { after: { removed: rows.length } },
      }),
    );
  return { removed: rows.length, remaining };
}

type Row = (string | number | null)[];
type Table = {
  name: string;
  header: readonly string[];
  /** Batches, each a bounded trip to the database. */
  rows: () => AsyncGenerator<Row[]>;
};
const csvLine = (cells: readonly (string | number | null)[]) =>
  `${cells.map(csvCell).join(",")}\r\n`;

async function* byKeyset<T>(
  fetch: (last: T | null) => Promise<T[]>,
  size = EXPORT_BATCH,
): AsyncGenerator<T[]> {
  let last: T | null = null;
  for (;;) {
    const rows = await fetch(last);
    if (rows.length) yield rows;
    if (rows.length < size) return;
    last = rows.at(-1)!;
  }
}

/** Every student's person and learner, a page at a time: what the day tables
 * walk through without holding the whole school. */
function peopleOf(pool: Pool, org: { orgId: string; path: string[] }) {
  return byKeyset<{ id: string; learner: string; until: string | null }>(
    async (last) =>
      (
        await pool.query(
          `SELECT p.id,p.learner_id AS learner,
             CASE WHEN EXISTS(SELECT 1 FROM amp_org_roles ar JOIN amp_orgs ao ON ao.id=ar.org_id
                 WHERE ar.person_id=p.id AND ar.role='student' AND ao.path @> ARRAY[$1]::uuid[] AND ${activeToday("ar", "ao")})
               THEN NULL
               ELSE (SELECT max(er.end_on)::text FROM amp_org_roles er JOIN amp_orgs eo ON eo.id=er.org_id
                 WHERE er.person_id=p.id AND er.role='student' AND eo.path @> ARRAY[$1]::uuid[])
             END AS until
           FROM amp_people p
           WHERE p.tenant_id=$2 AND p.deleted_at IS NULL AND p.learner_id IS NOT NULL AND ${EVER_HERE}
             AND ($3::uuid IS NULL OR p.id>$3::uuid)
           ORDER BY p.id LIMIT ${PEOPLE_BATCH}`,
          [org.orgId, org.path[0], last?.id ?? null],
        )
      ).rows,
    PEOPLE_BATCH,
  );
}

function exportTables(
  pool: Pool,
  org: { orgId: string; path: string[] },
): Table[] {
  const args = [org.orgId, org.path[0]];
  return [
    {
      name: "roster.csv",
      header: [
        "person_id",
        "student_id",
        "given_name",
        "family_name",
        "display_name",
        "email",
        "grade_level",
        "school",
        "status",
      ],
      rows: () =>
        (async function* () {
          for await (const rows of byKeyset<
            Record<string, string | number | boolean | null>
          >(
            async (last) =>
              (
                await pool.query(
                  `SELECT p.id,p.identifier,p.given_name,p.family_name,p.display_name,p.email,p.grade_level,
                     (SELECT o.name FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id
                       WHERE r.person_id=p.id AND r.role='student' AND o.path @> ARRAY[$1]::uuid[]
                       ORDER BY r.begin_on DESC,o.id LIMIT 1) AS school,
                     EXISTS(SELECT 1 FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id
                       WHERE r.person_id=p.id AND r.role='student' AND o.path @> ARRAY[$1]::uuid[] AND ${activeToday("r", "o")}) AS active
                   FROM amp_people p
                   WHERE p.tenant_id=$2 AND p.deleted_at IS NULL AND ${EVER_HERE} AND ($3::uuid IS NULL OR p.id>$3::uuid)
                   ORDER BY p.id LIMIT ${EXPORT_BATCH}`,
                  [...args, (last?.id as string | undefined) ?? null],
                )
              ).rows,
          ))
            yield rows.map((row) => [
              row.id as string,
              row.identifier as string | null,
              row.given_name as string,
              row.family_name as string | null,
              row.display_name as string | null,
              row.email as string | null,
              row.grade_level as number | null,
              row.school as string | null,
              row.active ? "active" : "left",
            ]);
        })(),
    },
    {
      name: "enrollments.csv",
      header: [
        "person_id",
        "class_id",
        "class",
        "school",
        "year",
        "begin_on",
        "end_on",
      ],
      rows: () =>
        (async function* () {
          for await (const rows of byKeyset<{
            id: string;
            person: string;
            class: string;
            name: string;
            school: string;
            year: string;
            begin: string;
            end: string | null;
          }>(
            async (last) =>
              (
                await pool.query(
                  `SELECT e.id,e.person_id AS person,e.class_id AS class,c.name,o.name AS school,cs.name AS year,
                     e.begin_on::text AS begin,e.end_on::text AS end
                   FROM amp_enrollments e JOIN amp_classes c ON c.id=e.class_id JOIN amp_orgs o ON o.id=c.org_id
                   JOIN amp_academic_sessions cs ON cs.id=c.session_id JOIN amp_people p ON p.id=e.person_id
                   WHERE o.path @> ARRAY[$1]::uuid[] AND e.role='student' AND p.deleted_at IS NULL
                     AND ($2::uuid IS NULL OR e.id>$2::uuid)
                   ORDER BY e.id LIMIT ${EXPORT_BATCH}`,
                  [org.orgId, last?.id ?? null],
                )
              ).rows,
          ))
            yield rows.map((row) => [
              row.person,
              row.class,
              row.name,
              row.school,
              row.year,
              row.begin,
              row.end,
            ]);
        })(),
    },
    {
      name: "grades.csv",
      header: [
        "person_id",
        "class_id",
        "class",
        "term",
        "final_grade",
        "final_at",
        "suggested_low",
        "suggested_high",
        "closed_at",
      ],
      rows: () =>
        (async function* () {
          for await (const rows of byKeyset<{
            class: string;
            session: string;
            person: string;
            name: string;
            term: string;
            final: string | null;
            final_at: string | null;
            low: number | null;
            high: number | null;
            closed: string | null;
          }>(
            async (last) =>
              (
                await pool.query(
                  `SELECT g.class_id AS class,g.session_id AS session,g.person_id AS person,c.name,s.name AS term,
                     g.final_value AS final,g.final_at::text AS final_at,(g.suggested->>'low')::float8 AS low,
                     (g.suggested->>'high')::float8 AS high,g.frozen_at::text AS closed
                   FROM amp_term_grades g JOIN amp_classes c ON c.id=g.class_id JOIN amp_orgs o ON o.id=c.org_id
                   JOIN amp_academic_sessions s ON s.id=g.session_id
                   WHERE o.path @> ARRAY[$1]::uuid[]
                     AND ($2::uuid IS NULL OR (g.class_id,g.session_id,g.person_id)>($2::uuid,$3::uuid,$4::uuid))
                   ORDER BY g.class_id,g.session_id,g.person_id LIMIT ${EXPORT_BATCH}`,
                  [
                    org.orgId,
                    last?.class ?? null,
                    last?.session ?? null,
                    last?.person ?? null,
                  ],
                )
              ).rows,
          ))
            yield rows.map((row) => [
              row.person,
              row.class,
              row.name,
              row.term,
              row.final,
              row.final_at,
              row.low,
              row.high,
              row.closed,
            ]);
        })(),
    },
    dayTable(pool, org, {
      name: "skill_days.csv",
      header: [
        "person_id",
        "day",
        "skill_id",
        "attempts",
        "correct",
        "independent",
        "assisted",
        "review",
        "review_independent",
      ],
      from: "amp_skill_days",
      columns:
        "skill_id,attempts,correct,independent,assisted,review,review_independent",
      key: "skill_id",
    }),
    dayTable(pool, org, {
      name: "active_days.csv",
      header: ["person_id", "day", "surface", "skill_id", "active_ms"],
      from: "amp_active_days",
      columns: "surface,skill_id,active_ms",
      key: "surface||'/'||skill_id",
    }),
    dayTable(pool, org, {
      name: "help_days.csv",
      header: ["person_id", "day", "kind", "skill_id", "opened"],
      from: "amp_help_days",
      columns: "kind::text AS kind,skill_id,opened",
      key: "kind::text||'/'||skill_id",
    }),
    dayTable(pool, org, {
      name: "help_events.csv",
      header: [
        "person_id",
        "day",
        "at",
        "kind",
        "source",
        "skill_id",
        "ref",
        "problem_id",
        "step",
      ],
      from: "amp_help_events",
      columns:
        "to_char(\"at\" AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS at,kind::text AS kind,source::text AS source,skill_id,ref,problem_id,step",
      key: "to_char(\"at\" AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US')||'/'||kind::text||'/'||ref||'/'||COALESCE(problem_id,'')",
    }),
    dayTable(pool, org, {
      name: "level_days.csv",
      header: [
        "person_id",
        "day",
        "overall_level",
        "overall_sd",
        "policy_version",
        "strands",
      ],
      from: "amp_level_days",
      columns: `(frontier->'overall'->>'level')::float8 AS overall_level,(frontier->'overall'->>'sd')::float8 AS overall_sd,policy_version,(frontier->'strands')::text AS strands`,
      key: "day::text",
    }),
  ];
}

/** A table per day: people a page at a time, their rows a page at a time, so one
 * long-serving student can't grow a batch. */
function dayTable(
  pool: Pool,
  org: { orgId: string; path: string[] },
  spec: {
    name: string;
    header: readonly string[];
    from: string;
    columns: string;
    key: string;
  },
): Table {
  return {
    name: spec.name,
    header: spec.header,
    rows: () =>
      (async function* () {
        for await (const people of peopleOf(pool, org)) {
          const personOf = new Map(people.map((row) => [row.learner, row]));
          for await (const rows of byKeyset<
            Record<string, string | number | null>
          >(
            async (last) =>
              (
                await pool.query(
                  `SELECT learner_id,day::text AS day,(${spec.key}) AS row_key,${spec.columns} FROM ${spec.from}
                   WHERE learner_id=ANY($1::text[])
                     AND ($2::text IS NULL OR (learner_id,day,(${spec.key}))>($2::text,$3::date,$4::text))
                   ORDER BY learner_id,day,(${spec.key}) LIMIT ${EXPORT_BATCH}`,
                  [
                    people.map((row) => row.learner),
                    last?.learner_id ?? null,
                    last?.day ?? null,
                    last?.row_key ?? null,
                  ],
                )
              ).rows,
          ))
            // Someone who has moved on: only their days here are this school's.
            yield rows.flatMap(
              ({ learner_id: learner, day, row_key: _key, ...rest }) => {
                const person = personOf.get(learner as string)!;
                return person.until && (day as string) >= person.until
                  ? []
                  : [[person.id, day!, ...Object.values(rest)]];
              },
            );
        }
      })(),
  };
}

/** The whole school as a ZIP of CSVs, a batch at a time from the database to the
 * wire. Nothing here holds more than a batch, whatever the school's size, and the
 * response's backpressure paces the queries. */
export function schoolExport(
  pool: Pool,
  org: { orgId: string; path: string[] },
): Readable {
  const tables = exportTables(pool, org);
  return Readable.from(
    (async function* () {
      const ready: Uint8Array[] = [];
      const zip = new Zip((error, data) => {
        if (error) throw error;
        ready.push(data);
      });
      for (const table of tables) {
        const entry = new ZipDeflate(table.name, { level: 6 });
        zip.add(entry);
        entry.push(strToU8(`﻿${csvLine(table.header)}`), false);
        for await (const rows of table.rows()) {
          entry.push(strToU8(rows.map(csvLine).join("")), false);
          while (ready.length) yield Buffer.from(ready.shift()!);
        }
        entry.push(new Uint8Array(0), true);
        while (ready.length) yield Buffer.from(ready.shift()!);
      }
      zip.end();
      while (ready.length) yield Buffer.from(ready.shift()!);
    })(),
    { objectMode: false },
  );
}
