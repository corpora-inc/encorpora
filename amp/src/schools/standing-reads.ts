import type { PoolClient } from "pg";
import { PLACEMENT_ATTEMPTS } from "../learning/placement.js";
import {
  classesHere,
  orgScope,
  schoolsBelow,
  SQL_ACTIVE_STUDENTS,
  termInUse,
} from "./org-reads.js";
import type {
  ClassStandingResponse,
  OrgStandingResponse,
} from "./standing-contracts.js";
import { growthArraySql } from "./growth.js";
import {
  gridFor,
  medianInterval,
  seedOf,
  type Normal,
} from "./standing-math.js";
import { curveOf, round, standingNormal } from "./standing-curve.js";
import { levelSdSql } from "./student-sd.js";
import { PERSON_NAME } from "./term-grades.js";

/**
 * Where students stand against their own grade, as curves. Every rostered
 * student is on them: a student with answers at their estimate N(μ, σ²); one
 * whose practice has opened but who hasn't answered yet at the stored starting
 * guess and its wide sd; one who has never opened practice at the age-expected
 * grade with the typical national spread for their grade. A new school is a
 * flat, wide curve that narrows as answers come in.
 */
type Database = Pick<PoolClient, "query">;

export type StandingRow = {
  id: string;
  org: string;
  grade: number | null;
  /** Latest stored level and sd, whatever it stands on; null: never stored. */
  level: number | null;
  sd: number | null;
  answered: number;
  birthYear: number | null;
  classes: string[];
};

/** Everyone rostered here today, each with their latest stored level and the
 * classes they're in this year: one read, straight off the level-day index for
 * the level, one heap row for its sd. */
async function standingRows(
  db: Database,
  orgId: string,
): Promise<StandingRow[]> {
  const { rows } = await db.query(
    `WITH roster AS MATERIALIZED (${SQL_ACTIVE_STUDENTS})
     SELECT r.id,r.org_id AS org,r.grade_level AS grade,l.birth_year AS "birthYear",
       latest.overall_level::float8 AS level,latest.sd,
       COALESCE(latest.overall_answered,0)::int AS answered,
       ARRAY(SELECT e.class_id::text FROM amp_enrollments e JOIN amp_orgs eo ON eo.id=r.org_id
         WHERE e.person_id=r.id AND e.role='student'
           AND e.begin_on<=(now() AT TIME ZONE eo.timezone)::date
           AND (e.end_on IS NULL OR e.end_on>(now() AT TIME ZONE eo.timezone)::date)) AS classes
     FROM roster r JOIN amp_learners l ON l.id=r.learner_id
     LEFT JOIN LATERAL (
       SELECT d.overall_level,d.overall_answered,${levelSdSql("d")} AS sd FROM amp_level_days d
       WHERE d.learner_id=r.learner_id ORDER BY d.day DESC LIMIT 1
     ) latest ON true`,
    [orgId],
  );
  return rows;
}

const gradesOf = (rows: readonly { grade: number | null }[]) =>
  [
    ...new Set(
      rows.map((row) => row.grade).filter((g): g is number => g !== null),
    ),
  ].sort((a, b) => a - b);

/** A school's curve and its classes', or a district's and its schools'. */
export async function readOrgStanding(
  db: Database,
  orgId: string,
  now: Date = new Date(),
): Promise<OrgStandingResponse> {
  const [org, rows] = await Promise.all([
    orgScope(db, orgId, now),
    standingRows(db, orgId),
  ]);
  const isSchool = org.kind === "school";
  const groups = isSchool
    ? (await classesHere(db, orgId)).map((row) => ({
        id: row.id,
        name: row.name,
        kind: "class" as const,
        has: (student: StandingRow) => student.classes.includes(row.id),
      }))
    : (await schoolsBelow(db, orgId)).map((row) => ({
        id: row.id,
        name: row.name,
        kind: "school" as const,
        has: (student: StandingRow) => student.org === row.id,
      }));
  const at = now.getTime();
  const placed = rows.map((row) => ({
    row,
    normal: standingNormal(row, at),
  }));
  const onAxis = placed.filter(
    (entry): entry is { row: StandingRow; normal: Normal } =>
      entry.normal !== null,
  );
  const grid = gridFor(
    onAxis.map((entry) => entry.normal),
    {},
  );
  const curveFor = (
    members: readonly { row: StandingRow; normal: Normal }[],
    seed: string,
  ) =>
    curveOf(
      members.map((entry) => entry.normal),
      members.map((entry) => entry.row.grade),
      members.filter((entry) => entry.row.answered < PLACEMENT_ATTEMPTS)
        .length,
      grid,
      seed,
    );
  return {
    org: { id: org.id, name: org.name, kind: org.kind },
    settleAt: PLACEMENT_ATTEMPTS,
    grid,
    all: curveFor(onAxis, org.id),
    grades: gradesOf(rows),
    groups: groups
      .map((group) => {
        const members = onAxis.filter((entry) => group.has(entry.row));
        return {
          id: group.id,
          name: group.name,
          kind: group.kind,
          grades: gradesOf(members.map((entry) => entry.row)),
          curve: curveFor(members, group.id),
        };
      })
      // An empty group has no curve to show.
      .filter((group) => group.curve.n > 0),
  };
}

/** One class: its curve, each student's band, and growth this term with its
 * interval. Read once; the numbers are the same pass as the school's. */
export async function readClassStanding(
  db: Database,
  classId: string,
  now: Date = new Date(),
): Promise<ClassStandingResponse> {
  const { rows: classRows } = await db.query(
    `SELECT c.id,c.name,c.org_id AS org FROM amp_classes c WHERE c.id=$1`,
    [classId],
  );
  const klass = classRows[0] as { id: string; name: string; org: string };
  const org = await orgScope(db, klass.org, now);
  const term = await termInUse(db, org);
  const through = term.endsOn < org.today ? term.endsOn : org.today;
  const { rows } = await db.query(
    `SELECT p.id,${PERSON_NAME} AS name,p.grade_level AS grade,l.birth_year AS "birthYear",
       latest.overall_level::float8 AS level,latest.sd,
       COALESCE(latest.overall_answered,0)::int AS answered,
       growth.mu AS "growthMu",growth.sd AS "growthSd"
     FROM amp_enrollments e JOIN amp_classes c ON c.id=e.class_id JOIN amp_orgs o ON o.id=c.org_id
     JOIN amp_people p ON p.id=e.person_id AND p.deleted_at IS NULL AND p.learner_id IS NOT NULL
     JOIN amp_learners l ON l.id=p.learner_id
     LEFT JOIN LATERAL (
       SELECT d.overall_level,d.overall_answered,${levelSdSql("d")} AS sd FROM amp_level_days d
       WHERE d.learner_id=p.learner_id ORDER BY d.day DESC LIMIT 1
     ) latest ON true
     LEFT JOIN LATERAL (
       SELECT g.mu, g.sd FROM (
         SELECT ${growthArraySql({
           learner: "p.learner_id",
           from: "GREATEST($2::date, e.begin_on)",
           to: "$3::date",
         })} AS pair
       ) raw, LATERAL (SELECT raw.pair[1] AS mu, raw.pair[2] AS sd) g
     ) growth ON growth.mu IS NOT NULL
     WHERE e.class_id=$1 AND e.role='student'
       AND e.begin_on<=(now() AT TIME ZONE o.timezone)::date
       AND (e.end_on IS NULL OR e.end_on>(now() AT TIME ZONE o.timezone)::date)`,
    [classId, term.startsOn, through],
  );
  type Row = StandingRow & {
    name: string;
    growthMu: number | null;
    growthSd: number | null;
  };
  const at = now.getTime();
  const students = (rows as Row[])
    .map((row) => {
      const normal = standingNormal(row, at);
      const growth =
        row.growthMu !== null && row.growthSd !== null
          ? { mu: Number(row.growthMu), sd: Number(row.growthSd) }
          : null;
      return { row, normal, growth };
    })
    .filter(
      (
        entry,
      ): entry is {
        row: Row;
        normal: Normal;
        growth: Normal | null;
      } => entry.normal !== null,
    );
  const grades = gradesOf(students.map((entry) => entry.row));
  // One rostered grade: the axis stops at the curriculum's ends for it.
  const only = grades.length === 1 ? grades[0]! : null;
  const grid = gridFor(
    students.map((entry) => entry.normal),
    only === null ? {} : { limits: [-1 - only, 13 - only] },
  );
  const growths = students
    .map((entry) => entry.growth)
    .filter((growth): growth is Normal => growth !== null);
  const growth = medianInterval(growths, {
    seed: seedOf(`${classId}:growth`),
    mode: "bootstrap",
  });
  return {
    class: klass,
    term: { name: term.name, startsOn: term.startsOn, endsOn: term.endsOn },
    settleAt: PLACEMENT_ATTEMPTS,
    grid,
    grades,
    curve: curveOf(
      students.map((entry) => entry.normal),
      students.map((entry) => entry.row.grade),
      students.filter((entry) => entry.row.answered < PLACEMENT_ATTEMPTS)
        .length,
      grid,
      classId,
    ),
    growth: growth && {
      median: round(growth.median, 2),
      low: round(growth.low, 2),
      high: round(growth.high, 2),
      n: growths.length,
    },
    students: students
      .map(({ row, normal, growth: gain }) => ({
        id: row.id,
        name: row.name,
        grade: row.grade,
        mu: round(normal.mu),
        sd: round(normal.sd),
        answered: row.answered,
        growth: gain && { mu: round(gain.mu, 2), sd: round(gain.sd, 2) },
      }))
      .sort((a, b) => a.mu - b.mu || a.name.localeCompare(b.name, "en")),
  };
}
